(() => {
  const c=document.createElement('canvas'); c.id='particles-canvas'; document.body.prepend(c);
  const ctx=c.getContext('2d'); let pts=[]; let w=0,h=0;
  function resize(){w=c.width=innerWidth*devicePixelRatio;h=c.height=innerHeight*devicePixelRatio;c.style.width=innerWidth+'px';c.style.height=innerHeight+'px';}
  function seed(){pts=Array.from({length:Math.min(70,Math.max(24,innerWidth/20))},()=>({x:Math.random()*w,y:Math.random()*h,r:.6+Math.random()*1.8,v:(.08+Math.random()*.22)*devicePixelRatio}));}
  function draw(){ctx.clearRect(0,0,w,h);ctx.globalAlpha=.22;for(const p of pts){p.y-=p.v;if(p.y<0)p.y=h;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent-bright')||'#4fe3a5';ctx.fill();}requestAnimationFrame(draw);}
  addEventListener('resize',()=>{resize();seed()}); resize();seed();draw();
})();