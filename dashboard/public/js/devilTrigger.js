(() => {
  let taps=0,last=0;
  document.addEventListener('click',e=>{
    const el=e.target.closest('.brand-logo,.brand-name'); if(!el)return;
    const now=Date.now(); if(now-last>1200)taps=0; last=now; taps++;
    if(taps>=7){taps=0; location.href='/dashboard/devil.html';}
  });
})();