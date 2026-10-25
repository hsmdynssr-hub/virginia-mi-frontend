'use strict';
(async()=>{
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
 let invalidated=false;
 const invalidate=()=>{invalidated=true;$('invoice').hidden=true;$('status').textContent='تغيّر سياق الدخول؛ أعد فتح المستند من صفحة التجار';};
 window.addEventListener('storage',invalidate);window.addEventListener('company-context-changed',invalidate);
 try{
  if(!getToken())throw Error('سجّل الدخول للنظام ثم أعد فتح المستند');
  const companyId=params.get('companyId'),referenceId=params.get('referenceId');
  if(!/^[1-9]\d*$/.test(companyId||'')||!refId(referenceId)||String(getCompanyId())!==companyId)throw Error('افتح المستند من صفحة التجار داخل الشركة الأصلية');
  const data=(await apiGet('/olive/traders/references',{companyId,referenceId})).data,doc=data.rows[0]?.reference;
  if(invalidated||String(getCompanyId())!==companyId)throw Error('تغيّر سياق الدخول؛ أعد فتح المستند');
  if(!doc||String(doc.companyId)!==companyId)throw Error('المستند غير موجود');
  for(const [label,value] of [['الرقم',doc.number],['التاريخ',doc.invoiceDate],['الشركة',doc.companyId],['الموقع',doc.siteCode],...(doc.sessionId?[['الجلسة المرتبطة سابقًا',doc.sessionId]]:[]),['المورد',doc.supplier.code+' — '+doc.supplier.name],['عنوان المورد',doc.supplier.address||'—'],['المحاسب',doc.issuedBy]]){const p=document.createElement('p');p.textContent=label+': '+value;$('facts').append(p);}
  for(const line of doc.lines){const tr=document.createElement('tr');for(const key of ['description','unit','quantity','unitPrice','total']){const td=document.createElement('td');td.textContent=line[key];tr.append(td);}$('lines').append(tr);}
  const mark=document.createElement('p');mark.id='copyMark';mark.className='notice';mark.textContent='إعادة طباعة — نسخة مرجعية وليست فاتورة جديدة';$('invoice').insertBefore(mark,$('facts'));
  $('total').textContent=doc.total;$('notes').textContent=doc.notes;$('status').textContent='';$('invoice').hidden=false;
  let printKey=null,busy=false;
  window.addEventListener('afterprint',()=>{mark.textContent='إعادة طباعة — نسخة مرجعية وليست فاتورة جديدة';});
  $('print').onclick=async()=>{
   if(busy||invalidated)return;busy=true;$('print').disabled=true;
   try{
    if(String(getCompanyId())!==companyId)throw Error('تغيّر سياق الشركة؛ أعد فتح المستند');
    printKey=printKey||crypto.randomUUID().replaceAll('-','');
    const ticket=(await apiPost('/olive/traders/references/'+referenceId+'/print',{companyId,requestKey:printKey})).data.printTicket;
    if(invalidated||String(getCompanyId())!==companyId)throw Error('تغيّر سياق الدخول؛ أعد فتح المستند');
    printKey=null;
    mark.textContent=(ticket.isReprint?'إعادة طباعة — ليست فاتورة جديدة':'طباعة أولى — فاتورة مرجعية تحت التسوية')+' | طلب طباعة رقم '+ticket.copyNumber+' | '+new Date(ticket.requestedAt).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'});
    $('status').textContent='';window.print();
   }catch(e){$('status').textContent=e.message||'تعذر تأكيد طلب الطباعة؛ أعد المحاولة';}
   finally{busy=false;$('print').disabled=false;}
  };
 }catch(e){$('invoice').hidden=true;$('status').textContent=e.message||'تعذر تحميل المستند';}
 function refId(v){return /^[1-9]\d*$/.test(v||'');}
})();
