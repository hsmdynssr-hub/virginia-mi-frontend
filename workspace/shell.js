'use strict';
(()=>{
 const get=id=>document.getElementById(id),i18n=WorkspaceI18n;
 function sidebar(open){document.body.classList.toggle('channels-open',open);get('sidebarBackdrop').hidden=!open;get('toggleChannels').setAttribute('aria-expanded',String(open));}
 get('toggleChannels').onclick=()=>sidebar(!document.body.classList.contains('channels-open'));
 get('closeChannels').onclick=get('sidebarBackdrop').onclick=()=>sidebar(false);
 function bell(open){get('notificationsPanel').hidden=!open;get('bell').setAttribute('aria-expanded',String(open));if(open)window.WorkspaceCollaboration?.notifications();}
 get('bell').onclick=()=>bell(get('notificationsPanel').hidden);get('closeNotifications').onclick=()=>bell(false);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){sidebar(false);bell(false);}});
 get('cancelTopic').onclick=()=>get('topicForm').hidden=true;get('cancelDecision').onclick=()=>get('decisionForm').hidden=true;
 function render(){
  const list=get('channelList');list.replaceChildren();for(const channel of channels){const b=document.createElement('button'),mark=document.createElement('span'),text=document.createElement('span');b.type='button';b.className='channel-button'+(String(channel.id)===get('channel').value?' active':'');mark.className='channel-mark';mark.textContent='#';text.textContent=i18n.channel(channel.name);b.append(mark,text);b.onclick=()=>{get('channel').value=channel.id;get('channel').dispatchEvent(new Event('change'));sidebar(false);};b.setAttribute('aria-current',String(channel.id)===get('channel').value?'page':'false');list.append(b);}
  const selected=channels.find(c=>String(c.id)===get('channel').value);for(const id of ['channelTitle','channelCaption'])get(id).textContent=selected?i18n.channel(selected.name):'';
  for(const option of get('channel').options){const c=channels.find(c=>String(c.id)===option.value);if(c)option.textContent=i18n.channel(c.name);}
  const topics=get('topicList');topics.replaceChildren();for(const option of get('topicSelect').options){const b=document.createElement('button'),title=document.createElement('strong'),state=document.createElement('small'),t=topicRows.find(t=>String(t.id)===option.value);b.type='button';b.className='topic-button'+(get('topicSelect').value===option.value?' active':'');title.textContent=t?.name||i18n.t('archive');state.textContent=t?i18n.t(t.status):'';b.append(title,state);b.onclick=()=>{get('topicSelect').value=option.value;get('topicSelect').dispatchEvent(new Event('change'));};topics.append(b);}
  get('messages').dataset.empty=i18n.t('emptyMessages');
 }
 window.WorkspaceShell={render,sidebar,bell};window.addEventListener('workspace:render',render);window.addEventListener('workspace:language',render);
 function viewport(){document.documentElement.style.setProperty('--viewport-height',(window.visualViewport?.height||innerHeight)+'px');}
 window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);viewport();render();
})();
