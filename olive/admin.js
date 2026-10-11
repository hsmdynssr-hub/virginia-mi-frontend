"use strict";
const $=x=>document.getElementById(x);
const kg=v=>new Intl.NumberFormat("ar-EG",{minimumFractionDigits:3,maximumFractionDigits:3}).format(Number(v||0));
const m=v=>new Intl.NumberFormat("ar-EG",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0));
let loading=false, cancelling=false;
const filters=()=>({companyId:Number(getCompanyId()||1),dateFrom:$("from").value,dateTo:$("to").value,q:$("q").value});
document.addEventListener("DOMContentLoaded",()=>{
  if(!getToken()){location.href="../admin/login.html";return;}
  const now=new Date(),t=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
  $("from").value=t;$("to").value=t;$("load").onclick=load;
  $("exportExcel").onclick=async()=>{
    const button=$("exportExcel");button.disabled=true;$("msg").textContent="";
    try{await apiDownload("/exports/excel",{...filters(),report:"olive.receiving_analysis"},"olive-receiving-analysis.xlsx");}
    catch(err){$("msg").textContent=err.message||"فشل التصدير";}finally{button.disabled=false;}
  };
  $("rb").addEventListener("click",async ev=>{
    const button=ev.target.closest("button[data-cancel-id]");if(!button||cancelling||loading)return;
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
    $("vb").innerHTML=(x.byVariety||[]).map(v=>`<tr><td>${e(v.variety_name)}</td><td>${e(v.weight_kg)}</td><td>${m(v.total_amount)}</td><td>${m(v.avg_price_per_kg)}</td></tr>`).join("");
    $("rb").innerHTML=(rows||[]).map(v=>{
      const cancelled=v.receiving_status==="CANCELLED";
      return `<tr${cancelled?' class="cancelled"':''}><td><a href="./receipt.html?id=${encodeURIComponent(v.id)}&companyId=${encodeURIComponent(p.companyId)}">${e(v.receipt_no)}</a></td><td>${e(new Date(v.created_at).toLocaleString("ar-EG"))}</td><td>${e(v.supplier_name)}</td><td>${kg(v.weight_kg)}</td><td>${m(v.total_amount)}</td><td>${m(v.paid_amount)}</td><td>${m(v.balance_amount)}</td><td><a class="btn" href="./receipt.html?id=${encodeURIComponent(v.id)}&companyId=${encodeURIComponent(p.companyId)}">عرض السند</a> ${cancelled?'ملغى':'مستلم'}</td><td><a class="btn" href="./receipt.html?id=${encodeURIComponent(v.id)}&companyId=${encodeURIComponent(p.companyId)}">عرض السند</a> ${cancelled?`${e(v.cancellation_reason)}<br><small>${e(v.cancelled_by)} — ${e(new Date(v.cancelled_at).toLocaleString("ar-EG"))}</small>`:`<button class="btn cancel-btn" data-cancel-id="${e(v.id)}" data-receipt-no="${e(v.receipt_no)}">إلغاء السند</button>`}</td></tr>`;
    }).join("");
  }catch(err){$("msg").textContent=err.message||"فشل التحميل";}finally{loading=false;$("load").disabled=cancelling;}
}
function e(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}
