document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "تشغيل المخازن وإعادة الطلب",
    "تقرير لحظي للشركة: السحب، التوريدات، مخاطر النقص والركود وفق فئات المنتجات في Odoo.",
    "inventory-reorder-risk",
    buildContent()
  );
  document.getElementById("loadReorderRiskBtn")?.addEventListener("click", loadReport);
  document.getElementById("reportExportExcelBtn")?.addEventListener("click", () => window.ReportExport?.downloadExcel("inventory-reorder-risk"));
  document.querySelectorAll(".op-tab").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.tab)));
  initMultiSelects();
  window.addEventListener("company-context-changed", clearReport);
  clearReport();
});

function buildContent() {
  return `<section class="op-filter-card">
    <div class="op-filter-grid">
      <div><label for="warehouseRole">المخزن التشغيلي</label><select id="warehouseRole"><option value="all">الكل</option><option value="main">المخزن الرئيسي</option><option value="finished">مخزن المنتج التام</option></select></div>
      <div><label>مجموعة المنتج</label>${multiSelect("productGroup", [{value:"all",label:"كل المجموعات"},{value:"raw",label:"الخامات"},{value:"packaging",label:"مستلزمات التعبئة"},{value:"finished",label:"المنتج التام"},{value:"resale",label:"المشتراة بغرض البيع"},{value:"unclassified",label:"غير مصنف"}])}</div>
      <div><label>فئة المنتج في Odoo</label>${multiSelect("categoryId", [{value:"all",label:"كل الفئات"}])}</div>
      <div><label for="riskStatus">الحالة</label><select id="riskStatus"><option value="all">كل الحالات</option><option value="very_critical">خطر جدًا</option><option value="critical">خطر</option><option value="normal">طبيعي</option><option value="overstock">مخزون زائد</option><option value="slow">راكد</option></select></div>
      <div><label for="productSearch">بحث</label><input id="productSearch" placeholder="الكود أو الصنف أو الفئة" /></div>
      <div class="op-actions"><button id="loadReorderRiskBtn" class="op-load">تحديث التقرير</button></div>
    </div>
    <p style="margin:12px 0 0;color:#52677c">لا يوجد فلتر تاريخ: السحب محسوب تلقائيًا لآخر 7 و30 يومًا، والتوريدات من بداية العام مقارنةً بنفس الفترة من العام السابق.</p>
  </section>
  <div id="opLoading" class="alert alert-warning hidden">جاري تجميع أرصدة وحركات المخازن...</div><div id="opError" class="alert alert-danger hidden"></div>
  <section id="opKpis" class="op-kpis"></section>
  <section class="op-section"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px"><div><h2 style="margin:0">التقارير التشغيلية</h2><small>اختر القسم المطلوب، ثم يمكنك تصدير المصنف كاملًا إلى Excel.</small></div><button type="button" id="reportExportExcelBtn" class="op-export" style="border:0;border-radius:10px;padding:11px 18px;font-weight:800;cursor:pointer">تصدير Excel</button></div><div class="op-tabs">
    <button class="op-tab active" data-tab="reorder">مخاطر وإعادة الطلب</button><button class="op-tab" data-tab="consumption">متوسطات السحب</button><button class="op-tab" data-tab="supply">التوريدات</button><button class="op-tab" data-tab="slow">الراكد والزائد</button><button class="op-tab" data-tab="category">مراجعة الفئات</button><button class="op-tab" data-tab="notes">منطق الحساب</button>
  </div><div id="opPanes"></div></section>`;
}

function multiSelect(id, options) {
  return `<div class="op-multi" data-multi="${id}"><input type="hidden" id="${id}" value="all"><button type="button" class="op-multi-toggle"><span data-multi-label>الكل</span><span>⌄</span></button><div class="op-multi-menu">${options.map((item,index)=>`<label class="op-multi-option"><input type="checkbox" value="${item.value}" ${index===0?'checked':''}><span>${item.label}</span></label>`).join("")}</div></div>`;
}

function initMultiSelects() {
  document.querySelectorAll(".op-multi").forEach(bindMultiSelect);
  document.addEventListener("click", (event) => {
    document.querySelectorAll(".op-multi.open").forEach((multi) => { if(!multi.contains(event.target)) multi.classList.remove("open"); });
  });
}

function bindMultiSelect(multi) {
  if(multi.dataset.bound==="true") return;
  multi.dataset.bound="true";
  multi.querySelector(".op-multi-toggle")?.addEventListener("click",()=>multi.classList.toggle("open"));
  multi.querySelectorAll('input[type="checkbox"]').forEach((box)=>box.addEventListener("change",()=>syncMultiSelect(multi,box)));
  syncMultiSelect(multi);
}

function syncMultiSelect(multi, changed) {
  const boxes=[...multi.querySelectorAll('input[type="checkbox"]')], all=boxes.find(x=>x.value==="all");
  if(changed?.value==="all" && changed.checked) boxes.filter(x=>x!==all).forEach(x=>x.checked=false);
  if(changed?.value!=="all" && changed?.checked && all) all.checked=false;
  let selected=boxes.filter(x=>x.checked);
  if(!selected.length && all){all.checked=true;selected=[all];}
  const hidden=multi.querySelector('input[type="hidden"]');
  if(hidden) hidden.value=selected.map(x=>x.value).join(",");
  const label=multi.querySelector("[data-multi-label]");
  if(label) label.textContent=selected.some(x=>x.value==="all")?(all?.nextElementSibling?.textContent||"الكل"):selected.length===1?selected[0].nextElementSibling?.textContent:`تم اختيار ${selected.length}`;
}

function filters() { return { companyId: document.getElementById("companySelect")?.value || 1, warehouseRole: val("warehouseRole","all"), productGroup: val("productGroup","all"), categoryId: val("categoryId",""), status: val("riskStatus","all"), search: val("productSearch","") }; }
function val(id, fallback) { return document.getElementById(id)?.value ?? fallback; }
function n(value, digits=2) { const safeDigits=Number.isInteger(digits)?Math.min(6,Math.max(0,digits)):2; return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: safeDigits }); }
function safe(value) { const node=document.createElement("span"); node.textContent=value ?? "-"; return node.innerHTML; }

async function loadReport() {
  const loading=document.getElementById("opLoading"), error=document.getElementById("opError"); loading?.classList.remove("hidden"); error?.classList.add("hidden");
  try { const response=await apiGet("/inventory/operational/reorder-risk", filters()); if(!response.success) throw new Error(response.message||"تعذر تحميل التقرير"); renderReport(response.data||{}); }
  catch(err){ if(error){error.textContent=err.message||"حدث خطأ أثناء تحميل التقرير";error.classList.remove("hidden");} }
  finally { loading?.classList.add("hidden"); }
}

function clearReport() {
  const kpis=document.getElementById("opKpis"), panes=document.getElementById("opPanes"), error=document.getElementById("opError");
  if(kpis) kpis.innerHTML="";
  if(panes) panes.innerHTML='<div class="alert alert-info">حدد الفلاتر المطلوبة ثم اضغط «تحديث التقرير» لعرض البيانات.</div>';
  error?.classList.add("hidden");
}

function renderReport(data) {
  const s=data.summary||{}; document.getElementById("opKpis").innerHTML=[
    ["إجمالي الأصناف",s.products,""],["خطر جدًا",s.veryCritical,"danger"],["خطر",s.critical,"warning"],["طبيعي",s.normal,""],["زائد / راكد",Number(s.overstock||0)+Number(s.slow||0),"warning"],["تحتاج إعادة طلب",s.totalReorderQuantity,"danger"],["مراجعة الفئة",s.categoryIssues,"warning"]
  ].map(([label,value,tone])=>`<article class="op-kpi ${tone}"><span>${label}</span><strong>${n(value,0)}</strong></article>`).join("");
  renderCategoryOptions(data.categoryOptions||[]);
  document.getElementById("opPanes").innerHTML=`
    ${pane("reorder", table(data.reorderRows, reorderCols()), true)}${pane("consumption", table(data.consumptionRows, consumptionCols()))}${pane("supply", table(data.supplyRows, supplyCols()))}${pane("slow", table(data.slowOverstockRows, reorderCols()))}${pane("category", table(data.categoryIssueRows, categoryCols()))}${pane("notes", (data.notes||[]).map(x=>`<div class="op-note">${safe(x)}</div>`).join(""))}`;
}
function renderCategoryOptions(options) {
  const multi=document.querySelector('[data-multi="categoryId"]');
  if(!multi) return;
  const previous=new Set((document.getElementById("categoryId")?.value||"all").split(","));
  multi.querySelector(".op-multi-menu").innerHTML=[{id:"all",name:"كل الفئات"},...options].map((item)=>`<label class="op-multi-option"><input type="checkbox" value="${item.id}" ${previous.has(String(item.id))?'checked':''}><span>${safe(item.name)}</span></label>`).join("");
  multi.querySelectorAll('input[type="checkbox"]').forEach((box)=>box.addEventListener("change",()=>syncMultiSelect(multi,box)));
  syncMultiSelect(multi);
}
function pane(id,html,active=false){return `<div class="op-pane ${active?'active':''}" data-pane="${id}">${html}</div>`;}
function activateTab(id){document.querySelectorAll(".op-tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===id));document.querySelectorAll(".op-pane").forEach(x=>x.classList.toggle("active",x.dataset.pane===id));}
function baseCols(){return [["warehouseName","المخزن"],["defaultCode","الكود"],["barcode","الباركود"],["productName","الصنف"],["categoryPath","مسار الفئة"],["productGroupLabel","المجموعة"]];}
function reorderCols(){return [...baseCols(),["availableQuantity","المتاح",n],["incomingPending","وارد منتظر",n],["avgDailyApproved","متوسط يومي معتمد",n],["daysCover","أيام التغطية",n],["minQuantity","الحد الأدنى",n],["maxQuantity","الحد الأقصى",n],["reorderQuantity","كمية إعادة الطلب",n],["statusLabel","الحالة",(v,r)=>`<span class="risk risk-${r.status}">${safe(v)}</span>`]];}
function consumptionCols(){return [...baseCols(),["withdrawal7Days","سحب 7 أيام",n],["avgDailyWeekly","متوسط يومي أسبوعي",n],["withdrawal30Days","سحب 30 يومًا",n],["avgDailyMonthly","متوسط يومي شهري",n],["avgDailyApproved","المتوسط المعتمد",n],["lastMovementDate","آخر حركة"]];}
function supplyCols(){return [...baseCols(),["currentSupplyTotal","توريد العام الحالي",n],["currentSupplyCount","عدد التوريدات",n],["currentSupplyMin","أقل توريدة",n],["currentSupplyMax","أعلى توريدة",n],["currentSupplyAverage","متوسط التوريدة",n],["previousSupplyTotal","نفس الفترة سابقًا",n],["supplyChangePercent","التغير %",n],["lastSupplyDate","آخر توريد"],["incomingPending","وارد منتظر",n]];}
function categoryCols(){return [...baseCols(),["warehouseRole","دور المخزن"],["categoryMatchesWarehouse","متوافق؟",v=>v?"نعم":"لا"]];}
function table(rows=[],cols=[]){if(!rows.length)return '<div class="alert alert-info">لا توجد بيانات في هذا القسم وفق الفلاتر الحالية.</div>';return `<div class="op-table" tabindex="0"><table><thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${c[2]?c[2](r[c[0]],r):safe(r[c[0]])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;}
