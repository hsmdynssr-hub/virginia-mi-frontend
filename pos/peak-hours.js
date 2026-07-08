window.REPORT_EXPORT_CODE = "pos.peak_hours";
window.REPORT_EXPORT_FILENAME = "pos-peak-hours";

document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "تحليل ساعات البيع",
    "معرفة أوقات الذروة والضعف حسب عدد الفواتير، المبيعات، متوسط الفاتورة، والفاصل بين الفواتير.",
    "pos-peak-hours",
    buildPeakHoursPage()
  );

  bindPeakHoursEvents();
  renderInitialState();
});

function buildPeakHoursPage() {
  return `
    <section id="peakHoursLoadingBox" class="loading-box hidden">
      جاري تحميل تحليل ساعات البيع...
    </section>

    <section id="peakHoursErrorBox" class="error-box hidden"></section>

    <section id="peakHoursPendingBox" class="inventory-report-card">
      <h2>التقرير لم يتم تحميله بعد</h2>
      <p class="inventory-muted-text">
        اختار الشركة ثم الفرع / النطاق، وبعدها اضغط <strong>تحديث التقرير</strong> لعرض البيانات.
      </p>
    </section>

    <section id="peakHoursKpiGrid" class="inventory-kpi-grid"></section>

    <section class="inventory-report-card">
      <h2>تحليل الساعات</h2>
      <p class="inventory-section-hint">
        يتم التصنيف مقارنة بمتوسط الفواتير لكل ساعة نشطة داخل الفترة المختارة.
      </p>
      <div id="peakHoursTable"></div>
    </section>

    <section class="inventory-report-card">
      <h2>توصيات تشغيلية</h2>
      <div id="peakHoursRecommendationsBox"></div>
    </section>

    <section class="inventory-report-card">
      <h2>ملاحظات التقرير</h2>
      <div id="peakHoursNotesBox"></div>
    </section>
  `;
}

function bindPeakHoursEvents() {
  const refreshBtn = document.getElementById("refreshPeakHoursBtn");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadPeakHoursReport);
  }

  document.addEventListener("change", (event) => {
    if (event.target?.id === "branchCode") {
      renderFilterChangedState();
    }
  });

  const loadBtn = document.getElementById("loadBtn");

  if (loadBtn) {
    loadBtn.addEventListener("click", loadPeakHoursReport);
  }

  const companySelect = document.getElementById("companySelect");

  if (companySelect) {
    companySelect.addEventListener("change", async () => {
      await applyReportFiltersForPage("pos-peak-hours");
      renderFilterChangedState();
    });
  }

  ["datePreset", "dateFrom", "dateTo"].forEach((id) => {
  const element = document.getElementById(id);

  if (!element) return;

  element.addEventListener("change", renderFilterChangedState);
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
  hidePeakHoursLoadingBox();
  hidePeakHoursErrorBox();
  clearPeakHoursReport();
  showPeakHoursPendingMessage("التقرير لم يتم تحميله بعد", "اختار الشركة ثم الفرع / النطاق، وبعدها اضغط تحديث التقرير لعرض البيانات.");
}

function renderFilterChangedState() {
  hidePeakHoursLoadingBox();
  hidePeakHoursErrorBox();
  clearPeakHoursReport();
  showPeakHoursPendingMessage("تم تغيير الفلاتر", "اضغط تحديث التقرير لتطبيق الشركة والفرع والفترة الجديدة.");
}

function showPeakHoursPendingMessage(title, message) {
  const pendingBox = document.getElementById("peakHoursPendingBox");
  if (!pendingBox) return;

  pendingBox.classList.remove("hidden");
  pendingBox.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <p class="inventory-muted-text">${escapeHtml(message)}</p>
  `;
}

function hidePeakHoursPendingBox() {
  document.getElementById("peakHoursPendingBox")?.classList.add("hidden");
}

function hidePeakHoursLoadingBox() {
  document.getElementById("peakHoursLoadingBox")?.classList.add("hidden");
}

function hidePeakHoursErrorBox() {
  const errorBox = document.getElementById("peakHoursErrorBox");
  if (!errorBox) return;

  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function showPeakHoursErrorMessage(message) {
  const errorBox = document.getElementById("peakHoursErrorBox");
  if (!errorBox) {
    alert(message);
    return;
  }

  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearPeakHoursReport() {
  [
    "peakHoursKpiGrid",
    "peakHoursTable",
    "peakHoursRecommendationsBox",
    "peakHoursNotesBox"
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.innerHTML = "";
  });
}

function validatePeakHoursContext() {
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

function getPeakHoursFilters() {
  return {
    companyId:
      document.getElementById("companySelect")?.value ||
      "",

    dateFrom: document.getElementById("dateFrom")?.value || "",
    dateTo: document.getElementById("dateTo")?.value || "",

    branchCode:
      document.getElementById("branchCode")?.value ||
      document.getElementById("peakHoursBranchCode")?.value ||
      "",

    limit: 100000
  };
}

async function loadPeakHoursReport() {
  const validation = validatePeakHoursContext();

  if (!validation.ok) {
    showPeakHoursErrorMessage(validation.message);
    return;
  }

  const loadingBox = document.getElementById("peakHoursLoadingBox");

  try {
    if (loadingBox) loadingBox.classList.remove("hidden");

    hidePeakHoursErrorBox();

    const response = await apiGet(
      "/pos/peak-hours",
      getPeakHoursFilters()
    );

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل تحليل ساعات البيع");
    }

    hidePeakHoursPendingBox();
    renderPeakHoursReport(response.data || {});
  } catch (error) {
    console.error(error);

    showPeakHoursErrorMessage(
      error.message || "حدث خطأ أثناء تحميل تحليل ساعات البيع"
    );
  } finally {
    if (loadingBox) loadingBox.classList.add("hidden");
  }
}

async function loadPeakHoursBranchOptions() {
  const select = document.getElementById("branchCode");
  if (!select) return;

  const currentValue = select.value || "";
  const companyId = document.getElementById("companySelect")?.value || "";

  if (!companyId) {
    select.innerHTML = `<option value="">اختر الشركة أولًا</option>`;
    select.value = "";
    return;
  }

  try {
    const response = await apiGet("/pos-branch-access/me", {
      companyId
    });

    const raw =
      response.data?.branches ||
      response.branches ||
      response.data ||
      [];

    const branches = Array.isArray(raw) ? raw : [];

    select.innerHTML = `
      <option value="">اختر الفرع / النطاق</option>
      <option value="all">كل المعارض</option>
    `;

    branches.forEach((branch) => {
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

      if (!branchCode) return;

      const option = document.createElement("option");
      option.value = branchCode;
      option.textContent = branchName;
      select.appendChild(option);
    });

    const exists = Array.from(select.options).some(
      (option) => option.value === currentValue
    );

    select.value = exists ? currentValue : "";
  } catch (error) {
    console.warn("Could not load peak-hours branch options", error);

    select.innerHTML = `<option value="">تعذر تحميل الفروع</option>`;
    select.value = "";
  }
}

function renderPeakHoursReport(data) {
  const summary = data.summary || {};
  const hours = data.hours || [];
  const recommendations = data.recommendations || [];
  const notes = data.notes || [];

  renderPeakHoursKpis(summary);
  renderPeakHoursTable(hours);
  renderPeakHoursRecommendations(recommendations);
  renderPeakHoursNotes(notes);
}

function formatNumber(value, digits = 2) {
  const num = Number(value || 0);

  return num.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatMoney(value) {
  return formatNumber(value, 2);
}

function formatPercent(value) {
  return `${formatNumber(value, 2)}%`;
}

function formatMinutes(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return `${formatNumber(value, 2)} دقيقة`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPeakHoursKpis(summary) {
  const container = document.getElementById("peakHoursKpiGrid");
  if (!container) return;

  const peakOrders = summary.peakHourByOrders || {};
  const peakSales = summary.peakHourBySales || {};
  const lowestOrders = summary.lowestHourByOrders || {};

  const cards = [
    {
      title: "عدد الفواتير",
      value: formatNumber(summary.ordersCount, 0),
      hint: "إجمالي فواتير POS داخل الفترة"
    },
    {
      title: "صافي المبيعات",
      value: formatMoney(summary.netSales),
      hint: "المبيعات بعد طرح المرتجعات"
    },
    {
      title: "متوسط الفاتورة",
      value: formatMoney(summary.averageTicket),
      hint: "صافي المبيعات ÷ عدد الفواتير"
    },
    {
      title: "عدد الساعات النشطة",
      value: formatNumber(summary.activeHoursCount, 0),
      hint: "الساعات التي حدث بها بيع فعلي"
    },
    {
      title: "متوسط الفواتير / ساعة",
      value: formatNumber(summary.averageOrdersPerActiveHour, 2),
      hint: "على الساعات النشطة فقط"
    },
    {
      title: "متوسط المبيعات / ساعة",
      value: formatMoney(summary.averageSalesPerActiveHour),
      hint: "صافي المبيعات ÷ الساعات النشطة"
    },
    {
      title: "أقوى ساعة بالفواتير",
      value: peakOrders.hourLabel || "-",
      hint: `${formatNumber(peakOrders.ordersCount, 0)} فاتورة`
    },
    {
      title: "أقوى ساعة بالمبيعات",
      value: peakSales.hourLabel || "-",
      hint: formatMoney(peakSales.netSales)
    },
    {
      title: "أضعف ساعة نشطة",
      value: lowestOrders.hourLabel || "-",
      hint: `${formatNumber(lowestOrders.ordersCount, 0)} فاتورة`
    },
    {
      title: "متوسط الفاصل بين الفواتير",
      value: formatMinutes(summary.averageInvoiceGapMinutes),
      hint: "مؤشر ضغط تقريبي وليس مدة خدمة العميل"
    }
  ];

  container.innerHTML = cards
    .map((card) => `
      <div class="inventory-kpi-card">
        <span>${escapeHtml(card.title)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <small>${escapeHtml(card.hint)}</small>
      </div>
    `)
    .join("");
}

function renderPeakHoursTable(rows) {
  const container = document.getElementById("peakHoursTable");
  if (!container) return;

  container.innerHTML = buildPeakHoursTable({
    columns: [
      {
        label: "الساعة",
        render: (row) => row.hourLabel || "-"
      },
      {
        label: "عدد الفواتير",
        render: (row) => formatNumber(row.ordersCount, 0)
      },
      {
        label: "صافي المبيعات",
        render: (row) => formatMoney(row.netSales)
      },
      {
        label: "المرتجعات",
        render: (row) => formatMoney(row.returnsValue)
      },
      {
        label: "متوسط الفاتورة",
        render: (row) => formatMoney(row.averageTicket)
      },
      {
        label: "متوسط فواتير / يوم",
        render: (row) => formatNumber(row.averageOrdersPerSelectedDay, 2)
      },
      {
        label: "نسبة الفواتير",
        render: (row) => formatPercent(row.ordersPercent)
      },
      {
        label: "نسبة المبيعات",
        render: (row) => formatPercent(row.netSalesPercent)
      },
      {
        label: "فاصل الفواتير",
        render: (row) => formatMinutes(row.averageInvoiceGapMinutes)
      },
      {
        label: "التقييم",
        render: (row) => row.evaluationLabel || "-"
      }
    ],
    rows
  });
}

function renderPeakHoursRecommendations(recommendations) {
  const container = document.getElementById("peakHoursRecommendationsBox");
  if (!container) return;

  if (!recommendations.length) {
    container.innerHTML =
      `<div class="inventory-empty">لا توجد توصيات داخل الفلتر الحالي</div>`;
    return;
  }

  container.innerHTML = `
    <div class="analysis-box">
      ${recommendations.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
    </div>
  `;
}

function renderPeakHoursNotes(notes) {
  const container = document.getElementById("peakHoursNotesBox");
  if (!container) return;

  if (!notes.length) {
    container.innerHTML =
      `<div class="inventory-empty">لا توجد ملاحظات</div>`;
    return;
  }

  container.innerHTML = `
    <div class="analysis-box">
      ${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}
    </div>
  `;
}

function buildPeakHoursTable({ columns, rows }) {
  if (!rows || rows.length === 0) {
    return `<div class="inventory-empty">لا توجد بيانات داخل الفلتر الحالي</div>`;
  }

  return `
    <div class="inventory-table-wrap">
      <table class="inventory-data-table">
        <thead>
          <tr>
            ${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              ${columns.map((column) => `<td>${escapeHtml(column.render(row))}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}