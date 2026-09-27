"use strict";

document.addEventListener("DOMContentLoaded", () => {
  renderLayout("مساهمة أصناف نقاط البيع",
    "صافي الإيراد شامل الضريبة، صافي الوحدات، وعدد فواتير البيع لكل صنف.",
    "pos-product-contribution", `
      <section class="inventory-report-card">
        <p>يعرض التقرير الشركة بالكامل. المرتجعات تخصم من الإيراد والكمية، وعدد الفواتير يحسب فواتير البيع المختلفة.</p>
        <div class="filter-row">
          <label>فئة المنتجات المخزنية
            <select id="contributionStockCategory" class="control"><option value="">كل الفئات المخزنية</option></select>
          </label>
          <label>فئة نقاط البيع
            <select id="contributionPosCategory" class="control"><option value="">كل فئات نقاط البيع</option></select>
          </label>
        </div>
        <button id="exportContribution" class="run-btn" type="button" disabled>تصدير Excel</button>
        <p id="contributionStatus" role="status">حدد الشركة والفترة واضغط تحديث التقرير.</p>
        <div id="contributionSummary"></div>
      </section>
      <section class="inventory-report-card">
        <h2>الأفضل حسب الإيراد والوحدات وعدد الفواتير</h2>
        <div id="contributionLeaders"></div>
      </section>
      <section class="inventory-report-card">
        <h2>مساهمة جميع الأصناف</h2>
        <div style="overflow-x:auto"><table class="table" style="width:100%">
          <thead><tr><th>الصنف</th><th>صافي الإيراد شامل الضريبة</th><th>المساهمة %</th><th>صافي الوحدات</th><th>فواتير البيع</th></tr></thead>
          <tbody id="contributionRows"></tbody>
        </table></div>
      </section>`);
  const branchField = document.getElementById("branchScopeField");
  if (branchField) branchField.hidden = true;
  document.getElementById("loadBtn")?.addEventListener("click", loadContribution);
  document.getElementById("exportContribution")?.addEventListener("click", exportContribution);
  document.getElementById("companySelect")?.addEventListener("change", loadContributionCategories);
  if (document.getElementById("companySelect")?.value) loadContributionCategories();
});

async function loadContributionCategories() {
  const stock = document.getElementById("contributionStockCategory");
  const pos = document.getElementById("contributionPosCategory");
  stock.replaceChildren(new Option("كل الفئات المخزنية", ""));
  pos.replaceChildren(new Option("كل فئات نقاط البيع", ""));
  const companyId = document.getElementById("companySelect")?.value;
  if (!companyId) return;
  try {
    const response = await apiGet("/pos/product-contribution/categories", { companyId });
    if (!response.success || !response.data) throw new Error(response.message || "تعذر تحميل الفئات");
    response.data.stock.forEach(item => stock.add(new Option(item.name, item.id)));
    response.data.pos.forEach(item => pos.add(new Option(item.name, item.id)));
  } catch (error) {
    document.getElementById("contributionStatus").textContent = error.message;
  }
}

function contributionParams() {
  return {
    companyId: document.getElementById("companySelect")?.value,
    dateFrom: document.getElementById("dateFrom")?.value,
    dateTo: document.getElementById("dateTo")?.value,
    stockCategoryId: document.getElementById("contributionStockCategory")?.value || "",
    posCategoryId: document.getElementById("contributionPosCategory")?.value || ""
  };
}

function validateContribution(params) {
  if (!params.companyId || !params.dateFrom || !params.dateTo || params.dateFrom > params.dateTo) {
    throw new Error("حدد الشركة وتاريخ بداية ونهاية صحيحين.");
  }
}

function contributionNumber(value, decimals = 2) {
  return Number(value || 0).toLocaleString("ar-EG", { maximumFractionDigits: decimals });
}

async function loadContribution() {
  const status = document.getElementById("contributionStatus");
  const exportButton = document.getElementById("exportContribution");
  exportButton.disabled = true;
  document.getElementById("contributionRows").replaceChildren();
  document.getElementById("contributionSummary").replaceChildren();
  document.getElementById("contributionLeaders").replaceChildren();
  try {
    const params = contributionParams();
    validateContribution(params);
    status.textContent = "جاري قراءة تقرير Odoo المجمع...";
    const response = await apiGet("/pos/product-contribution", params);
    const report = response.data;
    if (!response.success || !report) throw new Error(response.message || "تعذر تحميل التقرير");
    const summary = document.getElementById("contributionSummary");
    summary.textContent = `صافي الإيراد: ${contributionNumber(report.summary.totalRevenue)} | عدد الأصناف: ${report.summary.productsCount}`;
    const leaders = document.getElementById("contributionLeaders");
    [["أعلى إيراد", report.leaders.revenue], ["أعلى عدد وحدات", report.leaders.units],
      ["الأكثر ظهورًا في الفواتير", report.leaders.receipts]].forEach(([label, item]) => {
      const line = document.createElement("p");
      line.textContent = `${label}: ${item?.productName || "—"}`;
      leaders.appendChild(line);
    });
    const rows = document.getElementById("contributionRows");
    const fragment = document.createDocumentFragment();
    report.products.forEach(item => {
      const tr = document.createElement("tr");
      [item.productName, contributionNumber(item.revenue),
        contributionNumber(item.revenueSharePercent, 4),
        contributionNumber(item.netUnits, 3), contributionNumber(item.sellingReceipts, 0)]
        .forEach(value => { const td = document.createElement("td"); td.textContent = value; tr.appendChild(td); });
      fragment.appendChild(tr);
    });
    rows.appendChild(fragment);
    status.textContent = `تم تحميل ${report.products.length} صنف من ${report.source}.`;
    exportButton.disabled = false;
  } catch (error) {
    status.textContent = error.message || "فشل تحميل التقرير";
  }
}

async function exportContribution() {
  const status = document.getElementById("contributionStatus");
  const button = document.getElementById("exportContribution");
  button.disabled = true;
  try {
    const params = contributionParams();
    validateContribution(params);
    const url = new URL(`${API_BASE_URL}/exports/excel`);
    url.searchParams.set("report", "pos.product_contribution");
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
    if (!response.ok) throw new Error("فشل تصدير Excel؛ أعد تحميل التقرير ثم حاول مرة أخرى.");
    const blobUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `pos-product-contribution-${params.dateFrom}-${params.dateTo}.xlsx`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (error) {
    status.textContent = error.message;
  } finally { button.disabled = false; }
}
