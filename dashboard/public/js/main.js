(() => {
'use strict';
const app=document.getElementById('app');
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
let state={guild:null,servers:[],me:null,cache:{}};

async function api(url,opt={}){
  const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});
  if(r.redirected && r.url.includes('/auth/')){location.href=r.url;throw new Error('AUTH');}
  const text=await r.text(); let data={}; try{data=text?JSON.parse(text):{}}catch{data={raw:text}};
  if(!r.ok) throw new Error(data.error||data.message||`HTTP ${r.status}`);
  return data;
}

// Live Discord pickers — restored from the stable v9 dashboard implementation.
const pickerCache={guildId:null,channels:null,roles:null};
const emojiPickerCache={guildId:null,emojis:null};
async function getGuildEmojis(){
  if(emojiPickerCache.guildId===state.guild?.id && Array.isArray(emojiPickerCache.emojis)) return emojiPickerCache.emojis;
  const d=await api(`/admin/${state.guild.id}/emojis`);
  emojiPickerCache.guildId=state.guild.id;
  emojiPickerCache.emojis=Array.isArray(d.emojis)?d.emojis:[];
  return emojiPickerCache.emojis;
}
function emojiPickerField(label,name,value='',placeholder='اختياري — اختر إيموجي'){
  return `<label class="v-field emoji-picker-field"><span>${esc(label)}</span><div class="emoji-input-wrap"><input type="text" name="${esc(name)}" value="${esc(value)}" placeholder="${esc(placeholder)}" data-emoji-input><button type="button" class="emoji-picker-btn" data-emoji-picker aria-label="اختيار إيموجي">🙂</button></div></label>`;
}
async function openEmojiPicker(button){
  document.querySelectorAll('.emoji-picker-popover').forEach(x=>x.remove());
  const input=button.closest('.emoji-picker-field')?.querySelector('[data-emoji-input]');
  if(!input) return;
  const pop=document.createElement('div'); pop.className='emoji-picker-popover';
  pop.innerHTML='<div class="emoji-picker-head"><b>إيموجيات السيرفر</b><button type="button" data-emoji-close>×</button></div><div class="emoji-picker-search"><input type="search" placeholder="ابحث عن إيموجي..." data-emoji-search></div><div class="emoji-picker-grid"><span class="emoji-picker-loading">جاري التحميل...</span></div>';
  document.body.appendChild(pop);
  const r=button.getBoundingClientRect();
  pop.style.top=`${Math.min(window.innerHeight-pop.offsetHeight-12, r.bottom+8)}px`;
  pop.style.left=`${Math.max(8, Math.min(window.innerWidth-pop.offsetWidth-8, r.left))}px`;
  const grid=pop.querySelector('.emoji-picker-grid'); const search=pop.querySelector('[data-emoji-search]');
  let emojis=[];
  const render=()=>{const q=(search.value||'').trim().toLowerCase(); const list=emojis.filter(e=>!q||String(e.name).toLowerCase().includes(q)); grid.innerHTML=list.length?list.map(e=>`<button type="button" class="emoji-choice" title=":${esc(e.name)}:"><img src="${esc(e.url)}" alt="${esc(e.name)}"><span>:${esc(e.name)}:</span></button>`).join(''):'<span class="emoji-picker-empty">لا توجد إيموجيات مطابقة.</span>';};
  try{emojis=await getGuildEmojis();render();}catch(e){grid.innerHTML='<span class="emoji-picker-empty">تعذر جلب إيموجيات السيرفر.</span>';}
  search.addEventListener('input',render);
  grid.addEventListener('click',e=>{const b=e.target.closest('.emoji-choice');if(!b)return;const idx=[...grid.querySelectorAll('.emoji-choice')].indexOf(b);const q=(search.value||'').trim().toLowerCase();const list=emojis.filter(x=>!q||String(x.name).toLowerCase().includes(q));const chosen=list[idx];if(chosen){input.value=chosen.value;input.dispatchEvent(new Event('input',{bubbles:true}));}pop.remove();});
  pop.querySelector('[data-emoji-close]').onclick=()=>pop.remove();
  setTimeout(()=>{const close=e=>{if(!pop.contains(e.target)&&e.target!==button){pop.remove();document.removeEventListener('mousedown',close);}};document.addEventListener('mousedown',close);},0);
}
async function getChannels(){
  if(pickerCache.guildId===state.guild?.id && Array.isArray(pickerCache.channels)) return pickerCache.channels;
  const d=await api(`/admin/${state.guild.id}/channels`);
  pickerCache.guildId=state.guild.id;
  pickerCache.channels=Array.isArray(d.channels)?d.channels:[];
  return pickerCache.channels;
}
async function getRoles(){
  if(pickerCache.guildId===state.guild?.id && Array.isArray(pickerCache.roles)) return pickerCache.roles;
  const d=await api(`/admin/${state.guild.id}/roles`);
  pickerCache.guildId=state.guild.id;
  pickerCache.roles=Array.isArray(d.roles)?d.roles:[];
  return pickerCache.roles;
}
function channelOptionsHtml(channels,current=''){
  let html='<option value="">— اختر قناة —</option>';
  for(const c of channels||[]) html+=`<option value="${esc(c.id)}" ${String(c.id)===String(current)?'selected':''}># ${esc(c.name)}</option>`;
  if(current && !(channels||[]).some(c=>String(c.id)===String(current))) html+=`<option value="${esc(current)}" selected>⚠️ قناة غير معروفة (${esc(current)})</option>`;
  return html;
}
function roleOptionsHtml(roles,current=''){
  let html='<option value="">— اختر رتبة —</option>';
  for(const r of roles||[]) html+=`<option value="${esc(r.id)}" ${String(r.id)===String(current)?'selected':''}>@ ${esc(r.name)}</option>`;
  if(current && !(roles||[]).some(r=>String(r.id)===String(current))) html+=`<option value="${esc(current)}" selected>⚠️ رتبة غير معروفة (${esc(current)})</option>`;
  return html;
}
async function enhancePickers(){
  const inputs=[...app.querySelectorAll('input[type="text"],input:not([type])')];
  const channelInputs=inputs.filter(x=>/channelid$/i.test(x.name||''));
  const roleInputs=inputs.filter(x=>/roleid$/i.test(x.name||''));
  if(!channelInputs.length && !roleInputs.length) return;
  const [channels,roles]=await Promise.all([
    channelInputs.length?getChannels():Promise.resolve([]),
    roleInputs.length?getRoles():Promise.resolve([])
  ]).catch(()=>[[],[]]);
  for(const input of channelInputs){
    const sel=document.createElement('select');
    sel.name=input.name; sel.id=input.id; sel.className=input.className; sel.required=input.required; sel.disabled=input.disabled;
    sel.dataset.picker='channel'; sel.innerHTML=channelOptionsHtml(channels,input.value);
    input.replaceWith(sel);
  }
  for(const input of roleInputs){
    const sel=document.createElement('select');
    sel.name=input.name; sel.id=input.id; sel.className=input.className; sel.required=input.required; sel.disabled=input.disabled;
    sel.dataset.picker='role'; sel.innerHTML=roleOptionsHtml(roles,input.value);
    input.replaceWith(sel);
  }
}
const toast=(msg,bad=false)=>{
  let t=$('#zeta-toast'); if(!t){t=document.createElement('div');t.id='zeta-toast';document.body.append(t);}
  t.textContent=msg;t.dataset.bad=bad?'1':'0';t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),3000);
};
const setLoading=()=>app.innerHTML='<div class="v-loading"><div class="v-spinner"></div><p>جاري تحميل لوحة التحكم…</p></div>';
function card(title,body,actions=''){return `<section class="v-card"><div class="v-card-head"><h2>${esc(title)}</h2>${actions}</div>${body}</section>`}
function input(label,name,value='',type='text',extra=''){return `<label class="v-field"><span>${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></label>`}
function textarea(label,name,value=''){return `<label class="v-field"><span>${esc(label)}</span><textarea name="${esc(name)}">${esc(value)}</textarea></label>`}
function check(label,name,value){return `<label class="v-check"><input name="${esc(name)}" type="checkbox" ${value?'checked':''}><span>${esc(label)}</span></label>`}
function btn(label,cls='primary',attrs=''){return `<button type="button" class="v-btn ${cls}" ${attrs}>${esc(label)}</button>`}
function formButton(label='حفظ'){return `<button class="v-btn primary" type="submit">${esc(label)}</button>`}
function empty(text){return `<div class="v-empty">${esc(text)}</div>`}
function formDataObj(form){
  const o={}; new FormData(form).forEach((v,k)=>{const el=form.querySelector(`[name="${CSS.escape(k)}"]`);if(k.endsWith('[]')){const n=k.slice(0,-2);(o[n]??=[]).push(v)}else if(el?.type==='checkbox')o[k]=el.checked;else o[k]=v});return o;
}

async function boot(){
  try{
    state.me=await api('/user/me');
    const s=await api('/user/servers'); state.servers=s.servers||[]; state.clientId=s.clientId||'';
    renderShell(); renderServerPicker(); 
    const q=new URLSearchParams(location.search).get('guildId');
    const first=state.servers.find(x=>x.installed&&x.id===q)||state.servers.find(x=>x.installed);
    if(first) selectGuild(first.id); else showNoGuild();
  }catch(e){app.innerHTML=card('تعذر فتح لوحة التحكم',`<p class="v-error">${esc(e.message)}</p><a class="v-btn primary" href="/auth/discord">تسجيل الدخول مجددًا</a>`);}
}
function renderShell(){
  if(state.me){$('#topbarUserName').textContent=state.me.username||'المستخدم';$('#topbarAvatarImg').src=state.me.avatar||'';}
  const cats=[
   ['الرئيسية',[['overview','نظرة عامة','⌂']]],
   ['إدارة السيرفر',[['settings','الإعدادات العامة','⚙'],['logs','السجلات','◉'],['command-center','الأوامر والصلاحيات','⌘']]],
   ['التذاكر والتقديم',[['tickets','التذاكر','🎫'],['applications','التقديمات','📝']]],
   ['المجتمع',[['suggestions','الاقتراحات','💡'],['reports','البلاغات','⚠'],['autoresponder','الردود التلقائية','↪']]],
   ['الحماية والأتمتة',[['automod','AutoMod','🛡'],['autorole','الرتب التلقائية','♟'],['level','المستويات','★'],['sellerroom','روم البيع','💰']]],
   ['النقاط والموظفين',[['staff-points','نقاط الإدارة','✦'],['interaction-points','نقاط التفاعل','✧']]],
   ['التصميم',[['embeds','منشئ الرسائل / Embed','▣'],['components','لوحات الأزرار','☷'],['welcomejoin','الترحيب بالصور','👋']]]
  ];
  const nav=$('#categoryNav');nav.innerHTML=cats.map(([c,items])=>`<div class="v-nav-cat"><small>${c}</small>${items.map(x=>`<button class="v-nav-item" data-page="${x[0]}"><i>${x[2]}</i>${x[1]}</button>`).join('')}</div>`).join('');
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)loadPage(b.dataset.page)});
  $('#navSearch').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();nav.querySelectorAll('.v-nav-item').forEach(b=>b.hidden=q&&!b.textContent.toLowerCase().includes(q));});
  $('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const q=e.target.value.toLowerCase();const b=[...nav.querySelectorAll('.v-nav-item')].find(x=>x.textContent.toLowerCase().includes(q));if(b)loadPage(b.dataset.page)}});
  const mobileBtn=$('#mobileMenuBtn'), mobileBackdrop=$('#mobileSidebarBackdrop');
  const setMobileMenu=(open)=>{
    document.body.classList.toggle('menu-open',open);
    document.body.classList.toggle('mobile-sidebar-open',open);
    mobileBtn?.setAttribute('aria-expanded',open?'true':'false');
    mobileBtn?.setAttribute('aria-label',open?'إغلاق القائمة':'فتح القائمة');
  };
  mobileBtn?.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();setMobileMenu(!document.body.classList.contains('menu-open'));});
  mobileBackdrop?.addEventListener('click',()=>setMobileMenu(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setMobileMenu(false);});
  // The topbar shows a "Ctrl K" hint next to the search box, but nothing ever
  // bound that shortcut — pressing it did literally nothing. Wire it for real.
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch')?.focus();$('#globalSearch')?.select();}
  });
}
function renderServerPicker(){
  const menu=$('#serverPickerMenu');menu.innerHTML=state.servers.map(g=>`<button class="v-server-option" data-id="${g.id}"><img src="${esc(g.icon||'/dashboard/images/logo.png')}"><span>${esc(g.name)}</span><em>${g.installed?'متصل':'غير مضاف'}</em></button>`).join('');
  $('#serverPickerBtn').onclick=()=>$('#serverPicker').classList.toggle('open');
  menu.onclick=e=>{const b=e.target.closest('[data-id]');if(b){const g=state.servers.find(x=>x.id===b.dataset.id);if(g.installed)selectGuild(g.id);else invite(g.id)}};
}
function invite(id){const s=state.servers.find(x=>x.id===id);const url=`https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(state.clientId)}&scope=bot%20applications.commands&permissions=8&guild_id=${encodeURIComponent(id)}`; if(!state.clientId){toast('لم يتم العثور على CLIENT_ID',true);return;} window.open(url,'_blank');}
function selectGuild(id){state.guild=state.servers.find(x=>x.id===id);history.replaceState({},'',`/dashboard/?guildId=${id}`);$('#activeServerName').textContent=state.guild.name;$('#guildLabel').textContent=state.guild.memberCount?`${state.guild.memberCount.toLocaleString()} عضو`:'إدارة السيرفر';$('#serverPickerImg').src=state.guild.icon||'/dashboard/images/logo.png';$('#serverPicker').classList.remove('open');loadPage('overview')}
function showNoGuild(){app.innerHTML=card('لا يوجد سيرفر متصل',`<p>أضف ZETA إلى سيرفر تديره ثم أعد تحميل الصفحة.</p>`)}
function markActive(page){document.querySelectorAll('.v-nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));document.body.classList.remove('menu-open','mobile-sidebar-open');const b=$('#mobileMenuBtn');b?.setAttribute('aria-expanded','false');b?.setAttribute('aria-label','فتح القائمة')}

const pages={
overview: async()=>{
 const d=await api(`/admin/${state.guild.id}/overview`);
 const g=state.guild||{};
 const stat=(icon,title,value,delta,cls='blue')=>`<div class="ref-stat ${cls}"><div class="ref-stat-icon">${icon}</div><div class="ref-stat-copy"><span>${esc(title)}</span><strong>${esc(value??'—')}</strong><small>${esc(delta||'')}</small></div></div>`;
 const quick=[['⚡','إدارة الأوامر','/help','commands'],['🌿','إعدادات الترحيب','/welcome','welcomejoin'],['🎫','إعدادات التذاكر','/ticket','tickets'],['🛡️','إعدادات الحماية','/automod','automod'],['🏷️','إعدادات الأدوار','/role','autorole'],['💰','الاقتصاد','/economy','economy']];
 const activity=[['✓','تم تفعيل الترحيب','منذ 5 دقائق','green'],['🎫','تم إنشاء تذكرة جديدة','منذ 12 دقيقة','purple'],['🛡️','تم تعديل إعدادات الأمان','منذ 28 دقيقة','red'],['🏷️','تمت إضافة رتبة تلقائية','منذ ساعة','orange'],['⌘','تم تنفيذ أمر /help','منذ ساعتين','blue']];
 const servers=(state.servers||[]).slice(0,3).map(x=>`<div class="ref-server-row"><img src="${esc(x.icon||'/dashboard/images/logo.png')}" alt=""><div><b>${esc(x.name||'Server')}</b><small>${Number(x.memberCount||0).toLocaleString('ar')} عضو</small></div><button data-guild-switch="${esc(x.id)}">إدارة</button></div>`).join('');
 return `<div class="reference-dashboard" dir="rtl">
  <section class="ref-hero"><div class="ref-hero-copy"><div class="ref-welcome-user"><img src="${esc(state.me?.avatar||'/dashboard/images/logo.png')}" alt=""><div><span>لوحة تحكم ZETA</span><h1>مرحبًا بك مجددًا، ${esc(state.me?.username||'مالك السيرفر')} 👑</h1><p>إدارة سيرفرك بكل سهولة واحترافية من مكان واحد.</p></div></div><div class="ref-badges"><span class="online">● Online</span><span>◈ v35.0</span><span>★ Premium</span></div></div><div class="ref-hero-art"><img src="/dashboard/images/logo.png" alt="ZETA"><div><b>ZETA</b><small>أكثر من مجرد بوت</small></div></div></section>
  <section class="ref-stats">${stat('▤','السيرفرات المرتبطة',String(state.servers?.length||0),'↑ 0%','blue')}${stat('👥','الأعضاء في سيرفرك',Number(d.members||0).toLocaleString('ar'),'↑ 2.4%','cyan')}${stat('⌛','الأوامر المنفذة',Number(d.commands||d.commandCount||0).toLocaleString('ar'),'↑ 12.6%','purple')}${stat('🛡','حالة البوت','متصل','Uptime: 99.9%','green')}</section>
  <section class="ref-layout">
   <div class="ref-main-col">
    <div class="ref-card"><div class="ref-card-head"><h2>⚡ أوامر سريعة</h2><button data-go="commands">عرض الكل</button></div><div class="ref-quick-grid">${quick.map(([i,t,c,g])=>`<button class="ref-quick" data-go="${g}"><span class="ref-q-icon">${i}</span><span><b>${t}</b><small>${c}</small></span></button>`).join('')}</div></div>
    <div class="ref-card"><div class="ref-card-head"><h2>▥ إحصائيات البوت</h2><span class="ref-select">آخر 7 أيام⌄</span></div><div class="ref-chart"><div class="chart-grid"></div><svg viewBox="0 0 700 210" preserveAspectRatio="none" aria-label="إحصائيات"><polyline points="0,165 95,120 180,140 265,90 350,118 435,68 520,100 610,42 700,18" fill="none" stroke="#287df3" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><polygon points="0,165 95,120 180,140 265,90 350,118 435,68 520,100 610,42 700,18 700,210 0,210" fill="rgba(40,125,243,.10)"/></svg><div class="chart-labels"><span>12 Sep</span><span>13 Sep</span><span>14 Sep</span><span>15 Sep</span><span>16 Sep</span><span>17 Sep</span><span>18 Sep</span></div></div></div>
   </div>
   <div class="ref-mid-col">
    <div class="ref-card"><div class="ref-card-head"><h2>▤ تفاصيل السيرفر</h2></div><div class="ref-server-profile"><img src="${esc(g.icon||'/dashboard/images/logo.png')}" alt=""><div><b>${esc(g.name||'ZETA Server')}</b><small>${Number(d.members||0).toLocaleString('ar')} عضو · مشترك</small><div><em>✦ مميز</em><em>★</em></div></div></div><div class="ref-meta"><div><span>معرف السيرفر</span><b>${esc(g.id||'—')}</b></div><div><span>الدولة</span><b>Discord</b></div><div><span>المنطقة الجغرافية</span><b>—</b></div><div><span>تاريخ الإنشاء</span><b>—</b></div></div><button class="ref-primary" data-go="settings">إعدادات السيرفر ⚙</button></div>
    <div class="ref-card"><div class="ref-card-head"><h2>‹/› أكثر الأوامر استخدامًا</h2><button data-go="commands">عرض الكل</button></div><div class="ref-command-list"><div><span>🎫</span><b>/ticket<small>تذاكر</small></b><strong>${Number(d.openTickets||0).toLocaleString('ar')}</strong><i><em style="width:78%"></em></i></div><div><span>👤</span><b>/ban<small>حظر عضو</small></b><strong>1,842</strong><i><em style="width:64%"></em></i></div><div><span>⚡</span><b>/help<small>مساعدة</small></b><strong>1,205</strong><i><em style="width:48%"></em></i></div></div></div>
   </div>
   <aside class="ref-side-col">
    <div class="ref-card"><div class="ref-card-head"><h2>◷ النشاط الأخير</h2><button data-go="logs">عرض الكل</button></div><div class="ref-activity">${activity.map(([i,t,v,c])=>`<div><span class="ref-act ${c}">${i}</span><div><b>${t}</b><small>${v}</small></div><i>›</i></div>`).join('')}</div></div>
    <div class="ref-card ref-premium"><img src="/dashboard/images/logo.png" alt=""><h3>قم بترقية سيرفرك</h3><p>احصل على مميزات حصرية وتحكم أكبر.</p><button>معرفة المزيد</button></div>
    <div class="ref-card"><div class="ref-card-head"><h2>آخر السيرفرات</h2><button>عرض الكل</button></div><div class="ref-server-list">${servers||'<p class="ref-empty">لا توجد سيرفرات إضافية</p>'}</div></div>
   </aside>
  </section>
 </div>`;
},
settings: async()=>{const [d,ch,roles]=await Promise.all([api(`/admin/${state.guild.id}/settings`),getChannels(),getRoles()]);return card('الإعدادات العامة',settingsForm(d,ch,roles));},
logs: async()=>{const [d,ch]=await Promise.all([api(`/admin/${state.guild.id}/logs`),getChannels()]);return card('السجلات',logsForm(d.logSettings||{},ch));},
'automod':async()=>{const d=await api(`/admin/${state.guild.id}/settings`);return card('الحماية AutoMod',automodForm(d.automod||{}));},
autorole:async()=>{const d=await api(`/admin/${state.guild.id}/autorole-rules`);return card('الرتب التلقائية',autoroleForm(d.rules||{}));},
level:async()=>{const d=await api(`/admin/${state.guild.id}/level`);return card('نظام المستويات',levelForm(d.levelUp||{}));},
sellerroom:async()=>{const d=await api(`/admin/${state.guild.id}/sellerroom`);return card('روم البيع',sellerForm(d.sellerRoom||{}));},
autoresponder:async()=>{const d=await api(`/admin/${state.guild.id}/autoresponder`);return card('الردود التلقائية',autoResponderForm(d));},
suggestions:async()=>{const d=await api(`/admin/${state.guild.id}/suggestions`);return card('الاقتراحات',suggestionsForm(d));},
reports:async()=>{const d=await api(`/admin/${state.guild.id}/reports`);return card('البلاغات',reportsForm(d));},
'staff-points':async()=>{const d=await api(`/admin/${state.guild.id}/staff-points`);return card('نقاط الإدارة',pointsForm(d,'staff'));},
'interaction-points':async()=>{const d=await api(`/admin/${state.guild.id}/interaction-points`);return card('نقاط التفاعل',pointsForm(d,'interaction'));},
'tickets':async()=>{const [d,p,channels,roles]=await Promise.all([api(`/admin/${state.guild.id}/tickets`),api(`/admin/${state.guild.id}/ticket-panels`),getChannels(),getRoles()]);return card('التذاكر',ticketForm(d,p,channels,roles));},
'applications':async()=>{const [d,p]=await Promise.all([api(`/admin/${state.guild.id}/applications`),api(`/admin/${state.guild.id}/application-panels`)]);return card('التقديمات',applicationForm(d,p));},
'command-center':async()=>{const d=await api(`/admin/${state.guild.id}/command-center`);return card('مركز الأوامر والصلاحيات',commandForm(d));},
'embeds':async()=>{const [d,ch]=await Promise.all([api(`/admin/${state.guild.id}/embeds`),getChannels()]);return embedForm(d,ch);},
'welcomejoin':async()=>{const [d,ch]=await Promise.all([api(`/admin/${state.guild.id}/settings`),getChannels()]);return welcomeJoinForm(d,ch);},
'components':async()=>{const d=await api(`/admin/${state.guild.id}/components`);return card('لوحات الأزرار والمكونات',componentForm(d));}
};
function channelsSelect(ch,name='channelId',value=''){return `<select name="${name}"><option value="">— بدون قناة —</option>${(ch.channels||ch||[]).map(x=>`<option value="${x.id}" ${x.id===value?'selected':''}># ${esc(x.name)}</option>`).join('')}</select>`}
function rolesSelect(roles,name='roleId',value=''){return `<select name="${name}"><option value="">— بدون رتبة —</option>${(roles.roles||roles||[]).map(x=>`<option value="${x.id}" ${x.id===value?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`}
function settingsForm(d,ch,roles){return `<form id="settingsForm"><div class="v-card inner"><h3>⚙️ الإعدادات الأساسية فقط</h3><p class="v-muted">إعدادات السيرفر العامة. إعدادات الترحيب والصور والتذاكر والسجلات لها صفحات مستقلة في القائمة.</p><div class="v-grid two">${input('البريفكس','prefix',d.prefix||'!')}${input('اللغة','locale',d.locale||'ar')}<label class="v-field"><span>رتبة الدخول</span><select name="autoRoleId">${roleOptionsHtml(roles,d.autoRoleId||'')}</select></label></div></div><div class="v-actions">${formButton('حفظ الإعدادات الأساسية')}</div></form>`}
function logsForm(s,ch=[]){
  s=s||{};
  const events=[
    ['memberJoin','دخول عضو','👋','memberChannelId','memberLogs'],['memberLeave','مغادرة عضو','👋','memberChannelId','memberLogs'],['autoRoleAssign','إعطاء رتبة تلقائيًا','🎭','memberChannelId','memberLogs'],
    ['inviteJoin','دخول عن طريق دعوة','📨','inviteChannelId','inviteLogs'],['inviteFake','دعوة لحساب جديد','📨','inviteChannelId','inviteLogs'],['inviteLeave','مغادرة عضو تمت دعوته','📨','inviteChannelId','inviteLogs'],
    ['ban','حظر عضو','🔨','banChannelId','banLogs'],['unban','إلغاء حظر عضو','🔓','banChannelId','banLogs'],['softban','حظر مؤقت / Softban','🔨','banChannelId','banLogs'],['massban','حظر جماعي','🔨','banChannelId','banLogs'],
    ['kick','طرد عضو','👢','kickChannelId','kickLogs'],['timeout','إعطاء تايم أوت','⏱️','timeoutChannelId','timeoutLogs'],['untimeout','إزالة التايم أوت','⏱️','timeoutChannelId','timeoutLogs'],['mute','كتم عضو','🔇','timeoutChannelId','timeoutLogs'],['unmute','إلغاء كتم عضو','🔊','timeoutChannelId','timeoutLogs'],
    ['nickChange','تغيير اللقب','✏️','nicknameChannelId','nicknameLogs'],['roleAdd','إعطاء رتبة','➕','roleChannelId','roleLogs'],['roleRemove','سحب رتبة','➖','roleChannelId','roleLogs'],['roleCreate','إنشاء رتبة','🆕','roleChannelId','roleLogs'],['roleDelete','حذف رتبة','🗑️','roleChannelId','roleLogs'],['roleUpdate','تعديل رتبة','✏️','roleChannelId','roleLogs'],
    ['channelCreate','إنشاء روم','🆕','channelChannelId','channelLogs'],['channelDelete','حذف روم','🗑️','channelChannelId','channelLogs'],['channelUpdate','تعديل روم','✏️','channelChannelId','channelLogs'],['channelPermissionUpdate','تغيير صلاحيات الروم','🔐','channelChannelId','channelLogs'],
    ['threadCreate','إنشاء موضوع','🧵','threadChannelId','threadLogs'],['threadDelete','حذف موضوع','🗑️','threadChannelId','threadLogs'],['threadUpdate','تعديل موضوع','✏️','threadChannelId','threadLogs'],
    ['warn','تحذير عضو','⚠️','moderationChannelId','moderationLogs'],['unwarn','إزالة تحذير','✅','moderationChannelId','moderationLogs'],['slowmode','تغيير السلو مود','🐌','moderationChannelId','moderationLogs'],['vcKick','طرد من الصوتي','🔊','moderationChannelId','moderationLogs'],['vcMute','كتم صوتي','🔇','moderationChannelId','moderationLogs'],['vcUnmute','إلغاء كتم صوتي','🔊','moderationChannelId','moderationLogs'],['reportSubmitted','إرسال بلاغ','🚨','moderationChannelId','moderationLogs'],['reportReviewed','مراجعة بلاغ','✅','moderationChannelId','moderationLogs'],['hide','إخفاء روم','🙈','moderationChannelId','moderationLogs'],['unhide','إظهار روم','👁️','moderationChannelId','moderationLogs'],['pin','تثبيت رسالة','📌','moderationChannelId','moderationLogs'],['unpin','إلغاء تثبيت رسالة','📌','moderationChannelId','moderationLogs'],
    ['announce','إعلان','📢','systemChannelId','systemLogs'],['caseLookup','البحث عن تحذيرات','🔎','systemChannelId','systemLogs'],['lockdown','قفل السيرفر','🚨','systemChannelId','systemLogs'],['unlockdown','فتح السيرفر','✅','systemChannelId','systemLogs'],['giveawayStart','بدء قيف أواي','🎉','systemChannelId','systemLogs'],['giveawayEnd','انتهاء القيف أواي','🎉','systemChannelId','systemLogs'],['giveawayReroll','إعادة سحب القيف أواي','🔁','systemChannelId','systemLogs'],['devilGuildBlocked','حظر السيرفر من ZETA','💀','systemChannelId','systemLogs'],['devilGuildUnblocked','إلغاء حظر السيرفر','💀','systemChannelId','systemLogs'],['sellerRoomContact','طلب تواصل في روم البيع','📩','systemChannelId','systemLogs'],['systemConfigChange','تغيير إعدادات النظام','⚙️','systemChannelId','systemLogs'],['shortcutChange','تغيير اختصار','⚡','systemChannelId','systemLogs'],['ticketConfigChange','تغيير إعدادات التذاكر','🎫','systemChannelId','systemLogs'],['autoResponderTrigger','تشغيل رد تلقائي','🤖','systemChannelId','systemLogs'],['autoResponderChange','تغيير الردود التلقائية','🤖','systemChannelId','systemLogs'],['salaryClaim','استلام راتب الإدارة','💼','systemChannelId','systemLogs'],
    ['messageDelete','حذف رسالة','🗑️','messageChannelId','messageLogs'],['messageEdit','تعديل رسالة','✏️','messageChannelId','messageLogs'],
    ['ticketCreate','إنشاء تذكرة','🎫','ticketChannelId','ticketLogs'],['ticketClaim','استلام تذكرة','🎫','ticketChannelId','ticketLogs'],['ticketClose','إغلاق تذكرة','🎫','ticketChannelId','ticketLogs'],['ticketDelete','حذف تذكرة','🎫','ticketChannelId','ticketLogs'],
    ['automod','إجراء AutoMod','🛡️','automodChannelId','automodLogs'],['sellerRoomBlock','حذف رسالة من روم البيع','🚫','automodChannelId','automodLogs']
  ];
  const colors={memberJoin:'#57f287',memberLeave:'#ed4245',autoRoleAssign:'#7c3aed',inviteJoin:'#57f287',inviteFake:'#faa61a',inviteLeave:'#ed4245',ban:'#ed4245',unban:'#57f287',softban:'#ed4245',massban:'#ed4245',kick:'#ed4245',timeout:'#faa61a',untimeout:'#57f287',mute:'#faa61a',unmute:'#57f287',nickChange:'#5865f2',roleAdd:'#57f287',roleRemove:'#ed4245',roleCreate:'#57f287',roleDelete:'#ed4245',roleUpdate:'#5865f2',channelCreate:'#57f287',channelDelete:'#ed4245',channelUpdate:'#5865f2',channelPermissionUpdate:'#7c5cff',threadCreate:'#57f287',threadDelete:'#ed4245',threadUpdate:'#5865f2',warn:'#faa61a',unwarn:'#57f287',slowmode:'#5865f2',vcKick:'#ed4245',vcMute:'#faa61a',vcUnmute:'#57f287',reportSubmitted:'#faa61a',reportReviewed:'#57f287',hide:'#ed4245',unhide:'#57f287',pin:'#5865f2',unpin:'#5865f2',announce:'#5865f2',caseLookup:'#5865f2',lockdown:'#ed4245',unlockdown:'#57f287',giveawayStart:'#0f2158',giveawayEnd:'#57f287',giveawayReroll:'#5865f2',devilGuildBlocked:'#0f2158',devilGuildUnblocked:'#57f287',sellerRoomContact:'#57f287',systemConfigChange:'#5865f2',shortcutChange:'#5865f2',ticketConfigChange:'#5865f2',autoResponderTrigger:'#5865f2',autoResponderChange:'#5865f2',salaryClaim:'#0f2158',messageDelete:'#ed4245',messageEdit:'#faa61a',ticketCreate:'#0f2158',ticketClaim:'#0f2158',ticketClose:'#0f2158',ticketDelete:'#0f2158',automod:'#ed4245',sellerRoomBlock:'#ed4245'};
  const ev=s.logEvents||{};
  const channelOptions=(selected)=>channelOptionsHtml(ch,selected);
  const cardFor=([key,label,icon,fallbackChannel,fallbackToggle])=>{
    const x=ev[key]||{}; const enabled=typeof x.enabled==='boolean'?x.enabled:(s[fallbackToggle]!==false); const channel=x.channelId||s[fallbackChannel]||''; const color=x.color||colors[key]||'#5865f2';
    return `<article class="v-log-card ${enabled?'is-enabled':'is-disabled'}" data-log-card="${key}">
      <div class="v-log-top"><label class="v-switch"><input type="checkbox" data-log-enabled="${key}" ${enabled?'checked':''}><span class="v-switch-ui"><i></i></span></label><div class="v-log-title"><strong>${esc(label)}</strong><span>${esc(icon)}</span></div></div>
      <label class="v-log-field"><span>الروم <b>#</b></span><select data-log-channel="${key}"><option value="">اختر الرومات...</option>${channelOptions(channel)}</select></label>
      <label class="v-log-field"><span>اللون <b>🎨</b></span><div class="v-color-wrap"><input type="color" data-log-color="${key}" value="${esc(color)}"><span data-color-value="${key}">${esc(color.toUpperCase())}</span></div></label>
    </article>`;
  };
  return `<div class="v-logs-page" dir="rtl"><div class="v-logs-hero"><h1>سجلات السيرفر</h1><p>تكوين رومـات التسجيل والألوان لأحداث السيرفر المختلفة. قم بتمكين السجلات التي تريد تتبعها وحدد أين يجب إرسالها.</p></div><form id="logsForm"><div class="v-logs-grid">${events.map(cardFor).join('')}</div><div class="v-savebar is-hidden" data-log-savebar><div><b>تم اكتشاف تغييرات!</b><span>يرجى الحفظ أو الإلغاء.</span></div><button type="button" class="v-btn ghost" data-log-cancel>إلغاء</button><button type="submit" class="v-btn primary">حفظ</button></div></form></div>`;
}
function automodForm(a){return `<form id="automodForm"><div class="v-grid two">${check('تفعيل AutoMod','enabled',a.enabled)}${input('قناة السجلات','logChannelId',a.logChannelId||'')}${check('روابط','links',a.links?.enabled)}${check('دعوات Discord','invites',a.invites?.enabled)}${check('Spam','spam',a.spam?.enabled)}${input('حد الرسائل','spamLimit',a.spam?.limit??5,'number')}${check('كلمات ممنوعة','badWords',a.badWords?.enabled)}${textarea('الكلمات','words',(a.badWords?.words||[]).join('\\n'))}</div><div class="v-actions">${formButton()}</div></form>`}
function autoroleForm(d){const rules=d||{};return `<form id="autoroleForm">${check('تفعيل النظام','enabled',rules.enabled)}<div class="v-grid two">${input('رتب الأعضاء (IDs مفصولة بفاصلة)','memberRoleIds',(rules.memberRoleIds||[]).join(','))}${input('رتب البوتات (IDs مفصولة بفاصلة)','botRoleIds',(rules.botRoleIds||[]).join(','))}${input('رتب الدعوات','inviteRoles',Array.isArray(rules.inviteRoles)?rules.inviteRoles.join(','):'')}</div><div class="v-actions">${formButton()}</div></form>`}
function levelForm(d){const s=d.settings||d;return `<form id="levelForm"><div class="v-grid two">${check('تفعيل المستويات','enabled',s.enabled)}${input('قناة الإعلانات','channelId',s.channelId||'')}${input('قالب رسالة الترقية','message',s.message||'تهانينا {user} وصلت للمستوى {level}!')}</div><div class="v-actions">${formButton()}</div></form>`}
function sellerForm(d){const s=d.settings||d;return `<form id="sellerForm"><div class="v-grid two">${check('تفعيل روم البيع','enabled',s.enabled)}${input('القناة','channelId',s.channelId||'')}${input('رتبة البائع','sellerRoleId',s.sellerRoleId||'')}</div><div class="v-actions">${formButton()}</div></form>`}
function autoResponderForm(d){const items=d.responders||d.items||[];return `<div class="v-actions">${btn('+ إضافة رد','ghost','data-add-responder')}</div><div class="v-list" id="responders">${items.map((x,i)=>`<div class="v-row"><input data-rkey value="${esc(x.trigger||x.key||'')}" placeholder="الكلمة"><input data-rreply value="${esc(x.response||x.reply||'')}" placeholder="الرد"><button class="v-btn danger" data-remove>حذف</button></div>`).join('')}</div><div class="v-actions">${btn('حفظ','primary','data-save-autoresponder')}</div>`}
function suggestionsForm(d){const s=d.settings||{};return `<form id="suggestionsForm">${check('تفعيل الاقتراحات','enabled',s.enabled)}${input('قناة الاقتراحات','channelId',s.channelId||'')}<div class="v-actions">${formButton()}</div></form><h3>آخر الاقتراحات</h3>${(d.suggestions||[]).map(x=>`<div class="v-item"><b>${esc(x.status)}</b><span>${esc(x.content||x.text||'')}</span><small>${esc(x.userId||'')}</small></div>`).join('')||empty('لا توجد اقتراحات.')}`}
function reportsForm(d){const s=d.settings||{};return `<form id="reportsForm">${check('تفعيل البلاغات','enabled',s.enabled)}${input('قناة البلاغات','channelId',s.channelId||'')}<div class="v-actions">${formButton()}</div></form><h3>البلاغات</h3>${(d.reports||[]).map(x=>`<div class="v-item"><b>${esc(x.status||'pending')}</b><span>${esc(x.reason||x.content||'')}</span><small>${esc(x.userId||'')}</small></div>`).join('')||empty('لا توجد بلاغات.')}`}
function pointsForm(d,type){const s=d.settings||d.staffPoints||{};return `<form id="${type}PointsForm"><div class="v-grid two">${check('تفعيل','enabled',s.enabled)}${input('قناة السجلات','logsChannelId',s.logsChannelId||'')}${input('نقاط لكل رسالة','pointsPerMessage',s.pointsPerMessage??1,'number')}${input('Cooldown','cooldownSeconds',s.cooldownSeconds??0,'number')}${input('الحد الأدنى للرسالة','minMessageLength',s.minMessageLength??0,'number')}</div><div class="v-actions">${formButton()}</div></form><h3>المتصدرون</h3><div class="v-table">${(d.leaderboard||[]).map((x,i)=>`<div><b>#${i+1}</b><span>${esc(x.tag||x.userId)}</span><strong>${x.points}</strong></div>`).join('')||empty('لا توجد بيانات بعد.')}</div>`}
function ticketForm(d,p,channels=[],roles=[]){
 const s=d.settings||{};
 const buttons=s.buttons||[];
 const quick=s.quickButtons||[];
 const textChannels=(channels||[]).filter(c=>Number(c.type)===0||Number(c.type)===5||Number(c.type)===10||Number(c.type)===11||Number(c.type)===12);
 const categories=(channels||[]).filter(c=>Number(c.type)===4);
 const chOpts=(current='')=>channelOptionsHtml(textChannels,current);
 const catOpts=(current='')=>`<option value="">— بدون تصنيف —</option>`+(categories||[]).map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(current)?'selected':''}>${esc(c.name)}</option>`).join('');
 const roleOpts=(current='')=>roleOptionsHtml(roles,current);
 const display=(v,def)=>v||def;
 return `<form id="ticketsForm">
   <div class="v-grid two">
    ${check('تفعيل التذاكر','enabled',s.enabled)}
    <label class="v-field"><span>قناة لوحة التكت</span><select name="panelChannelId">${chOpts(s.panelChannelId||'')}</select></label>
    <label class="v-field"><span>التصنيف الافتراضي</span><select name="ticketCategoryId">${catOpts(s.ticketCategoryId||'')}</select></label>
    <label class="v-field"><span>قناة سجل التذاكر</span><select name="transcriptChannelId">${chOpts(s.transcriptChannelId||'')}</select></label>
    ${input('عنوان اللوحة','panelTitle',display(s.panelTitle,'فتح تذكرة'))}
    ${textarea('الوصف','panelDescription',display(s.panelDescription,''))}
    ${input('لون اللوحة','panelColor',s.panelColor||'#7c5cff')}
    ${imageField('ticketPanelImage','صورة لوحة التذاكر',s.panelImage||'')}
    ${imageField('ticketPanelThumbnail','الصورة المصغرة',s.panelThumbnail||'')}
    ${input('الفوتر','panelFooter',s.panelFooter||'')}
    ${input('صيغة اسم التذكرة','ticketNameFormat',s.ticketNameFormat||'ticket-{user}')}
    ${input('حد التذاكر للمستخدم','maxTicketsPerUser',s.maxTicketsPerUser??1,'number')}
    <label class="v-field"><span>طريقة فتح التذكرة</span><select name="openDisplayType"><option value="buttons" ${s.openDisplayType!=='menu'?'selected':''}>أزرار</option><option value="menu" ${s.openDisplayType==='menu'?'selected':''}>قائمة اختيار</option></select></label>
    <label class="v-field"><span>طريقة إجراءات التذكرة</span><select name="actionDisplayType"><option value="buttons" ${s.actionDisplayType!=='menu'?'selected':''}>أزرار</option><option value="menu" ${s.actionDisplayType==='menu'?'selected':''}>قائمة اختيار</option></select></label>
    ${check('زر الإغلاق','closeButton',s.closeButton!==false)}
    ${check('زر الاستلام','claimButton',s.claimButton!==false)}
    ${check('زر Transcript','transcriptButton',s.transcriptButton!==false)}
    ${check('زر حذف التذكرة','deleteButton',s.deleteButton!==false)}
    ${check('تفعيل التقييم','ratingEnabled',s.ratingEnabled)}
    <label class="v-field"><span>قناة التقييمات</span><select name="ratingChannelId">${chOpts(s.ratingChannelId||'')}</select></label>
    <label class="v-field"><span>رتبة الدعم الافتراضية</span><select name="defaultSupportRoleId">${roleOpts(s.defaultSupportRoleId||'')}</select></label>
   </div>
   <div class="v-actions">${formButton()}</div>
 </form>
 <section class="v-card inner ticket-emoji-section">
  <h3>🎫 تخصيص لوحة التكت</h3>
  <p>نفس فكرة تخصيص لوحة التكت المتقدمة: عنوان، وصف، صور، ألوان، طريقة عرض، وتصنيفات مستقلة لكل زر.</p>
  <div class="v-item"><b>معاينة سريعة</b><span class="v-muted">يمكنك حفظ الإعدادات ثم إرسال اللوحة من زر الإرسال.</span></div>
  <form id="ticketButtonAddForm">
   <div class="v-grid two">
    ${input('اسم الزر','label','','text','required')}
    ${emojiPickerField('الإيموجي','emoji')}
    <label class="v-field"><span>لون الزر</span><select name="style"><option value="Primary">أزرق</option><option value="Success">أخضر</option><option value="Danger">أحمر</option><option value="Secondary">رمادي</option></select></label>
    <label class="v-field"><span>تصنيف التكت</span><select name="categoryId">${catOpts('')}</select></label>
    <label class="v-field"><span>رتبة الدعم</span><select name="supportRoleId">${roleOpts('')}</select></label>
    ${input('المعرف الداخلي','id','support')}
    ${input('وصف الزر','description')}
    ${imageField('ticketButtonImage','صورة الزر','')}
   </div>
   <div class="v-actions"><button class="v-btn primary" type="submit">＋ إضافة زر التكت</button></div>
  </form>
  <div class="v-list">${buttons.map(x=>`<div class="v-row"><span>${x.emoji?`<span class="ticket-emoji-preview">${esc(x.emoji)}</span> `:''}<b>${esc(x.label)}</b><small class="v-muted">${esc(x.style||'Primary')}</small></span><button type="button" class="v-btn danger" data-delete-ticket-button="${esc(x._id)}">حذف</button></div>`).join('')||empty('لا توجد أزرار بعد.')}</div>
 </section>
 <section class="v-card inner ticket-emoji-section">
  <h3>⚡ تخصيص الأزرار داخل التكت</h3>
  <p>أزرار جاهزة تظهر داخل التذكرة، مع نفس اختيار الإيموجي المخصص من سيرفرك.</p>
  <form id="ticketQuickButtonAddForm">
   <div class="v-grid two">${input('اسم الزر','label','','text','required')}${emojiPickerField('الإيموجي','emoji')}${input('لون الزر','style','Secondary')}${textarea('الرد','response','','required')}</div>
   <div class="v-actions"><button class="v-btn primary" type="submit">＋ إضافة زر جاهز</button></div>
  </form>
  <div class="v-list">${quick.map(x=>`<div class="v-row"><span>${x.emoji?`<span class="ticket-emoji-preview">${esc(x.emoji)}</span> `:''}<b>${esc(x.label)}</b></span><button type="button" class="v-btn danger" data-delete-ticket-quick="${esc(x._id)}">حذف</button></div>`).join('')||empty('لا توجد أزرار جاهزة.')}</div>
 </section>
 <section class="v-card inner">
  <h3>🧰 البانلات الإضافية</h3>
  <form id="ticketPanelCreateForm"><div class="v-grid two">${input('اسم البانل','name','','text','required')}</div><div class="v-actions"><button class="v-btn primary" type="submit">＋ إنشاء بانل إضافي</button></div></form>
  <div class="v-list">${(p.panels||[]).map(x=>`<div class="v-row"><b>${esc(x.name)}</b><button class="v-btn danger" data-delete-panel="ticket-panels/${x._id}">حذف</button></div>`).join('')||empty('لا توجد بانلات إضافية.')}</div>
 </section>`;
}
function applicationForm(d,p){return `<div class="v-actions">${btn('+ إنشاء بانل تقديم','primary','data-add-application-panel')}</div><h3>طلبات التقديم</h3>${(d.applications||[]).map(x=>`<div class="v-item"><b>${esc(x.status||'pending')}</b><span>${esc(x.userId||'')}</span><small>${esc(x._id||'')}</small></div>`).join('')||empty('لا توجد طلبات بعد.')}<h3>بانلات التقديم</h3>${(p.panels||[]).map(x=>`<div class="v-item"><b>${esc(x.name)}</b><span>${x.enabled===false?'متوقف':'فعال'}</span></div>`).join('')||empty('لا توجد بانلات.')}`}
function commandForm(d){const states=d.commandStates||d.states||[];return `<div class="v-grid two">${states.map(x=>`<label class="v-check"><input type="checkbox" data-command-state="${esc(x.command)}" ${x.enabled!==false?'checked':''}><span>/${esc(x.command)}</span></label>`).join('')}</div><div class="v-actions">${btn('حفظ الحالات','primary','data-save-command-states')}</div>`}
let embedDraft={fields:[]}, embedEditingId=null;
function embedPreview(e){return `<div class="v-embed-preview" style="border-inline-start:4px solid ${esc(e.color||'#5865f2')};padding:14px;border-radius:8px;background:rgba(0,0,0,.12)">${e.authorName?`<div><b>${esc(e.authorName)}</b></div>`:''}${e.title?`<h3 style="margin:6px 0">${esc(e.title)}</h3>`:''}${e.description?`<p style="white-space:pre-wrap">${esc(e.description)}</p>`:''}${e.thumbnail?`<img src="${esc(e.thumbnail)}" style="max-width:80px;max-height:80px;border-radius:8px;float:inline-end;margin:0 0 8px 8px" onerror="this.style.display='none'">`:''}${e.image?`<img src="${esc(e.image)}" style="display:block;max-width:100%;max-height:320px;border-radius:8px;margin-top:10px" onerror="this.style.display='none'">`:''}${(e.fields||[]).length?`<div class="v-grid two" style="margin-top:10px">${e.fields.map(f=>`<div><b>${esc(f.name)}</b><div>${esc(f.value)}</div></div>`).join('')}</div>`:''}${e.footer?`<small style="display:block;margin-top:10px;opacity:.7">${esc(e.footer)}${e.timestamp?' • الآن':''}</small>`:''}</div>`}
function imageField(id,label,value=''){
  return `<div class="v-field image-field"><span>${esc(label)}</span><div class="v-upload-row"><input id="${id}" name="${id}" value="${esc(value)}" placeholder="رابط الصورة (اختياري)"><input id="${id}File" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden><button type="button" class="v-btn ghost image-upload-trigger" data-upload-for="${id}">📤 رفع صورة من الجهاز</button><span class="upload-file-name" data-upload-name="${id}"></span></div><small class="v-muted">PNG / JPG / WEBP / GIF — حتى 8MB</small></div>`;
}
function bindImageUploads(){
  app.querySelectorAll('[data-upload-for]').forEach(b=>{
    const id=b.dataset.uploadFor;
    const fileInput=app.querySelector('#'+id+'File');
    const nameEl=app.querySelector(`[data-upload-name="${CSS.escape(id)}"]`);
    if(!fileInput) return;
    b.onclick=()=>fileInput.click();
    fileInput.onchange=async()=>{
      const file=fileInput.files?.[0];
      if(!file) return;
      if(nameEl) nameEl.textContent=`📎 ${file.name}`;
      try{
        b.disabled=true; b.textContent='⏳ جاري الرفع…';
        const url=await window.zetaUploadImage(file);
        const input=app.querySelector('#'+id);
        if(input){input.value=url;input.dispatchEvent(new Event('input',{bubbles:true}));}
        toast('تم رفع الصورة ✓');
      }catch(e){toast(e.message,true);}
      finally{b.disabled=false;b.textContent='📤 رفع صورة من الجهاز';fileInput.value='';}
    };
  });
}

function collectEmbedDraft(){return {name:$('#embName')?.value?.trim()||'',title:$('#embTitle')?.value||'',description:$('#embDescription')?.value||'',color:$('#embColor')?.value||'#5865f2',authorName:$('#embAuthorName')?.value||'',authorIcon:$('#embAuthorIcon')?.value||'',image:$('#embImage')?.value||'',thumbnail:$('#embThumbnail')?.value||'',footer:$('#embFooter')?.value||'',timestamp:$('#embTimestamp')?.checked||false,fields:embedDraft.fields||[]}}
function renderEmbedFields(){const box=$('#embFields');if(!box)return;box.innerHTML=(embedDraft.fields||[]).map((f,i)=>`<div class="v-item"><div class="v-grid two"><input data-fi="${i}" data-fk="name" value="${esc(f.name||'')}" placeholder="اسم الحقل"><input data-fi="${i}" data-fk="value" value="${esc(f.value||'')}" placeholder="قيمة الحقل"></div><label class="v-check"><input data-fi="${i}" data-fk="inline" type="checkbox" ${f.inline?'checked':''}> <span>Inline</span></label><button type="button" class="v-btn danger" data-remove-field="${i}">حذف</button></div>`).join('')||empty('لا توجد Fields بعد.');box.querySelectorAll('[data-fi]').forEach(x=>x.oninput=x.onchange=()=>{const i=+x.dataset.fi;embedDraft.fields[i][x.dataset.fk]=x.dataset.fk==='inline'?x.checked:x.value;renderEmbedPreview()});box.querySelectorAll('[data-remove-field]').forEach(x=>x.onclick=()=>{embedDraft.fields.splice(+x.dataset.removeField,1);renderEmbedFields();renderEmbedPreview()})}
function renderEmbedPreview(){embedDraft={...embedDraft,...collectEmbedDraft()};const p=$('#embPreview');if(p)p.innerHTML=embedPreview(embedDraft)}
async function embedForm(d,ch){const embeds=d.embeds||[];return `<div class="v-grid two"><section class="v-card"><div class="v-card-head"><h2>📝 منشئ الـ Embed</h2></div><div class="v-grid two">${input('اسم محفوظ','embName',embedDraft.name||'','text','placeholder="مثال: قوانين السيرفر"')}${input('العنوان','embTitle',embedDraft.title||'')}${textarea('الوصف','embDescription',embedDraft.description||'')}${input('اللون','embColor',embedDraft.color||'#5865f2')}${input('اسم الكاتب','embAuthorName',embedDraft.authorName||'')}${imageField('embAuthorIcon','أيقونة الكاتب',embedDraft.authorIcon||'')}${imageField('embImage','الصورة الرئيسية',embedDraft.image||'')}${imageField('embThumbnail','الصورة المصغرة',embedDraft.thumbnail||'')}${input('الفوتر','embFooter',embedDraft.footer||'')}</div><label class="v-check"><input id="embTimestamp" type="checkbox" ${embedDraft.timestamp?'checked':''}> <span>إظهار الوقت</span></label><h3>الحقول</h3><div id="embFields"></div><div class="v-actions">${btn('+ إضافة حقل','ghost','id="embAddField"')}${btn(embedEditingId?'حفظ التعديل':'حفظ Embed','primary','id="embSave"')}${embedEditingId?btn('إلغاء','ghost','id="embCancel"'):''}</div><p id="embMsg" class="v-muted"></p></section><section class="v-card"><div class="v-card-head"><h2>👁️ المعاينة</h2></div><div id="embPreview"></div></section></div><section class="v-card"><div class="v-card-head"><h2>📚 المحفوظة (${embeds.length})</h2></div>${embeds.map(e=>`<div class="v-item"><div><b>${esc(e.name||e.title||'Embed')}</b></div>${embedPreview(e)}<div class="v-actions"><select data-send-channel="${e._id}">${channelOptionsHtml(ch,'')}</select>${btn('📤 إرسال','primary',`data-send-embed="${e._id}"`)}${btn('✏️ تعديل','ghost',`data-edit-embed="${e._id}"`)}${btn('🗑️ حذف','danger',`data-delete-embed="${e._id}"`)}</div></div>`).join('')||empty('لا يوجد Embed محفوظ.')}</section>`}
function welcomeJoinForm(d,ch){const w=d.welcome||{},l=d.leave||{};return `<section class="v-card"><div class="v-card-head"><h2>👋 الترحيب بالصور</h2></div><p class="v-muted">يمكنك إرسال رسالة عادية أو بطاقة ترحيب بصورة خلفية مع صورة العضو والاسم وعدد الأعضاء.</p><form id="welcomeJoinForm"><div class="v-grid two">${check('تفعيل الترحيب','welcome.enabled',w.enabled)}<label class="v-field"><span>روم الترحيب</span><select name="welcome.channelId">${channelOptionsHtml(ch,w.channelId||'')}</select></label>${textarea('رسالة الترحيب','welcome.message',w.message||'')}${imageField('welcomeBackground','صورة خلفية بطاقة الترحيب',w.backgroundImage||'')}${textarea('النص على البطاقة','welcome.cardText',w.cardText||'')}<label class="v-field"><span>موضع الصورة X (0-100)</span><input type="number" name="welcome.avatarX" min="0" max="100" value="${Number.isFinite(w.avatarX)?w.avatarX:50}"></label><label class="v-field"><span>موضع الصورة Y (0-100)</span><input type="number" name="welcome.avatarY" min="0" max="100" value="${Number.isFinite(w.avatarY)?w.avatarY:20}"></label></div><hr><h3>🚪 المغادرة</h3><div class="v-grid two">${check('تفعيل المغادرة','leave.enabled',l.enabled)}<label class="v-field"><span>روم المغادرة</span><select name="leave.channelId">${channelOptionsHtml(ch,l.channelId||'')}</select></label>${textarea('رسالة المغادرة','leave.message',l.message||'')}</div><div class="v-actions">${formButton('حفظ إعدادات الترحيب والمغادرة')}</div></form></section>`}

function componentForm(d){return `<div class="v-card inner"><h3>☷ إنشاء لوحة</h3><p class="v-muted">يمكنك الآن رفع صورة اللوحة من جهازك بدل لصق رابط يدوي.</p><form id="componentCreateForm"><div class="v-grid two">${input('اسم اللوحة','componentName','','text','required')}${input('العنوان','componentTitle')}${textarea('الوصف','componentDescription')}${input('اللون','componentColor','#5865f2')}${imageField('componentImage','صورة اللوحة','')}${input('الفوتر','componentFooter')}</div><div class="v-actions"><button class="v-btn primary" type="submit">إنشاء اللوحة</button></div></form></div><section class="v-card"><div class="v-card-head"><h2>اللوحات الحالية</h2></div>${(d.components||d.panels||[]).map(x=>`<div class="v-item"><b>${esc(x.name||x.title||'Panel')}</b><span>${esc(x.channelId||'')}</span></div>`).join('')||empty('لا توجد لوحات.')}</section>`}

function bindPage(page){
  const go=e=>{const b=e.target.closest('[data-go]');if(b)loadPage(b.dataset.go)};
  app.onclick=go;
  const form=app.querySelector('form');
  const endpointMap={settings:['/settings','post'],logs:['/logs','post'],automod:['/settings','post'],autorole:['/autorole-rules','post'],level:['/level','post'],sellerroom:['/sellerroom','post'],suggestions:['/suggestions/settings','post'],reports:['/reports/settings','post'],'staff-points':['/staff-points','post'],'interaction-points':['/interaction-points','post'],tickets:['/tickets','post']};
  if(form) form.addEventListener('submit',async e=>{
    e.preventDefault();let o=formDataObj(form);
    if(page==='settings'){o={prefix:o.prefix,locale:o.locale,autoRoleId:o.autoRoleId,welcome:{enabled:o['welcome.enabled'],channelId:o['welcome.channelId'],title:o['welcome.title'],description:o['welcome.description']},leave:{enabled:o['leave.enabled'],channelId:o['leave.channelId'],title:o['leave.title'],description:o['leave.description']}}}
    if(page==='automod'){o={enabled:o.enabled,logChannelId:o.logChannelId,links:{enabled:o.links},invites:{enabled:o.invites},spam:{enabled:o.spam,limit:Number(o.spamLimit)},badWords:{enabled:o.badWords,words:String(o.words||'').split('\\n').map(x=>x.trim()).filter(Boolean)}}}
    if(page==='level')o={enabled:o.enabled,channelId:o.channelId,message:o.message};
    if(page==='sellerroom')o={enabled:o.enabled,channelId:o.channelId,sellerRoleId:o.sellerRoleId,blockLinks:o.blockLinks};
    if(page==='suggestions'||page==='reports')o={enabled:o.enabled,channelId:o.channelId};
    if(page==='autorole')o={enabled:o.enabled,memberRoleIds:String(o.memberRoleIds||'').split(',').map(x=>x.trim()).filter(Boolean),botRoleIds:String(o.botRoleIds||'').split(',').map(x=>x.trim()).filter(Boolean),inviteRoles:String(o.inviteRoles||'').split(',').map(x=>x.trim()).filter(Boolean)};
    if(page==='logs'){
      const events={};
      app.querySelectorAll('[data-log-enabled]').forEach(el=>{
        const key=el.dataset.logEnabled;
        const color=app.querySelector(`[data-log-color="${CSS.escape(key)}"]`)?.value||'';
        const channelId=app.querySelector(`[data-log-channel="${CSS.escape(key)}"]`)?.value||'';
        events[key]={enabled:el.checked,channelId,color};
      });
      o={events};
    }
    if(page==='tickets')o=Object.fromEntries(Object.entries(o).map(([k,v])=>[k,k==='maxTicketsPerUser'?Number(v):v]));
    if(page==='interaction-points')o={enabled:o.enabled,pointsPerMessage:Number(o.pointsPerMessage),cooldownSeconds:Number(o.cooldownSeconds),minMessageLength:Number(o.minMessageLength),logsChannelId:o.logsChannelId};
    try{await api(`/admin/${state.guild.id}${endpointMap[page][0]}`,{method:'POST',body:JSON.stringify(o)});toast('تم الحفظ بنجاح ✓');}catch(err){toast(err.message,true)}
  });
  if(page==='welcomejoin'){
    const wf=app.querySelector('#welcomeJoinForm');
    wf?.addEventListener('submit',async e=>{e.preventDefault();const o=formDataObj(wf);const payload={welcome:{enabled:o['welcome.enabled'],channelId:o['welcome.channelId'],message:o['welcome.message'],backgroundImage:o['welcomeBackground']||'',cardText:o['welcome.cardText'],avatarX:Number(o['welcome.avatarX'])||0,avatarY:Number(o['welcome.avatarY'])||0},leave:{enabled:o['leave.enabled'],channelId:o['leave.channelId'],message:o['leave.message']}};try{await api(`/admin/${state.guild.id}/settings`,{method:'POST',body:JSON.stringify(payload)});toast('تم حفظ الترحيب والصور ✓')}catch(err){toast(err.message,true)}});
  }
  const showLogSave=()=>app.querySelector('[data-log-savebar]')?.classList.remove('is-hidden');
  app.querySelectorAll('[data-log-enabled]').forEach(el=>el.addEventListener('change',()=>{el.closest('[data-log-card]')?.classList.toggle('is-enabled',el.checked);showLogSave()}));
  app.querySelectorAll('[data-log-color]').forEach(el=>el.addEventListener('input',()=>{const out=app.querySelector(`[data-color-value="${CSS.escape(el.dataset.logColor)}"]`);if(out)out.textContent=el.value.toUpperCase();showLogSave()}));
  app.querySelectorAll('[data-log-channel]').forEach(el=>el.addEventListener('change',showLogSave));
  app.querySelector('[data-log-cancel]')?.addEventListener('click',()=>loadPage('logs'));

  app.querySelectorAll('[data-delete-panel]').forEach(b=>b.onclick=async()=>{if(!confirm('حذف هذه اللوحة؟'))return;try{await api(`/admin/${state.guild.id}/${b.dataset.deletePanel}`,{method:'DELETE'});toast('تم الحذف');loadPage(page)}catch(e){toast(e.message,true)}});
  app.querySelectorAll('[data-emoji-picker]').forEach(b=>b.addEventListener('click',()=>openEmojiPicker(b)));
  if(page==='tickets'){
    app.querySelector('#ticketPanelCreateForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const o=formDataObj(e.currentTarget);
      if(!o.name?.trim()) return toast('اكتب اسم البانل',true);
      try{
        await api(`/admin/${state.guild.id}/ticket-panels`,{method:'POST',body:JSON.stringify({name:o.name})});
        toast('تم إنشاء بانل التكت ✓'); loadPage('tickets');
      }catch(err){toast(err.message,true);}
    });
    app.querySelectorAll('[data-delete-panel]').forEach(b=>b.onclick=async()=>{
      if(!confirm('حذف بانل التكت؟'))return;
      try{await api(`/admin/${state.guild.id}/${b.dataset.deletePanel}`,{method:'DELETE'});toast('تم الحذف');loadPage('tickets');}
      catch(e){toast(e.message,true);}
    });
    app.querySelector('#ticketButtonAddForm')?.addEventListener('submit',async e=>{e.preventDefault();const o=formDataObj(e.currentTarget);try{await api(`/admin/${state.guild.id}/tickets/buttons`,{method:'POST',body:JSON.stringify(o)});toast('تمت إضافة زر التذكرة ✓');loadPage('tickets')}catch(err){toast(err.message,true)}});
    app.querySelector('#ticketQuickButtonAddForm')?.addEventListener('submit',async e=>{e.preventDefault();const o=formDataObj(e.currentTarget);try{await api(`/admin/${state.guild.id}/tickets/quick-buttons`,{method:'POST',body:JSON.stringify(o)});toast('تمت إضافة الزر الجاهز ✓');loadPage('tickets')}catch(err){toast(err.message,true)}});
    app.querySelectorAll('[data-delete-ticket-button]').forEach(b=>b.onclick=async()=>{if(!confirm('حذف زر التذكرة؟'))return;try{await api(`/admin/${state.guild.id}/tickets/buttons/${b.dataset.deleteTicketButton}`,{method:'DELETE'});toast('تم الحذف');loadPage('tickets')}catch(e){toast(e.message,true)}});
    app.querySelectorAll('[data-delete-ticket-quick]').forEach(b=>b.onclick=async()=>{if(!confirm('حذف الزر الجاهز؟'))return;try{await api(`/admin/${state.guild.id}/tickets/quick-buttons/${b.dataset.deleteTicketQuick}`,{method:'DELETE'});toast('تم الحذف');loadPage('tickets')}catch(e){toast(e.message,true)}});
  }
  app.querySelectorAll('[data-add-role]').forEach(b=>b.onclick=()=>{const list=app.querySelector('.v-list');list.insertAdjacentHTML('beforeend',`<div class="v-row"><input name="role_new" placeholder="Role ID"><input name="channel_new" placeholder="Channel ID"><button type="button" class="v-btn danger" data-remove-row>حذف</button></div>`)});
  app.querySelectorAll('[data-save-command-states]').forEach(b=>b.onclick=async()=>{try{for(const x of app.querySelectorAll('[data-command-state]'))await api(`/admin/${state.guild.id}/command-state/${encodeURIComponent(x.dataset.commandState)}`,{method:'PATCH',body:JSON.stringify({enabled:x.checked})});toast('تم تحديث حالات الأوامر ✓')}catch(e){toast(e.message,true)}});
  app.querySelectorAll('[data-add-application-panel]').forEach(b=>b.onclick=async()=>{const name=prompt('اسم بانل التقديم:');if(!name)return;try{await api(`/admin/${state.guild.id}/application-panels`,{method:'POST',body:JSON.stringify({name})});toast('تم إنشاء البانل');loadPage('applications')}catch(e){toast(e.message,true)}});
  bindImageUploads();
  if(page==='embeds'){
    app.querySelectorAll('#embTitle,#embDescription,#embColor,#embAuthorName,#embAuthorIcon,#embImage,#embThumbnail,#embFooter,#embTimestamp').forEach(x=>x.addEventListener('input',renderEmbedPreview));
    $('#embTimestamp')?.addEventListener('change',renderEmbedPreview);
    $('#embAddField')?.addEventListener('click',()=>{if(embedDraft.fields.length>=25)return toast('الحد الأقصى 25 حقل',true);embedDraft.fields.push({name:'',value:'',inline:false});renderEmbedFields();});
    $('#embSave')?.addEventListener('click',async()=>{const draft=collectEmbedDraft();if(!draft.name)return toast('اكتب اسم الـ Embed',true);try{const url=embedEditingId?`/admin/${state.guild.id}/embeds/${embedEditingId}`:`/admin/${state.guild.id}/embeds`;await api(url,{method:embedEditingId?'PUT':'POST',body:JSON.stringify(draft)});toast('تم حفظ الـ Embed ✓');embedDraft={fields:[]};embedEditingId=null;loadPage('embeds')}catch(e){toast(e.message,true)}});
    $('#embCancel')?.addEventListener('click',()=>{embedDraft={fields:[]};embedEditingId=null;loadPage('embeds')});
    app.querySelectorAll('[data-edit-embed]').forEach(b=>b.onclick=async()=>{const d=await api(`/admin/${state.guild.id}/embeds`);const x=(d.embeds||[]).find(e=>e._id===b.dataset.editEmbed);if(!x)return;embedEditingId=x._id;embedDraft={...x,fields:(x.fields||[]).map(f=>({...f}))};loadPage('embeds')});
    app.querySelectorAll('[data-delete-embed]').forEach(b=>b.onclick=async()=>{if(!confirm('حذف هذا الـ Embed؟'))return;await api(`/admin/${state.guild.id}/embeds/${b.dataset.deleteEmbed}`,{method:'DELETE'});toast('تم الحذف');loadPage('embeds')});
    app.querySelectorAll('[data-send-embed]').forEach(b=>b.onclick=async()=>{const ch=app.querySelector(`[data-send-channel="${b.dataset.sendEmbed}"]`)?.value;if(!ch)return toast('اختر قناة أولاً',true);try{await api(`/admin/${state.guild.id}/embeds/${b.dataset.sendEmbed}/send`,{method:'POST',body:JSON.stringify({channelId:ch})});toast('تم إرسال الـ Embed ✓')}catch(e){toast(e.message,true)}});
    renderEmbedFields();renderEmbedPreview();
  }
  app.querySelectorAll('[data-add-embed]').forEach(b=>b.onclick=async()=>{embedDraft={fields:[]};embedEditingId=null;loadPage('embeds')});
  app.querySelectorAll('[data-add-component]').forEach(b=>b.onclick=async()=>{const name=prompt('اسم اللوحة:');if(!name)return;try{await api(`/admin/${state.guild.id}/components`,{method:'POST',body:JSON.stringify({name,title:name,description:'',components:[]})});toast('تم إنشاء اللوحة');loadPage('components')}catch(e){toast(e.message,true)}});
  app.querySelector('#componentCreateForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=formDataObj(e.currentTarget);if(!f.componentName)return toast('اكتب اسم اللوحة',true);try{await api(`/admin/${state.guild.id}/components`,{method:'POST',body:JSON.stringify({name:f.componentName,title:f.componentTitle||f.componentName,description:f.componentDescription||'',color:f.componentColor||'#5865f2',image:f.componentImage||'',footer:f.componentFooter||'',components:[]})});toast('تم إنشاء اللوحة ✓');loadPage('components')}catch(err){toast(err.message,true)}});
  app.querySelectorAll('[data-add-responder]').forEach(b=>b.onclick=()=>{const box=app.querySelector('#responders');box.insertAdjacentHTML('beforeend',`<div class="v-row"><input data-rkey placeholder="الكلمة"><input data-rreply placeholder="الرد"><button class="v-btn danger" data-remove>حذف</button></div>`);box.lastElementChild.querySelector('[data-remove]').onclick=()=>box.lastElementChild.remove();});
  app.querySelectorAll('[data-save-autoresponder]').forEach(b=>b.onclick=async()=>{const rules=[...app.querySelectorAll('[data-rkey]')].map((x,i)=>({trigger:x.value.trim(),responses:[app.querySelectorAll('[data-rreply]')[i]?.value||'']})).filter(x=>x.trigger);try{await api(`/admin/${state.guild.id}/autoresponder`,{method:'POST',body:JSON.stringify({rules})});toast('تم حفظ الردود ✓')}catch(e){toast(e.message,true)}});

  app.querySelectorAll('[data-remove-row],[data-remove]').forEach(b=>b.onclick=()=>b.closest('.v-row').remove());
  app.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>loadPage(b.dataset.go));
}
async function loadPage(page){
  if(!state.guild){return showNoGuild()} markActive(page);setLoading();
  try{app.innerHTML=await pages[page]();await enhancePickers();bindPage(page)}catch(e){app.innerHTML=card('حدث خطأ',`<p class="v-error">${esc(e.message)}</p><div>${btn('إعادة المحاولة','primary','data-retry')}</div>`);$('#app').querySelector('[data-retry]')?.addEventListener('click',()=>loadPage(page));}
}
boot();
})();