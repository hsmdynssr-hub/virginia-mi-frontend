document.addEventListener("DOMContentLoaded", async () => {
  renderLayout(
    "ملخص المخزون التنفيذي",
    "تقييم قيمة المخزون، معدل الدوران، أيام التغطية، والأصناف بطيئة الحركة.",
    "inventory-executive-summary",
    buildInventoryExecutiveContent()
  );

  forceInventoryDateRange();
  bindInventoryEvents();
});

function buildInventoryExecutiveContent() {
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
            <option value="WORK_IN_PROGRESS">شبه نهائي</option>
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
      جاري تحميل التقرير...
    </section>

    <section id="errorBox" class="alert alert-danger hidden" role="alert"></section>

    <section id="kpiGrid" class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3 mb-4"></section>

    <section class="row g-3 mb-1">
      <div class="col-12 col-xl-6">
       <div class="mi-report-card">
        <h2 class="mi-report-title">توزيع المخزون حسب نوع المنتج</h2>
        <div id="productTypeBreakdown"></div>
       </div>
      </div>

      <div class="col-12 col-xl-6">
       <div class="mi-report-card">
        <h2 class="mi-report-title">توزيع المخزون حسب فئة التخزين</h2>
        <div id="storageBreakdown"></div>
       </div>
      </div>
    </section>

    <section class="mi-report-card">
      <h2 class="mi-report-title">أعلى أصناف حابسة قيمة مخزون</h2>
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

function forceInventoryDateRange() {
  const datePreset = document.getElementById("datePreset");
  const customDates = document.getElementById("customDates");
  const dateFromInput = document.getElementById("dateFrom");
  const dateToInput = document.getElementById("dateTo");

  const today = new Date().toISOString().slice(0, 10);

  if (dateFromInput) dateFromInput.value = today;
  if (dateToInput) dateToInput.value = today;

  if (datePreset) {
    const todayOption =
      Array.from(datePreset.options || []).find((option) => {
        const value = String(option.value || "").toLowerCase();
        const text = String(option.textContent || "").toLowerCase();

        return (
          value === "today" ||
          value === "day" ||
          value === "daily" ||
          text.includes("اليوم") ||
          text.includes("today")
        );
      });

    if (todayOption) {
      datePreset.value = todayOption.value;
    } else {
      datePreset.value = "custom";
    }
  }

  /*
    نخلي التاريخ ظاهر لو مفيش اختيار "اليوم" في layout.
    لكن لو اختيار اليوم موجود نخفي custom dates لأن الفلتر بقى يوم.
  */
  if (customDates) {
    const presetText =
      datePreset?.options?.[datePreset.selectedIndex]?.textContent || "";

    const isTodayPreset =
      String(presetText).includes("اليوم") ||
      String(datePreset?.value || "").toLowerCase().includes("today") ||
      String(datePreset?.value || "").toLowerCase().includes("day");

    customDates.style.display = isTodayPreset ? "none" : "flex";
  }
}

function bindInventoryEvents() {
  const refreshBtn = document.getElementById("refreshInventoryBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshExecutiveSummary);
  }

  const loadBtn = document.getElementById("loadBtn");
  if (loadBtn) {
    loadBtn.addEventListener("click", refreshExecutiveSummary);
  }

  const cascadeFilters = [
    "storageCategory",
    "locationId",
    "productType",
    "categoryId"
  ];

  cascadeFilters.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;

    element.addEventListener("change", () => {
      resetDependentFilters(id);
    });
  });

  const companySelect = document.getElementById("companySelect");
  if (companySelect) {
    companySelect.addEventListener("change", () => {
      resetDependentFilters("companySelect");
      clearInventoryReport();
    });
  }

  const exportExcelBtn = document.getElementById("exportExcelBtn");
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener("click", exportInventoryExcel);
  }

  const exportPdfBtn = document.getElementById("exportPdfBtn");
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", () => {
      alert("تصدير PDF هنضيفه في الخطوة القادمة.");
    });
  }

  window.refreshExecutiveSummary = refreshExecutiveSummary;
}

function resetDependentFilters(changedId) {
  const locationSelect = document.getElementById("locationId");
  const categorySelect = document.getElementById("categoryId");
  const productSelect = document.getElementById("productId");

  if (
    changedId === "companySelect" ||
    changedId === "storageCategory" ||
    changedId === "productType"
  ) {
    if (locationSelect) locationSelect.value = "";
    if (categorySelect) categorySelect.value = "";
    if (productSelect) productSelect.value = "";
    return;
  }

  if (changedId === "locationId") {
    if (categorySelect) categorySelect.value = "";
    if (productSelect) productSelect.value = "";
    return;
  }

  if (changedId === "categoryId") {
    if (productSelect) productSelect.value = "";
  }
}

async function refreshExecutiveSummary() {
  const companyId = document.getElementById("companySelect")?.value || "";
  if (!companyId) {
    showInventoryError("لازم تختار الشركة قبل تحديث التقرير.");
    clearInventoryReport();
    return;
  }

  await loadInventoryFilterOptions();
  await loadInventoryReport();
}

function showInventoryError(message) {
  const errorBox = document.getElementById("errorBox");
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearInventoryReport() {
  [
    "kpiGrid",
    "productTypeBreakdown",
    "storageBreakdown",
    "topInventoryValue",
    "topFastMoving",
    "slowMoving"
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.innerHTML = "";
  });
}

function getInventoryFilters() {
  return {
    companyId: document.getElementById("companySelect")?.value || "",

    /*
      مهم:
      القيمة الفارغة تعني كل فئات التخزين.
      لا تجعل الافتراضي CAPITAL.
    */
    storageCategory: document.getElementById("storageCategory")?.value || "",

    locationId: document.getElementById("locationId")?.value || "",
    productType: document.getElementById("productType")?.value || "",
    categoryId: document.getElementById("categoryId")?.value || "",
    productId: document.getElementById("productId")?.value || "",
    dateFrom: document.getElementById("dateFrom")?.value || "",
    dateTo: document.getElementById("dateTo")?.value || ""
  };
}

async function loadInventoryFilterOptions() {
  const filters = getInventoryFilters();

  const response = await apiGet(
    "/inventory/executive-summary/filters",
    {
      companyId: filters.companyId,
      storageCategory: filters.storageCategory,
      productType: filters.productType,
      locationId: filters.locationId,
      categoryId: filters.categoryId
    }
  );

  if (!response.success) {
    throw new Error(response.message || "فشل تحميل الفلاتر");
  }

  renderInventoryFilterOptions(response.data || {});
}

function renderInventoryFilterOptions(data) {
  fillInventorySelect({
    elementId: "storageCategory",
    rows: data.storageCategories || [],
    valueKey: "value",
    defaultLabel: "كل فئات التخزين",
    labelBuilder: (row) => {
      const locationsCount =
        row.locationsCount !== undefined
          ? ` — ${formatNumber(row.locationsCount, 0)} موقع`
          : "";

      const value =
        row.inventoryValue !== undefined
          ? ` — ${formatMoney(row.inventoryValue)}`
          : "";

      return `${row.label || row.name || row.value || "-"}${locationsCount}${value}`;
    }
  });

  fillInventorySelect({
    elementId: "locationId",
    rows: data.locations || [],
    valueKey: "id",
    defaultLabel: "كل المواقع",
    labelBuilder: (row) =>
      `${row.name || "-"} — ${formatMoney(row.inventoryValue)}`
  });

  fillInventorySelect({
    elementId: "categoryId",
    rows: data.categories || [],
    valueKey: "id",
    defaultLabel: "كل الفئات",
    labelBuilder: (row) => {
      const typeLabel = row.productTypeLabel ? ` / ${row.productTypeLabel}` : "";
      return `${row.name || "-"}${typeLabel} — ${formatMoney(row.inventoryValue)}`;
    }
  });

  fillInventorySelect({
    elementId: "productId",
    rows: data.products || [],
    valueKey: "id",
    defaultLabel: "كل المنتجات",
    labelBuilder: (row) => {
      const code = row.defaultCode ? ` [${row.defaultCode}]` : "";
      return `${row.name || "-"}${code} — ${formatMoney(row.inventoryValue)}`;
    }
  });
}

function fillInventorySelect({
  elementId,
  rows,
  valueKey,
  defaultLabel,
  labelBuilder
}) {
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

    if (value === undefined || value === null || value === "") {
      return;
    }

    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = labelBuilder(row);
    select.appendChild(option);
  });

  const stillExists = Array.from(select.options).some(
    (option) => option.value === currentValue
  );

  if (stillExists) {
    select.value = currentValue;
  } else {
    select.value = "";
  }
}

async function loadInventoryReport() {
  const loadingBox = document.getElementById("loadingBox");
  const errorBox = document.getElementById("errorBox");

  try {
    if (loadingBox) loadingBox.classList.remove("hidden");

    if (errorBox) {
      errorBox.classList.add("hidden");
      errorBox.textContent = "";
    }

    const filters = getInventoryFilters();

    const response = await apiGet(
      "/inventory/executive-summary",
      filters
    );

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل التقرير");
    }

    renderInventoryReport(response.data || {});
  } catch (error) {
    console.error(error);

    if (errorBox) {
      errorBox.textContent =
        error.message || "حدث خطأ أثناء تحميل التقرير";
      errorBox.classList.remove("hidden");
    }
  } finally {
    if (loadingBox) loadingBox.classList.add("hidden");
  }
}

function renderInventoryReport(data) {
  renderInventoryKpis(data.summary || {});

  renderInventoryBreakdown(
    "productTypeBreakdown",
    data.breakdownByProductType || [],
    "productTypeLabel"
  );

  renderInventoryBreakdown(
    "storageBreakdown",
    data.breakdownByStorageCategory || [],
    "storageCategoryName"
  );

  renderTopInventoryValue(data.topInventoryValue || []);
  renderTopFastMoving(data.topFastMoving || []);
  renderSlowMoving(data.slowMoving || []);
}

function formatNumber(value, digits = 2) {
  const safeDigits = Number.isFinite(Number(digits))
    ? Math.min(Math.max(Number(digits), 0), 20)
    : 2;

  const num = Number(value || 0);

  return num.toLocaleString("en-US", {
    minimumFractionDigits: safeDigits,
    maximumFractionDigits: safeDigits
  });
}

function formatQty(value) {
  return formatNumber(value, 3);
}

function formatMoney(value) {
  return `${formatNumber(value, 2)} ج`;
}

function renderInventoryKpis(summary) {
  const kpiGrid = document.getElementById("kpiGrid");
  if (!kpiGrid) return;

  const cards = [
    {
      title: "قيمة المخزون",
      value: formatMoney(summary.inventoryValue),
      hint: "إجمالي قيمة المخزون داخل الفلتر"
    },
    {
      title: "عدد الأصناف",
      value: formatNumber(summary.skuCount, 0),
      hint: "عدد المنتجات داخل الفلتر"
    },
    {
      title: "إجمالي الكمية",
      value: formatQty(summary.totalQty),
      hint: "إجمالي الرصيد الحالي"
    },
    {
      title: "قيمة الصرف",
      value: formatMoney(summary.consumptionValue),
      hint: "قيمة الصرف خلال الفترة"
    },
    {
      title: "معدل الدوران",
      value: formatNumber(summary.turnoverRate, 4),
      hint: "قيمة الصرف ÷ قيمة المخزون"
    },
    {
      title: "أيام التغطية",
      value:
        summary.daysOnHand === null ||
        summary.daysOnHand === undefined
          ? "-"
          : formatNumber(summary.daysOnHand, 2),
      hint: "عدد أيام تغطية المخزون"
    },
    {
      title: "أصناف سالبة",
      value: formatNumber(summary.negativeItems, 0),
      hint: "أرصدة تحتاج مراجعة"
    },
    {
      title: "قيمة سالبة",
      value: formatMoney(summary.negativeValue),
      hint: "قيمة الأرصدة السالبة"
    }
  ];

  kpiGrid.innerHTML = cards
    .map((card, index) => `
      <div class="col">
       <div class="mi-kpi-card h-100"
            data-tone="${["teal", "purple", "success", "warning", "purple", "teal", "danger", "danger"][index]}"
            data-icon="${["💰", "📦", "⚖", "↗", "🔄", "📅", "⚠", "▼"][index]}"
            style="--mi-delay:${index * 45}ms">
        <span class="mi-kpi-label">${card.title}</span>
        <strong class="mi-kpi-value">${card.value}</strong>
        <small class="mi-kpi-hint">${card.hint}</small>
       </div>
      </div>
    `)
    .join("");
}

function renderInventoryBreakdown(elementId, rows, nameKey) {
  const container = document.getElementById(elementId);
  if (!container) return;

  container.innerHTML = buildInventoryTable({
    columns: [
      { label: "البند", render: (row) => row[nameKey] || "-" },
      { label: "عدد الأصناف", render: (row) => formatNumber(row.skuCount, 0) },
      { label: "الكمية", render: (row) => formatQty(row.quantity) },
      { label: "القيمة", render: (row) => formatMoney(row.inventoryValue) }
    ],
    rows
  });
}

function renderTopInventoryValue(rows) {
  const container = document.getElementById("topInventoryValue");
  if (!container) return;

  container.innerHTML = buildInventoryTable({
    columns: [
      { label: "الصنف", render: (row) => row.productName || "-" },
      { label: "الكود", render: (row) => row.defaultCode || "-" },
      { label: "النوع", render: (row) => row.productTypeLabel || "-" },
      { label: "الكمية", render: (row) => formatQty(row.quantity) },
      { label: "تكلفة الوحدة", render: (row) => formatMoney(row.unitCost) },
      { label: "قيمة المخزون", render: (row) => formatMoney(row.inventoryValue) }
    ],
    rows
  });
}

function renderTopFastMoving(rows) {
  const container = document.getElementById("topFastMoving");
  if (!container) return;

  container.innerHTML = buildInventoryTable({
    columns: [
      { label: "الصنف", render: (row) => row.productName || "-" },
      { label: "الكود", render: (row) => row.defaultCode || "-" },
      { label: "النوع", render: (row) => row.productTypeLabel || "-" },
      { label: "كمية الصرف", render: (row) => formatQty(row.consumedQty) },
      { label: "قيمة الصرف", render: (row) => formatMoney(row.consumptionValue) },
      { label: "قيمة المخزون", render: (row) => formatMoney(row.inventoryValue) },
      { label: "الدوران", render: (row) => formatNumber(row.turnoverRate, 4) },
      {
        label: "أيام التغطية",
        render: (row) =>
          row.daysOnHand === null ? "-" : formatNumber(row.daysOnHand, 2)
      }
    ],
    rows
  });
}

function renderSlowMoving(rows) {
  const container = document.getElementById("slowMoving");
  if (!container) return;

  container.innerHTML = buildInventoryTable({
    columns: [
      { label: "الصنف", render: (row) => row.productName || "-" },
      { label: "الكود", render: (row) => row.defaultCode || "-" },
      { label: "النوع", render: (row) => row.productTypeLabel || "-" },
      { label: "الكمية الحالية", render: (row) => formatQty(row.currentQty) },
      { label: "قيمة المخزون", render: (row) => formatMoney(row.inventoryValue) },
      { label: "قيمة الصرف", render: (row) => formatMoney(row.consumptionValue) },
      { label: "الدوران", render: (row) => formatNumber(row.turnoverRate, 4) },
      {
        label: "أيام التغطية",
        render: (row) =>
          row.daysOnHand === null ? "-" : formatNumber(row.daysOnHand, 2)
      }
    ],
    rows
  });
}

function buildInventoryTable({ columns, rows }) {
  if (!rows || rows.length === 0) {
    return `<div class="alert mi-empty-state py-4">لا توجد بيانات داخل الفلتر الحالي</div>`;
  }

  return `
    <div class="table-responsive">
      <table class="table table-hover table-striped align-middle mi-data-table">
        <thead>
          <tr>
            ${columns.map((column) => `<th>${column.label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              ${columns.map((column) => `<td>${column.render(row)}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function exportInventoryExcel() {
  try {
    const filters = getInventoryFilters();

    await apiDownload(
      "/exports/excel",
      {
        report: "inventory.executive_summary",
        ...filters
      },
      "inventory-executive-summary.xlsx"
    );
  } catch (error) {
    console.error(error);
    alert(error.message || "فشل تصدير Excel");
  }
}
