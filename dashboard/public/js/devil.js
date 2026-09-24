(() => {
  const app = document.getElementById('app');
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const api = async (url, options = {}) => {
    const r = await fetch(url, { credentials:'same-origin', headers:{'Content-Type':'application/json'}, ...options });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'فشل الطلب');
    return d;
  };
  const toast = (msg, bad=false) => { const old=document.querySelector('.devil-toast'); old?.remove(); const x=document.createElement('div'); x.className='devil-toast '+(bad?'error':'success'); x.textContent=msg; document.body.appendChild(x); setTimeout(()=>x.remove(),2600); };
  let state = { blocked:[], emojis:[] };

  function render() {
    app.innerHTML = `
      <div class="devil-panel">
        <div class="card devil-hero"><div><div class="devil-kicker">😈 DEVIL PANEL</div><h2>لوحة تحكم البوت</h2><p>إدارة إيموجيات البوت والسيرفرات المحظورة.</p></div><div class="devil-status">🟢 متصل</div></div>

        <section class="card">
          <div class="devil-title"><div><span class="devil-icon">🎨</span><b>Custom Emojis — إيموجيات البوت</b></div><span class="devil-count">${state.emojis.length}</span></div>
          <p class="devil-muted">أنشئ إيموجيات مخصصة للبوت نفسه. الإيموجيات التي تضيفها من هنا لا يتم حذفها عند إعادة تشغيل البوت.</p>
          <div class="emoji-create-box">
            <div class="devil-form"><label>اسم الإيموجي</label><input id="emojiName" class="devil-input" maxlength="32" placeholder="مثال: balance" /></div>
            <div class="devil-form"><label>الصورة</label><input id="emojiFile" class="devil-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></div>
            <button class="btn" id="createEmoji">➕ إنشاء Custom Emoji</button>
          </div>
          <div id="emojiList" class="emoji-list">
            ${state.emojis.length ? state.emojis.map(e => `<div class="emoji-item"><div class="emoji-preview"><img src="${esc(e.url)}" alt="${esc(e.name)}"><div><b>:${esc(e.name)}:</b><small>${esc(e.tag)}</small></div></div><button class="btn danger" data-delete-emoji="${esc(e.id)}">🗑 حذف</button></div>`).join('') : '<div class="devil-empty">🎨 لا توجد إيموجيات مخصصة حتى الآن.</div>'}
          </div>
        </section>

        <section class="card">
          <div class="devil-title"><div><span class="devil-icon">🔊</span><b>السيرفرات المحظورة</b></div><span class="devil-count">${state.blocked.length}</span></div>
          <div class="blocked-list">${state.blocked.length ? state.blocked.map(x => `<div class="activity-row devil-blocked-row"><div><b>${esc(x.guildId)}</b><span>${esc(x.reason || 'بدون سبب')}</span></div><button class="btn" data-unblock="${esc(x.guildId)}">🔓 فك الحظر</button></div>`).join('') : '<div class="devil-empty">✅ لا توجد سيرفرات محظورة.</div>'}</div>
        </section>
      </div>`;
    bind();
  }

  function bind() {
    document.getElementById('createEmoji')?.addEventListener('click', async () => {
      const name = document.getElementById('emojiName').value.trim();
      const file = document.getElementById('emojiFile').files[0];
      if (!/^[A-Za-z0-9_]{2,32}$/.test(name)) return toast('اسم الإيموجي غير صالح.', true);
      if (!file) return toast('اختر صورة للإيموجي.', true);
      if (file.size > 256 * 1024) return toast('حجم الصورة أكبر من 256KB.', true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api('/devil-panel/emojis', { method:'POST', body:JSON.stringify({ name, image:reader.result }) });
          toast('تم إنشاء الإيموجي للبوت 🎨');
          await load();
        } catch(e) { toast(e.message, true); }
      };
      reader.readAsDataURL(file);
    });
    app.querySelectorAll('[data-delete-emoji]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('هل تريد حذف هذا الـ Custom Emoji؟')) return;
      try { await api('/devil-panel/emojis/'+encodeURIComponent(b.dataset.deleteEmoji), {method:'DELETE'}); toast('تم حذف الإيموجي.'); await load(); }
      catch(e) { toast(e.message,true); }
    }));
    app.querySelectorAll('[data-unblock]').forEach(b => b.addEventListener('click', async () => {
      try { await api('/devil-panel/servers/unblock',{method:'POST',body:JSON.stringify({guildId:b.dataset.unblock})}); toast('تم فك حظر السيرفر.'); await load(); }
      catch(e) { toast(e.message,true); }
    }));
  }

  async function load() {
    try {
      await api('/devil-panel/access');
      const [blocked, emojis] = await Promise.all([api('/devil-panel/servers/blocked'), api('/devil-panel/emojis')]);
      state = { blocked:blocked.blocked || [], emojis:emojis.emojis || [] };
      render();
    } catch(e) { app.innerHTML=`<div class="card"><h2>⛔ غير مصرح</h2><p>${esc(e.message)}</p></div>`; }
  }
  load();
})();
