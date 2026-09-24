/* ============================================================
   ZETA — dashboard shell helpers (loaded before main.js).
   Icons, formatting, the interactive chart, the Ctrl+K palette,
   the mobile drawer, the notification bell and toasts.
   Nothing in here talks to the API; main.js owns the data.
   ============================================================ */
(function () {
  const S = (d) => d; // path data helper, keeps the map readable

  /* ---------- Icons (24×24, stroke) ---------- */
  const PATHS = {
    home: S('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v10.5a1 1 0 0 0 1 1h3.5v-6h5v6H18a1 1 0 0 0 1-1V9"/>'),
    command: S('<path d="m6 6 12 12M18 6 6 18"/>'),
    shield: S('<path d="M12 3 4.5 6v5.6c0 4.6 3.1 8 7.5 9.4 4.4-1.4 7.5-4.8 7.5-9.4V6L12 3Z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
    ticket: S('<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5V10a2 2 0 0 0 0 4v1.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5V14a2 2 0 0 0 0-4V8.5Z"/><path d="M14 7v10" stroke-dasharray="1.6 2.2"/>'),
    door: S('<path d="M14 4h3.5A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M4 12h9M9.5 8 13.5 12l-4 4"/>'),
    message: S('<path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.4-4.4A7.5 7.5 0 1 1 20 12Z"/><path d="M8.5 11h7M8.5 14h4"/>'),
    userCog: S('<circle cx="9.5" cy="8" r="3.2"/><path d="M3.5 19.5v-.8a5.5 5.5 0 0 1 8.4-4.7"/><circle cx="17.5" cy="16.5" r="2"/><path d="M17.5 12.8v1.2M17.5 19v1.2M14.3 14.6l1 .6M19.7 17.8l1 .6M14.3 18.4l1-.6M19.7 15.2l1-.6"/>'),
    coins: S('<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5"/><ellipse cx="15.5" cy="14.5" rx="5.5" ry="2.5"/><path d="M10 14.5v3.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.100 5.5-2.500v-3.500"/>'),
    trophy: S('<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a1 1 0 0 0-1 1c0 2.200 1.500 3.500 4 3.800M16 6h3a1 1 0 0 1 1 1c0 2.200-1.500 3.500-4 3.800"/><path d="M12 13v4M8.500 20h7M10 17h4v3h-4z"/>'),
    star: S('<path d="m12 3.500 2.600 5.300 5.800.8-4.200 4.100 1 5.800-5.200-2.700-5.200 2.700 1-5.800L3.600 9.600l5.800-.8L12 3.500Z"/>'),
    bolt: S('<path d="M13 2.500 5 13.500h6l-1 8 8-11h-6l1-8Z"/>'),
    bulb: S('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.600 10.800c.6.500 1 1.200 1 2V16h5.200v-.2c0-.8.400-1.500 1-2A6 6 0 0 0 12 3Z"/>'),
    flag: S('<path d="M5.500 21V4"/><path d="M5.500 4.500h11l-2 3.800 2 3.700h-11"/>'),
    clipboard: S('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>'),
    layout: S('<rect x="3.500" y="4.500" width="17" height="15" rx="2"/><path d="M3.500 9.500h17M9 9.500v10"/>'),
    grid: S('<rect x="4" y="4" width="6.500" height="6.500" rx="1.500"/><rect x="13.500" y="4" width="6.500" height="6.500" rx="1.500"/><rect x="4" y="13.500" width="6.500" height="6.500" rx="1.500"/><rect x="13.500" y="13.500" width="6.500" height="6.500" rx="1.500"/>'),
    list: S('<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>'),
    ticketCheck: S('<path d="M3 8.500A1.500 1.500 0 0 1 4.500 7h15A1.500 1.500 0 0 1 21 8.500V10a2 2 0 0 0 0 4v1.500a1.500 1.500 0 0 1-1.500 1.500h-15A1.500 1.500 0 0 1 3 15.500V14a2 2 0 0 0 0-4V8.500Z"/><path d="m9.500 12 1.800 1.800 3.200-3.600"/>'),
    terminal: S('<rect x="3" y="4.500" width="18" height="15" rx="2"/><path d="m7 10 3 2.500L7 15M12.500 15H17"/>'),
    smile: S('<circle cx="12" cy="12" r="8.500"/><path d="M8.500 14a4.200 4.200 0 0 0 7 0M9 9.500h.01M15 9.500h.01"/>'),
    palette: S('<path d="M12 3.500a8.500 8.500 0 1 0 0 17c1.200 0 1.800-.8 1.800-1.700 0-1.200-.9-1.500-.9-2.500 0-1 .8-1.800 1.900-1.800H17a3.500 3.500 0 0 0 3.500-3.500C20.500 6.900 16.700 3.500 12 3.500Z"/><path d="M7.500 11h.01M10 7.800h.01M14.500 7.800h.01"/>'),
    bell: S('<path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15L6 16.500Z"/><path d="M10 21h4"/>'),
    gear: S('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.200M12 18.800V21M4.600 7.500l1.900 1.100M17.500 15.400l1.900 1.100M4.600 16.500l1.900-1.100M17.500 8.600l1.900-1.100"/><circle cx="12" cy="12" r="6.800" stroke-dasharray="3.500 2.800"/>'),
    server: S('<rect x="3.500" y="4" width="17" height="6.500" rx="2"/><rect x="3.500" y="13.500" width="17" height="6.500" rx="2"/><path d="M7.500 7.200h.01M7.500 16.800h.01"/>'),
    users: S('<circle cx="9" cy="8.500" r="3.300"/><path d="M2.800 19.500a6.200 6.200 0 0 1 12.400 0"/><path d="M16 5.500a3.100 3.100 0 0 1 0 6M18 14.200a6 6 0 0 1 3.200 5.300"/>'),
    code: S('<path d="m8.500 8-4 4 4 4M15.500 8l4 4-4 4M13.500 6l-3 12"/>'),
    clock: S('<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>'),
    search: S('<circle cx="11" cy="11" r="6.500"/><path d="m16 16 4.500 4.500"/>'),
    chevronDown: S('<path d="m6 9.500 6 6 6-6"/>'),
    chevronLeft: S('<path d="m14.500 6-6 6 6 6"/>'),
    arrowLeft: S('<path d="M19 12H5.500M11 6l-6 6 6 6"/>'),
    arrowUp: S('<path d="M12 19V5.500M6 11l6-6 6 6"/>'),
    arrowDown: S('<path d="M12 5v13.500M6 13l6 6 6-6"/>'),
    crown: S('<path d="m3.500 8 4.300 4 4.200-6.500 4.200 6.500 4.300-4-1.700 10.500H5.200L3.500 8Z"/>'),
    check: S('<path d="m5 12.500 4.500 4.500L19 7.500"/>'),
    copy: S('<rect x="8.500" y="8.500" width="11" height="11" rx="2"/><path d="M15.500 8.500V6.500a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>'),
    plus: S('<path d="M12 5v14M5 12h14"/>'),
    menu: S('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    x: S('<path d="m6 6 12 12M18 6 6 18"/>'),
    heart: S('<path d="M12 20s-7.500-4.400-7.500-10A4.200 4.200 0 0 1 12 7.600 4.200 4.200 0 0 1 19.500 10c0 5.600-7.500 10-7.500 10Z" fill="currentColor" stroke="none"/>'),
    pulse: S('<path d="M3 12h4l2.500-6 4 12 2.500-6H21"/>'),
    inbox: S('<path d="M4 13.500 6.500 5.500h11l2.500 8"/><path d="M4 13.500V18a1.500 1.500 0 0 0 1.500 1.500h13A1.500 1.500 0 0 0 20 18v-4.500h-4.500a3.500 3.500 0 0 1-7 0H4Z"/>'),
    spark: S('<path d="M12 3.500c.6 4.400 2.100 5.900 6.500 6.500-4.400.6-5.900 2.100-6.500 6.500-.6-4.400-2.100-5.900-6.500-6.500C9.900 9.400 11.400 7.900 12 3.500Z"/><path d="M18.500 15.500c.3 1.900.9 2.500 2.800 2.800-1.900.3-2.500.9-2.800 2.800-.3-1.900-.9-2.500-2.800-2.800 1.900-.3 2.500-.9 2.800-2.800Z"/>'),
    warn: S('<path d="M12 4 3 19.500h18L12 4Z"/><path d="M12 10v4.500M12 17.200h.01"/>'),
    dot: S('<circle cx="12" cy="12" r="2.500"/>')
  };

  function icon(name, cls) {
    const p = PATHS[name] || PATHS.dot;
    return `<svg class="vx-i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  }

  // Which icon each dashboard section uses.
  const NAV_ICONS = {
    overview: 'home', shortcuts: 'command', protection: 'shield', tickets: 'ticket', welcomejoin: 'door',
    autoresponder: 'message', autorules: 'userCog', economy: 'coins', leaderboard: 'trophy', level: 'star',
    pointsinteractions: 'bolt', suggestions: 'bulb', reports: 'flag', applications: 'clipboard', embeds: 'layout',
    components: 'grid', logs: 'list', pointstickets: 'ticketCheck', tester: 'terminal', emojis: 'smile', colors: 'palette'
  };

  // Extra search words (English + common Arabic spellings) so the palette finds things either way.
  const NAV_KEYWORDS = {
    overview: 'home dashboard الرئيسية لوحة التحكم نظرة عامة',
    settings: 'settings general prefix اعدادات عامة',
    logs: 'logs audit سجلات',
    'command-center': 'commands permissions help الاوامر صلاحيات مركز الاوامر',
    tickets: 'ticket support تذاكر تكت دعم',
    applications: 'apply staff application تقديم ادارة',
    suggestions: 'suggestions اقتراحات',
    reports: 'reports بلاغات',
    autoresponder: 'auto reply responder ردود تلقائية رد تلقائي',
    automod: 'automod filter links spam كلمات ممنوعة روابط',
    shield: 'shield wick antinuke anti nuke raid quarantine backup panic whitelist حماية درع حجر نسخ احتياطي هجوم تخريب قائمة بيضاء',
    autorole: 'role roles رتب رتبه تلقائية',
    level: 'level xp rank مستويات فل',
    sellerroom: 'seller room بيع روم البيع',
    'staff-points': 'staff points نقاط الادارة موظفين',
    'interaction-points': 'points interactions نقاط تفاعل',
    embeds: 'embed رسائل ايمبد',
    components: 'buttons menus مكونات ازرار قوائم',
    welcomejoin: 'welcome join leave ترحيب انضمام مغادرة'
  };



  // Glass icon helpers live in icons.js (loaded before this file).
  const { img, iconify, NAV_IMG } = window.ZETA_ICONS;

  /* ---------- Formatting ---------- */
  const nf = new Intl.NumberFormat('en-US');
  const fmt = (n) => nf.format(Math.round(Number(n) || 0));

  // Arabic plural forms: 1 → مفرد, 2 → مثنى, 3-10 → جمع, 11+ → مفرد منصوب
  function plural(n, one, two, few, many) {
    n = Math.abs(Math.round(n));
    if (n === 1) return one;
    if (n === 2) return two;
    if (n >= 3 && n <= 10) return `${n} ${few}`;
    return `${n} ${many}`;
  }

  function ago(input) {
    const t = new Date(input).getTime();
    if (!t) return '';
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 45) return 'الآن';
    const m = Math.round(s / 60);
    if (m < 60) return 'قبل ' + plural(m, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة');
    const h = Math.round(m / 60);
    if (h < 24) return 'قبل ' + plural(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
    const d = Math.round(h / 24);
    if (d < 30) return 'قبل ' + plural(d, 'يوم', 'يومين', 'أيام', 'يوماً');
    const mo = Math.round(d / 30);
    return 'قبل ' + plural(mo, 'شهر', 'شهرين', 'أشهر', 'شهراً');
  }

  function duration(ms) {
    if (!ms && ms !== 0) return '—';
    const m = Math.floor(ms / 60000);
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    if (d > 0) return `${d} ${d > 10 ? 'يوماً' : d > 2 ? 'أيام' : 'يوم'}${h ? ' و ' + h + ' س' : ''}`;
    if (h > 0) return `${h} س ${m % 60} د`;
    return `${Math.max(1, m)} د`;
  }

  const norm = (s) =>
    String(s || '').toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

  /* ---------- Count-up (only on the first paint of a page) ---------- */
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countUp(el, to, ms = 650) {
    if (!el) return;
    if (reduceMotion() || !to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('vxToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  /* ---------- Line chart (smooth, hover tooltip) ---------- */
  function niceMax(v) {
    // A max that splits into 3 whole-number intervals (0, a, 2a, 3a) with a little headroom.
    const raw = Math.max(v * 1.08, 3) / 3;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / pow;
    const step = ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => x >= n) || 10) * pow;
    return Math.max(3, Math.ceil(step)) * 3;
  }

  // Monotone cubic interpolation so the curve never dips below zero between points.
  function smoothPath(pts) {
    const n = pts.length;
    if (n < 2) return '';
    const dx = [], dy = [], m = [], t = new Array(n);
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], h = Math.hypot(a, b);
      if (h > 3) { const k = 3 / h; t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let i = 0; i < n - 1; i++) {
      const x1 = pts[i][0] + dx[i] / 3, y1 = pts[i][1] + t[i] * dx[i] / 3;
      const x2 = pts[i + 1][0] - dx[i] / 3, y2 = pts[i + 1][1] - t[i + 1] * dx[i] / 3;
      d += ` C${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)} ${pts[i + 1][0].toFixed(2)} ${pts[i + 1][1].toFixed(2)}`;
    }
    return d;
  }

  function lineChart(el, { dates, values, label, color = '#2563eb' }) {
    const W = 600, H = 200, PAD_T = 10;
    const n = values.length;
    const total = values.reduce((a, b) => a + b, 0);
    const max = niceMax(Math.max(...values, 0));
    const xs = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
    const ys = (v) => PAD_T + (1 - v / max) * (H - PAD_T);
    const pts = values.map((v, i) => [xs(i), ys(v)]);
    const line = smoothPath(pts);
    const area = `${line} L${W} ${H} L0 ${H} Z`;
    const ticks = [0, 1, 2, 3].map((i) => (max / 3) * i);
    const gid = 'g' + Math.random().toString(36).slice(2, 7);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const short = (iso) => {
      const d = new Date(iso + 'T00:00:00Z');
      return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
    };
    const every = 1;

    el.innerHTML = `
      <div class="vx-chart" role="img" aria-label="${label}: المجموع ${fmt(total)} خلال ${n} يوماً">
        <div class="vx-chart-y">${ticks.slice().reverse().map((v) => `<span>${fmt(v)}</span>`).join('')}</div>
        <div class="vx-chart-plot">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
            ${ticks.map((v) => `<line x1="0" x2="${W}" y1="${ys(v)}" y2="${ys(v)}" class="vx-grid" vector-effect="non-scaling-stroke"/>`).join('')}
            <path d="${area}" fill="url(#${gid})"/>
            <path d="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
          </svg>
          <div class="vx-chart-cursor" hidden><i></i><b style="--c:${color}"></b></div>
          <div class="vx-chart-tip" hidden></div>
          ${total === 0 ? '<div class="vx-chart-empty">لا توجد بيانات في هذه الفترة بعد</div>' : ''}
        </div>
        <div class="vx-chart-x">${dates.map((d, i) => (i % every === 0 || i === n - 1 ? `<span style="inset-inline-start:${(xs(i) / W) * 100}%">${short(d)}</span>` : '')).join('')}</div>
      </div>`;

    const plot = el.querySelector('.vx-chart-plot');
    const xLabels = [...el.querySelectorAll('.vx-chart-x span')];
    const thin = () => {
      const w = plot.clientWidth || 300;
      const step = Math.max(1, Math.ceil(58 / (w / Math.max(1, n - 1))));
      xLabels.forEach((sp, i) => { sp.style.display = (n - 1 - i) % step === 0 ? '' : 'none'; });
    };
    thin();
    if (window.ResizeObserver) new ResizeObserver(thin).observe(plot);
    const cursor = el.querySelector('.vx-chart-cursor');
    const tip = el.querySelector('.vx-chart-tip');
    const show = (i) => {
      const px = (xs(i) / W) * 100, py = (ys(values[i]) / H) * 100;
      cursor.hidden = false; tip.hidden = false;
      cursor.style.setProperty('--x', px + '%');
      cursor.style.setProperty('--y', py + '%');
      tip.style.left = Math.min(88, Math.max(12, px)) + '%';
      tip.style.top = Math.max(6, py - 4) + '%';
      tip.innerHTML = `<strong>${fmt(values[i])}</strong><span>${short(dates[i])}</span>`;
    };
    const hide = () => { cursor.hidden = true; tip.hidden = true; };
    plot.addEventListener('pointermove', (e) => {
      const r = plot.getBoundingClientRect();
      const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
      show(Math.min(n - 1, Math.max(0, i)));
    });
    plot.addEventListener('pointerleave', hide);
    plot.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') plot.dispatchEvent(new PointerEvent('pointermove', e)); });
  }

  /* ---------- Sidebar drawer (mobile) ---------- */
  function setDrawer(open) {
    document.getElementById('vxSide')?.classList.toggle('open', open);
    document.getElementById('vxScrim')?.classList.toggle('show', open);
    document.body.classList.toggle('vx-lock', open);
  }

  /* ---------- Command palette ---------- */
  const pal = { open: false, items: [], idx: 0 };
  function paletteItems() {
    const seen = new Set();
    const out = [];
    (window.NAV_FOR_PALETTE ? window.NAV_FOR_PALETTE() : []).forEach((it) => {
      if (seen.has(it.id)) return;
      seen.add(it.id);
      out.push({
        id: it.id, label: it.label, group: it.group,
        icon: NAV_IMG[it.id] || 'spark',
        hay: norm(`${it.label} ${it.group || ''} ${NAV_KEYWORDS[it.id] || ''}`),
        run: () => window.selectTab && window.selectTab(it.id)
      });
    });
    out.push({ id: '_servers', label: 'سيرفراتي', group: 'حسابي', icon: 'server', hay: norm('سيرفراتي servers حسابي'), run: () => { document.getElementById('serverPickerBtn')?.click(); } });
    out.push({ id: '_profile', label: 'ملفي الشخصي', group: 'حسابي', icon: 'adduser', hay: norm('ملفي الشخصي profile حسابي'), run: () => { if (window.state?.me) { toast(`👤 ${window.state.me.username} | ID: ${window.state.me.id}`); } } });
    return out;
  }
  function renderPalette() {
    const q = norm(document.getElementById('vxPalInput').value.trim());
    const list = document.getElementById('vxPalList');
    pal.items = paletteItems().filter((it) => !q || q.split(/\s+/).every((w) => it.hay.includes(w)));
    pal.idx = Math.min(pal.idx, Math.max(0, pal.items.length - 1));
    list.innerHTML = pal.items.length
      ? pal.items.map((it, i) => `<button type="button" role="option" class="vx-pal-item${i === pal.idx ? ' on' : ''}" data-i="${i}">${img(it.icon)}<span>${it.label}</span><small>${it.group || ''}</small></button>`).join('')
      : '<div class="vx-pal-empty">لا توجد نتائج مطابقة</div>';
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    if (pal.open) return;
    pal.open = true; pal.idx = 0;
    setDrawer(false);
    const box = document.getElementById('vxPalette');
    box.hidden = false;
    const input = document.getElementById('vxPalInput');
    input.value = '';
    renderPalette();
    setTimeout(() => input.focus(), 0);
  }
  function closePalette() {
    if (!pal.open) return;
    pal.open = false;
    document.getElementById('vxPalette').hidden = true;
  }
  function runPalette(i) {
    const it = pal.items[i];
    closePalette();
    if (it) it.run();
  }

  /* ---------- Notification bell ---------- */
  function setBell(items) {
    const count = items.reduce((a, b) => a + b.count, 0);
    const badge = document.getElementById('vxBellCount');
    const menu = document.getElementById('vxBellMenu');
    if (!badge || !menu) return;
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? '99+' : count;
    menu.innerHTML = items.length && count
      ? `<div class="vx-bell-head">يحتاج انتباهك</div>` + items.filter((i) => i.count).map((i) => `<button type="button" data-tab="${i.tab}">${img(i.icon)}<span>${i.text}</span><i>${fmt(i.count)}</i></button>`).join('')
      : `<div class="vx-bell-empty">${img('yes')}<span>كل شيء تحت السيطرة، لا توجد عناصر معلّقة.</span></div>`;
    menu.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { menu.hidden = true; document.getElementById('vxBell').setAttribute('aria-expanded', 'false'); window.selectTab && window.selectTab(b.dataset.tab); }));
  }

  /* ---------- Boot (DOM-only wiring; data wiring lives in main.js) ---------- */
  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.iconDone) return;
      el.dataset.iconDone = '1';
      el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
    });
  }

  function boot() {
    hydrateIcons();

    document.getElementById('vxBurger')?.addEventListener('click', () => setDrawer(true));
    document.getElementById('vxClose')?.addEventListener('click', () => setDrawer(false));
    document.getElementById('vxScrim')?.addEventListener('click', () => setDrawer(false));
    document.getElementById('vxTabMore')?.addEventListener('click', () => setDrawer(true));
    document.querySelectorAll('.vx-tabbar [data-tab]').forEach((b) => b.addEventListener('click', () => window.selectTab && window.selectTab(b.dataset.tab)));
    document.querySelectorAll('[data-vx-soon]').forEach((b) => b.addEventListener('click', () => toast('باقات Premium قادمة قريباً')));

    document.getElementById('globalSearch')?.addEventListener('click', openPalette);
    document.getElementById('vxPalette')?.addEventListener('click', (e) => {
      if (e.target.closest('[data-pal-close]')) closePalette();
      const b = e.target.closest('.vx-pal-item');
      if (b) runPalette(Number(b.dataset.i));
    });
    document.getElementById('vxPalInput')?.addEventListener('input', () => { pal.idx = 0; renderPalette(); });

    const bell = document.getElementById('vxBell');
    const bellMenu = document.getElementById('vxBellMenu');
    bell?.addEventListener('click', (e) => {
      e.stopPropagation();
      bellMenu.hidden = !bellMenu.hidden;
      bell.setAttribute('aria-expanded', String(!bellMenu.hidden));
    });
    document.addEventListener('click', (e) => {
      if (bellMenu && !bellMenu.hidden && !e.target.closest('.vx-bell-wrap')) { bellMenu.hidden = true; bell.setAttribute('aria-expanded', 'false'); }
    });

    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.open ? closePalette() : openPalette(); return; }
      if (e.key === '/' && !typing && !pal.open) { e.preventDefault(); openPalette(); return; }
      if (e.key === 'Escape') {
        if (pal.open) closePalette();
        else { setDrawer(false); if (bellMenu) bellMenu.hidden = true; }
        return;
      }
      if (!pal.open) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); pal.idx = Math.min(pal.items.length - 1, pal.idx + 1); renderPalette(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); pal.idx = Math.max(0, pal.idx - 1); renderPalette(); }
      else if (e.key === 'Enter') { e.preventDefault(); runPalette(pal.idx); }
    });
  }

  window.VX = { icon, img, iconify, NAV_IMG, hydrateIcons, NAV_ICONS, NAV_KEYWORDS, fmt, plural, ago, duration, norm, countUp, toast, lineChart, setDrawer, openPalette, setBell, reduceMotion };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
