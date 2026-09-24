const shield = require('../services/shieldService');

/**
 * Anti-Raid — join gate (account age / no avatar) + join-rate detection. When too many
 * accounts join inside the window, raid mode switches on and every new joiner gets the
 * configured action until it expires (dashboard: /shield raidmode or auto-expiry).
 */

const recentJoins = new Map(); // guildId -> [{ id, at }]

async function act(guild, member, action, reason) {
  if (action === 'ban') return shield.punish(guild, member.id, 'ban', reason);
  if (action === 'timeout') return shield.punish(guild, member.id, 'timeout', reason);
  return shield.punish(guild, member.id, 'kick', reason);
}

async function handleMemberAdd(member) {
  const guild = member.guild;
  const cfg = await shield.getConfig(guild.id);
  const ar = cfg.antiRaid;
  if (!ar.enabled) return false;
  if (await shield.isTrusted(guild, member.id, cfg)) return false;

  // Raid mode auto-expiry (also handled by the 30s tick, this is just instant)
  if (ar.raidActive && ar.raidUntil && Date.now() > ar.raidUntil) await shield.raidModeSet(guild, false, 'auto-expire');

  // 1) Join gate
  const ageDays = (Date.now() - member.user.createdTimestamp) / 86_400_000;
  let gateReason = null;
  if (ar.minAccountAgeDays > 0 && ageDays < ar.minAccountAgeDays) gateReason = `Account younger than ${ar.minAccountAgeDays} day(s) (${ageDays.toFixed(1)}d)`;
  else if (ar.blockNoAvatar && !member.user.avatar) gateReason = 'No profile picture';
  if (gateReason) {
    await member.send(`تم منعك من دخول **${guild.name}** بواسطة نظام الحماية (${gateReason}).`).catch(() => {});
    const result = await act(guild, member, ar.action, gateReason);
    await shield.record(guild.client, guild.id, 'gate', { userId: member.id, action: result, reason: gateReason });
    return true;
  }

  // 2) Raid mode already active → punish every newcomer
  const fresh = await shield.getConfig(guild.id, { fresh: true });
  if (fresh.antiRaid.raidActive) {
    const result = await act(guild, member, ar.action, 'Raid mode active');
    await shield.record(guild.client, guild.id, 'raid', { userId: member.id, action: result, reason: 'Joined during raid mode' });
    return true;
  }

  // 3) Join-rate detection
  const now = Date.now();
  const list = (recentJoins.get(guild.id) || []).filter((j) => now - j.at < ar.windowSec * 1000);
  list.push({ id: member.id, at: now });
  recentJoins.set(guild.id, list);
  if (list.length >= ar.joinLimit) {
    await shield.raidModeSet(guild, true, 'auto-detected');
    await shield.record(guild.client, guild.id, 'raid', { action: `Raid detected — ${list.length} joins in ${ar.windowSec}s. Raid mode ON`, reason: 'Join rate exceeded' });
    for (const j of list) {
      const m = guild.members.cache.get(j.id);
      if (m && !(await shield.isTrusted(guild, m.id, cfg))) await act(guild, m, ar.action, 'Part of a detected raid');
    }
    recentJoins.set(guild.id, []);
    if (ar.autoLockdown) await shield.panicOn(guild, 'Raid detected').catch(() => {});
    return true;
  }
  return false;
}

module.exports = { handleMemberAdd };
