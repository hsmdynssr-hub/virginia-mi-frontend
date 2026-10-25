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
  const settings=(await apiGet('/olive/traders/references/print-settings',{companyId})).data;
  if(invalidated||String(getCompanyId())!==companyId)throw Error('تغيّر سياق الدخول؛ أعد فتح المستند');
  const receipt={reference_only:true,reference_date:doc.invoiceDate,receipt_no:doc.number,created_at:doc.issuedAt,supplier_name:doc.supplier.name,supplier_phone:doc.supplier.phone,created_by:doc.issuedBy,total_amount:doc.total,notes:doc.notes,lines:doc.lines.map(l=>({variety_name:l.description,weight_kg:l.quantity,unit:l.unit,price_per_kg:l.unitPrice,line_total:l.total}))};
  const rendered=new DOMParser().parseFromString(OliveReceiptPrint.render(receipt,{...settings,receipt_title:'فاتورة تاجر — تحت التسوية'},companyId),'text/html');
  document.head.append(rendered.querySelector('style').cloneNode(true));$('invoice').innerHTML=rendered.body.innerHTML;
  $('invoice').querySelector('tbody').id='lines';$('invoice').querySelector('.grand .value').id='total';
  const mark=document.createElement('p');mark.id='copyMark';mark.textContent='إعادة طباعة';$('invoice').querySelector('.header').append(mark);
  const button=document.createElement('button');button.id='print';button.type='button';button.textContent='طباعة';$('invoice').append(button);
  $('status').textContent='';$('invoice').hidden=false;
  let printKey=null,busy=false;
  window.addEventListener('afterprint',()=>{mark.textContent='إعادة طباعة';});
  $('print').onclick=async()=>{
   if(busy||invalidated)return;busy=true;$('print').disabled=true;
   try{
    if(String(getCompanyId())!==companyId)throw Error('تغيّر سياق الشركة؛ أعد فتح المستند');
    printKey=printKey||crypto.randomUUID().replaceAll('-','');
    const ticket=(await apiPost('/olive/traders/references/'+referenceId+'/print',{companyId,requestKey:printKey})).data.printTicket;
    if(invalidated||String(getCompanyId())!==companyId)throw Error('تغيّر سياق الدخول؛ أعد فتح المستند');
    printKey=null;
    mark.textContent=(ticket.isReprint?'إعادة طباعة':'طباعة أولى')+' — '+ticket.copyNumber;
    $('status').textContent='';window.print();
   }catch(e){$('status').textContent=e.message||'تعذر تأكيد طلب الطباعة؛ أعد المحاولة';}
   finally{busy=false;$('print').disabled=false;}
  };
 }catch(e){$('invoice').hidden=true;$('status').textContent=e.message||'تعذر تحميل المستند';}
 function refId(v){return /^[1-9]\d*$/.test(v||'');}
})();
