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
          <div class="col-12">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <label class="form-label mb-0">المواقع المخزنية</label>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-primary" id="selectAllLocationsBtn">تحديد الكل</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" id="clearLocationsBtn">إلغاء الكل</button>
              </div>
            </div>
            <div id="locationCheckboxes" class="border rounded-3 p-3 bg-body-tertiary" style="max-height:220px; overflow:auto;">
              <div class="text-muted small">اختار الشركة أولًا لتحميل المواقع.</div>
            </div>
            <div class="form-text mt-2">يمكن اختيار أكثر من موقع مخزني في نفس التقرير. عدم اختيار أي موقع = كل المواقع الداخلية.</div>
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
  document.getElementById("selectAllLocationsBtn")?.addEventListener("click", () => {
    document.querySelectorAll('input[name="movementLocation"]').forEach((checkbox) => { checkbox.checked = true; });
    updateSelectedLocationsLabel();
  });
  document.getElementById("clearLocationsBtn")?.addEventListener("click", () => {
    document.querySelectorAll('input[name="movementLocation"]').forEach((checkbox) => { checkbox.checked = false; });
    updateSelectedLocationsLabel();
  });
  document.getElementById("locationCheckboxes")?.addEventListener("change", (event) => {
    if (event.target?.matches?.('input[name="movementLocation"]')) updateSelectedLocationsLabel();
  });
  document.getElementById("productSearch")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") refreshMovementReport();
  });
}

function resetMovementFilters() {
  ["categoryId", "productId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">${id === "categoryId" ? "كل الفئات" : "كل الأصناف"}</option>`;
  });
  const locationBox = document.getElementById("locationCheckboxes");
  if (locationBox) locationBox.innerHTML = '<div class="text-muted small">اختار الشركة أولًا لتحميل المواقع.</div>';
  window.movementFilterProducts = [];
  window.movementFilterLocations = [];
}

function getMovementParams() {
  return {
    companyId: document.getElementById("companySelect")?.value || "",
    dateFrom: document.getElementById("dateFrom")?.value || "",
    dateTo: document.getElementById("dateTo")?.value || "",
    search: document.getElementById("productSearch")?.value?.trim() || "",
    categoryId: document.getElementById("categoryId")?.value || "",
    productId: document.getElementById("productId")?.value || "",
    locationIds: getSelectedLocationIds().join(",")
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
  window.movementFilterLocations = Array.isArray(data.locations) ? data.locations : [];
  fillSelect("categoryId", data.categories, "كل الفئات", (x) => x.id, (x) => x.name);
  renderLocationCheckboxes(window.movementFilterLocations);
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

function renderLocationCheckboxes(rows) {
  const container = document.getElementById("locationCheckboxes");
  if (!container) return;

  const locations = Array.isArray(rows) ? rows : [];
  if (!locations.length) {
    container.innerHTML = '<div class="text-muted small">لا توجد مواقع داخلية متاحة لهذه الشركة.</div>';
    return;
  }

  container.innerHTML = `
    <div id="selectedLocationsLabel" class="small fw-semibold mb-2">كل المواقع الداخلية</div>
    <div class="row g-2">
      ${locations.map((location) => `
        <div class="col-12 col-md-6 col-xl-4">
          <label class="form-check border rounded-2 p-2 h-100 bg-white">
            <input class="form-check-input ms-2" type="checkbox" name="movementLocation" value="${escapeMovementHtml(location.id)}">
            <span class="form-check-label">${escapeMovementHtml(location.completeName || location.name || location.id)}</span>
          </label>
        </div>
      `).join("")}
    </div>
  `;
  updateSelectedLocationsLabel();
}

function getSelectedLocationIds() {
  return Array.from(document.querySelectorAll('input[name="movementLocation"]:checked'))
    .map((checkbox) => Number(checkbox.value))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function updateSelectedLocationsLabel() {
  const label = document.getElementById("selectedLocationsLabel");
  if (!label) return;
  const selected = getSelectedLocationIds();
  const total = Array.isArray(window.movementFilterLocations) ? window.movementFilterLocations.length : 0;
  label.textContent = selected.length
    ? `تم اختيار ${selected.length} من ${total} موقع`
    : "كل المواقع الداخلية";
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
