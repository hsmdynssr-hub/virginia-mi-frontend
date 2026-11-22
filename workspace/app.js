'use strict';
const $=id=>document.getElementById(id);
const messageRequests=new Map();
let csrf='',channels=[],request=null,promptEvent,generation=0,historyState=null,loadingOlder=false,polling=false,initializing=false;
let currentTopic=null,topicRows=[],topicCursor=null,topicRequest=null,topicPageRequest=0;
const status=text=>$('status').textContent=text;
async function api(path,method='GET',body){
  const response=await fetch(`${window.WORKSPACE_API}/workspace${path}`,{method,credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-Workspace-CSRF':csrf},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok){if(response.status===401){generation++;csrf='';$('workspace').hidden=true;$('messages').replaceChildren();$('loginSection').hidden=false;$('identity').textContent='';historyState=null;messageRequests.clear();window.WorkspaceCollaboration?.clear();}throw new Error(data.message||'تعذر تنفيذ الطلب');}return data;
}
function article(m){
  const node=document.createElement('article'),name=document.createElement('strong'),body=document.createElement('p'),meta=document.createElement('small');
  node.dataset.id=m.id;name.textContent=m.english_display_name||m.name;body.className='body';body.textContent=m.body;
  meta.textContent=`${new Date(m.created_at).toLocaleString('ar')} · ${m.status==='synced'?'تم تأكيد الحفظ في Odoo':'محفوظ في Workspace · لم يتم تأكيد الحفظ في Odoo'}`;
  node.append(name,body,meta);return node;
}
async function selectDiscussion(){
  const current=++generation,id=$('channel').value,c=channels.find(c=>String(c.id)===id);
  initializing=true;loadingOlder=false;polling=false;historyState=WorkspacePagination.createHistory();$('messages').replaceChildren();$('older').hidden=true;
  $('compose').hidden=!c?.can_post||c?.closed||(c?.topics_required&&!currentTopic)||!!currentTopic?.closed;
  if(!id){initializing=false;status('لم تُمنح صلاحية لأي قناة بعد. تواصل مع المسؤول.');return;}
  try{const page=await api(messagePath());if(current!==generation)return;
    $('messages').append(...historyState.merge(page,'initial').map(article));$('older').hidden=!historyState.hasOlder;
    $('messages').scrollTop=$('messages').scrollHeight;window.WorkspaceCollaboration?.selected();
  }finally{if(current===generation)initializing=false;}
}
async function older(){
  if(initializing||loadingOlder||!historyState?.hasOlder||!historyState.oldest)return;
  loadingOlder=true;const current=generation,id=$('channel').value;const box=$('messages');
  try{const page=await api(`${messagePath()}?before=${historyState.oldest}`);if(current!==generation)return;
    const oldHeight=box.scrollHeight,oldTop=box.scrollTop;box.prepend(...historyState.merge(page,'older').map(article));
    box.scrollTop=WorkspacePagination.anchoredScroll(oldHeight,oldTop,box.scrollHeight);$('older').hidden=!historyState.hasOlder;
  }finally{if(current===generation)loadingOlder=false;}
}
async function newer(){
  if(initializing||polling||!historyState||$('workspace').hidden)return;
  const current=generation;
  if(!historyState.newest){await refreshTopic(current);if(current!==generation)return;return selectDiscussion();}
  polling=true;
  try{await refreshTopic(current);let more=true;while(more&&current===generation){const page=await api(`${messagePath()}?after=${historyState.newest}`);if(current!==generation)return;
    const box=$('messages'),atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<80;
    box.append(...historyState.merge(page,'newer').map(article));if(atBottom)box.scrollTop=box.scrollHeight;
    more=page.has_more;if(!page.items.length)break;
  }}finally{if(current===generation)polling=false;}
}
async function load(){
  const data=await api('/me');csrf=data.user.csrf;$('identity').textContent=data.user.english_display_name||data.user.name;
  $('loginSection').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;
  channels=await api('/channels');$('channel').replaceChildren();for(const c of channels){const option=document.createElement('option');option.value=c.id;option.textContent=c.name;$('channel').append(option);}
  await selectChannel();
}
$('login').onsubmit=async e=>{e.preventDefault();try{await api('/login','POST',{employee_id:$('employee').value,password:$('password').value});$('password').value='';status('');await load();}catch(error){status(error.message);}};
$('logout').onclick=async()=>{try{await api('/logout','POST',{});csrf='';generation++;historyState=null;$('messages').replaceChildren();location.reload();}catch(error){status(error.message);}};
$('refresh').onclick=()=>newer().catch(e=>status(e.message));
$('channel').onchange=()=>{request=null;selectChannel().catch(e=>status(e.message));};
$('older').onclick=()=>older().catch(e=>status(e.message));
$('messages').addEventListener('scroll',()=>{if($('messages').scrollTop<40)older().catch(e=>status(e.message));});
$('compose').onsubmit=async e=>{
  e.preventDefault();let body=$('body').value.trim();if(!body&&$('attachmentFile')?.files?.length)body='Attachment';const channel=$('channel').value,current=generation;if(!body)return;
  const draftKey=channel+':'+(currentTopic?.id||'');request=messageRequests.get(draftKey)||null;
  if(!request||request.body!==body||request.channel!==channel||request.topic!==currentTopic?.id||JSON.stringify(request.mentions)!==JSON.stringify(window.WorkspaceCollaboration?.mentions()||[]))request={body,channel,topic:currentTopic?.id,mentions:window.WorkspaceCollaboration?.mentions()||[],id:crypto.randomUUID()};
  messageRequests.set(draftKey,request);$('send').disabled=true;
  try{const sent=await api(messagePath(),'POST',{body,mentions:request.mentions,request_id:request.id,...(currentTopic?{topic_id:currentTopic.id}:{})});if(current!==generation)return;
    await window.WorkspaceCollaboration?.sent(sent,current);if(current!==generation)return;$('body').value='';messageRequests.delete(draftKey);request=null;status('حُفظت الرسالة في Workspace. لم تُرسل إلى Odoo بعد.');await newer();
  }catch(error){status(error.message+' — يمكنك إعادة المحاولة بنفس النص.');}finally{$('send').disabled=false;}
};
setInterval(()=>{if(!document.hidden)newer().catch(e=>status(e.message));},5000);

const labels={open:'Open',under_discussion:'Under Discussion',pending_decision:'Pending Decision',closed_pending_odoo_approval:'Closed Locally — Not Yet Recorded in Odoo'};
function messagePath(){return `/channels/${$('channel').value}${currentTopic?`/topics/${currentTopic.id}`:''}/messages`;}
function renderTopic(){
 const c=channels.find(c=>String(c.id)===$('channel').value),manager=c?.channel_role==='manager'&&c.can_post&&!c.closed;
 $('topicName').textContent=currentTopic?.name||'أرشيف القناة — للقراءة فقط';$('topicReference').textContent=currentTopic?.reference||'';
 $('topicDescriptionView').textContent=currentTopic?.description||'';$('topicState').textContent=currentTopic?labels[currentTopic.status]:'';
 $('newTopic').hidden=!manager||!c?.topics_required;$('closeTopic').hidden=!manager||!currentTopic||currentTopic.closed;
 $('advanceTopic').hidden=!manager||!currentTopic||!['open','under_discussion'].includes(currentTopic.status);
 $('advanceTopic').textContent=currentTopic?.status==='open'?'Under Discussion':'Pending Decision';
 $('compose').hidden=!c?.can_post||c?.closed||(c?.topics_required&&!currentTopic)||!!currentTopic?.closed;
 $('decisionView').hidden=!currentTopic?.closed;
 $('decisionView').textContent=currentTopic?.closed?`ملخص القرار: ${currentTopic.decision_summary||''}\nمسؤول المتابعة: ${currentTopic.follow_up_name||currentTopic.follow_up_employee_id}\nأغلقه الموظف: ${currentTopic.closed_by}\nتاريخ الإغلاق: ${new Date(currentTopic.closed_at).toLocaleString('ar')}\nClosed Locally — Not Yet Recorded in Odoo`:'';
 if(currentTopic?.closed)$('decisionForm').hidden=true;
}
async function refreshTopic(expected=generation){
 if(!currentTopic)return;const id=currentTopic.id,data=await api(`/channels/${$('channel').value}/topics/${id}`);
 if(expected!==generation||currentTopic?.id!==id)return;currentTopic=data;renderTopic();const option=Array.from($('topicSelect').options||[]).find(o=>o.value===id);if(option)option.textContent=`${data.name} · ${labels[data.status]}`;
}
async function topicPage(reset=false){
 const channel=$('channel').value,token=generation,pageToken=++topicPageRequest;
 const page=await api(`/channels/${channel}/topics${!reset&&topicCursor?`?before=${topicCursor}`:''}`);
 if(channel!==$('channel').value||token!==generation||pageToken!==topicPageRequest)return;
 if(reset){topicRows=[];$('topicSelect').replaceChildren();const option=document.createElement('option');option.value='';option.textContent='أرشيف القناة السابق (قراءة فقط)';$('topicSelect').append(option);}
 for(const t of page.items){topicRows.push(t);const option=document.createElement('option');option.value=t.id;option.textContent=`${t.name} · ${labels[t.status]}`;$('topicSelect').append(option);}
 topicCursor=page.next_before;$('moreTopics').hidden=!page.has_more;
}
async function selectChannel(){
 const token=++generation,c=channels.find(c=>String(c.id)===$('channel').value);initializing=true;currentTopic=null;historyState=null;$('messages').replaceChildren();$('compose').hidden=true;
 $('topicPanel').hidden=!c?.topics_required;$('topicForm').hidden=true;$('decisionForm').hidden=true;$('decisionSummary').value='';
 if(c?.topics_required){await topicPage(true);if(token!==generation)return;
  const members=await api(`/channels/${c.id}/members`);if(token!==generation)return;$('followUp').replaceChildren();
  for(const member of members){const o=document.createElement('option');o.value=member.employee_id;o.textContent=member.english_display_name||member.name;$('followUp').append(o);}
  if(topicRows.length){$('topicSelect').value=topicRows[0].id;currentTopic=await api(`/channels/${c.id}/topics/${topicRows[0].id}`);if(token!==generation)return;}
 }
 renderTopic();await selectDiscussion();
}
$('topicSelect').onchange=async()=>{const token=++generation;request=null;currentTopic=null;initializing=true;historyState=null;$('messages').replaceChildren();$('compose').hidden=true;$('decisionForm').hidden=true;
 try{if($('topicSelect').value){const t=await api(`/channels/${$('channel').value}/topics/${$('topicSelect').value}`);if(token!==generation)return;currentTopic=t;}renderTopic();await selectDiscussion();}catch(e){status(e.message);}
};
$('moreTopics').onclick=()=>topicPage().catch(e=>status(e.message));
$('newTopic').onclick=()=>{$('topicForm').hidden=!$('topicForm').hidden;};
$('topicForm').onsubmit=async e=>{e.preventDefault();const title=$('topicTitle').value.trim(),description=$('topicDescription').value.trim(),channel=$('channel').value;
 if(!topicRequest||topicRequest.title!==title||topicRequest.description!==description||topicRequest.channel!==channel)topicRequest={title,description,channel,id:crypto.randomUUID()};
 try{const t=await api(`/channels/${channel}/topics`,'POST',{title,description,request_id:topicRequest.id,mentions:Array.from($('topicMention')?.selectedOptions||[],o=>o.value)});topicRequest=null;$('topicForm').hidden=true;$('topicTitle').value='';$('topicDescription').value='';
  if(channel!==$('channel').value)return;await topicPage(true);$('topicSelect').value=t.id;currentTopic=t;renderTopic();await selectDiscussion();status('تم إنشاء موضوع رسمي محلي.');
 }catch(error){status(error.message);}
};
$('advanceTopic').onclick=async()=>{if(!currentTopic)return;try{await api(`/channels/${$('channel').value}/topics/${currentTopic.id}/status`,'POST',{version:currentTopic.version,status:currentTopic.status==='open'?'under_discussion':'pending_decision'});await refreshTopic();}catch(e){status(e.message);await refreshTopic();}};
$('closeTopic').onclick=()=>{$('decisionForm').hidden=false;};
$('decisionForm').onsubmit=async e=>{e.preventDefault();if(!currentTopic)return;try{await api(`/channels/${$('channel').value}/topics/${currentTopic.id}/close`,'POST',{version:currentTopic.version,decision_summary:$('decisionSummary').value,follow_up_employee_id:$('followUp').value});await refreshTopic();status('Closed Locally — Not Yet Recorded in Odoo');}catch(error){status(error.message);await refreshTopic();}};

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;$('install').hidden=false;});
$('install').onclick=async()=>{if(promptEvent){await promptEvent.prompt();promptEvent=null;$('install').hidden=true;}};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{scope:'/workspace/'}).catch(()=>{});
load().catch(error=>{if(!error.message.includes('login required'))status(error.message);});
