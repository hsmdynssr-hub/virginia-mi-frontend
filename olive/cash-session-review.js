'use strict';
(()=>{
 const el=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=value=>new Intl.NumberFormat('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0));
 const date=value=>value?esc(new Date(value).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'})):'—';
 const amount=value=>`<td class="${Number(value)<0?'negative':''}">${money(value)}</td>`;
 const companyId=Number(new URLSearchParams(location.search).get('companyId')||getCompanyId()||1);
 const fill=(id,rows,label)=>{const select=el(id),current=select.value;select.innerHTML=`<option value="">${esc(label)}</option>`+rows.map(([value,name])=>`<option value="${esc(value)}">${esc(name)}</option>`).join('');select.value=current;};
 async function load(){el('load').disabled=true;el('print').disabled=true;el('report').hidden=true;el('message').textContent='جارٍ تحميل التقرير…';
  try{
   if(!getToken())throw Error('سجل الدخول إلى النظام أولًا');
   const response=await apiGet('/olive/cash-sessions/review-report',{companyId,ownerId:el('owner').value,siteCode:el('site').value,status:el('status').value,dateFrom:el('from').value,dateTo:el('to').value}),d=response.data||response;
   fill('owner',[...new Map(d.available.map(row=>[row.owner_id,row.owner_name]))],'كل المحاسبين');fill('site',[...new Set(d.available.map(row=>row.site_code))].map(site=>[site,site]),'كل المواقع');
   el('context').textContent=`الشركة: ${companyId===1?'Virginia':companyId===2?'Cleopatra':companyId} — ${el('owner').selectedOptions[0]?.textContent||'كل المحاسبين'} — ${el('site').selectedOptions[0]?.textContent||'كل المواقع'} — ${el('status').selectedOptions[0].textContent} — فتح الجلسة: ${el('from').value||'البداية'} إلى ${el('to').value||'الآن'} — أعده: ${d.generatedBy} — ${new Date(d.generatedAt).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'})}`;
   const t=d.totals;el('totals').innerHTML=[['المتبقي المحسوب بأحدث جلسة لكل موقع',t.latest_expected_amount],['الدعم والمرتجعات في الجلسات المعروضة',t.funding_total],['السداد النقدي الفعال',t.cash_paid],['المصروفات والعهد المصروفة',t.expenses_total]].map(([name,value])=>`<div><span>${esc(name)}</span><strong class="${Number(value)<0?'negative':''}">${money(value)}</strong></div>`).join('');
   el('accounts').innerHTML=d.accountants.map(row=>`<tr><td>${esc(row.owner_name)}<small>رقم المستخدم: ${esc(row.owner_id)}</small></td><td>${row.session_count}</td><td>${row.open_count}</td>${amount(row.latest_expected_amount)}${row.latest_actual_amount===null?'<td>أحدث جلسة مفتوحة — لم يسجل عد الإقفال</td>':amount(row.latest_actual_amount)}${row.latest_difference===null?'<td>—</td>':amount(row.latest_difference)}</tr>`).join('')||'<tr><td colspan="6">لا توجد جلسات مطابقة</td></tr>';
   el('sessions').innerHTML=d.sessions.map(row=>`<tr><td>#${esc(row.id)}<small>${esc(row.owner_name)}</small></td><td>${esc(row.site_code)}<small>${row.status==='OPEN'?'مفتوحة':'مغلقة'}${row.adjusted_after_close?' — مُحدّثة':''}</small></td><td>${date(row.opened_at)}<small>${date(row.closed_at)}</small></td>${amount(row.opening_amount)}${amount(row.funding_total)}${amount(row.cash_paid)}${amount(row.expenses_total)}${amount(row.expected_amount)}${row.status==='CLOSED'?amount(row.actual_amount):'<td>—</td>'}${row.status==='CLOSED'?amount(row.difference):'<td>—</td>'}${amount(row.noncash_paid)}<td>${row.cancelled_count}<small>سداد نقدي مستبعد: ${money(row.cancelled_cash_paid)}</small></td><td><a href="./manage.html?sessionId=${encodeURIComponent(row.id)}&companyId=${companyId}" target="_blank" rel="noopener">فتح الجلسة</a>${row.status==='CLOSED'?`<small><a href="./cash-session-print.html?sessionId=${encodeURIComponent(row.id)}&companyId=${companyId}" target="_blank" rel="noopener">ملخص الإقفال</a></small>`:''}</td></tr>`).join('')||'<tr><td colspan="13">لا توجد جلسات مطابقة</td></tr>';
   el('sessionTotals').innerHTML=`<tr><th colspan="3">إجمالي الحركات — ${t.session_count} جلسة</th>${amount(t.opening_amount)}${amount(t.funding_total)}${amount(t.cash_paid)}${amount(t.expenses_total)}<td colspan="6">الافتتاحيات المعروضة ليست إجمالي مديونية المحاسب.</td></tr>`;
   el('message').textContent='';el('report').hidden=false;el('print').disabled=false;
  }catch(error){el('message').textContent=error.message||'تعذر تحميل التقرير أو لا توجد صلاحية';}finally{el('load').disabled=false;}
 }
 el('filters').onsubmit=event=>{event.preventDefault();load();};el('print').onclick=()=>window.print();load();
})();
