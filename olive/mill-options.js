'use strict';
window.millOptionsUI=async function({el,esc,platforms,modes,companyId}){
 const receiving=!!el('sourceSite');let settings;
 function fill(id,rows,blank){const node=el(id);if(!node)return;const selected=node.value;node.innerHTML=`<option value="">${esc(blank)}</option>`+rows.map(row=>`<option value="${esc(row.code)}">${esc(row.name)}</option>`).join('');node.value=rows.some(row=>row.code===selected)?selected:'';}
 async function refresh(){const response=await apiGet('/olive/mill-reports/options',{companyId:companyId()});settings=response.data||response;
  for(const row of settings.sources)platforms[row.code]=row.name;for(const row of settings.modes)modes[row.code]=row.name;
  fill('millSource',settings.sources,'كل المصادر');fill('sourceSite',settings.sources,'اختر منصة المصدر');fill('arrivalMode',settings.modes,'اختر طريقة الوصول');
 }
 await refresh();if(!receiving||!settings.canManage)return;
 const dialog=document.createElement('dialog');dialog.className='mill-options-dialog';dialog.innerHTML='<form><h3 id="millOptionTitle"></h3><label>الاسم<input id="millOptionName" maxlength="180" required></label><p id="millOptionError" role="alert"></p><div class="mill-actions"><button class="btn" type="submit">حفظ</button><button class="btn gray" type="button" id="millOptionClose">إلغاء</button></div></form>';document.body.append(dialog);
 let kind,code,target,saving=false;
 el('millOptionClose').onclick=()=>{if(!saving)dialog.close();};dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
 for(const [id,list,label] of [['sourceSite','sources','منصة'],['arrivalMode','modes','طريقة وصول']]){
  const controls=document.createElement('div');controls.className='mill-option-actions';
  for(const editing of [false,true]){const button=document.createElement('button');button.type='button';button.className='btn gray';button.textContent=editing?'تعديل الاسم':'إضافة '+label;
   button.onclick=()=>{kind=list;target=id;code=editing?el(id).value:null;if(editing&&!code){el('millMessage').textContent='اختر '+label+' أولًا لتعديل اسمها';return;}
    el('millOptionTitle').textContent=(editing?'تعديل اسم ':'إضافة ')+label;el('millOptionName').value=editing?settings[list].find(row=>row.code===code).name:'';el('millOptionError').textContent='';dialog.showModal();el('millOptionName').focus();};controls.append(button);
  }el(id).after(controls);
 }
 dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();if(saving)return;saving=true;dialog.querySelectorAll('button').forEach(button=>button.disabled=true);
  try{const response=await apiPost('/olive/mill-reports/options/'+kind,{companyId:companyId(),code,name:el('millOptionName').value});const row=response.data||response;await refresh();el(target).value=row.code;dialog.close();el('millLoad').click();}
  catch(error){el('millOptionError').textContent=error.message;}finally{saving=false;dialog.querySelectorAll('button').forEach(button=>button.disabled=false);}
 };
};
