document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "تقرير مبيعات الفروع",
    "نفس منطق تحليل أداء المعارض: استرداد أموال، عروض وتعديلات سالبة، وصافي مبيعات موحد.",
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
          <p>الأرقام مبنية على نفس منطق تحليل أداء المعارض POS Branch Sales.</p>
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

function getSelectedBranchCode() {
  return document.getElementById("branchFilter")?.value || "";
}

function validateBranchSalesContext() {
  const companyId = getSelectedCompanyId();
  const branchCode = getSelectedBranchCode();

  if (!companyId) {
    return {
      ok: false,
      message: "لازم تختار الشركة قبل تحميل تقرير مبيعات الفروع."
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

function getBranchSalesFilters() {
  return {
    companyId: getSelectedCompanyId(),
    dateFrom: document.getElementById("dateFrom")?.value || "",
    dateTo: document.getElementById("dateTo")?.value || "",
    branchCode: getSelectedBranchCode(),
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
    /*
      تقرير مبيعات الفروع يستخدم الآن نفس منطق POS Branch Sales،
      لذلك لازم الفلتر يكون branchCode وليس branchId القديم.
    */
    const response =
      await apiGet(
        "/pos-branch-access/me",
        {
          companyId
        }
      );

    const branches =
      response.data ||
      response.branches ||
      [];

    select.innerHTML = `
      <option value="">اختر الفرع / النطاق</option>
      <option value="all">كل الفروع</option>
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
              <option value="${ReportUI.escapeHtml(branchCode)}">
                ${ReportUI.escapeHtml(branchName)}
              </option>
            `;
          })
          .join("")
      }
    `;

    const stillExists = Array.from(select.options).some(
      (option) => option.value === currentValue
    );

    select.value = stillExists ? currentValue : "";
  } catch (error) {
    console.error(error);

    select.innerHTML = `<option value="">تعذر تحميل فروع POS</option>`;
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

    if (filters.branchCode && filters.branchCode !== "all") {
      params.branchCode = filters.branchCode;
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
      hint: "إجمالي المبيعات - استرداد الأموال - العروض والتعديلات السالبة"
    },
    {
      title: "إجمالي المبيعات",
      value: ReportUI.money(summary.grossSales || summary.totalSales),
      hint: "سطور البيع الموجبة"
    },
    {
      title: "المرتجعات / استرداد أموال",
      value: ReportUI.money(summary.returnsAmount || summary.returnsValue),
      hint: "استرداد أموال فقط، وليس كل سطر سالب"
    },
    {
      title: "العروض والتعديلات السالبة",
      value: ReportUI.money(
        summary.negativeAdjustmentsAmount ||
        summary.negativeAdjustmentsValue
      ),
      hint: "سطور سالبة داخل فواتير بيع عادية"
    },
    {
      title: "إجمالي الخصومات",
      value: ReportUI.money(summary.discountsAmount || summary.totalDiscountValue),
      hint: "الخصومات اليدوية من سطور الفواتير"
    },
    {
      title: "عدد الفواتير",
      value: ReportUI.number(summary.totalOrdersCount || summary.ordersCount),
      hint: "كل فواتير POS"
    },
    {
      title: "متوسط الفاتورة",
      value: ReportUI.money(summary.averageTicket),
      hint: "صافي المبيعات ÷ عدد الفواتير"
    },
    {
      title: "نسبة العروض والتعديلات",
      value: ReportUI.percent(summary.negativeAdjustmentsRate),
      hint: "العروض والتعديلات السالبة ÷ إجمالي المبيعات"
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
        label: "مصدر التجميع",
        width: "160px",
        format: renderPosSources
      },
      {
        key: "grossSales",
        label: "إجمالي المبيعات",
        width: "115px",
        className: "report-money",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "returnsAmount",
        label: "المرتجعات / استرداد أموال",
        width: "115px",
        className: "report-money",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "negativeAdjustmentsAmount",
        label: "العروض والتعديلات السالبة",
        width: "155px",
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
            label: "استرداد",
            value: ReportUI.percent(row.returnRate)
          },
          {
            label: "خصم يدوي",
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
        label: "مصدر التجميع",
        width: "160px",
        format: renderPosSources
      },
      {
        key: "grossSales",
        label: "إجمالي المبيعات",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "returnsAmount",
        label: "المرتجعات / استرداد أموال",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "negativeAdjustmentsAmount",
        label: "العروض والتعديلات السالبة",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "discountsAmount",
        label: "الخصومات اليدوية",
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
        label: "عدد الفواتير",
        format: (value) => ReportUI.number(value)
      },
      {
        key: "positiveOrdersCount",
        label: "فواتير بيع",
        format: (value) => ReportUI.number(value)
      },
      {
        key: "refundOrdersCount",
        label: "فواتير استرداد",
        format: (value) => ReportUI.number(value)
      },
      {
        key: "averageTicket",
        label: "متوسط الفاتورة",
        format: (value) => ReportUI.money(value)
      },
      {
        key: "returnRate",
        label: "نسبة استرداد الأموال",
        format: (value) => ReportUI.percent(value)
      },
      {
        key: "negativeAdjustmentsRate",
        label: "نسبة العروض والتعديلات",
        format: (value) => ReportUI.percent(value)
      },
      {
        key: "discountRate",
        label: "نسبة الخصم اليدوي",
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