'use strict';
const $=id=>document.getElementById(id),pages={},savedGrants=new Map();
let adminToken='';
const tr=(key,values)=>WorkspaceI18n.t(key,values);
const savedRoles=new Map();
const status=text=>$('status').textContent=text;
const statusError=e=>status(Object.values(WorkspaceLocales[WorkspaceI18n.language]).includes(e.message)?e.message:WorkspaceI18n.error(e.message,e.status));
async function api(path='',method='GET',body,retry=true){
  // Existing MI browser session is HttpOnly. Its short-lived bearer stays in memory here.
  if(!adminToken){const r=await fetch(`${window.WORKSPACE_API}/auth/refresh`,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error(tr('errorAdminLogin'));adminToken=(await r.json()).token;}
  const response=await fetch(`${window.WORKSPACE_API}/workspace-admin${path}`,{method,cache:'no-store',headers:{Authorization:`Bearer ${adminToken}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(response.status===401&&retry){adminToken='';return api(path,method,body,false);}
  const data=await response.json();if(!response.ok)throw new Error(WorkspaceI18n.error(data.message,response.status));return data;
}
function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;$(select).append(o);return o;}
async function page(kind,reset=false){
  if(reset)pages[kind]=null;
  const data=await api(`/directory?kind=${kind}${pages[kind]?`&after=${pages[kind]}`:''}`);
  pages[kind]=data.next_after;$(`more-${kind}`).hidden=!data.has_more;
  if(kind==='employees')for(const e of data.items.filter(e=>e.active&&e.identity_status==='approved'))option('employee',e.employee_id,`${e.english_display_name||e.name} — ${e.employee_id}`);
  if(kind==='accounts')for(const a of data.items){const state=a.active?(a.activated?'activated':'awaitingActivation'):'disabled',o=option('account',a.id,`${a.name} — ${tr(state)}`);o.dataset.accountName=a.name;o.dataset.accountState=state;}
  if(kind==='channels')for(const c of data.items){
    const label=document.createElement('label'),read=document.createElement('input'),write=document.createElement('input'),name=document.createElement('span');
    read.type=write.type='checkbox';read.dataset.channel=c.id;write.dataset.write=c.id;name.dataset.channelName=c.name;name.dataset.closed=String(c.closed);name.textContent=WorkspaceI18n.channel(c.name)+(c.closed?' ('+tr('closed_pending_odoo_approval')+')':'');write.disabled=c.closed;
    read.setAttribute('aria-label',tr('channels')+' '+WorkspaceI18n.channel(c.name));write.setAttribute('aria-label',tr('canReply')+' '+WorkspaceI18n.channel(c.name));
    read.checked=savedGrants.has(String(c.id));write.checked=savedGrants.get(String(c.id))===true;
    const role=document.createElement('select');role.dataset.role=c.id;for(const code of ['participant','manager']){const o=document.createElement('option');o.value=code;o.textContent=tr(code);role.append(o);}role.value=savedRoles.get(String(c.id))||'participant';role.setAttribute('aria-label',tr('channelRole'));const replyLabel=document.createElement('span');replyLabel.dataset.i18n='canReply';replyLabel.textContent=tr('canReply');label.append(read,name,write,replyLabel,role);$('grants').append(label);
  }
}
async function currentGrants(){
  const id=$('account').value;savedGrants.clear();savedRoles.clear();
  for(const input of document.querySelectorAll('#grants input'))input.checked=false;for(const role of document.querySelectorAll('[data-role]'))role.value='participant';
  if(!id)return;
  const grants=await api(`/accounts/${id}/grants`);if($('account').value!==id)return;
  for(const g of grants){savedRoles.set(String(g.channel_id),g.channel_role);const role=document.querySelector(`[data-role="${g.channel_id}"]`);if(role)role.value=g.channel_role;savedGrants.set(String(g.channel_id),g.can_post);const read=document.querySelector(`[data-channel="${g.channel_id}"]`),write=document.querySelector(`[data-write="${g.channel_id}"]`);if(read)read.checked=true;if(write)write.checked=g.can_post;}
}
async function load(){savedGrants.clear();$('employee').replaceChildren();$('account').replaceChildren();$('grants').replaceChildren();for(const kind of ['employees','accounts','channels'])await page(kind,true);await currentGrants();}
for(const kind of ['employees','accounts','channels'])$(`more-${kind}`).onclick=async()=>{const button=$(`more-${kind}`);button.disabled=true;try{await page(kind);}catch(e){statusError(e);}finally{button.disabled=false;}};
$('account').onchange=()=>currentGrants().catch(e=>statusError(e));
$('import').onclick=async()=>{try{if(!$('confirmed').checked)throw new Error(tr('errorExport'));const file=$('directory').files[0];if(!file||file.size>1000000)throw new Error(tr('errorFile'));const data=JSON.parse(await file.text());await api('/directory','POST',{...data,confirmed_odoo_export:true});await load();status(tr('directoryImported'));}catch(e){statusError(e);}};
$('invite').onclick=async()=>{try{const data=await api('/invites','POST',{employee_id:$('employee').value});const inviteUrl=new URL(data.url);if(inviteUrl.origin!==location.origin||inviteUrl.pathname!=='/workspace/activate.html'||!/^#invite=[a-f0-9]{64}$/.test(inviteUrl.hash))throw new Error(tr('errorInvite'));$('inviteUrl').value=inviteUrl.href;await load();status(tr('inviteCreated'));}catch(e){statusError(e);}};
$('save').onclick=async()=>{try{
  // Preserve grants on channel pages that have not been loaded.
  for(const input of document.querySelectorAll('[data-channel]')){const id=input.dataset.channel;if(input.checked){savedGrants.set(id,document.querySelector(`[data-write="${id}"]`).checked);savedRoles.set(id,document.querySelector(`[data-role="${id}"]`).value);}else{savedGrants.delete(id);savedRoles.delete(id);}}
  const grants=Array.from(savedGrants,([channel_id,can_post])=>({channel_id,can_post,channel_role:savedRoles.get(String(channel_id))||'participant'}));await api(`/accounts/${$('account').value}/grants`,'PUT',{grants});status(tr('grantsSaved'));
}catch(e){statusError(e);}};
$('disable').onclick=async()=>{if(!confirm(tr('confirmDisable')))return;try{await api(`/accounts/${$('account').value}/disable`,'POST',{});await load();status(tr('accountDisabled'));}catch(e){statusError(e);}};
load().catch(e=>statusError(e));

window.addEventListener('workspace:language',()=>{for(const o of $('account').options)if(o.dataset.accountName)o.textContent=o.dataset.accountName+' — '+tr(o.dataset.accountState);for(const role of document.querySelectorAll('[data-role]')){role.setAttribute('aria-label',tr('channelRole'));for(const o of role.options)o.textContent=tr(o.value);}for(const name of document.querySelectorAll('[data-channel-name]'))name.textContent=WorkspaceI18n.channel(name.dataset.channelName)+(name.dataset.closed==='true'?' ('+tr('closed_pending_odoo_approval')+')':'');WorkspaceI18n.apply();});
