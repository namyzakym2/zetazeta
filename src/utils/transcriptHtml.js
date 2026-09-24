/**
 * يبني ملف HTML كامل لمحادثة تذكرة مغلقة (بديل ملف txt القديم) — تصميم بسيط
 * يشبه واجهة ديسكورد الداكنة، صالح يُفتح مباشرة بالمتصفح بدون أي اعتماديات
 * خارجية (كل شي CSS مضمّن بنفس الملف).
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatTimestamp(date) {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * @param {import('discord.js').TextChannel} channel
 * @param {{ channelName?: string, ownerTag?: string, guildName?: string }} meta
 * @returns {Promise<string>} HTML string
 */
async function buildHtmlTranscript(channel, meta = {}) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].reverse();

  const rows = sorted
    .map((m) => {
      const avatar = m.author.displayAvatarURL({ extension: 'png', size: 64 });
      const attachments = [...m.attachments.values()]
        .map((a) => `<div class="attachment">📎 <a href="${escapeHtml(a.url)}" target="_blank">${escapeHtml(a.name)}</a></div>`)
        .join('');
      const content = m.content ? `<div class="content">${escapeHtml(m.content)}</div>` : '';
      const bot = m.author.bot ? ' <span class="badge">BOT</span>' : '';

      return `
        <div class="message">
          <img class="avatar" src="${escapeHtml(avatar)}" alt="">
          <div class="body">
            <div class="meta">
              <span class="author">${escapeHtml(m.author.tag)}</span>${bot}
              <span class="time">${escapeHtml(formatTimestamp(m.createdAt))}</span>
            </div>
            ${content}
            ${attachments}
          </div>
        </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>Transcript - ${escapeHtml(meta.channelName || channel.name)}</title>
<style>
  body { background:#313338; color:#dbdee1; font-family: 'Segoe UI', Tahoma, sans-serif; margin:0; padding:20px; }
  .header { background:#2b2d31; border-radius:8px; padding:16px 20px; margin-bottom:16px; }
  .header h1 { margin:0 0 6px; font-size:18px; color:#fff; }
  .header p { margin:2px 0; font-size:13px; color:#949ba4; }
  .message { display:flex; gap:12px; padding:8px 4px; border-radius:6px; }
  .message:hover { background:#2e3035; }
  .avatar { width:40px; height:40px; border-radius:50%; flex-shrink:0; }
  .meta { display:flex; align-items:baseline; gap:8px; }
  .author { font-weight:600; color:#fff; font-size:14px; }
  .badge { background:#5865f2; color:#fff; font-size:10px; padding:1px 5px; border-radius:4px; }
  .time { font-size:11px; color:#949ba4; }
  .content { white-space:pre-wrap; word-break:break-word; font-size:14px; margin-top:2px; }
  .attachment { margin-top:4px; font-size:13px; }
  .attachment a { color:#00a8fc; text-decoration:none; }
</style>
</head>
<body>
  <div class="header">
    <h1>🎫 نسخة محادثة التذكرة</h1>
    <p>القناة: #${escapeHtml(meta.channelName || channel.name)}</p>
    ${meta.ownerTag ? `<p>صاحب التذكرة: ${escapeHtml(meta.ownerTag)}</p>` : ''}
    ${meta.guildName ? `<p>السيرفر: ${escapeHtml(meta.guildName)}</p>` : ''}
    <p>عدد الرسائل: ${sorted.length}</p>
  </div>
  ${rows || '<p style="color:#949ba4">لا يوجد رسائل.</p>'}
</body>
</html>`;
}

module.exports = { buildHtmlTranscript };
