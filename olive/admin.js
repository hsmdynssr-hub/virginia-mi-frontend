"use strict";
const $=x=>document.getElementById(x);
const kg=v=>new Intl.NumberFormat("ar-EG",{minimumFractionDigits:3,maximumFractionDigits:3}).format(Number(v||0));
const m=v=>new Intl.NumberFormat("ar-EG",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0));
let analysisData=null;
let loading=false, cancelling=false, canCancelReceipt=false;
const filters=()=>{const mode=$("analysisMode").value,sessionId=$("analysisSession").value;if(mode==='SESSION'&&!sessionId)throw Error('اختر جلسة لعرضها كاملة');const dateFrom=mode==='DAY'?$("analysisDay").value:mode==='CUSTOM'?$("from").value:'',dateTo=mode==='DAY'?$("analysisDay").value:mode==='CUSTOM'?$("to").value:'';if(['DAY','CUSTOM'].includes(mode)&&(!dateFrom||!dateTo))throw Error('حدد اليوم أو الفترة');return {companyId:Number(getCompanyId()||1),sessionId,dateFrom,dateTo,q:$("q").value};};
function analysisFields(){const mode=$("analysisMode").value;if(mode==='ALL')$("analysisSession").value='';$("analysisDayField").hidden=mode!=='DAY';$("analysisFromField").hidden=mode!=='CUSTOM';$("analysisToField").hidden=mode!=='CUSTOM';}
document.addEventListener("DOMContentLoaded",async()=>{
  if(!$("analysisMode"))return;
  if(!getToken()){location.href="../admin/login.html";return;}
  const initialCompany=String(getCompanyId()||1);window.addEventListener('company-context-changed',()=>{if(loading||cancelling){setCompanyId(initialCompany);const select=$("companySelect");if(select)select.value=initialCompany;$("msg").textContent='انتظر انتهاء العملية قبل تغيير الشركة';}else location.reload();});
  try {const access=await apiGet("/olive/access/capabilities");canCancelReceipt=(access.data||access).canCancelReceipt===true;}catch(_){canCancelReceipt=false;}
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value])),t=`${parts.year}-${parts.month}-${parts.day}`;
  $("analysisDay").value=t;$("from").value=t;$("to").value=t;$("load").onclick=load;$("analysisMode").onchange=analysisFields;analysisFields();
  document.querySelectorAll('[data-analysis-tab]').forEach(button=>{button.onclick=()=>{document.querySelectorAll('[data-analysis-tab]').forEach(b=>{const selected=b===button;b.setAttribute('aria-selected',String(selected));b.classList.toggle('gray',!selected);$("panel-"+b.dataset.analysisTab).hidden=!selected;});};});
  try{const r=await apiGet('/olive/analysis/sessions',{companyId:Number(getCompanyId()||1)});const rows=r.data||r;$("analysisSession").innerHTML='<option value="">كل الجلسات</option><option value="UNASSIGNED">فواتير بدون جلسة</option>'+rows.map(x=>`<option value="${e(x.id)}">#${e(x.id)} — ${e(x.owner_name)} — ${e(x.site_code)} — ${x.status==='OPEN'?'مفتوحة':'مغلقة'}</option>`).join('');}catch(err){$("msg").textContent='تعذر تحميل قائمة الجلسات: '+err.message;}
  $("exportExcel").onclick=async()=>{
    const button=$("exportExcel");button.disabled=true;$("msg").textContent="";
    try{await apiDownload("/exports/excel",{...filters(),report:"olive.receiving_analysis"},"olive-receiving-analysis.xlsx");}
    catch(err){$("msg").textContent=err.message||"فشل التصدير";}finally{button.disabled=false;}
  };
  $("priceVariety").onchange=renderPrices;
  $("rb").addEventListener("click",async ev=>{
    const button=ev.target.closest("button[data-cancel-id]");if(!button||!canCancelReceipt||cancelling||loading)return;
    const reason=prompt("اكتب سبب إلغاء سند "+button.dataset.receiptNo+" (إلزامي):");
    if(reason===null)return;
    if(!reason.trim()||reason.trim().length>2000){$("msg").textContent="سبب الإلغاء مطلوب وبحد أقصى 2000 حرف";return;}
    if(!confirm("تأكيد إلغاء السند "+button.dataset.receiptNo+"؟ سيُستبعد من الملخص والتصدير مع الاحتفاظ ببياناته."))return;
    cancelling=true;button.disabled=true;$("load").disabled=true;$("msg").textContent="";
    try{await apiPost("/olive/receipts/"+encodeURIComponent(button.dataset.cancelId)+"/cancel",{companyId:Number(getCompanyId()||1),reason:reason.trim()});await load();}
    catch(err){$("msg").textContent=err.message||"فشل الإلغاء";}finally{cancelling=false;button.disabled=false;$("load").disabled=false;}
  });load();
});
async function load(){
  if(loading)return;loading=true;$("load").disabled=true;$("msg").textContent="";
  try{
    const p=filters(),[s,r]=await Promise.all([apiGet("/olive/summary",p),apiGet("/olive/receipts",{...p,limit:200})]),x=s.data||s,rows=r.data||r;
    $("kc").textContent=x.receipt_count||0;$("kt").textContent=m(x.total_amount);$("kp").textContent=m(x.paid_amount);$("kb").textContent=m(x.balance_amount);
    analysisData=x;
    $("vb").innerHTML=(x.byVariety||[]).map(v=>`<tr><td>${e(v.variety_name)}</td><td>${e(v.weight_kg)}</td><td>${m(v.total_amount)}</td><td>${m(v.avg_price_per_kg)}</td><td>${m(v.min_price_per_kg)}</td><td>${m(v.max_price_per_kg)}</td><td>${e(v.price_count||0)}</td><td>${e(v.overridden_lines||0)}</td></tr>`).join("");
    $("supplierCount").textContent=`عرض ${(x.bySupplier||[]).length} من ${x.bySupplier?.[0]?.full_count||0} مجموعة مورد`;
    $("supplierRows").innerHTML=(x.bySupplier||[]).map(v=>`<tr><td>${e(v.supplier_name)}</td><td>${e(v.supplier_phone)}</td><td>${e(v.receipt_count)}</td><td>${kg(v.weight_kg)}</td><td>${m(v.total_amount)}</td><td>${m(v.paid_amount)}</td><td>${m(v.balance_amount)}</td></tr>`).join('')||'<tr><td colspan="7">لا توجد مشتريات</td></tr>';
    const previous=$("priceVariety").value;$("priceVariety").innerHTML=(x.byVariety||[]).map((v,i)=>`<option value="${i}">${e(v.variety_name)}</option>`).join('');if(previous&&Number(previous)<(x.byVariety||[]).length)$("priceVariety").value=previous;renderPrices();
    $("rb").innerHTML=(rows||[]).map(v=>{
      const cancelled=v.receiving_status==="CANCELLED";
      return `<tr${cancelled?' class="cancelled"':''}><td><a class="olive-receipt-number" href="./receipt.html?id=${encodeURIComponent(v.id)}&companyId=${encodeURIComponent(p.companyId)}">${e(v.receipt_no)}</a></td><td>${e(new Date(v.created_at).toLocaleString("ar-EG"))}</td><td>${e(v.supplier_name)}</td><td>${kg(v.weight_kg)}</td><td>${m(v.total_amount)}</td><td>${m(v.paid_amount)}</td><td>${m(v.balance_amount)}</td><td><span class="olive-status ${cancelled?'is-cancelled':'is-received'}">${cancelled?'ملغى':'مستلم'}</span></td><td><div class="olive-actions"><a class="olive-action olive-view" href="./receipt.html?id=${encodeURIComponent(v.id)}&companyId=${encodeURIComponent(p.companyId)}">عرض السند</a>${cancelled||!canCancelReceipt?'':`<button type="button" class="olive-action olive-cancel" data-cancel-id="${e(v.id)}" data-receipt-no="${e(v.receipt_no)}">إلغاء</button>`}</div>${cancelled?`<div class="olive-cancel-details">${e(v.cancellation_reason)}<br><small>${e(v.cancelled_by)} — ${e(new Date(v.cancelled_at).toLocaleString("ar-EG"))}</small></div>`:''}</td></tr>`;
    }).join("");
  }catch(err){$("msg").textContent=err.message||"فشل التحميل";}finally{loading=false;$("load").disabled=cancelling;}
}
function e(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}

function renderPrices(){
 const x=analysisData;if(!x)return;const v=(x.byVariety||[])[Number($("priceVariety").value)];if(!v){$("priceRows").innerHTML='';$("priceExplanation").textContent='لا توجد كميات للصنف';return;}
 const rows=(x.byPrice||[]).filter(r=>String(r.variety_id||'')===String(v.variety_id||'')&&r.variety_name===v.variety_name),weight=Number(v.weight_kg||0);
 $("priceExplanation").textContent=`${v.variety_name}: ${kg(weight)} كجم بقيمة ${m(v.total_amount)} جنيه؛ المتوسط المرجح ${m(v.avg_price_per_kg)} جنيه/كجم. ${Number(v.price_count)>1?'يوجد أكثر من سعر شراء؛ اختلاف أوزان الشراء بكل سعر يغيّر المتوسط.':'سعر شراء واحد داخل الفلتر الحالي.'} حدود السعر من ${m(v.min_price_per_kg)} إلى ${m(v.max_price_per_kg)}. المقارنة بين جلستين تتم باختيار كل جلسة ومراجعة أسعارها وكمياتها.`;
 $("priceCount").textContent=`عرض ${rows.length} مجموعة سعر للصنف؛ التقرير يعرض حتى500 مجموعة أسعار إجمالًا. متوسط الصنف محسوب من كل السطور دون هذا الحد.`;
 $("priceRows").innerHTML=rows.map(r=>`<tr><td>${m(r.price_per_kg)}</td><td>${kg(r.weight_kg)}</td><td>${weight?m(Number(r.weight_kg)*100/weight):'0'}%</td><td>${m(r.total_amount)}</td><td>${e(r.receipt_count)}</td><td>${e(r.overridden_lines)}</td><td>${e(new Date(r.first_receipt_at).toLocaleString('ar-EG'))}<br>${e(new Date(r.last_receipt_at).toLocaleString('ar-EG'))}</td></tr>`).join('');
}
