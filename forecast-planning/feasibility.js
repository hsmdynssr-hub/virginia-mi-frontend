const FEASIBILITY_PAGE = "forecast-planning-feasibility";
let feasibilityProducts = [];
let lastFeasibilityReport = null;

document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "قابلية تحقيق الفوركاست والخامات",
    "أدخل فوركاست كل منتج، والنظام يحسب المبيعات والمخزون واحتياجات الـBOM ومخاطر الخامات.",
    FEASIBILITY_PAGE,
    buildFeasibilityContent()
  );
  document.getElementById("forecastMonth").value = new Date().toISOString().slice(0, 7);
  bindFeasibilityEvents();
  loadFeasibilityOptions();
});

function buildFeasibilityContent() {
  return `
    <div class="report-ui-page forecast-feasibility-page">
      <section class="report-card mi-filter-card">
        <div class="report-card-head"><h2>إعداد الفوركاست</h2><p>القيمة الوحيدة التي تدخلها يدويًا هي فوركاست كل منتج.</p></div>
        <div class="feasibility-filter-grid">
          <label class="report-field">شهر الفوركاست<input id="forecastMonth" type="month" class="report-input form-control" /></label>
          <label class="report-field">فئة المنتج<select id="feasibilityCategory" class="report-select form-select"><option value="">كل فئات المنتج التام</option></select></label>
          <label class="report-field">بحث عن منتج<input id="feasibilitySearch" class="report-input form-control" placeholder="اسم / كود / باركود" /></label>
          <button id="loadFeasibilityProducts" class="report-btn-primary btn btn-primary" type="button">عرض المنتجات</button>
        </div>
      </section>

      <div id="feasibilityStatus" class="feasibility-status"></div>

      <section class="report-card forecast-products-card">
        <div class="report-card-head"><h2>فوركاست المنتجات</h2><p>القيم محفوظة تلقائيًا للشركة والشهر والمنتج عند الحساب.</p></div>
        <div id="feasibilityProductsTable"></div>
        <div class="feasibility-actions mt-3">
          <button id="calculateFeasibility" class="report-btn-primary btn btn-primary" type="button">احسب قابلية التحقيق</button>
          <button id="exportFeasibilityExcel" class="report-btn-secondary btn btn-outline-success" type="button" disabled>تصدير Excel</button>
        </div>
      </section>

      <section id="feasibilityResults" class="hidden">
        <div id="feasibilityKpis" class="report-kpi-grid"></div>
        <section class="report-card">
          <div class="feasibility-tabs">
            <button class="feasibility-tab report-btn-secondary active" data-target="productResult">تحليل المنتجات</button>
            <button class="feasibility-tab report-btn-secondary" data-target="materialResult">الخامات</button>
            <button class="feasibility-tab report-btn-secondary" data-target="intermediateResult">نصف المصنع</button>
            <button class="feasibility-tab report-btn-secondary" data-target="warningResult">الملاحظات</button>
          </div>
          <div id="productResult" class="feasibility-section"></div>
          <div id="materialResult" class="feasibility-section hidden"></div>
          <div id="intermediateResult" class="feasibility-section hidden"></div>
          <div id="warningResult" class="feasibility-section hidden"></div>
        </section>
      </section>
    </div>
  `;
}

function companyId() { return document.getElementById("companySelect")?.value || ""; }
function esc(value) { return ReportUI.escapeHtml ? ReportUI.escapeHtml(value) : String(value ?? ""); }
function num(value, digits = 2) { return ReportUI.number(value, digits); }

function setFeasibilityStatus(message, type = "info") {
  const box = document.getElementById("feasibilityStatus");
  box.className = `feasibility-status alert alert-${type}`;
  box.textContent = message;
}

function bindFeasibilityEvents() {
  document.getElementById("loadFeasibilityProducts")?.addEventListener("click", loadFeasibilityProducts);
  document.getElementById("calculateFeasibility")?.addEventListener("click", calculateFeasibility);
  document.getElementById("exportFeasibilityExcel")?.addEventListener("click", exportFeasibilityExcel);
  document.getElementById("companySelect")?.addEventListener("change", loadFeasibilityOptions);
  document.getElementById("forecastMonth")?.addEventListener("change", loadSavedForecastValues);
  document.querySelectorAll(".feasibility-tab").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll(".feasibility-tab").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".feasibility-section").forEach((section) => section.classList.toggle("hidden", section.id !== button.dataset.target));
  }));
}

async function loadFeasibilityOptions() {
  if (!companyId()) return;
  try {
    const response = await apiGet("/forecast-planning/feasibility/options", { companyId: companyId() });
    const categories = response.data?.categories || [];
    document.getElementById("feasibilityCategory").innerHTML = `<option value="">كل فئات المنتج التام</option>${categories.map((row) => `<option value="${Number(row.categoryId || row.id)}">${esc(row.categoryName || row.name)}</option>`).join("")}`;
    feasibilityProducts = [];
    lastFeasibilityReport = null;
    document.getElementById("feasibilityProductsTable").innerHTML = "";
    document.getElementById("feasibilityResults")?.classList.add("hidden");
    document.getElementById("exportFeasibilityExcel").disabled = true;
    setFeasibilityStatus("اختر الفئة المطلوبة ثم اضغط عرض المنتجات. لن يتم تحميل المنتجات تلقائيًا.", "info");
  } catch (error) { setFeasibilityStatus(error.message, "danger"); }
}

async function loadFeasibilityProducts() {
  if (!companyId()) return setFeasibilityStatus("اختر الشركة أولًا.", "warning");
  setFeasibilityStatus("جاري تحميل المنتجات...", "info");
  try {
    const response = await apiGet("/forecast-planning/feasibility/products", {
      companyId: companyId(),
      categoryId: document.getElementById("feasibilityCategory").value,
      search: document.getElementById("feasibilitySearch").value,
      limit: 1000
    });
    feasibilityProducts = response.data?.products || [];
    renderForecastInputs();
    await loadSavedForecastValues();
    setFeasibilityStatus(`تم تحميل ${feasibilityProducts.length} منتج.`, "success");
  } catch (error) { setFeasibilityStatus(error.message, "danger"); }
}

function renderForecastInputs() {
  const rows = feasibilityProducts.map((row) => ({
    ...row,
    forecastInput: `<input class="forecast-input" type="number" min="0" step="0.01" value="0" data-product-id="${Number(row.productId)}" />`
  }));
  ReportUI.renderTable("feasibilityProductsTable", {
    rows, minWidth: 950,
    columns: [
      { key: "defaultCode", label: "الكود" }, { key: "barcode", label: "الباركود" },
      { key: "productName", label: "المنتج" }, { key: "categoryName", label: "الفئة" },
      { key: "uomName", label: "الوحدة" }, { key: "forecastInput", label: "فوركاست الشهر", format: (value) => value }
    ]
  });
}

async function loadSavedForecastValues() {
  if (!companyId() || !document.getElementById("forecastMonth").value) return;
  try {
    const response = await apiGet("/forecast-planning/feasibility/saved", {
      companyId: companyId(), forecastMonth: document.getElementById("forecastMonth").value,
      categoryId: document.getElementById("feasibilityCategory").value
    });
    (response.data?.rows || []).forEach((row) => {
      const input = document.querySelector(`.forecast-input[data-product-id="${Number(row.productId)}"]`);
      if (input) input.value = Number(row.forecastQty || 0);
    });
  } catch (_) {}
}

function buildPayload() {
  const forecastItems = Array.from(document.querySelectorAll(".forecast-input"))
    .map((input) => ({ productId: Number(input.dataset.productId), forecastQty: Number(input.value || 0) }))
    .filter((row) => row.forecastQty > 0);
  return {
    companyId: Number(companyId()), forecastMonth: document.getElementById("forecastMonth").value,
    categoryId: document.getElementById("feasibilityCategory").value || null, forecastItems
  };
}

async function calculateFeasibility() {
  const payload = buildPayload();
  if (!payload.forecastItems.length) return setFeasibilityStatus("أدخل فوركاست لمنتج واحد على الأقل.", "warning");
  const button = document.getElementById("calculateFeasibility");
  button.disabled = true; button.textContent = "جاري مزامنة المبيعات والحساب...";
  try {
    const response = await apiPost("/forecast-planning/feasibility/calculate", payload);
    lastFeasibilityReport = response.data;
    renderFeasibilityReport(lastFeasibilityReport);
    document.getElementById("exportFeasibilityExcel").disabled = false;
    setFeasibilityStatus("تم حفظ الفوركاست وحساب قابلية التحقيق.", "success");
  } catch (error) { setFeasibilityStatus(error.message, "danger"); }
  finally { button.disabled = false; button.textContent = "احسب قابلية التحقيق"; }
}

function renderFeasibilityReport(report) {
  document.getElementById("feasibilityResults").classList.remove("hidden");
  const s = report.summary || {};
  ReportUI.renderKpis("feasibilityKpis", [
    { title: "إجمالي الفوركاست", value: num(s.totalForecastQty), hint: `${s.productsCount || 0} منتج` },
    { title: "المبيعات الفعلية", value: num(s.totalActualSalesQty), hint: `${num(s.achievementPercent)}% تحقيق` },
    { title: "الكمية القابلة للتحقيق", value: num(s.totalFeasibleQty), hint: `${num(s.feasibilityPercent)}% من الفوركاست`, tone: "success" },
    { title: "خامات بها عجز", value: num(s.materialShortagesCount, 0), hint: "بعد التوريدات المؤكدة", tone: s.materialShortagesCount ? "danger" : "success" },
    { title: "منتجات حرجة", value: num(s.criticalProductsCount, 0), hint: "تحتاج تدخل", tone: s.criticalProductsCount ? "danger" : "success" }
  ]);

  ReportUI.renderTable("productResult", { rows: report.productRows, minWidth: 1800, columns: [
    { key: "defaultCode", label: "الكود" }, { key: "barcode", label: "الباركود" }, { key: "productName", label: "المنتج" },
    { key: "forecastQty", label: "الفوركاست", format: (v) => num(v) },
    { key: "posSalesQty", label: "مبيعات POS", format: (v) => num(v) },
    { key: "saleOrderQty", label: "أوامر البيع", format: (v) => num(v) },
    { key: "returnsQty", label: "المرتجعات", format: (v) => num(v) },
    { key: "actualSalesQty", label: "صافي المبيعات", format: (v) => num(v) },
    { key: "achievementPercent", label: "التحقيق", format: (v) => `${num(v)}%` }, { key: "elapsedPercent", label: "الزمن المنقضي", format: (v) => `${num(v)}%` },
    { key: "availableFgQty", label: "منتج تام متاح", format: (v) => num(v) }, { key: "expectedProductionQty", label: "تصنيع مؤكد", format: (v) => num(v) },
    { key: "toManufactureQty", label: "مطلوب تصنيعه", format: (v) => num(v) }, { key: "materialCoveragePercent", label: "تغطية الخامات", format: (v) => `${num(v)}%` },
    { key: "maxProducibleQty", label: "أقصى إنتاج", format: (v) => num(v) }, { key: "forecastFeasibilityPercent", label: "قابلية التحقيق", format: (v) => `${num(v)}%` },
    { key: "limitingMaterial", label: "الخامة المعطلة" }, { key: "label", label: "الحالة", format: (v, row) => ReportUI.statusPill(v, row.level >= 5 ? "bad" : row.level <= 2 ? "good" : "warning") }
  ]});

  ReportUI.renderTable("materialResult", { rows: report.materialRows, minWidth: 1400, columns: [
    { key: "defaultCode", label: "الكود" }, { key: "barcode", label: "الباركود" }, { key: "productName", label: "الخامة" }, { key: "uomName", label: "الوحدة" },
    { key: "requiredQty", label: "المطلوب", format: (v) => num(v) }, { key: "availableQty", label: "المتاح", format: (v) => num(v) }, { key: "incomingQty", label: "توريدات مؤكدة", format: (v) => num(v) },
    { key: "expectedAvailableQty", label: "المتاح المتوقع", format: (v) => num(v) }, { key: "expectedShortageQty", label: "العجز المتوقع", format: (v) => num(v) },
    { key: "expectedCoveragePercent", label: "التغطية", format: (v) => `${num(v)}%` }
  ]});

  ReportUI.renderTable("intermediateResult", { rows: report.intermediateRows, minWidth: 1100, columns: [
    { key: "defaultCode", label: "الكود" }, { key: "productName", label: "نصف المصنع" }, { key: "requiredQty", label: "المطلوب", format: (v) => num(v) },
    { key: "availableQty", label: "المتاح", format: (v) => num(v) }, { key: "incomingQty", label: "تصنيع مؤكد", format: (v) => num(v) },
    { key: "toManufactureQty", label: "مطلوب تصنيعه", format: (v) => num(v) }, { key: "coveragePercent", label: "التغطية", format: (v) => `${num(v)}%` }
  ]});
  ReportUI.renderNotes("warningResult", [...(report.notes || []), ...(report.warnings || []).map((item) => item.message || item.type || item.code)]);
}

async function exportFeasibilityExcel() {
  const payload = buildPayload();
  const button = document.getElementById("exportFeasibilityExcel");
  button.disabled = true; button.textContent = "جاري التصدير...";
  try {
    const response = await fetch(`${API_BASE_URL}/forecast-planning/feasibility/export/excel`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}` }, body: JSON.stringify(payload)
    });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "فشل تصدير Excel"); }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `forecast-feasibility-${payload.forecastMonth}.xlsx`; link.click(); URL.revokeObjectURL(url);
  } catch (error) { setFeasibilityStatus(error.message, "danger"); }
  finally { button.disabled = false; button.textContent = "تصدير Excel"; }
}
