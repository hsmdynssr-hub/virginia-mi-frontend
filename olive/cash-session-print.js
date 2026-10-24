'use strict';
(()=>{
 const el=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>new Intl.NumberFormat('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0));
 const time=v=>v?esc(new Date(v).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'})):'—';
 const table=(head,rows)=>`<div class="table-wrap"><table><thead><tr>${head.map(v=>`<th>${esc(v)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${head.length}">لا توجد بيانات</td></tr>`}</tbody></table></div>`;
 const categories={COMMISSION:'عمولة',TRANSPORT:'نقل',LABOR:'عمالة',MEALS:'وجبات',OPERATING:'تشغيل',EXTERNAL_PURCHASE:'شراء خارجي',EXTERNAL_ADVANCE:'عهدة خارجية',OTHER:'آخر'};
 const followUp=document.createElement('section');followUp.id='laterActivity';followUp.className='no-print';
 const style=document.createElement('style');style.textContent='@media print { #laterActivity {display:none!important} }';document.head.append(style);
 followUp.innerHTML='<button type="button" id="loadLaterActivity">كشف الحركات اللاحقة المرتبطة — منفصل عن لقطة الإغلاق</button><div id="laterActivityRows"></div>';document.body.append(followUp);
 el('loadLaterActivity').onclick=async()=>{try{const p=new URLSearchParams(location.search),r=await apiGet('/olive/traders/sessions/'+p.get('sessionId')+'/follow-up',{companyId:Number(p.get('companyId')),limit:200}),d=r.data||r;el('laterActivityRows').innerHTML='<h2>حركات مسجلة بعد الإغلاق — لا تدخل في لقطة الطباعة</h2><p>حتى 200 حركة، الأقدم أولًا؛ لكامل الحركات استخدم صفحات كشف المورد. إجمالي النطاق: '+esc(d.rows[0]?.full_count||0)+'</p>'+table(['وقت التسجيل','العملية','أثر حساب المورد'],d.rows.map(x=>`<tr><td>${time(x.recorded_at)}</td><td>${esc(x.kind)}</td><td>${money(x.liability_delta)}</td></tr>`));}catch(e){el('laterActivityRows').textContent=e.message;}};
 async function load(){el('print').disabled=true;el('report').hidden=true;el('message').hidden=false;
  try{
   if(!getToken())throw Error('سجل الدخول إلى النظام أولًا');
   const params=new URLSearchParams(location.search),sessionId=params.get('sessionId'),companyId=Number(params.get('companyId'));
   if(!/^[1-9]\d*$/.test(sessionId||'')||!Number.isSafeInteger(companyId)||companyId<1)throw Error('رقم الجلسة أو الشركة غير صحيح');
   const response=await apiGet('/olive/cash-sessions/'+sessionId+'/closing-report',{companyId}),d=response.data||response,s=d.session,x=s.summary;
   const summary=[['رصيد افتتاح العهدة',money(x.opening_amount)],['دعم وإضافات العهدة',money(x.funding_total)],['صرف نقدي على المشتريات',money(x.cash_paid)],['مصروفات وعهد مصروفة',money(x.expenses_total)],['المتبقي المحسوب لتسليم العهدة',money(x.expected_amount)],['النقدية الفعلية عند الإقفال',money(x.actual_amount)],['فرق النقدية: الفعلي ناقص المحسوب',money(x.difference)],['عدد الفواتير الملغاة المستبعدة',x.cancelled_count]];
   if(x.trader_settled_total!==undefined)summary.push(['شراء تجار — إجمالي المستحق المسوّى',money(x.trader_settled_total)],['تسوية من سلف سابقة — دون صرف جديد',money(x.supplier_advance_allocated)],['شراء تجار — نقدية فواتير فعلية',money(x.trader_invoice_cash)],['سلف موردين مصروفة نقدًا',money(x.supplier_advance_cash)],['رد نقدي مستلم من موردين',money(x.supplier_return_cash)]);
   const cancellationReasons=new Map();
   for(const receipt of d.receipts||[])if(receipt.receiving_status==='CANCELLED'){
    const reason=String(receipt.cancellation_reason||'سبب غير مسجل').trim()||'سبب غير مسجل';
    cancellationReasons.set(reason,(cancellationReasons.get(reason)||0)+1);
   }
   el('report').innerHTML=`<h1>ملخص إقفال عهدة المحاسب — جلسة #${esc(s.id)}</h1><p>الشركة: ${esc(s.company_id===1?'Virginia':s.company_id===2?'Cleopatra':s.company_id)} — الموقع: ${esc(s.site_code)} — المحاسب: ${esc(s.owner_name)}</p><p>الفتح: ${time(s.opened_at)} — الإقفال: ${time(s.closed_at)} — أغلقها: ${esc(s.closed_by)}</p><small>طبع بواسطة: ${esc(d.printedBy)} — وقت إعداد التقرير: ${time(d.generatedAt)}</small>
    ${!d.snapshotAvailable?'<p class="notice">جلسة قديمة دون لقطة طباعة محفوظة؛ الملخص المالي هو ملخص الإغلاق المحفوظ، والتفاصيل المعروضة حالية ولا تثبت حالتها وقت الإغلاق.</p>':'<p>لقطة الإغلاق المحفوظة — لا تشمل الحركات اللاحقة المرتبطة.</p>'}
    ${x.adjusted_after_close?`<p class="notice">تم تحديث الملخص بعد الإقفال وفق بيانات الجلسة وتصحيحاتها. المتبقي المحفوظ في ملخص الإقفال الأصلي: ${money(s.closing_summary.expected_amount)}؛ الفرق المحفوظ: ${money(s.closing_summary.difference)}. الحسابات والنقدية الفعلية الحالية موضحة أدناه، والأرقام الأصلية محفوظة للمراجعة.</p>`:''}
    ${d.recovery?`<p class="notice">تجميع تاريخي لفواتير يوم ${esc(d.recovery.day)} — ${esc(d.recovery.linkedInvoices)} فاتورة. تم ربطها بهذه الجلسة بعد إقفالها، مع حفظ ملخص الإقفال الأصلي وسجل التصحيحات للمراجعة.</p>`:''}
    <h2>تسوية العهدة — جنيه</h2><table class="summary"><tbody>${summary.map(([label,value])=>`<tr><th>${esc(label)}</th><td>${esc(value??0)}</td></tr>`).join('')}</tbody></table><p>المتبقي = الافتتاحي + الدعم − الصرف النقدي على المشتريات − المصروفات والعهد المصروفة.</p><p>ملاحظات الإقفال: ${esc(s.close_note||'لا توجد')}</p>
    <h2>دعم العهدة والمصروفات</h2>${table(['الحركة','التصنيف','المبلغ','السبب / المستفيد','المرجع','المنفذ'],s.movements.map(m=>`<tr><td>${m.kind==='FUNDING'?'إضافة / مرتجع':'صرف'}</td><td>${esc(categories[m.expense_category]||'—')}</td><td>${money(m.amount)}</td><td>${esc(m.reason)} — ${esc(m.beneficiary||'')}</td><td>${esc(m.reference_no||'—')}</td><td>${esc(m.created_by)}</td></tr>`))}
    <h2>الفواتير الملغاة وأسباب الإلغاء</h2>${cancellationReasons.size?table(['سبب الإلغاء','عدد الفواتير'],[...cancellationReasons].map(([reason,count])=>`<tr><td>${esc(reason)}</td><td>${esc(count)}</td></tr>`)):'<p>لا توجد فواتير ملغاة في هذه الجلسة.</p>'}
    <div class="signatures"><div>توقيع المحاسب: ${esc(s.owner_name)}</div><div>توقيع مستلم النقدية:</div><div>المراجع / الاعتماد:</div></div>`;
   el('report').hidden=false;el('message').hidden=true;el('print').disabled=false;
  }catch(error){el('message').textContent=error.message||'تعذر تحميل ملخص الإقفال';}
 }
 el('print').onclick=()=>window.print();el('reload').onclick=load;load();
})();
