(function () {
  "use strict";
  const API_BASE=(window.API_BASE_URL||((location.hostname==="localhost"||location.hostname==="127.0.0.1")?"http://localhost:5050/api":"https://api.mi.virginiaolive.com/api")).replace(/\/$/,"")+"/customer/service-pos-review";
  const LIVE_INTERVAL_MS=15000,$=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const TAB_STORAGE_KEY="mi-customer-service-management-tab";
  let liveEnabled=true,liveTimer=null,loading=false,channel=null,activeTab=localStorage.getItem(TAB_STORAGE_KEY)==="responses"?"responses":"complaints";
  const token=()=>window.getToken?.()||localStorage.getItem("token")||"";
  const headers=()=>token()?{Authorization:`Bearer ${token()}`}:{},companyId=()=>String(window.getCompanyId?.()||localStorage.getItem("companyId")||"");
  function dates(){const n=new Date(),f=new Date(n);f.setDate(f.getDate()-30);$("dateTo").value=n.toISOString().slice(0,10);$("dateFrom").value=f.toISOString().slice(0,10)}
  function query(){const p=new URLSearchParams(),c=companyId();if($("companyId"))$("companyId").value=c;[["companyId",c],["dateFrom",$("dateFrom")?.value],["dateTo",$("dateTo")?.value],["noteType",$("noteType")?.value],["status",$("status")?.value],["customerPhone",$("customerPhone")?.value.trim()],["invoiceRef",$("invoiceRef")?.value.trim()]].forEach(([k,v])=>{if(v&&v!=="all")p.set(k,v)});p.set("limit","5000");return p}
  function message(t){const b=$("managementMessage");if(!b)return;b.textContent=t||"";b.classList.toggle("hidden",!t)}
  function fmtDate(v){if(!v)return"-";const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleString("ar-EG")}
  const money=(v)=>`${Number(v||0).toLocaleString("ar-EG",{maximumFractionDigits:2})} ج`;
  function kpis(id,cards){$(id).innerHTML=cards.map(([l,v,c,s=""])=>`<article class="cs-kpi" style="--tone:${c}"><span>${esc(l)}</span><strong>${esc(v??0)}${esc(s)}</strong></article>`).join("")}
  function complaints(r){
    const s=r.summary||{};
    kpis("managementKpis",[
      ["إجمالي الحالات",s.total,"#667a35"],
      ["الشكاوى",s.complaints,"#dc2626"],
      ["بانتظار المدير",s.pendingReview,"#8b6b28"],
      ["بانتظار الكاميرات",s.pendingMonitor,"#d97706"],
      ["لدى المحاسب",s.pendingAccounting,"#2563eb"],
      ["بانتظار الصرف",s.awaitingPayment,"#7c3aed"],
      ["تم دفعه",s.paidFinancial,"#15803d"],
      ["غير مستحق بالكاميرات",s.rejectedAfterCamera,"#be123c"],
      ["مفتوحة",s.open,"#ea580c"],
      ["متأخرة +48 ساعة",s.overdue,"#c2410c"]
    ]);
    const rows=r.rows||[];
    $("complaintsTabCount").textContent=rows.length;
    $("managementCount").textContent=`عدد الحالات المعروضة: ${rows.length}`;
    $("managementRows").innerHTML=rows.map(x=>`<tr>
      <td>${esc(x.id)}</td><td>${esc(fmtDate(x.createdAt))}</td><td><span class="cs-badge">${esc(x.noteTypeLabel)}</span></td>
      <td><strong>${esc(x.statusLabel)}</strong><small style="display:block">${esc(x.baseStatusLabel||"")}</small></td>
      <td>${esc(x.invoiceRef||"-")}</td><td>${esc(x.customerName||"-")}</td><td>${esc(x.customerPhone||"-")}</td><td>${esc(x.branchCode||"-")}</td>
      <td>${esc(x.employeeName||"-")}</td><td>${esc(x.noteText||"-")}</td><td>${esc(x.managerComment||"-")}</td>
      <td>${esc(x.financialTicketId||"-")}</td>
      <td>${esc(x.monitorDecision==="eligible"?`مستحق${x.monitorAmount!=null?` — ${money(x.monitorAmount)}`:""}`:x.monitorDecision==="not_eligible"?"غير مستحق":"-")}</td>
      <td>${esc(x.accountingDecision||"-")}</td>
      <td>${esc(x.financialOdooMoveName||x.financialOdooPostingStatus||"-")}</td>
      <td>${esc(x.paymentStatus==="paid"?`تم الدفع${x.paidAmount!=null?` — ${money(x.paidAmount)}`:""}`:(x.paymentStatus||"-"))}</td>
      <td>${esc(x.resolutionHours??"-")}</td></tr>`).join("")||'<tr><td colspan="17">لا توجد حالات مطابقة.</td></tr>';
  }
  function messages(r){const s=r.smsSummary||{};kpis("smsManagementKpis",[["إجمالي الرسائل",s.total,"#667a35"],["تم الإرسال",s.sent,"#0f766e"],["إجمالي ردود العملاء",s.reviewed,"#2563eb"],["معدل الرد",s.responseRate,"#7c3aed","%"],["راضٍ جدًا",s.satisfied,"#15803d"],["محايد",s.neutral,"#b4862f"],["غير راضٍ",s.unhappy,"#be123c"],["متوسط التقييم",s.avgRating,"#0369a1"]]);const rows=r.smsRows||[];$("responsesTabCount").textContent=rows.length;$("smsManagementCount").textContent=`عدد ردود العملاء المعروضة: ${rows.length}`;$("smsManagementRows").innerHTML=rows.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(fmtDate(x.reviewedAt||x.createdAt))}</td><td><span class="cs-badge cs-status-${esc(x.status)}">${esc(x.statusLabel)}</span></td><td>${esc(x.invoiceRef||"-")}</td><td>${esc(x.customerName||"-")}</td><td>${esc(x.customerPhone||"-")}</td><td>${esc(x.branchName||"-")}</td><td>${esc(money(x.amountTotal))}</td><td>${esc(x.rating??"-")}</td><td>${esc(x.dissatisfactionReasonLabel||"-")}</td><td>${esc(x.reviewComment||"-")}</td><td>${esc(x.provider||"-")}</td><td>${esc(x.errorMessage||"-")}</td></tr>`).join("")||'<tr><td colspan="13">لا توجد ردود عملاء مطابقة.</td></tr>'}
  function filterSummary(){const from=$("dateFrom")?.value||"—",to=$("dateTo")?.value||"—",type=$("noteType")?.selectedOptions?.[0]?.textContent||"كل الأنواع",status=$("status")?.selectedOptions?.[0]?.textContent||"كل الحالات";$("managementFilterSummary").textContent=activeTab==="complaints"?`${from} إلى ${to} · ${type} · ${status}`:`${from} إلى ${to} · ردود العملاء`}
  function activateTab(tab){activeTab=tab==="responses"?"responses":"complaints";localStorage.setItem(TAB_STORAGE_KEY,activeTab);document.querySelectorAll("[data-report-tab]").forEach(button=>{const selected=button.dataset.reportTab===activeTab;button.classList.toggle("active",selected);button.setAttribute("aria-selected",String(selected))});document.querySelectorAll("[data-report-panel]").forEach(panel=>{panel.hidden=panel.dataset.reportPanel!==activeTab});document.querySelectorAll(".complaint-only-filter").forEach(field=>{field.hidden=activeTab!=="complaints"});filterSummary()}
  function liveState(at=new Date().toISOString()){const l=$("managementLastUpdated");if(l)l.textContent=`${liveEnabled?"تحديث تلقائي كل 15 ثانية":"التحديث التلقائي متوقف"} · آخر تحديث ${fmtDate(at)}`}
  async function load({silent=false}={}){if(loading||document.hidden)return;if(!companyId()){message("اختر الشركة من نطاق العمل العام أولًا.");return}loading=true;if(!silent)message("");try{const response=await fetch(`${API_BASE}/management-report?${query()}`,{headers:headers(),cache:"no-store"}),data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر تحميل التقرير");complaints(data.report||{});messages(data.report||{});liveState(data.report?.generatedAt);message("")}catch(e){message(e.message)}finally{loading=false}}
  function schedule(){clearInterval(liveTimer);liveTimer=liveEnabled?setInterval(()=>load({silent:true}),LIVE_INTERVAL_MS):null;liveState()}
  function toggle(){liveEnabled=!liveEnabled;$("toggleLiveReportBtn").textContent=liveEnabled?"إيقاف التحديث التلقائي":"تشغيل التحديث التلقائي";schedule();if(liveEnabled)load({silent:true})}
  async function exportExcel(){const b=$("exportManagementReportBtn");b.disabled=true;message("");try{const r=await fetch(`${API_BASE}/management-report/export/excel?${query()}`,{headers:headers()});if(!r.ok)throw new Error((await r.text()).slice(0,220)||"تعذر تصدير Excel");const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`customer-service-performance-${new Date().toISOString().slice(0,10)}.xlsx`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}catch(e){message(e.message)}finally{b.disabled=false}}
  document.addEventListener("DOMContentLoaded",()=>{if(typeof window.guardPage==="function"&&!window.guardPage("customer-service-management-report"))return;dates();$("companyId").value=companyId();activateTab(activeTab);document.querySelectorAll("[data-report-tab]").forEach(button=>button.addEventListener("click",()=>activateTab(button.dataset.reportTab)));document.querySelectorAll(".cs-management-filters input,.cs-management-filters select").forEach(field=>field.addEventListener("change",filterSummary));$("loadManagementReportBtn").addEventListener("click",()=>{load();$("managementFilterDrawer").open=false});$("exportManagementReportBtn").addEventListener("click",exportExcel);$("toggleLiveReportBtn").addEventListener("click",toggle);window.addEventListener("company-context-changed",()=>load());window.addEventListener("storage",(event)=>{if(event.key==="mi-customer-service-live")load({silent:true})});document.addEventListener("visibilitychange",()=>{if(!document.hidden&&liveEnabled)load({silent:true})});if("BroadcastChannel" in window){channel=new BroadcastChannel("mi-customer-service-live");channel.addEventListener("message",()=>load({silent:true}))}load();schedule()});
  window.addEventListener("beforeunload",()=>{clearInterval(liveTimer);channel?.close()});
})();
