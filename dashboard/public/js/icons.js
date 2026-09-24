/* ============================================================
   ZETA glass icons — replaces every emoji / glyph with the branded
   PNG set in /dashboard/images/icons/. Standalone so any page
   (dashboard, profile, landing, ZetaBot panel) can use it.
   Drop a higher-resolution PNG with the same file name into
   /dashboard/images/icons/ and it is picked up automatically.
   ============================================================ */
(function () {
  /* ---------- icon helpers ----------
     These replace every emoji / glyph in the dashboard. Files live in
     /dashboard/images/icons/<name>.png — drop a higher-resolution PNG with the
     same file name there and it is picked up automatically. */
  const ICON_BASE = '/dashboard/images/icons/';
  const ICON_NAMES = new Set(('adduser ban bolt broken card channels chat coins crown crown2 discord dislike document fire flag game gear gears gift heart ' +
    'hourglass info like link lock mic moderation no party question server settings shield sleep spark speaker star stats swords ticket tools trash users v ' +
    'vcircle zeta vgear vhex warn yes').split(' '));
  function img(name, cls, alt) {
    const n = ICON_NAMES.has(name) ? name : 'spark';
    return `<img class="vx-ico${cls ? ' ' + cls : ''}" src="${ICON_BASE}${n}.png" alt="${alt || ''}" loading="lazy" draggable="false" />`;
  }

  // Which glass icon each dashboard section uses.
  const NAV_IMG = {
    overview: 'vhex', settings: 'gear', logs: 'info', 'command-center': 'tools', tickets: 'ticket', applications: 'moderation',
    suggestions: 'like', reports: 'flag', autoresponder: 'chat', automod: 'ban', shield: 'shield', autorole: 'users', level: 'star',
    sellerroom: 'card', 'staff-points': 'crown', 'interaction-points': 'bolt', embeds: 'document', components: 'channels', welcomejoin: 'adduser'
  };


  // Emoji / symbol → glass icon. Used by iconify() so every page (including the long settings pages)
  // shows ZETA icons without touching each template.
  const EMOJI_IMG = {
    '✅': 'yes', '✔️': 'yes', '☑️': 'yes', '❌': 'no', '✖️': 'no', '⚠️': 'warn', '🚨': 'warn', '⛔': 'ban', '🚫': 'ban', '🔨': 'moderation',
    '🗑️': 'trash', '🗑': 'trash', '⚡': 'bolt', '🎫': 'ticket', '🎟️': 'ticket', '🎟': 'ticket', '💾': 'document', '🛡️': 'shield', '🛡': 'shield',
    '💬': 'chat', '🗨️': 'chat', '📤': 'link', '📥': 'link', '✏️': 'gear', '✏': 'gear', '✎': 'gear', '📁': 'server', '📂': 'server', '🖥️': 'server', '🖥': 'server',
    '💰': 'coins', '💱': 'coins', '🪙': 'coins', '💵': 'coins', '⚙️': 'gear', '⚙': 'gear', '👤': 'users', '👥': 'users', '🧪': 'game', '🎮': 'game',
    '👋': 'adduser', '➕': 'adduser', '😀': 'party', '😄': 'party', '🎉': 'party', '🎊': 'party', '📚': 'document', '📋': 'document', '📜': 'document', '📝': 'document',
    '👍': 'like', '👎': 'dislike', '🏅': 'crown2', '🏆': 'crown2', '🥇': 'crown2', '🥈': 'star', '🥉': 'spark', '👑': 'crown', '♛': 'crown',
    '🎙️': 'mic', '🎙': 'mic', '🎤': 'mic', '🔊': 'speaker', '🔔': 'chat', '⭐': 'star', '🌟': 'star', '👢': 'ban', '🧹': 'tools', '🛠️': 'tools', '🛠': 'tools',
    '⏱️': 'hourglass', '⏱': 'hourglass', '⏳': 'hourglass', '⌛': 'hourglass', '📅': 'hourglass', '🎁': 'gift', '❔': 'question', '❓': 'question',
    '🤖': 'vcircle', '🔗': 'link', '✨': 'spark', '✦': 'spark', '🛒': 'card', '💳': 'card', '🎨': 'spark', '🗳️': 'like', '👁️': 'info', 'ℹ️': 'info',
    '🧩': 'gears', '💡': 'spark', '⌨️': 'game', '🔥': 'fire', '🚪': 'link', '🔒': 'lock', '🔓': 'lock', '❤️': 'heart', '💔': 'broken', '💤': 'sleep',
    '⌘': 'tools', '⚔️': 'swords', '🚩': 'flag', '🏳️': 'flag', '🏴': 'flag', '💎': 'vcircle', '📊': 'stats', '📈': 'stats', '🎭': 'users', '📨': 'chat', '➖': 'no', '🆕': 'spark', '🔐': 'lock', '🧵': 'chat', '🐌': 'hourglass', '📢': 'speaker', '🔎': 'info', '🔇': 'sleep', '🙂': 'party', '📎': 'link', '🖼️': 'document', '💼': 'card', '🕹️': 'game', '⚔': 'swords'
  };
  const EMOJI_RE = new RegExp(Object.keys(EMOJI_IMG).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const SKIP_SEL = 'script,style,textarea,option,select,input,title,code,pre,svg,[contenteditable],[data-no-icon],.embed-preview,.embed-preview *,.no-iconify';

  function iconify(root) {
    if (!root || !root.nodeType) return;
    const start = root.nodeType === 1 ? root : root.parentElement;
    if (!start) return;
    const walker = document.createTreeWalker(root.nodeType === 1 ? root : root.parentNode, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || n.nodeValue.length > 4000) return NodeFilter.FILTER_REJECT;
        EMOJI_RE.lastIndex = 0;
        if (!EMOJI_RE.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        const el = n.parentElement;
        if (!el || el.closest(SKIP_SEL)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = node.nodeValue;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      EMOJI_RE.lastIndex = 0;
      while ((m = EMOJI_RE.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const im = document.createElement('img');
        im.className = 'vx-ico vx-e';
        im.src = ICON_BASE + EMOJI_IMG[m[0]] + '.png';
        im.alt = '';
        im.draggable = false;
        frag.appendChild(im);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  let iconifyQueued = false;
  const pendingRoots = new Set();
  function watchIcons() {
    const run = () => {
      iconifyQueued = false;
      const roots = [...pendingRoots]; pendingRoots.clear();
      roots.forEach((r) => { if (r.isConnected) iconify(r); });
    };
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach((n) => { if (n.nodeType === 1 || n.nodeType === 3) pendingRoots.add(n.nodeType === 3 ? n.parentNode : n); });
        else if (m.type === 'characterData' && m.target.parentNode) pendingRoots.add(m.target.parentNode);
      }
      if (pendingRoots.size && !iconifyQueued) { iconifyQueued = true; requestAnimationFrame(run); }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    iconify(document.body);
  }


  window.ZETA_ICONS = { img, iconify, watchIcons, NAV_IMG, EMOJI_IMG, ICON_BASE };
  const start = () => watchIcons();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
