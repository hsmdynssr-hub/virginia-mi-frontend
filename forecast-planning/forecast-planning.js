const FORECAST_PLANNING_PAGE = "forecast-planning-achievement";

const MONTH_NAMES = {
  1: "Jan",
  2: "Feb",
  3: "Mar",
  4: "Apr",
  5: "May",
  6: "Jun",
  7: "Jul",
  8: "Aug",
  9: "Sep",
  10: "Oct",
  11: "Nov",
  12: "Dec"
};

function fpEl(id) {
  return document.getElementById(id);
}

function fpNumber(value, digits = 0) {
  const num = Number(value || 0);

  return num.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function fpMoney(value) {
  return fpNumber(value, 2);
}

function fpPercent(value) {
  return `${fpNumber(value, 2)}%`;
}

function fpSafeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function fpGetToken() {
  if (typeof getAuthToken === "function") {
    return getAuthToken();
  }

  return localStorage.getItem("token") || "";
}

function fpGetApiBaseUrl() {
  if (typeof API_BASE_URL !== "undefined" && API_BASE_URL) {
    return API_BASE_URL;
  }

  return window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
    ? "http://localhost:5050/api"
    : "https://odoo-mi-api.vercel.app/api";
}

function fpGetCompanyId() {
  const companySelect = fpEl("companySelect");

  if (!companySelect) {
    return "";
  }

  const directValue = String(companySelect.value || "").trim();

  if (directValue) {
    return directValue;
  }

  const selectedOption = companySelect.options?.[companySelect.selectedIndex];
  const selectedText = String(selectedOption?.textContent || "").trim();

  if (selectedText.includes("فيرجينيا")) {
    return "1";
  }

  if (selectedText.includes("كليوباترا")) {
    return "2";
  }

  return "";
}

function fpRequireCompany() {
  const companyId = fpGetCompanyId();

  if (!companyId) {
    fpSetStatus("error", "اختر الشركة أولًا من أعلى الصفحة قبل تنفيذ أي عملية.");
    alert("اختر الشركة أولًا من أعلى الصفحة.");
    return "";
  }

  return companyId;
}

function fpSetStatus(type, message) {
  const status = fpEl("forecastPlanningStatus");

  if (!status) {
    alert(message || "لا يوجد مكان لعرض الرسالة داخل الصفحة.");
    return;
  }

  status.className = `fp-status ${type || "info"}`;
  status.textContent = message || "";
}

function fpClearStatus() {
  const status = fpEl("forecastPlanningStatus");

  if (!status) return;

  status.className = "fp-status";
  status.textContent = "";
}

function fpShowDebug(data) {
  const box = fpEl("forecastPlanningDebug");

  if (!box) return;

  box.style.display = "block";
  box.textContent = typeof data === "string"
    ? data
    : JSON.stringify(data, null, 2);
}

function fpHideDebug() {
  const box = fpEl("forecastPlanningDebug");

  if (!box) return;

  box.style.display = "none";
  box.textContent = "";
}

function fpSetButtonLoading(buttonId, isLoading, loadingText, normalText) {
  const button = fpEl(buttonId);

  if (!button) return;

  button.disabled = Boolean(isLoading);
  button.textContent = isLoading ? loadingText : normalText;
}

function fpGetFilenameFromDisposition(headerValue) {
  if (!headerValue) return "";

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const normalMatch = headerValue.match(/filename="?([^"]+)"?/i);
  if (normalMatch?.[1]) {
    return normalMatch[1];
  }

  return "";
}

async function fpReadResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text
    };
  }
}

async function fpRequestJson(url, options = {}) {
  const token = fpGetToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  const data = await fpReadResponse(response);

  if (!response.ok || data?.success === false) {
    const error = new Error(
      data?.message ||
      data?.odooFault ||
      data?.raw ||
      `Request failed with status ${response.status}`
    );

    error.response = data;
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

function fpBuildAchievementParams() {
  const params = new URLSearchParams();

  params.set("companyId", fpGetCompanyId());
  params.set("year", fpEl("year")?.value || "2026");
  params.set("monthFrom", fpEl("monthFrom")?.value || "4");
  params.set("monthTo", fpEl("monthTo")?.value || "12");
  params.set("channelType", fpEl("channelType")?.value || "all");

  const channelName = fpEl("channelName")?.value?.trim();
  if (channelName) params.set("channelName", channelName);

  const productGroup = fpEl("productGroup")?.value?.trim();
  if (productGroup) params.set("productGroup", productGroup);

  const itemNo = fpEl("itemNo")?.value?.trim();
  if (itemNo) params.set("itemNo", itemNo);

  return params;
}

function fpSafeKpiCard(label, value) {
  if (typeof kpiCard === "function") {
    return kpiCard(label, value);
  }

  return `
    <div class="card">
      <span class="card-label">${label}</span>
      <strong>${value ?? "-"}</strong>
    </div>
  `;
}

function fpRenderSummary(summary = {}) {
  const cards = [
    { label: "Target Qty", value: fpNumber(summary.targetQty) },
    { label: "Actual Qty", value: fpNumber(summary.actualQty) },
    { label: "Achievement %", value: fpPercent(summary.achievementPercent) },
    { label: "Remaining Qty", value: fpNumber(summary.remainingQty) },
    { label: "Target Value", value: fpMoney(summary.targetValue) },
    { label: "Actual Value", value: fpMoney(summary.actualValue) },
    { label: "Remaining Value", value: fpMoney(summary.remainingValue) }
  ];

  const html = cards.map((card) => fpSafeKpiCard(card.label, card.value));

  if (typeof renderKpis === "function") {
    fpEl("forecastPlanningKpis").innerHTML = renderKpis(html);
    return;
  }

  fpEl("forecastPlanningKpis").innerHTML = `
    <div class="cards-grid">
      ${html.join("")}
    </div>
  `;
}

function fpRenderRowsFallback(columns, rows) {
  if (!rows.length) {
    return `<div class="empty">لا توجد بيانات حسب الفلاتر الحالية.</div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            ${columns.map((column) => `<th>${column.label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              ${columns.map((column) => {
                const rawValue = row[column.key];
                const value = column.format
                  ? column.format(rawValue, row)
                  : rawValue;

                return `<td>${value ?? ""}</td>`;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function fpRenderRows(rows = []) {
  const columns = [
    { key: "month", label: "الشهر", format: (value) => MONTH_NAMES[value] || value || "-" },
    { key: "channel_type", label: "نوع القناة" },
    { key: "channel_name", label: "القناة" },
    { key: "item_no", label: "Item Code" },
    { key: "item_description", label: "اسم الصنف" },
    { key: "unit", label: "الوحدة" },
    { key: "product_type", label: "نوع المنتج" },
    { key: "product_group", label: "مجموعة المنتج" },
    { key: "direction", label: "Direction" },
    { key: "target_qty", label: "Target Qty", format: (value) => fpNumber(value) },
    { key: "actual_qty", label: "Actual Qty", format: (value) => fpNumber(value) },
    { key: "achievement_percent", label: "Achievement %", format: (value) => fpPercent(value) },
    { key: "remaining_qty", label: "Remaining Qty", format: (value) => fpNumber(value) },
    { key: "target_value", label: "Target Value", format: (value) => fpMoney(value) },
    { key: "actual_value", label: "Actual Value", format: (value) => fpMoney(value) },
    { key: "remaining_value", label: "Remaining Value", format: (value) => fpMoney(value) }
  ];

  fpEl("forecastPlanningRowsCount").textContent = `${fpNumber(rows.length)} صف`;

  if (typeof renderTable === "function") {
    fpEl("reportArea").innerHTML = renderTable(columns, rows);
    return;
  }

  fpEl("reportArea").innerHTML = fpRenderRowsFallback(columns, rows);
}

function fpRenderEmpty() {
  fpRenderSummary({
    targetQty: 0,
    actualQty: 0,
    achievementPercent: 0,
    remainingQty: 0,
    targetValue: 0,
    actualValue: 0,
    remainingValue: 0
  });

  fpEl("forecastPlanningRowsCount").textContent = "0 صف";

  fpEl("reportArea").innerHTML = `
    <div class="empty">
      اختر الشركة ثم اضغط "تحميل التقرير". لا يتم تحميل أي بيانات تلقائيًا.
    </div>
  `;
}

async function fpHealthCheck() {
  fpClearStatus();
  fpHideDebug();

  const url = `${fpGetApiBaseUrl()}/forecast-planning/health`;

  try {
    fpSetStatus("info", "جاري اختبار الاتصال بالموديول...");
    const data = await fpRequestJson(url);
    fpSetStatus("ok", "الاتصال بالموديول يعمل ✅");
    fpShowDebug(data);
  } catch (error) {
    fpSetStatus("error", `فشل اختبار الاتصال: ${error.message}`);
    fpShowDebug(error.response || error.message);
  }
}

async function fpLoadReport() {
  const companyId = fpRequireCompany();
  if (!companyId) return;

  fpClearStatus();
  fpHideDebug();
  fpSetButtonLoading("loadForecastPlanningBtn", true, "جاري التحميل...", "تحميل التقرير");

  try {
    if (typeof showLoading === "function") {
      showLoading("reportArea");
    } else {
      fpEl("reportArea").innerHTML = `<div class="empty">جاري تحميل التقرير...</div>`;
    }

    const params = fpBuildAchievementParams();
    const url = `${fpGetApiBaseUrl()}/forecast-planning/achievement?${params.toString()}`;
    const data = await fpRequestJson(url);
    const rows = data.data?.rows || [];
    const summary = data.data?.summary || {};

    fpRenderSummary(summary);
    fpRenderRows(rows);
    fpShowDebug({
      filters: data.filters || {},
      summary,
      rowsCount: rows.length,
      firstRow: rows[0] || null
    });

    if (!rows.length) {
      fpSetStatus(
        "warn",
        [
          "التقرير رجع 0 صف.",
          "جرّب: Channel Type = كل القنوات، Month From = April، Month To = December.",
          "لو مازال 0، راجع الاستيراد أو السنة/الشركة."
        ].join("\n")
      );
      return;
    }

    fpSetStatus("ok", `تم تحميل التقرير بنجاح. عدد الصفوف: ${rows.length}`);
  } catch (error) {
    if (typeof showError === "function") {
      showError(error, "reportArea");
    } else {
      fpEl("reportArea").innerHTML = `<div class="error-box">${error.message}</div>`;
    }

    fpSetStatus("error", error.message);
    fpShowDebug(error.response || error.message);
  } finally {
    fpSetButtonLoading("loadForecastPlanningBtn", false, "جاري التحميل...", "تحميل التقرير");
  }
}

async function fpImportForecast() {
  const companyId = fpRequireCompany();
  if (!companyId) return;

  const file = fpEl("forecastFile")?.files?.[0];

  if (!file) {
    fpSetStatus("error", "اختار ملف الفوركاست Excel أولًا.");
    alert("اختار ملف الفوركاست Excel أولًا.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("companyId", companyId);
  formData.append("year", fpEl("year")?.value || "2026");
  formData.append("planName", fpEl("planName")?.value || "Forecast Plan");

  try {
    fpClearStatus();
    fpHideDebug();
    fpSetStatus("info", "جاري رفع ملف الفوركاست ومعالجته...");
    fpSetButtonLoading("importForecastBtn", true, "جاري الاستيراد...", "استيراد الفوركاست");

    const token = fpGetToken();
    const response = await fetch(`${fpGetApiBaseUrl()}/forecast-planning/import-forecast`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    });

    const data = await fpReadResponse(response);

    if (!response.ok || data?.success === false) {
      const error = new Error(
        data?.message ||
        data?.odooFault ||
        data?.raw ||
        "فشل استيراد ملف الفوركاست"
      );
      error.response = data;
      throw error;
    }

    fpRenderEmpty();

    const importedLines = Number(data.data?.importedLinesCount || 0);

    fpSetStatus(
      importedLines > 0 ? "ok" : "warn",
      [
        importedLines > 0 ? "تم استيراد الفوركاست بنجاح ✅" : "الاستيراد تم لكن Imported Lines = 0 ⚠️",
        `Imported Lines: ${importedLines}`,
        `Plan ID: ${data.data?.plan?.id || "-"}`,
        "اضغط تحميل التقرير بعد الاستيراد."
      ].join("\n")
    );

    fpShowDebug(data);
  } catch (error) {
    fpSetStatus("error", `فشل الاستيراد: ${error.message}`);
    fpShowDebug(error.response || error.message);
  } finally {
    fpSetButtonLoading("importForecastBtn", false, "جاري الاستيراد...", "استيراد الفوركاست");
  }
}

async function fpSyncOdooActuals() {
  const companyId = fpRequireCompany();
  if (!companyId) return;

  try {
    fpClearStatus();
    fpHideDebug();
    fpSetStatus("info", "جاري مزامنة مبيعات Odoo...");
    fpSetButtonLoading("syncOdooActualsBtn", true, "جاري المزامنة...", "مزامنة مبيعات Odoo");

    const body = {
      companyId: Number(companyId),
      year: fpEl("year")?.value || "2026",
      monthFrom: fpEl("monthFrom")?.value || "4",
      monthTo: fpEl("monthTo")?.value || "12",
      includeSaleOrders: true,
      includePosOrders: true,
      limit: 5000,
      linesLimit: 50000
    };

    const data = await fpRequestJson(
      `${fpGetApiBaseUrl()}/forecast-planning/sync-odoo-actuals`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    fpRenderEmpty();
    fpSetStatus(
      "ok",
      [
        "تمت مزامنة مبيعات Odoo بنجاح.",
        `Inserted Rows: ${data.insertedRowsCount || 0}`,
        `Sale Orders: ${data.fetched?.saleOrders || 0}`,
        `POS Orders: ${data.fetched?.posOrders || 0}`,
        "اضغط تحميل التقرير لعرض البيانات."
      ].join("\n")
    );
    fpShowDebug(data);
  } catch (error) {
    fpSetStatus("error", `فشل مزامنة Odoo: ${error.message}`);
    fpShowDebug(error.response || error.message);
  } finally {
    fpSetButtonLoading("syncOdooActualsBtn", false, "جاري المزامنة...", "مزامنة مبيعات Odoo");
  }
}

async function fpExportExcel() {
  const companyId = fpRequireCompany();
  if (!companyId) return;

  fpClearStatus();
  fpHideDebug();
  fpSetStatus("info", "جاري تجهيز ملف Excel...");
  fpSetButtonLoading("exportExcelBtn", true, "جاري التصدير...", "⬇ Export Excel");

  try {
    const params = fpBuildAchievementParams();
    params.set("report", "forecast_planning.achievement");

    const token = fpGetToken();
    const response = await fetch(`${fpGetApiBaseUrl()}/exports/excel?${params.toString()}`, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    if (!response.ok) {
      const data = await fpReadResponse(response);
      const error = new Error(
        data?.message ||
        data?.odooFault ||
        data?.raw ||
        "فشل تصدير Excel"
      );
      error.response = data;
      throw error;
    }

    const blob = await response.blob();
    const filename = fpGetFilenameFromDisposition(
      response.headers.get("Content-Disposition")
    ) || `forecast-planning-${params.get("year")}.xlsx`;

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    fpSetStatus("ok", `تم تصدير Excel بنجاح: ${filename}`);
  } catch (error) {
    fpSetStatus("error", `فشل تصدير Excel: ${error.message}`);
    fpShowDebug(error.response || error.message);
  } finally {
    fpSetButtonLoading("exportExcelBtn", false, "جاري التصدير...", "⬇ Export Excel");
  }
}

function fpClearFilters() {
  fpEl("year").value = "2026";
  fpEl("monthFrom").value = "4";
  fpEl("monthTo").value = "12";
  fpEl("channelType").value = "all";
  fpEl("channelName").value = "";
  fpEl("productGroup").value = "";
  fpEl("itemNo").value = "";

  fpHideDebug();
  fpClearStatus();
  fpRenderEmpty();
}

function fpBuildPageContent() {
  return `
    <div class="forecast-planning-page">
      <section class="panel fp-panel">
        <div class="fp-panel-header">
          <div>
            <h3>فلاتر تحقق الفوركاست</h3>
            <p>اختر الشركة من أعلى الصفحة، ثم اضبط السنة والشهور والقناة واضغط تحميل التقرير. لا يوجد تحميل تلقائي.</p>
          </div>
          <span class="fp-badge">V1 Forecast Achievement</span>
        </div>

        <div class="fp-filter-grid">
          <div class="fp-filter-field">
            <label for="year">السنة</label>
            <input id="year" class="control" type="number" value="2026" />
          </div>

          <div class="fp-filter-field">
            <label for="monthFrom">من شهر</label>
            <select id="monthFrom" class="control">
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>

          <div class="fp-filter-field">
            <label for="monthTo">إلى شهر</label>
            <select id="monthTo" class="control">
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12" selected>December</option>
            </select>
          </div>

          <div class="fp-filter-field">
            <label for="channelType">نوع القناة</label>
            <select id="channelType" class="control">
              <option value="all">كل القنوات</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div class="fp-filter-field">
            <label for="channelName">اسم القناة</label>
            <input id="channelName" class="control" type="text" placeholder="Online / Sahel / Matrouh" />
          </div>

          <div class="fp-filter-field">
            <label for="productGroup">مجموعة المنتج</label>
            <input id="productGroup" class="control" type="text" placeholder="اختياري" />
          </div>

          <div class="fp-filter-field">
            <label for="itemNo">Item Code</label>
            <input id="itemNo" class="control" type="text" placeholder="اختياري" />
          </div>
        </div>

        <div class="fp-actions-row">
          <button type="button" id="loadForecastPlanningBtn" class="fp-action-btn fp-action-primary">تحميل التقرير</button>
          <button type="button" id="syncOdooActualsBtn" class="fp-action-btn fp-action-sync">مزامنة مبيعات Odoo</button>
          <button type="button" id="exportExcelBtn" class="fp-action-btn fp-action-export">⬇ Export Excel</button>
          <button type="button" id="clearForecastPlanningBtn" class="fp-action-btn fp-action-light">مسح الفلاتر</button>
          <button type="button" id="healthForecastPlanningBtn" class="fp-action-btn fp-action-light">اختبار الاتصال</button>
        </div>

        <div class="fp-import-box">
          <div class="fp-panel-header" style="margin-bottom:12px">
            <div>
              <h3>استيراد ملف فوركاست جديد</h3>
              <p>استخدمه فقط عند رفع خطة جديدة. بعد الاستيراد اضغط تحميل التقرير يدويًا.</p>
            </div>
          </div>

          <div class="fp-import-row">
            <div class="fp-filter-field">
              <label>ملف Excel</label>
              <input id="forecastFile" class="fp-file-input" type="file" accept=".xlsx,.xls" />
              <label for="forecastFile" class="fp-file-label">📎 اختر ملف Excel</label>
              <span id="forecastFileName" class="fp-file-name">لم يتم اختيار ملف</span>
            </div>

            <div class="fp-filter-field">
              <label for="planName">اسم الخطة</label>
              <input id="planName" class="control" type="text" value="Forecast 2026 V1" placeholder="اسم الخطة" />
            </div>

            <button type="button" id="importForecastBtn" class="fp-action-btn fp-action-import">استيراد الفوركاست</button>
          </div>
        </div>

        <div id="forecastPlanningStatus" class="fp-status"></div>
        <pre id="forecastPlanningDebug" class="fp-debug"></pre>
      </section>

      <section id="forecastPlanningKpis"></section>

      <section class="panel fp-table-panel">
        <div class="panel-title">
          <h3>تفاصيل تحقق الفوركاست</h3>
          <p id="forecastPlanningRowsCount">0 صف</p>
        </div>

        <div id="reportArea"></div>
      </section>
    </div>
  `;
}

function fpBindEvents() {
  fpEl("healthForecastPlanningBtn")?.addEventListener("click", fpHealthCheck);
  fpEl("importForecastBtn")?.addEventListener("click", fpImportForecast);
  fpEl("syncOdooActualsBtn")?.addEventListener("click", fpSyncOdooActuals);
  fpEl("loadForecastPlanningBtn")?.addEventListener("click", fpLoadReport);
  fpEl("clearForecastPlanningBtn")?.addEventListener("click", fpClearFilters);
  fpEl("exportExcelBtn")?.addEventListener("click", fpExportExcel);

  fpEl("forecastFile")?.addEventListener("change", () => {
    const file = fpEl("forecastFile")?.files?.[0];
    fpEl("forecastFileName").textContent = file ? file.name : "لم يتم اختيار ملف";
  });

  window.addEventListener("company-context-changed", () => {
    fpRenderEmpty();
    fpSetStatus("info", "تم تغيير الشركة. اضغط تحميل التقرير لعرض البيانات.");
  });
}

function fpBoot() {
  try {
    if (typeof renderLayout !== "function") {
      throw new Error("renderLayout غير موجود. تأكد أن layout.js يتم تحميله قبل forecast-planning.js");
    }

    renderLayout(
      "تحقق الفوركاست والمبيعات الفعلية",
      "مقارنة الخطة بالمبيعات الفعلية حسب القناة والشهر والمنتج",
      FORECAST_PLANNING_PAGE,
      fpBuildPageContent()
    );

    fpBindEvents();
    fpRenderEmpty();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `
      <div style="padding:24px; direction:rtl; font-family:Tahoma,Arial;">
        <h2>خطأ في تشغيل صفحة Forecast Planning</h2>
        <pre style="direction:ltr; text-align:left; background:#111827; color:white; padding:16px; border-radius:12px; white-space:pre-wrap;">${fpSafeText(error.stack || error.message)}</pre>
      </div>
    `;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", fpBoot);
} else {
  fpBoot();
}
