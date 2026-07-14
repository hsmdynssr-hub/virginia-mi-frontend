document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "تشغيل المخازن وإعادة الطلب",
    "تقرير لحظي للشركة: السحب، التوريدات، مخاطر النقص والركود وفق فئات المنتجات في Odoo.",
    "inventory-reorder-risk",
    buildContent()
  );
  document.getElementById("loadReorderRiskBtn")?.addEventListener("click", loadReport);
  document.getElementById("loadBtn")?.addEventListener("click", loadReport);
  document.querySelectorAll(".op-tab").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.tab)));
  window.addEventListener("company-context-changed", loadReport);
  loadReport();
});

function buildContent() {
  return `<section class="op-filter-card">
    <div class="op-filter-grid">
      <div><label for="warehouseRole">المخزن التشغيلي</label><select id="warehouseRole"><option value="all">الكل</option><option value="main">المخزن الرئيسي</option><option value="finished">مخزن المنتج التام</option></select></div>
      <div><label for="productGroup">مجموعة المنتج</label><select id="productGroup"><option value="all">الكل</option><option value="raw">الخامات</option><option value="packaging">مستلزمات التعبئة</option><option value="finished">المنتج التام</option><option value="resale">المشتراة بغرض البيع</option><option value="unclassified">غير مصنف</option></select></div>
      <div><label for="categoryId">فئة المنتج في Odoo</label><select id="categoryId"><option value="">كل الفئات</option></select></div>
      <div><label for="riskStatus">الحالة</label><select id="riskStatus"><option value="all">كل الحالات</option><option value="very_critical">خطر جدًا</option><option value="critical">خطر</option><option value="normal">طبيعي</option><option value="overstock">مخزون زائد</option><option value="slow">راكد</option></select></div>
      <div><label for="productSearch">بحث</label><input id="productSearch" placeholder="الكود أو الصنف أو الفئة" /></div>
      <div class="op-actions"><button id="loadReorderRiskBtn" class="op-load">تحديث التقرير</button></div>
    </div>
    <p style="margin:12px 0 0;color:#52677c">لا يوجد فلتر تاريخ: السحب محسوب تلقائيًا لآخر 7 و30 يومًا، والتوريدات من بداية العام مقارنةً بنفس الفترة من العام السابق.</p>
  </section>
  <div id="opLoading" class="alert alert-warning hidden">جاري تجميع أرصدة وحركات المخازن...</div><div id="opError" class="alert alert-danger hidden"></div>
  <section id="opKpis" class="op-kpis"></section>
  <section class="op-section"><div class="op-tabs">
    <button class="op-tab active" data-tab="reorder">مخاطر وإعادة الطلب</button><button class="op-tab" data-tab="consumption">متوسطات السحب</button><button class="op-tab" data-tab="supply">التوريدات</button><button class="op-tab" data-tab="slow">الراكد والزائد</button><button class="op-tab" data-tab="category">مراجعة الفئات</button><button class="op-tab" data-tab="notes">منطق الحساب</button>
  </div><div id="opPanes"></div></section>`;
}

function filters() { return { companyId: document.getElementById("companySelect")?.value || 1, warehouseRole: val("warehouseRole","all"), productGroup: val("productGroup","all"), categoryId: val("categoryId",""), status: val("riskStatus","all"), search: val("productSearch","") }; }
function val(id, fallback) { return document.getElementById(id)?.value ?? fallback; }
function n(value, digits=2) { return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: digits }); }
function safe(value) { const node=document.createElement("span"); node.textContent=value ?? "-"; return node.innerHTML; }

async function loadReport() {
  const loading=document.getElementById("opLoading"), error=document.getElementById("opError"); loading?.classList.remove("hidden"); error?.classList.add("hidden");
  try { const response=await apiGet("/inventory/operational/reorder-risk", filters()); if(!response.success) throw new Error(response.message||"تعذر تحميل التقرير"); renderReport(response.data||{}); }
  catch(err){ if(error){error.textContent=err.message||"حدث خطأ أثناء تحميل التقرير";error.classList.remove("hidden");} }
  finally { loading?.classList.add("hidden"); }
}

function renderReport(data) {
  const s=data.summary||{}; document.getElementById("opKpis").innerHTML=[
    ["إجمالي الأصناف",s.products,""],["خطر جدًا",s.veryCritical,"danger"],["خطر",s.critical,"warning"],["طبيعي",s.normal,""],["زائد / راكد",Number(s.overstock||0)+Number(s.slow||0),"warning"],["تحتاج إعادة طلب",s.totalReorderQuantity,"danger"],["مراجعة الفئة",s.categoryIssues,"warning"]
  ].map(([label,value,tone])=>`<article class="op-kpi ${tone}"><span>${label}</span><strong>${n(value,0)}</strong></article>`).join("");
  const category=document.getElementById("categoryId"), selected=category?.value||""; if(category){category.innerHTML='<option value="">كل الفئات</option>'+ (data.categoryOptions||[]).map(x=>`<option value="${x.id}">${safe(x.name)}</option>`).join("");category.value=selected;}
  document.getElementById("opPanes").innerHTML=`
    ${pane("reorder", table(data.reorderRows, reorderCols()), true)}${pane("consumption", table(data.consumptionRows, consumptionCols()))}${pane("supply", table(data.supplyRows, supplyCols()))}${pane("slow", table(data.slowOverstockRows, reorderCols()))}${pane("category", table(data.categoryIssueRows, categoryCols()))}${pane("notes", (data.notes||[]).map(x=>`<div class="op-note">${safe(x)}</div>`).join(""))}`;
}
function pane(id,html,active=false){return `<div class="op-pane ${active?'active':''}" data-pane="${id}">${html}</div>`;}
function activateTab(id){document.querySelectorAll(".op-tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===id));document.querySelectorAll(".op-pane").forEach(x=>x.classList.toggle("active",x.dataset.pane===id));}
function baseCols(){return [["warehouseName","المخزن"],["defaultCode","الكود"],["productName","الصنف"],["categoryPath","مسار الفئة"],["productGroupLabel","المجموعة"]];}
function reorderCols(){return [...baseCols(),["availableQuantity","المتاح",n],["incomingPending","وارد منتظر",n],["avgDailyApproved","متوسط يومي معتمد",n],["daysCover","أيام التغطية",n],["minQuantity","الحد الأدنى",n],["maxQuantity","الحد الأقصى",n],["reorderQuantity","كمية إعادة الطلب",n],["statusLabel","الحالة",(v,r)=>`<span class="risk risk-${r.status}">${safe(v)}</span>`]];}
function consumptionCols(){return [...baseCols(),["withdrawal7Days","سحب 7 أيام",n],["avgDailyWeekly","متوسط يومي أسبوعي",n],["withdrawal30Days","سحب 30 يومًا",n],["avgDailyMonthly","متوسط يومي شهري",n],["avgDailyApproved","المتوسط المعتمد",n],["lastMovementDate","آخر حركة"]];}
function supplyCols(){return [...baseCols(),["currentSupplyTotal","توريد العام الحالي",n],["currentSupplyCount","عدد التوريدات",n],["currentSupplyMin","أقل توريدة",n],["currentSupplyMax","أعلى توريدة",n],["currentSupplyAverage","متوسط التوريدة",n],["previousSupplyTotal","نفس الفترة سابقًا",n],["supplyChangePercent","التغير %",n],["lastSupplyDate","آخر توريد"],["incomingPending","وارد منتظر",n]];}
function categoryCols(){return [...baseCols(),["warehouseRole","دور المخزن"],["categoryMatchesWarehouse","متوافق؟",v=>v?"نعم":"لا"]];}
function table(rows=[],cols=[]){if(!rows.length)return '<div class="alert alert-info">لا توجد بيانات في هذا القسم وفق الفلاتر الحالية.</div>';return `<div class="op-table" tabindex="0"><table><thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${c[2]?c[2](r[c[0]],r):safe(r[c[0]])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;}
