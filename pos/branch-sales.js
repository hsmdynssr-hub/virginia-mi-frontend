const BRANCH_SALES_TIMEZONE = "Africa/Cairo";

document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "تحليل أداء المعارض",
    "مبيعات المعارض، استرداد الأموال، العروض والتعديلات السالبة، الخصومات، تسجيل العملاء، وأداء الكاشير.",
    "pos-branch-sales",
    buildBranchSalesContent()
  );

  ensureBranchSalesExportButton();
  bindBranchSalesEvents();
  renderInitialState();
});

function buildBranchSalesContent() {
  return `
    <section id="branchSalesPrintHeader" class="branch-sales-print-header" aria-hidden="true"></section>

    <section id="loadingBox" class="loading-box hidden">
      جاري تحميل التقرير...
    </section>

    <section id="errorBox" class="error-box hidden"></section>

    <section id="pendingBox" class="inventory-report-card">
      <h2>التقرير لم يتم تحميله بعد</h2>
      <p class="inventory-muted-text">
        اختار الشركة ثم الفرع / النطاق، وبعدها اضغط <strong>تحديث التقرير</strong> لعرض البيانات.
      </p>
    </section>

    <div id="branchSalesPeriodBar" class="branch-sales-period-bar hidden"></div>

    <section id="kpiGrid" class="inventory-kpi-grid"></section>

    <section class="mi-report-card pos-summary-section">
      <h2 class="mi-report-title"><span class="mi-section-icon">📊</span>مقارنة المبيعات مع نفس الفترة من السنة السابقة</h2>
      <div id="periodComparisonGrid"></div>
    </section>

    <section class="inventory-report-card">
      <h2>ملخص المعارض</h2>
      <div id="branchesTable"></div>
    </section>

    <section class="inventory-report-card">
      <h2>أداء الكاشير</h2>
      <div id="cashiersTable"></div>
    </section>

    <section class="inventory-report-card">
      <h2>أفضل المنتجات</h2>
      <p class="inventory-muted-text">
        أعلى 50 منتج حسب صافي المبيعات، مع نسبة مساهمة كل منتج من صافي إيراد الفترة المحددة.
        تصدير Excel يحتوي على كل المنتجات المباعة.
      </p>
      <div id="productsTable"></div>
    </section>

    <section class="inventory-report-card">
      <h2>ملاحظات التقرير</h2>
      <div id="notesBox"></div>
    </section>
  `;
}


function ensureBranchSalesExportButton() {
  const loadButton = document.getElementById("loadBtn") || document.getElementById("refreshBranchSalesBtn");
  const actionsContainer = loadButton?.parentElement || document.querySelector(".inventory-hero-actions");

  if (!actionsContainer) return;

  if (!document.getElementById("exportBranchSalesBtn")) {
    const exportButton = document.createElement("button");
    exportButton.id = "exportBranchSalesBtn";
    exportButton.type = "button";
    exportButton.className = "run-btn report-export-action";
    exportButton.textContent = "تصدير Excel";
    actionsContainer.appendChild(exportButton);
  }

  if (!document.getElementById("exportBranchSalesPdfBtn")) {
    const pdfButton = document.createElement("button");
    pdfButton.id = "exportBranchSalesPdfBtn";
    pdfButton.type = "button";
    pdfButton.className = "run-btn report-export-action report-pdf-action";
    pdfButton.textContent = "تصدير PDF";
    actionsContainer.appendChild(pdfButton);
  }
}

function bindBranchSalesEvents() {
  document
    .getElementById("refreshBranchSalesBtn")
    ?.addEventListener("click", loadBranchSalesReport);

  document
    .getElementById("exportBranchSalesBtn")
    ?.addEventListener("click", downloadBranchSalesExcel);

  document
    .getElementById("exportBranchSalesPdfBtn")
    ?.addEventListener("click", printBranchSalesPdf);

  document
    .getElementById("loadBtn")
    ?.addEventListener("click", loadBranchSalesReport);

  document
    .getElementById("companySelect")
    ?.addEventListener("change", async () => {
      await applyReportFiltersForPage("pos-branch-sales");
      renderFilterChangedState();
    });

  document.addEventListener("change", (event) => {
    if (event.target?.id === "branchCode") {
      renderFilterChangedState();
    }
  });

  ["dateFrom", "dateTo"].forEach((id) => {
    document
      .getElementById(id)
      ?.addEventListener("change", renderFilterChangedState);
  });
}

async function applyReportFiltersForPage(activePage) {
  for (let i = 0; i < 30; i += 1) {
    if (window.ReportFilters?.apply) {
      await window.ReportFilters.apply(activePage);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function waitForCompanyDropdownReady() {
  const maxTries = 20;

  for (let i = 0; i < maxTries; i += 1) {
    const companySelect = document.getElementById("companySelect");

    if (companySelect && companySelect.value) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}


function renderInitialState() {
  hideLoadingBox();
  hideErrorBox();
  clearBranchSalesReport();
  showPendingMessage("التقرير لم يتم تحميله بعد", "اختار الشركة ثم الفرع / النطاق، وبعدها اضغط تحديث التقرير لعرض البيانات.");
}

function renderFilterChangedState() {
  hideLoadingBox();
  hideErrorBox();
  clearBranchSalesReport();
  showPendingMessage("تم تغيير الفلاتر", "اضغط تحديث التقرير لتطبيق الشركة والفرع والفترة الجديدة.");
}

function showPendingMessage(title, message) {
  const pendingBox = document.getElementById("pendingBox");
  if (!pendingBox) return;

  pendingBox.classList.remove("hidden");
  pendingBox.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <p class="inventory-muted-text">${escapeHtml(message)}</p>
  `;
}

function hidePendingBox() {
  document.getElementById("pendingBox")?.classList.add("hidden");
}

function hideLoadingBox() {
  document.getElementById("loadingBox")?.classList.add("hidden");
}

function hideErrorBox() {
  const errorBox = document.getElementById("errorBox");
  if (!errorBox) return;

  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function showErrorMessage(message) {
  const errorBox = document.getElementById("errorBox");
  if (!errorBox) {
    alert(message);
    return;
  }

  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearBranchSalesReport() {
  document.getElementById("branchSalesPeriodBar")?.classList.add("hidden");

  [
    "kpiGrid",
    "periodComparisonGrid",
    "branchesTable",
    "posConfigsTable",
    "cashiersTable",
    "productsTable",
    "notesBox"
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.innerHTML = "";
  });
}

function validateBranchSalesContext() {
  const companyId = document.getElementById("companySelect")?.value || "";
  const branchCode = document.getElementById("branchCode")?.value || "";

  if (!companyId) {
    return { ok: false, message: "لازم تختار الشركة قبل تحميل التقرير." };
  }

  if (!branchCode) {
    return { ok: false, message: "لازم تختار الفرع أو كل المعارض قبل تحميل التقرير." };
  }

  return { ok: true };
}

function getBranchSalesFilters(mode = "summary") {
  const isExport = mode === "export";

  return {
    companyId:
      document.getElementById("companySelect")?.value || "",

    dateFrom:
      document.getElementById("dateFrom")?.value || "",

    dateTo:
      document.getElementById("dateTo")?.value || "",

    branchCode:
      document.getElementById("branchCode")?.value || "",

    timezone: BRANCH_SALES_TIMEZONE,

    limit: isExport ? 100000 : 30000,
    linesLimit: isExport ? 250000 : 60000
  };
}

async function loadBranchSalesReport() {
  const validation = validateBranchSalesContext();

  if (!validation.ok) {
    showErrorMessage(validation.message);
    return;
  }

  const loadingBox = document.getElementById("loadingBox");

  try {
    if (loadingBox) {
      loadingBox.classList.remove("hidden");
    }

    hideErrorBox();

    const filters = getBranchSalesFilters("summary");

    const response =
      await apiGet(
        "/pos/branch-sales",
        filters
      );

    if (!response.success) {
      throw new Error(
        response.message ||
        "فشل تحميل تقرير أداء المعرض"
      );
    }

    hidePendingBox();
    renderBranchSalesReport(response.data || {}, response.period || {});
  } catch (error) {
    console.error(error);

    showErrorMessage(
      error.message ||
      "حدث خطأ أثناء تحميل التقرير"
    );
  } finally {
    if (loadingBox) {
      loadingBox.classList.add("hidden");
    }
  }
}

async function loadAllowedPosBranches() {
  const companyId =
    document.getElementById("companySelect")?.value || "";

  if (!companyId) {
    return [];
  }

  const response =
    await apiGet(
      "/pos-branch-access/me",
      {
        companyId
      }
    );

  if (!response.success) {
    return [];
  }

  const raw =
    response.data?.branches ||
    response.branches ||
    response.data ||
    [];

  return Array.isArray(raw) ? raw : [];
}

async function renderAllowedPosBranches() {
  const select = document.getElementById("branchCode");
  if (!select) return;

  const currentValue = select.value || "";
  const companyId = document.getElementById("companySelect")?.value || "";

  if (!companyId) {
    select.innerHTML = `<option value="">اختر الشركة أولًا</option>`;
    select.value = "";
    return;
  }

  let branches = [];

  try {
    branches = await loadAllowedPosBranches();
  } catch (error) {
    console.warn(
      "Could not load allowed POS branches",
      error.message
    );

    branches = [];
  }

  select.innerHTML = `
    <option value="">اختر الفرع / النطاق</option>
    <option value="all">كل المعارض</option>
    ${
      branches
        .map((branch) => {
          const branchCode =
            branch.branchCode ||
            branch.branch_code ||
            branch.code ||
            "";

          const branchName =
            branch.branchName ||
            branch.branch_name ||
            branch.name ||
            branchCode;

          if (!branchCode) return "";

          return `
            <option value="${escapeHtml(branchCode)}">
              ${escapeHtml(branchName)}
            </option>
          `;
        })
        .join("")
    }
  `;

  const exists =
    Array
      .from(select.options)
      .some((option) => option.value === currentValue);

  select.value = exists ? currentValue : "";
}

function renderBranchOptions(branchOptions = []) {
  const select = document.getElementById("branchCode");
  if (!select) return;

  const currentValue = select.value || "all";

  select.innerHTML = `<option value="all">كل المعارض</option>`;

  branchOptions.forEach((branch) => {
    const option = document.createElement("option");

    option.value = branch.branchCode;

    option.textContent =
      `${branch.branchName || branch.branchCode} — ${formatMoney(branch.netSales || 0)} — ${formatNumber(branch.ordersCount || 0, 0)} فاتورة`;

    select.appendChild(option);
  });

  const exists =
    Array
      .from(select.options)
      .some((option) => option.value === currentValue);

  select.value = exists ? currentValue : "all";
}

function renderBranchSalesReport(data, period = {}) {
  const summary = data.summary || {};

  renderAppliedPeriod(period);
  renderBranchSalesKpis(summary);
  renderPeriodComparison(data.comparison || {});
  renderBranches(data.branches || []);
  renderCashiers(data.cashiers || []);
  renderProducts(data.products || [], summary);
  renderNotes(data.notes || []);
}

function renderAppliedPeriod(period = {}) {
  const container = document.getElementById("branchSalesPeriodBar");
  if (!container) return;

  const requested = period.requested || {};
  const dateLabel = formatPeriodLabel(requested);
  const timezoneLabel = period.timezone || BRANCH_SALES_TIMEZONE;

  container.innerHTML = `
    <strong>الفترة المطبقة:</strong>
    <span>${escapeHtml(dateLabel)}</span>
    <i aria-hidden="true"></i>
    <strong>التوقيت:</strong>
    <span>${escapeHtml(timezoneLabel)} — القاهرة</span>
  `;
  container.classList.remove("hidden");
}

function formatPeriodLabel(period = {}) {
  if (!period.dateFrom || !period.dateTo) return "-";
  return `${period.dateFrom} إلى ${period.dateTo}`;
}

function signedPercent(value) {
  const number = Number(value || 0);
  const sign = number > 0 ? "+" : "";
  return `${sign}${formatPercent(number)}`;
}

function signedMoney(value) {
  const number = Number(value || 0);
  const sign = number > 0 ? "+" : "";
  return `${sign}${formatMoney(number)}`;
}

function renderPeriodComparison(comparison = {}) {
  const container = document.getElementById("periodComparisonGrid");
  if (!container) return;

  const current = comparison.current || {};
  const previous = comparison.previous || {};
  const changes = comparison.changes || {};
  const currentPeriodLabel = formatPeriodLabel(comparison.currentPeriod);
  const previousPeriodLabel = formatPeriodLabel(comparison.previousPeriod);

  const cards = [
    {
      title: "إجمالي المبيعات — الفترة الحالية",
      value: formatMoney(current.grossSales || 0),
      hint: currentPeriodLabel,
      tone: "teal",
      icon: "💰"
    },
    {
      title: "صافي المبيعات — الفترة الحالية",
      value: formatMoney(current.netSales || 0),
      hint: currentPeriodLabel,
      tone: "success",
      icon: "✅"
    },
    {
      title: "عدد الأوردرات — الفترة الحالية",
      value: formatNumber(current.ordersCount || 0),
      hint: currentPeriodLabel,
      tone: "purple",
      icon: "🧾"
    },
    {
      title: "إجمالي المبيعات — السنة السابقة",
      value: formatMoney(previous.grossSales || 0),
      hint: previousPeriodLabel,
      tone: "teal",
      icon: "💰"
    },
    {
      title: "صافي المبيعات — السنة السابقة",
      value: formatMoney(previous.netSales || 0),
      hint: previousPeriodLabel,
      tone: "success",
      icon: "✅"
    },
    {
      title: "عدد الأوردرات — السنة السابقة",
      value: formatNumber(previous.ordersCount || 0),
      hint: previousPeriodLabel,
      tone: "purple",
      icon: "🧾"
    },
    {
      title: "تغير إجمالي المبيعات",
      value: signedPercent(changes.grossSalesPercent),
      hint: signedMoney(changes.grossSales),
      tone: Number(changes.grossSales || 0) >= 0 ? "success" : "danger",
      icon: "📈"
    },
    {
      title: "تغير صافي المبيعات",
      value: signedPercent(changes.netSalesPercent),
      hint: signedMoney(changes.netSales),
      tone: Number(changes.netSales || 0) >= 0 ? "success" : "danger",
      icon: "📉"
    },
    {
      title: "تغير عدد الأوردرات",
      value: signedPercent(changes.ordersCountPercent),
      hint: `${Number(changes.ordersCount || 0) > 0 ? "+" : ""}${formatNumber(changes.ordersCount || 0)} أوردر`,
      tone: Number(changes.ordersCount || 0) >= 0 ? "success" : "danger",
      icon: "📊"
    }
  ];

  container.innerHTML = `
    <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
      ${cards.map((card, index) => `
        <div class="col">
          <div class="mi-kpi-card h-100"
               data-tone="${escapeHtml(card.tone)}"
               data-icon="${card.icon}"
               style="--mi-delay:${index * 45}ms">
            <span class="mi-kpi-label">${escapeHtml(card.title)}</span>
            <strong class="mi-kpi-value">${escapeHtml(card.value)}</strong>
            <small class="mi-kpi-hint">${escapeHtml(card.hint)}</small>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}
function renderBranchSalesKpis(summary) {
  const kpiGrid = document.getElementById("kpiGrid");
  if (!kpiGrid) return;

  const cards = [
    {
      title: "إجمالي المبيعات",
      value: formatMoney(summary.grossSales),
      hint: "إجمالي فواتير البيع الموجبة"
    },
    {
      title: "صافي المبيعات",
      value: formatMoney(summary.netSales),
      hint: "إجمالي المبيعات - استرداد الأموال - العروض والتعديلات السالبة"
    },
    {
      title: "عدد الفواتير",
      value: formatNumber(summary.ordersCount, 0),
      hint: "عدد فواتير POS داخل الفترة"
    },
    {
      title: "متوسط الفاتورة",
      value: formatMoney(summary.averageTicket),
      hint: "صافي المبيعات ÷ عدد الفواتير"
    },
    {
      title: "المرتجعات / استرداد أموال",
      value: formatMoney(summary.returnsValue),
      hint: "استرداد أموال فقط، وليس كل سطر سالب"
    },
    {
      title: "العروض والتعديلات السالبة",
      value: formatMoney(summary.negativeAdjustmentsValue),
      hint: "سطور سالبة داخل فواتير البيع العادية مثل عروض أو كوبونات أو تسويات"
    },
    {
      title: "نسبة العروض والتعديلات",
      value: formatPercent(calculatePercent(summary.negativeAdjustmentsValue, summary.grossSales)),
      hint: "العروض والتعديلات السالبة ÷ إجمالي المبيعات"
    },
    {
      title: "إجمالي الخصم",
      value: formatMoney(summary.totalDiscountValue),
      hint: "قيمة الخصومات المحسوبة من سطور الفواتير"
    },
    {
      title: "نسبة تسجيل العملاء",
      value: formatPercent(summary.customerCaptureRate),
      hint: "الفواتير المسجلة بعميل ÷ إجمالي الفواتير"
    },
    {
      title: "أفضل كاشير",
      value: summary.bestCashierName || "-",
      hint: "الأعلى في صافي المبيعات"
    },
    {
      title: "أقل كاشير",
      value: summary.weakestCashierName || "-",
      hint: "الأقل في صافي المبيعات"
    }
  ];

  kpiGrid.innerHTML =
    cards
      .map((card) => `
        <div class="inventory-kpi-card">
          <span>${escapeHtml(card.title)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <small>${escapeHtml(card.hint)}</small>
        </div>
      `)
      .join("");
}

function renderBranches(rows) {
  const container = document.getElementById("branchesTable");
  if (!container) return;

  container.innerHTML =
    buildPosBranchTable({
      columns: [
        {
          label: "المعرض",
          render: (row) => row.branchName || "-"
        },
        {
          label: "عدد الفواتير",
          render: (row) => formatNumber(row.ordersCount, 0)
        },
        {
          label: "إجمالي المبيعات",
          render: (row) => formatMoney(row.grossSales)
        },
        {
          label: "المرتجعات / استرداد أموال",
          render: (row) => formatMoney(row.returnsValue)
        },
        {
          label: "العروض والتعديلات السالبة",
          render: (row) => formatMoney(row.negativeAdjustmentsValue)
        },
        {
          label: "صافي المبيعات",
          render: (row) => formatMoney(row.netSales)
        },
        {
          label: "متوسط الفاتورة",
          render: (row) => formatMoney(row.averageTicket)
        },
        {
          label: "تسجيل العملاء",
          render: (row) => formatPercent(row.customerCaptureRate)
        }
      ],
      rows
    });
}

function renderPosConfigs(rows) {
  const container = document.getElementById("posConfigsTable");
  if (!container) return;

  container.innerHTML =
    buildPosBranchTable({
      columns: [
        {
          label: "نقطة البيع",
          render: (row) => row.posConfigName || "-"
        },
        {
          label: "المعرض",
          render: (row) => row.branchName || "-"
        },
        {
          label: "عدد الفواتير",
          render: (row) => formatNumber(row.ordersCount, 0)
        },
        {
          label: "إجمالي المبيعات",
          render: (row) => formatMoney(row.grossSales)
        },
        {
          label: "المرتجعات",
          render: (row) => formatMoney(row.returnsValue)
        },
        {
          label: "صافي المبيعات",
          render: (row) => formatMoney(row.netSales)
        },
        {
          label: "متوسط الفاتورة",
          render: (row) => formatMoney(row.averageTicket)
        },
        {
          label: "تسجيل العملاء",
          render: (row) => formatPercent(row.customerCaptureRate)
        }
      ],
      rows
    });
}

function renderCashiers(rows) {
  const container = document.getElementById("cashiersTable");
  if (!container) return;

  container.innerHTML =
    buildPosBranchTable({
      columns: [
        {
          label: "الكاشير",
          render: (row) => row.cashierName || "-"
        },
        {
          label: "عدد الفواتير",
          render: (row) => formatNumber(row.ordersCount, 0)
        },
        {
          label: "إجمالي المبيعات",
          render: (row) => formatMoney(row.grossSales)
        },
        {
          label: "المرتجعات / استرداد أموال",
          render: (row) => formatMoney(row.returnsValue)
        },
        {
          label: "العروض والتعديلات السالبة",
          render: (row) => formatMoney(row.negativeAdjustmentsValue)
        },
        {
          label: "صافي المبيعات",
          render: (row) => formatMoney(row.netSales)
        },
        {
          label: "متوسط الفاتورة",
          render: (row) => formatMoney(row.averageTicket)
        },
        {
          label: "تسجيل العملاء",
          render: (row) => formatPercent(row.customerCaptureRate)
        }
      ],
      rows
    });
}

function renderProducts(rows, summary = {}) {
  const container = document.getElementById("productsTable");
  if (!container) return;

  const totalNetRevenue = Number(summary.netSales || 0);

  container.innerHTML =
    buildPosBranchTable({
      columns: [
        {
          label: "الصنف",
          render: (row) => row.productName || "-"
        },
        {
          label: "الباركود",
          render: (row) => row.barcode || "-"
        },
        {
          label: "الكمية",
          render: (row) => formatQty(row.qty)
        },
        {
          label: "إجمالي المبيعات",
          render: (row) => formatMoney(row.grossSales)
        },
        {
          label: "المرتجعات / استرداد أموال",
          render: (row) => formatMoney(row.returnsValue)
        },
        {
          label: "العروض والتعديلات السالبة",
          render: (row) => formatMoney(row.negativeAdjustmentsValue)
        },
        {
          label: "صافي المبيعات",
          render: (row) => formatMoney(row.netSales)
        },
        {
          label: "نسبة البيع من إجمالي الإيراد",
          render: (row) => formatPercent(
            Number.isFinite(Number(row.revenueSharePercent))
              ? Number(row.revenueSharePercent)
              : calculatePercent(row.netSales, totalNetRevenue)
          )
        },
        {
          label: "قيمة الخصم",
          render: (row) => formatMoney(row.discountValue)
        },
        {
          label: "عدد السطور",
          render: (row) => formatNumber(row.linesCount, 0)
        }
      ],
      rows
    });
}

function renderNotes(notes) {
  const container = document.getElementById("notesBox");
  if (!container) return;

  if (!notes.length) {
    container.innerHTML =
      `<div class="inventory-empty">لا توجد ملاحظات</div>`;

    return;
  }

  container.innerHTML = `
    <div class="analysis-box">
      ${
        notes
          .map((note) => `<p>${escapeHtml(note)}</p>`)
          .join("")
      }
    </div>
  `;
}

function buildPosBranchTable({ columns, rows }) {
  if (!rows || rows.length === 0) {
    return `
      <div class="inventory-empty">
        لا توجد بيانات داخل الفلتر الحالي
      </div>
    `;
  }

  return `
    <div class="inventory-table-wrap">
      <table class="inventory-data-table">
        <thead>
          <tr>
            ${
              columns
                .map((column) => `<th>${escapeHtml(column.label)}</th>`)
                .join("")
            }
          </tr>
        </thead>
        <tbody>
          ${
            rows
              .map((row) => `
                <tr>
                  ${
                    columns
                      .map((column) => {
                        const value = column.render(row);

                        return `<td>${escapeHtml(value)}</td>`;
                      })
                      .join("")
                  }
                </tr>
              `)
              .join("")
          }
        </tbody>
      </table>
    </div>
  `;
}

function buildBranchSalesExportQuery(params = {}) {
  const query = new URLSearchParams();

  query.set("report", "pos.branch_sales");

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, value);
  });

  return query.toString();
}

function getBranchSalesExportToken() {
  if (typeof getAuthToken === "function") {
    return getAuthToken();
  }

  return localStorage.getItem("token") || "";
}

function getFilenameFromContentDisposition(headerValue) {
  if (!headerValue) return "";

  const utf8Match =
    headerValue.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const normalMatch =
    headerValue.match(/filename="?([^"]+)"?/i);

  if (normalMatch?.[1]) {
    return normalMatch[1];
  }

  return "";
}

function getSelectedOptionText(selectId, fallback = "-") {
  const select = document.getElementById(selectId);
  const text = select?.selectedOptions?.[0]?.textContent?.trim();
  return text || fallback;
}

function buildBranchSalesPrintTitle() {
  const dateFrom = document.getElementById("dateFrom")?.value || "";
  const dateTo = document.getElementById("dateTo")?.value || "";
  const period = dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : "الفترة الحالية";
  return `تحليل أداء المعارض - ${period}`;
}

function populateBranchSalesPrintHeader() {
  const header = document.getElementById("branchSalesPrintHeader");
  if (!header) return;

  const dateFrom = document.getElementById("dateFrom")?.value || "-";
  const dateTo = document.getElementById("dateTo")?.value || "-";

  header.innerHTML = `
    <div>
      <span>Virginia Operations</span>
      <h1>تحليل أداء المعارض</h1>
    </div>
    <dl>
      <div><dt>الشركة</dt><dd>${escapeHtml(getSelectedOptionText("companySelect"))}</dd></div>
      <div><dt>الفرع</dt><dd>${escapeHtml(getSelectedOptionText("branchCode"))}</dd></div>
      <div><dt>الفترة</dt><dd>${escapeHtml(`${dateFrom} إلى ${dateTo}`)}</dd></div>
    </dl>
  `;
}

function printBranchSalesPdf() {
  const validation = validateBranchSalesContext();

  if (!validation.ok) {
    showErrorMessage(validation.message);
    return;
  }

  const productsTable = document.getElementById("productsTable");
  if (!productsTable?.textContent?.trim()) {
    showErrorMessage("حدّث التقرير أولًا قبل تصدير PDF.");
    return;
  }

  populateBranchSalesPrintHeader();

  const previousTitle = document.title;
  document.title = buildBranchSalesPrintTitle();

  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };

  window.addEventListener("afterprint", restoreTitle);
  window.print();

  window.setTimeout(() => {
    if (document.title !== previousTitle) restoreTitle();
  }, 1500);
}

async function downloadBranchSalesExcel() {
  const exportBtn = document.getElementById("exportBranchSalesBtn");
  const errorBox = document.getElementById("errorBox");
  const validation = validateBranchSalesContext();

  if (!validation.ok) {
    showErrorMessage(validation.message);
    return;
  }

  try {
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.textContent = "جاري التصدير...";
    }

    if (errorBox) {
      errorBox.classList.add("hidden");
      errorBox.textContent = "";
    }

    const filters = getBranchSalesFilters("export");
    const query = buildBranchSalesExportQuery(filters);
    const token = getBranchSalesExportToken();

    const response =
      await fetch(
        `${API_BASE_URL}/exports/excel?${query}`,
        {
          method: "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        }
      );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "فشل تصدير Excel");
    }

    const blob = await response.blob();

    const filename =
      getFilenameFromContentDisposition(
        response.headers.get("Content-Disposition")
      ) ||
      "pos-branch-sales.xlsx";

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);

    if (errorBox) {
      errorBox.textContent =
        error.message ||
        "حدث خطأ أثناء تصدير Excel";

      errorBox.classList.remove("hidden");
    }
  } finally {
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.textContent = "تصدير Excel";
    }
  }
}

function calculatePercent(value, total) {
  const numerator = Number(value || 0);
  const denominator = Number(total || 0);

  if (!denominator) return 0;

  return (numerator / denominator) * 100;
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

function formatPercent(value) {
  return `${formatNumber(value, 2)}%`;
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
