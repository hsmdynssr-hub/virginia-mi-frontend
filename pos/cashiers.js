document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "تقييم الكاشيرات",
    "متابعة عدد الفواتير، ساعات العمل الفعلية، ومعدل تسجيل أرقام تليفون العملاء.",
    "pos-cashiers",
    buildCashiersPage()
  );

  bindCashiersEvents();
  renderInitialState();
});

function buildCashiersPage() {
  return `
    <section id="cashiersLoadingBox" class="loading-box hidden">
      جاري تحميل تقرير الكاشيرات...
    </section>

    <section id="cashiersErrorBox" class="error-box hidden"></section>

    <section id="cashiersPendingBox" class="inventory-report-card">
      <h2>التقرير لم يتم تحميله بعد</h2>
      <p class="inventory-muted-text">
        اختار الشركة ثم الفرع / النطاق، وبعدها اضغط <strong>تحديث التقرير</strong> لعرض البيانات.
      </p>
    </section>

    <section id="cashiersKpiGrid" class="inventory-kpi-grid"></section>

    <section class="inventory-report-card">
      <h2>ملخص الكاشيرات</h2>
      <p class="inventory-section-hint">
        التقرير يعرض ملخص كل كاشير داخل الفترة المختارة بدون تفاصيل يومية لتقليل الزحمة.
      </p>
      <div id="cashiersSummaryTable"></div>
    </section>

    <section class="inventory-report-card">
      <h2>ملاحظات التقرير</h2>
      <div id="cashiersNotesBox"></div>
    </section>
  `;
}

function bindCashiersEvents() {
  const refreshBtn = document.getElementById("refreshCashiersBtn");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadCashiersReport);
  }

  document.addEventListener("change", (event) => {
    if (event.target?.id === "branchCode") {
      renderFilterChangedState();
    }
  });

  const loadBtn = document.getElementById("loadBtn");

  if (loadBtn) {
    loadBtn.addEventListener("click", loadCashiersReport);
  }

  const companySelect = document.getElementById("companySelect");

  if (companySelect) {
    companySelect.addEventListener("change", async () => {
      await applyReportFiltersForPage("pos-cashiers");
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
  hideCashiersLoadingBox();
  hideCashiersErrorBox();
  clearCashiersReport();
  showCashiersPendingMessage("التقرير لم يتم تحميله بعد", "اختار الشركة ثم الفرع / النطاق، وبعدها اضغط تحديث التقرير لعرض البيانات.");
}

function renderFilterChangedState() {
  hideCashiersLoadingBox();
  hideCashiersErrorBox();
  clearCashiersReport();
  showCashiersPendingMessage("تم تغيير الفلاتر", "اضغط تحديث التقرير لتطبيق الشركة والفرع والفترة الجديدة.");
}

function showCashiersPendingMessage(title, message) {
  const pendingBox = document.getElementById("cashiersPendingBox");
  if (!pendingBox) return;

  pendingBox.classList.remove("hidden");
  pendingBox.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <p class="inventory-muted-text">${escapeHtml(message)}</p>
  `;
}

function hideCashiersPendingBox() {
  document.getElementById("cashiersPendingBox")?.classList.add("hidden");
}

function hideCashiersLoadingBox() {
  document.getElementById("cashiersLoadingBox")?.classList.add("hidden");
}

function hideCashiersErrorBox() {
  const errorBox = document.getElementById("cashiersErrorBox");
  if (!errorBox) return;

  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function showCashiersErrorMessage(message) {
  const errorBox = document.getElementById("cashiersErrorBox");
  if (!errorBox) {
    alert(message);
    return;
  }

  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearCashiersReport() {
  [
    "cashiersKpiGrid",
    "cashiersSummaryTable",
    "cashiersNotesBox"
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.innerHTML = "";
  });
}

function validateCashiersContext() {
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

function getCashiersFilters() {
  return {
    companyId:
      document.getElementById("companySelect")?.value ||
      "",

    dateFrom: document.getElementById("dateFrom")?.value || "",
    dateTo: document.getElementById("dateTo")?.value || "",

    branchCode:
      document.getElementById("branchCode")?.value ||
      document.getElementById("cashierBranchCode")?.value ||
      "",

    limit: 30000
  };
}

async function loadCashiersReport() {
  const validation = validateCashiersContext();

  if (!validation.ok) {
    showCashiersErrorMessage(validation.message);
    return;
  }

  const loadingBox = document.getElementById("cashiersLoadingBox");

  try {
    if (loadingBox) loadingBox.classList.remove("hidden");

    hideCashiersErrorBox();

    const response = await apiGet(
      "/pos/cashier-intelligence",
      getCashiersFilters()
    );

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل تقرير الكاشيرات");
    }

    hideCashiersPendingBox();
    renderCashiersReport(response.data || {});
  } catch (error) {
    console.error(error);

    showCashiersErrorMessage(
      error.message || "حدث خطأ أثناء تحميل تقرير الكاشيرات"
    );
  } finally {
    if (loadingBox) loadingBox.classList.add("hidden");
  }
}

async function loadCashierBranchOptions() {
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
    console.warn("Could not load cashier branch options", error);

    select.innerHTML = `<option value="">تعذر تحميل الفروع</option>`;
    select.value = "";
  }
}

function renderCashiersReport(data) {
  const summary = data.summary || {};
  const cashiers = data.cashiers || [];
  const notes = data.notes || [];

  renderCashiersKpis(summary);
  renderCashiersTable(cashiers);
  renderCashiersNotes(notes);
}

function formatNumber(value, digits = 2) {
  const num = Number(value || 0);

  return num.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatPercent(value) {
  return `${formatNumber(value, 2)}%`;
}

function formatHours(value) {
  return `${formatNumber(value, 2)} ساعة`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCashiersKpis(summary) {
  const container = document.getElementById("cashiersKpiGrid");
  if (!container) return;

  const topOrders = summary.topCashierByOrders || summary.topCashier || {};
  const topSpeed = summary.topCashierByInvoicesPerHour || {};
  const bestPhone = summary.bestCashierByPhoneCapture || {};
  const lowestPhone = summary.lowestCashierByPhoneCapture || {};

  const cards = [
    {
      title: "عدد الكاشيرات",
      value: formatNumber(summary.cashiersCount, 0),
      hint: "الكاشيرات الذين لديهم فواتير داخل الفترة"
    },
    {
      title: "عدد الفواتير",
      value: formatNumber(summary.ordersCount, 0),
      hint: "إجمالي فواتير POS داخل الفترة"
    },
    {
      title: "إجمالي ساعات العمل",
      value: formatHours(summary.totalWorkingHours),
      hint: "محسوبة داخليًا من أول وآخر فاتورة لكل كاشير يوميًا"
    },
    {
      title: "متوسط الفواتير / ساعة",
      value: formatNumber(summary.averageInvoicesPerHour, 2),
      hint: "إجمالي الفواتير ÷ ساعات العمل الفعلية"
    },
    {
      title: "رقم من بيانات/اسم العميل",
      value: formatNumber(summary.totalOrdersWithCustomerIdentityPhone, 0),
      hint: formatPercent(summary.averageIdentityPhoneCaptureRate)
    },
    {
      title: "رقم من الملاحظات",
      value: formatNumber(summary.totalOrdersWithCustomerNotesPhone, 0),
      hint: formatPercent(summary.averageNotesPhoneCaptureRate)
    },
    {
      title: "إجمالي مسجل الرقم",
      value: formatNumber(summary.totalOrdersWithAnyCustomerPhone, 0),
      hint: formatPercent(summary.averagePhoneCaptureRate)
    },
    {
      title: "أعلى كاشير فواتير",
      value: topOrders.cashierName || "-",
      hint: `${formatNumber(topOrders.ordersCount, 0)} فاتورة`
    },
    {
      title: "أسرع كاشير",
      value: topSpeed.cashierName || "-",
      hint: `${formatNumber(topSpeed.invoicesPerHour, 2)} فاتورة / ساعة`
    },
    {
      title: "أفضل تسجيل رقم",
      value: bestPhone.cashierName || "-",
      hint: formatPercent(bestPhone.phoneCaptureRate)
    },
    {
      title: "أقل تسجيل رقم",
      value: lowestPhone.cashierName || "-",
      hint: formatPercent(lowestPhone.phoneCaptureRate)
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

function renderCashiersTable(rows) {
  const container = document.getElementById("cashiersSummaryTable");
  if (!container) return;

  container.innerHTML = buildCashiersTable({
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
        label: "أيام العمل",
        render: (row) => formatNumber(row.workingDays, 0)
      },
      {
        label: "ساعات العمل",
        render: (row) => formatNumber(row.totalWorkingHours, 2)
      },
      {
        label: "متوسط ساعات / يوم",
        render: (row) => formatNumber(row.averageWorkingHoursPerDay, 2)
      },
      {
        label: "متوسط فواتير / يوم",
        render: (row) => formatNumber(row.averageInvoicesPerDay, 2)
      },
      {
        label: "فواتير / ساعة",
        render: (row) => formatNumber(row.invoicesPerHour, 2)
      },
      {
        label: "رقم من بيانات/اسم العميل",
        render: (row) =>
          formatNumber(row.ordersWithCustomerIdentityPhone, 0)
      },
      {
        label: "رقم من الملاحظات",
        render: (row) =>
          formatNumber(row.ordersWithCustomerNotesPhone, 0)
      },
      {
        label: "إجمالي مسجل الرقم",
        render: (row) =>
          formatNumber(row.ordersWithAnyCustomerPhone, 0)
      },
      {
        label: "بدون رقم",
        render: (row) =>
          formatNumber(row.ordersWithoutCustomerPhone, 0)
      },
      {
        label: "نسبة التسجيل",
        render: (row) => formatPercent(row.phoneCaptureRate)
      }
    ],
    rows
  });
}

function renderCashiersNotes(notes) {
  const container = document.getElementById("cashiersNotesBox");
  if (!container) return;

  if (!notes.length) {
    container.innerHTML = `<div class="inventory-empty">لا توجد ملاحظات</div>`;
    return;
  }

  container.innerHTML = `
    <div class="analysis-box">
      ${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}
    </div>
  `;
}

function buildCashiersTable({ columns, rows }) {
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