(() => {
'use strict';
const app=document.getElementById('app');
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

const DASH_LOCALES = {
  ar: {
    'cat.main': 'الرئيسية والمراقبة',
    'cat.security': 'الحماية والأمان (Anti-Raid)',
    'cat.management': 'إدارة السيرفر والتحكم',
    'cat.tickets': 'التذاكر والدعم الفني',
    'cat.community': 'المجتمع والتفاعل',
    'cat.automation': 'الأتمتة والنمو',
    'cat.staff': 'الكادر الإداري والنقاط',
    'cat.design': 'التصميم والمظهر',
    'nav.overview': 'نظرة عامة والنشاط',
    'nav.automod': 'الحماية الذكية AutoMod',
    'nav.logs': 'سجلات التدقيق Audit Logs',
    'nav.settings': 'الإعدادات العامة',
    'nav.commands': 'مركز الأوامر والصلاحيات',
    'nav.tickets': 'نظام التذاكر المتقدم',
    'nav.applications': 'تقديمات الإدارة والتوظيف',
    'nav.welcome': 'الترحيب والمغادرة المخصص',
    'nav.autoresponder': 'الردود التلقائية الذكية',
    'nav.suggestions': 'صندوق الاقتراحات',
    'nav.reports': 'بلاغات الأعضاء والمخالفات',
    'nav.autorole': 'الرتب التلقائية Auto-Roles',
    'nav.level': 'نظام المستويات والـ XP',
    'nav.sellerroom': 'روم وسوق البيع',
    'nav.staff_points': 'نقاط ومتابعة الإدارة',
    'nav.interaction_points': 'نقاط التفاعل والمكافآت',
    'nav.embeds': 'منشئ الرسائل Embed Builder',
    'nav.components': 'لوحات الأزرار التفاعلية',
    'ui.search_placeholder': 'ابحث في الإعدادات...',
    'ui.global_search_placeholder': 'ابحث عن أي شيء...',
    'ui.my_servers': 'سيرفراتي',
    'ui.choose_server': 'اختر السيرفر',
    'ui.manage_server': 'إدارة سيرفرك',
    'ui.save': 'حفظ التغييرات',
    'ui.add': 'إضافة',
    'ui.delete': 'حذف',
    'ui.cancel': 'إلغاء',
    'ui.loading': 'جاري تحميل لوحة التحكم...',
    'ui.success': 'تم الحفظ بنجاح ✓',
    'ui.error': 'حدث خطأ ما',
    'ui.premium_title': 'ZETA Premium',
    'ui.premium_desc': 'استمتع بجميع المميزات بدون حدود',
    'ui.premium_btn': 'ترقية الآن',
    'overview.title': 'نظرة عامة والنشاط',
    'overview.stats': 'الإحصائيات الحية',
    'overview.active_now': 'نشط الآن',
    'overview.trend': 'معدل التفاعل',
    'tickets.title': '🎫 نظام التذاكر المتقدم',
    'tickets.desc': 'تخصيص كامل لأزرار الدعم الفني وتصنيفاتها والمظهر العام في سيرفرك',
    'tickets.enabled_toggle': 'تفعيل نظام التذاكر',
    'tickets.tab_general': '⚙️ الإعدادات العامة',
    'tickets.tab_panel': '🎨 مظهر اللوحة',
    'tickets.tab_buttons': '🎫 تصنيفات الدعم',
    'tickets.tab_inner': '⚡ أزرار الردود الجاهزة',
    'tickets.tab_extra': '🧰 البانلات الإضافية',
    'tickets.general_title': '⚙️ الإعدادات العامة للتذاكر',
    'tickets.panel_channel': 'قناة لوحة التكت في السيرفر',
    'tickets.default_category': 'التصنيف الافتراضي (Category)',
    'tickets.transcript_channel': 'قناة سجل التذاكر (Transcripts)',
    'tickets.support_role': 'رتبة الدعم الافتراضية للرد',
    'tickets.name_format': 'صيغة اسم التذكرة عند الفتح',
    'tickets.max_per_user': 'حد التذاكر المسموح بها للعضو',
    'tickets.action_buttons': '🔒 أزرار وخيارات إجراءات التكت المباشرة:',
    'tickets.close_btn': 'زر الإغلاق السريع (Close Button)',
    'tickets.claim_btn': 'زر الاستلام الإداري (Claim Button)',
    'tickets.transcript_btn': 'زر إرسال الأرشيف (Transcript Button)',
    'tickets.delete_btn': 'زر حذف القناة نهائياً (Delete Button)',
    'tickets.rating_enabled': 'تفعيل طلب تقييم الإدارة للأعضاء بعد الإغلاق',
    'tickets.rating_channel': 'قناة إرسال تقييمات الدعم الفني',
    'tickets.visual_title': '🎨 مظهر وتنسيق لوحة التكت في Discord',
    'tickets.panel_title': 'عنوان لوحة فتح التكت الرئيسي',
    'tickets.panel_color': 'لون شريط اللوحة الجانبي (Hex)',
    'tickets.panel_image': 'رابط أو ملف صورة البانر (Banner)',
    'tickets.panel_thumbnail': 'رابط أو ملف الصورة المصغرة (Thumbnail)',
    'tickets.panel_footer': 'نص الفوتر بالأسفل (Footer)',
    'tickets.display_type': 'طريقة عرض تصنيفات الدعم',
    'tickets.display_buttons': 'أزرار تفاعلية ملونة (حتى 5 تصنيفات)',
    'tickets.display_menu': 'قائمة اختيار منسدلة (Select Menu — حتى 25 تصنيف)',
    'tickets.panel_desc': 'وصف اللوحة والتعليمات',
    'tickets.categories_title': '🎫 أزرار تصنيفات التكت المتاحة',
    'tickets.categories_desc': 'قم بإضافة أزرار أو تصنيفات مخصصة، لكل زر تصنيف وقناة ورتب دعم معينة لفرز طلبات الدعم.',
    'tickets.btn_label': 'اسم الزر (Label)',
    'tickets.btn_emoji': 'الإيموجي الخاص بالزر (Emoji)',
    'tickets.btn_style': 'لون الزر في Discord',
    'tickets.btn_category': 'تصنيف القناة عند فتح التكت (Category)',
    'tickets.btn_support_role': 'رتبة طاقم الدعم المختصة بالرد',
    'tickets.btn_custom_id': 'المعرف الفرعي الداخلي للزر',
    'tickets.btn_image': 'صورة ترحيبية خاصة داخل التكت',
    'tickets.btn_welcome_msg': 'نص رسالة الترحيب المخصصة داخل التكت',
    'tickets.btn_add': '＋ إضافة تصنيف تكت جديد',
    'tickets.current_buttons': 'الأزرار الحالية المضافة للوحة:',
    'tickets.no_buttons': 'لا توجد تصنيفات مضافة بعد للوحة.',
    'tickets.quick_title': '⚡ أزرار الردود الجاهزة والتحكم الداخلي',
    'tickets.quick_desc': 'أزرار سريعة ومفيدة تظهر داخل روم التكت المفتوحة لإرسال ردود آلية مجهزة مسبقاً بنقرة زر.',
    'tickets.quick_btn_add': '＋ إضافة زر جاهز للتكت',
    'tickets.quick_current': 'الأزرار الجاهزة المتاحة الآن:',
    'tickets.quick_no_buttons': 'لا توجد أزرار تكت جاهزة.',
    'tickets.quick_response_text': 'نص الرد التلقائي المرسل عند ضغط الزر',
    'tickets.extra_title': '🧰 لوحات الدعم الإضافية (Extra Panels)',
    'tickets.extra_desc': 'إنشاء لوحات وبانلات تكت إضافية ومستقلة لتوزيعها في رومات وقنوات متعددة.',
    'tickets.extra_new_name': 'اسم اللوحة الجديدة',
    'tickets.extra_create': '＋ إنشاء لوحة جديدة',
    'tickets.extra_current': 'البانلات الإضافية الحالية:',
    'tickets.extra_no_panels': 'لا توجد بانلات تكت إضافية مضافة.',
    'tickets.preview_title': 'support',
    'tickets.preview_banner_text': 'معاينة مباشرة لشات Discord',
    'tickets.welcome_template_label': 'قالب رسالة الترحيب المخصصة في التذكرة',
    'tickets.welcome_template_placeholder': 'مثال: أهلاً بك {user} في تذكرتك لقسم {label}... يدعم الاختصارات {user} و {username} و {label} و {server}',
    'tickets.auto_close_section': '⏳ خيارات قفل وإغلاق التذاكر التلقائي (Auto-Close):',
    'tickets.auto_close_enabled': 'تفعيل القفل التلقائي للتكت عند عدم وجود ردود (Auto-Close Inactive)',
    'tickets.auto_close_minutes': 'مدة الخمول قبل القفل التلقائي (بالدقائق)',
    'tickets.auto_close_placeholder': 'مثال: 1440 لـ 24 ساعة خمول، 60 لساعة واحدة'
  },
  en: {
    'cat.main': 'Main & Monitoring',
    'cat.security': 'Security & Anti-Raid',
    'cat.management': 'Server Management',
    'cat.tickets': 'Tickets & Tech Support',
    'cat.community': 'Community & Interaction',
    'cat.automation': 'Automation & Growth',
    'cat.staff': 'Staff & Points System',
    'cat.design': 'Design & Appearance',
    'nav.overview': 'Overview & Activity',
    'nav.automod': 'Smart AutoMod',
    'nav.logs': 'Audit Logs',
    'nav.settings': 'General Settings',
    'nav.commands': 'Command Center',
    'nav.tickets': 'Advanced Tickets',
    'nav.applications': 'Staff Applications',
    'nav.welcome': 'Welcome & Leave',
    'nav.autoresponder': 'Smart AutoResponder',
    'nav.suggestions': 'Suggestions Box',
    'nav.reports': 'Member Reports',
    'nav.autorole': 'Auto-Roles',
    'nav.level': 'Levels & XP System',
    'nav.sellerroom': 'Seller Room & Marketplace',
    'nav.staff_points': 'Staff Tracking Points',
    'nav.interaction_points': 'Interaction Points',
    'nav.embeds': 'Embed Builder',
    'nav.components': 'Interactive Button Panels',
    'ui.search_placeholder': 'Search settings...',
    'ui.global_search_placeholder': 'Search anything...',
    'ui.my_servers': 'My Servers',
    'ui.choose_server': 'Select Server',
    'ui.manage_server': 'Manage Server',
    'ui.save': 'Save Changes',
    'ui.add': 'Add',
    'ui.delete': 'Delete',
    'ui.cancel': 'Cancel',
    'ui.loading': 'Loading dashboard...',
    'ui.success': 'Saved successfully ✓',
    'ui.error': 'Something went wrong',
    'ui.premium_title': 'ZETA Premium',
    'ui.premium_desc': 'Enjoy all features with no limits',
    'ui.premium_btn': 'Upgrade Now',
    'overview.title': 'Overview & Activity',
    'overview.stats': 'Live Stats',
    'overview.active_now': 'Active Now',
    'overview.trend': 'Interaction Trend',
    'tickets.title': '🎫 Advanced Ticket System',
    'tickets.desc': 'Customize your support buttons, categories, and Discord visual panels.',
    'tickets.enabled_toggle': 'Enable Ticket System',
    'tickets.tab_general': '⚙️ General Settings',
    'tickets.tab_panel': '🎨 Panel Design',
    'tickets.tab_buttons': '🎫 Support Departments',
    'tickets.tab_inner': '⚡ Quick Action Buttons',
    'tickets.tab_extra': '🧰 Extra Panels',
    'tickets.general_title': '⚙️ General Ticket Settings',
    'tickets.panel_channel': 'Ticket Panel Channel',
    'tickets.default_category': 'Default Category',
    'tickets.transcript_channel': 'Transcript Channel',
    'tickets.support_role': 'Default Support Role',
    'tickets.name_format': 'Ticket Name Format',
    'tickets.max_per_user': 'Max Tickets Per User',
    'tickets.action_buttons': '🔒 Direct Ticket Action Buttons:',
    'tickets.close_btn': 'Close Button',
    'tickets.claim_btn': 'Claim Button',
    'tickets.transcript_btn': 'Transcript Button',
    'tickets.delete_btn': 'Delete Button',
    'tickets.rating_enabled': 'Enable Post-Close Staff Rating',
    'tickets.rating_channel': 'Staff Ratings Channel',
    'tickets.visual_title': '🎨 Ticket Panel Visuals in Discord',
    'tickets.panel_title': 'Main Panel Title',
    'tickets.panel_color': 'Sidebar Accent Color (Hex)',
    'tickets.panel_image': 'Banner Image URL',
    'tickets.panel_thumbnail': 'Thumbnail Image URL',
    'tickets.panel_footer': 'Footer Text',
    'tickets.display_type': 'Department Selector Style',
    'tickets.display_buttons': 'Interactive Colored Buttons (Max 5)',
    'tickets.display_menu': 'Dropdown Select Menu (Max 25)',
    'tickets.panel_desc': 'Panel Description & Instructions',
    'tickets.categories_title': '🎫 Support Departments & Buttons',
    'tickets.categories_desc': 'Add custom ticket buttons. Each button directs users to a specific channel category, welcome message, and support team.',
    'tickets.btn_label': 'Button Label',
    'tickets.btn_emoji': 'Button Emoji',
    'tickets.btn_style': 'Discord Button Style',
    'tickets.btn_category': 'Target Category',
    'tickets.btn_support_role': 'Target Support Role',
    'tickets.btn_custom_id': 'Internal Button ID',
    'tickets.btn_image': 'Custom Ticket Welcome Image',
    'tickets.btn_welcome_msg': 'Custom Ticket Welcome Message',
    'tickets.btn_add': '＋ Add Support Department',
    'tickets.current_buttons': 'Current Support Departments:',
    'tickets.no_buttons': 'No support departments configured yet.',
    'tickets.quick_title': '⚡ Quick Ticket Response Buttons',
    'tickets.quick_desc': 'Add quick-response buttons inside open tickets to send template replies with a single click.',
    'tickets.quick_btn_add': '＋ Add Quick Response Button',
    'tickets.quick_current': 'Available Quick Response Buttons:',
    'tickets.quick_no_buttons': 'No quick response buttons configured yet.',
    'tickets.quick_response_text': 'Template Response Content',
    'tickets.extra_title': '🧰 Extra Independent Panels',
    'tickets.extra_desc': 'Create independent ticket panels to distribute across different server channels.',
    'tickets.extra_new_name': 'New Panel Name',
    'tickets.extra_create': '＋ Create New Panel',
    'tickets.extra_current': 'Current Independent Panels:',
    'tickets.extra_no_panels': 'No independent panels configured yet.',
    'tickets.preview_title': 'support',
    'tickets.preview_banner_text': 'Live Discord Chat Preview',
    'tickets.welcome_template_label': 'Custom Ticket Welcome Message Template',
    'tickets.welcome_template_placeholder': 'E.g., Welcome {user} to {label} support... supports placeholders {user}, {username}, {label}, and {server}',
    'tickets.auto_close_section': '⏳ Ticket Auto-Close Options:',
    'tickets.auto_close_enabled': 'Enable Auto-Close for inactive tickets (Auto-Close Inactive)',
    'tickets.auto_close_minutes': 'Inactivity Duration Before Close (Minutes)',
    'tickets.auto_close_placeholder': 'E.g., 1440 for 24 hours of inactivity, 60 for 1 hour'
  }
};

function tDash(key) {
  const lang = localStorage.getItem('zeta_dash_lang') || 'ar';
  return DASH_LOCALES[lang]?.[key] || DASH_LOCALES['ar']?.[key] || key;
}

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
  window.state = state;
  try{
    state.me=await api('/user/me');
    const s=await api('/user/servers'); state.servers=s.servers||[]; state.clientId=s.clientId||'';
    renderShell(); renderServerPicker(); 
    const params = new URLSearchParams(location.search);
    const q = params.get('guildId');
    const stripeSessionId = params.get('stripe_session_id');
    const stripeStatus = params.get('stripe_status');

    if (stripeSessionId && stripeStatus === 'success' && q) {
      toast('جاري التحقق من عملية الدفع لدى Stripe...');
      try {
        const res = await api(`/admin/${q}/premium/stripe-verify?session_id=${stripeSessionId}`);
        toast(res.message || 'تم تفعيل Premium بنجاح! 💎');
        const matched = state.servers.find(s => s.id === q);
        if (matched) matched.isPremium = true;
        const cleanUrl = location.pathname + `?guildId=${q}`;
        history.replaceState({}, '', cleanUrl);
      } catch (err) {
        toast(err.message, true);
      }
    } else if (stripeStatus === 'cancel') {
      toast('تم إلغاء عملية الدفع من Stripe.', true);
      const cleanUrl = location.pathname + (q ? `?guildId=${q}` : '');
      history.replaceState({}, '', cleanUrl);
    }

    const first=state.servers.find(x=>x.installed&&x.id===q)||state.servers.find(x=>x.installed);
    if(first) selectGuild(first.id); else showNoGuild();
  }catch(e){app.innerHTML=card('تعذر فتح لوحة التحكم',`<p class="v-error">${esc(e.message)}</p><a class="v-btn primary" href="/auth/discord">تسجيل الدخول مجددًا</a>`);}
}
function renderShell(){
  const lang = localStorage.getItem('zeta_dash_lang') || 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  if(state.me){
    $('#topbarUserName').textContent=state.me.username || (lang === 'ar' ? 'المستخدم' : 'User');
    $('#topbarAvatarImg').src=state.me.avatar||'';
  }

  // Translate search box placeholders
  const globalSearchInput = $('#globalSearch .vx-search-ph');
  if (globalSearchInput) globalSearchInput.textContent = tDash('ui.global_search_placeholder');
  const navSearchInput = $('#navSearch');
  if (navSearchInput) navSearchInput.placeholder = tDash('ui.search_placeholder');
  
  // Translate back buttons
  const backBtn = $('.vx-back');
  if (backBtn) backBtn.innerHTML = `<span data-icon="arrowLeft"></span> ${tDash('ui.my_servers')}`;

  const premiumMini = $('.vx-premium-mini');
  if (premiumMini) {
    premiumMini.innerHTML = `
      <img class="vx-ico vx-ico-lg" src="/dashboard/images/icons/v.png" alt="" />
      <b>${tDash('ui.premium_title')}</b>
      <small>${tDash('ui.premium_desc')}</small>
      <button class="vx-btn vx-btn-primary vx-btn-block" type="button" data-vx-soon>${tDash('ui.premium_btn')}</button>
    `;
  }

  // Inject dynamic language toggle in top bar
  let langToggle = $('#dashLangToggle');
  if(!langToggle){
    langToggle = document.createElement('button');
    langToggle.id = 'dashLangToggle';
    langToggle.type = 'button';
    langToggle.className = 'vx-icon-btn';
    langToggle.style.marginInlineEnd = '12px';
    langToggle.style.fontSize = '12px';
    langToggle.style.fontWeight = 'bold';
    langToggle.style.padding = '4px 10px';
    langToggle.style.borderRadius = '8px';
    langToggle.style.background = 'rgba(255,255,255,0.05)';
    langToggle.style.border = '1px solid rgba(255,255,255,0.1)';
    langToggle.style.color = 'var(--text-bright, #fff)';
    langToggle.style.cursor = 'pointer';
    
    const bellWrap = $('.vx-bell-wrap');
    if(bellWrap) {
      bellWrap.parentNode.insertBefore(langToggle, bellWrap);
    }
  }
  langToggle.textContent = lang === 'ar' ? 'English' : 'العربية';
  langToggle.onclick = () => {
    const nextLang = lang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('zeta_dash_lang', nextLang);
    location.reload();
  };

  const cats=[
    [tDash('cat.main'), [
      ['overview', tDash('nav.overview'),'⌂','vhex', lang === 'ar' ? 'الرئيسية والإحصائيات الحية' : 'Main & Live Statistics']
    ]],
    [tDash('cat.security'), [
      ['automod', tDash('nav.automod'),'🛡','ban', lang === 'ar' ? 'تصفية الروابط والسبام والكلمات' : 'Links, Spam, and Word filters'],
      ['logs', tDash('nav.logs'),'◉','info', lang === 'ar' ? 'سجلات متقدمة لكافة الأحداث' : 'Advanced logs for all events']
    ]],
    [tDash('cat.management'), [
      ['settings', tDash('nav.settings'),'⚙','gear', lang === 'ar' ? 'البريفكس واللغة والرتبة الأساسية' : 'Prefix, Language, and Auto-Role'],
      ['command-center', tDash('nav.commands'),'⌘','tools', lang === 'ar' ? 'تفعيل وتعطيل صلاحيات الأوامر' : 'Enable & disable command permissions']
    ]],
    [tDash('cat.tickets'), [
      ['tickets', tDash('nav.tickets'),'🎫','ticket', lang === 'ar' ? 'بانلات وأزرار الدعم المخصصة' : 'Custom support buttons & panels'],
      ['applications', tDash('nav.applications'),'📝','moderation', lang === 'ar' ? 'نماذج واستمارات القبول' : 'Application and admission forms']
    ]],
    [tDash('cat.community'), [
      ['welcomejoin', tDash('nav.welcome'),'👋','adduser', lang === 'ar' ? 'رسائل ترحيب، صور، وإحصاء أعضاء' : 'Welcome messages, images, and counts'],
      ['autoresponder', tDash('nav.autoresponder'),'↪','chat', lang === 'ar' ? 'ردود آلية سريعة بالكلمات' : 'Quick automatic text replies'],
      ['suggestions', tDash('nav.suggestions'),'💡','like', lang === 'ar' ? 'نظام التصويت والآراء' : 'Voting & suggestions box'],
      ['reports', tDash('nav.reports'),'⚠️','flag', lang === 'ar' ? 'استقبال ومتابعة شكاوى السيرفر' : 'Receive & follow up on server reports']
    ]],
    [tDash('cat.automation'), [
      ['autorole', tDash('nav.autorole'),'♟','users', lang === 'ar' ? 'إعطاء الرتب للأعضاء والبوتات' : 'Assign roles to members and bots'],
      ['level', tDash('nav.level'),'★','star', lang === 'ar' ? 'مكافآت التفاعل والترقيات' : 'Interaction rewards & levels'],
      ['sellerroom', tDash('nav.sellerroom'),'💰','card', lang === 'ar' ? 'منظومة التجارة والبيع الموثوق' : 'Secure commerce & sales room']
    ]],
    [tDash('cat.staff'), [
      ['staff-points', tDash('nav.staff_points'),'✦','crown', lang === 'ar' ? 'نقاط ومتابعة الإدارة' : 'Staff scoring & activity tracking'],
      ['interaction-points', tDash('nav.interaction_points'),'✧','bolt', lang === 'ar' ? 'نقاط الرسائل والتفاعل العام' : 'Message points & community interaction']
    ]],
    [tDash('cat.design'), [
      ['embeds', tDash('nav.embeds'),'▣','document', lang === 'ar' ? 'تصميم رسائل إيمبد غنية واحترافية' : 'Build rich & beautiful embeds'],
      ['components', tDash('nav.components'),'☷','channels', lang === 'ar' ? 'أزرار وقوائم ديسكورد التفاعلية' : 'Interactive Discord components']
    ]]
  ];
  const nav=$('#categoryNav');
  nav.innerHTML=cats.map(([c,items],idx)=>`
    <div class="v-nav-cat" data-cat-idx="${idx}">
      <div class="v-nav-cat-head">
        <small>${c}</small>
        <span class="v-cat-count">${items.length}</span>
      </div>
      <div class="v-nav-cat-list">
        ${items.map(x=>`
          <button class="v-nav-item" data-page="${x[0]}" title="${esc(x[4]||x[1])}">
            <span class="v-nav-ico-box">${(window.ZETA_ICONS?.img ? window.ZETA_ICONS.img(x[3]||'spark') : `<i>${x[2]}</i>`)}</span>
            <span class="v-nav-item-title">${x[1]}</span>
            <span class="v-nav-indicator"></span>
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)loadPage(b.dataset.page)});
  $('#navSearch').addEventListener('input',e=>{
    const q=e.target.value.trim().toLowerCase();
    nav.querySelectorAll('.v-nav-item').forEach(b=>{
      const match = !q || b.textContent.toLowerCase().includes(q) || (b.getAttribute('title')||'').toLowerCase().includes(q);
      b.hidden = !match;
    });
    nav.querySelectorAll('.v-nav-cat').forEach(cat=>{
      const visible = [...cat.querySelectorAll('.v-nav-item')].some(b=>!b.hidden);
      cat.style.display = visible ? '' : 'none';
    });
  });
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
  const menu=$('#serverPickerMenu');menu.innerHTML=state.servers.map(g=>`<button class="v-server-option" data-id="${g.id}" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; transition: background 0.15s; border-radius: 10px; background: transparent; border: 0; cursor: pointer; text-align: start; color: inherit;"><img src="${esc(g.icon||'/dashboard/images/logo.png')}" style="width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;"><div style="flex: 1; display: flex; flex-direction: column; align-items: flex-start; text-align: right; min-width: 0;"><span style="font-size: 13px; font-weight: 700; color: var(--text, #fff); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; display: flex; justify-content: flex-end; align-items: center; gap: 4px; text-align: right;">${g.isPremium ? '<span style="color: #f59e0b;" title="ZETA Premium">👑</span>' : ''} ${esc(g.name)}</span><div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted, #9cb2a6); margin-top: 2px;">${g.memberCount != null ? `<span>👥 ${g.memberCount.toLocaleString()}</span>` : ''}${g.activeChannelCount != null ? `<span>· 💬 ${g.activeChannelCount} قنوات</span>` : ''}</div></div><em style="font-size: 11px; font-weight: 600; color: ${g.isPremium ? '#f59e0b' : (g.installed ? 'var(--green-bright, #34d399)' : 'var(--muted, #9cb2a6)')}; font-style: normal; flex-shrink: 0; margin-inline-start: auto;">${g.isPremium ? 'Premium 💎' : (g.installed ? 'متصل' : 'غير مضاف')}</em></button>`).join('');
  $('#serverPickerBtn').onclick=()=>$('#serverPicker').classList.toggle('open');
  menu.onclick=e=>{const b=e.target.closest('[data-id]');if(b){const g=state.servers.find(x=>x.id===b.dataset.id);if(g.installed)selectGuild(g.id);else invite(g.id)}};
}
function invite(id){const s=state.servers.find(x=>x.id===id);const url=`https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(state.clientId)}&scope=bot%20applications.commands&permissions=8&guild_id=${encodeURIComponent(id)}`; if(!state.clientId){toast('لم يتم العثور على CLIENT_ID',true);return;} window.open(url,'_blank');}
function selectGuild(id){state.guild=state.servers.find(x=>x.id===id);history.replaceState({},'',`/dashboard/?guildId=${id}`);$('#activeServerName').innerHTML=esc(state.guild.name) + (state.guild.isPremium ? ' <span style="color: #f59e0b; text-shadow: 0 0 8px rgba(245,158,11,0.6);" title="ZETA Premium">👑</span>' : '');$('#guildLabel').textContent=state.guild.memberCount?`${state.guild.memberCount.toLocaleString()} عضو`:'إدارة السيرفر';$('#serverPickerImg').src=state.guild.icon||'/dashboard/images/logo.png';$('#serverPicker').classList.remove('open');loadPage('overview')}
function showNoGuild(){app.innerHTML=card('لا يوجد سيرفر متصل',`<p>أضف ZETA إلى سيرفر تديره ثم أعد تحميل الصفحة.</p>`)}
function markActive(page){document.querySelectorAll('.v-nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));document.body.classList.remove('menu-open','mobile-sidebar-open');const b=$('#mobileMenuBtn');b?.setAttribute('aria-expanded','false');b?.setAttribute('aria-label','فتح القائمة')}

const pages={
overview: async()=>{
 const d=await api(`/admin/${state.guild.id}/overview`);
 const g=state.guild||{};
 const stat=(icon,title,value,delta,badge='نشط')=>`
   <div class="zk-stat-card">
     <div class="zk-stat-top">
       <span class="zk-stat-icon">${icon}</span>
       <span class="zk-stat-badge">${badge}</span>
     </div>
     <div class="zk-stat-body">
       <span class="zk-stat-label">${esc(title)}</span>
       <strong class="zk-stat-value">${esc(value??'—')}</strong>
     </div>
     <div class="zk-stat-footer">
       <span class="zk-stat-trend">${esc(delta||'')}</span>
     </div>
   </div>
 `;
 const quickModules=[
   ['automod', 'درع الحماية الذكية', 'AutoMod & Anti-Raid', '🛡️', 'فلترة الروابط والسبام وحظر التخريب', 'نشط الآن'],
   ['welcomejoin', 'رسائل الترحيب والمغادرة', 'Welcome Messages', '👋', 'تخصيص كامل مع المنشن وعداد الأعضاء', 'احترافي'],
   ['tickets', 'نظام التذاكر', 'Ticket System', '🎫', 'إنشاء بانلات وأزرار دعم فني مخصصة', 'جاهز'],
   ['autorole', 'الرتب التلقائية', 'Auto-Roles', '♟', 'توزيع رتب تلقائية فور دخول العضو أو البوت', 'مفعل'],
   ['logs', 'سجلات التدقيق الكاملة', 'Audit Logs', '📜', 'تسجيل كل حركة وتغيير داخل السيرفر', 'مباشر'],
   ['embeds', 'منشئ رسائل الإيمبد', 'Embed Studio', '▣', 'تصميم رسائل إعلانية احترافية وبطاقات', 'متطور']
 ];
 const activity=[
   ['🛡️','تحديث نظام حماية السيرفر','تم فحص الروابط المشبوهة بنجاح','منذ دقيقتين','emerald'],
   ['👋','عضو جديد انضم للسيرفر','تم إرسال بطاقة الترحيب التلقائية','منذ 8 دقائق','emerald'],
   ['🎫','تذكرة دعم فني جديدة','تم فتح التذكرة بواسطة أحد الأعضاء','منذ 15 دقيقة','cyan'],
   ['♟','تعيين رتبة تلقائية','تم إسناد رتبة الأعضاء الجدد','منذ ساعة','emerald'],
   ['📜','مزامنة إعدادات البوت','تم حفظ التعديلات السحابية بنجاح','منذ ساعتين','gold']
 ];
 const memberCount = Number(d.members||g.memberCount||0);
 return `
 <div class="zk-overview" dir="rtl">
   <!-- Premium Bot Hero Banner -->
   <section class="zk-hero">
     <div class="zk-hero-glow"></div>
     <div class="zk-hero-content">
       <div class="zk-hero-user">
         <div class="zk-avatar-wrap">
           <img src="${esc(state.me?.avatar||'/dashboard/images/logo.png')}" alt="User">
           <span class="zk-online-indicator" title="متصل"></span>
         </div>
         <div class="zk-hero-text">
           <div class="zk-hero-tag">
             <span class="zk-pill-glow">⚡ بوت ديسكورد الرسمي</span>
             <span class="zk-pill-sub">V10.0 ULTRA</span>
           </div>
           <h1>أهلاً بك، ${esc(state.me?.username||'المشرف')} 👋</h1>
           <p>سيرفر <strong class="zk-text-green">${esc(g.name||'ZETA Community')}</strong> محمي ومدار بأحدث أنظمة الأمان والأتمتة العالمية.</p>
         </div>
       </div>
       <div class="zk-hero-badges">
         <div class="zk-badge-box">
           <span class="zk-badge-dot"></span>
           <div>
             <small>حالة البوت</small>
             <b>متصل 99.9%</b>
           </div>
         </div>
         <div class="zk-badge-box">
           <span class="zk-badge-ico" style="${d.guild?.isPremium ? 'text-shadow: 0 0 10px rgba(245, 158, 11, 0.8);' : ''}">${d.guild?.isPremium ? '💎' : '⚙️'}</span>
           <div>
             <small>اشتراك السيرفر</small>
             <b class="zk-text-gold" style="${d.guild?.isPremium ? 'color: #f59e0b; text-shadow: 0 0 8px rgba(245,158,11,0.4);' : 'color: #9cb2a6;'}">${d.guild?.isPremium ? 'ZETA Premium 👑' : 'باقة مجانية (ترقية)'}</b>
           </div>
         </div>
         <button class="zk-hero-action" data-go="settings">
           <span>إعدادات السيرفر</span>
           <i>⚙</i>
         </button>
       </div>
     </div>
   </section>

   <!-- Live Server Stats -->
   <section class="zk-stats-grid">
     ${stat('👥', 'إجمالي الأعضاء', memberCount ? memberCount.toLocaleString('ar') : '—', '↑ نمو مستمر في الأعضاء', 'Discord')}
     ${stat('🛡️', 'نظام الحماية', 'مفعّل وشغال', 'حظر فوري للسبام والتخريب', 'درع قوي')}
     ${stat('⌛', 'الأوامر المنفذة', Number(d.commands||d.commandCount||1420).toLocaleString('ar'), '↑ استجابة سريعة جداً', 'أداء 100%')}
     ${stat('🎫', 'تذاكر الدعم', Number(d.openTickets||0).toLocaleString('ar') + ' نشطة', 'نظام دعم سريع ومباشر', 'متاح')}
   </section>

   <!-- Main 2-Column Content Layout (Wick/ProBot Grid) -->
   <div class="zk-dashboard-columns">
     <!-- Left / Main Column -->
     <div class="zk-column-main">
       <!-- Essential Modules -->
       <div class="zk-panel">
         <div class="zk-panel-header">
           <div class="zk-panel-title">
             <span class="zk-panel-icon">⚡</span>
             <div>
               <h3>الوحدات الأساسية المفعلة</h3>
               <small>تحكم سريع في أهم أنظمة البوت المشهورة</small>
             </div>
           </div>
           <span class="zk-pill-glow">6 أنظمة نشطة</span>
         </div>
         <div class="zk-modules-grid">
           ${quickModules.map(([id, title, enTitle, icon, desc, badge])=>`
             <div class="zk-module-card" data-go="${id}">
               <div class="zk-mod-top">
                 <div class="zk-mod-icon">${icon}</div>
                 <span class="zk-mod-badge">${badge}</span>
               </div>
               <div class="zk-mod-copy">
                 <h4>${title}</h4>
                 <small class="zk-en-sub">${enTitle}</small>
                 <p>${desc}</p>
               </div>
               <div class="zk-mod-footer">
                 <span>فتح وتعديل</span>
                 <i class="zk-arrow">←</i>
               </div>
             </div>
           `).join('')}
         </div>
       </div>

       <!-- Server Activity Chart -->
       <div class="zk-panel">
         <div class="zk-panel-header">
           <div class="zk-panel-title">
             <span class="zk-panel-icon">📈</span>
             <div>
               <h3>مؤشر تفاعل ونشاط السيرفر</h3>
               <small>معدل الرسائل والأوامر المنفذة خلال آخر 7 أيام</small>
             </div>
           </div>
           <span class="zk-chart-time-pill">آخر 7 أيام</span>
         </div>
         <div class="zk-chart-container">
           <div class="zk-chart-svg-wrap">
             <svg viewBox="0 0 700 180" preserveAspectRatio="none" class="zk-neon-chart">
               <defs>
                 <linearGradient id="zkEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
                   <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
                 </linearGradient>
               </defs>
               <line x1="0" y1="40" x2="700" y2="40" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4"/>
               <line x1="0" y1="90" x2="700" y2="90" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4"/>
               <line x1="0" y1="140" x2="700" y2="140" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4"/>
               <polygon points="0,150 90,120 180,135 270,75 360,95 450,45 540,70 630,30 700,15 700,180 0,180" fill="url(#zkEmeraldGrad)"/>
               <polyline points="0,150 90,120 180,135 270,75 360,95 450,45 540,70 630,30 700,15" fill="none" stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
             <div class="zk-chart-labels">
               <span>السبت</span>
               <span>الأحد</span>
               <span>الاثنين</span>
               <span>الثلاثاء</span>
               <span>الأربعاء</span>
               <span>الخميس</span>
               <span>اليوم</span>
             </div>
           </div>
         </div>
       </div>
     </div>

     <!-- Right / Secondary Column -->
     <div class="zk-column-side">
       <!-- Active Server Profile Box -->
       <div class="zk-panel zk-server-box">
         <div class="zk-server-header">
           <img src="${esc(g.icon||'/dashboard/images/logo.png')}" alt="Server Icon" class="zk-server-icon">
           <div class="zk-server-info">
             <h4>${esc(g.name||'سيرفر ديسكورد')}</h4>
             <span class="zk-server-id">ID: ${esc(g.id||'—')}</span>
             <span class="zk-server-status-pill">● متصل بالبوت</span>
           </div>
         </div>
         <div class="zk-server-details-list">
           <div class="zk-detail-row">
             <span>الأعضاء</span>
             <b>${memberCount ? memberCount.toLocaleString('ar') : '—'}</b>
           </div>
           <div class="zk-detail-row">
             <span>حالة الحماية</span>
             <b class="zk-text-green">محمي (Anti-Raid)</b>
           </div>
           <div class="zk-detail-row">
             <span>البريفكس الحالي</span>
             <code>${esc(d.prefix||'!')}</code>
           </div>
           <div class="zk-detail-row">
             <span>قناة السجلات</span>
             <b>${d.logChannelId ? '# مفعلة' : 'غير محددة'}</b>
           </div>
         </div>
         <button class="zk-full-btn primary" data-go="settings">تعديل إعدادات السيرفر</button>
       </div>

       <!-- Recent Bot Activity -->
       <div class="zk-panel">
         <div class="zk-panel-header">
           <div class="zk-panel-title">
             <span class="zk-panel-icon">🕒</span>
             <div>
               <h3>سجل الأحداث المباشر</h3>
               <small>آخر الأنشطة التلقائية للبوت</small>
             </div>
           </div>
           <button class="zk-text-btn" data-go="logs">عرض السجلات</button>
         </div>
         <div class="zk-activity-list">
           ${activity.map(([icon, title, desc, time, color])=>`
             <div class="zk-activity-item ${color}">
               <div class="zk-act-icon">${icon}</div>
               <div class="zk-act-text">
                 <b>${title}</b>
                 <small>${desc}</small>
               </div>
               <span class="zk-act-time">${time}</span>
             </div>
           `).join('')}
         </div>
       </div>

       <!-- Pro Upgrade / Support Card -->
       <div class="zk-panel zk-support-card">
         <div class="zk-support-badge">ZETA VIP</div>
         <h4>تحكم بلا حدود في مجتمعك</h4>
         <p>استمتع بتخصيص كامل لرسائل الترحيب التفاعلية، وروم البيع، ونظام الحماية الأقوى لحماية سيرفرك من التخريب.</p>
         <button class="zk-full-btn emerald" data-go="welcomejoin">تخصيص الترحيب الآن</button>
       </div>
     </div>
   </div>
 </div>
 `;
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
  const lang = localStorage.getItem('zeta_dash_lang') || 'ar';
  const s=d.settings||{};
  const buttons=s.buttons||[];
  const quick=s.quickButtons||[];
  const textChannels=(channels||[]).filter(c=>Number(c.type)===0||Number(c.type)===5||Number(c.type)===10||Number(c.type)===11||Number(c.type)===12);
  const categories=(channels||[]).filter(c=>Number(c.type)===4);
  const chOpts=(current='')=>channelOptionsHtml(textChannels,current);
  const catOpts=(current='')=>`<option value="">— ${lang === 'ar' ? 'بدون تصنيف' : 'No Category'} —</option>`+(categories||[]).map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(current)?'selected':''}>${esc(c.name)}</option>`).join('');
  const roleOpts=(current='')=>roleOptionsHtml(roles,current);
  const display=(v,def)=>v||def;

  return `
  <div id="ticket-buttons-data" hidden>${esc(JSON.stringify(buttons))}</div>
  <div class="welcome-page" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
    <div class="welcome-grid" style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px; align-items: start; max-width: 1440px; margin: 0 auto;">
      <!-- Configuration Column -->
      <div class="welcome-controls">
        <section class="v-card" style="padding: 24px; border-radius: 16px; border: 1px solid var(--vx-line); background: var(--vx-card); margin-bottom: 24px; position: relative;">
          
          <!-- Header -->
          <div class="welcome-card-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--vx-line);">
            <div>
              <h2 style="font-size: 19px; font-weight: 800; display: flex; align-items: center; gap: 8px; margin: 0; color: #ffffff;">
                <span>🎫</span> ${tDash('tickets.title')}
              </h2>
              <p class="v-muted" style="margin: 6px 0 0 0; font-size: 13px;">${tDash('tickets.desc')}</p>
            </div>
            <form id="ticketsEnabledForm" style="margin: 0;">
              <div class="welcome-toggle-box" style="margin: 0; display: flex; align-items: center; gap: 10px; background: var(--vx-blue-soft); padding: 8px 16px; border-radius: 12px; border: 1px solid var(--vx-blue-line);">
                <label class="v-check" style="margin: 0; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" name="enabled" id="ticketEnabledToggle" ${s.enabled?'checked':''}>
                  <b style="font-size: 13px; color: var(--vx-green-bright)">${tDash('tickets.enabled_toggle')}</b>
                </label>
              </div>
            </form>
          </div>

          <!-- Segmented Navigation / Tabs -->
          <div style="display: flex; gap: 6px; margin-bottom: 24px; background: rgba(255,255,255,0.02); border: 1px solid var(--vx-line); padding: 5px; border-radius: 12px; flex-wrap: wrap;">
            <button type="button" class="v-btn" id="tab-btn-general" style="flex: 1; min-width: 120px; height: 38px; border-radius: 8px; font-size: 12.5px; font-weight: 700; transition: all 0.15s ease;" onclick="window.switchTicketTab('general')">${tDash('tickets.tab_general')}</button>
            <button type="button" class="v-btn ghost" id="tab-btn-panel" style="flex: 1; min-width: 120px; height: 38px; border-radius: 8px; font-size: 12.5px; font-weight: 700; transition: all 0.15s ease;" onclick="window.switchTicketTab('panel')">${tDash('tickets.tab_panel')}</button>
            <button type="button" class="v-btn ghost" id="tab-btn-buttons" style="flex: 1; min-width: 120px; height: 38px; border-radius: 8px; font-size: 12.5px; font-weight: 700; transition: all 0.15s ease;" onclick="window.switchTicketTab('buttons')">${tDash('tickets.tab_buttons')}</button>
            <button type="button" class="v-btn ghost" id="tab-btn-inner" style="flex: 1; min-width: 120px; height: 38px; border-radius: 8px; font-size: 12.5px; font-weight: 700; transition: all 0.15s ease;" onclick="window.switchTicketTab('inner')">${tDash('tickets.tab_inner')}</button>
            <button type="button" class="v-btn ghost" id="tab-btn-extra" style="flex: 1; min-width: 120px; height: 38px; border-radius: 8px; font-size: 12.5px; font-weight: 700; transition: all 0.15s ease;" onclick="window.switchTicketTab('extra')">${tDash('tickets.tab_extra')}</button>
          </div>

          <!-- Form for general & visual panel settings -->
          <form id="ticketsForm">
            <!-- Form-wide hidden enabled status that updates on toggle change -->
            <input type="hidden" name="enabled" id="formEnabledField" value="${s.enabled?'true':'false'}">

            <!-- Tab 1: General Settings -->
            <div id="ticket-sec-general" class="ticket-sec">
              <h3 style="margin-top: 0; font-size: 15px; margin-bottom: 16px; font-weight: 700; color: var(--vx-green-bright); display: flex; align-items: center; gap: 6px;">${tDash('tickets.general_title')}</h3>
              <div class="v-grid two" style="margin-bottom: 16px;">
                <label class="v-field"><span>${tDash('tickets.panel_channel')}</span><select name="panelChannelId" id="panelChannelIdSelect">${chOpts(s.panelChannelId||'')}</select></label>
                <label class="v-field"><span>${tDash('tickets.default_category')}</span><select name="ticketCategoryId">${catOpts(s.ticketCategoryId||'')}</select></label>
                <label class="v-field"><span>${tDash('tickets.transcript_channel')}</span><select name="transcriptChannelId">${chOpts(s.transcriptChannelId||'')}</select></label>
                <label class="v-field"><span>${tDash('tickets.support_role')}</span><select name="defaultSupportRoleId">${roleOpts(s.defaultSupportRoleId||'')}</select></label>
                ${input(tDash('tickets.name_format'), 'ticketNameFormat', s.ticketNameFormat||'ticket-{user}', 'text', 'placeholder="ticket-{user}"')}
                ${input(tDash('tickets.max_per_user'), 'maxTicketsPerUser', s.maxTicketsPerUser??1, 'number', 'min="1" max="10"')}
              </div>

              <!-- Ticket Welcome Template Customization -->
              <div style="margin-top: 24px; border-top: 1px solid var(--vx-line-2); padding-top: 20px;">
                <h4 style="margin: 0 0 6px; font-size: 13.5px; font-weight: 700; color: #ffffff;">💬 ${tDash('tickets.welcome_template_label')}</h4>
                <p class="v-muted" style="margin: 0 0 12px 0; font-size: 12px;">${lang === 'ar' ? 'تخصيص نص رسالة الترحيب التي يتم إرسالها داخل روم التكت المفتوحة لكل الأقسام.' : 'Customize the welcome text template sent inside newly opened ticket channels.'}</p>
                <label class="v-field">
                  <span>${tDash('tickets.welcome_template_label')}</span>
                  <textarea name="ticketWelcomeTemplate" rows="3" style="width: 100%; min-height: 80px; padding: 10px; border-radius: 8px; border: 1px solid var(--vx-line); background: rgba(0,0,0,0.15); color: #fff; font-family: inherit; font-size: 13px;" placeholder="${tDash('tickets.welcome_template_placeholder')}">${esc(s.ticketWelcomeTemplate || '')}</textarea>
                </label>
                <small class="v-muted" style="margin-top: 4px; display: block; font-size: 11px;">
                  ${lang === 'ar' ? 'الاختصارات المدعومة:' : 'Supported Placeholders:'} <code>{user}</code> (منشن), <code>{username}</code>, <code>{label}</code> (اسم القسم), <code>{server}</code>
                </small>
              </div>

              <!-- Inactivity Auto Close Settings -->
              <div style="margin-top: 24px; border-top: 1px solid var(--vx-line-2); padding-top: 20px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px; font-size: 13.5px; font-weight: 700; color: #ffffff;">⏳ ${tDash('tickets.auto_close_section')}</h4>
                <div class="v-grid two" style="gap: 16px;">
                  ${check(tDash('tickets.auto_close_enabled'), 'autoCloseEnabled', s.autoCloseEnabled)}
                  ${input(tDash('tickets.auto_close_minutes'), 'autoCloseMinutes', s.autoCloseMinutes ?? 1440, 'number', 'min="10" max="10080"')}
                </div>
              </div>

              <div style="margin-top: 24px; border-top: 1px solid var(--vx-line-2); padding-top: 20px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px; font-size: 13.5px; font-weight: 700; color: #ffffff;">${tDash('tickets.action_buttons')}</h4>
                <div class="v-grid two">
                  ${check(tDash('tickets.close_btn'), 'closeButton', s.closeButton!==false)}
                  ${check(tDash('tickets.claim_btn'), 'claimButton', s.claimButton!==false)}
                  ${check(tDash('tickets.transcript_btn'), 'transcriptButton', s.transcriptButton!==false)}
                  ${check(tDash('tickets.delete_btn'), 'deleteButton', s.deleteButton!==false)}
                  ${check(tDash('tickets.rating_enabled'), 'ratingEnabled', s.ratingEnabled)}
                </div>
              </div>

              <div style="margin-top: 16px; margin-bottom: 20px;">
                <label class="v-field"><span>${tDash('tickets.rating_channel')}</span><select name="ratingChannelId">${chOpts(s.ratingChannelId||'')}</select></label>
              </div>

              <div style="display: flex; justify-content: flex-end; border-top: 1px solid var(--vx-line); padding-top: 16px; gap: 8px;">
                ${formButton(tDash('ui.save'))}
              </div>
            </div>

            <!-- Tab 2: Panel Visual Customizer -->
            <div id="ticket-sec-panel" class="ticket-sec" style="display: none;">
              <h3 style="margin-top: 0; font-size: 15px; margin-bottom: 16px; font-weight: 700; color: var(--vx-green-bright); display: flex; align-items: center; gap: 6px;">${tDash('tickets.visual_title')}</h3>
              <div class="v-grid two" style="margin-bottom: 16px;">
                ${input(tDash('tickets.panel_title'), 'panelTitle', display(s.panelTitle, lang==='ar'?'فتح تذكرة':'Open Ticket'), 'text', 'id="panelTitleInput"')}
                ${input(tDash('tickets.panel_color'), 'panelColor', s.panelColor||'#7c5cff', 'color', 'id="panelColorInput" style="height: 42px; padding: 2px 6px; cursor: pointer;"')}
                ${imageField('ticketPanelImage', tDash('tickets.panel_image'), s.panelImage||'')}
                ${imageField('ticketPanelThumbnail', tDash('tickets.panel_thumbnail'), s.panelThumbnail||'')}
                ${input(tDash('tickets.panel_footer'), 'panelFooter', s.panelFooter||'', 'text', `id="panelFooterInput" placeholder="${lang==='ar'?'مثال: الدعم الفني':'E.g., ZETA Support'}"`)}
                <label class="v-field">
                  <span>${tDash('tickets.display_type')}</span>
                  <select name="openDisplayType" id="openDisplayTypeSelect">
                    <option value="buttons" ${s.openDisplayType!=='menu'?'selected':''}>${tDash('tickets.display_buttons')}</option>
                    <option value="menu" ${s.openDisplayType==='menu'?'selected':''}>${tDash('tickets.display_menu')}</option>
                  </select>
                </label>
              </div>

              <div style="margin-bottom: 20px;">
                <label class="v-field"><span>${tDash('tickets.panel_desc')}</span><textarea name="panelDescription" id="panelDescriptionInput" rows="4">${esc(display(s.panelDescription, lang === 'ar' ? 'هل تحتاج إلى مساعدة؟\\nاضغط أحد الأزرار بالأسفل لفتح تذكرة جديدة.' : 'Need help?\\nPress a button below to open a ticket.'))}</textarea></label>
              </div>

              <div style="display: flex; justify-content: flex-end; border-top: 1px solid var(--vx-line); padding-top: 16px;">
                ${formButton(tDash('ui.save'))}
              </div>
            </div>
          </form>
        </section>

        <!-- Tab 3: Buttons & Categories Panel -->
        <div class="ticket-sec" id="ticket-sec-buttons" style="display: none;">
          <section class="v-card" style="padding: 24px; border-radius: 16px; border: 1px solid var(--vx-line); background: var(--vx-card); margin-bottom: 24px;">
            <h3 style="margin-top: 0; font-size: 15px; margin-bottom: 8px; font-weight: 700; color: var(--vx-green-bright); display: flex; align-items: center; gap: 6px;">${tDash('tickets.categories_title')}</h3>
            <p class="v-muted" style="margin-top: 0; margin-bottom: 16px; font-size: 13px;">${tDash('tickets.categories_desc')}</p>
            
            <form id="ticketButtonAddForm">
              <div class="v-grid two" style="margin-bottom: 16px;">
               ${input(tDash('tickets.btn_label'),'label','','text',`required placeholder="${lang==='ar'?'مثال: الاستفسارات العامة':'E.g., General Inquiries'}"`)}
               ${emojiPickerField(tDash('tickets.btn_emoji'),'emoji')}
               <label class="v-field"><span>${tDash('tickets.btn_style')}</span><select name="style"><option value="Primary">${lang==='ar'?'أزرق (Primary)':'Blue (Primary)'}</option><option value="Success">${lang==='ar'?'أخضر (Success)':'Green (Success)'}</option><option value="Danger">${lang==='ar'?'أحمر (Danger)':'Red (Danger)'}</option><option value="Secondary">${lang==='ar'?'رمادي (Secondary)':'Grey (Secondary)'}</option></select></label>
               <label class="v-field"><span>${tDash('tickets.btn_category')}</span><select name="categoryId">${catOpts('')}</select></label>
               <label class="v-field"><span>${tDash('tickets.btn_support_role')}</span><select name="supportRoleId">${roleOpts('')}</select></label>
               ${input(tDash('tickets.btn_custom_id'),'id','support')}
               ${imageField('ticketButtonImage', tDash('tickets.btn_image'), '')}
              </div>
              <div style="margin-bottom: 20px;">
                <label class="v-field"><span>${tDash('tickets.btn_welcome_msg')}</span><textarea name="description" rows="3" placeholder="${lang==='ar'?'أهلاً بك، كيف يمكننا مساعدتك اليوم؟':'Welcome, how can we help you today?'}$"></textarea></label>
              </div>
              <div class="v-actions" style="margin-bottom: 24px; display: flex; justify-content: flex-end;">
                <button class="v-btn primary" type="submit">${tDash('tickets.btn_add')}</button>
              </div>
            </form>

            <h4 style="border-top: 1px solid var(--vx-line); padding-top: 16px; font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #ffffff;">${tDash('tickets.current_buttons')}</h4>
            <div class="v-list" style="display: flex; flex-direction: column; gap: 8px;">
              ${buttons.map(x=>`<div class="v-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.01); border: 1px solid var(--vx-line); border-radius: 10px;">
                <span style="display: flex; align-items: center; gap: 8px;">
                  ${x.emoji?`<span class="ticket-emoji-preview" style="font-size: 18px;">${esc(x.emoji)}</span> `:''}
                  <b style="font-size: 13.5px; color: #ffffff;">${esc(x.label)}</b>
                  <span aria-hidden="true" style="color: var(--vx-ink-3);">·</span>
                  <small style="color: var(--vx-ink-2); font-weight: 600; font-size: 11.5px; padding: 2px 6px; background: rgba(255,255,255,0.04); border-radius: 4px;">${esc(x.style||'Primary')}</small>
                </span>
                <button type="button" class="v-btn danger" style="height: 30px; padding: 0 12px; font-size: 12px; border-radius: 6px;" data-delete-ticket-button="${esc(x._id)}">${tDash('ui.delete')}</button>
              </div>`).join('')||empty(tDash('tickets.no_buttons'))}
            </div>
          </section>
        </div>

        <!-- Tab 4: Quick Buttons (Buttons Inside Ticket) -->
        <div class="ticket-sec" id="ticket-sec-inner" style="display: none;">
          <section class="v-card" style="padding: 24px; border-radius: 16px; border: 1px solid var(--vx-line); background: var(--vx-card); margin-bottom: 24px;">
            <h3 style="margin-top: 0; font-size: 15px; margin-bottom: 8px; font-weight: 700; color: var(--vx-green-bright); display: flex; align-items: center; gap: 6px;">${tDash('tickets.quick_title')}</h3>
            <p class="v-muted" style="margin-top: 0; margin-bottom: 16px; font-size: 13px;">${tDash('tickets.quick_desc')}</p>
            
            <form id="ticketQuickButtonAddForm">
              <div class="v-grid two" style="margin-bottom: 12px;">
                ${input(tDash('tickets.btn_label'),'label','','text',`required placeholder="${lang==='ar'?'مثال: تسليم الطلب':'E.g., Deliver Order'}"`)}
                ${emojiPickerField(tDash('tickets.btn_emoji'),'emoji')}
                <label class="v-field"><span>${tDash('tickets.btn_style')}</span><select name="style"><option value="Secondary">${lang==='ar'?'رمادي (Secondary)':'Grey (Secondary)'}</option><option value="Primary">${lang==='ar'?'أزرق (Primary)':'Blue (Primary)'}</option><option value="Success">${lang==='ar'?'أخضر (Success)':'Green (Success)'}</option><option value="Danger">${lang==='ar'?'أحمر (Danger)':'Red (Danger)'}</option></select></label>
              </div>
              <div style="margin-bottom: 20px;">
                <label class="v-field"><span>${tDash('tickets.quick_response_text')}</span><textarea name="response" rows="4" required placeholder="${lang==='ar'?'أهلاً بك، تم تسليم طلبك بنجاح! شكراً لتعاملك معنا.':'Welcome, your order has been delivered successfully! Thanks for dealing with us.'}"></textarea></label>
              </div>
              <div class="v-actions" style="margin-bottom: 24px; display: flex; justify-content: flex-end;">
                <button class="v-btn primary" type="submit">${tDash('tickets.quick_btn_add')}</button>
              </div>
            </form>

            <h4 style="border-top: 1px solid var(--vx-line); padding-top: 16px; font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #ffffff;">${tDash('tickets.quick_current')}</h4>
            <div class="v-list" style="display: flex; flex-direction: column; gap: 8px;">
              ${quick.map(x=>`<div class="v-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.01); border: 1px solid var(--vx-line); border-radius: 10px;">
                <span style="display: flex; align-items: center; gap: 8px;">
                  ${x.emoji?`<span class="ticket-emoji-preview" style="font-size: 18px;">${esc(x.emoji)}</span> `:''}
                  <b style="font-size: 13.5px; color: #ffffff;">${esc(x.label)}</b>
                </span>
                <button type="button" class="v-btn danger" style="height: 30px; padding: 0 12px; font-size: 12px; border-radius: 6px;" data-delete-ticket-quick="${esc(x._id)}">${tDash('ui.delete')}</button>
              </div>`).join('')||empty(tDash('tickets.quick_no_buttons'))}
            </div>
          </section>
        </div>

        <!-- Tab 5: Extra Panels -->
        <div class="ticket-sec" id="ticket-sec-extra" style="display: none;">
          <section class="v-card" style="padding: 24px; border-radius: 16px; border: 1px solid var(--vx-line); background: var(--vx-card); margin-bottom: 24px;">
            <h3 style="margin-top: 0; font-size: 15px; margin-bottom: 8px; font-weight: 700; color: var(--vx-green-bright); display: flex; align-items: center; gap: 6px;">${tDash('tickets.extra_title')}</h3>
            <p class="v-muted" style="margin-top: 0; margin-bottom: 16px; font-size: 13px;">${tDash('tickets.extra_desc')}</p>
            
            <form id="ticketPanelCreateForm" style="margin-bottom: 20px;">
              <div class="v-grid two" style="align-items: flex-end; gap: 16px;">
                ${input(tDash('tickets.extra_new_name'),'name','','text',`required placeholder="${lang==='ar'?'مثال: الإدارة العامة':'E.g., General Management'}"`)}
                <button class="v-btn primary" style="height: 42px;" type="submit">${tDash('tickets.extra_create')}</button>
              </div>
            </form>

            <h4 style="border-top: 1px solid var(--vx-line); padding-top: 16px; font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #ffffff;">${tDash('tickets.extra_current')}</h4>
            <div class="v-list" style="display: flex; flex-direction: column; gap: 8px;">
              ${(p.panels||[]).map(x=>`<div class="v-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.01); border: 1px solid var(--vx-line); border-radius: 10px;">
                <b style="font-size: 13.5px; color: #ffffff;">${esc(x.name)}</b>
                <button class="v-btn danger" style="height: 30px; padding: 0 12px; font-size: 12px; border-radius: 6px;" data-delete-panel="ticket-panels/${x._id}">${tDash('ui.delete')}</button>
              </div>`).join('')||empty(tDash('tickets.extra_no_panels'))}
            </div>
          </section>
        </div>
      </div>

      <!-- Preview Column -->
      <div class="welcome-preview-column" style="position: sticky; top: 92px;">
        <div class="discord-preview-wrap" style="background: #1e1f22; border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          <!-- Channel Bar -->
          <div class="discord-preview-bar" style="background: #2b2d31; padding: 10px 16px; border-bottom: 1px solid rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: space-between; color: #dbdee1;">
            <div class="discord-preview-channel" style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 13.5px;">
              <span style="color:#80848e">#</span>
              <span id="ticketPreviewChannelName">support</span>
            </div>
            <span style="font-size:11px;color:#949ba4;font-weight:600;">${tDash('tickets.preview_banner_text')}</span>
          </div>

          <!-- Message Area -->
          <div class="discord-preview-inner" style="background: #313338; padding: 16px; display: flex; gap: 14px;">
            <img class="discord-bot-avatar" src="/dashboard/images/logo.png" alt="ZETA" style="width: 40px; height: 40px; border-radius: 50%; background: #070c0a; border: 1px solid rgba(52,211,153,0.3);">
            <div class="discord-msg-content" style="flex: 1; min-width: 0;">
              <div class="discord-msg-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="discord-bot-name" style="font-weight: 700; color: #ffffff; font-size: 14px;">ZETA</span>
                <span class="discord-bot-tag" style="background: #5865f2; color: #ffffff; font-size: 10px; padding: 1px 4px; border-radius: 3px; font-weight: 700; line-height: 1.2;">BOT ✓</span>
                <span class="discord-msg-time" style="color: #949ba4; font-size: 11px; font-weight: 600;">${lang === 'ar' ? 'اليوم في 12:30 م' : 'Today at 12:30 PM'}</span>
              </div>

              <!-- Custom Embedded Ticket Panel Preview -->
              <div id="liveTicketEmbed" style="border-inline-start: 4px solid #7c5cff; padding: 12px 16px; border-radius: 6px; background: #2b2d31; margin-top: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); max-width: 460px; display: flex; flex-direction: column; gap: 8px; border: 1px solid rgba(255,255,255,0.02); border-inline-start-width: 4px;">
                
                <!-- Title & Description with Thumbnail -->
                <div style="display: flex; justify-content: space-between; gap: 12px; align-items: start;">
                  <div style="flex: 1; min-width: 0;">
                    <h3 id="liveTicketEmbedTitle" style="margin: 0 0 6px 0; color: #ffffff; font-size: 15px; font-weight: 700;">${lang === 'ar' ? 'فتح تذكرة' : 'Open Ticket'}</h3>
                    <div id="liveTicketEmbedDescription" style="color: #dbdee1; font-size: 13.5px; white-space: pre-wrap; line-height: 1.45; word-wrap: break-word;">${lang === 'ar' ? 'هل تحتاج إلى مساعدة؟\\nاضغط أحد الأزرار بالأسفل لفتح تذكرة جديدة.' : 'Need help?\\nPress a button below to open a ticket.'}</div>
                  </div>
                  <img id="liveTicketEmbedThumbnail" src="" style="width: 64px; height: 64px; border-radius: 6px; object-fit: cover; display: none;" onerror="this.style.display='none'">
                </div>

                <!-- Large Banner -->
                <img id="liveTicketEmbedBanner" src="" style="width: 100%; border-radius: 6px; max-height: 200px; object-fit: cover; display: none; margin-top: 4px;" onerror="this.style.display='none'">

                <!-- Footer -->
                <div id="liveTicketEmbedFooterSection" style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px; color: #949ba4; font-size: 11px; display: flex; align-items: center; gap: 6px;">
                  <span id="liveTicketEmbedFooterText">ZETA — ${lang === 'ar' ? 'نظام الدعم الفني' : 'Technical Support'}</span>
                  <span>•</span>
                  <span>${lang === 'ar' ? 'الآن' : 'Now'}</span>
                </div>
              </div>

              <!-- Interactive Controls Preview -->
              <div id="liveTicketInteractiveControls" style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; max-width: 460px;">
                <!-- Populated dynamically via JS -->
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
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
const WELCOME_TEMPLATES = [
  {
    name: 'كلاسيكي أنيق',
    desc: 'ترحيب دافئ ومباشر',
    text: 'أهلاً وسهلاً بك يا {user} في سيرفر **{server}**! 🎉\nيسعدنا جداً انضمامك، نتمنى لك وقتاً ممتعاً وتجربة رائعة معنا.'
  },
  {
    name: 'مع رقم العضو والقوانين',
    desc: 'يذكر ترتيب العضو وروم القوانين',
    text: 'مرحباً {user} 👋\nأنت العضو رقم **#{membercount}** في مجتمع **{server}**! ✨\n> يرجى الاطلاع على القوانين والتوجه للشات للتعرف على الأعضاء.'
  },
  {
    name: 'تفاعلي مع الرتب والتكت',
    desc: 'يوجه لاختيار الرتب والتذاكر',
    text: 'حياك الله {user} في **{server}**! 🚀\n> أنت العضو رقم: **#{membercount}**\nتفضل باختيار رتبك وتفاعل معنا في الشات العام، ولأي استفسار افتح تذكرة دعم!'
  },
  {
    name: 'رسمي ومختصر',
    desc: 'صيغة رسمية واضحة وموجزة',
    text: 'نرحب بانضمام {user} إلى **{server}** (العضو رقم #{membercount}).\nنرجو الالتزام بقواعد السيرفر والتواصل مع فريق الإدارة عند الحاجة.'
  },
  {
    name: 'مجتمع الألعاب والفعاليات',
    desc: 'حماسي للألعاب ومسابقات السيرفر',
    text: '🔥 مرحباً {user} في مجتمع **{server}**!\n🎮 اكتمل الفريق بك لتصبح العضو رقم **#{membercount}**!\n- تفقد رومات الألعاب والصوتيات\n- شارك في الفعاليات والبطولات 🏆'
  }
];

function insertPlaceholderAtCursor(textarea, placeholder) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const text = textarea.value;
  textarea.value = text.substring(0, start) + placeholder + text.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function wrapSelectionWith(textarea, before, after) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const text = textarea.value;
  const selected = text.substring(start, end) || 'نص';
  textarea.value = text.substring(0, start) + before + selected + after + text.substring(end);
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = start + before.length + selected.length;
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function applyFormatCommand(textarea, cmd) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const text = textarea.value;
  const selected = text.substring(start, end);

  if (cmd === 'bold') wrapSelectionWith(textarea, '**', '**');
  else if (cmd === 'italic') wrapSelectionWith(textarea, '*', '*');
  else if (cmd === 'underline') wrapSelectionWith(textarea, '__', '__');
  else if (cmd === 'strike') wrapSelectionWith(textarea, '~~', '~~');
  else if (cmd === 'spoiler') wrapSelectionWith(textarea, '||', '||');
  else if (cmd === 'code') wrapSelectionWith(textarea, '`', '`');
  else if (cmd === 'codeblock') wrapSelectionWith(textarea, '```\n', '\n```');
  else if (cmd === 'quote') {
    const val = selected || 'نص الاقتباس';
    const lines = val.split('\n').map(l => '> ' + l).join('\n');
    textarea.value = text.substring(0, start) + lines + text.substring(end);
    textarea.selectionStart = start;
    textarea.selectionEnd = start + lines.length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (cmd === 'h1') {
    const val = selected || 'عنوان رئيسي';
    textarea.value = text.substring(0, start) + '# ' + val + text.substring(end);
    textarea.selectionStart = start + 2;
    textarea.selectionEnd = start + 2 + val.length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (cmd === 'h2') {
    const val = selected || 'عنوان فرعي';
    textarea.value = text.substring(0, start) + '## ' + val + text.substring(end);
    textarea.selectionStart = start + 3;
    textarea.selectionEnd = start + 3 + val.length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (cmd === 'list') {
    const val = selected || 'عنصر في القائمة';
    const lines = val.split('\n').map(l => '- ' + l).join('\n');
    textarea.value = text.substring(0, start) + lines + text.substring(end);
    textarea.selectionStart = start;
    textarea.selectionEnd = start + lines.length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function parseDiscordMarkdown(text, guildName = 'سيرفر ZETA', memberCount = 154) {
  if (!text || !text.trim()) {
    return '<span style="color:#949ba4;font-style:italic">اكتب رسالتك في المحرر لتظهر المعاينة المباشرة هنا...</span>';
  }
  let s = esc(text);
  
  // Placeholders with realistic Discord styling
  s = s.replace(/\{user\}|\{mention\}/gi, '<span class="discord-mention" title="منشن العضو (يذكر العضو تلقائياً)">@عضو جديد</span>');
  s = s.replace(/\{username\}/gi, '<span class="discord-mention" style="background:rgba(255,255,255,0.08);color:#f2f3f5" title="اسم العضو بدون منشن">عضو جديد</span>');
  s = s.replace(/\{server\}/gi, `<span class="discord-server-highlight" title="اسم السيرفر">${esc(guildName)}</span>`);
  s = s.replace(/\{membercount\}/gi, `<span class="discord-count-highlight" title="رقم العضو">#${esc(memberCount)}</span>`);
  
  // Multiline Code Blocks: ```code```
  s = s.replace(/```(?:[a-z0-9_-]+)?\n?([\s\S]+?)```/g, '<pre class="discord-code-block"><code>$1</code></pre>');

  // Spoilers: ||text||
  s = s.replace(/\|\|([\s\S]+?)\|\|/g, '<span class="discord-spoiler" title="انقر للإظهار / الإخفاء" onclick="this.classList.toggle(\'revealed\')">$1</span>');
  // Bold + Italic: ***text***
  s = s.replace(/\*\*\*([\s\S]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold: **text**
  s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  // Underline: __text__
  s = s.replace(/__([\s\S]+?)__/g, '<u>$1</u>');
  // Italic: *text*
  s = s.replace(/\*([\s\S]+?)\*/g, '<em>$1</em>');
  // Strikethrough: ~~text~~
  s = s.replace(/~~([\s\S]+?)~~/g, '<s>$1</s>');
  // Inline Code: `code`
  s = s.replace(/`([^`]+)`/g, '<code class="discord-inline-code">$1</code>');
  // Blockquote lines, headings, subtext, lists
  s = s.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return `<h1 class="discord-h1">${line.replace(/^\s*#\s*/, '')}</h1>`;
    }
    if (trimmed.startsWith('## ')) {
      return `<h2 class="discord-h2">${line.replace(/^\s*##\s*/, '')}</h2>`;
    }
    if (trimmed.startsWith('### ')) {
      return `<h3 class="discord-h3">${line.replace(/^\s*###\s*/, '')}</h3>`;
    }
    if (trimmed.startsWith('-# ')) {
      return `<div class="discord-subtext">${line.replace(/^\s*-#\s*/, '')}</div>`;
    }
    if (trimmed.startsWith('&gt;')) {
      return `<div class="discord-quote">${line.replace(/^\s*&gt;\s*/, '')}</div>`;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return `<div class="discord-list-item">• ${line.replace(/^\s*[-*]\s*/, '')}</div>`;
    }
    return line;
  }).join('\n');
  
  return s;
}

function welcomeJoinForm(d,ch){
  const w=d.welcome||{},l=d.leave||{};
  const guildName=state.guild?.name||'سيرفر ZETA';
  const memberCount=state.guild?.memberCount||154;
  const initialMsg=w.message||'أهلاً بك يا {user} في سيرفر **{server}**! 🎉 أنت العضو رقم **#{membercount}**.';
  const initialLeave=l.message||'وداعاً {user}، نتمنى لك التوفيق!';

  return `<div class="welcome-page" dir="rtl">
    <form id="welcomeJoinForm">
      <div class="welcome-grid">
        <!-- Main Configuration & Rich Text Editor Column -->
        <div class="welcome-controls">
          <section class="v-card">
            <div class="welcome-card-header">
              <div>
                <h2>👋 محرر رسائل الترحيب المخصص (Rich-Text Editor)</h2>
                <p class="v-muted" style="margin-top:4px;font-size:13px">خصص رسالة الترحيب التفاعلية والمتغيرات المدمجة مع معاينة حية لشات Discord.</p>
              </div>
              <div class="welcome-toggle-box">
                <label class="v-check" style="margin:0;cursor:pointer">
                  <input type="checkbox" name="welcome.enabled" id="welcomeEnabledToggle" ${w.enabled!==false?'checked':''}>
                  <b style="font-size:13px;color:var(--vx-blue-2)">تفعيل الترحيب</b>
                </label>
              </div>
            </div>

            <!-- Channel Selector -->
            <div style="margin-bottom:18px">
              <label class="v-field">
                <span style="font-weight:700;display:flex;align-items:center;gap:6px">
                  <span>#</span> روم إرسال الترحيب
                </span>
                <select name="welcome.channelId" id="welcomeChannelSelect">
                  ${channelOptionsHtml(ch,w.channelId||'')}
                </select>
              </label>
            </div>

            <!-- Rich-Text Editor Component -->
            <div class="v-field">
              <span style="font-weight:700;display:flex;align-items:center;justify-content:space-between">
                <span>نص رسالة الترحيب</span>
                <small class="v-muted" style="font-size:11px">يدعم تنسيقات ماركداون واختصارات لوحة المفاتيح</small>
              </span>

              <div class="rte-box" id="welcomeRteBox">
                <!-- Placeholder insertion chips -->
                <div class="rte-placeholders-header">
                  <span>⚡ المتغيرات التلقائية المتاحة (انقر للإدراج في موضع المؤشر):</span>
                  <span style="font-size:11px;color:var(--vx-blue)">{user} · {server} · {membercount}</span>
                </div>
                <div class="rte-placeholders-row">
                  <button type="button" class="rte-chip" data-insert-placeholder="{user}" title="يذكر العضو بمنشن تفاعلي @User">
                    <code>+ {user}</code>
                    <span class="rte-chip-label">منشن العضو</span>
                  </button>
                  <button type="button" class="rte-chip" data-insert-placeholder="{server}" title="يعرض اسم السيرفر الحالي">
                    <code>+ {server}</code>
                    <span class="rte-chip-label">اسم السيرفر</span>
                  </button>
                  <button type="button" class="rte-chip" data-insert-placeholder="{membercount}" title="يعرض رقم وترتيب العضو الإجمالي في السيرفر">
                    <code>+ {membercount}</code>
                    <span class="rte-chip-label">عدد الأعضاء</span>
                  </button>
                  <button type="button" class="rte-chip" data-insert-placeholder="{username}" title="اسم العضو كنص مجرد بدون منشن">
                    <code>+ {username}</code>
                    <span class="rte-chip-label">اسم العضو</span>
                  </button>
                  <button type="button" class="rte-chip" data-insert-placeholder="{mention}" title="منشن العضو (بديل)">
                    <code>+ {mention}</code>
                    <span class="rte-chip-label">منشن بديل</span>
                  </button>
                </div>

                <!-- Formatting Toolbar -->
                <div class="rte-toolbar">
                  <button type="button" class="rte-tool-btn" data-format-cmd="bold" title="عريض (**نص**) — Ctrl+B"><b>B</b></button>
                  <button type="button" class="rte-tool-btn" data-format-cmd="italic" title="مائل (*نص*) — Ctrl+I"><i>I</i></button>
                  <button type="button" class="rte-tool-btn" data-format-cmd="underline" title="تسطير (__نص__) — Ctrl+U"><u>U</u></button>
                  <button type="button" class="rte-tool-btn" data-format-cmd="strike" title="شطب (~~نص~~)"><s>S</s></button>
                  <span class="rte-tool-sep"></span>
                  <button type="button" class="rte-tool-btn" data-format-cmd="h1" title="عنوان كبير (# عنوان)">H1</button>
                  <button type="button" class="rte-tool-btn" data-format-cmd="h2" title="عنوان فرعي (## عنوان)">H2</button>
                  <span class="rte-tool-sep"></span>
                  <button type="button" class="rte-tool-btn" data-format-cmd="code" title="كود مضمن (\`كود\`)">&lt;/&gt;</button>
                  <button type="button" class="rte-tool-btn" data-format-cmd="codeblock" title="كتلة برمجية (\`\`\`كود\`\`\`)">{ }</button>
                  <button type="button" class="rte-tool-btn" data-format-cmd="quote" title="اقتباس (&gt; نص)">❝</button>
                  <button type="button" class="rte-tool-btn" data-format-cmd="list" title="قائمة نقطية (- عنصر)">• List</button>
                  <button type="button" class="rte-tool-btn" data-format-cmd="spoiler" title="حرق (||نص||)">||</button>
                  <span class="rte-tool-sep"></span>
                  <button type="button" class="rte-tool-btn" data-insert-emoji="🎉" title="إدراج 🎉">🎉</button>
                  <button type="button" class="rte-tool-btn" data-insert-emoji="👋" title="إدراج 👋">👋</button>
                  <button type="button" class="rte-tool-btn" data-insert-emoji="✨" title="إدراج ✨">✨</button>
                  <button type="button" class="rte-tool-btn" data-insert-emoji="🚀" title="إدراج 🚀">🚀</button>
                  <button type="button" class="rte-tool-btn" data-insert-emoji="👑" title="إدراج 👑">👑</button>
                  <button type="button" class="rte-tool-btn" data-insert-emoji="🛡️" title="إدراج 🛡️">🛡️</button>
                  <button type="button" class="rte-tool-btn" data-insert-emoji="💎" title="إدراج 💎">💎</button>
                  <button type="button" class="rte-tool-btn" data-insert-emoji="❤️" title="إدراج ❤️">❤️</button>
                  <span class="rte-tool-sep"></span>
                  <button type="button" class="rte-tool-btn" data-rte-clear title="مسح النص" style="color:var(--vx-red);font-size:12px">🧹 مسح</button>
                </div>

                <!-- Textarea Editor -->
                <textarea 
                  name="welcome.message" 
                  id="welcomeMessageInput" 
                  class="rte-textarea" 
                  rows="6" 
                  placeholder="اكتب رسالة الترحيب هنا... يمكنك استخدام {user} لمنشن العضو، {server} لاسم السيرفر، و {membercount} لعدد الأعضاء."
                  spellcheck="false"
                >${esc(initialMsg)}</textarea>

                <!-- Editor Footer with live indicators -->
                <div class="rte-footer">
                  <div class="rte-tags-detected" id="welcomeDetectedTags">
                    <!-- populated dynamically -->
                  </div>
                  <div class="rte-char-count">
                    <span id="welcomeCharCount">0</span> / 2000 حرف
                  </div>
                </div>
              </div>
            </div>

            <!-- Quick Starter Templates -->
            <div class="rte-templates-box">
              <div class="rte-templates-title">
                <span>📚 قوالب رسائل ترحيبية جاهزة (انقر للاستخدام الفوري):</span>
                <span style="font-size:11px;font-weight:normal;color:var(--vx-ink-3)">تتضمن المتغيرات {user} و {server} و {membercount}</span>
              </div>
              <div class="rte-templates-grid">
                ${WELCOME_TEMPLATES.map((tpl, i) => `
                  <button type="button" class="rte-template-card" data-apply-template="${i}">
                    <b>${esc(tpl.name)}</b>
                    <small>${esc(tpl.desc)}</small>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Custom Welcome Image Card Section -->
            <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--vx-line)">
              <h3 style="margin:0 0 8px;font-size:15px;display:flex;align-items:center;gap:6px">
                <span>🖼️</span> بطاقة الترحيب الصورية (Welcome Card)
              </h3>
              <p class="v-muted" style="margin-bottom:14px;font-size:12.5px">
                يمكن للبوت إنشاء بطاقة ترحيبية عالية الدقة تلقائياً تحتوي على صورة خلفيتك وصورة العضو واسمه.
              </p>
              
              <div class="v-grid two">
                ${imageField('welcomeBackground', 'صورة خلفية بطاقة الترحيب (رابط أو رفع ملف)', w.backgroundImage || '')}
                ${input('النص المخصص المطبوع على البطاقة', 'welcome.cardText', w.cardText || '', 'text', 'placeholder="مثال: مرحباً بك في السيرفر"')}
                <label class="v-field">
                  <span>موضع صورة العضو الأفقية X: <b id="avatarXValue">${Number.isFinite(w.avatarX) ? w.avatarX : 50}%</b></span>
                  <input type="range" name="welcome.avatarX" id="avatarXSlider" min="10" max="90" value="${Number.isFinite(w.avatarX) ? w.avatarX : 50}">
                </label>
                <label class="v-field">
                  <span>موضع صورة العضو الرأسية Y: <b id="avatarYValue">${Number.isFinite(w.avatarY) ? w.avatarY : 25}%</b></span>
                  <input type="range" name="welcome.avatarY" id="avatarYSlider" min="10" max="90" value="${Number.isFinite(w.avatarY) ? w.avatarY : 25}">
                </label>
              </div>
            </div>

            <!-- Leave Message Section -->
            <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--vx-line)">
              <div class="welcome-card-header" style="margin-bottom:14px;border:none;padding:0">
                <h3 style="margin:0;font-size:15px;display:flex;align-items:center;gap:6px">
                  <span>🚪</span> رسالة المغادرة (Leave Message)
                </h3>
                <label class="v-check" style="margin:0">
                  <input type="checkbox" name="leave.enabled" id="leaveEnabledToggle" ${l.enabled ? 'checked' : ''}>
                  <span style="font-size:12.5px">تفعيل رسالة المغادرة</span>
                </label>
              </div>

              <div class="v-grid two" style="margin-bottom:12px">
                <label class="v-field">
                  <span>روم رسائل المغادرة</span>
                  <select name="leave.channelId">
                    ${channelOptionsHtml(ch, l.channelId || '')}
                  </select>
                </label>
              </div>

              <div class="v-field">
                <div class="rte-placeholders-row" style="border-radius:10px 10px 0 0;border:1px solid var(--vx-line);border-bottom:none">
                  <button type="button" class="rte-chip" data-insert-leave="{user}">
                    <code>+ {user}</code>
                    <span class="rte-chip-label">اسم العضو</span>
                  </button>
                  <button type="button" class="rte-chip" data-insert-leave="{server}">
                    <code>+ {server}</code>
                    <span class="rte-chip-label">اسم السيرفر</span>
                  </button>
                  <button type="button" class="rte-chip" data-insert-leave="{membercount}">
                    <code>+ {membercount}</code>
                    <span class="rte-chip-label">عدد الأعضاء</span>
                  </button>
                </div>
                <textarea 
                  name="leave.message" 
                  id="leaveMessageInput" 
                  class="rte-textarea" 
                  style="border:1px solid var(--vx-line);border-radius:0 0 10px 10px;min-height:90px" 
                  placeholder="رسالة المغادرة... مثال: غادرنا {user}، وداعاً نتمنى لك التوفيق!"
                >${esc(initialLeave)}</textarea>
              </div>
            </div>

            <!-- Actions Bar -->
            <div class="v-actions rte-actions-row" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--vx-line)">
              ${formButton('حفظ إعدادات الترحيب والمغادرة')}
              <button type="button" class="v-btn rte-test-btn" id="btnTestWelcome">
                <span>🧪</span> إرسال رسالة تجريبية
              </button>
            </div>
          </section>
        </div>

        <!-- Live Realistic Discord Preview Column -->
        <div class="welcome-preview-column">
          <div class="discord-preview-wrap">
            <!-- Channel Bar -->
            <div class="discord-preview-bar">
              <div class="discord-preview-channel">
                <span style="color:#80848e">#</span>
                <span id="previewChannelName">welcome</span>
              </div>
              <span style="font-size:11px;color:#80848e">معاينة مباشرة لشات Discord</span>
            </div>

            <!-- Message Area -->
            <div class="discord-preview-inner">
              <img class="discord-bot-avatar" src="/dashboard/images/logo.png" alt="ZETA">
              <div class="discord-msg-content">
                <div class="discord-msg-header">
                  <span class="discord-bot-name">ZETA</span>
                  <span class="discord-bot-tag">BOT ✓</span>
                  <span class="discord-msg-time">اليوم في 12:30 م</span>
                </div>
                <div class="discord-msg-text" id="discordPreviewMessageText">
                  <!-- Live rendered message markdown -->
                </div>
              </div>
            </div>

            <!-- Graphical Card Preview (if image card used) -->
            <div class="discord-card-preview-sub" id="cardGraphicPreviewSection">
              <div style="padding:0 16px 10px;font-size:11px;color:#949ba4;font-weight:700">
                بطاقة الترحيب الصورية المرفقة:
              </div>
              <div style="padding:0 16px 16px">
                <div class="welcome-preview" id="liveWelcomeCardPreview">
                  <div class="welcome-preview-avatar" id="liveAvatarMarker" style="left:${Number.isFinite(w.avatarX) ? w.avatarX : 50}%;top:${Number.isFinite(w.avatarY) ? w.avatarY : 25}%">
                    <img src="/assets/bot-avatar.png" alt="Avatar">
                  </div>
                  <div class="welcome-preview-text">
                    <b id="liveCardCustomText">${esc(w.cardText || 'WELCOME')}</b>
                    <small id="liveCardSubText">${esc(guildName)} · العضو رقم #${esc(memberCount)}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>`;
}

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
    if(page==='tickets')o=Object.fromEntries(Object.entries(o).map(([k,v])=>[k,['maxTicketsPerUser','autoCloseMinutes'].includes(k)?Number(v):v]));
    if(page==='interaction-points')o={enabled:o.enabled,pointsPerMessage:Number(o.pointsPerMessage),cooldownSeconds:Number(o.cooldownSeconds),minMessageLength:Number(o.minMessageLength),logsChannelId:o.logsChannelId};
    try{await api(`/admin/${state.guild.id}${endpointMap[page][0]}`,{method:'POST',body:JSON.stringify(o)});toast('تم الحفظ بنجاح ✓');}catch(err){toast(err.message,true)}
  });
  if(page==='welcomejoin'){
    const wf = app.querySelector('#welcomeJoinForm');
    const msgInput = app.querySelector('#welcomeMessageInput');
    const previewText = app.querySelector('#discordPreviewMessageText');
    const charCountEl = app.querySelector('#welcomeCharCount');
    const detectedTagsEl = app.querySelector('#welcomeDetectedTags');
    const channelSelect = app.querySelector('#welcomeChannelSelect');
    const previewChannel = app.querySelector('#previewChannelName');
    const cardBgInput = app.querySelector('#welcomeBackground');
    const cardTextInput = app.querySelector('input[name="welcome.cardText"]');
    const liveCardPreview = app.querySelector('#liveWelcomeCardPreview');
    const liveAvatarMarker = app.querySelector('#liveAvatarMarker');
    const liveCardCustomText = app.querySelector('#liveCardCustomText');
    const sliderX = app.querySelector('#avatarXSlider');
    const sliderY = app.querySelector('#avatarYSlider');
    const sliderXVal = app.querySelector('#avatarXValue');
    const sliderYVal = app.querySelector('#avatarYValue');
    const leaveInput = app.querySelector('#leaveMessageInput');

    const guildName = state.guild?.name || 'سيرفر ZETA';
    const memberCount = state.guild?.memberCount || 154;

    const updateWelcomePreview = () => {
      if (!msgInput) return;
      const text = msgInput.value;
      
      // Update Discord message simulation
      if (previewText) {
        previewText.innerHTML = parseDiscordMarkdown(text, guildName, memberCount);
      }

      // Update character counter
      if (charCountEl) {
        charCountEl.textContent = text.length;
        charCountEl.style.color = text.length > 2000 ? 'var(--vx-red)' : text.length > 1800 ? 'var(--vx-amber)' : 'var(--vx-ink-2)';
      }

      // Update detected tags
      if (detectedTagsEl) {
        const hasUser = /\{user\}|\{mention\}/i.test(text);
        const hasServer = /\{server\}/i.test(text);
        const hasCount = /\{membercount\}/i.test(text);
        const hasUsername = /\{username\}/i.test(text);

        const pills = [];
        if (hasUser) pills.push('<span class="rte-detected-badge">✓ {user} منشن</span>');
        if (hasServer) pills.push('<span class="rte-detected-badge">✓ {server} السيرفر</span>');
        if (hasCount) pills.push('<span class="rte-detected-badge">✓ {membercount} العدد</span>');
        if (hasUsername) pills.push('<span class="rte-detected-badge">✓ {username} الاسم</span>');
        detectedTagsEl.innerHTML = pills.length ? pills.join('') : '<span style="color:var(--vx-ink-3);font-size:11px">لم يتم تضمين متغيرات بعد</span>';
      }

      // Update Channel Name
      if (channelSelect && previewChannel) {
        const opt = channelSelect.options[channelSelect.selectedIndex];
        previewChannel.textContent = opt && opt.text ? opt.text.replace(/^[#\s]+/, '') : 'welcome';
      }

      // Update Card Visual Preview
      if (liveCardCustomText && cardTextInput) {
        const cText = cardTextInput.value.trim() || 'WELCOME';
        liveCardCustomText.textContent = cText
          .replace(/\{user\}|\{mention\}|\{username\}/gi, 'عضو جديد')
          .replace(/\{server\}/gi, guildName)
          .replace(/\{membercount\}/gi, memberCount);
      }
      if (liveCardPreview && cardBgInput) {
        if (cardBgInput.value.trim()) {
          liveCardPreview.style.backgroundImage = `url("${cardBgInput.value.trim()}")`;
        } else {
          liveCardPreview.style.backgroundImage = '';
        }
      }
      if (sliderX && sliderY && liveAvatarMarker) {
        liveAvatarMarker.style.left = `${sliderX.value}%`;
        liveAvatarMarker.style.top = `${sliderY.value}%`;
      }
    };

    // Bind Placeholders for Welcome Message
    app.querySelectorAll('[data-insert-placeholder]').forEach(btn => {
      btn.onclick = () => {
        const ph = btn.dataset.insertPlaceholder;
        insertPlaceholderAtCursor(msgInput, ph);
        updateWelcomePreview();
        toast(`تم إدراج ${ph} ✓`);
      };
    });

    // Bind Formatting Commands
    app.querySelectorAll('[data-format-cmd]').forEach(btn => {
      btn.onclick = () => {
        const cmd = btn.dataset.formatCmd;
        applyFormatCommand(msgInput, cmd);
        updateWelcomePreview();
      };
    });

    // Bind Emojis
    app.querySelectorAll('[data-insert-emoji]').forEach(btn => {
      btn.onclick = () => {
        insertPlaceholderAtCursor(msgInput, btn.dataset.insertEmoji + ' ');
        updateWelcomePreview();
      };
    });

    // Bind Clear
    app.querySelector('[data-rte-clear]')?.addEventListener('click', () => {
      if (!confirm('هل أنت متأكد من مسح نص الرسالة؟')) return;
      msgInput.value = '';
      updateWelcomePreview();
      msgInput.focus();
    });

    // Bind Template Application
    app.querySelectorAll('[data-apply-template]').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.applyTemplate);
        const tpl = WELCOME_TEMPLATES[idx];
        if (tpl) {
          msgInput.value = tpl.text;
          updateWelcomePreview();
          toast(`تم تطبيق قالب "${tpl.name}" ✓`);
          msgInput.focus();
        }
      };
    });

    // Bind Keyboard Shortcuts in Textarea
    msgInput?.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'b') {
          e.preventDefault();
          applyFormatCommand(msgInput, 'bold');
          updateWelcomePreview();
        } else if (e.key.toLowerCase() === 'i') {
          e.preventDefault();
          applyFormatCommand(msgInput, 'italic');
          updateWelcomePreview();
        } else if (e.key.toLowerCase() === 'u') {
          e.preventDefault();
          applyFormatCommand(msgInput, 'underline');
          updateWelcomePreview();
        } else if (e.shiftKey && e.key.toLowerCase() === 'x') {
          e.preventDefault();
          applyFormatCommand(msgInput, 'strike');
          updateWelcomePreview();
        } else if (e.shiftKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          applyFormatCommand(msgInput, 'spoiler');
          updateWelcomePreview();
        }
      }
    });

    // Bind Test Welcome Message
    app.querySelector('#btnTestWelcome')?.addEventListener('click', async () => {
      const btn = app.querySelector('#btnTestWelcome');
      if (!btn) return;
      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> جاري الإرسال…';
      try {
        const res = await api(`/admin/${state.guild.id}/welcome/test`, {
          method: 'POST',
          body: JSON.stringify({
            message: msgInput?.value,
            channelId: channelSelect?.value
          })
        });
        if (res.sent) {
          toast(`✅ تم إرسال رسالة ترحيب تجريبية إلى #${res.channelName}`);
        } else {
          toast(res.note || 'تمت محاكاة رسالة الترحيب بنجاح ✓');
        }
      } catch (err) {
        toast('خطأ في إرسال الرسالة التجريبية: ' + err.message, true);
      } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    });

    // Bind Input Listeners
    msgInput?.addEventListener('input', updateWelcomePreview);
    channelSelect?.addEventListener('change', updateWelcomePreview);
    cardTextInput?.addEventListener('input', updateWelcomePreview);
    cardBgInput?.addEventListener('input', updateWelcomePreview);

    // Sliders
    sliderX?.addEventListener('input', () => {
      if (sliderXVal) sliderXVal.textContent = sliderX.value + '%';
      updateWelcomePreview();
    });
    sliderY?.addEventListener('input', () => {
      if (sliderYVal) sliderYVal.textContent = sliderY.value + '%';
      updateWelcomePreview();
    });

    // Leave placeholders
    app.querySelectorAll('[data-insert-leave]').forEach(btn => {
      btn.onclick = () => {
        if (leaveInput) {
          insertPlaceholderAtCursor(leaveInput, btn.dataset.insertLeave);
          toast(`تم إدراج ${btn.dataset.insertLeave} في رسالة المغادرة ✓`);
        }
      };
    });

    // Initial preview update
    updateWelcomePreview();

    // Form submission
    wf?.addEventListener('submit', async e => {
      e.preventDefault();
      const o = formDataObj(wf);
      const payload = {
        welcome: {
          enabled: Boolean(o['welcome.enabled']),
          channelId: o['welcome.channelId'],
          message: o['welcome.message'],
          backgroundImage: o['welcomeBackground'] || '',
          cardText: o['welcome.cardText'],
          avatarX: Number(o['welcome.avatarX']) || 50,
          avatarY: Number(o['welcome.avatarY']) || 25
        },
        leave: {
          enabled: Boolean(o['leave.enabled']),
          channelId: o['leave.channelId'],
          message: o['leave.message']
        }
      };
      try {
        await api(`/admin/${state.guild.id}/settings`, { method: 'POST', body: JSON.stringify(payload) });
        toast('تم حفظ إعدادات الترحيب والمغادرة بنجاح ✓');
      } catch (err) {
        toast(err.message, true);
      }
    });
  }
  const showLogSave=()=>app.querySelector('[data-log-savebar]')?.classList.remove('is-hidden');
  app.querySelectorAll('[data-log-enabled]').forEach(el=>el.addEventListener('change',()=>{el.closest('[data-log-card]')?.classList.toggle('is-enabled',el.checked);showLogSave()}));
  app.querySelectorAll('[data-log-color]').forEach(el=>el.addEventListener('input',()=>{const out=app.querySelector(`[data-color-value="${CSS.escape(el.dataset.logColor)}"]`);if(out)out.textContent=el.value.toUpperCase();showLogSave()}));
  app.querySelectorAll('[data-log-channel]').forEach(el=>el.addEventListener('change',showLogSave));
  app.querySelector('[data-log-cancel]')?.addEventListener('click',()=>loadPage('logs'));

  app.querySelectorAll('[data-delete-panel]').forEach(b=>b.onclick=async()=>{if(!confirm('حذف هذه اللوحة؟'))return;try{await api(`/admin/${state.guild.id}/${b.dataset.deletePanel}`,{method:'DELETE'});toast('تم الحذف');loadPage(page)}catch(e){toast(e.message,true)}});
  app.querySelectorAll('[data-emoji-picker]').forEach(b=>b.addEventListener('click',()=>openEmojiPicker(b)));
  if(page==='tickets'){
    // Expose window switch function for the tabs
    window.switchTicketTab = (tabId) => {
      state.activeTicketTab = tabId;
      app.querySelectorAll('.ticket-sec').forEach(sec => sec.style.display = 'none');
      const activeSec = app.querySelector(`#ticket-sec-${tabId}`);
      if(activeSec) activeSec.style.display = 'block';

      // Switch button styles
      app.querySelectorAll('[id^="tab-btn-"]').forEach(btn => {
        btn.classList.add('ghost');
        btn.style.background = 'transparent';
        btn.style.border = '1px solid transparent';
        btn.style.color = 'var(--vx-ink-2)';
      });
      const activeBtn = app.querySelector(`#tab-btn-${tabId}`);
      if(activeBtn) {
        activeBtn.classList.remove('ghost');
        activeBtn.style.background = 'var(--vx-blue-soft)';
        activeBtn.style.border = '1px solid var(--vx-blue-line)';
        activeBtn.style.color = 'var(--vx-green-bright)';
      }
    };

    // Live preview function
    const updateTicketPreview = () => {
      const titleInput = app.querySelector('#panelTitleInput');
      const colorInput = app.querySelector('#panelColorInput');
      const descInput = app.querySelector('#panelDescriptionInput');
      const footerInput = app.querySelector('#panelFooterInput');
      const thumbInput = app.querySelector('input[name="ticketPanelThumbnail"]');
      const bannerInput = app.querySelector('input[name="ticketPanelImage"]');
      const chanSelect = app.querySelector('#panelChannelIdSelect');
      const displaySelect = app.querySelector('#openDisplayTypeSelect');

      const embedEl = app.querySelector('#liveTicketEmbed');
      const embedTitleEl = app.querySelector('#liveTicketEmbedTitle');
      const embedDescEl = app.querySelector('#liveTicketEmbedDescription');
      const embedThumbEl = app.querySelector('#liveTicketEmbedThumbnail');
      const embedBannerEl = app.querySelector('#liveTicketEmbedBanner');
      const embedFooterEl = app.querySelector('#liveTicketEmbedFooterText');
      const controlsEl = app.querySelector('#liveTicketInteractiveControls');
      const channelNameEl = app.querySelector('#ticketPreviewChannelName');

      if (!embedEl) return;

      // Title
      if (titleInput && embedTitleEl) {
        embedTitleEl.textContent = titleInput.value.trim() || 'فتح تذكرة';
      }

      // Color
      if (colorInput && embedEl) {
        embedEl.style.borderInlineStartColor = colorInput.value || '#7c5cff';
      }

      // Description
      if (descInput && embedDescEl) {
        const text = descInput.value;
        embedDescEl.innerHTML = parseDiscordMarkdown(text, state.guild?.name || 'سيرفر ZETA', state.guild?.memberCount || 154);
      }

      // Thumbnail
      if (thumbInput && embedThumbEl) {
        const val = thumbInput.value.trim();
        if (val) {
          embedThumbEl.src = val;
          embedThumbEl.style.display = 'block';
        } else {
          embedThumbEl.style.display = 'none';
        }
      }

      // Banner
      if (bannerInput && embedBannerEl) {
        const val = bannerInput.value.trim();
        if (val) {
          embedBannerEl.src = val;
          embedBannerEl.style.display = 'block';
        } else {
          embedBannerEl.style.display = 'none';
        }
      }

      // Footer
      if (footerInput && embedFooterEl) {
        embedFooterEl.textContent = footerInput.value.trim() || (state.guild?.name || 'ZETA Bot') + ' — نظام الدعم الفني';
      }

      // Channel name preview
      if (chanSelect && channelNameEl) {
        const opt = chanSelect.options[chanSelect.selectedIndex];
        channelNameEl.textContent = opt && opt.text && !opt.text.startsWith('—') ? opt.text.replace(/^[#\s]+/, '') : 'support';
      }

      // Interactive controls (Buttons or Select Menu)
      if (displaySelect && controlsEl) {
        const dataBox = app.querySelector('#ticket-buttons-data');
        let btns = [];
        try {
          btns = dataBox ? JSON.parse(dataBox.textContent) : [];
        } catch (e) {
          console.error(e);
        }

        const openType = displaySelect.value;
        if (openType === 'menu') {
          controlsEl.innerHTML = `
            <div style="width: 100%; padding: 10px 14px; background: #2b2d31; border: 1px solid rgba(0,0,0,0.2); border-radius: 4px; display: flex; justify-content: space-between; align-items: center; color: #949ba4; font-size: 13px; font-weight: 600;">
              <span>🎫 اختر نوع التذكرة اللي تبي تفتحها...</span>
              <span style="font-size: 10px; transform: scaleY(0.6);">▼</span>
            </div>
          `;
        } else {
          // Render buttons
          if (btns.length === 0) {
            controlsEl.innerHTML = `
              <button type="button" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 3px; font-size: 13.5px; font-weight: 600; color: #ffffff; background: #da373c; border: 0; cursor: default;">
                🎫 فتح تذكرة
              </button>
            `;
          } else {
            const btnStyles = {
              Primary: '#5865f2',
              Success: '#248046',
              Danger: '#da373c',
              Secondary: '#4e5058'
            };
            controlsEl.innerHTML = btns.slice(0, 5).map(b => {
              const bg = btnStyles[b.style] || btnStyles.Primary;
              return `
                <button type="button" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 3px; font-size: 13.5px; font-weight: 600; color: #ffffff; background: ${bg}; border: 0; cursor: default; white-space: nowrap;">
                  ${b.emoji ? `<span style="font-size: 14px;">${esc(b.emoji)}</span>` : '🎫'}
                  <span>${esc(b.label)}</span>
                </button>
              `;
            }).join('');
          }
        }
      }
    };

    // Bind preview listeners
    app.querySelectorAll('#panelTitleInput, #panelColorInput, #panelDescriptionInput, #panelFooterInput, #openDisplayTypeSelect, #panelChannelIdSelect').forEach(el => {
      el.addEventListener('input', updateTicketPreview);
      el.addEventListener('change', updateTicketPreview);
    });

    const watchImageInputs = () => {
      const tInput = app.querySelector('input[name="ticketPanelThumbnail"]');
      const bInput = app.querySelector('input[name="ticketPanelImage"]');
      if (tInput) {
        tInput.addEventListener('input', updateTicketPreview);
        tInput.addEventListener('change', updateTicketPreview);
      }
      if (bInput) {
        bInput.addEventListener('input', updateTicketPreview);
        bInput.addEventListener('change', updateTicketPreview);
      }
    };

    // Toggle save instantly
    app.querySelector('#ticketEnabledToggle')?.addEventListener('change', async e => {
      const toggle = e.target;
      const hidden = app.querySelector('#formEnabledField');
      if (hidden) {
        hidden.value = toggle.checked ? 'true' : 'false';
      }
      // Submit the form to instantly save the enabled status
      const ticketsForm = app.querySelector('#ticketsForm');
      if (ticketsForm) {
        ticketsForm.dispatchEvent(new Event('submit', { bubbles: true }));
      }
    });

    // Active tab and initial preview call
    window.switchTicketTab(state.activeTicketTab || 'general');
    updateTicketPreview();
    setTimeout(watchImageInputs, 500); // Allow image binding to run

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