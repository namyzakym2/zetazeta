(() => {
  const app = document.getElementById('app');
  const title = document.getElementById('sectionTitle');
  const avatar = document.getElementById('profileAvatar');
  const name = document.getElementById('pName');
  const id = document.getElementById('pId');
  const wallet = document.getElementById('pWallet');
  let me = null;
  let profile = null;
  let servers = [];

  async function get(url, options = {}) {
    const r = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'تعذر تحميل البيانات.');
    return data;
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]);
  }

  function discordAvatar(user) {
    if (user?.avatar) {
      const hash = typeof user.avatar === 'object' ? user.avatar.id : user.avatar;
      if (hash) return `https://cdn.discordapp.com/avatars/${user.id}/${hash}.png?size=256`;
    }
    return `https://cdn.discordapp.com/embed/avatars/${Number(user?.discriminator || 0) % 5}.png`;
  }

  function renderOverview() {
    title.textContent = 'نظرة عامة';
    app.innerHTML = `
      <section class="grid-2">
        <div class="card"><h2>مرحبًا ${esc(me?.username || '')} 👋</h2><p>من هنا تقدر تختار السيرفر وتدخل إعدادات ZETA.</p></div>
        <div class="card"><h2>الرصيد</h2><div class="stat-value">${Number(profile?.wallet?.balance || 0).toLocaleString('en-US')} SC</div></div>
      </section>
      <section class="card"><h2>إحصائيات النشاط</h2><div class="stats-grid">${(profile?.activityProfiles || []).map(x => `<div class="stat-card"><b>${esc(x.guildName)}</b><span>المستوى ${x.level}</span><span>${x.xp} XP · ${x.messages} رسالة</span></div>`).join('') || '<p>لا توجد بيانات نشاط بعد.</p>'}</div></section>`;
  }

  function renderServers() {
    title.textContent = 'سيرفراتي';
    app.innerHTML = `<section class="card"><h2>السيرفرات القابلة للإدارة</h2><div class="server-grid">${servers.map(s => `
      <article class="server-card">
        ${s.icon ? `<img src="${esc(s.icon)}" alt="">` : '<div class="server-icon">V</div>'}
        <div><h3>${esc(s.name)}</h3><p>${s.installed ? 'ZETA مثبت ✅' : 'ZETA غير مثبت'}</p></div>
        ${s.installed ? `<a class="btn primary" href="/dashboard/index.html?guildId=${encodeURIComponent(s.id)}">إدارة</a>` : `<a class="btn" href="https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(s.id && profile?.clientId || '')}&scope=bot%20applications.commands&permissions=8&guild_id=${encodeURIComponent(s.id)}" target="_blank" rel="noopener">إضافة البوت</a>`}
      </article>`).join('') || '<p>لم نجد سيرفرات يمكنك إدارتها.</p>'}</div></section>`;
  }

  function renderActivity() {
    title.textContent = 'نشاطي';
    app.innerHTML = `<section class="card"><h2>نشاطي في السيرفرات</h2>${(profile?.activityProfiles || []).map(x => `<div class="activity-row"><b>${esc(x.guildName)}</b><span>Lv.${x.level}</span><span>${x.xp} XP</span><span>${x.messages} رسالة</span><span>${x.rank ? `#${x.rank}` : '—'}</span></div>`).join('') || '<p>لا توجد بيانات نشاط.</p>'}</section>`;
  }

  async function load() {
    try {
      const [m, p, s] = await Promise.all([get('/user/me'), get('/user/profile'), get('/user/servers')]);
      me = m; profile = { ...p, clientId: s.clientId }; servers = s.servers || [];
      name.textContent = me.username || 'Discord User';
      id.textContent = me.id || '';
      avatar.src = me.avatar || discordAvatar(me);
      wallet.textContent = Number(p.wallet?.balance || 0).toLocaleString('en-US');
      renderOverview();
    } catch (err) {
      app.innerHTML = `<section class="card"><h2>تعذر تحميل لوحة التحكم</h2><p>${esc(err.message)}</p><a class="btn primary" href="/auth/discord">تسجيل الدخول مجددًا</a></section>`;
    }
  }

  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.section === 'servers') renderServers();
    else if (btn.dataset.section === 'activity') renderActivity();
    else renderOverview();
  }));

  load();
})();
