const MOVEMENT_ANALYSIS_PAGE = "inventory-movement-analysis-report";
const MOVEMENT_ANALYSIS_API = "/inventory-movement-analysis";
let movementRequestId = 0;

document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "تحليل حركة الصنف",
    "رصيد أول المدة، الإنتاج، تسويات الجرد، التحويلات، الصرف، ورصيد آخر المدة حسب الصنف أو الفئة.",
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

      <section class="d-flex flex-wrap justify-content-end gap-2 mb-3">
        <button type="button" class="btn btn-outline-secondary" id="locationTraceBtn">
          🔎 تشخيص مواقع الصنف
        </button>
      </section>

      <section id="locationTraceCard" class="mi-report-card mb-4 hidden">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h2 class="mi-report-title mb-1">خريطة مواقع الصنف</h2>
            <small class="text-muted">الرصيد الحالي من stock.quant والحركة التاريخية من stock.move.</small>
          </div>
          <button type="button" class="btn btn-sm btn-outline-secondary" id="closeLocationTraceBtn">إخفاء</button>
        </div>
        <div id="locationTraceMeta" class="alert alert-secondary hidden"></div>
        <div id="locationTraceTable"></div>
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
  document.getElementById("locationTraceBtn")?.addEventListener("click", loadLocationTrace);
  document.getElementById("closeLocationTraceBtn")?.addEventListener("click", () => {
    document.getElementById("locationTraceCard")?.classList.add("hidden");
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


async function loadLocationTrace() {
  const companyId = document.getElementById("companySelect")?.value || "";
  const productId = document.getElementById("productId")?.value || "";
  const search = document.getElementById("productSearch")?.value?.trim() || "";
  const dateFrom = document.getElementById("dateFrom")?.value || "";
  const dateTo = document.getElementById("dateTo")?.value || "";

  if (!companyId) {
    showMovementError("اختار الشركة أولًا.");
    return;
  }

  if (!productId && !search) {
    showMovementError("اختار صنفًا أو اكتب كود الصنف قبل تشغيل تشخيص المواقع.");
    return;
  }

  hideMovementError();

  const button = document.getElementById("locationTraceBtn");
  const card = document.getElementById("locationTraceCard");
  const table = document.getElementById("locationTraceTable");

  if (button) {
    button.disabled = true;
    button.textContent = "جاري تشخيص المواقع...";
  }

  if (card) card.classList.remove("hidden");
  if (table) table.innerHTML = '<div class="alert alert-warning">جاري قراءة stock.quant و stock.move...</div>';

  try {
    const response = await apiGet(`${MOVEMENT_ANALYSIS_API}/location-trace`, {
      companyId,
      productId,
      search,
      dateFrom,
      dateTo
    });

    if (!response?.success) throw new Error(response?.message || "فشل تشخيص مواقع الصنف");
    renderLocationTrace(response.data || {});
  } catch (error) {
    if (table) table.innerHTML = "";
    showMovementError(error.message || "فشل تشخيص مواقع الصنف");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "🔎 تشخيص مواقع الصنف";
    }
  }
}

function renderLocationTrace(data) {
  const product = data.product || {};
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const summary = data.summary || {};
  const meta = document.getElementById("locationTraceMeta");
  const table = document.getElementById("locationTraceTable");

  if (meta) {
    meta.innerHTML = `
      <strong>${escapeMovementHtml(product.defaultCode || "-")} — ${escapeMovementHtml(product.productName || "-")}</strong>
      <div class="mt-1">
        الرصيد الحالي: ${formatMovementNumber(summary.totalCurrentQty)}
        · المتاح: ${formatMovementNumber(summary.totalAvailableQty)}
        · مواقع بها رصيد: ${formatMovementNumber(summary.locationsWithCurrentStock, 0)}
        · مواقع بها حركة: ${formatMovementNumber(summary.locationsWithMovement, 0)}
      </div>
    `;
    meta.classList.remove("hidden");
  }

  if (!table) return;

  if (!rows.length) {
    table.innerHTML = '<div class="alert mi-empty-state">لا توجد أرصدة حالية أو حركات منجزة للصنف داخل المواقع الداخلية.</div>';
    return;
  }

  table.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover table-striped align-middle mi-data-table">
        <thead>
          <tr>
            <th>Location ID</th>
            <th>الموقع</th>
            <th>الموقع الأب</th>
            <th>الرصيد الحالي</th>
            <th>محجوز</th>
            <th>متاح</th>
            <th>وارد خلال الفترة</th>
            <th>صادر خلال الفترة</th>
            <th>صافي الحركة</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeMovementHtml(row.locationId)}</td>
              <td>${escapeMovementHtml(row.completeName || row.locationName || "-")}</td>
              <td>${escapeMovementHtml(row.parentName || "-")}</td>
              <td><strong>${formatMovementNumber(row.currentQty)}</strong></td>
              <td>${formatMovementNumber(row.reservedQty)}</td>
              <td>${formatMovementNumber(row.availableQty)}</td>
              <td>${formatMovementNumber(row.incomingQty)}</td>
              <td>${formatMovementNumber(row.outgoingQty)}</td>
              <td>${formatMovementNumber(row.netMoveQty)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
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
    ["رصيد أول المدة", summary.openingQty],
    ["الكمية المصنعة", summary.manufacturedQty],
    ["تسوية زيادة", summary.adjustmentInQty],
    ["تسوية نقص", summary.adjustmentOutQty],
    ["تحويلات واردة", summary.transferInQty],
    ["تحويلات صادرة", summary.transferOutQty],
    ["وارد آخر", summary.otherIncomingQty],
    ["الكمية المصروفة", summary.issuedQty],
    ["رصيد آخر المدة", summary.closingQty],
    ["فرق المطابقة", summary.reconciliationDifference],
    ["عدد الأصناف", summary.productsCount, 0]
  ];
  document.getElementById("movementKpis").innerHTML = kpis.map(([label, value, digits]) => `
    <div class="col"><article class="mi-kpi-card h-100"><span class="mi-kpi-label">${label}</span><strong class="mi-kpi-value">${formatMovementNumber(value, digits ?? 3)}</strong></article></div>`).join("");

  const rows = Array.isArray(data.rows) ? data.rows : [];
  document.getElementById("movementTable").innerHTML = buildMovementTable(rows);
  const meta = document.getElementById("movementMeta");
  if (meta) {
    const expandedLocations = formatMovementNumber(data.meta?.locationsCount || 0, 0);
    const selectedRoots = formatMovementNumber(data.meta?.selectedLocationRootsCount || 0, 0);
    meta.textContent = data.meta?.selectedLocationRootsCount
      ? `تم تحليل ${formatMovementNumber(rows.length, 0)} صنف. تم اختيار ${selectedRoots} موقع رئيسي، والحساب شمل ${expandedLocations} موقعًا داخليًا بعد احتساب المواقع التابعة.`
      : `تم تحليل ${formatMovementNumber(rows.length, 0)} صنف داخل ${expandedLocations} موقع مخزني.`;
    meta.classList.remove("hidden");
  }
}

function buildMovementTable(rows) {
  if (!rows.length) return '<div class="alert mi-empty-state py-4">لا توجد حركة أصناف داخل الفلاتر المختارة</div>';
  return `<div class="table-responsive"><table class="table table-hover table-striped align-middle mi-data-table">
    <thead><tr>
      <th>كود الصنف</th><th>الصنف</th><th>الفئة</th><th>الوحدة</th>
      <th>رصيد أول المدة</th><th>مصنع</th><th>تسوية +</th><th>تسوية -</th>
      <th>تحويل وارد</th><th>تحويل صادر</th><th>وارد آخر</th><th>مصروف</th>
      <th>رصيد آخر المدة</th><th>فرق المطابقة</th>
    </tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td>${escapeMovementHtml(r.defaultCode || "-")}</td>
      <td>${escapeMovementHtml(r.productName || "-")}</td>
      <td>${escapeMovementHtml(r.categoryName || "-")}</td>
      <td>${escapeMovementHtml(r.uomName || "-")}</td>
      <td>${formatMovementNumber(r.openingQty)}</td>
      <td>${formatMovementNumber(r.manufacturedQty)}</td>
      <td>${formatMovementNumber(r.adjustmentInQty)}</td>
      <td>${formatMovementNumber(r.adjustmentOutQty)}</td>
      <td>${formatMovementNumber(r.transferInQty)}</td>
      <td>${formatMovementNumber(r.transferOutQty)}</td>
      <td>${formatMovementNumber(r.otherIncomingQty)}</td>
      <td>${formatMovementNumber(r.issuedQty)}</td>
      <td><strong>${formatMovementNumber(r.closingQty)}</strong></td>
      <td>${formatMovementNumber(r.reconciliationDifference)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

function formatMovementNumber(value, digits = 3) { return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
function escapeMovementHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function setMovementLoading(on) { document.getElementById("movementLoading")?.classList.toggle("hidden", !on); const b = document.getElementById("loadBtn"); if (b) { b.disabled = on; b.textContent = on ? "جاري التحليل..." : "تحديث التقرير"; } }
function showMovementError(message) { const e = document.getElementById("movementError"); if (e) { e.textContent = message; e.classList.remove("hidden"); } }
function hideMovementError() { document.getElementById("movementError")?.classList.add("hidden"); }
function clearMovementReport() { ["movementKpis", "movementTable"].forEach((id) => { const e = document.getElementById(id); if (e) e.innerHTML = ""; }); document.getElementById("movementMeta")?.classList.add("hidden"); }
