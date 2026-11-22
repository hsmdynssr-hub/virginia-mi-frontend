'use strict';
(()=>{
 let language='ar';
 function t(key,values={}){const template=window.WorkspaceLocales[language][key]??window.WorkspaceLocales.en[key]??key;return template.replace(/\{(\w+)\}/g,(_,k)=>String(values[k]??''));}
 function apply(){document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';
  document.title=document.getElementById('activate')?t('activateTitle'):document.body.classList.contains('admin-page')?t('adminTitle'):'Virginia Workspace';
  for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
  for(const el of document.querySelectorAll('[data-i18n-placeholder]'))el.placeholder=t(el.dataset.i18nPlaceholder);
  for(const el of document.querySelectorAll('[data-i18n-aria]'))el.setAttribute('aria-label',t(el.dataset.i18nAria));
  const toggle=document.getElementById('language');if(toggle)toggle.textContent=language==='ar'?'English':'العربية';
  for(const control of document.querySelectorAll('input,textarea,select'))control.setCustomValidity('');
 }
 function error(message,status){const s=String(message||'');if(/Invalid employee ID or password/.test(s))return t('errorCredentials');if(/login required/i.test(s)||status===401)return t('errorSession');if(/invitation|Invite|activation/i.test(s))return t('errorInvite');if(/Untrusted origin|CSRF/.test(s))return t('errorOrigin');if(/manager required/i.test(s))return t('errorManager');if(/Topic unavailable|closed topic/i.test(s))return t('errorTopic');if(/channel.*(unavailable|read-only)/i.test(s))return t('errorChannel');if(/conflict|version|already used|changed|different mentions/i.test(s)||status===409)return t('errorConflict');if(status===429)return t('errorRate');if(/Attachments are disabled/.test(s))return t('attachmentsDisabled');if(status===503)return t('errorStorage');if(status===403)return t('errorPermission');if(status===400||status===413)return t('errorValidation');if(/Failed to fetch|fetch failed|NetworkError/i.test(s))return t('errorNetwork');return t('errorGeneric');}
 function channel(name){if(name==='Quality & Cost Control')return t('qualityChannel');if(/^Department Heads\s*[—–-]\s*Management Discussions$/.test(name))return t('headsChannel');return name;}
 function date(value){const d=new Date(value);return Number.isNaN(d.valueOf())?t('dateInvalid'):new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short'}).format(d);}
 window.WorkspaceI18n={t,error,channel,date,get language(){return language;},set(value){if(!['ar','en'].includes(value))return;language=value;apply();window.dispatchEvent(new Event('workspace:language'));},apply};
 document.addEventListener('invalid',event=>event.target.setCustomValidity?.(t('errorValidation')),true);
 document.addEventListener('input',event=>event.target.setCustomValidity?.(''));
 document.addEventListener('change',event=>event.target.setCustomValidity?.(''));
 apply();const toggle=document.getElementById('language');if(toggle)toggle.onclick=()=>window.WorkspaceI18n.set(language==='ar'?'en':'ar');
})();
