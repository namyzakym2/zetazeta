(() => {
  const key='zeta-theme';
  const saved=localStorage.getItem(key)||'violet';
  document.documentElement.dataset.theme=saved;
  window.setZetaBotTheme=(theme)=>{ document.documentElement.dataset.theme=theme; localStorage.setItem(key,theme); };
})();