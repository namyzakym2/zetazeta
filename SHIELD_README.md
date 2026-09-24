# ZETA Shield (Wick-inspired protection) + new dashboard

## New commands (Administrator)
- `/shield status | antinuke | limit | antiraid | antispam | logchannel`
- `/whitelist add|remove|list`  — trusted users/bots/roles (never punished)
- `/quarantine add|release|list` — strip roles + timeout, restore on release
- `/panic on|off` — lock every text channel / restore
- `/raidmode on|off`
- `/backup create|list|restore|delete` — roles + channels + role overwrites (restore only re-creates what is missing)

## What it does
- **Anti-Nuke**: mass channel/role create+delete, mass ban/kick, webhook floods, unauthorized bot adds,
  dangerous permissions on @everyone (or any role in strict mode). Punishment: quarantine / strip / kick / ban.
  Deleted channels & roles are re-created (revert).
- **Anti-Raid**: join gate (account age, no avatar), join-rate detection → raid mode, optional auto panic-lock.
- **Anti-Spam (heat)**: mentions/links/duplicates/attachments add heat; crossing the threshold times the member out.
- Everything is logged to the Shield alert channel (or the automod log) and to the dashboard (Cases).

## Needs
- Bot permissions: Manage Roles, Manage Channels, Kick/Ban, Moderate Members, View Audit Log, Manage Webhooks.
- Gateway intent `GuildWebhooks` was added in `src/bot.js`. The bot's role must be ABOVE the roles it quarantines.
- Re-deploy commands once (`npm run deploy` or restart — the bot syncs on start).

## Dashboard
New shell (light blue, matches the reference), real overview stats, ZETA Shield page, glass icons
(`dashboard/public/images/icons`, originals from `assets/emojis`). AutoMod page fixed: it used to save fields the bot never read.
