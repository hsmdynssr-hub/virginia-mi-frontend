'use strict';
const tr=key=>WorkspaceI18n.t(key);
const invite=new URLSearchParams(location.hash.slice(1)).get('invite');
history.replaceState(null,'',location.pathname);
document.getElementById('activate').onsubmit=async e=>{
  e.preventDefault();const status=document.getElementById('status'),password=document.getElementById('password'),confirm=document.getElementById('confirm');
  if(password.value!==confirm.value){status.textContent=tr('passwordMismatch');return;}
  const button=e.target.querySelector('button');button.disabled=true;
  try{const response=await fetch(`${window.WORKSPACE_API}/workspace/activate`,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite,password:password.value})});
    const data=await response.json();if(!response.ok)throw new Error(WorkspaceI18n.error(data.message,response.status));password.value='';confirm.value='';e.target.hidden=true;status.textContent=tr('activationDone');
  }catch(error){status.textContent=Object.values(WorkspaceLocales[WorkspaceI18n.language]).includes(error.message)?error.message:WorkspaceI18n.error(error.message,error.status);}finally{button.disabled=false;}
};

if(!/^[a-f0-9]{64}$/.test(invite||'')){document.querySelector('#activate button').disabled=true;document.getElementById('status').textContent=tr('errorInvite');}
window.addEventListener('workspace:language',()=>{if(!/^[a-f0-9]{64}$/.test(invite||''))document.getElementById('status').textContent=tr('errorInvite');else if(document.getElementById('activate').hidden)document.getElementById('status').textContent=tr('activationDone');});
