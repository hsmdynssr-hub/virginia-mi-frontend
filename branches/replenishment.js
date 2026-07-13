let currentReplenishmentReport = null;

document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "احتياجات الفروع وإعادة الطلب",
    "تقرير يحدد الأصناف المطلوب دعمها لكل فرع بناءً على المبيعات، الرصيد المتاح، وأيام التغطية المستهدفة.",
    "branches-replenishment",
    buildReplenishmentContent()
  );

  bindReplenishmentEvents();
  renderInitialState();
});

function buildReplenishmentContent() {
  return `
    <div class="report-ui-page mi-bootstrap-page">
      <section class="report-card">
        <div class="report-card-head">
          <h2>فلاتر التقرير</h2>
          <p>
            اختار الشركة من الهيدر، ثم الفرع / النطاق من هنا.
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
            أيام التغطية المطلوبة
            <input id="targetCoverDays" class="report-input" type="number" min="1" step="1" value="7" />
          </label>

          <label class="report-field">
            أيام الأمان
            <input id="safetyDays" class="report-input" type="number" min="0" step="1" value="2" />
          </label>
        </div>

        <div class="report-filter-grid" style="grid-template-columns: 1fr 1fr auto; margin-top: 12px;">
          <label class="report-field">
            عرض التقرير
            <select id="onlyNeeds" class="report-select">
              <option value="true">الأصناف المحتاجة فقط</option>
              <option value="false">كل الأصناف</option>
            </select>
          </label>

          <label class="report-field">
            بحث عن صنف
            <input id="productSearch" class="report-input" type="text" placeholder="اكتب اسم الصنف..." />
          </label>

          <button id="loadReplenishmentBtn" type="button" class="report-btn-primary">
            تحديث التقرير
          </button>
        </div>
      </section>

      <section id="replenishmentLoadingBox" class="hidden"></section>
      <section id="replenishmentErrorBox" class="hidden"></section>

      <section id="replenishmentPendingBox" class="report-card">
        <div class="report-card-head">
          <h2>التقرير لم يتم تحميله بعد</h2>
          <p>
            اختار الشركة من الهيدر، ثم الفرع / النطاق، وبعدها اضغط
            <strong>تحديث التقرير</strong>.
          </p>
        </div>
      </section>

      <section id="replenishmentKpis" class="report-kpi-grid"></section>

      <section class="report-card replenishment-report-section">
        <div class="report-card-head">
          <h2>جدول احتياجات الفروع</h2>
          <p>
            الكمية المقترحة = متوسط البيع اليومي × أيام التغطية المطلوبة - الرصيد المتاح.
          </p>
        </div>

        <div id="replenishmentTableBox"></div>
      </section>

      <section class="report-grid-2 replenishment-report-section">
        <div class="report-card">
          <div class="report-card-head">
            <h2>تحليل إداري</h2>
          </div>
          <div id="replenishmentRecommendationsBox" class="report-analysis"></div>
        </div>

        <div class="report-card">
          <div class="report-card-head">
            <h2>ملاحظات الاحتساب</h2>
          </div>
          <div id="replenishmentNotesBox" class="report-analysis"></div>
        </div>
      </section>
    </div>
  `;
}

function bindReplenishmentEvents() {
  const globalLoadBtn = document.getElementById("loadBtn");
  const pageLoadBtn = document.getElementById("loadReplenishmentBtn");
  const companySelect = document.getElementById("companySelect");
  const branchFilter = document.getElementById("branchFilter");
  const targetCoverDays = document.getElementById("targetCoverDays");
  const safetyDays = document.getElementById("safetyDays");
  const onlyNeeds = document.getElementById("onlyNeeds");
  const productSearch = document.getElementById("productSearch");

  if (globalLoadBtn) {
    globalLoadBtn.addEventListener("click", loadReplenishmentReport);
  }

  if (pageLoadBtn) {
    pageLoadBtn.addEventListener("click", loadReplenishmentReport);
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

  if (targetCoverDays) {
    targetCoverDays.addEventListener("change", renderFilterChangedState);
  }

  if (safetyDays) {
    safetyDays.addEventListener("change", renderFilterChangedState);
  }

  if (onlyNeeds) {
    onlyNeeds.addEventListener("change", renderFilterChangedState);
  }

  ["datePreset", "dateFrom", "dateTo"].forEach((id) => {
    const element = document.getElementById(id);

    if (!element) return;

    element.addEventListener("change", renderFilterChangedState);
  });

  if (productSearch) {
    productSearch.addEventListener("input", () => {
      if (!currentReplenishmentReport) return;
      renderReplenishmentTable();
    });
  }

  window.loadReplenishmentReport = loadReplenishmentReport;
  window.loadReplenishmentBranchOptions = loadBranchOptions;
}

function renderInitialState() {
  currentReplenishmentReport = null;

  hideReplenishmentLoadingBox();
  clearReplenishmentError();
  clearReplenishmentReport();
  hideReplenishmentReportSections();

  const branchSelect = document.getElementById("branchFilter");

  if (branchSelect) {
    branchSelect.innerHTML = `<option value="">اختر الشركة أولًا</option>`;
    branchSelect.value = "";
  }

  showReplenishmentPendingMessage(
    "التقرير لم يتم تحميله بعد",
    "اختار الشركة من الهيدر، ثم الفرع / النطاق، وبعدها اضغط تحديث التقرير."
  );
}

function renderFilterChangedState() {
  currentReplenishmentReport = null;

  hideReplenishmentLoadingBox();
  clearReplenishmentError();
  clearReplenishmentReport();
  hideReplenishmentReportSections();

  showReplenishmentPendingMessage(
    "تم تغيير الفلاتر",
    "اضغط تحديث التقرير لتطبيق الشركة والفرع والفترة وأيام التغطية الجديدة."
  );
}

function showReplenishmentPendingMessage(title, message) {
  const pendingBox = document.getElementById("replenishmentPendingBox");
  if (!pendingBox) return;

  pendingBox.classList.remove("hidden");
  pendingBox.innerHTML = `
    <div class="report-card-head">
      <h2>${ReportUI.escapeHtml(title)}</h2>
      <p>${ReportUI.escapeHtml(message)}</p>
    </div>
  `;
}

function hideReplenishmentPendingBox() {
  document.getElementById("replenishmentPendingBox")?.classList.add("hidden");
}

function hideReplenishmentLoadingBox() {
  ReportUI.hideLoading("replenishmentLoadingBox");
}

function clearReplenishmentError() {
  ReportUI.clearError("replenishmentErrorBox");
}

function hideReplenishmentReportSections() {
  document.querySelectorAll(".replenishment-report-section").forEach((section) => {
    section.classList.add("hidden");
  });
}

function showReplenishmentReportSections() {
  document.querySelectorAll(".replenishment-report-section").forEach((section) => {
    section.classList.remove("hidden");
  });
}

function clearReplenishmentReport() {
  [
    "replenishmentKpis",
    "replenishmentTableBox",
    "replenishmentRecommendationsBox",
    "replenishmentNotesBox"
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

function validateReplenishmentContext() {
  const companyId = getSelectedCompanyId();
  const branchId = getSelectedBranchId();

  if (!companyId) {
    return {
      ok: false,
      message: "لازم تختار الشركة قبل تحميل تقرير احتياجات الفروع."
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

function getFilters() {
  return {
    companyId: getSelectedCompanyId(),
    dateFrom: document.getElementById("dateFrom")?.value || "",
    dateTo: document.getElementById("dateTo")?.value || "",
    branchId: getSelectedBranchId(),
    targetCoverDays: document.getElementById("targetCoverDays")?.value || "7",
    safetyDays: document.getElementById("safetyDays")?.value || "2",
    onlyNeeds: document.getElementById("onlyNeeds")?.value || "true"
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

async function loadReplenishmentReport() {
  const validation = validateReplenishmentContext();

  if (!validation.ok) {
    ReportUI.showError("replenishmentErrorBox", validation.message);
    return;
  }

  try {
    ReportUI.showLoading(
      "replenishmentLoadingBox",
      "جاري تحميل تقرير احتياجات الفروع..."
    );

    clearReplenishmentError();

    const filters = getFilters();

    const params = {
      companyId: filters.companyId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      targetCoverDays: filters.targetCoverDays,
      safetyDays: filters.safetyDays,
      onlyNeeds: filters.onlyNeeds
    };

    if (filters.branchId && filters.branchId !== "all") {
      params.branchId = filters.branchId;
    }

    const response = await apiGet("/branches/replenishment", params);

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل تقرير احتياجات الفروع");
    }

    currentReplenishmentReport = response.data || {};

    hideReplenishmentPendingBox();
    showReplenishmentReportSections();
    renderReplenishmentReport(currentReplenishmentReport);
  } catch (error) {
    console.error(error);
    ReportUI.showError("replenishmentErrorBox", error);
  } finally {
    ReportUI.hideLoading("replenishmentLoadingBox");
  }
}

function renderReplenishmentReport(data) {
  renderReplenishmentKpis(data.summary || {}, data.filters || {});
  renderReplenishmentTable();

  ReportUI.renderRecommendations(
    "replenishmentRecommendationsBox",
    data.recommendations || []
  );

  ReportUI.renderNotes("replenishmentNotesBox", data.notes || []);
}

function renderReplenishmentKpis(summary, filters) {
  ReportUI.renderKpis("replenishmentKpis", [
    {
      title: "أصناف محتاجة",
      value: ReportUI.number(summary.productsWithNeedsCount),
      hint: "تحتاج دعم أو إعادة طلب"
    },
    {
      title: "حرج",
      value: ReportUI.number(summary.criticalProductsCount),
      hint: "رصيد صفر أو أقل مع مبيعات"
    },
    {
      title: "عاجل",
      value: ReportUI.number(summary.urgentProductsCount),
      hint: "تغطية أقل من أيام الأمان"
    },
    {
      title: "إجمالي الكمية المطلوبة",
      value: ReportUI.number(summary.totalReorderQty, 3),
      hint: "مجموع الكميات المقترحة"
    },
    {
      title: "قيمة تقديرية",
      value: ReportUI.money(summary.estimatedReorderValue),
      hint: "حسب تكلفة/متوسط قيمة متاحة"
    },
    {
      title: "أعلى فرع احتياج",
      value: summary.topNeedBranchName || "-",
      hint: `${ReportUI.money(summary.topNeedBranchValue)} / ${filters.periodDays || "-"} يوم`
    }
  ]);
}

function getFilteredRows() {
  const rows = Array.isArray(currentReplenishmentReport?.rows)
    ? currentReplenishmentReport.rows
    : [];

  const search =
    document.getElementById("productSearch")?.value?.trim().toLowerCase() || "";

  if (!search) {
    return rows;
  }

  return rows.filter((row) => {
    const productName = String(row.productName || "").toLowerCase();
    const branchName = String(row.displayName || "").toLowerCase();

    return (
      productName.includes(search) ||
      branchName.includes(search)
    );
  });
}

function renderReplenishmentTable() {
  const rows = getFilteredRows();

  ReportUI.renderTable("replenishmentTableBox", {
    rows,
    minWidth: 1380,
    emptyMessage: "لا توجد احتياجات إعادة طلب طبقًا للفلاتر الحالية.",
    columns: [
      {
        key: "displayName",
        label: "الفرع",
        width: "150px",
        className: "report-cell-strong",
        format: (value) => ReportUI.escapeHtml(value || "-")
      },
      {
        key: "productName",
        label: "الصنف",
        width: "240px",
        className: "report-cell-strong",
        format: (value) => ReportUI.escapeHtml(value || "-")
      },
      {
        key: "availableQuantity",
        label: "المتاح",
        width: "95px",
        format: (value) => ReportUI.number(value, 3)
      },
      {
        key: "reservedQuantity",
        label: "محجوز",
        width: "90px",
        format: (value) => ReportUI.number(value, 3)
      },
      {
        key: "soldQuantity",
        label: "بيع الفترة",
        width: "105px",
        format: (value) => ReportUI.number(value, 3)
      },
      {
        key: "avgDailySales",
        label: "متوسط يومي",
        width: "110px",
        format: (value) => ReportUI.number(value, 3)
      },
      {
        key: "daysCover",
        label: "أيام التغطية",
        width: "115px",
        format: (value, row) => renderDaysCover(value, row)
      },
      {
        key: "targetQuantity",
        label: "الهدف",
        width: "95px",
        format: (value) => ReportUI.number(value, 3)
      },
      {
        key: "reorderQty",
        label: "المطلوب",
        width: "105px",
        className: "report-money-strong",
        format: (value) => ReportUI.number(value, 3)
      },
      {
        key: "estimatedReorderValue",
        label: "قيمة تقديرية",
        width: "120px",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "priority",
        label: "الأولوية",
        width: "125px",
        format: (_, row) => renderPriority(row)
      },
      {
        key: "reason",
        label: "سبب الاحتياج",
        width: "175px",
        format: (_, row) => renderReason(row)
      }
    ]
  });
}

function renderDaysCover(value, row) {
  if (row.avgDailySales <= 0) {
    return ReportUI.statusPill("لا حركة", "info");
  }

  if (value === null || value === undefined) {
    return "-";
  }

  if (Number(value) <= Number(row.safetyDays || 0)) {
    return `
      <div class="report-stack">
        <div>${ReportUI.statusPill("منخفضة", "bad")}</div>
        <div><b>${ReportUI.number(value, 2)} يوم</b></div>
      </div>
    `;
  }

  if (Number(value) <= Number(row.targetCoverDays || 0)) {
    return `
      <div class="report-stack">
        <div>${ReportUI.statusPill("تحتاج دعم", "warn")}</div>
        <div><b>${ReportUI.number(value, 2)} يوم</b></div>
      </div>
    `;
  }

  return `${ReportUI.number(value, 2)} يوم`;
}

function renderPriority(row) {
  if (row.priority === "critical") {
    return ReportUI.statusPill(row.priorityLabel, "bad");
  }

  if (row.priority === "urgent" || row.priority === "reorder") {
    return ReportUI.statusPill(row.priorityLabel, "warn");
  }

  if (row.priority === "ok") {
    return ReportUI.statusPill(row.priorityLabel, "good");
  }

  if (row.priority === "overstock") {
    return ReportUI.statusPill(row.priorityLabel, "info");
  }

  return ReportUI.statusPill(row.priorityLabel || "-", "info");
}

function renderReason(row) {
  if (!row.hasPosMapping) {
    return "الفرع غير مربوط بنقطة بيع.";
  }

  if (!row.hasStockMapping) {
    return "الفرع غير مربوط بمصدر مخزون.";
  }

  if (row.priority === "critical") {
    return "المتاح صفر أو أقل مع وجود مبيعات خلال الفترة.";
  }

  if (row.priority === "urgent") {
    return "أيام التغطية أقل من أيام الأمان.";
  }

  if (row.priority === "reorder") {
    return "المتاح لا يغطي الهدف المطلوب.";
  }

  if (row.priority === "overstock") {
    return "المتاح أعلى بكثير من معدل البيع.";
  }

  if (row.priority === "slow") {
    return "يوجد مخزون لكن لا توجد حركة بيع في الفترة.";
  }

  if (row.priority === "no_movement") {
    return "لا توجد مبيعات ولا رصيد مؤثر.";
  }

  return "الوضع مستقر.";
}
