const HISTORICAL_REPORT_PAGE = "inventory-historical-executive-summary";
const HISTORICAL_API_PATH = "/inventory-historical";

let historicalReportRequestId = 0;

document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "المخزون التنفيذي التاريخي",
    "قيمة المخزون والوارد والصرف ومعدل الدوران محسوبة تاريخيًا طبقًا للفترة والفلاتر المختارة.",
    HISTORICAL_REPORT_PAGE,
    buildHistoricalInventoryContent()
  );

  setHistoricalDefaultPeriod();
  bindHistoricalInventoryEvents();
});

function buildHistoricalInventoryContent() {
  return `
    <div class="container-fluid mi-bootstrap-page px-0">
      <section class="mi-filter-card">
        <div class="row g-3">
          <div class="col-12 col-md-6 col-xl">
            <label class="form-label" for="storageCategory">فئة التخزين</label>
            <select id="storageCategory" class="form-select">
              <option value="">كل فئات التخزين</option>
            </select>
          </div>

          <div class="col-12 col-md-6 col-xl">
            <label class="form-label" for="locationId">الموقع المخزني</label>
            <select id="locationId" class="form-select">
              <option value="">كل المواقع</option>
            </select>
          </div>

          <div class="col-12 col-md-6 col-xl">
            <label class="form-label" for="productType">نوع المنتج</label>
            <select id="productType" class="form-select">
              <option value="">كل الأنواع</option>
              <option value="RAW_MATERIALS">خامات</option>
              <option value="PACKAGING">مستلزمات / تعبئة</option>
              <option value="FINISHED_GOODS">منتج تام</option>
              <option value="PURCHASED_FOR_RESALE">مشتراه بغرض البيع</option>
              <option value="WORK_IN_PROGRESS">شبه نهائي / تحت التشغيل</option>
              <option value="OTHER">غير مصنف</option>
            </select>
          </div>

          <div class="col-12 col-md-6 col-xl">
            <label class="form-label" for="categoryId">فئة المنتج</label>
            <select id="categoryId" class="form-select">
              <option value="">كل الفئات</option>
            </select>
          </div>

          <div class="col-12 col-md-6 col-xl">
            <label class="form-label" for="productId">المنتج</label>
            <select id="productId" class="form-select">
              <option value="">كل المنتجات</option>
            </select>
          </div>
        </div>
      </section>

      <section id="loadingBox" class="alert alert-warning d-flex align-items-center hidden" role="status">
        <span class="spinner-border spinner-border-sm mi-loading-spinner" aria-hidden="true"></span>
        جاري احتساب الأرصدة التاريخية...
      </section>

      <section id="errorBox" class="alert alert-danger hidden" role="alert"></section>
      <section id="reportMeta" class="alert alert-info hidden" role="status"></section>

      <section id="kpiGrid" class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3 mb-4"></section>

      <section class="row g-3 mb-1">
        <div class="col-12 col-xl-6">
          <div class="mi-report-card h-100">
            <h2 class="mi-report-title">توزيع مخزون آخر الفترة حسب نوع المنتج</h2>
            <div id="productTypeBreakdown"></div>
          </div>
        </div>
        <div class="col-12 col-xl-6">
          <div class="mi-report-card h-100">
            <h2 class="mi-report-title">توزيع مخزون آخر الفترة حسب فئة التخزين</h2>
            <div id="storageBreakdown"></div>
          </div>
        </div>
      </section>

      <section class="mi-report-card">
        <h2 class="mi-report-title">حركة الأصناف خلال الفترة</h2>
        <div id="periodMovement"></div>
      </section>

      <section class="mi-report-card">
        <h2 class="mi-report-title">أعلى أصناف حابسة لقيمة المخزون</h2>
        <div id="topInventoryValue"></div>
      </section>

      <section class="mi-report-card">
        <h2 class="mi-report-title">أسرع أصناف دورانًا</h2>
        <div id="topFastMoving"></div>
      </section>

      <section class="mi-report-card">
        <h2 class="mi-report-title">أصناف بطيئة الحركة</h2>
        <div id="slowMoving"></div>
      </section>
    </div>
  `;
}

function setHistoricalDefaultPeriod() {
  const datePreset = document.getElementById("datePreset");
  if (datePreset) datePreset.value = "thisMonth";
  if (typeof applyDatePreset === "function") {
    applyDatePreset("thisMonth");
  }
}

function bindHistoricalInventoryEvents() {
  document.getElementById("loadBtn")?.addEventListener("click", refreshHistoricalReport);

  document.getElementById("companySelect")?.addEventListener("change", async () => {
    resetHistoricalDependentFilters("companySelect");
    clearHistoricalReport();
    if (document.getElementById("companySelect")?.value) {
      await loadHistoricalFilterOptionsSafely();
    }
  });

  ["storageCategory", "productType", "locationId", "categoryId"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", async () => {
      resetHistoricalDependentFilters(id);
      if (document.getElementById("companySelect")?.value) {
        await loadHistoricalFilterOptionsSafely();
      }
    });
  });
}

function resetHistoricalDependentFilters(changedId) {
  const location = document.getElementById("locationId");
  const category = document.getElementById("categoryId");
  const product = document.getElementById("productId");

  if (["companySelect", "storageCategory", "productType"].includes(changedId)) {
    if (location) location.value = "";
    if (category) category.value = "";
    if (product) product.value = "";
    return;
  }

  if (changedId === "locationId") {
    if (category) category.value = "";
    if (product) product.value = "";
    return;
  }

  if (changedId === "categoryId" && product) {
    product.value = "";
  }
}

function getHistoricalFilters() {
  return {
    companyId: document.getElementById("companySelect")?.value || "",
    dateFrom: document.getElementById("dateFrom")?.value || "",
    dateTo: document.getElementById("dateTo")?.value || "",
    storageCategory: document.getElementById("storageCategory")?.value || "",
    locationId: document.getElementById("locationId")?.value || "",
    productType: document.getElementById("productType")?.value || "",
    categoryId: document.getElementById("categoryId")?.value || "",
    productId: document.getElementById("productId")?.value || ""
  };
}

function validateHistoricalFilters(filters) {
  if (!filters.companyId) return "لازم تختار الشركة أولًا.";
  if (!filters.dateFrom || !filters.dateTo) return "لازم تحدد تاريخ البداية والنهاية.";
  if (filters.dateFrom > filters.dateTo) return "تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.";
  return "";
}

async function refreshHistoricalReport() {
  const filters = getHistoricalFilters();
  const validationError = validateHistoricalFilters(filters);
  if (validationError) {
    showHistoricalError(validationError);
    clearHistoricalReport();
    return;
  }

  const requestId = ++historicalReportRequestId;
  setHistoricalLoading(true);
  hideHistoricalError();

  try {
    await loadHistoricalFilterOptions();
    const response = await apiGet(`${HISTORICAL_API_PATH}/executive-summary`, filters);
    if (requestId !== historicalReportRequestId) return;
    if (!response?.success) {
      throw new Error(response?.message || "فشل تحميل التقرير التاريخي");
    }
    renderHistoricalReport(response.data || {});
  } catch (error) {
    if (requestId !== historicalReportRequestId) return;
    console.error(error);
    showHistoricalError(error.message || "حدث خطأ أثناء تحميل التقرير التاريخي");
  } finally {
    if (requestId === historicalReportRequestId) setHistoricalLoading(false);
  }
}

async function loadHistoricalFilterOptionsSafely() {
  try {
    hideHistoricalError();
    await loadHistoricalFilterOptions();
  } catch (error) {
    console.error(error);
    showHistoricalError(error.message || "فشل تحميل فلاتر المخزون التاريخي");
  }
}

async function loadHistoricalFilterOptions() {
  const filters = getHistoricalFilters();
  if (!filters.companyId) return;

  const response = await apiGet(`${HISTORICAL_API_PATH}/filters`, {
    companyId: filters.companyId,
    dateTo: filters.dateTo,
    storageCategory: filters.storageCategory,
    productType: filters.productType,
    locationId: filters.locationId,
    categoryId: filters.categoryId
  });

  if (!response?.success) {
    throw new Error(response?.message || "فشل تحميل الفلاتر");
  }

  renderHistoricalFilterOptions(response.data || {});
}

function renderHistoricalFilterOptions(data) {
  fillHistoricalSelect({
    elementId: "storageCategory",
    rows: data.storageCategories || [],
    valueKey: "value",
    defaultLabel: "كل فئات التخزين",
    labelBuilder: (row) => {
      const count = row.locationsCount === undefined ? "" : ` — ${formatHistoricalNumber(row.locationsCount, 0)} موقع`;
      return `${escapeHtml(row.label || row.name || row.value || "-")}${count}`;
    }
  });

  fillHistoricalSelect({
    elementId: "locationId",
    rows: data.locations || [],
    valueKey: "id",
    defaultLabel: "كل المواقع",
    labelBuilder: (row) => `${escapeHtml(row.name || "-")} — ${formatHistoricalMoney(row.inventoryValue)}`
  });

  fillHistoricalSelect({
    elementId: "categoryId",
    rows: data.categories || [],
    valueKey: "id",
    defaultLabel: "كل الفئات",
    labelBuilder: (row) => {
      const type = row.productTypeLabel ? ` / ${escapeHtml(row.productTypeLabel)}` : "";
      return `${escapeHtml(row.name || "-")}${type} — ${formatHistoricalMoney(row.inventoryValue)}`;
    }
  });

  fillHistoricalSelect({
    elementId: "productId",
    rows: data.products || [],
    valueKey: "id",
    defaultLabel: "كل المنتجات",
    labelBuilder: (row) => {
      const code = row.defaultCode ? ` [${escapeHtml(row.defaultCode)}]` : "";
      return `${escapeHtml(row.name || "-")}${code} — ${formatHistoricalMoney(row.inventoryValue)}`;
    }
  });
}

function fillHistoricalSelect({ elementId, rows, valueKey, defaultLabel, labelBuilder }) {
  const select = document.getElementById(elementId);
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;
  select.appendChild(defaultOption);

  rows.forEach((row) => {
    const value = row[valueKey];
    if (value === undefined || value === null || value === "") return;
    const option = document.createElement("option");
    option.value = String(value);
    option.innerHTML = labelBuilder(row);
    select.appendChild(option);
  });

  if ([...select.options].some((option) => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function renderHistoricalReport(data) {
  const summary = data.summary || {};
  renderHistoricalKpis(summary);
  renderHistoricalMeta(data);
  renderHistoricalBreakdown("productTypeBreakdown", data.breakdownByProductType || [], "productTypeLabel");
  renderHistoricalBreakdown("storageBreakdown", data.breakdownByStorageCategory || [], "storageCategoryName");
  renderHistoricalMovement(data.movementRows || []);
  renderHistoricalTopValue(data.topInventoryValue || []);
  renderHistoricalFastMoving(data.topFastMoving || []);
  renderHistoricalSlowMoving(data.slowMoving || []);
}

function renderHistoricalMeta(data) {
  const box = document.getElementById("reportMeta");
  if (!box) return;
  const filters = data.filters || {};
  const meta = data.meta || {};
  box.innerHTML = `رصيد أول الفترة حتى <strong>${escapeHtml(filters.openingDate || "-")}</strong>، ورصيد آخر الفترة في <strong>${escapeHtml(filters.dateTo || "-")}</strong>، داخل <strong>${formatHistoricalNumber(meta.locationsCount, 0)}</strong> موقع مخزني.`;
  box.classList.remove("hidden");
}

function renderHistoricalKpis(summary) {
  const grid = document.getElementById("kpiGrid");
  if (!grid) return;

  const cards = [
    ["قيمة أول الفترة", formatHistoricalMoney(summary.openingInventoryValue), "الرصيد التاريخي قبل بداية الفترة"],
    ["قيمة آخر الفترة", formatHistoricalMoney(summary.closingInventoryValue), "الرصيد التاريخي في نهاية الفترة"],
    ["متوسط المخزون", formatHistoricalMoney(summary.averageInventoryValue), "متوسط قيمة أول وآخر الفترة"],
    ["قيمة الوارد", formatHistoricalMoney(summary.receiptsValue), "قيمة الحركات الداخلة لنطاق الفلتر"],
    ["قيمة الصرف", formatHistoricalMoney(summary.consumptionValue), "قيمة الحركات الخارجة من نطاق الفلتر"],
    ["صافي التغير", formatHistoricalMoney(summary.netChangeValue), "آخر الفترة ناقص أول الفترة"],
    ["معدل الدوران", formatHistoricalNumber(summary.turnoverRate, 4), "الصرف ÷ متوسط قيمة المخزون"],
    ["أيام التغطية", summary.daysOnHand == null ? "-" : formatHistoricalNumber(summary.daysOnHand, 2), "أيام الفترة ÷ معدل الدوران"],
    ["عدد الأصناف", formatHistoricalNumber(summary.skuCount, 0), "أصناف لها رصيد في نهاية الفترة"],
    ["كمية آخر الفترة", formatHistoricalQty(summary.totalQty), "إجمالي الكمية بعد تطبيق الفلاتر"],
    ["أصناف سالبة", formatHistoricalNumber(summary.negativeItems, 0), "عدد المنتجات ذات الرصيد السالب"],
    ["قيمة سالبة", formatHistoricalMoney(summary.negativeValue), "قيمة الأرصدة السالبة" ]
  ];
  const tones = ["teal", "success", "purple", "teal", "warning", "purple", "success", "teal", "purple", "success", "danger", "danger"];
  const icons = ["◀", "▶", "≈", "↓", "↑", "±", "↻", "📅", "📦", "⚖", "⚠", "▼"];

  grid.innerHTML = cards.map((card, index) => `
    <div class="col">
      <div class="mi-kpi-card h-100" data-tone="${tones[index]}" data-icon="${icons[index]}" style="--mi-delay:${index * 35}ms">
        <span class="mi-kpi-label">${card[0]}</span>
        <strong class="mi-kpi-value">${card[1]}</strong>
        <small class="mi-kpi-hint">${card[2]}</small>
      </div>
    </div>
  `).join("");
}

function renderHistoricalBreakdown(elementId, rows, nameKey) {
  setHistoricalTable(elementId, [
    { label: "البند", render: (row) => escapeHtml(row[nameKey] || "-") },
    { label: "عدد الأصناف", render: (row) => formatHistoricalNumber(row.skuCount, 0) },
    { label: "الكمية", render: (row) => formatHistoricalQty(row.quantity) },
    { label: "القيمة", render: (row) => formatHistoricalMoney(row.inventoryValue) }
  ], rows);
}

function renderHistoricalMovement(rows) {
  setHistoricalTable("periodMovement", movementColumns(), rows.slice(0, 100));
}

function renderHistoricalTopValue(rows) {
  setHistoricalTable("topInventoryValue", [
    identityProductColumn(),
    { label: "الكود", render: (row) => escapeHtml(row.defaultCode || "-") },
    { label: "النوع", render: (row) => escapeHtml(row.productTypeLabel || "-") },
    { label: "الكمية", render: (row) => formatHistoricalQty(row.quantity) },
    { label: "تكلفة الوحدة", render: (row) => formatHistoricalMoney(row.unitCost) },
    { label: "قيمة المخزون", render: (row) => formatHistoricalMoney(row.inventoryValue) }
  ], rows);
}

function renderHistoricalFastMoving(rows) {
  setHistoricalTable("topFastMoving", movementColumns(), rows);
}

function renderHistoricalSlowMoving(rows) {
  setHistoricalTable("slowMoving", movementColumns(), rows);
}

function identityProductColumn() {
  return { label: "الصنف", render: (row) => escapeHtml(row.productName || "-") };
}

function movementColumns() {
  return [
    identityProductColumn(),
    { label: "الكود", render: (row) => escapeHtml(row.defaultCode || "-") },
    { label: "قيمة أول الفترة", render: (row) => formatHistoricalMoney(row.openingInventoryValue) },
    { label: "قيمة الوارد", render: (row) => formatHistoricalMoney(row.receiptsValue) },
    { label: "قيمة الصرف", render: (row) => formatHistoricalMoney(row.consumptionValue) },
    { label: "قيمة آخر الفترة", render: (row) => formatHistoricalMoney(row.closingInventoryValue) },
    { label: "معدل الدوران", render: (row) => formatHistoricalNumber(row.turnoverRate, 4) },
    { label: "أيام التغطية", render: (row) => row.daysOnHand == null ? "-" : formatHistoricalNumber(row.daysOnHand, 2) }
  ];
}

function setHistoricalTable(elementId, columns, rows) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = buildHistoricalTable(columns, rows);
}

function buildHistoricalTable(columns, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return '<div class="alert mi-empty-state py-4">لا توجد بيانات داخل الفلتر الحالي</div>';
  }

  return `
    <div class="table-responsive">
      <table class="table table-hover table-striped align-middle mi-data-table">
        <thead><tr>${columns.map((column) => `<th>${column.label}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${columns.map((column) => `<td>${column.render(row)}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function formatHistoricalNumber(value, digits = 2) {
  const safeDigits = Math.min(Math.max(Number(digits) || 0, 0), 20);
  const number = Number(value || 0);
  return number.toLocaleString("en-US", {
    minimumFractionDigits: safeDigits,
    maximumFractionDigits: safeDigits
  });
}

function formatHistoricalQty(value) {
  return formatHistoricalNumber(value, 3);
}

function formatHistoricalMoney(value) {
  return `${formatHistoricalNumber(value, 2)} ج`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setHistoricalLoading(isLoading) {
  document.getElementById("loadingBox")?.classList.toggle("hidden", !isLoading);
  const loadButton = document.getElementById("loadBtn");
  if (loadButton) {
    loadButton.disabled = isLoading;
    loadButton.textContent = isLoading ? "جاري الاحتساب..." : "تحديث التقرير";
  }
}

function showHistoricalError(message) {
  const box = document.getElementById("errorBox");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("hidden");
}

function hideHistoricalError() {
  const box = document.getElementById("errorBox");
  if (!box) return;
  box.textContent = "";
  box.classList.add("hidden");
}

function clearHistoricalReport() {
  [
    "kpiGrid",
    "productTypeBreakdown",
    "storageBreakdown",
    "periodMovement",
    "topInventoryValue",
    "topFastMoving",
    "slowMoving"
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.innerHTML = "";
  });
  document.getElementById("reportMeta")?.classList.add("hidden");
}
