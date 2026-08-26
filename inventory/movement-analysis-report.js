const MOVEMENT_ANALYSIS_PAGE = "inventory-movement-analysis-report";
const MOVEMENT_ANALYSIS_API = "/inventory-movement-analysis";
let movementRequestId = 0;

document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "تحليل حركة الصنف",
    "رصيد أول المدة، الإنتاج، تسويات الجرد، الصرف، ورصيد آخر المدة حسب الصنف أو الفئة.",
    MOVEMENT_ANALYSIS_PAGE,
    buildMovementAnalysisContent()
  );

  setMovementDefaultPeriod();
  bindMovementEvents();
});

function buildMovementAnalysisContent() {
  return `
    <div class="container-fluid mi-bootstrap-page px-0">
      <section class="mi-filter-card">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6 col-xl-3">
            <label class="form-label" for="productSearch">كود أو اسم الصنف</label>
            <input id="productSearch" class="form-control" type="search" placeholder="مثال: 16129 أو توم بودر" autocomplete="off" />
          </div>
          <div class="col-12 col-md-6 col-xl-3">
            <label class="form-label" for="categoryId">فئة المنتج</label>
            <select id="categoryId" class="form-select"><option value="">كل الفئات</option></select>
          </div>
          <div class="col-12 col-md-6 col-xl-3">
            <label class="form-label" for="productId">الصنف</label>
            <select id="productId" class="form-select"><option value="">كل الأصناف</option></select>
          </div>
          <div class="col-12 col-md-6 col-xl-3">
            <label class="form-label" for="locationId">الموقع المخزني</label>
            <select id="locationId" class="form-select"><option value="">كل المواقع الداخلية</option></select>
          </div>
        </div>
      </section>

      <section id="movementLoading" class="alert alert-warning d-flex align-items-center hidden" role="status">
        <span class="spinner-border spinner-border-sm mi-loading-spinner" aria-hidden="true"></span>
        جاري تحليل حركة الأصناف...
      </section>
      <section id="movementError" class="alert alert-danger hidden" role="alert"></section>
      <section id="movementMeta" class="alert alert-info hidden" role="status"></section>

      <section id="movementKpis" class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3 mb-4"></section>

      <section class="mi-report-card">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h2 class="mi-report-title mb-0">حركة الأصناف خلال الفترة</h2>
          <small class="text-muted">تسويات الجرد محسوبة من وإلى مواقع Inventory Adjustment</small>
        </div>
        <div id="movementTable"></div>
      </section>
    </div>`;
}

function setMovementDefaultPeriod() {
  const preset = document.getElementById("datePreset");
  if (preset) preset.value = "thisMonth";
  if (typeof applyDatePreset === "function") applyDatePreset("thisMonth");
}

function bindMovementEvents() {
  document.getElementById("loadBtn")?.addEventListener("click", refreshMovementReport);
  document.getElementById("companySelect")?.addEventListener("change", async () => {
    clearMovementReport();
    resetMovementFilters();
    if (document.getElementById("companySelect")?.value) await loadMovementFiltersSafely();
  });
  document.getElementById("categoryId")?.addEventListener("change", filterProductOptions);
  document.getElementById("productSearch")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") refreshMovementReport();
  });
}

function resetMovementFilters() {
  ["categoryId", "productId", "locationId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">${id === "categoryId" ? "كل الفئات" : id === "productId" ? "كل الأصناف" : "كل المواقع الداخلية"}</option>`;
  });
  window.movementFilterProducts = [];
}

function getMovementParams() {
  return {
    companyId: document.getElementById("companySelect")?.value || "",
    dateFrom: document.getElementById("dateFrom")?.value || "",
    dateTo: document.getElementById("dateTo")?.value || "",
    search: document.getElementById("productSearch")?.value?.trim() || "",
    categoryId: document.getElementById("categoryId")?.value || "",
    productId: document.getElementById("productId")?.value || "",
    locationId: document.getElementById("locationId")?.value || ""
  };
}

function validateMovementParams(params) {
  if (!params.companyId) return "اختار الشركة أولًا.";
  if (!params.dateFrom || !params.dateTo) return "حدد تاريخ البداية والنهاية.";
  if (params.dateFrom > params.dateTo) return "تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.";
  return "";
}

async function loadMovementFiltersSafely() {
  try { await loadMovementFilters(); }
  catch (error) { showMovementError(error.message || "فشل تحميل فلاتر التقرير"); }
}

async function loadMovementFilters() {
  const companyId = document.getElementById("companySelect")?.value;
  if (!companyId) return;
  const response = await apiGet(`${MOVEMENT_ANALYSIS_API}/filters`, { companyId });
  if (!response?.success) throw new Error(response?.message || "فشل تحميل الفلاتر");
  const data = response.data || {};
  window.movementFilterProducts = Array.isArray(data.products) ? data.products : [];
  fillSelect("categoryId", data.categories, "كل الفئات", (x) => x.id, (x) => x.name);
  fillSelect("locationId", data.locations, "كل المواقع الداخلية", (x) => x.id, (x) => x.completeName || x.name);
  filterProductOptions();
}

function fillSelect(id, rows, placeholder, valueFn, labelFn) {
  const select = document.getElementById(id);
  if (!select) return;
  const oldValue = select.value;
  select.innerHTML = `<option value="">${escapeMovementHtml(placeholder)}</option>` +
    (Array.isArray(rows) ? rows : []).map((row) => `<option value="${escapeMovementHtml(valueFn(row))}">${escapeMovementHtml(labelFn(row))}</option>`).join("");
  if ([...select.options].some((o) => o.value === oldValue)) select.value = oldValue;
}

function filterProductOptions() {
  const categoryId = Number(document.getElementById("categoryId")?.value || 0);
  const products = (window.movementFilterProducts || []).filter((p) => !categoryId || Number(p.categoryId) === categoryId);
  fillSelect("productId", products, "كل الأصناف", (p) => p.productId, (p) => `${p.defaultCode ? `[${p.defaultCode}] ` : ""}${p.productName}`);
}

async function refreshMovementReport() {
  const params = getMovementParams();
  const validation = validateMovementParams(params);
  if (validation) { showMovementError(validation); return; }
  const requestId = ++movementRequestId;
  setMovementLoading(true);
  hideMovementError();
  try {
    if (!(window.movementFilterProducts || []).length) await loadMovementFilters();
    const response = await apiGet(`${MOVEMENT_ANALYSIS_API}/report`, params);
    if (requestId !== movementRequestId) return;
    if (!response?.success) throw new Error(response?.message || "فشل تحميل التقرير");
    renderMovementReport(response.data || {});
  } catch (error) {
    if (requestId === movementRequestId) showMovementError(error.message || "حدث خطأ أثناء تحميل التقرير");
  } finally {
    if (requestId === movementRequestId) setMovementLoading(false);
  }
}

function renderMovementReport(data) {
  const summary = data.summary || {};
  const kpis = [
    ["رصيد أول المدة", summary.openingQty], ["الكمية المصنعة", summary.manufacturedQty],
    ["تسوية زيادة", summary.adjustmentInQty], ["تسوية نقص", summary.adjustmentOutQty],
    ["صافي التسوية", summary.netAdjustmentQty], ["الكمية المصروفة", summary.issuedQty],
    ["رصيد آخر المدة", summary.closingQty], ["عدد الأصناف", summary.productsCount, 0]
  ];
  document.getElementById("movementKpis").innerHTML = kpis.map(([label, value, digits]) => `
    <div class="col"><article class="mi-kpi-card h-100"><span class="mi-kpi-label">${label}</span><strong class="mi-kpi-value">${formatMovementNumber(value, digits ?? 3)}</strong></article></div>`).join("");

  const rows = Array.isArray(data.rows) ? data.rows : [];
  document.getElementById("movementTable").innerHTML = buildMovementTable(rows);
  const meta = document.getElementById("movementMeta");
  if (meta) {
    meta.textContent = `تم تحليل ${formatMovementNumber(rows.length, 0)} صنف داخل ${formatMovementNumber(data.meta?.locationsCount || 0, 0)} موقع مخزني.`;
    meta.classList.remove("hidden");
  }
}

function buildMovementTable(rows) {
  if (!rows.length) return '<div class="alert mi-empty-state py-4">لا توجد حركة أصناف داخل الفلاتر المختارة</div>';
  return `<div class="table-responsive"><table class="table table-hover table-striped align-middle mi-data-table">
    <thead><tr><th>كود الصنف</th><th>الصنف</th><th>الفئة</th><th>الوحدة</th><th>رصيد أول المدة</th><th>مصنع</th><th>تسوية +</th><th>تسوية -</th><th>صافي التسوية</th><th>مصروف</th><th>رصيد آخر المدة</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td>${escapeMovementHtml(r.defaultCode || "-")}</td><td>${escapeMovementHtml(r.productName || "-")}</td><td>${escapeMovementHtml(r.categoryName || "-")}</td><td>${escapeMovementHtml(r.uomName || "-")}</td>
      <td>${formatMovementNumber(r.openingQty)}</td><td>${formatMovementNumber(r.manufacturedQty)}</td><td>${formatMovementNumber(r.adjustmentInQty)}</td><td>${formatMovementNumber(r.adjustmentOutQty)}</td><td>${formatMovementNumber(r.netAdjustmentQty)}</td><td>${formatMovementNumber(r.issuedQty)}</td><td><strong>${formatMovementNumber(r.closingQty)}</strong></td>
    </tr>`).join("")}</tbody></table></div>`;
}

function formatMovementNumber(value, digits = 3) { return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
function escapeMovementHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function setMovementLoading(on) { document.getElementById("movementLoading")?.classList.toggle("hidden", !on); const b = document.getElementById("loadBtn"); if (b) { b.disabled = on; b.textContent = on ? "جاري التحليل..." : "تحديث التقرير"; } }
function showMovementError(message) { const e = document.getElementById("movementError"); if (e) { e.textContent = message; e.classList.remove("hidden"); } }
function hideMovementError() { document.getElementById("movementError")?.classList.add("hidden"); }
function clearMovementReport() { ["movementKpis", "movementTable"].forEach((id) => { const e = document.getElementById(id); if (e) e.innerHTML = ""; }); document.getElementById("movementMeta")?.classList.add("hidden"); }
