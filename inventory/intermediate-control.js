document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "رقابة المخازن الوسيطة",
    "مراقبة مخزن التحويلات ومخزن الشحن، الحركات المتأخرة، وفروقات الكمية والقيمة.",
    "inventory-intermediate-control",
    buildIntermediateControlContent()
  );

  forceIntermediateDateRange();
  bindIntermediateEvents();

  clearIntermediateReport();
});

function buildIntermediateControlContent() {
  return `
    <div class="container-fluid mi-bootstrap-page px-0">
    <section class="mi-filter-card">
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <label class="form-label" for="maxAllowedDaysView">حد التأخير المسموح</label>
          <input id="maxAllowedDaysView" class="form-control" type="text" value="2 يوم" disabled />
        </div>

        <div class="col-12 col-md-6">
          <label class="form-label" for="intermediateScopeView">نطاق التقرير</label>
          <input id="intermediateScopeView" class="form-control" type="text" value="مخزن التحويلات + مخزن الشحن" disabled />
        </div>
      </div>
    </section>

    <section id="loadingBox" class="alert alert-warning d-flex align-items-center hidden" role="status">
      <span class="spinner-border spinner-border-sm mi-loading-spinner" aria-hidden="true"></span>
      جاري تحميل التقرير...
    </section>

    <section id="errorBox" class="alert alert-danger hidden" role="alert"></section>

    <section id="kpiGrid" class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3 mb-4"></section>

    <section class="mi-report-card">
      <h2 class="mi-report-title"><span class="mi-section-icon">💡</span>التحليل والتوصيات</h2>
      <div id="intermediateInsights"></div>
    </section>

    <section class="mi-report-card">
      <h2 class="mi-report-title"><span class="mi-section-icon">🏬</span>ملخص المخازن الوسيطة</h2>
      <div id="locationsSummary"></div>
    </section>

    <section class="mi-report-card">
      <h2 class="mi-report-title"><span class="mi-section-icon">⚠</span>الحركات المتأخرة أكثر من يومين</h2>
      <div id="overdueMoves"></div>
    </section>

    <section class="mi-report-card">
      <h2 class="mi-report-title"><span class="mi-section-icon">⚖</span>فروقات حسب الصنف</h2>
      <div id="byProduct"></div>
    </section>

    <section class="mi-report-card">
      <h2 class="mi-report-title"><span class="mi-section-icon">↔</span>تفاصيل الحركات الوسيطة</h2>
      <div id="movements"></div>
    </section>
    </div>
  `;
}

function forceIntermediateDateRange() {
  const datePreset = document.getElementById("datePreset");
  const customDates = document.getElementById("customDates");
  const dateFromInput = document.getElementById("dateFrom");
  const dateToInput = document.getElementById("dateTo");

  if (datePreset) {
    datePreset.value = "custom";
  }

  if (customDates) {
    customDates.style.display = "flex";
  }

  const today = new Date();
  const to = today.toISOString().slice(0, 10);

  const fromDate = new Date();
  fromDate.setDate(today.getDate() - 16);
  const from = fromDate.toISOString().slice(0, 10);

  if (dateFromInput) dateFromInput.value = from;
  if (dateToInput) dateToInput.value = to;
}

function bindIntermediateEvents() {
  const refreshBtn = document.getElementById("refreshIntermediateBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshIntermediateControl);
  }

  const loadBtn = document.getElementById("loadBtn");
  if (loadBtn) {
    loadBtn.addEventListener("click", refreshIntermediateControl);
  }

  const companySelect = document.getElementById("companySelect");
  if (companySelect) {
    companySelect.addEventListener("change", clearIntermediateReport);
  }

  ["dateFrom", "dateTo"].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;

    element.addEventListener("change", clearIntermediateReport);
  });

  const exportExcelBtn = document.getElementById("exportExcelBtn");
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener("click", exportIntermediateExcel);
  }

  const exportPdfBtn = document.getElementById("exportPdfBtn");
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", () => {
      alert("تصدير PDF هنضيفه بعد تثبيت تصدير Excel لكل التقارير.");
    });
  }

  window.refreshIntermediateControl = refreshIntermediateControl;
}

async function refreshIntermediateControl() {
  if (!document.getElementById("companySelect")?.value) {
    const errorBox = document.getElementById("errorBox");
    if (errorBox) {
      errorBox.textContent = "لازم تختار الشركة قبل تحديث التقرير.";
      errorBox.classList.remove("hidden");
    }
    return;
  }
  await loadIntermediateReport();
}

function clearIntermediateReport() {
  ["kpiGrid", "intermediateInsights", "locationsSummary", "overdueMoves", "byProduct", "movements"]
    .forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.innerHTML = "";
    });
}

function getIntermediateFilters() {
  return {
    companyId: document.getElementById("companySelect")?.value || "",
    dateFrom: document.getElementById("dateFrom")?.value || "",
    dateTo: document.getElementById("dateTo")?.value || "",
    limit: 15000
  };
}

function normalizeIntermediatePayload(payload) {
  if (!payload) return {};

  if (payload.data && payload.data.summary) {
    return {
      companyId: payload.companyId,
      period: payload.period || {},
      ...payload.data
    };
  }

  return payload;
}

async function loadIntermediateReport() {
  const loadingBox = document.getElementById("loadingBox");
  const errorBox = document.getElementById("errorBox");

  try {
    if (loadingBox) loadingBox.classList.remove("hidden");

    if (errorBox) {
      errorBox.classList.add("hidden");
      errorBox.textContent = "";
    }

    const filters = getIntermediateFilters();

    const response = await apiGet(
      "/inventory/intermediate-control",
      filters
    );

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل التقرير");
    }

    const data = normalizeIntermediatePayload(response.data || {});

    renderIntermediateReport(data);
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

function renderIntermediateReport(data) {
  renderIntermediateKpis(data.summary || {});
  renderIntermediateInsights(data);
  renderLocationsSummary(data.locations || []);
  renderOverdueMoves(data.overdueMoves || []);
  renderByProduct(data.byProduct || []);
  renderMovements(data.movements || []);
}

function formatNumber(value, digits = 2) {
  const num = Number(value || 0);

  return num.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatQty(value) {
  return formatNumber(value, 3);
}

function formatMoney(value) {
  return `${formatNumber(value, 2)} ج`;
}

function formatBool(value) {
  return value ? "نعم" : "لا";
}

function renderIntermediateKpis(summary) {
  const kpiGrid = document.getElementById("kpiGrid");
  if (!kpiGrid) return;

  const cards = [
    {
      title: "الحد المسموح",
      value: `${summary.maxAllowedDays || 2} يوم`,
      hint: "أقصى مدة بقاء للحركة داخل المخزن الوسيط"
    },
    {
      title: "إجمالي الحركات",
      value: formatNumber(summary.totalMoves, 0),
      hint: "كل الحركات المرتبطة بمخزن التحويلات ومخزن الشحن"
    },
    {
      title: "حركات متأخرة",
      value: formatNumber(summary.overdueMovesCount, 0),
      hint: "حركات تجاوزت الحد المسموح"
    },
    {
      title: "مواقع خطر",
      value: formatNumber(summary.riskLocationsCount, 0),
      hint: "مواقع بها تأخير أو فروقات تحتاج مراجعة"
    },
    {
      title: "فرق التحويلات",
      value: formatQty(summary.transferBalanceQty),
      hint: "داخل ناقص خارج من مخزن التحويلات"
    },
    {
      title: "قيمة فرق التحويلات",
      value: formatMoney(summary.transferBalanceValue),
      hint: "قيمة الفرق داخل مخزن التحويلات"
    },
    {
      title: "فرق الشحن",
      value: formatQty(summary.shippingBalanceQty),
      hint: "داخل ناقص خارج من مخزن الشحن"
    },
    {
      title: "قيمة فرق الشحن",
      value: formatMoney(summary.shippingBalanceValue),
      hint: "قيمة الفرق داخل مخزن الشحن"
    }
  ];

  kpiGrid.innerHTML = cards
    .map((card, index) => `
      <div class="col">
       <div class="mi-kpi-card h-100"
            data-tone="${["purple", "teal", "danger", "warning"][index % 4]}"
            data-icon="${["⏱", "↔", "⚠", "🚨", "⚖", "💰", "📦", "💵"][index]}"
            style="--mi-delay:${index * 45}ms">
        <span class="mi-kpi-label">${card.title}</span>
        <strong class="mi-kpi-value">${card.value}</strong>
        <small class="mi-kpi-hint">${card.hint}</small>
       </div>
      </div>
    `)
    .join("");
}

function renderIntermediateInsights(data) {
  const container = document.getElementById("intermediateInsights");
  if (!container) return;

  const insights = data.insights || [];
  const recommendations = data.recommendations || [];

  if (!insights.length && !recommendations.length) {
    container.innerHTML = `<div class="alert mi-empty-state py-4">لا توجد توصيات حالية</div>`;
    return;
  }

  container.innerHTML = `
    <div class="d-grid gap-2">
      ${insights.map((item) => `<div class="mi-insight-item">${item}</div>`).join("")}
      ${recommendations
        .map((item) => `<div class="mi-insight-item"><b>توصية:</b> ${item}</div>`)
        .join("")}
    </div>
  `;
}

function renderLocationsSummary(rows) {
  const container = document.getElementById("locationsSummary");
  if (!container) return;

  container.innerHTML = buildIntermediateTable({
    columns: [
      { label: "المخزن", render: (row) => row.locationLabel || "-" },
      { label: "عدد الحركات", render: (row) => formatNumber(row.movesCount, 0) },
      { label: "داخل", render: (row) => formatQty(row.inQty) },
      { label: "خارج", render: (row) => formatQty(row.outQty) },
      { label: "فرق الكمية", render: (row) => formatQty(row.balanceQty) },
      { label: "قيمة الداخل", render: (row) => formatMoney(row.inValue) },
      { label: "قيمة الخارج", render: (row) => formatMoney(row.outValue) },
      { label: "فرق القيمة", render: (row) => formatMoney(row.balanceValue) },
      { label: "متأخر", render: (row) => formatNumber(row.overdueMovesCount, 0) },
      { label: "أقدم حركة/يوم", render: (row) => formatNumber(row.oldestInAgingDays, 0) },
      { label: "خطر", render: (row) => formatBool(row.isRisk) }
    ],
    rows
  });
}

function renderOverdueMoves(rows) {
  const container = document.getElementById("overdueMoves");
  if (!container) return;

  container.innerHTML = buildIntermediateTable({
    columns: [
      { label: "المرجع", render: (row) => row.reference || "-" },
      { label: "تاريخ الدخول", render: (row) => row.date || "-" },
      { label: "المخزن", render: (row) => row.locationLabel || "-" },
      { label: "الصنف", render: (row) => row.productName || "-" },
      { label: "الكمية", render: (row) => formatQty(row.qty) },
      { label: "القيمة", render: (row) => formatMoney(row.value) },
      { label: "عدد الأيام", render: (row) => formatNumber(row.agingDays, 0) },
      { label: "من", render: (row) => row.sourceLocationName || "-" },
      { label: "إلى", render: (row) => row.destinationLocationName || "-" }
    ],
    rows
  });
}

function renderByProduct(rows) {
  const container = document.getElementById("byProduct");
  if (!container) return;

  container.innerHTML = buildIntermediateTable({
    columns: [
      { label: "المخزن", render: (row) => row.locationLabel || "-" },
      { label: "الصنف", render: (row) => row.productName || "-" },
      { label: "عدد الحركات", render: (row) => formatNumber(row.movesCount, 0) },
      { label: "داخل", render: (row) => formatQty(row.inQty) },
      { label: "خارج", render: (row) => formatQty(row.outQty) },
      { label: "فرق الكمية", render: (row) => formatQty(row.balanceQty) },
      { label: "قيمة الداخل", render: (row) => formatMoney(row.inValue) },
      { label: "قيمة الخارج", render: (row) => formatMoney(row.outValue) },
      { label: "فرق القيمة", render: (row) => formatMoney(row.balanceValue) }
    ],
    rows
  });
}

function renderMovements(rows) {
  const container = document.getElementById("movements");
  if (!container) return;

  container.innerHTML = buildIntermediateTable({
    columns: [
      { label: "المرجع", render: (row) => row.reference || "-" },
      { label: "التاريخ", render: (row) => row.date || "-" },
      { label: "المخزن", render: (row) => row.locationLabel || "-" },
      { label: "الاتجاه", render: (row) => row.directionLabel || row.direction || "-" },
      { label: "الصنف", render: (row) => row.productName || "-" },
      { label: "الكمية", render: (row) => formatQty(row.qty) },
      { label: "القيمة", render: (row) => formatMoney(row.value) },
      { label: "العمر", render: (row) => formatNumber(row.agingDays, 0) },
      { label: "من", render: (row) => row.sourceLocationName || "-" },
      { label: "إلى", render: (row) => row.destinationLocationName || "-" }
    ],
    rows
  });
}

function buildIntermediateTable({ columns, rows }) {
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

async function exportIntermediateExcel() {
  try {
    const filters = getIntermediateFilters();

    await apiDownload(
      "/exports/excel",
      {
        report: "inventory.intermediate_control",
        ...filters
      },
      "inventory-intermediate-control.xlsx"
    );
  } catch (error) {
    console.error(error);
    alert(error.message || "فشل تصدير Excel");
  }
}
