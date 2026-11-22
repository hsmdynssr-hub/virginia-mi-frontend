'use strict';
const $=id=>document.getElementById(id),pages={},savedGrants=new Map();
let adminToken='';
const status=text=>$('status').textContent=text;
async function api(path='',method='GET',body,retry=true){
  // Existing MI browser session is HttpOnly. Its short-lived bearer stays in memory here.
  if(!adminToken){const r=await fetch(`${window.WORKSPACE_API}/auth/refresh`,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error('سجّل الدخول بحساب مدير odoo-mi أولًا.');adminToken=(await r.json()).token;}
  const response=await fetch(`${window.WORKSPACE_API}/workspace-admin${path}`,{method,cache:'no-store',headers:{Authorization:`Bearer ${adminToken}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(response.status===401&&retry){adminToken='';return api(path,method,body,false);}
  const data=await response.json();if(!response.ok)throw new Error(data.message||'تعذر تنفيذ الطلب');return data;
}
function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;$(select).append(o);}
async function page(kind,reset=false){
  if(reset)pages[kind]=null;
  const data=await api(`/directory?kind=${kind}${pages[kind]?`&after=${pages[kind]}`:''}`);
  pages[kind]=data.next_after;$(`more-${kind}`).hidden=!data.has_more;
  if(kind==='employees')for(const e of data.items.filter(e=>e.active&&e.identity_status==='approved'))option('employee',e.employee_id,`${e.english_display_name||e.name} — ${e.employee_id}`);
  if(kind==='accounts')for(const a of data.items)option('account',a.id,`${a.name} — ${a.active?(a.activated?'مفعل':'بانتظار التفعيل'):'معطل'}`);
  if(kind==='channels')for(const c of data.items){
    const label=document.createElement('label'),read=document.createElement('input'),write=document.createElement('input'),name=document.createElement('span');
    read.type=write.type='checkbox';read.dataset.channel=c.id;write.dataset.write=c.id;name.textContent=c.name+(c.closed?' (مغلقة)':'');write.disabled=c.closed;
    read.setAttribute('aria-label',`قراءة ${c.name}`);write.setAttribute('aria-label',`كتابة ${c.name}`);
    read.checked=savedGrants.has(String(c.id));write.checked=savedGrants.get(String(c.id))===true;
    label.append(read,name,write,document.createTextNode('السماح بالكتابة'));$('grants').append(label);
  }
}
async function currentGrants(){
  const id=$('account').value;savedGrants.clear();
  for(const input of document.querySelectorAll('#grants input'))input.checked=false;
  if(!id)return;
  const grants=await api(`/accounts/${id}/grants`);if($('account').value!==id)return;
  for(const g of grants){savedGrants.set(String(g.channel_id),g.can_post);const read=document.querySelector(`[data-channel="${g.channel_id}"]`),write=document.querySelector(`[data-write="${g.channel_id}"]`);if(read)read.checked=true;if(write)write.checked=g.can_post;}
}
async function load(){savedGrants.clear();$('employee').replaceChildren();$('account').replaceChildren();$('grants').replaceChildren();for(const kind of ['employees','accounts','channels'])await page(kind,true);await currentGrants();}
for(const kind of ['employees','accounts','channels'])$(`more-${kind}`).onclick=async()=>{const button=$(`more-${kind}`);button.disabled=true;try{await page(kind);}catch(e){status(e.message);}finally{button.disabled=false;}};
$('account').onchange=()=>currentGrants().catch(e=>status(e.message));
$('import').onclick=async()=>{try{if(!$('confirmed').checked)throw new Error('يلزم تأكيد مصدر البيانات');const file=$('directory').files[0];if(!file||file.size>1000000)throw new Error('اختر ملف JSON بحد أقصى 1 MB');const data=JSON.parse(await file.text());await api('/directory','POST',{...data,confirmed_odoo_export:true});await load();status('تم استيراد الدليل محليًا.');}catch(e){status(e.message);}};
$('invite').onclick=async()=>{try{const data=await api('/invites','POST',{employee_id:$('employee').value});$('inviteUrl').value=data.url;await load();status('تم إنشاء رابط تفعيل. اضبط صلاحيات الحساب قبل مشاركته.');}catch(e){status(e.message);}};
$('save').onclick=async()=>{try{
  // Preserve grants on channel pages that have not been loaded.
  for(const input of document.querySelectorAll('[data-channel]')){const id=input.dataset.channel;if(input.checked)savedGrants.set(id,document.querySelector(`[data-write="${id}"]`).checked);else savedGrants.delete(id);}
  const grants=Array.from(savedGrants,([channel_id,can_post])=>({channel_id,can_post}));await api(`/accounts/${$('account').value}/grants`,'PUT',{grants});status('تم حفظ صلاحيات القنوات.');
}catch(e){status(e.message);}};
$('disable').onclick=async()=>{if(!confirm('تعطيل الحساب وإلغاء جميع جلساته؟'))return;try{await api(`/accounts/${$('account').value}/disable`,'POST',{});await load();status('تم تعطيل الحساب.');}catch(e){status(e.message);}};
load().catch(e=>status(e.message));
