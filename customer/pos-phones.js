const ROWS_PER_PAGE = 200;

let allInvoiceRows = [];
let currentPage = 1;
const selectedInvoiceRows = new Map();

document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "متابعة عملاء نقاط البيع",
    "كل أرقام عملاء POS مع حالة الرسالة والتقييم والمتابعة والكوبون في شاشة واحدة.",
    "customer-pos-phones",
    buildCustomerPosPhonesPage()
  );

  bindCustomerPosPhonesEvents();
  renderInitialState();
});

function buildCustomerPosPhonesPage() {
  return `
    <section id="loadingBox" class="loading-box hidden">
      جاري تحميل متابعة عملاء نقاط البيع...
    </section>

    <section id="errorBox" class="error-box hidden"></section>

    <section id="pendingBox" class="inventory-report-card">
      <h2>التقرير لم يتم تحميله بعد</h2>
      <p class="inventory-muted-text">
        اختار الشركة ثم الفرع / النطاق من الهيدر، وبعدها اضغط
        <strong>تحديث التقرير</strong>
        لعرض فواتير العملاء.
      </p>
    </section>

    <section id="kpiGrid" class="inventory-kpi-grid"></section>

    <section class="inventory-report-card customer-pos-phones-report-section hidden">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <h2>عملاء نقاط البيع وحالة التواصل</h2>
          <p class="inventory-muted-text">
            يعرض التقرير 200 صف في الصفحة الواحدة. استخدم التقسيم للانتقال بين باقي الأرقام.
          </p>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <select class="control" id="customerStateFilter">
            <option value="all">كل الحالات</option>
            <option value="not_sent">لم تُرسل رسالة</option>
            <option value="pending_review">في انتظار التقييم</option>
            <option value="positive">إيجابي</option>
            <option value="neutral">محايد</option>
            <option value="angry">غاضب</option>
            <option value="send_failed">فشل الإرسال</option>
          </select>
          <button class="run-btn" id="exportDailyTrackingBtn">تصدير التقرير اليومي Excel</button>
          <button class="run-btn" id="exportSelectedInvoicesBtn">تصدير المحدد</button>
        </div>
      </div>

      <div id="invoiceRowsTable"></div>
    </section>

    <section class="inventory-report-card customer-pos-phones-report-section hidden">
      <h2>ملاحظات الحساب</h2>
      <div id="notesBox"></div>
    </section>
  `;
}

function bindCustomerPosPhonesEvents() {
  document.getElementById("refreshCustomerPhonesBtn")
    ?.addEventListener("click", loadCustomerPosPhonesReport);

  document.getElementById("loadBtn")
    ?.addEventListener("click", loadCustomerPosPhonesReport);

  document.getElementById("exportSelectedInvoicesBtn")
    ?.addEventListener("click", exportSelectedInvoicesToExcel);

  document.getElementById("exportDailyTrackingBtn")
    ?.addEventListener("click", exportDailyTrackingExcel);

  document.getElementById("customerStateFilter")
    ?.addEventListener("change", loadCustomerPosPhonesReport);

  document.getElementById("companySelect")
    ?.addEventListener("change", async () => {
      resetReportState();
      await applyReportFiltersForPage("customer-pos-phones");
      renderInitialState("تم تغيير الشركة. اختار الفرع / النطاق ثم اضغط تحديث التقرير لتحميل البيانات.");
    });

  document.addEventListener("change", (event) => {
    const target = event.target;

    if (!target) return;

    if (
      target.id === "branchCode" ||
      target.id === "datePreset" ||
      target.id === "dateFrom" ||
      target.id === "dateTo"
    ) {
      resetReportState();
      renderInitialState("تم تغيير الفلاتر. اضغط تحديث التقرير لتحميل البيانات.");
    }
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

function getSelectedCompanyId() {
  return document.getElementById("companySelect")?.value || "";
}

function getSelectedBranchCode() {
  return document.getElementById("branchCode")?.value || "";
}

function validateCustomerPhonesContext() {
  const companyId = getSelectedCompanyId();
  const branchCode = getSelectedBranchCode();

  if (!companyId) {
    return {
      ok: false,
      message: "لازم تختار الشركة قبل تحميل تقرير أرقام العملاء."
    };
  }

  if (!branchCode) {
    return {
      ok: false,
      message: "لازم تختار الفرع أو كل الفروع قبل تحميل التقرير."
    };
  }

  return {
    ok: true
  };
}

function getFilters() {
  return {
    companyId: getSelectedCompanyId(),

    dateFrom:
      document.getElementById("dateFrom")?.value || "",

    dateTo:
      document.getElementById("dateTo")?.value || "",

    branchCode: getSelectedBranchCode(),

    limit: 100000,
    linesLimit: 250000,
    segment: document.getElementById("customerStateFilter")?.value || "all"
  };
}

async function loadCustomerPosPhonesReport() {
  const validation = validateCustomerPhonesContext();

  if (!validation.ok) {
    showError(validation.message);
    return;
  }

  const loadingBox = document.getElementById("loadingBox");
  const loadBtn = document.getElementById("loadBtn");

  try {
    if (loadingBox) loadingBox.classList.remove("hidden");
    clearError();

    if (loadBtn) {
      loadBtn.disabled = true;
      loadBtn.textContent = "جاري التحميل...";
    }

    resetReportState();

    const response = await apiGet("/customer/review-tracking", getFilters());

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل تقرير أرقام العملاء");
    }

    hidePendingBox();
    showReportSections();
    renderReport(response.data || {});
  } catch (error) {
    console.error(error);
    showError(error.message || "حدث خطأ أثناء تحميل تقرير أرقام العملاء");
  } finally {
    if (loadingBox) loadingBox.classList.add("hidden");

    if (loadBtn) {
      loadBtn.disabled = false;
      loadBtn.textContent = "تحديث التقرير";
    }
  }
}

function resetReportState() {
  allInvoiceRows = [];
  currentPage = 1;
  selectedInvoiceRows.clear();
}

function renderInitialState(message = "اختار الشركة ثم الفرع / النطاق من الهيدر، وبعدها اضغط تحديث التقرير لتحميل بيانات أرقام العملاء.") {
  clearError();
  resetReportState();
  clearReportContent();
  hideReportSections();
  showPendingMessage("التقرير لم يتم تحميله بعد", message);
}

function clearReportContent() {
  const kpiGrid = document.getElementById("kpiGrid");
  const table = document.getElementById("invoiceRowsTable");
  const notes = document.getElementById("notesBox");

  if (kpiGrid) kpiGrid.innerHTML = "";
  if (table) table.innerHTML = "";
  if (notes) notes.innerHTML = "";
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

function hideReportSections() {
  document.querySelectorAll(".customer-pos-phones-report-section").forEach((section) => {
    section.classList.add("hidden");
  });
}

function showReportSections() {
  document.querySelectorAll(".customer-pos-phones-report-section").forEach((section) => {
    section.classList.remove("hidden");
  });
}

function clearError() {
  const errorBox = document.getElementById("errorBox");
  if (!errorBox) return;

  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function showError(message) {
  const errorBox = document.getElementById("errorBox");
  if (!errorBox) {
    alert(message);
    return;
  }

  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function renderReport(data) {
  allInvoiceRows = Array.isArray(data.rows)
    ? data.rows
    : Array.isArray(data.invoiceRows)
    ? data.invoiceRows
    : Array.isArray(data.customers)
      ? data.customers
      : [];

  currentPage = 1;

  initializeSelectedRows(allInvoiceRows);

  renderKpis(data.summary || {});
  renderInvoiceRows();
  renderNotes(data.notes || []);
}

function initializeSelectedRows(rows) {
  selectedInvoiceRows.clear();

  rows.forEach((row, index) => {
    const rowKey = buildRowKey(row, index);

    selectedInvoiceRows.set(rowKey, {
      ...row,
      __selected: false,
      __rowIndex: index
    });
  });
}

function renderKpis(summary) {
  const container = document.getElementById("kpiGrid");
  if (!container) return;

  const cards = [
    {
      title: "إجمالي العملاء",
      value: formatNumber(summary.total, 0),
      hint: "كل فواتير العملاء داخل الفترة"
    },
    {
      title: "محايدون وغاضبون",
      value: formatNumber(Number(summary.neutral || 0) + Number(summary.angry || 0), 0),
      hint: "تحتاج متابعة خدمة العملاء"
    },
    {
      title: "في انتظار التقييم",
      value: formatNumber(summary.pendingReview, 0),
      hint: "تم الإرسال ولم يصل تقييم"
    },
    {
      title: "عملاء إيجابيون",
      value: formatNumber(summary.positive, 0),
      hint: `كوبونات نشطة: ${formatNumber(summary.activeCoupons, 0)}`
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

function renderInvoiceRows() {
  const container = document.getElementById("invoiceRowsTable");
  if (!container) return;

  if (!Array.isArray(allInvoiceRows) || !allInvoiceRows.length) {
    container.innerHTML = `<div class="inventory-empty">لا توجد فواتير بها رقم عميل داخل الفلاتر الحالية.</div>`;
    updateSelectedRowsCount();
    return;
  }

  const totalPages = getTotalPages();
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = Math.min(startIndex + ROWS_PER_PAGE, allInvoiceRows.length);
  const visibleRows = allInvoiceRows.slice(startIndex, endIndex);

  const tbody = visibleRows
    .map((row, visibleIndex) => {
      const absoluteIndex = startIndex + visibleIndex;
      const invoiceUrl = buildInvoiceUrl(row);
      const rowKey = buildRowKey(row, absoluteIndex);
      const selectedRow = selectedInvoiceRows.get(rowKey);

      return `
        <tr>
          <td style="text-align:center;">
            <input
              type="checkbox"
              class="invoice-export-check"
              data-row-key="${escapeHtml(rowKey)}"
              ${selectedRow?.__selected ? "checked" : ""}
            />
          </td>
          <td>${escapeHtml(row.phone || "-")}</td>
          <td>${renderCustomerState(row.customerState)}</td>
          <td>${escapeHtml(row.messageStatus || "-")}</td>
          <td>${escapeHtml(row.rating || "-")}</td>
          <td>${escapeHtml(row.followupStatus || "-")}</td>
          <td>${escapeHtml(row.assignedTo || "-")}</td>
          <td>${escapeHtml(row.couponStatus || "-")}</td>
          <td class="num">${escapeHtml(formatMoney(row.grossInvoice ?? row.grossSales ?? 0))}</td>
          <td class="num">${escapeHtml(formatMoney(row.returnsValue ?? 0))}</td>
          <td class="num">${escapeHtml(formatMoney(row.netPurchase ?? row.netSales ?? 0))}</td>
          <td>${escapeHtml(formatDateTime(row.purchaseDateTime || row.lastOrderDate || row.orderDate))}</td>
          <td>
            <a
              href="${escapeHtml(invoiceUrl)}"
              target="_blank"
              rel="noopener"
              class="run-btn"
              style="display:inline-flex;text-decoration:none;"
            >
              عرض الفاتورة
            </a>
          </td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
          <input type="checkbox" id="selectAllCurrentPageRows" />
          تحديد الصفحة الحالية
        </label>

        <span class="inventory-muted-text" id="selectedRowsCount">المحدد: 0</span>

        <span class="inventory-muted-text">
          إجمالي النتائج: ${formatNumber(allInvoiceRows.length, 0)}
        </span>
      </div>

      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <button class="run-btn" id="prevInvoicePageBtn" ${currentPage <= 1 ? "disabled" : ""}>
          السابق
        </button>

        <select class="control" id="invoicePageSelect" style="min-width:150px;">
          ${buildPageOptions()}
        </select>

        <button class="run-btn" id="nextInvoicePageBtn" ${currentPage >= totalPages ? "disabled" : ""}>
          التالي
        </button>
      </div>
    </div>

    <div class="inventory-table-wrap">
      <table class="inventory-data-table">
        <thead>
          <tr>
            <th>تحديد</th>
            <th>رقم العميل</th>
            <th>حالة العميل</th>
            <th>الرسالة</th>
            <th>التقييم</th>
            <th>المتابعة</th>
            <th>المسؤول</th>
            <th>الكوبون</th>
            <th>إجمالي الفاتورة</th>
            <th>المرتجع</th>
            <th>صافي الشراء</th>
            <th>تاريخ الشراء بالوقت</th>
            <th>الفاتورة</th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>

    <p class="inventory-muted-text">
      يتم عرض ${formatNumber(startIndex + 1, 0)} إلى ${formatNumber(endIndex, 0)}
      من أصل ${formatNumber(allInvoiceRows.length, 0)} نتيجة.
    </p>
  `;

  bindInvoiceSelectionEvents();
  bindPaginationEvents();
  syncSelectAllCurrentPageState();
  updateSelectedRowsCount();
}

function getTotalPages() {
  return Math.max(1, Math.ceil(allInvoiceRows.length / ROWS_PER_PAGE));
}

function buildPageOptions() {
  const totalPages = getTotalPages();
  const options = [];

  for (let page = 1; page <= totalPages; page += 1) {
    const start = (page - 1) * ROWS_PER_PAGE + 1;
    const end = Math.min(page * ROWS_PER_PAGE, allInvoiceRows.length);

    options.push(`
      <option value="${page}" ${page === currentPage ? "selected" : ""}>
        ${formatNumber(start, 0)} - ${formatNumber(end, 0)}
      </option>
    `);
  }

  return options.join("");
}

function bindPaginationEvents() {
  const pageSelect = document.getElementById("invoicePageSelect");
  const prevBtn = document.getElementById("prevInvoicePageBtn");
  const nextBtn = document.getElementById("nextInvoicePageBtn");

  if (pageSelect) {
    pageSelect.addEventListener("change", () => {
      currentPage = Number(pageSelect.value || 1);
      renderInvoiceRows();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentPage <= 1) return;
      currentPage -= 1;
      renderInvoiceRows();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (currentPage >= getTotalPages()) return;
      currentPage += 1;
      renderInvoiceRows();
    });
  }
}

function buildRowKey(row, index) {
  return [
    row.orderId || row.posOrderId || "",
    row.invoiceRef || row.orderName || "",
    row.phone || "",
    index
  ].join("__");
}

function bindInvoiceSelectionEvents() {
  const selectAllCurrentPage = document.getElementById("selectAllCurrentPageRows");

  document.querySelectorAll(".invoice-export-check").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const key = checkbox.dataset.rowKey;
      const row = selectedInvoiceRows.get(key);

      if (row) {
        row.__selected = checkbox.checked;
        selectedInvoiceRows.set(key, row);
      }

      syncSelectAllCurrentPageState();
      updateSelectedRowsCount();
    });
  });

  if (selectAllCurrentPage) {
    selectAllCurrentPage.addEventListener("change", () => {
      document.querySelectorAll(".invoice-export-check").forEach((checkbox) => {
        checkbox.checked = selectAllCurrentPage.checked;

        const key = checkbox.dataset.rowKey;
        const row = selectedInvoiceRows.get(key);

        if (row) {
          row.__selected = selectAllCurrentPage.checked;
          selectedInvoiceRows.set(key, row);
        }
      });

      updateSelectedRowsCount();
    });
  }
}

function syncSelectAllCurrentPageState() {
  const selectAll = document.getElementById("selectAllCurrentPageRows");
  if (!selectAll) return;

  const checkboxes = Array.from(
    document.querySelectorAll(".invoice-export-check")
  );

  if (!checkboxes.length) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
    return;
  }

  const checkedCount = checkboxes.filter((checkbox) => checkbox.checked).length;

  selectAll.checked = checkedCount === checkboxes.length;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

function updateSelectedRowsCount() {
  const count = Array.from(selectedInvoiceRows.values())
    .filter((row) => row.__selected)
    .length;

  const box = document.getElementById("selectedRowsCount");
  if (box) {
    box.textContent = `المحدد: ${formatNumber(count, 0)}`;
  }
}

function renderCustomerState(state) {
  const labels = {
    not_sent: "لم تُرسل",
    pending_review: "في انتظار التقييم",
    positive: "إيجابي",
    neutral: "محايد",
    angry: "غاضب",
    send_failed: "فشل الإرسال"
  };
  const safeState = String(state || "not_sent").replace(/[^a-z_]/g, "");
  return `<span class="mi-status-badge customer-state-${safeState}">${escapeHtml(labels[safeState] || safeState)}</span>`;
}

async function exportDailyTrackingExcel() {
  const button = document.getElementById("exportDailyTrackingBtn");
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "جاري تجهيز Excel...";
    }
    const params = new URLSearchParams(getFilters());
    const token = typeof getToken === "function" ? getToken() : "";
    const response = await fetch(
      `${window.API_BASE_URL}/customer/review-tracking/export/excel?${params.toString()}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text.slice(0, 220) || "فشل تجهيز ملف Excel");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-customer-followup-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    showError(error.message || "تعذر تصدير التقرير اليومي");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "تصدير التقرير اليومي Excel";
    }
  }
}

function exportSelectedInvoicesToExcel() {
  const selectedRows = Array.from(selectedInvoiceRows.values())
    .filter((row) => row.__selected);

  if (!selectedRows.length) {
    alert("اختار فواتير أولًا من المربع بجانب رقم العميل.");
    return;
  }

  const rows = selectedRows.map((row) => ({
    "رقم العميل": row.phone || "",
    "مصدر الرقم": row.phoneSource || row.phoneSources || "",
    "إجمالي الفاتورة": row.grossInvoice ?? row.grossSales ?? 0,
    "المرتجع": row.returnsValue ?? 0,
    "صافي الشراء": row.netPurchase ?? row.netSales ?? 0,
    "تاريخ الشراء بالوقت": formatDateTime(row.purchaseDateTime || row.lastOrderDate || row.orderDate),
    "رقم الفاتورة": row.invoiceRef || row.orderName || "",
    "اسم العميل": row.customerName || "",
    "الفرع": row.branchName || row.branchCode || "",
    "نقطة البيع": row.posConfigName || ""
  }));

  const html = buildExcelHtml(rows);
  const blob = new Blob(["\ufeff", html], {
    type: "application/vnd.ms-excel;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const today = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `selected-pos-customer-phones-${today}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function buildExcelHtml(rows) {
  const headers = Object.keys(rows[0] || {});

  const thead = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");

  const tbody = rows
    .map((row) => `
      <tr>
        ${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}
      </tr>
    `)
    .join("");

  return `
    <html dir="rtl">
      <head>
        <meta charset="UTF-8" />
      </head>
      <body>
        <table border="1">
          <thead>
            <tr>${thead}</tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>
      </body>
    </html>
  `;
}

function buildInvoiceUrl(row) {
  const params = new URLSearchParams();

  const companyId =
    getSelectedCompanyId() ||
    row.companyId ||
    "";

  const dateFrom = document.getElementById("dateFrom")?.value || "";
  const dateTo = document.getElementById("dateTo")?.value || "";

  if (companyId) params.set("companyId", companyId);
  if (row.invoiceRef) params.set("invoiceRef", row.invoiceRef);
  if (row.phone) params.set("customerPhone", row.phone);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  return `./service-pos-review.html?${params.toString()}`;
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
        ${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function formatNumber(value, digits = 2) {
  const number = Number(value || 0);

  const safeDigits =
    Number.isInteger(digits) && digits >= 0 && digits <= 20
      ? digits
      : 2;

  return number.toLocaleString("en-US", {
    minimumFractionDigits: safeDigits,
    maximumFractionDigits: safeDigits
  });
}

function formatMoney(value) {
  return `${formatNumber(value, 2)} ج`;
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
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
