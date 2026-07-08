document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "تقرير مبيعات الفروع",
    "مبيعات مجمعة لكل فرع بناءً على نقاط البيع المرتبطة به.",
    "branches-sales",
    buildBranchSalesContent()
  );

  bindBranchSalesEvents();
  renderInitialState();
});

function buildBranchSalesContent() {
  return `
    <div class="report-ui-page">
      <section class="report-card">
        <div class="report-card-head">
          <h2>فلاتر التقرير</h2>
          <p>
            اختار الشركة من الهيدر العام، ثم اختار نطاق الفروع من هنا.
            التقرير لا يتم تحميله إلا عند الضغط على تحديث التقرير.
          </p>
        </div>

        <div class="report-filter-grid">
          <label class="report-field">
            الفرع / النطاق
            <select id="branchFilter" class="report-select">
              <option value="">اختر الفرع / النطاق</option>
            </select>
          </label>

          <label class="report-field">
            طريقة العرض
            <select id="viewMode" class="report-select">
              <option value="summary">مختصر</option>
              <option value="detailed">تفصيلي</option>
            </select>
          </label>

          <button id="loadBranchSalesBtn" type="button" class="report-btn-primary">
            تحديث التقرير
          </button>
        </div>
      </section>

      <section id="branchSalesLoadingBox" class="hidden"></section>
      <section id="branchSalesErrorBox" class="hidden"></section>

      <section id="branchSalesPendingBox" class="report-card">
        <div class="report-card-head">
          <h2>التقرير لم يتم تحميله بعد</h2>
          <p>
            اختار الشركة من الهيدر، ثم اختار الفرع / النطاق، وبعدها اضغط
            <strong>تحديث التقرير</strong>.
          </p>
        </div>
      </section>

      <section id="branchSalesKpis" class="report-kpi-grid"></section>

      <section class="report-card branch-sales-report-section">
        <div class="report-card-head">
          <h2>جدول مبيعات الفروع</h2>
          <p>الأرقام مبنية على POS_CONFIG المرتبط بكل فرع.</p>
        </div>

        <div id="branchSalesTableBox"></div>
      </section>

      <section class="report-grid-2 branch-sales-report-section">
        <div class="report-card">
          <div class="report-card-head">
            <h2>تحليل إداري</h2>
          </div>
          <div id="branchSalesRecommendationsBox" class="report-analysis"></div>
        </div>

        <div class="report-card">
          <div class="report-card-head">
            <h2>ملاحظات الاحتساب</h2>
          </div>
          <div id="branchSalesNotesBox" class="report-analysis"></div>
        </div>
      </section>
    </div>
  `;
}

function bindBranchSalesEvents() {
  const globalLoadBtn = document.getElementById("loadBtn");
  const pageLoadBtn = document.getElementById("loadBranchSalesBtn");
  const companySelect = document.getElementById("companySelect");
  const branchFilter = document.getElementById("branchFilter");
  const viewMode = document.getElementById("viewMode");

  if (globalLoadBtn) {
    globalLoadBtn.addEventListener("click", loadBranchSalesReport);
  }

  if (pageLoadBtn) {
    pageLoadBtn.addEventListener("click", loadBranchSalesReport);
  }

  if (companySelect) {
    companySelect.addEventListener("change", async () => {
      await loadBranchOptions();
      renderFilterChangedState();
    });
  }

  if (branchFilter) {
    branchFilter.addEventListener("change", renderFilterChangedState);
  }

  if (viewMode) {
    viewMode.addEventListener("change", renderFilterChangedState);
  }

  ["datePreset", "dateFrom", "dateTo"].forEach((id) => {
    const element = document.getElementById(id);

    if (!element) return;

    element.addEventListener("change", renderFilterChangedState);
  });

  window.loadBranchSalesReport = loadBranchSalesReport;
  window.loadBranchSalesOptions = loadBranchOptions;
}

function renderInitialState() {
  hideBranchSalesLoadingBox();
  clearBranchSalesError();
  clearBranchSalesReport();
  hideBranchSalesReportSections();

  const branchSelect = document.getElementById("branchFilter");

  if (branchSelect) {
    branchSelect.innerHTML = `<option value="">اختر الشركة أولًا</option>`;
    branchSelect.value = "";
  }

  showBranchSalesPendingMessage(
    "التقرير لم يتم تحميله بعد",
    "اختار الشركة من الهيدر، ثم اختار الفرع / النطاق، وبعدها اضغط تحديث التقرير."
  );
}

function renderFilterChangedState() {
  hideBranchSalesLoadingBox();
  clearBranchSalesError();
  clearBranchSalesReport();
  hideBranchSalesReportSections();

  showBranchSalesPendingMessage(
    "تم تغيير الفلاتر",
    "اضغط تحديث التقرير لتطبيق الشركة والفرع والفترة وطريقة العرض الجديدة."
  );
}

function showBranchSalesPendingMessage(title, message) {
  const pendingBox = document.getElementById("branchSalesPendingBox");
  if (!pendingBox) return;

  pendingBox.classList.remove("hidden");
  pendingBox.innerHTML = `
    <div class="report-card-head">
      <h2>${ReportUI.escapeHtml(title)}</h2>
      <p>${ReportUI.escapeHtml(message)}</p>
    </div>
  `;
}

function hideBranchSalesPendingBox() {
  document.getElementById("branchSalesPendingBox")?.classList.add("hidden");
}

function hideBranchSalesLoadingBox() {
  ReportUI.hideLoading("branchSalesLoadingBox");
}

function clearBranchSalesError() {
  ReportUI.clearError("branchSalesErrorBox");
}

function hideBranchSalesReportSections() {
  document.querySelectorAll(".branch-sales-report-section").forEach((section) => {
    section.classList.add("hidden");
  });
}

function showBranchSalesReportSections() {
  document.querySelectorAll(".branch-sales-report-section").forEach((section) => {
    section.classList.remove("hidden");
  });
}

function clearBranchSalesReport() {
  [
    "branchSalesKpis",
    "branchSalesTableBox",
    "branchSalesRecommendationsBox",
    "branchSalesNotesBox"
  ].forEach((id) => {
    const element = document.getElementById(id);

    if (element) {
      element.innerHTML = "";
    }
  });
}

function getSelectedCompanyId() {
  return document.getElementById("companySelect")?.value || "";
}

function getSelectedBranchId() {
  return document.getElementById("branchFilter")?.value || "";
}

function validateBranchSalesContext() {
  const companyId = getSelectedCompanyId();
  const branchId = getSelectedBranchId();

  if (!companyId) {
    return {
      ok: false,
      message: "لازم تختار الشركة قبل تحميل تقرير مبيعات الفروع."
    };
  }

  if (!branchId) {
    return {
      ok: false,
      message: "لازم تختار الفرع أو كل الفروع قبل تحميل التقرير."
    };
  }

  return {
    ok: true
  };
}

function getBranchSalesFilters() {
  return {
    companyId: getSelectedCompanyId(),
    dateFrom: document.getElementById("dateFrom")?.value || "",
    dateTo: document.getElementById("dateTo")?.value || "",
    branchId: getSelectedBranchId(),
    viewMode: document.getElementById("viewMode")?.value || "summary"
  };
}

async function loadBranchOptions() {
  const select = document.getElementById("branchFilter");
  if (!select) return;

  const currentValue = select.value || "";
  const companyId = getSelectedCompanyId();

  if (!companyId) {
    select.innerHTML = `<option value="">اختر الشركة أولًا</option>`;
    select.value = "";
    return;
  }

  try {
    const response = await apiGet("/branches/overview", { companyId });
    const branches = response.data?.branches || [];

    select.innerHTML = `
      <option value="">اختر الفرع / النطاق</option>
      <option value="all">كل الفروع</option>
      ${branches.map((branch) => `
        <option value="${branch.branchId}">
          ${ReportUI.escapeHtml(branch.branchNameAr || branch.branchName)}
        </option>
      `).join("")}
    `;

    const stillExists = Array.from(select.options).some(
      (option) => option.value === currentValue
    );

    select.value = stillExists ? currentValue : "";
  } catch (error) {
    console.error(error);

    select.innerHTML = `<option value="">تعذر تحميل الفروع</option>`;
    select.value = "";
  }
}

async function loadBranchSalesReport() {
  const validation = validateBranchSalesContext();

  if (!validation.ok) {
    ReportUI.showError("branchSalesErrorBox", validation.message);
    return;
  }

  try {
    ReportUI.showLoading(
      "branchSalesLoadingBox",
      "جاري تحميل تقرير مبيعات الفروع..."
    );

    clearBranchSalesError();

    const filters = getBranchSalesFilters();

    const params = {
      companyId: filters.companyId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo
    };

    if (filters.branchId && filters.branchId !== "all") {
      params.branchId = filters.branchId;
    }

    const response = await apiGet("/branches/sales", params);

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل تقرير مبيعات الفروع");
    }

    hideBranchSalesPendingBox();
    showBranchSalesReportSections();
    renderBranchSalesReport(response.data || {});
  } catch (error) {
    console.error(error);
    ReportUI.showError("branchSalesErrorBox", error);
  } finally {
    ReportUI.hideLoading("branchSalesLoadingBox");
  }
}

function renderBranchSalesReport(data) {
  renderBranchSalesKpis(data.summary || {});
  renderBranchSalesTable(data.rows || []);

  ReportUI.renderRecommendations(
    "branchSalesRecommendationsBox",
    data.recommendations || []
  );

  ReportUI.renderNotes("branchSalesNotesBox", data.notes || []);
}

function renderBranchSalesKpis(summary) {
  ReportUI.renderKpis("branchSalesKpis", [
    {
      title: "صافي المبيعات",
      value: ReportUI.money(summary.netSales),
      hint: "بعد المرتجعات"
    },
    {
      title: "إجمالي البيع",
      value: ReportUI.money(summary.totalSales),
      hint: "أوامر البيع الموجبة"
    },
    {
      title: "المرتجعات",
      value: ReportUI.money(summary.returnsAmount),
      hint: "أوامر POS السالبة"
    },
    {
      title: "عدد الفواتير",
      value: ReportUI.number(summary.totalOrdersCount),
      hint: "كل أوامر POS"
    },
    {
      title: "متوسط الفاتورة",
      value: ReportUI.money(summary.averageTicket),
      hint: "إجمالي البيع / الفواتير"
    },
    {
      title: "أفضل فرع",
      value: summary.bestBranchName || "-",
      hint: ReportUI.money(summary.bestBranchNetSales)
    }
  ]);
}

function renderBranchSalesTable(rows) {
  const filters = getBranchSalesFilters();

  if (filters.viewMode === "detailed") {
    renderDetailedTable(rows);
    return;
  }

  renderSummaryTable(rows);
}

function renderSummaryTable(rows) {
  ReportUI.renderTable("branchSalesTableBox", {
    rows,
    minWidth: 980,
    emptyMessage: "لا توجد بيانات مبيعات للفروع في الفترة المختارة.",
    columns: [
      {
        key: "displayName",
        label: "الفرع",
        width: "150px",
        className: "report-cell-strong",
        format: (value) => ReportUI.escapeHtml(value || "-")
      },
      {
        key: "posSources",
        label: "POS المرتبط",
        width: "160px",
        format: renderPosSources
      },
      {
        key: "totalSales",
        label: "إجمالي البيع",
        width: "115px",
        className: "report-money",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "returnsAmount",
        label: "المرتجعات",
        width: "115px",
        className: "report-money",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "netSales",
        label: "صافي المبيعات",
        width: "125px",
        className: "report-money-strong",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "metrics",
        label: "مؤشرات",
        width: "150px",
        format: (_, row) => ReportUI.stack([
          {
            label: "فواتير",
            value: ReportUI.number(row.totalOrdersCount)
          },
          {
            label: "متوسط",
            value: ReportUI.money(row.averageTicket)
          },
          {
            label: "مرتجع",
            value: ReportUI.percent(row.returnRate)
          },
          {
            label: "خصم",
            value: ReportUI.percent(row.discountRate)
          }
        ])
      },
      {
        key: "topProductName",
        label: "أفضل صنف",
        width: "150px",
        format: (_, row) => ReportUI.stack([
          {
            label: "الصنف",
            value: row.topProductName || "-"
          },
          {
            label: "قيمة",
            value: row.topProductSales
              ? ReportUI.money(row.topProductSales)
              : "-"
          }
        ])
      },
      {
        key: "status",
        label: "الحالة",
        width: "115px",
        format: (_, row) => renderMappingStatus(row)
      }
    ]
  });
}

function renderDetailedTable(rows) {
  ReportUI.renderTable("branchSalesTableBox", {
    rows,
    minWidth: 1320,
    emptyMessage: "لا توجد بيانات مبيعات للفروع في الفترة المختارة.",
    columns: [
      {
        key: "displayName",
        label: "الفرع",
        width: "150px",
        className: "report-cell-strong",
        format: (value) => ReportUI.escapeHtml(value || "-")
      },
      {
        key: "posSources",
        label: "POS",
        width: "160px",
        format: renderPosSources
      },
      {
        key: "totalSales",
        label: "إجمالي البيع",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "returnsAmount",
        label: "المرتجعات",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "discountsAmount",
        label: "الخصومات",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "netSales",
        label: "صافي المبيعات",
        className: "report-money-strong",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "totalOrdersCount",
        label: "كل الفواتير",
        format: (value) => ReportUI.number(value)
      },
      {
        key: "positiveOrdersCount",
        label: "فواتير بيع",
        format: (value) => ReportUI.number(value)
      },
      {
        key: "refundOrdersCount",
        label: "فواتير مرتجع",
        format: (value) => ReportUI.number(value)
      },
      {
        key: "averageTicket",
        label: "متوسط الفاتورة",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "returnRate",
        label: "معدل المرتجع",
        format: (value) => ReportUI.percent(value)
      },
      {
        key: "discountRate",
        label: "معدل الخصم",
        format: (value) => ReportUI.percent(value)
      },
      {
        key: "topProductName",
        label: "أفضل صنف",
        format: (value) => ReportUI.escapeHtml(value || "-")
      },
      {
        key: "status",
        label: "الحالة",
        format: (_, row) => renderMappingStatus(row)
      }
    ]
  });
}

function renderPosSources(sources = []) {
  if (!sources.length) {
    return ReportUI.statusPill("غير مربوط", "bad");
  }

  const items = sources.map((source) => {
    return `${source.sourceName || "POS"} #${source.sourceOdooId}`;
  });

  return ReportUI.pillList(items, "good");
}

function renderMappingStatus(row) {
  if (!row.hasPosMapping) {
    return ReportUI.statusPill("ناقص ربط", "bad");
  }

  if (row.totalOrdersCount <= 0) {
    return ReportUI.statusPill("بدون مبيعات", "warn");
  }

  return ReportUI.statusPill("جاهز", "good");
}