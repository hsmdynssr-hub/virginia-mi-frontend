document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "ملخص نقاط البيع",
    "ملخص تنفيذي موحد للمبيعات، المرتجعات، الخصومات، الفروع، الكاشيرات، وساعات الذروة.",
    "pos-summary",
    buildPosSummaryPage()
  );

  bindPosSummaryEvents();
  renderInitialState();
});

async function waitForReportFilters() {
  for (let i = 0; i < 30; i += 1) {
    if (window.ReportFilters) return;

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Report filters engine did not load");
}

function buildPosSummaryPage() {
  return `
    <section id="loadingBox" class="loading-box hidden">
      جاري تحميل ملخص نقاط البيع...
    </section>

    <section id="errorBox" class="error-box hidden"></section>

    <section id="pendingBox" class="inventory-report-card">
      <h2>التقرير لم يتم تحميله بعد</h2>
      <p class="inventory-muted-text">
        اختار الشركة ثم الفرع / النطاق، وبعدها اضغط
        <strong>تحديث التقرير</strong>
        لعرض البيانات.
      </p>
    </section>

    <section id="kpiGrid" class="inventory-kpi-grid"></section>

    <section class="inventory-report-card pos-summary-section">
      <h2>مؤشرات إدارية سريعة</h2>
      <div id="highlightsBox"></div>
    </section>

    <section class="inventory-report-card pos-summary-section">
      <h2>ملخص المعارض</h2>
      <p class="inventory-muted-text">
        أعلى المعارض حسب صافي المبيعات. التفاصيل الكاملة متاحة في Excel.
      </p>
      <div id="branchesTable"></div>
    </section>

    <section class="inventory-report-card pos-summary-section">
      <h2>ملخص الكاشيرات</h2>
      <p class="inventory-muted-text">
        أعلى الكاشيرات حسب صافي المبيعات. التفاصيل الكاملة متاحة في Excel.
      </p>
      <div id="cashiersTable"></div>
    </section>

    <section class="inventory-report-card pos-summary-section">
      <h2>ساعات الذروة</h2>
      <p class="inventory-muted-text">
        أقوى الساعات حسب عدد الفواتير. هذا مؤشر ضغط وليس مدة خدمة العميل.
      </p>
      <div id="hoursTable"></div>
    </section>

    <section class="inventory-report-card pos-summary-section">
      <h2>تحذيرات إدارية</h2>
      <div id="warningsBox"></div>
    </section>

    <section class="inventory-report-card pos-summary-section">
      <h2>ملاحظات الحساب</h2>
      <div id="notesBox"></div>
    </section>
  `;
}

function bindPosSummaryEvents() {
  document.getElementById("refreshPosSummaryBtn")
    ?.addEventListener("click", loadPosSummaryReport);

  document.getElementById("loadBtn")
    ?.addEventListener("click", loadPosSummaryReport);

  document.getElementById("companySelect")
    ?.addEventListener("change", async () => {
      try {
        await waitForReportFilters();

        if (window.ReportFilters?.apply) {
          await window.ReportFilters.apply("pos-summary");
        }
      } catch (error) {
        console.warn("Could not reload POS branch filters", error.message);
      }

      renderFilterChangedState();
    });

  document.addEventListener("change", (event) => {
    const target = event.target;

    if (!target) return;

    if (
      target.id === "branchCode" ||
      target.id === "dateFrom" ||
      target.id === "dateTo" ||
      target.id === "datePreset"
    ) {
      renderFilterChangedState();
    }
  });
}

function renderInitialState() {
  hideError();
  hideLoading();
  clearReportData();

  const pendingBox = document.getElementById("pendingBox");

  if (pendingBox) {
    pendingBox.classList.remove("hidden");
    pendingBox.innerHTML = `
      <h2>التقرير لم يتم تحميله بعد</h2>
      <p class="inventory-muted-text">
        اختار الشركة ثم الفرع / النطاق، وبعدها اضغط
        <strong>تحديث التقرير</strong>
        لعرض ملخص نقاط البيع.
      </p>
    `;
  }

  hideReportSections();
}

function renderFilterChangedState() {
  hideError();
  hideLoading();
  clearReportData();

  const pendingBox = document.getElementById("pendingBox");

  if (pendingBox) {
    pendingBox.classList.remove("hidden");
    pendingBox.innerHTML = `
      <h2>تم تغيير الفلاتر</h2>
      <p class="inventory-muted-text">
        اضغط <strong>تحديث التقرير</strong> لتطبيق الشركة والفرع والفترة الجديدة.
      </p>
    `;
  }

  hideReportSections();
}

function hideReportSections() {
  document.querySelectorAll(".pos-summary-section").forEach((section) => {
    section.classList.add("hidden");
  });
}

function showReportSections() {
  document.querySelectorAll(".pos-summary-section").forEach((section) => {
    section.classList.remove("hidden");
  });
}

function clearReportData() {
  const ids = [
    "kpiGrid",
    "highlightsBox",
    "branchesTable",
    "cashiersTable",
    "hoursTable",
    "warningsBox",
    "notesBox"
  ];

  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.innerHTML = "";
  });
}

function hideLoading() {
  document.getElementById("loadingBox")?.classList.add("hidden");
}

function showLoadingBox() {
  document.getElementById("loadingBox")?.classList.remove("hidden");
}

function hideError() {
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

function validatePosSummaryContext() {
  if (window.ReportFilters?.validate) {
    const validation = window.ReportFilters.validate();

    if (!validation.ok) {
      return validation;
    }
  }

  const companyId = document.getElementById("companySelect")?.value || "";

  if (!companyId) {
    return {
      ok: false,
      message: "لازم تختار الشركة قبل تحميل التقرير."
    };
  }

  const branchCode = document.getElementById("branchCode")?.value || "";

  if (!branchCode) {
    return {
      ok: false,
      message: "لازم تختار الفرع أو كل الفروع المسموحة قبل تحميل التقرير."
    };
  }

  return {
    ok: true
  };
}

function getPosSummaryFilters(mode = "summary") {
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

    mode,

    limit: isExport ? 100000 : 100000,
    linesLimit: isExport ? 250000 : 250000
  };
}

async function loadPosSummaryReport() {
  const validation = validatePosSummaryContext();

  if (!validation.ok) {
    showErrorMessage(validation.message);
    return;
  }

  try {
    showLoadingBox();
    hideError();

    const response = await apiGet(
      "/pos/summary",
      getPosSummaryFilters("summary")
    );

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل ملخص نقاط البيع");
    }

    document.getElementById("pendingBox")?.classList.add("hidden");

    showReportSections();
    renderPosSummaryReport(response.data || {});
  } catch (error) {
    console.error(error);

    showErrorMessage(
      error.message || "حدث خطأ أثناء تحميل ملخص نقاط البيع"
    );
  } finally {
    hideLoading();
  }
}

function renderPosSummaryReport(data) {
  renderPosSummaryKpis(data.summary || {});
  renderHighlights(data.highlights || []);
  renderBranches(data.branches || []);
  renderCashiers(data.cashiers || []);
  renderHours(data.hours || []);
  renderWarnings(data.warnings || []);
  renderNotes(data.notes || []);
}

function renderPosSummaryKpis(summary) {
  const kpiGrid = document.getElementById("kpiGrid");
  if (!kpiGrid) return;

  const cards = [
    {
      title: "عدد الفواتير",
      value: formatNumber(summary.ordersCount, 0),
      hint: "إجمالي فواتير POS في الفترة"
    },
    {
      title: "إجمالي المبيعات",
      value: formatMoney(summary.grossSales),
      hint: "المبيعات الموجبة فقط قبل المرتجعات"
    },
    {
      title: "المرتجعات",
      value: formatMoney(summary.returnsValue),
      hint: "مرتجعات منفصلة عن الخصومات"
    },
    {
      title: "صافي المبيعات",
      value: formatMoney(summary.netSales),
      hint: "إجمالي المبيعات - المرتجعات"
    },
    {
      title: "متوسط الفاتورة",
      value: formatMoney(summary.averageTicket),
      hint: "صافي المبيعات ÷ عدد الفواتير"
    },
    {
      title: "إجمالي الخصومات",
      value: formatMoney(summary.totalDiscountValue),
      hint: "الخصومات اليدوية حسب منطق تقرير المعارض"
    },
    {
      title: "نسبة الخصم",
      value: formatPercent(summary.discountPercent),
      hint: "إجمالي الخصم ÷ إجمالي المبيعات"
    },
    {
      title: "نسبة المرتجعات",
      value: formatPercent(summary.returnsPercent),
      hint: "المرتجعات ÷ إجمالي المبيعات"
    },
    {
      title: "إجمالي الهامش",
      value: formatMoney(summary.totalMargin),
      hint: "الهامش المتاح من Odoo إن وجد"
    },
    {
      title: "نسبة الهامش",
      value: formatPercent(summary.marginPercent),
      hint: "الهامش ÷ صافي المبيعات"
    },
    {
      title: "تسجيل العملاء",
      value: formatPercent(summary.customerCaptureRate),
      hint: "نسبة الفواتير المرتبطة بعميل"
    },
    {
      title: "الفروع النشطة",
      value: formatNumber(summary.activeBranchesCount, 0),
      hint: "عدد الفروع التي لديها فواتير"
    },
    {
      title: "الكاشيرات النشطة",
      value: formatNumber(summary.activeCashiersCount, 0),
      hint: "عدد الكاشيرات الذين لديهم فواتير"
    },
    {
      title: "نقاط البيع النشطة",
      value: formatNumber(summary.activePosConfigsCount, 0),
      hint: "عدد POS Configs النشطة"
    },
    {
      title: "أفضل معرض",
      value: summary.topBranchName || "-",
      hint: "حسب صافي المبيعات"
    },
    {
      title: "أقوى ساعة",
      value: summary.peakHourByOrders?.hourLabel || "-",
      hint: "حسب عدد الفواتير"
    }
  ];

  kpiGrid.innerHTML = cards
    .map((card) => `
      <div class="inventory-kpi-card">
        <span>${escapeHtml(card.title)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <small>${escapeHtml(card.hint)}</small>
      </div>
    `)
    .join("");
}

function renderHighlights(rows) {
  const container = document.getElementById("highlightsBox");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div class="inventory-empty">لا توجد مؤشرات.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="inventory-kpi-grid">
      ${rows.map((item) => `
        <div class="inventory-kpi-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value || "-")}</strong>
          <small>${escapeHtml(item.metric || "-")}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function renderBranches(rows) {
  renderTable("branchesTable", rows.slice(0, 10), [
    ["المعرض", "branchName"],
    ["عدد الفواتير", "ordersCount", (v) => formatNumber(v, 0)],
    ["إجمالي المبيعات", "grossSales", formatMoney],
    ["المرتجعات", "returnsValue", formatMoney],
    ["صافي المبيعات", "netSales", formatMoney],
    ["متوسط الفاتورة", "averageTicket", formatMoney],
    ["تسجيل العملاء", "customerCaptureRate", formatPercent]
  ]);
}

function renderCashiers(rows) {
  renderTable("cashiersTable", rows.slice(0, 10), [
    ["الكاشير", "cashierName"],
    ["عدد الفواتير", "ordersCount", (v) => formatNumber(v, 0)],
    ["إجمالي المبيعات", "grossSales", formatMoney],
    ["المرتجعات", "returnsValue", formatMoney],
    ["صافي المبيعات", "netSales", formatMoney],
    ["متوسط الفاتورة", "averageTicket", formatMoney],
    ["تسجيل العملاء", "customerCaptureRate", formatPercent]
  ]);
}

function renderHours(rows) {
  renderTable("hoursTable", rows.slice(0, 10), [
    ["الساعة", "hourLabel"],
    ["عدد الفواتير", "ordersCount", (v) => formatNumber(v, 0)],
    ["إجمالي المبيعات", "grossSales", formatMoney],
    ["المرتجعات", "returnsValue", formatMoney],
    ["صافي المبيعات", "netSales", formatMoney],
    ["متوسط الفاتورة", "averageTicket", formatMoney],
    ["فاصل الفواتير / دقيقة", "averageInvoiceGapMinutes", formatNullableNumber],
    ["التقييم", "evaluationLabel"]
  ]);
}

function renderWarnings(warnings) {
  const container = document.getElementById("warningsBox");
  if (!container) return;

  if (!warnings.length) {
    container.innerHTML = `
      <div class="analysis-box">
        لا توجد تحذيرات إدارية واضحة في الفترة المحددة.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="analysis-box">
      <ul>
        ${warnings.map((warning) => `
          <li>
            <strong>${escapeHtml(warning.level || "info")}:</strong>
            ${escapeHtml(warning.message || warning)}
          </li>
        `).join("")}
      </ul>
    </div>
  `;
}

function renderNotes(notes) {
  const container = document.getElementById("notesBox");
  if (!container) return;

  if (!notes.length) {
    container.innerHTML = `<div class="inventory-empty">لا توجد ملاحظات.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="analysis-box">
      <ul>
        ${notes.map((note) => `
          <li>${escapeHtml(note)}</li>
        `).join("")}
      </ul>
    </div>
  `;
}

function renderTable(containerId, rows, columns) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!Array.isArray(rows) || !rows.length) {
    container.innerHTML = `<div class="inventory-empty">لا توجد بيانات.</div>`;
    return;
  }

  const header = columns
    .map(([label]) => `<th>${escapeHtml(label)}</th>`)
    .join("");

  const body = rows
    .map((row) => {
      const cells = columns.map(([label, key, formatter]) => {
        const raw = row[key];
        const value = formatter ? formatter(raw, row) : raw;

        return `<td>${escapeHtml(value)}</td>`;
      }).join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="inventory-table-wrap">
      <table class="inventory-data-table">
        <thead>
          <tr>${header}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function formatNumber(value, digits = 2) {
  const number = Number(value || 0);

  return number.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatNullableNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  return formatNumber(value, 2);
}

function formatMoney(value) {
  return `${formatNumber(value, 2)} ج`;
}

function formatPercent(value) {
  return `${formatNumber(value, 2)}%`;
}

function escapeHtml(value) {
  
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}