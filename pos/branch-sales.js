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

    <section id="kpiGrid" class="inventory-kpi-grid"></section>

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
        أعلى 50 منتج حسب صافي المبيعات. تصدير Excel يحتوي على كل المنتجات المباعة خلال الفترة المحددة.
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
  if (document.getElementById("exportBranchSalesBtn")) return;

  const loadButton = document.getElementById("loadBtn") || document.getElementById("refreshBranchSalesBtn");
  const actionsContainer = loadButton?.parentElement || document.querySelector(".inventory-hero-actions");

  if (!actionsContainer) return;

  const exportButton = document.createElement("button");
  exportButton.id = "exportBranchSalesBtn";
  exportButton.type = "button";
  exportButton.className = "run-btn";
  exportButton.textContent = "تصدير Excel";

  if (loadButton?.nextSibling) {
    actionsContainer.insertBefore(exportButton, loadButton.nextSibling);
  } else {
    actionsContainer.appendChild(exportButton);
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
  [
    "kpiGrid",
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
    renderBranchSalesReport(response.data || {});
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

function renderBranchSalesReport(data) {
  const summary = data.summary || {};

  renderBranchSalesKpis(summary);
  renderBranches(data.branches || []);
  renderCashiers(data.cashiers || []);
  renderProducts(data.products || []);
  renderNotes(data.notes || []);
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

function renderProducts(rows) {
  const container = document.getElementById("productsTable");
  if (!container) return;

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