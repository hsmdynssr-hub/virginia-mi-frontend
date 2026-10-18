'use strict';
(()=>{
 const el=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>new Intl.NumberFormat('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0));
 const time=v=>v?esc(new Date(v).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'})):'—';
 const table=(head,rows)=>`<div class="table-wrap"><table><thead><tr>${head.map(v=>`<th>${esc(v)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${head.length}">لا توجد بيانات</td></tr>`}</tbody></table></div>`;
 const categories={COMMISSION:'عمولة',TRANSPORT:'نقل',LABOR:'عمالة',MEALS:'وجبات',OPERATING:'تشغيل',EXTERNAL_PURCHASE:'شراء خارجي',EXTERNAL_ADVANCE:'عهدة خارجية',OTHER:'آخر'};
 async function load(){el('print').disabled=true;el('report').hidden=true;el('message').hidden=false;
  try{
   if(!getToken())throw Error('سجل الدخول إلى النظام أولًا');
   const params=new URLSearchParams(location.search),sessionId=params.get('sessionId'),companyId=Number(params.get('companyId'));
   if(!/^[1-9]\d*$/.test(sessionId||'')||!Number.isSafeInteger(companyId)||companyId<1)throw Error('رقم الجلسة أو الشركة غير صحيح');
   const response=await apiGet('/olive/cash-sessions/'+sessionId+'/closing-report',{companyId}),d=response.data||response,s=d.session,x=s.summary;
   const summary=[['عدد الفواتير الفعالة',x.invoice_count],['قيمة الفواتير الفعالة',money(x.invoices_total)],['المتبقي للموردين بالفواتير الفعالة',money(x.invoices_unpaid)],['عدد الفواتير الملغاة المستبعدة',x.cancelled_count],['قيمة الفواتير الملغاة المستبعدة',money(x.cancelled_invoices_total)],['سداد نقدي للملغى مستبعد من المصروف',money(x.cancelled_cash_paid)],['رصيد افتتاح العهدة',money(x.opening_amount)],['دعم وإضافات العهدة',money(x.funding_total)],['سداد نقدي لفواتير فعالة',money(x.cash_paid)],['سداد غير نقدي — لا يخصم من العهدة',money(x.noncash_paid)],['مصروفات وعهد مصروفة',money(x.expenses_total)],['المتبقي المحسوب لتسليم العهدة',money(x.expected_amount)],['النقدية الفعلية عند الإقفال',money(x.actual_amount)],['فرق النقدية: الفعلي ناقص المحسوب',money(x.difference)]];
   el('report').innerHTML=`<h1>ملخص إقفال عهدة المحاسب — جلسة #${esc(s.id)}</h1><p>الشركة: ${esc(s.company_id===1?'Virginia':s.company_id===2?'Cleopatra':s.company_id)} — الموقع: ${esc(s.site_code)} — المحاسب: ${esc(s.owner_name)}</p><p>الفتح: ${time(s.opened_at)} — الإقفال: ${time(s.closed_at)} — أغلقها: ${esc(s.closed_by)}</p><small>طبع بواسطة: ${esc(d.printedBy)} — وقت إعداد التقرير: ${time(d.generatedAt)}</small>
    ${x.adjusted_after_close?`<p class="notice">تم تحديث الملخص بعد الإقفال لاستبعاد الفواتير الملغاة. المتبقي المحفوظ وقت الإقفال: ${money(s.closing_summary.expected_amount)}؛ فرق النقدية المحفوظ: ${money(s.closing_summary.difference)}. لم تتغير النقدية الفعلية المسجلة.</p>`:''}
    <h2>تسوية العهدة — جنيه</h2><table class="summary"><tbody>${summary.map(([label,value])=>`<tr><th>${esc(label)}</th><td>${esc(value??0)}</td></tr>`).join('')}</tbody></table><p>المتبقي = الافتتاحي + الدعم − السداد النقدي للفواتير الفعالة − المصروفات والعهد المصروفة.</p><p>ملاحظات الإقفال: ${esc(s.close_note||'لا توجد')}</p>
    <h2>الفواتير</h2>${table(['الفاتورة','المورد','الوزن كجم','القيمة','المدفوع بالفاتورة','المتبقي','الحالة'],d.receipts.map(r=>`<tr class="${r.receiving_status==='CANCELLED'?'cancelled':''}"><td>${esc(r.receipt_no)}</td><td>${esc(r.supplier_name)}</td><td>${money(r.weight_kg)}</td><td>${money(r.total_amount)}</td><td>${money(r.paid_amount)}</td><td>${money(r.balance_amount)}</td><td>${r.receiving_status==='CANCELLED'?'ملغاة — مستبعدة: '+esc(r.cancellation_reason):'فعالة'}</td></tr>`))}
    <h2>سداد الموردين المسجل على الجلسة</h2>${table(['الفاتورة','المورد','الطريقة','المبلغ','المرجع','الحالة'],d.payments.map(p=>`<tr><td>${esc(p.receipt_no)}</td><td>${esc(p.supplier_name)}</td><td>${esc(({CASH:'نقدي',BANK:'تحويل بنكي',TRANSFER:'تحويل',CHEQUE:'شيك'})[p.payment_method]||p.payment_method)}</td><td>${money(p.amount)}</td><td>${esc(p.reference_no||'—')}</td><td>${p.receiving_status==='CANCELLED'?'مستبعد — فاتورة ملغاة':'محتسب'}</td></tr>`))}
    <h2>دعم العهدة والمصروفات</h2>${table(['الحركة','التصنيف','المبلغ','السبب / المستفيد','المرجع','المنفذ'],s.movements.map(m=>`<tr><td>${m.kind==='FUNDING'?'إضافة / مرتجع':'صرف'}</td><td>${esc(categories[m.expense_category]||'—')}</td><td>${money(m.amount)}</td><td>${esc(m.reason)} — ${esc(m.beneficiary||'')}</td><td>${esc(m.reference_no||'—')}</td><td>${esc(m.created_by)}</td></tr>`))}
    <div class="signatures"><div>توقيع المحاسب: ${esc(s.owner_name)}</div><div>توقيع مستلم النقدية:</div><div>المراجع / الاعتماد:</div></div>`;
   el('report').hidden=false;el('message').hidden=true;el('print').disabled=false;
  }catch(error){el('message').textContent=error.message||'تعذر تحميل ملخص الإقفال';}
 }
 el('print').onclick=()=>window.print();el('reload').onclick=load;load();
})();
