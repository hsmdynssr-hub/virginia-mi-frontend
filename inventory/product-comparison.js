const PRODUCT_COMPARISON_PAGE = "inventory-product-comparison";
const PRODUCT_COMPARISON_TIMEZONE = "Africa/Cairo";
const CLEOPATRA_COMPANY_ID = "2";

const productComparisonState = {
  primaryProduct: null,
  comparisonProduct: null,
  report: null,
  searchTimers: new Map()
};

document.addEventListener("DOMContentLoaded", async () => {
  renderLayout(
    "مقارنة الأصناف",
    "مقارنة أداء صنف داخل نقاط البيع مع نفس الفترة من السنة السابقة، واختياريًا مع صنف محدد في كليوباترا.",
    PRODUCT_COMPARISON_PAGE,
    buildProductComparisonPage()
  );

  bindProductComparisonEvents();
  await waitForPageContext();
  mountProductComparisonContextControls();
  initializeProductComparisonPeriod();
  updateComparisonVisibility();
});

function buildProductComparisonPage() {
  return `
    <main class="product-comparison-page">
      <section class="pc-config-card" aria-label="فلاتر تقرير مقارنة الأصناف">
        <div class="pc-context-row">
          <div id="pcCompanySlot" class="pc-context-slot"></div>
          <div id="pcBranchSlot" class="pc-context-slot"></div>
          <label class="pc-field pc-uniform-field" for="comparisonMode">
            <span>المقارنة الخارجية</span>
            <select id="comparisonMode" class="pc-select">
              <option value="none">بدون مقارنة</option>
              <option value="cleopatra">مقارنة مع كليوباترا</option>
            </select>
          </label>
        </div>

        <div class="pc-divider"></div>

        <div class="pc-period-row">
          <label class="pc-field pc-uniform-field" for="comparisonPeriodMode">
            <span>نوع الفترة</span>
            <select id="comparisonPeriodMode" class="pc-select">
              <option value="month">شهر</option>
              <option value="quarter">ربع سنوي</option>
              <option value="half">نصف سنوي</option>
              <option value="year">سنة</option>
              <option value="custom">مخصص بالأيام</option>
            </select>
          </label>
          <div id="productComparisonPeriodControls" class="pc-period-controls"></div>
        </div>
        <div id="productComparisonPeriodLabel" class="pc-period-summary"></div>

        <div class="pc-divider"></div>

        <div class="pc-product-action-row">
          <div class="pc-field pc-product-main-field">
            <label for="primaryProductSearch">صنف الشركة الأساسية</label>
            <div class="pc-product-picker">
              <input id="primaryProductSearch" class="pc-input" autocomplete="off"
                     placeholder="ابحث بالباركود أو اسم الصنف أو الرقم المرجعي" />
              <div id="primaryProductResults" class="pc-product-results hidden"></div>
            </div>
            <input id="productId" type="hidden" />
            <div id="primarySelectedProduct" class="pc-selected-product">لم يتم اختيار صنف بعد.</div>
          </div>

          <div class="pc-action-buttons" aria-label="إجراءات التقرير">
            <button id="pcUpdateBtn" class="pc-btn pc-btn-primary" type="button">تحديث التقرير</button>
            <button id="pcExcelBtn" class="pc-btn pc-btn-secondary" type="button">تصدير Excel</button>
            <button id="productComparisonPdfBtn" class="pc-btn pc-btn-secondary" type="button">تصدير PDF</button>
          </div>
        </div>

        <div id="comparisonProductBox" class="pc-comparison-box pc-hidden">
          <div class="pc-comparison-title">
            <strong>صنف كليوباترا للمقارنة</strong>
            <span>اختر الصنف المقابل بشكل مستقل من كتالوج كليوباترا.</span>
          </div>
          <div class="pc-field">
            <div class="pc-product-picker">
              <input id="comparisonProductSearch" class="pc-input" autocomplete="off"
                     placeholder="ابحث بصنف كليوباترا بالباركود أو الاسم أو الرقم المرجعي" />
              <div id="comparisonProductResults" class="pc-product-results hidden"></div>
            </div>
            <input id="comparisonProductId" type="hidden" />
            <input id="comparisonCompanyId" type="hidden" value="2" />
            <div id="comparisonSelectedProduct" class="pc-selected-product">لازم تختار صنف كليوباترا للمقارنة.</div>
          </div>
        </div>
      </section>

      <section id="productComparisonStatus" class="pc-status">اختر الصنف والفترة ثم اضغط تحديث التقرير.</section>

      <section id="productComparisonCompanyGrid" class="pc-company-grid"></section>
      <section id="productComparisonCross" class="pc-cross-company pc-hidden"></section>

      <section id="productComparisonTrendCard" class="pc-report-card pc-hidden">
        <h2>اتجاه مبيعات الصنف خلال الفترة</h2>
        <div id="productComparisonTrend"></div>
      </section>

      <section id="productComparisonBranchesCard" class="pc-report-card pc-hidden">
        <h2>تفصيل المقارنة حسب الفرع</h2>
        <div id="productComparisonBranches"></div>
      </section>

      <section id="productComparisonNotesCard" class="pc-report-card pc-hidden">
        <h2>ملاحظات التقرير</h2>
        <div id="productComparisonNotes"></div>
      </section>
    </main>
  `;
}

function bindProductComparisonEvents() {
  document.getElementById("loadBtn")?.addEventListener("click", loadProductComparisonReport);
  document.getElementById("pcUpdateBtn")?.addEventListener("click", loadProductComparisonReport);

  document.getElementById("comparisonPeriodMode")?.addEventListener("change", (event) => {
    renderProductComparisonPeriodControls(event.target.value);
    applyProductComparisonPeriod(event.target.value);
    markReportDirty();
  });

  document.getElementById("productComparisonPeriodControls")?.addEventListener("change", () => {
    const mode = document.getElementById("comparisonPeriodMode")?.value || "month";
    applyProductComparisonPeriod(mode);
    markReportDirty();
  });

  document.getElementById("comparisonMode")?.addEventListener("change", () => {
    updateComparisonVisibility();
    markReportDirty();
  });

  document.getElementById("companySelect")?.addEventListener("change", () => {
    clearSelectedProduct("primary");
    markReportDirty();
  });

  document.addEventListener("change", (event) => {
    if (event.target?.id === "branchCode") markReportDirty();
  });

  bindProductSearch("primary");
  bindProductSearch("comparison");

  document.getElementById("pcExcelBtn")?.addEventListener("click", () => {
    if (window.ReportExport?.exportExcel) {
      window.ReportExport.exportExcel(PRODUCT_COMPARISON_PAGE);
      return;
    }
    const fallback = document.getElementById("reportExportExcelBtn");
    if (fallback) fallback.click();
    else alert("محرك تصدير Excel لم يكتمل تحميله بعد. حاول مرة أخرى بعد لحظة.");
  });

  document.getElementById("productComparisonPdfBtn")?.addEventListener("click", () => {
    if (!productComparisonState.report) {
      alert("حمّل التقرير أولًا قبل تصدير PDF.");
      return;
    }
    window.print();
  });
}

async function waitForPageContext() {
  for (let i = 0; i < 30; i += 1) {
    const company = document.getElementById("companySelect");
    const branch = document.getElementById("branchCode");
    if (company && branch) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function mountProductComparisonContextControls() {
  const companySlot = document.getElementById("pcCompanySlot");
  const branchSlot = document.getElementById("pcBranchSlot");
  const companyField = document.getElementById("companySelect")?.closest(".context-field");
  const branchField = document.getElementById("branchCode")?.closest(".context-field");

  if (companySlot && companyField) companySlot.appendChild(companyField);
  if (branchSlot && branchField) branchSlot.appendChild(branchField);

  document.getElementById("reportToolbar")?.classList.add("pc-source-toolbar-hidden");
}

function bindProductSearch(kind) {
  const inputId = kind === "primary" ? "primaryProductSearch" : "comparisonProductSearch";
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener("input", () => {
    const currentTimer = productComparisonState.searchTimers.get(kind);
    if (currentTimer) clearTimeout(currentTimer);

    const timer = setTimeout(() => searchProducts(kind), 300);
    productComparisonState.searchTimers.set(kind, timer);
  });

  input.addEventListener("focus", () => {
    if (input.value.trim().length >= 1) searchProducts(kind);
  });

  document.addEventListener("click", (event) => {
    const results = getProductResultsElement(kind);
    if (!results) return;
    if (event.target === input || results.contains(event.target)) return;
    results.classList.add("hidden");
  });
}

function getProductResultsElement(kind) {
  return document.getElementById(kind === "primary" ? "primaryProductResults" : "comparisonProductResults");
}

function getSearchCompanyId(kind) {
  if (kind === "comparison") return CLEOPATRA_COMPANY_ID;
  return document.getElementById("companySelect")?.value || "";
}

async function searchProducts(kind) {
  const input = document.getElementById(kind === "primary" ? "primaryProductSearch" : "comparisonProductSearch");
  const results = getProductResultsElement(kind);
  const companyId = getSearchCompanyId(kind);
  const q = input?.value?.trim() || "";

  if (!results || !input) return;

  if (!companyId) {
    results.innerHTML = `<div class="pc-product-option">اختر الشركة الأساسية أولًا.</div>`;
    results.classList.remove("hidden");
    return;
  }

  if (q.length < 1) {
    results.classList.add("hidden");
    return;
  }

  results.classList.remove("hidden");
  results.innerHTML = `<div class="pc-product-option">جاري البحث في كاش الأصناف...</div>`;

  try {
    const response = await apiGet("/inventory/product-comparison/products", {
      companyId,
      q,
      limit: 30
    });

    const rows = Array.isArray(response.data) ? response.data : [];

    if (!rows.length) {
      results.innerHTML = `<div class="pc-product-option">لا توجد أصناف مطابقة.</div>`;
      return;
    }

    results.innerHTML = rows.map((row) => `
      <button type="button" class="pc-product-option" data-product-kind="${kind}" data-product-id="${escapeHtml(row.productId)}">
        <strong>${escapeHtml(row.displayName || row.name || "صنف بدون اسم")}</strong>
        <small>باركود: ${escapeHtml(row.barcode || "-")} · مرجع: ${escapeHtml(row.defaultCode || "-")}</small>
      </button>
    `).join("");

    results.querySelectorAll("[data-product-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const product = rows.find((row) => String(row.productId) === String(button.dataset.productId));
        if (product) selectProduct(kind, product);
      });
    });
  } catch (error) {
    results.innerHTML = `<div class="pc-product-option">${escapeHtml(error.message || "تعذر البحث عن الصنف")}</div>`;
  }
}

function selectProduct(kind, product) {
  const isPrimary = kind === "primary";
  productComparisonState[isPrimary ? "primaryProduct" : "comparisonProduct"] = product;

  const hidden = document.getElementById(isPrimary ? "productId" : "comparisonProductId");
  const input = document.getElementById(isPrimary ? "primaryProductSearch" : "comparisonProductSearch");
  const label = document.getElementById(isPrimary ? "primarySelectedProduct" : "comparisonSelectedProduct");
  const results = getProductResultsElement(kind);

  if (hidden) hidden.value = product.productId || "";
  if (input) input.value = product.displayName || product.name || "";
  if (label) {
    label.textContent = `المختار: ${product.displayName || product.name || "-"} · باركود ${product.barcode || "-"} · مرجع ${product.defaultCode || "-"}`;
  }
  results?.classList.add("hidden");
  markReportDirty();
}

function clearSelectedProduct(kind) {
  const isPrimary = kind === "primary";
  productComparisonState[isPrimary ? "primaryProduct" : "comparisonProduct"] = null;
  const hidden = document.getElementById(isPrimary ? "productId" : "comparisonProductId");
  const input = document.getElementById(isPrimary ? "primaryProductSearch" : "comparisonProductSearch");
  const label = document.getElementById(isPrimary ? "primarySelectedProduct" : "comparisonSelectedProduct");
  if (hidden) hidden.value = "";
  if (input) input.value = "";
  if (label) label.textContent = isPrimary ? "لم يتم اختيار صنف بعد." : "لازم تختار صنف كليوباترا للمقارنة.";
}

function updateComparisonVisibility() {
  const enabled = document.getElementById("comparisonMode")?.value === "cleopatra";
  document.getElementById("comparisonProductBox")?.classList.toggle("pc-hidden", !enabled);
}

function initializeProductComparisonPeriod() {
  const mode = document.getElementById("comparisonPeriodMode")?.value || "month";
  renderProductComparisonPeriodControls(mode);
  applyProductComparisonPeriod(mode);
}

function renderProductComparisonPeriodControls(mode) {
  const container = document.getElementById("productComparisonPeriodControls");
  if (!container) return;
  container.classList.toggle("pc-period-single", mode === "month" || mode === "year");

  const today = getCairoCalendarDate();
  const currentYear = today.getUTCFullYear();
  const currentMonth = `${currentYear}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const currentQuarter = Math.floor(today.getUTCMonth() / 3) + 1;
  const currentHalf = today.getUTCMonth() < 6 ? 1 : 2;
  const existingFrom = document.getElementById("dateFrom")?.value || toIsoDate(today);
  const existingTo = document.getElementById("dateTo")?.value || toIsoDate(today);

  if (mode === "month") {
    container.innerHTML = `
      <label class="pc-period-part">
        <span>الشهر المطلوب</span>
        <input id="comparisonMonth" class="pc-input" type="month" value="${currentMonth}" />
      </label>
    `;
    return;
  }

  if (mode === "quarter") {
    container.innerHTML = `
      <label class="pc-period-part">
        <span>الربع</span>
        <select id="comparisonQuarter" class="pc-select">
          <option value="1" ${currentQuarter === 1 ? "selected" : ""}>الربع الأول</option>
          <option value="2" ${currentQuarter === 2 ? "selected" : ""}>الربع الثاني</option>
          <option value="3" ${currentQuarter === 3 ? "selected" : ""}>الربع الثالث</option>
          <option value="4" ${currentQuarter === 4 ? "selected" : ""}>الربع الرابع</option>
        </select>
      </label>
      ${renderPeriodYearInput(currentYear)}
    `;
    return;
  }

  if (mode === "half") {
    container.innerHTML = `
      <label class="pc-period-part">
        <span>النصف</span>
        <select id="comparisonHalf" class="pc-select">
          <option value="1" ${currentHalf === 1 ? "selected" : ""}>النصف الأول</option>
          <option value="2" ${currentHalf === 2 ? "selected" : ""}>النصف الثاني</option>
        </select>
      </label>
      ${renderPeriodYearInput(currentYear)}
    `;
    return;
  }

  if (mode === "year") {
    container.innerHTML = renderPeriodYearInput(currentYear, "السنة المطلوبة");
    return;
  }

  container.innerHTML = `
    <label class="pc-period-part">
      <span>من</span>
      <input id="comparisonCustomFrom" class="pc-input" type="date" value="${escapeHtml(existingFrom)}" />
    </label>
    <label class="pc-period-part">
      <span>إلى</span>
      <input id="comparisonCustomTo" class="pc-input" type="date" value="${escapeHtml(existingTo)}" />
    </label>
  `;
}

function renderPeriodYearInput(year, label = "السنة") {
  return `
    <label class="pc-period-part">
      <span>${escapeHtml(label)}</span>
      <input id="comparisonPeriodYear" class="pc-input" type="number" min="2015" max="2100" step="1" value="${Number(year)}" />
    </label>
  `;
}

function applyProductComparisonPeriod(mode) {
  const fromInput = document.getElementById("dateFrom");
  const toInput = document.getElementById("dateTo");
  const datePreset = document.getElementById("datePreset");
  const customDates = document.getElementById("customDates");

  if (!fromInput || !toInput) return;

  const today = getCairoCalendarDate();
  let from = null;
  let to = null;

  if (mode === "month") {
    const raw = document.getElementById("comparisonMonth")?.value || "";
    const match = /^(\d{4})-(\d{2})$/.exec(raw);
    if (!match) return;
    const year = Number(match[1]);
    const month = Number(match[2]);
    from = new Date(Date.UTC(year, month - 1, 1));
    to = new Date(Date.UTC(year, month, 0));
  } else if (mode === "quarter") {
    const year = readComparisonPeriodYear();
    const quarter = Number(document.getElementById("comparisonQuarter")?.value || 1);
    const startMonth = (quarter - 1) * 3;
    from = new Date(Date.UTC(year, startMonth, 1));
    to = new Date(Date.UTC(year, startMonth + 3, 0));
  } else if (mode === "half") {
    const year = readComparisonPeriodYear();
    const half = Number(document.getElementById("comparisonHalf")?.value || 1);
    const startMonth = half === 2 ? 6 : 0;
    from = new Date(Date.UTC(year, startMonth, 1));
    to = new Date(Date.UTC(year, startMonth + 6, 0));
  } else if (mode === "year") {
    const year = readComparisonPeriodYear();
    from = new Date(Date.UTC(year, 0, 1));
    to = new Date(Date.UTC(year, 11, 31));
  } else {
    const customFrom = document.getElementById("comparisonCustomFrom")?.value || "";
    const customTo = document.getElementById("comparisonCustomTo")?.value || "";
    fromInput.value = customFrom;
    toInput.value = customTo;
    if (datePreset) datePreset.value = "custom";
    if (customDates) customDates.hidden = true;
    renderPeriodLabel();
    return;
  }

  // For the active current period, compare only up to today. Past periods remain complete.
  if (from <= today && to > today) to = new Date(today);

  fromInput.value = toIsoDate(from);
  toInput.value = toIsoDate(to);
  if (datePreset) datePreset.value = "custom";
  if (customDates) customDates.hidden = true;
  renderPeriodLabel();
}

function readComparisonPeriodYear() {
  const value = Number(document.getElementById("comparisonPeriodYear")?.value || 0);
  return Number.isInteger(value) && value >= 2015 && value <= 2100
    ? value
    : getCairoCalendarDate().getUTCFullYear();
}

function getCairoCalendarDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PRODUCT_COMPARISON_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function toIsoDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function renderPeriodLabel() {
  const from = document.getElementById("dateFrom")?.value || "-";
  const to = document.getElementById("dateTo")?.value || "-";
  const label = document.getElementById("productComparisonPeriodLabel");
  if (label) label.textContent = `الفترة المطبقة فعليًا: ${from} إلى ${to}`;
}

function getReportParams() {
  const comparisonEnabled = document.getElementById("comparisonMode")?.value === "cleopatra";

  return {
    companyId: document.getElementById("companySelect")?.value || "",
    productId: document.getElementById("productId")?.value || "",
    dateFrom: document.getElementById("dateFrom")?.value || "",
    dateTo: document.getElementById("dateTo")?.value || "",
    branchCode: document.getElementById("branchCode")?.value || "all",
    timezone: PRODUCT_COMPARISON_TIMEZONE,
    comparisonEnabled,
    comparisonCompanyId: CLEOPATRA_COMPANY_ID,
    comparisonProductId: comparisonEnabled ? (document.getElementById("comparisonProductId")?.value || "") : ""
  };
}

function validateReportParams(params) {
  if (!params.companyId) return "اختر الشركة الأساسية أولًا.";
  if (!params.productId) return "اختر صنف الشركة الأساسية بالباركود أو الاسم أو الرقم المرجعي.";
  if (!params.dateFrom || !params.dateTo) return "حدد فترة التقرير.";
  if (params.dateFrom > params.dateTo) return "تاريخ البداية يجب أن يكون قبل أو مساويًا لتاريخ النهاية.";
  if (!params.branchCode) return "اختر الفرع / النطاق.";
  if (params.comparisonEnabled && String(params.companyId) === CLEOPATRA_COMPANY_ID) {
    return "مقارنة كليوباترا مصممة بحيث تكون كليوباترا شركة المقارنة؛ اختر فيرجينيا كشركة أساسية.";
  }
  if (params.comparisonEnabled && !params.comparisonProductId) {
    return "فعّلت مقارنة كليوباترا؛ لازم تختار صنف كليوباترا أيضًا.";
  }
  return "";
}

async function loadProductComparisonReport() {
  renderPeriodLabel();
  const params = getReportParams();
  const error = validateReportParams(params);

  if (error) {
    setProductComparisonStatus(error, true);
    return;
  }

  const loadButtons = [
    document.getElementById("loadBtn"),
    document.getElementById("pcUpdateBtn")
  ].filter(Boolean);

  try {
    loadButtons.forEach((button) => {
      button.disabled = true;
      button.textContent = "جاري التحميل...";
    });

    setProductComparisonStatus("جاري قراءة بيانات POS من الكاش وتجهيز المقارنة...");

    const response = await apiGet("/inventory/product-comparison", params);
    const report = response.data || {};
    productComparisonState.report = report;

    renderProductComparisonReport(report);
    setProductComparisonStatus("تم تحديث التقرير بنجاح.");
  } catch (error) {
    console.error(error);
    setProductComparisonStatus(error.message || "تعذر تحميل تقرير مقارنة الأصناف.", true);
  } finally {
    loadButtons.forEach((button) => {
      button.disabled = false;
      button.textContent = "تحديث التقرير";
    });
  }
}

function renderProductComparisonReport(report) {
  renderCompanyPanels(report);
  renderCrossCompany(report);
  renderTrend(report);
  renderBranches(report);
  renderNotes(report.notes || []);
}

function renderCompanyPanels(report) {
  const container = document.getElementById("productComparisonCompanyGrid");
  if (!container) return;

  const companies = [report.primary, report.comparison].filter(Boolean);
  container.style.gridTemplateColumns = companies.length > 1 ? "repeat(2, minmax(0, 1fr))" : "1fr";
  container.innerHTML = companies.map(renderCompanyPanel).join("");
}

function renderCompanyPanel(company) {
  const product = company.product || {};
  const current = company.current?.summary || {};
  const previous = company.previous?.summary || {};
  const change = company.change || {};
  const changeValue = Number(change.netSales || 0);

  return `
    <article class="pc-company-panel">
      <div class="pc-company-heading">
        <div>
          <h2>${escapeHtml(company.companyName || "الشركة")}</h2>
          <p>${escapeHtml(product.displayName || product.name || "-")}</p>
        </div>
        <div class="pc-product-identifiers">
          باركود: ${escapeHtml(product.barcode || "-")}<br />
          مرجع: ${escapeHtml(product.defaultCode || "-")}
        </div>
      </div>

      <div class="pc-kpi-grid">
        ${renderKpi("الكمية المباعة", formatNumber(current.soldQty), `صافي بعد المرتجعات: ${formatNumber(current.netQty)} · مرتجع: ${formatNumber(current.returnedQty)}`)}
        ${renderKpi("صافي مبيعات الصنف", formatMoney(current.netSales), `السنة السابقة: ${formatMoney(previous.netSales)}`)}
        ${renderKpi("مساهمة الصنف من إيراد POS", formatPercent(current.revenueSharePercent), `${formatMoney(current.netSales)} من ${formatMoney(current.totalPosRevenue)}`)}
        ${renderKpi(
          "التغير عن السنة السابقة",
          formatSignedPercent(change.netSalesPercent),
          `${formatSignedMoney(change.netSales)} · الفترة السابقة ${formatMoney(previous.netSales)}`,
          changeValue >= 0 ? "positive" : "negative"
        )}
      </div>
    </article>
  `;
}

function renderKpi(label, value, hint, tone = "") {
  return `
    <div class="pc-kpi ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(hint)}</small>
    </div>
  `;
}

function renderCrossCompany(report) {
  const container = document.getElementById("productComparisonCross");
  const comparison = report.comparison;
  const cross = report.crossCompany;

  if (!container || !comparison || !cross) {
    container?.classList.add("pc-hidden");
    return;
  }

  const primarySales = Number(report.primary?.current?.summary?.netSales || 0);
  const comparisonSales = Number(comparison.current?.summary?.netSales || 0);
  const winner = primarySales === comparisonSales
    ? "تعادل في صافي المبيعات"
    : primarySales > comparisonSales
      ? `الفارق لصالح ${report.primary?.companyName || "الشركة الأساسية"}`
      : `الفارق لصالح ${comparison.companyName || "كليوباترا"}`;

  container.innerHTML = `
    <h2>مقارنة مباشرة بين الشركتين — ${escapeHtml(winner)}</h2>
    <div class="pc-cross-grid">
      ${renderCrossMetric("فرق صافي المبيعات", formatSignedMoney(cross.netSalesDifference), formatSignedPercent(cross.netSalesDifferencePercent))}
      ${renderCrossMetric("فرق الكمية الصافية", formatSignedNumber(cross.netQtyDifference), "بعد المرتجعات والتعديلات")}
      ${renderCrossMetric("فرق مساهمة الإيراد", formatSignedNumber(cross.revenueShareDifferencePoints), "نقطة مئوية")}
      ${renderCrossMetric("كليوباترا — مبيعات الصنف", formatMoney(comparisonSales), `${formatPercent(comparison.current?.summary?.revenueSharePercent)} من إيراد POS`)}
    </div>
  `;
  container.classList.remove("pc-hidden");
}

function renderCrossMetric(label, value, hint) {
  return `<div class="pc-cross-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint)}</small></div>`;
}

function renderTrend(report) {
  const card = document.getElementById("productComparisonTrendCard");
  const container = document.getElementById("productComparisonTrend");
  if (!card || !container) return;

  const primaryRows = report.primary?.current?.trend || [];
  const comparisonRows = report.comparison?.current?.trend || [];
  const primaryMap = new Map(primaryRows.map((row) => [row.bucket, Number(row.netSales || 0)]));
  const comparisonMap = new Map(comparisonRows.map((row) => [row.bucket, Number(row.netSales || 0)]));
  const buckets = Array.from(new Set([...primaryMap.keys(), ...comparisonMap.keys()])).sort();

  if (!buckets.length) {
    container.innerHTML = `<p>لا توجد مبيعات للصنف داخل الفترة المختارة.</p>`;
    card.classList.remove("pc-hidden");
    return;
  }

  const max = Math.max(1, ...buckets.flatMap((bucket) => [Math.abs(primaryMap.get(bucket) || 0), Math.abs(comparisonMap.get(bucket) || 0)]));

  container.innerHTML = `
    <div class="pc-trend-scroll">
      <div class="pc-trend-chart">
        ${buckets.map((bucket) => {
          const p = primaryMap.get(bucket) || 0;
          const c = comparisonMap.get(bucket) || 0;
          const pHeight = Math.max(2, Math.round((Math.abs(p) / max) * 200));
          const cHeight = Math.max(2, Math.round((Math.abs(c) / max) * 200));
          return `
            <div class="pc-trend-group" title="${escapeHtml(bucket)} — ${escapeHtml(formatMoney(p))}">
              <div class="pc-trend-bars">
                <div class="pc-trend-bar" style="height:${pHeight}px" title="${escapeHtml(report.primary?.companyName || "الأساسي")}: ${escapeHtml(formatMoney(p))}"></div>
                ${report.comparison ? `<div class="pc-trend-bar comparison" style="height:${cHeight}px" title="${escapeHtml(report.comparison?.companyName || "كليوباترا")}: ${escapeHtml(formatMoney(c))}"></div>` : ""}
              </div>
              <div class="pc-trend-label">${escapeHtml(bucket)}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
  card.classList.remove("pc-hidden");
}

function renderBranches(report) {
  const card = document.getElementById("productComparisonBranchesCard");
  const container = document.getElementById("productComparisonBranches");
  if (!card || !container) return;

  const rows = [];
  [report.primary, report.comparison].filter(Boolean).forEach((company) => {
    (company.branches || []).forEach((branch) => rows.push({ company, branch }));
  });

  container.innerHTML = `
    <div class="pc-table-wrap">
      <table class="pc-table">
        <thead>
          <tr>
            <th>الشركة</th>
            <th>الفرع</th>
            <th>الكمية</th>
            <th>مبيعات الصنف</th>
            <th>إجمالي إيراد POS</th>
            <th>مساهمة الصنف</th>
            <th>السنة السابقة</th>
            <th>التغير</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map(({ company, branch }) => `
            <tr>
              <td>${escapeHtml(company.companyName)}</td>
              <td>${escapeHtml(branch.branchName)}</td>
              <td>${escapeHtml(formatNumber(branch.current?.netQty))}</td>
              <td>${escapeHtml(formatMoney(branch.current?.netSales))}</td>
              <td>${escapeHtml(formatMoney(branch.current?.totalPosRevenue))}</td>
              <td>${escapeHtml(formatPercent(branch.current?.revenueSharePercent))}<br><small>${escapeHtml(formatMoney(branch.current?.netSales))} من ${escapeHtml(formatMoney(branch.current?.totalPosRevenue))}</small></td>
              <td>${escapeHtml(formatMoney(branch.previous?.netSales))}</td>
              <td>${escapeHtml(formatSignedPercent(branch.change?.netSalesPercent))}<br><small>${escapeHtml(formatSignedMoney(branch.change?.netSales))}</small></td>
            </tr>
          `).join("") : `<tr><td colspan="8">لا توجد بيانات فروع في الفترة المحددة.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  card.classList.remove("pc-hidden");
}

function renderNotes(notes) {
  const card = document.getElementById("productComparisonNotesCard");
  const container = document.getElementById("productComparisonNotes");
  if (!card || !container) return;

  container.innerHTML = `<ul class="pc-notes">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`;
  card.classList.remove("pc-hidden");
}

function setProductComparisonStatus(message, isError = false) {
  const box = document.getElementById("productComparisonStatus");
  if (!box) return;
  box.textContent = message;
  box.classList.toggle("error", isError);
  box.classList.remove("hidden");
}

function markReportDirty() {
  if (!productComparisonState.report) return;
  setProductComparisonStatus("تم تغيير الفلاتر. اضغط تحديث التقرير لتطبيق القيم الجديدة.");
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
}

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString("ar-EG", { maximumFractionDigits: 3 });
}

function formatPercent(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatSignedMoney(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${formatMoney(number)}`;
}

function formatSignedNumber(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${formatNumber(number)}`;
}

function formatSignedPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "جديد / لا توجد قاعدة مقارنة";
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${formatPercent(number)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
