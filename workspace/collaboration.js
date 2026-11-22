'use strict';
(()=>{
 const el=id=>document.getElementById(id),drafts=new Map(),names=new Map(),notificationItems=new Map();
 let active='',ids=[],searchToken=0,notificationCursor=null,notificationLoading=false,notificationMore=false;
 const key=()=>`${el('channel').value}:${currentTopic?.id||''}`,root=()=>`/channels/${el('channel').value}/topics/${currentTopic.id}`;
 function selectedText(){el('selectedMentions').textContent=ids.map(id=>'@'+(names.get(String(id))||'')).join(' · ');}
 function changing(){if(active)drafts.set(active,{body:el('body').value,ids:[...ids]});el('body').value='';ids=[];selectedText();el('mentionResults').replaceChildren();el('attachmentFile').value='';searchToken++;}
 async function selected(){const next=key();if(active!==next){active=next;ids=drafts.get(active)?.ids||[];el('body').value=drafts.get(active)?.body||'';selectedText();}el('topicMention').replaceChildren();for(const m of el('followUp').options){names.set(String(m.value),m.textContent);const o=document.createElement('option');o.value=m.value;o.textContent=m.textContent;el('topicMention').append(o);}el('attachmentsPanel').hidden=true;await notifications();}
 async function search(){const match=el('body').value.match(/(?:^|\s)@([^@\n]*)$/),token=++searchToken;el('mentionResults').replaceChildren();if(!match||!currentTopic)return;const gen=generation,rows=await api(root()+'/mention-search?q='+encodeURIComponent(match[1].slice(0,80)));if(token!==searchToken||gen!==generation)return;for(const member of rows){const b=document.createElement('button');b.type='button';b.textContent=member.english_display_name;b.onclick=()=>{names.set(String(member.employee_id),member.english_display_name);if(!ids.map(String).includes(String(member.employee_id)))ids.push(member.employee_id);el('body').value=el('body').value.replace(/@[^@\n]*$/,'@'+member.english_display_name+' ');el('mentionResults').replaceChildren();selectedText();el('body').focus();};el('mentionResults').append(b);}}
 async function sent(message,gen){if(gen!==generation)return;ids=[];drafts.delete(active);selectedText();}
 function renderNotifications(){
  const t=WorkspaceI18n.t;el('notifications').replaceChildren();const items=Array.from(notificationItems.values()).sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:1);
  const unread=items.filter(n=>!n.read_at).length;el('unreadCount').hidden=unread===0;el('unreadCount').textContent=String(unread)+(notificationMore?'+':'');el('unreadCount').setAttribute('aria-label',t(notificationMore?'unreadPartial':'unreadSummary',{count:unread}));el('notificationSummary').textContent=items.length?t(notificationMore?'unreadPartial':'unreadSummary',{count:unread}):t('emptyNotifications');
  for(const n of items){const p=document.createElement('article'),open=document.createElement('button'),label=document.createElement('span'),title=document.createElement('small'),read=document.createElement('button');p.dataset.id=n.id;p.className=n.read_at?'':'unread';open.type=read.type='button';label.textContent=t('notification.'+n.kind);title.textContent=n.topic_name;open.append(label,title);read.textContent=t(n.read_at?'read':'markRead');read.disabled=!!n.read_at;
   read.onclick=async()=>{try{const updated=await api('/notifications/'+n.id+'/read','POST',{});if(!notificationItems.has(String(n.id)))return;n.read_at=updated.read_at||new Date().toISOString();renderNotifications();}catch(e){statusError(e);}};
   open.onclick=async()=>{try{changing();el('channel').value=n.channel_id;await selectChannel();let t=topicRows.find(t=>String(t.id)===String(n.topic_id));if(!t){t=await api(`/channels/${n.channel_id}/topics/${n.topic_id}`);topicRows.push(t);const o=document.createElement('option');o.value=t.id;o.textContent=t.name;el('topicSelect').append(o);}el('topicSelect').value=n.topic_id;await el('topicSelect').onchange();window.WorkspaceShell?.bell(false);}catch(e){statusError(e);}};
   p.append(open,read);el('notifications').append(p);
  }el('olderNotifications').hidden=!notificationMore;
 }
 async function notifications(older=false){
  if(notificationLoading||el('workspace').hidden)return;notificationLoading=true;const token=generation;
  const knownNewest=Array.from(notificationItems.keys()).sort((a,b)=>BigInt(a)>BigInt(b)?-1:1)[0];
  const merge=page=>{for(const n of page.items){const previous=notificationItems.get(String(n.id));if(previous?.read_at&&!n.read_at)n.read_at=previous.read_at;notificationItems.set(String(n.id),n);}};
  try{
   const first=await api('/notifications'+(older&&notificationCursor?'?before='+notificationCursor:''));if(token!==generation||el('workspace').hidden)return;merge(first);
   if(older||!notificationCursor){notificationCursor=first.next_before;notificationMore=first.has_more;}
   // The API exposes before cursors only. Drain a new burst back to our known
   // newest item so more than 50 arrivals cannot leave a gap in the loaded list.
   let page=first;
   while(!older&&knownNewest&&page.has_more&&page.items.length&&BigInt(page.items.at(-1).id)>BigInt(knownNewest)){
    const before=page.next_before;if(!before)break;
    page=await api('/notifications?before='+before);if(token!==generation||el('workspace').hidden)return;merge(page);
   }
   renderNotifications();
  }catch(e){statusError(e);}finally{notificationLoading=false;}
 }
 el('body').addEventListener('input',()=>search().catch(statusError));for(const id of ['channel','topicSelect'])el(id).addEventListener('change',changing);
 el('clearMentions').onclick=()=>{ids=[];selectedText();};el('refreshNotifications').onclick=()=>notifications();el('olderNotifications').onclick=()=>notifications(true);
 el('refreshAttachments').onclick=el('moreAttachments').onclick=()=>status(WorkspaceI18n.t('attachmentsDisabled'));
 function clear(){drafts.clear();active='';ids=[];names.clear();notificationItems.clear();notificationCursor=null;notificationMore=false;searchToken++;for(const id of ['notifications','attachments','mentionResults','topicMention'])el(id).replaceChildren();el('body').value='';el('attachmentFile').value='';el('notificationsPanel').hidden=true;el('unreadCount').hidden=true;selectedText();}
 window.WorkspaceCollaboration={clear,selected,mentions:()=>[...ids].sort(),sent,notifications};
 window.addEventListener('workspace:language',()=>{renderNotifications();selectedText();});
 setInterval(()=>{if(!document.hidden)void notifications();},5000);
})();
