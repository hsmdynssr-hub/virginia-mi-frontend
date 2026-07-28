"use strict";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function numberText(value, digits = 2) {
  const parsedNumber = Number(value ?? 0);
  const parsedDigits = Number(digits);
  const safeNumber = Number.isFinite(parsedNumber) ? parsedNumber : 0;
  const safeDigits = Number.isInteger(parsedDigits) && parsedDigits >= 0 && parsedDigits <= 20
    ? parsedDigits
    : 2;

  return safeNumber.toLocaleString("ar-EG", {
    minimumFractionDigits: safeDigits,
    maximumFractionDigits: safeDigits
  });
}

function integerText(value) {
  return numberText(value, 0);
}

function percentText(value) {
  return `${numberText(value, 2)}%`;
}

function monthLabel(value) {
  const date = new Date(`${String(value || "").slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);

  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long"
  });
}

function comparisonText(metric = {}) {
  const value = Number(metric.changePercent || 0);
  const cssClass = value >= 0
    ? "cost-comparison-positive"
    : "cost-comparison-negative";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "•";

  return `<span class="${cssClass}">${arrow} ${percentText(Math.abs(value))}</span>`;
}


function kpiValueWithComparison(value, metric = {}) {
  return `${numberText(value)}<small style="display:block;margin-top:6px">${comparisonText(metric)} عن العام السابق</small>`;
}

function getCurrentUserSafe() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch (_error) {
    return {};
  }
}

function canManageCostSettings() {
  const user = getCurrentUserSafe();
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const roles = Array.isArray(user.roles) ? user.roles : [];

  return (
    ["admin", "super_admin", "owner"].includes(String(user.role || "").toLowerCase()) ||
    permissions.includes("*") ||
    permissions.includes("costing.settings") ||
    roles.some((role) => ["admin", "super_admin", "owner"].includes(
      String(role?.code || role || "").toLowerCase()
    ))
  );
}

renderLayout(
  "مراقبة التكاليف ونقطة التعادل",
  "متابعة المبيعات والتكلفة والربحية ونقطة التعادل يوميًا وشهريًا من بيانات نقاط البيع المحفوظة محليًا",
  "costing-overview",
  `
    <section class="cost-filter-panel">
      <div class="cost-filter-grid">
        <label class="cost-field">
          <span>الفرع / منفذ البيع</span>
          <select id="branchCode">
            <option value="all">كل الفروع</option>
          </select>
        </label>
        <div class="cost-actions">
          <span id="costDataSourceHint" class="cost-subtitle">
            التقرير يعتمد على مخزن بيانات POS المحلي.
          </span>
        </div>
      </div>
    </section>

    <section class="cost-settings-panel" id="costSettingsPanel">
      <h3>إعدادات نقطة التعادل الشهرية</h3>
      <p class="cost-subtitle">
        التكاليف الثابتة شهرية، والمصاريف المتغيرة الإضافية نسبة من صافي المبيعات بخلاف تكلفة البضاعة المباعة.
      </p>
      <div class="cost-settings-grid">
        <label class="cost-field">
          <span>الشهر</span>
          <input id="settingsMonth" type="month" />
        </label>
        <label class="cost-field">
          <span>نطاق الإعداد</span>
          <select id="settingsBranchCode">
            <option value="all">الشركة بالكامل</option>
          </select>
        </label>
        <label class="cost-field">
          <span>التكاليف الثابتة الشهرية</span>
          <input id="monthlyFixedCost" type="number" min="0" step="0.01" value="0" />
        </label>
        <label class="cost-field">
          <span>مصاريف متغيرة إضافية %</span>
          <input id="variableExpensePercent" type="number" min="0" max="100" step="0.01" value="0" />
        </label>
        <label class="cost-field">
          <span>الربح المستهدف الشهري</span>
          <input id="targetProfit" type="number" min="0" step="0.01" value="0" />
        </label>
        <label class="cost-field">
          <span>ملاحظات</span>
          <textarea id="costSettingsNotes" maxlength="2000"></textarea>
        </label>
        <div class="cost-actions">
          <button id="saveCostSettingsBtn" class="cost-btn" type="button">حفظ الإعدادات</button>
        </div>
      </div>
      <div id="costSettingsMessage" class="settings-note"></div>
    </section>

    <div id="reportArea">
      <div class="report-panel">
        <h3>التقرير لم يتم تحميله بعد</h3>
        <p>اختر الشركة والفترة ثم اضغط <strong>تحديث التقرير</strong>.</p>
      </div>
    </div>
  `
);

const state = {
  branchOptions: [],
  scope: null,
  report: null
};

function setDefaultSettingsMonth() {
  const today = new Date();
  document.getElementById("settingsMonth").value =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function renderBranchOptions(options = [], scope = null) {
  state.branchOptions = options;
  state.scope = scope;

  const reportSelect = document.getElementById("branchCode");
  const settingsSelect = document.getElementById("settingsBranchCode");
  const currentReportValue = reportSelect.value || "all";
  const currentSettingsValue = settingsSelect.value || "all";
  const unrestricted = scope?.unrestricted !== false;

  const html = options.map((item) => `
    <option value="${escapeHtml(item.branchCode)}">
      ${escapeHtml(item.branchName)}
    </option>
  `).join("");

  reportSelect.innerHTML = `<option value="all">${unrestricted ? "كل الفروع" : "كل الفروع المسموحة"}</option>${html}`;
  settingsSelect.innerHTML = `${unrestricted ? '<option value="all">الشركة بالكامل</option>' : ""}${html}`;

  reportSelect.value = options.some((item) => item.branchCode === currentReportValue)
    ? currentReportValue
    : "all";

  const availableSettingValues = Array.from(settingsSelect.options).map((option) => option.value);
  settingsSelect.value = availableSettingValues.includes(currentSettingsValue)
    ? currentSettingsValue
    : availableSettingValues[0] || "";
}

function renderWarnings(warnings = []) {
  if (!warnings.length) return "";

  return `
    <div class="cost-warning-list">
      ${warnings.map((item) => `
        <div class="cost-warning">${escapeHtml(item.message || item)}</div>
      `).join("")}
    </div>
  `;
}

function renderBreakEven(data = {}) {
  return renderPanel("نقطة التعادل وهامش الأمان", `
    <div class="break-even-grid">
      <div class="break-even-item">
        <span>مبيعات نقطة التعادل</span>
        <strong>${numberText(data.breakEvenSales)}</strong>
      </div>
      <div class="break-even-item">
        <span>وحدات نقطة التعادل</span>
        <strong>${numberText(data.breakEvenUnits)}</strong>
      </div>
      <div class="break-even-item">
        <span>نسبة هامش المساهمة</span>
        <strong>${percentText(data.contributionMarginRatio)}</strong>
      </div>
      <div class="break-even-item">
        <span>هامش الأمان</span>
        <strong>${numberText(data.marginOfSafety)}</strong>
      </div>
      <div class="break-even-item">
        <span>نسبة هامش الأمان</span>
        <strong>${percentText(data.marginOfSafetyPercent)}</strong>
      </div>
      <div class="break-even-item">
        <span>مبيعات الربح المستهدف</span>
        <strong>${numberText(data.targetSales)}</strong>
      </div>
    </div>
    <div class="break-even-status ${escapeHtml(data.status || "not_configured")}">
      ${escapeHtml(data.statusLabel || "-")}
    </div>
  `);
}

function renderReport(report = {}) {
  const data = report.data || {};
  const summary = data.summary || {};
  const comparison = data.comparison || {};

  const dailyTable = renderTable([
    { key: "periodStart", label: "التاريخ" },
    { key: "ordersCount", label: "الفواتير", format: integerText },
    { key: "netSales", label: "صافي المبيعات", format: numberText },
    { key: "costOfSales", label: "تكلفة المبيعات", format: numberText },
    { key: "grossProfit", label: "مجمل الربح", format: numberText },
    { key: "fixedCosts", label: "تكاليف ثابتة", format: numberText },
    { key: "variableOperatingCost", label: "مصاريف متغيرة", format: numberText },
    { key: "operatingResult", label: "نتيجة التشغيل", format: numberText }
  ], data.daily || []);

  const monthlyTable = renderTable([
    { key: "periodStart", label: "الشهر", format: monthLabel },
    { key: "ordersCount", label: "الفواتير", format: integerText },
    { key: "grossSales", label: "إجمالي المبيعات", format: numberText },
    { key: "returnsValue", label: "المرتجعات", format: numberText },
    { key: "netSales", label: "صافي المبيعات", format: numberText },
    { key: "costOfSales", label: "تكلفة المبيعات", format: numberText },
    { key: "grossProfit", label: "مجمل الربح", format: numberText },
    { key: "grossMarginPercent", label: "هامش الربح", format: percentText },
    { key: "operatingResult", label: "نتيجة التشغيل", format: numberText }
  ], data.monthly || []);

  const branchesTable = renderTable([
    { key: "branchName", label: "الفرع" },
    { key: "ordersCount", label: "الفواتير", format: integerText },
    { key: "netSales", label: "صافي المبيعات", format: numberText },
    { key: "costOfSales", label: "تكلفة المبيعات", format: numberText },
    { key: "grossProfit", label: "مجمل الربح", format: numberText },
    { key: "grossMarginPercent", label: "هامش الربح", format: percentText },
    { key: "fixedCosts", label: "التكاليف الثابتة", format: numberText },
    { key: "operatingResult", label: "نتيجة التشغيل", format: numberText }
  ], data.branches || []);

  const productsTable = renderTable([
    { key: "productName", label: "المنتج" },
    { key: "quantity", label: "الكمية", format: (value) => numberText(value, 3) },
    { key: "netSales", label: "صافي المبيعات", format: numberText },
    { key: "costOfSales", label: "تكلفة المبيعات", format: numberText },
    { key: "grossProfit", label: "مجمل الربح", format: numberText },
    { key: "grossMarginPercent", label: "هامش الربح", format: percentText }
  ], data.products || []);

  document.getElementById("reportArea").innerHTML = `
    ${renderWarnings(report.warnings || [])}

    ${renderKpis([
      kpiCard("إجمالي المبيعات", numberText(summary.grossSales), "المبيعات الموجبة قبل خصم المرتجعات."),
      kpiCard("صافي المبيعات", kpiValueWithComparison(summary.netSales, comparison.netSales), "مقارنة بنفس الفترة من العام السابق."),
      kpiCard("تكلفة البضاعة المباعة", kpiValueWithComparison(summary.costOfSales, comparison.costOfSales), "مقارنة بنفس الفترة من العام السابق."),
      kpiCard("مجمل الربح", kpiValueWithComparison(summary.grossProfit, comparison.grossProfit), "مقارنة بنفس الفترة من العام السابق.")
    ])}

    ${renderKpis([
      kpiCard("هامش مجمل الربح", percentText(summary.grossMarginPercent), "مجمل الربح ÷ صافي المبيعات."),
      kpiCard("التكاليف الثابتة", numberText(summary.fixedCosts), "التكاليف الشهرية بعد توزيعها على الفترة."),
      kpiCard("هامش المساهمة", numberText(summary.contributionMargin), percentText(summary.contributionMarginPercent)),
      kpiCard("نتيجة التشغيل", kpiValueWithComparison(summary.operatingResult, comparison.operatingResult), "مقارنة بنفس الفترة من العام السابق.")
    ])}

    ${renderBreakEven(data.breakEven || {})}

    <div class="cost-section-tabs">
      <button class="cost-tab-btn active" data-cost-tab="monthly" type="button">التقرير الشهري</button>
      <button class="cost-tab-btn" data-cost-tab="daily" type="button">التقرير اليومي</button>
      <button class="cost-tab-btn" data-cost-tab="branches" type="button">ربحية الفروع</button>
      <button class="cost-tab-btn" data-cost-tab="products" type="button">ربحية المنتجات</button>
    </div>

    <div class="cost-tab-panel" data-cost-panel="monthly">
      ${renderPanel("ملخص التكلفة الشهري", monthlyTable)}
    </div>
    <div class="cost-tab-panel" data-cost-panel="daily" hidden>
      ${renderPanel("متابعة التكلفة اليومية", dailyTable)}
    </div>
    <div class="cost-tab-panel" data-cost-panel="branches" hidden>
      ${renderPanel("ربحية الفروع ومنافذ البيع", branchesTable)}
    </div>
    <div class="cost-tab-panel" data-cost-panel="products" hidden>
      ${renderPanel("ربحية المنتجات", productsTable)}
    </div>
  `;

  setupCostTabs();
}

function setupCostTabs() {
  document.querySelectorAll("[data-cost-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.costTab;

      document.querySelectorAll("[data-cost-tab]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      document.querySelectorAll("[data-cost-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.costPanel !== target;
      });
    });
  });
}

async function loadCostSettings() {
  const companyId = document.getElementById("companySelect")?.value;
  const month = document.getElementById("settingsMonth")?.value;
  const branchCode = document.getElementById("settingsBranchCode")?.value || "all";
  const message = document.getElementById("costSettingsMessage");

  if (!companyId || !month) {
    message.textContent = "اختر الشركة والشهر لعرض الإعدادات.";
    return;
  }

  try {
    message.textContent = "جاري تحميل الإعدادات...";
    const response = await apiGet("/costing/settings", {
      companyId,
      branchCode,
      month: `${month}-01`
    });
    const setting = response.data || {};

    document.getElementById("monthlyFixedCost").value = Number(setting.monthlyFixedCost || 0);
    document.getElementById("variableExpensePercent").value = Number(setting.variableExpensePercent || 0);
    document.getElementById("targetProfit").value = Number(setting.targetProfit || 0);
    document.getElementById("costSettingsNotes").value = setting.notes || "";
    message.textContent = setting.updatedAt
      ? `آخر تحديث: ${new Date(setting.updatedAt).toLocaleString("ar-EG")}`
      : "لا توجد إعدادات محفوظة لهذا الشهر والنطاق.";
  } catch (error) {
    message.textContent = error.message;
  }
}

async function saveCostSettings() {
  const button = document.getElementById("saveCostSettingsBtn");
  const message = document.getElementById("costSettingsMessage");
  const companyId = document.getElementById("companySelect")?.value;
  const month = document.getElementById("settingsMonth")?.value;

  if (!companyId) {
    message.textContent = "اختر الشركة أولًا.";
    return;
  }

  if (!month) {
    message.textContent = "اختر الشهر.";
    return;
  }

  try {
    button.disabled = true;
    message.textContent = "جاري حفظ الإعدادات...";

    await apiPost("/costing/settings", {
      companyId,
      branchCode: document.getElementById("settingsBranchCode").value || "all",
      month: `${month}-01`,
      monthlyFixedCost: Number(document.getElementById("monthlyFixedCost").value || 0),
      variableExpensePercent: Number(document.getElementById("variableExpensePercent").value || 0),
      targetProfit: Number(document.getElementById("targetProfit").value || 0),
      notes: document.getElementById("costSettingsNotes").value || ""
    });

    message.textContent = "تم حفظ الإعدادات بنجاح.";
    await loadCostReport();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = !canManageCostSettings();
  }
}

async function loadCostReport() {
  const companyId = document.getElementById("companySelect")?.value;

  if (!companyId) {
    showError(new Error("اختر الشركة أولًا."));
    return;
  }

  try {
    showLoading();

    const response = await apiGet("/costing/overview", {
      ...getFilters(),
      branchCode: document.getElementById("branchCode")?.value || "all",
      productLimit: 3000,
      uiProductLimit: 100
    });

    const report = response.data || {};
    state.report = report;
    renderBranchOptions(report.branchOptions || [], report.scope || null);
    renderReport(report);
    await loadCostSettings();
  } catch (error) {
    showError(error);
  }
}

function markFiltersChanged() {
  const reportArea = document.getElementById("reportArea");
  if (!state.report || !reportArea) return;

  reportArea.innerHTML = `
    <div class="report-panel">
      <h3>تم تغيير الفلاتر</h3>
      <p>اضغط <strong>تحديث التقرير</strong> لتطبيق الاختيارات الجديدة.</p>
    </div>
  `;
}

setDefaultSettingsMonth();

const manageSettings = canManageCostSettings();
document.getElementById("saveCostSettingsBtn").disabled = !manageSettings;
if (!manageSettings) {
  document.getElementById("costSettingsMessage").textContent =
    "لديك صلاحية عرض الإعدادات فقط، والحفظ يحتاج صلاحية إدارة إعدادات التكلفة.";
}

document.getElementById("loadBtn")?.addEventListener("click", loadCostReport);
document.getElementById("saveCostSettingsBtn")?.addEventListener("click", saveCostSettings);
document.getElementById("branchCode")?.addEventListener("change", () => {
  const value = document.getElementById("branchCode").value || "all";
  setBranchCode(value);

  const settingsSelect = document.getElementById("settingsBranchCode");
  const settingValues = Array.from(settingsSelect.options).map((option) => option.value);
  if (settingValues.includes(value)) {
    settingsSelect.value = value;
    loadCostSettings();
  }

  markFiltersChanged();
});
document.getElementById("settingsBranchCode")?.addEventListener("change", loadCostSettings);
document.getElementById("settingsMonth")?.addEventListener("change", loadCostSettings);
document.getElementById("dateFrom")?.addEventListener("change", markFiltersChanged);
document.getElementById("dateTo")?.addEventListener("change", markFiltersChanged);

window.addEventListener("company-context-changed", () => {
  state.report = null;
  renderBranchOptions([], null);
  document.getElementById("costSettingsMessage").textContent =
    "حدّث التقرير أولًا لتحميل الفروع المسموحة وإعداداتها.";
  markFiltersChanged();
});
