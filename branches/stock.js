document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "تقرير مخزون الفروع",
    "مخزون حالي مجمع لكل فرع بناءً على مواقع المخزون المرتبطة به.",
    "branches-stock",
    buildBranchStockContent()
  );

  bindBranchStockEvents();
  renderInitialState();
});

function buildBranchStockContent() {
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

          <button id="loadBranchStockBtn" type="button" class="report-btn-primary">
            تحديث التقرير
          </button>
        </div>
      </section>

      <section id="branchStockLoadingBox" class="hidden"></section>
      <section id="branchStockErrorBox" class="hidden"></section>

      <section id="branchStockPendingBox" class="report-card">
        <div class="report-card-head">
          <h2>التقرير لم يتم تحميله بعد</h2>
          <p>
            اختار الشركة من الهيدر، ثم اختار الفرع / النطاق، وبعدها اضغط
            <strong>تحديث التقرير</strong>.
          </p>
        </div>
      </section>

      <section id="branchStockKpis" class="report-kpi-grid"></section>

      <section class="report-card branch-stock-report-section">
        <div class="report-card-head">
          <h2>جدول مخزون الفروع</h2>
          <p>الأرقام مبنية على STOCK_LOCATION / WAREHOUSE المرتبط بكل فرع.</p>
        </div>

        <div id="branchStockTableBox"></div>
      </section>

      <section class="report-grid-2 branch-stock-report-section">
        <div class="report-card">
          <div class="report-card-head">
            <h2>تحليل إداري</h2>
          </div>
          <div id="branchStockRecommendationsBox" class="report-analysis"></div>
        </div>

        <div class="report-card">
          <div class="report-card-head">
            <h2>ملاحظات الاحتساب</h2>
          </div>
          <div id="branchStockNotesBox" class="report-analysis"></div>
        </div>
      </section>
    </div>
  `;
}

function bindBranchStockEvents() {
  const globalLoadBtn = document.getElementById("loadBtn");
  const pageLoadBtn = document.getElementById("loadBranchStockBtn");
  const companySelect = document.getElementById("companySelect");
  const branchFilter = document.getElementById("branchFilter");
  const viewMode = document.getElementById("viewMode");

  if (globalLoadBtn) {
    globalLoadBtn.addEventListener("click", loadBranchStockReport);
  }

  if (pageLoadBtn) {
    pageLoadBtn.addEventListener("click", loadBranchStockReport);
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

  window.loadBranchStockReport = loadBranchStockReport;
  window.loadBranchStockOptions = loadBranchOptions;
}

function renderInitialState() {
  hideBranchStockLoadingBox();
  clearBranchStockError();
  clearBranchStockReport();
  hideBranchStockReportSections();

  const branchSelect = document.getElementById("branchFilter");

  if (branchSelect) {
    branchSelect.innerHTML = `<option value="">اختر الشركة أولًا</option>`;
    branchSelect.value = "";
  }

  showBranchStockPendingMessage(
    "التقرير لم يتم تحميله بعد",
    "اختار الشركة من الهيدر، ثم اختار الفرع / النطاق، وبعدها اضغط تحديث التقرير."
  );
}

function renderFilterChangedState() {
  hideBranchStockLoadingBox();
  clearBranchStockError();
  clearBranchStockReport();
  hideBranchStockReportSections();

  showBranchStockPendingMessage(
    "تم تغيير الفلاتر",
    "اضغط تحديث التقرير لتطبيق الشركة والفرع وطريقة العرض الجديدة."
  );
}

function showBranchStockPendingMessage(title, message) {
  const pendingBox = document.getElementById("branchStockPendingBox");
  if (!pendingBox) return;

  pendingBox.classList.remove("hidden");
  pendingBox.innerHTML = `
    <div class="report-card-head">
      <h2>${ReportUI.escapeHtml(title)}</h2>
      <p>${ReportUI.escapeHtml(message)}</p>
    </div>
  `;
}

function hideBranchStockPendingBox() {
  document.getElementById("branchStockPendingBox")?.classList.add("hidden");
}

function hideBranchStockLoadingBox() {
  ReportUI.hideLoading("branchStockLoadingBox");
}

function clearBranchStockError() {
  ReportUI.clearError("branchStockErrorBox");
}

function hideBranchStockReportSections() {
  document.querySelectorAll(".branch-stock-report-section").forEach((section) => {
    section.classList.add("hidden");
  });
}

function showBranchStockReportSections() {
  document.querySelectorAll(".branch-stock-report-section").forEach((section) => {
    section.classList.remove("hidden");
  });
}

function clearBranchStockReport() {
  [
    "branchStockKpis",
    "branchStockTableBox",
    "branchStockRecommendationsBox",
    "branchStockNotesBox"
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

function validateBranchStockContext() {
  const companyId = getSelectedCompanyId();
  const branchId = getSelectedBranchId();

  if (!companyId) {
    return {
      ok: false,
      message: "لازم تختار الشركة قبل تحميل تقرير مخزون الفروع."
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

function getBranchStockFilters() {
  return {
    companyId: getSelectedCompanyId(),
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

async function loadBranchStockReport() {
  const validation = validateBranchStockContext();

  if (!validation.ok) {
    ReportUI.showError("branchStockErrorBox", validation.message);
    return;
  }

  try {
    ReportUI.showLoading(
      "branchStockLoadingBox",
      "جاري تحميل تقرير مخزون الفروع..."
    );

    clearBranchStockError();

    const filters = getBranchStockFilters();

    const params = {
      companyId: filters.companyId
    };

    if (filters.branchId && filters.branchId !== "all") {
      params.branchId = filters.branchId;
    }

    const response = await apiGet("/branches/stock", params);

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل تقرير مخزون الفروع");
    }

    hideBranchStockPendingBox();
    showBranchStockReportSections();
    renderBranchStockReport(response.data || {});
  } catch (error) {
    console.error(error);
    ReportUI.showError("branchStockErrorBox", error);
  } finally {
    ReportUI.hideLoading("branchStockLoadingBox");
  }
}

function renderBranchStockReport(data) {
  renderBranchStockKpis(data.summary || {});
  renderBranchStockTable(data.rows || []);

  ReportUI.renderRecommendations(
    "branchStockRecommendationsBox",
    data.recommendations || []
  );

  ReportUI.renderNotes("branchStockNotesBox", data.notes || []);
}

function renderBranchStockKpis(summary) {
  ReportUI.renderKpis("branchStockKpis", [
    {
      title: "قيمة المخزون",
      value: ReportUI.money(summary.stockValue),
      hint: "إجمالي قيمة المخزون الحالي"
    },
    {
      title: "الكمية المتاحة",
      value: ReportUI.number(summary.availableQuantity, 2),
      hint: "الكمية - المحجوز"
    },
    {
      title: "الكمية المحجوزة",
      value: ReportUI.number(summary.reservedQuantity, 2),
      hint: "Reserved Quantity"
    },
    {
      title: "عدد الأصناف",
      value: ReportUI.number(summary.productsCount),
      hint: "مجموع الأصناف عبر الفروع"
    },
    {
      title: "مخزون سالب",
      value: ReportUI.number(summary.negativeProductsCount),
      hint: "أصناف متاحة بالسالب"
    },
    {
      title: "أعلى فرع مخزون",
      value: summary.highestStockBranchName || "-",
      hint: ReportUI.money(summary.highestStockBranchValue)
    }
  ]);
}

function renderBranchStockTable(rows) {
  const filters = getBranchStockFilters();

  if (filters.viewMode === "detailed") {
    renderDetailedTable(rows);
    return;
  }

  renderSummaryTable(rows);
}

function renderSummaryTable(rows) {
  ReportUI.renderTable("branchStockTableBox", {
    rows,
    minWidth: 980,
    emptyMessage: "لا توجد بيانات مخزون للفروع.",
    columns: [
      {
        key: "displayName",
        label: "الفرع",
        width: "150px",
        className: "report-cell-strong",
        format: (value) => ReportUI.escapeHtml(value || "-")
      },
      {
        key: "stockSources",
        label: "مصادر المخزون",
        width: "170px",
        format: renderStockSources
      },
      {
        key: "stockValue",
        label: "قيمة المخزون",
        width: "120px",
        className: "report-money-strong",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "availableQuantity",
        label: "المتاح",
        width: "110px",
        format: (value) => ReportUI.number(value, 2)
      },
      {
        key: "reservedQuantity",
        label: "المحجوز",
        width: "110px",
        format: (value) => ReportUI.number(value, 2)
      },
      {
        key: "metrics",
        label: "مؤشرات",
        width: "160px",
        format: (_, row) => ReportUI.stack([
          {
            label: "الأصناف",
            value: ReportUI.number(row.productsCount)
          },
          {
            label: "المواقع",
            value: ReportUI.number(row.locationsCount)
          },
          {
            label: "سالب",
            value: ReportUI.number(row.negativeProductsCount)
          },
          {
            label: "صفر متاح",
            value: ReportUI.number(row.zeroAvailableProductsCount)
          }
        ])
      },
      {
        key: "topProductName",
        label: "أعلى صنف قيمة",
        width: "160px",
        format: (_, row) => ReportUI.stack([
          {
            label: "الصنف",
            value: row.topProductName || "-"
          },
          {
            label: "قيمة",
            value: row.topProductValue
              ? ReportUI.money(row.topProductValue)
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
  ReportUI.renderTable("branchStockTableBox", {
    rows,
    minWidth: 1250,
    emptyMessage: "لا توجد بيانات مخزون للفروع.",
    columns: [
      {
        key: "displayName",
        label: "الفرع",
        className: "report-cell-strong",
        format: (value) => ReportUI.escapeHtml(value || "-")
      },
      {
        key: "stockSources",
        label: "مصادر المخزون",
        format: renderStockSources
      },
      {
        key: "stockValue",
        label: "قيمة المخزون",
        className: "report-money-strong",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "totalQuantity",
        label: "إجمالي الكمية",
        format: (value) => ReportUI.number(value, 2)
      },
      {
        key: "reservedQuantity",
        label: "المحجوز",
        format: (value) => ReportUI.number(value, 2)
      },
      {
        key: "availableQuantity",
        label: "المتاح",
        format: (value) => ReportUI.number(value, 2)
      },
      {
        key: "productsCount",
        label: "عدد الأصناف",
        format: (value) => ReportUI.number(value)
      },
      {
        key: "locationsCount",
        label: "عدد المواقع",
        format: (value) => ReportUI.number(value)
      },
      {
        key: "negativeProductsCount",
        label: "أصناف سالبة",
        format: (value) => ReportUI.number(value)
      },
      {
        key: "zeroAvailableProductsCount",
        label: "أصناف صفر متاح",
        format: (value) => ReportUI.number(value)
      },
      {
        key: "topProductName",
        label: "أعلى صنف قيمة",
        format: (value) => ReportUI.escapeHtml(value || "-")
      },
      {
        key: "topProductValue",
        label: "قيمة أعلى صنف",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "status",
        label: "الحالة",
        format: (_, row) => renderMappingStatus(row)
      }
    ]
  });
}

function renderStockSources(sources = []) {
  if (!sources.length) {
    return ReportUI.statusPill("غير مربوط", "bad");
  }

  const items = sources.map((source) => {
    return `${source.sourceName || source.sourceType} #${source.sourceOdooId}`;
  });

  return ReportUI.pillList(items, "info");
}

function renderMappingStatus(row) {
  if (!row.hasStockMapping) {
    return ReportUI.statusPill("ناقص ربط", "bad");
  }

  if (row.totalQuantity <= 0) {
    return ReportUI.statusPill("بدون مخزون", "warn");
  }

  if (row.negativeProductsCount > 0) {
    return ReportUI.statusPill("به سالب", "warn");
  }

  return ReportUI.statusPill("جاهز", "good");
}