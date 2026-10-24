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
 let own=null,view=null,all=[],userId='',admin=false,busy=false,pending=null,selected=new URLSearchParams(location.search).get('sessionId')||'',loadVersion=0;
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
  if(el('cashReviewBox'))el('cashReviewBox').hidden=false;
  if(el('advancedLink'))el('advancedLink').hidden=!admin;
  el('cashChoose').innerHTML='<option value="">اختر جلسة للمراجعة</option>'+all.map(s=>`<option value="${esc(s.id)}">#${esc(s.id)} · ${esc(s.owner_name)} · ${esc(s.site_code)} · ${s.status==='OPEN'?'مفتوحة':'مغلقة'}</option>`).join('');
  el('cashChoose').value=selected;
  el('cashDetails').hidden=!view;
  el('cashCloseBox').hidden=!view||view.status!=='OPEN';
  if(el('cashPrint')){el('cashPrint').hidden=!view||view.status!=='CLOSED';el('cashPrint').href=view?`./cash-session-print.html?sessionId=${encodeURIComponent(view.id)}&companyId=${company()}`:'#';}
  el('cashMoveBox').hidden=!admin||!view||view.status!=='OPEN';
  const funding=el('cashKind').querySelector('[value=FUNDING]');funding.hidden=!admin;funding.disabled=!admin;el('cashKind').value='FUNDING';expenseFields();
  if(view){
   const x=view.summary;
   if(el('cashCompactBalance')){el('cashCompactBalance').textContent=currency(x.expected_amount)+' جنيه';if(panelSession!==String(view.id)){setPanel(false);panelSession=String(view.id);}}
   el('cashHeading').textContent=`جلسة #${view.id} — ${view.owner_name} — ${view.site_code} — ${view.status==='OPEN'?'مفتوحة':'مغلقة'}`;
   el('cashTimes').textContent=`فتح: ${new Date(view.opened_at).toLocaleString('ar-EG')}`+(view.closed_at?` | إغلاق: ${new Date(view.closed_at).toLocaleString('ar-EG')} | بواسطة: ${view.closed_by}`:'');
   const cards=[['عدد الفواتير الفعالة',x.invoice_count,false],['إجمالي الفواتير الفعالة',x.invoices_total,true],['الرصيد الافتتاحي',x.opening_amount,true],['دعم العهدة',x.funding_total,true],['المدفوع نقديًا للموردين',x.cash_paid,true],['صرف نقدي: مصروفات وعهد',x.expenses_total,true],['المتبقي المحسوب',x.expected_amount,true],['مدفوعات غير نقدية',x.noncash_paid,true]];
   if(view.status==='CLOSED')cards.push(['النقدية الفعلية',x.actual_amount,true],['فرق النقدية',x.difference,true]);
   el('cashSummary').innerHTML=cards.map(([label,value,money])=>`<div class="cash-stat report-kpi-card"><small>${label}</small><strong>${money?currency(value):esc(value||0)}</strong></div>`).join('');
   if(x.trader_settled_total!==undefined)el('cashSummary').insertAdjacentHTML('beforeend',`<div class="cash-notes" style="grid-column:1/-1"><a href="./traders.html">شراء التجار وسلف الموردين</a> — المستحق المسوّى: ${currency(x.trader_settled_total)} جنيه | من سلف سابقة دون صرف جديد: ${currency(x.supplier_advance_allocated)} | نقدية فواتير التجار: ${currency(x.trader_invoice_cash)} | سلف مصروفة نقدًا: ${currency(x.supplier_advance_cash)} | رد نقدي مستلم: ${currency(x.supplier_return_cash)}</div>`);
   el('cashWarning').textContent=Number(x.expected_amount)<0?'الرصيد المحسوب سالب؛ راجع الافتتاحي وحركات الدعم والسداد.':Number(x.cancelled_count)>0?`يوجد ${x.cancelled_count} سند ملغى. قيمتها وسدادها مستبعدان من التقرير؛ السداد النقدي المستبعد: ${currency(x.cancelled_cash_paid)} جنيه.`:'';
   el('cashSnapshot').textContent=view.status==='CLOSED'?`${x.adjusted_after_close?'تم تحديث الملخص لاستبعاد الملغى؛ ملخص الإقفال الأصلي محفوظ للمراجعة.':'ملخص إقفال العهدة جاهز للطباعة.'} ${view.close_note||''}`:'المتبقي = الافتتاحي + الدعم − السداد النقدي للفواتير الفعالة − المصروفات. التحويلات والشيكات لا تخصم من النقدية.';
   el('cashMovements').innerHTML=(view.movements||[]).map(m=>{const supplier=['SUP_ADVANCE','SUP_RETURN','PAY_RETURN'].includes(m.expense_mode);return `<tr><td>${supplier?({SUP_ADVANCE:'سلفة مورد / تاجر',SUP_RETURN:'رد نقدي من سلفة مورد',PAY_RETURN:'رد دفعة نقدية من مورد'}[m.expense_mode]):m.expense_mode==='RETURN'?'نقد مرتجع من عهدة #'+esc(m.advance_id):m.expense_mode==='ADVANCE'?'صرف عهدة تحت التسوية':m.expense_mode==='DIRECT'?'مصروف مباشر متعدد البنود':m.kind==='FUNDING'?'دعم':'مصروف / سحب سابق'}</td><td>${currency(m.amount)}${admin&&!supplier&&view.status==='OPEN'&&m.kind==='EXPENSE'?`<br><button class="cash-document" type="button" data-edit-expense="${esc(m.id)}">تعديل القيمة</button>`:''}</td><td>${supplier?'حساب مورد':esc(categoryLabels[m.expense_category]|| (m.kind==='FUNDING'?'دعم عهدة':'غير مصنف — يحتاج مراجعة'))}<br>${esc(m.beneficiary||'')}<br><small>${esc(m.reference_no||'')} ${esc(m.expense_date||'')}</small></td><td>${esc(m.reason)}</td><td>${esc(m.created_by)}<br><small>${esc(new Date(m.created_at).toLocaleString('ar-EG'))}</small></td><td>${supplier?'<a href="./traders.html">مستندات المورد والتسوية</a>':m.attachments.map(a=>`<button type="button" class="cash-document" data-attachment="${esc(a.id)}">${esc(a.file_name)}</button>`).join(' ')}${(m.expenseLines||[]).flatMap(l=>l.attachments||[]).map(a=>`<button type="button" class="cash-document" data-expense-document="${esc(a.id)}">${esc(a.file_name)}</button>`).join(' ')}${admin&&!supplier?`<br><button class="cash-document" type="button" data-edit-docs="${esc(m.id)}">تعديل المرفقات</button>`:''}</td></tr>`;}).join('')||'<tr><td colspan="6">لا توجد حركات دعم أو مصروفات</td></tr>';
  }
  if(el('cashPanel')){if(!view||pending)setPanel(true);el('cashExpenseShortcut').hidden=false;}
  operationState();refreshSave();
 }
 async function refresh(){
  const revision=++loadVersion;
  const result=await apiGet('/olive/cash-sessions',{companyId:company()});if(revision!==loadVersion)return;
  const data=result.data||result;all=data.sessions;userId=String(data.currentUserId);admin=data.canManageCash===true;
  const site=el('siteCode').value.trim()||'MAIN';own=all.find(s=>String(s.owner_id)===userId&&s.site_code===site&&s.status==='OPEN')||null;
  if(!adminPage&&(!selected||!all.some(s=>String(s.id)===selected)))selected=String(own?.id||lastClosed?.id||all[0]?.id||'');
  if(adminPage&&(!selected||!all.some(s=>String(s.id)===selected)))selected=String(own?.id||all[0]?.id||'');
  if(selected){const r=await apiGet('/olive/cash-sessions/'+selected,{companyId:company()});if(revision!==loadVersion)return;view=r.data||r;}else view=null;
  render();
 }
 async function sendPending(){
  if(!pending||busy)return;
  if(receiptPending()||window.OliveExpenseEntries?.hasPending()){message('أكمل طلب حفظ الفاتورة أولًا قبل أي حركة أو إغلاق.',true);return;}
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
   try{await refresh();await window.OliveExpenseEntries?.refresh();}catch(e){message('تم تسجيل العملية، لكن تحديث الملخص تعذر. اضغط تحديث.',true);}
  }catch(e){
   // Definitive validation/conflict replies cannot have committed a new operation.
   // Keep ambiguous network/server failures for safe replay.
   const code=Number(e.statusCode||e.status);
   if([400,403,404,409,413].includes(code)){sessionStorage.removeItem(scope());pending=null;}
   message(e.message||'تعذر تأكيد العملية؛ أعد نفس الطلب',true);
  }finally{busy=false;operationState();refreshSave();}
 }
 async function submit(type,body){
  if(busy||pending||window.OliveExpenseEntries?.hasPending())return;
  if(receiptPending()||window.OliveExpenseEntries?.hasPending()){message('أكمل طلب حفظ الفاتورة أولًا قبل أي حركة أو إغلاق.',true);return;}
  const path=type==='open'?'/olive/cash-sessions':type==='correction'?`/olive/cash-sessions/${view.id}/movements/${body.movementId}/correction`:`/olive/cash-sessions/${view.id}/${type==='close'?'close':'movements'}`;
  const value={type,path,body:{...body,companyId:company(),requestKey:requestKey()}};
  sessionStorage.setItem(scope(),JSON.stringify(value));pending=value;await sendPending();
 }
 async function readFiles(input=el('cashFiles')){
  const files=Array.from(input.files||[]);if(!files.length||files.length>3)throw Error('أرفق من مستند واحد إلى ثلاثة مستندات');
  if(files.reduce((n,f)=>n+f.size,0)>12*1024*1024)throw Error('إجمالي المرفقات أكبر من 12MB');
  return Promise.all(files.map(file=>new Promise((resolve,reject)=>{
   if(file.size>5*1024*1024){reject(Error('المرفق أكبر من 5MB'));return;}
   if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)){reject(Error('استخدم صورة أو PDF'));return;}
   const reader=new FileReader();reader.onerror=()=>reject(Error('تعذرت قراءة المرفق'));reader.onload=()=>resolve({fileName:file.name,mimeType:file.type,base64:String(reader.result).split(',')[1]});reader.readAsDataURL(file);
  })));
 }
 const nonnegative=value=>{if(!/^\d{1,16}(\.\d{1,2})?$/.test(String(value)))throw Error('راجع المبلغ؛ بحد أقصى منزلتين عشريتين');return value;};
 function run(fn){return async()=>{try{await fn()}catch(e){message(e.message||'تعذر تنفيذ العملية',true)}};}
 function editMovement(m,attachmentsOnly){
  if(!admin||busy||pending||receiptPending()||window.OliveExpenseEntries?.hasPending())return;
  const dialog=document.createElement('dialog');dialog.className='cash-correction-dialog';
  const lines=(m.expenseLines||[]).filter(l=>attachmentsOnly||l.statement_kind==='DIRECT');
  const chooseLine=m.expense_mode==='DIRECT'||(attachmentsOnly&&lines.length);
  dialog.innerHTML=`<form><h2>${attachmentsOnly?'تعديل المرفقات':'تعديل قيمة المصروف'} #${esc(m.id)}</h2><p>سبب التعديل إلزامي. تُحفظ القيم والمرفقات السابقة في سجل التصحيحات.</p>${chooseLine?`<label>موضع التعديل<select name="line">${m.expense_mode!=='DIRECT'?'<option value="">مرفقات حركة العهدة</option>':''}${lines.map(l=>`<option value="${esc(l.id)}">بند #${esc(l.id)} — ${esc(l.description)} — ${currency(l.amount)}</option>`).join('')}</select></label>`:''}${attachmentsOnly?'<div class="cash-old-documents"></div><label>المرفقات البديلة كاملة (صورة أو PDF؛ من ١ إلى ٣)<input name="documents" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" required></label>':'<label>القيمة الجديدة<input name="amount" type="text" inputmode="decimal" required></label>'}<label>سبب التعديل<textarea name="reason" maxlength="2000" required></textarea></label><p class="msg err" role="alert"></p><div class="pos-toolbar"><button class="btn" type="submit">حفظ التعديل</button><button class="btn gray" type="button" data-cancel>إلغاء</button></div></form>`;
  const form=dialog.querySelector('form'),select=form.elements.line;
  const line=()=>lines.find(l=>String(l.id)===select?.value);
  const currentDocs=()=>line()?.attachments||m.attachments||[];
  const update=()=>{if(attachmentsOnly)dialog.querySelector('.cash-old-documents').textContent='المرفقات الحالية: '+(currentDocs().map(d=>d.file_name).join('، ')||'لا توجد');else form.elements.amount.value=line()?.amount||m.amount;};
  update();if(select)select.onchange=update;
  dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
  form.onsubmit=async event=>{event.preventDefault();const error=dialog.querySelector('[role=alert]');
   try{
    if(busy||pending)throw Error('أكمل الطلب السابق أولًا');
    const body={movementId:m.id,reason:form.elements.reason.value.trim()};if(!body.reason)throw Error('سبب التعديل مطلوب');
    if(select?.value)body.lineId=select.value;
    if(attachmentsOnly){body.attachments=await readFiles(form.elements.documents);body.expectedAttachmentIds=currentDocs().map(d=>String(d.id));}
    else{body.amount=nonnegative(form.elements.amount.value.trim());if(Number(body.amount)<=0)throw Error('اكتب قيمة أكبر من صفر');body.expectedAmount=m.amount;}
    form.querySelector('[type=submit]').disabled=true;await submit('correction',body);dialog.close();
   }catch(e){error.textContent=e.message;form.querySelector('[type=submit]').disabled=false;}
  };
  document.body.append(dialog);dialog.showModal();
 }
 async function init(){
  if(!el('cashPrint')){const link=document.createElement('a');link.id='cashPrint';link.className='btn gray';link.textContent='طباعة ملخص إقفال العهدة';link.target='_blank';link.rel='noopener';link.hidden=true;el('cashHeading').after(link);}
  if(el('cashToggle')){el('cashToggle').onclick=()=>setPanel(el('cashPanel').hidden);el('cashExpenseShortcut').onclick=()=>window.OliveExpenseEntries?.open();}
  const initialCompany=String(company());window.addEventListener('company-context-changed',()=>{if(receiptPending()||pending||busy||window.OliveExpenseEntries?.hasPending()){setCompanyId(initialCompany);const select=el('companySelect');if(select)select.value=initialCompany;message('أكمل الطلب الحالي قبل تغيير الشركة',true);}else location.reload();});
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
  el('cashRetry').onclick=run(sendPending);el('cashRefresh').onclick=run(async()=>{await refresh();await window.OliveExpenseEntries?.refresh();});
  el('cashChoose').onchange=run(async()=>{selected=el('cashChoose').value;await refresh()});
  el('siteCode').onchange=run(async()=>{if(receiptPending()||pending)throw Error('أكمل الطلب السابق أولًا');selected='';await refresh()});
  el('cashMovements').onclick=async event=>{
   const edit=event.target.closest('[data-edit-expense],[data-edit-docs]');if(edit){const m=view.movements.find(m=>String(m.id)===String(edit.dataset.editExpense||edit.dataset.editDocs));if(m)editMovement(m,edit.hasAttribute('data-edit-docs'));return;}
   const button=event.target.closest('[data-attachment],[data-expense-document]');if(!button)return;
   try{
    const r=await fetch(`${window.API_BASE_URL||'https://api.mi.virginiaolive.com/api'}/olive/cash-sessions/${button.dataset.expenseDocument?`expense-documents/${encodeURIComponent(button.dataset.expenseDocument)}`:`${view.id}/attachments/${encodeURIComponent(button.dataset.attachment)}`}?companyId=${company()}`,{headers:{Authorization:`Bearer ${getToken()}`}});
    if(!r.ok)throw Error('تعذر تنزيل المرفق');const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=button.textContent;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   }catch(e){message(e.message,true)}
  };
  try{pending=JSON.parse(sessionStorage.getItem(scope())||'null');if(pending)message('يوجد طلب عهدة لم يتأكد ردّه؛ اضغط إعادة نفس العملية.',true);await refresh();}
  catch(e){own=null;message(e.message||'تعذر تحميل الجلسة',true);operationState();refreshSave();}
  await window.OliveExpenseEntries?.init();
 }
 window.OliveCashSessions={init,refresh,storageIdentity,displayedId:()=>view?.id||null,currentId:()=>own?.id||null,sessions:()=>all,hasPending:()=>!!pending||busy||!!window.OliveExpenseEntries?.hasPending()};
})();
