"use strict";
(() => {
 const el=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const currency=v=>new Intl.NumberFormat('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0));
 const categoryLabels={COMMISSION:'عمولة',TRANSPORT:'نقل وشحن',LABOR:'عمالة',MEALS:'وجبات',OPERATING:'تشغيل وانتقالات',EXTERNAL_PURCHASE:'شراء خارجي',EXTERNAL_ADVANCE:'عهدة خارجية',OTHER:'مصروف آخر'};
 function expenseFields(){document.querySelectorAll('.expense-field').forEach(e=>e.hidden=el('cashKind').value!=='EXPENSE');}
 const company=()=>Number(getCompanyId()||1);
 function storageIdentity(){try{const user=JSON.parse(localStorage.getItem('user')||'{}');if(user.id!=null)return String(user.id);}catch(_){}return getToken()||'';}
 const scope=()=>`olive-cash-request:${company()}:${storageIdentity()}`;
 const adminPage=window.OLIVE_CASH_ADMIN===true;let lastClosed=null;
 let own=null,view=null,all=[],userId='',admin=false,busy=false,pending=null,selected='',loadVersion=0;
 const requestKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
 const message=(text,error=false)=>{el('cashMessage').textContent=text;el('cashMessage').className='msg '+(error?'err':'ok');};
 function receiptPending(){return window.OliveReceiptState?.hasPending()||window.OliveReceiptState?.isSaving()||window.OliveAdvancedState?.hasPending();}
 function refreshSave(){window.OliveReceiptState?.refreshButton();}
 function operationState(){
  for(const id of ['cashOpen','cashClose','cashMove','cashRefresh','cashChoose'])el(id).disabled=busy||!!pending;
  el('cashRetry').hidden=!pending;el('cashRetry').disabled=busy;

 }
 let panelSession=null;
 function setPanel(open){const panel=el('cashPanel');if(!panel)return;panel.hidden=!open;el('cashToggle').setAttribute('aria-expanded',String(open));el('cashToggle').textContent=open?'إخفاء التفاصيل':'تفاصيل الجلسة';}
 function render(){
  el('cashOwn').textContent=adminPage?'مراجعة الجلسات والدعم والمصروفات والإغلاق':own?`جلسة فواتيرك: #${own.id} — ${own.site_code}`:'لا توجد جلسة مفتوحة لفواتيرك في هذا الموقع';
  el('siteCode').readOnly=!!own||receiptPending();
  el('cashOpenBox').hidden=adminPage||!!own;
  if(el('cashLedgerBox'))el('cashLedgerBox').hidden=false;
  if(el('cashReviewBox'))el('cashReviewBox').hidden=!adminPage;
  if(el('advancedLink'))el('advancedLink').hidden=!admin;
  el('cashChoose').innerHTML='<option value="">اختر جلسة للمراجعة</option>'+all.map(s=>`<option value="${esc(s.id)}">#${esc(s.id)} · ${esc(s.owner_name)} · ${esc(s.site_code)} · ${s.status==='OPEN'?'مفتوحة':'مغلقة'}</option>`).join('');
  el('cashChoose').value=selected;
  el('cashDetails').hidden=!view;
  el('cashCloseBox').hidden=!view||view.status!=='OPEN';
  el('cashMoveBox').hidden=!view||view.status!=='OPEN';
  const funding=el('cashKind').querySelector('[value=FUNDING]');funding.hidden=!admin;funding.disabled=!admin;if(!admin)el('cashKind').value='EXPENSE';expenseFields();
  if(view){
   const x=view.summary;
   if(el('cashCompactBalance')){el('cashCompactBalance').textContent=currency(x.expected_amount)+' جنيه';if(panelSession!==String(view.id)){setPanel(false);panelSession=String(view.id);}}
   el('cashHeading').textContent=`جلسة #${view.id} — ${view.owner_name} — ${view.site_code} — ${view.status==='OPEN'?'مفتوحة':'مغلقة'}`;
   el('cashTimes').textContent=`فتح: ${new Date(view.opened_at).toLocaleString('ar-EG')}`+(view.closed_at?` | إغلاق: ${new Date(view.closed_at).toLocaleString('ar-EG')} | بواسطة: ${view.closed_by}`:'');
   const cards=[['عدد الفواتير الفعالة',x.invoice_count,false],['إجمالي الفواتير الفعالة',x.invoices_total,true],['الرصيد الافتتاحي',x.opening_amount,true],['دعم العهدة',x.funding_total,true],['المدفوع نقديًا للموردين',x.cash_paid,true],['المصروفات / السحب',x.expenses_total,true],['المتبقي المحسوب',x.expected_amount,true],['مدفوعات غير نقدية',x.noncash_paid,true]];
   if(view.status==='CLOSED')cards.push(['النقدية الفعلية',x.actual_amount,true],['فرق النقدية',x.difference,true]);
   el('cashSummary').innerHTML=cards.map(([label,value,money])=>`<div class="cash-stat report-kpi-card"><small>${label}</small><strong>${money?currency(value):esc(value||0)}</strong></div>`).join('');
   el('cashWarning').textContent=Number(x.expected_amount)<0?'الرصيد المحسوب سالب؛ راجع الافتتاحي وحركات الدعم والسداد.':Number(x.cancelled_count)>0?`يوجد ${x.cancelled_count} سند ملغى. إلغاء السند لا يُرجع النقدية تلقائيًا؛ سجل رجوعها كدعم مع مستند.`:'';
   el('cashSnapshot').textContent=view.status==='CLOSED'?`الملخص محفوظ عند الإغلاق. ${view.close_note||''}`:'المتبقي = الافتتاحي + الدعم − السداد النقدي − المصروفات. التحويلات والشيكات لا تخصم من النقدية.';
   el('cashMovements').innerHTML=(view.movements||[]).map(m=>`<tr><td>${m.kind==='FUNDING'?'دعم':'مصروف / سحب'}</td><td>${currency(m.amount)}</td><td>${esc(categoryLabels[m.expense_category]|| (m.kind==='FUNDING'?'دعم عهدة':'غير مصنف — يحتاج مراجعة'))}<br>${esc(m.beneficiary||'')}<br><small>${esc(m.reference_no||'')} ${esc(m.expense_date||'')}</small></td><td>${esc(m.reason)}</td><td>${esc(m.created_by)}<br><small>${esc(new Date(m.created_at).toLocaleString('ar-EG'))}</small></td><td>${m.attachments.map(a=>`<button type="button" class="cash-document" data-attachment="${esc(a.id)}">${esc(a.file_name)}</button>`).join(' ')}</td></tr>`).join('')||'<tr><td colspan="6">لا توجد حركات دعم أو مصروفات</td></tr>';
  }
  if(el('cashPanel')){if(!view||pending)setPanel(true);el('cashExpenseShortcut').hidden=!view||view.status!=='OPEN';}
  operationState();refreshSave();
 }
 async function refresh(){
  const revision=++loadVersion;
  const result=await apiGet('/olive/cash-sessions',{companyId:company()});if(revision!==loadVersion)return;
  const data=result.data||result;all=data.sessions;userId=String(data.currentUserId);admin=data.canManageCash===true;
  const site=el('siteCode').value.trim()||'MAIN';own=all.find(s=>String(s.owner_id)===userId&&s.site_code===site&&s.status==='OPEN')||null;
  if(!adminPage)selected=String(own?.id||lastClosed?.id||'');
  if(adminPage&&(!selected||!all.some(s=>String(s.id)===selected)))selected=String(own?.id||all[0]?.id||'');
  if(selected){const r=await apiGet('/olive/cash-sessions/'+selected,{companyId:company()});if(revision!==loadVersion)return;view=r.data||r;}else view=null;
  render();
 }
 async function sendPending(){
  if(!pending||busy)return;
  if(receiptPending()){message('أكمل طلب حفظ الفاتورة أولًا قبل أي حركة أو إغلاق.',true);return;}
  busy=true;operationState();
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
   let r;
   try {
    const response=await fetch(`${window.API_BASE_URL||'https://api.mi.virginiaolive.com/api'}${pending.path}`,{method:'POST',headers:getAuthHeaders(),body:JSON.stringify(pending.body),signal:controller.signal});
    r=await response.json();
    if(!response.ok){const error=new Error(r.message||r.error||'تعذر تنفيذ العملية');error.status=response.status;throw error;}
   } finally {clearTimeout(timer);}
   const data=r.data||r;
   if(pending.type==='open')selected=String(data.id);
   if(pending.type==='close'&&!adminPage)lastClosed=data;
   sessionStorage.removeItem(scope());pending=null;
   el('cashCategory').value='';el('cashBeneficiary').value='';el('cashReference').value='';el('cashAmount').value='';el('cashReason').value='';el('cashFiles').value='';el('cashActual').value='';el('cashCloseNote').value='';
   message('تم تسجيل العملية بنجاح');
   try{await refresh()}catch(e){message('تم تسجيل العملية، لكن تحديث الملخص تعذر. اضغط تحديث.',true);}
  }catch(e){
   // Definitive validation/conflict replies cannot have committed a new operation.
   // Keep ambiguous network/server failures for safe replay.
   const code=Number(e.statusCode||e.status);
   if([400,403,404,409,413].includes(code)){sessionStorage.removeItem(scope());pending=null;}
   message(e.message||'تعذر تأكيد العملية؛ أعد نفس الطلب',true);
  }finally{busy=false;operationState();refreshSave();}
 }
 async function submit(type,body){
  if(busy||pending)return;
  if(receiptPending()){message('أكمل طلب حفظ الفاتورة أولًا قبل أي حركة أو إغلاق.',true);return;}
  const path=type==='open'?'/olive/cash-sessions':`/olive/cash-sessions/${view.id}/${type==='close'?'close':'movements'}`;
  const value={type,path,body:{...body,companyId:company(),requestKey:requestKey()}};
  sessionStorage.setItem(scope(),JSON.stringify(value));pending=value;await sendPending();
 }
 async function readFiles(){
  const files=Array.from(el('cashFiles').files||[]);if(!files.length||files.length>3)throw Error('أرفق من مستند واحد إلى ثلاثة مستندات');
  if(files.reduce((n,f)=>n+f.size,0)>12*1024*1024)throw Error('إجمالي المرفقات أكبر من 12MB');
  return Promise.all(files.map(file=>new Promise((resolve,reject)=>{
   if(file.size>5*1024*1024){reject(Error('المرفق أكبر من 5MB'));return;}
   if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)){reject(Error('استخدم صورة أو PDF'));return;}
   const reader=new FileReader();reader.onerror=()=>reject(Error('تعذرت قراءة المرفق'));reader.onload=()=>resolve({fileName:file.name,mimeType:file.type,base64:String(reader.result).split(',')[1]});reader.readAsDataURL(file);
  })));
 }
 const nonnegative=value=>{if(!/^\d{1,16}(\.\d{1,2})?$/.test(String(value)))throw Error('راجع المبلغ؛ بحد أقصى منزلتين عشريتين');return value;};
 function run(fn){return async()=>{try{await fn()}catch(e){message(e.message||'تعذر تنفيذ العملية',true)}};}
 async function init(){
  if(el('cashToggle')){el('cashToggle').onclick=()=>setPanel(el('cashPanel').hidden);el('cashExpenseShortcut').onclick=()=>{setPanel(true);el('cashKind').value='EXPENSE';expenseFields();el('cashAmount').focus({preventScroll:true});};}
  const initialCompany=String(company());window.addEventListener('company-context-changed',()=>{if(receiptPending()||pending||busy){setCompanyId(initialCompany);const select=el('companySelect');if(select)select.value=initialCompany;message('أكمل الطلب الحالي قبل تغيير الشركة',true);}else location.reload();});
  el('cashOpen').onclick=run(()=>submit('open',{siteCode:el('siteCode').value.trim()||'MAIN',openingAmount:nonnegative(el('cashOpening').value)}));
  el('cashClose').onclick=run(()=>{
   const actual=nonnegative(el('cashActual').value),note=el('cashCloseNote').value.trim();
   if(Number(actual)!==Number(view.summary.expected_amount)&&!note)throw Error('اكتب سبب فرق النقدية');
   if(!confirm(`إغلاق جلسة #${view.id} بنقدية فعلية ${currency(actual)}؟`))return;
   return submit('close',{actualAmount:actual,note});
  });
  el('cashMove').onclick=run(async()=>{
   const amount=nonnegative(el('cashAmount').value),reason=el('cashReason').value.trim();
   if(Number(amount)<=0||!reason)throw Error('اكتب مبلغًا أكبر من صفر وسبب الحركة');
   const kind=el('cashKind').value,metadata={};if(kind==='EXPENSE'){if(!el('cashCategory').value||!el('cashExpenseDate').value)throw Error('اختر تصنيف المصروف وتاريخه');Object.assign(metadata,{expenseCategory:el('cashCategory').value,expenseDate:el('cashExpenseDate').value,beneficiary:el('cashBeneficiary').value.trim(),referenceNo:el('cashReference').value.trim()});}const attachments=await readFiles();return submit('movement',{kind,amount,reason,attachments,...metadata});
  });
  const dateParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));el('cashExpenseDate').value=`${dateParts.year}-${dateParts.month}-${dateParts.day}`;el('cashKind').onchange=expenseFields;
  el('cashRetry').onclick=run(sendPending);el('cashRefresh').onclick=run(refresh);
  el('cashChoose').onchange=run(async()=>{selected=el('cashChoose').value;await refresh()});
  el('siteCode').onchange=run(async()=>{if(receiptPending()||pending)throw Error('أكمل الطلب السابق أولًا');selected='';await refresh()});
  el('cashMovements').onclick=async event=>{
   const button=event.target.closest('[data-attachment]');if(!button)return;
   try{
    const r=await fetch(`${window.API_BASE_URL||'https://api.mi.virginiaolive.com/api'}/olive/cash-sessions/${view.id}/attachments/${encodeURIComponent(button.dataset.attachment)}?companyId=${company()}`,{headers:{Authorization:`Bearer ${getToken()}`}});
    if(!r.ok)throw Error('تعذر تنزيل المرفق');const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=button.textContent;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   }catch(e){message(e.message,true)}
  };
  try{pending=JSON.parse(sessionStorage.getItem(scope())||'null');if(pending)message('يوجد طلب عهدة لم يتأكد ردّه؛ اضغط إعادة نفس العملية.',true);await refresh();}
  catch(e){own=null;message(e.message||'تعذر تحميل الجلسة',true);operationState();refreshSave();}
 }
 window.OliveCashSessions={init,refresh,storageIdentity,displayedId:()=>view?.id||null,currentId:()=>own?.id||null,hasPending:()=>!!pending||busy};
})();
