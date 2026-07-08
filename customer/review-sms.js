(function () {
  const DEFAULT_LOCAL_API_BASE = "http://localhost:5050/api/customer/review-sms";

  let selectedRating = null;
  let selectedQueueOrderIds = new Set();
  let lastQueueRows = [];

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;

    if (page === "dashboard") {
      initDashboard();
      return;
    }

    if (page === "queue") {
      initQueuePage();
      return;
    }

    if (page === "followups") {
      initFollowupsPage();
      return;
    }

    if (page === "review") {
      initReviewPage();
    }
  });

  function byId(id) {
    return document.getElementById(id);
  }

  function isLocalFrontend() {
    const host = window.location.hostname;
    const port = window.location.port;

    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      port === "5500"
    );
  }

  function resolveDefaultApiBase() {
    if (isLocalFrontend()) {
      return DEFAULT_LOCAL_API_BASE;
    }

    return `${window.location.origin}/api/customer/review-sms`;
  }

  function getStoredApiBase() {
    return localStorage.getItem("reviewSmsApiBase") || resolveDefaultApiBase();
  }

  function cleanApiBase(value) {
    return String(value || resolveDefaultApiBase()).trim().replace(/\/$/, "");
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();

    let data = null;

    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(
        `Invalid JSON response (${response.status}). ${text.slice(0, 160)}`
      );
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  function formatDate(value) {
    if (!value) return "";

    try {
      return new Date(value).toLocaleString("ar-EG");
    } catch (error) {
      return value;
    }
  }

  function formatMoney(value) {
    const number = Number(value || 0);

    if (!Number.isFinite(number)) return "-";

    return number.toLocaleString("ar-EG", {
      maximumFractionDigits: 2
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function badge(status) {
    const safeStatus = String(status || "pending").replace(/[^\w-]/g, "");
    return `<span class="crsms-badge ${escapeHtml(safeStatus)}">${escapeHtml(status || "pending")}</span>`;
  }

  function getPublicBranchName(rawBranchName) {
    const value = String(rawBranchName || "").toLowerCase();

    if (
      value.includes("coast") ||
      value.includes("الساحل") ||
      value.includes("north")
    ) {
      return "معصرة فيرجينيا الساحل الشمالي";
    }

    if (value.includes("cleopatra") || value.includes("كليوباترا")) {
      return "كليوباترا";
    }

    return "معصرة فيرجينيا مطروح";
  }

  function getRatingLabel(rating) {
    const number = Number(rating);

    if (number === 5) return "😍 راضٍ جدًا";
    if (number === 3) return "😐 محايد";
    if (number === 1) return "😡 غير راضٍ";

    return rating ? `${rating}` : "";
  }

  function getReasonLabel(reason) {
    const map = {
      price_error: "أخطاء في الأسعار أو الحساب",
      crowding_disorganization: "زحمة وعدم تنظيم",
      sales_team: "تعامل فريق المبيعات",
      product_issue: "مشكلة في جودة أو توافر المنتج",
      waiting_time: "انتظار طويل",
      payment_issue: "مشكلة في الدفع",
      delivery_or_pickup: "مشكلة في الاستلام أو التجهيز",
      other: "سبب آخر"
    };

    return map[reason] || reason || "";
  }


  function initFollowupsPage() {
    const apiBaseInput = byId("apiBase");
    const adminKeyInput = byId("adminKey");

    if (apiBaseInput) {
      apiBaseInput.value = getStoredApiBase();
    }

    if (adminKeyInput) {
      adminKeyInput.value = localStorage.getItem("reviewSmsAdminKey") || "";
    }

    document.querySelectorAll("[data-followups-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.followupsAction;

        if (action === "health") loadHealth();
        if (action === "settings") loadSettings();
        if (action === "followups") loadFollowups();
      });
    });

    setStatus("جاهز. اضغط تحديث المتابعات لعرض العملاء الغاضبين.");
    loadHealth();
    loadSettings();
  }

  /* =========================
     Dashboard
  ========================== */

  function initDashboard() {
    const apiBaseInput = byId("apiBase");
    const adminKeyInput = byId("adminKey");

    if (apiBaseInput) {
      apiBaseInput.value = getStoredApiBase();
    }

    if (adminKeyInput) {
      adminKeyInput.value = localStorage.getItem("reviewSmsAdminKey") || "";
    }

    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;

        if (action === "health") loadHealth();
        if (action === "settings") loadSettings();
        if (action === "save-settings") saveSettings();
        if (action === "stats") loadStats();
        if (action === "logs") loadLogs();
        if (action === "followups") loadFollowups();
        if (action === "send-pending") sendPending();
        if (action === "dry-run") scanNow(true);
        if (action === "scan") scanNow(false);
        if (action === "manual-dry-run") manualSend(true);
        if (action === "manual-send") manualSend(false);
        if (action === "refresh-all") refreshAll();
      });
    });

    setStatus("جاهز. اختر الشركة واضغط الزر المطلوب.");
    loadHealth();
    loadSettings();
  }

  function getApiBaseFromDashboard() {
    const value = cleanApiBase(byId("apiBase")?.value);
    localStorage.setItem("reviewSmsApiBase", value);
    return value;
  }

  function getAdminKey() {
    const value = String(byId("adminKey")?.value || "").trim();
    localStorage.setItem("reviewSmsAdminKey", value);
    return value;
  }

  function adminHeaders() {
    return {
      "Content-Type": "application/json",
      "x-admin-key": getAdminKey()
    };
  }

  function setStatus(message) {
    const box = byId("statusBox");
    if (!box) return;

    box.textContent =
      typeof message === "string" ? message : JSON.stringify(message, null, 2);
  }

  function getCompanyIdOrNull() {
    const value = byId("companyId")?.value;
    const number = Number(value);

    if (!value || !Number.isFinite(number) || number <= 0) {
      return null;
    }

    return number;
  }

  function getLimitValue() {
    const value = Number(byId("limit")?.value || 20);

    if (!Number.isFinite(value) || value <= 0) return 20;

    return Math.min(Math.floor(value), 500);
  }

  function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getPresetDateRange(preset) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(today);
    const end = new Date(today);

    if (preset === "today") {
      return {
        dateFrom: formatDateInput(start),
        dateTo: formatDateInput(end)
      };
    }

    if (preset === "yesterday") {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      return {
        dateFrom: formatDateInput(start),
        dateTo: formatDateInput(end)
      };
    }

    if (preset === "last7") {
      start.setDate(start.getDate() - 6);
      return {
        dateFrom: formatDateInput(start),
        dateTo: formatDateInput(end)
      };
    }

    if (preset === "thisMonth") {
      start.setDate(1);
      return {
        dateFrom: formatDateInput(start),
        dateTo: formatDateInput(end)
      };
    }

    return {
      dateFrom: "",
      dateTo: ""
    };
  }

  function getDateFilterValues(prefix) {
    const preset = byId(`${prefix}DatePreset`)?.value || "custom";
    const presetRange = getPresetDateRange(preset);

    const manualFrom = String(byId(`${prefix}DateFrom`)?.value || "").trim();
    const manualTo = String(byId(`${prefix}DateTo`)?.value || "").trim();

    return {
      dateFrom: manualFrom || presetRange.dateFrom,
      dateTo: manualTo || presetRange.dateTo
    };
  }

  function getScanBody() {
    const companyId = getCompanyIdOrNull();

    if (!companyId) {
      throw new Error("اختار Company ID قبل تشغيل Scan.");
    }

    return {
      companyId,
      threshold: Number(byId("threshold")?.value || 1000),
      lookbackMinutes: Number(byId("lookbackMinutes")?.value || 10080),
      limit: getLimitValue()
    };
  }


  function applySettingsToUi(settings = {}) {
    if (byId("smsSendingEnabled")) {
      byId("smsSendingEnabled").checked = Boolean(settings.smsSendingEnabled);
    }

    if (byId("autoScanEnabled")) {
      byId("autoScanEnabled").checked = Boolean(settings.autoScanEnabled);
    }

    if (byId("manualSendEnabled")) {
      byId("manualSendEnabled").checked = Boolean(settings.manualSendEnabled);
    }
  }

  function getSettingsBody() {
    return {
      smsSendingEnabled: Boolean(byId("smsSendingEnabled")?.checked),
      autoScanEnabled: Boolean(byId("autoScanEnabled")?.checked),
      manualSendEnabled: Boolean(byId("manualSendEnabled")?.checked)
    };
  }

  async function loadSettings() {
    try {
      const data = await requestJson(`${getApiBaseFromDashboard()}/settings`, {
        method: "GET",
        headers: {
          "x-admin-key": getAdminKey()
        }
      });

      applySettingsToUi(data.data || {});
      setStatus({
        message: "تم تحميل إعدادات التشغيل.",
        settings: data.data || {}
      });
    } catch (error) {
      setStatus(`Settings Error: ${error.message}`);
    }
  }

  async function saveSettings() {
    try {
      const data = await requestJson(`${getApiBaseFromDashboard()}/settings`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify(getSettingsBody())
      });

      applySettingsToUi(data.data || {});
      setStatus({
        message: "تم حفظ إعدادات التشغيل.",
        settings: data.data || {}
      });

      await loadHealth();
    } catch (error) {
      setStatus(`Save Settings Error: ${error.message}`);
    }
  }

  async function loadHealth() {
    try {
      const data = await requestJson(`${getApiBaseFromDashboard()}/health`);
      const health = data || {};

      const modeBadge = byId("modeBadge");
      if (modeBadge) {
        const liveSms = Boolean(health.liveSms);
        const protectedText = health.adminKeyProtected ? "Protected" : "No Admin Key";

        modeBadge.textContent = liveSms
          ? `LIVE SMS مفعّل - ${protectedText}`
          : `Mock/Test - Provider: ${health.provider || "mock"} - ${protectedText}`;

        modeBadge.classList.toggle("live", liveSms);
        modeBadge.classList.toggle("mock", !liveSms);
      }

      applySettingsToUi(health.settings || {});

      setStatus({
        module: health.module,
        provider: health.provider,
        liveSms: health.liveSms,
        autoCronEnv: health.autoCronEnv,
        adminKeyProtected: health.adminKeyProtected,
        threshold: health.threshold,
        settings: health.settings
      });
    } catch (error) {
      setStatus(`Health Error: ${error.message}`);
    }
  }

  async function loadStats() {
    try {
      const companyId = getCompanyIdOrNull();
      const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";

      const data = await requestJson(`${getApiBaseFromDashboard()}/stats${query}`, {
        method: "GET",
        headers: {
          "x-admin-key": getAdminKey()
        }
      });

      const stats = data.data || {};

      if (byId("statTotal")) byId("statTotal").textContent = stats.total ?? 0;
      if (byId("statSent")) byId("statSent").textContent = stats.sent ?? 0;
      if (byId("statFailed")) byId("statFailed").textContent = stats.failed ?? 0;
      if (byId("statOpened")) byId("statOpened").textContent = stats.opened ?? 0;
      if (byId("statReviewed")) byId("statReviewed").textContent = stats.reviewed ?? 0;
      if (byId("statAvgRating")) byId("statAvgRating").textContent = stats.avg_rating ?? "-";

      setStatus("تم تحديث إحصائيات الرسائل.");
    } catch (error) {
      setStatus(`Stats Error: ${error.message}`);
    }
  }

  function getFollowupsQueryParams({ includeLimit = true } = {}) {
    const params = new URLSearchParams();

    if (includeLimit) {
      params.set("limit", String(getLimitValue()));
    }

    const status = byId("followupStatusFilter")?.value;
    if (status) params.set("status", status);

    const priority = byId("priorityFilter")?.value;
    if (priority) params.set("priority", priority);

    const companyId = getCompanyIdOrNull();
    if (companyId) params.set("companyId", String(companyId));

    const dateField = byId("followupDateField")?.value || "created_at";
    if (dateField) params.set("dateField", dateField);

    const dates = getDateFilterValues("followup");
    if (dates.dateFrom) params.set("dateFrom", dates.dateFrom);
    if (dates.dateTo) params.set("dateTo", dates.dateTo);

    return params;
  }

  async function loadFollowupStats() {
    try {
      const params = getFollowupsQueryParams({ includeLimit: false });

      const data = await requestJson(
        `${getApiBaseFromDashboard()}/followups/stats?${params}`,
        {
          method: "GET",
          headers: {
            "x-admin-key": getAdminKey()
          }
        }
      );

      const stats = data.data || {};

      if (byId("followupTotal")) byId("followupTotal").textContent = stats.total ?? 0;
      if (byId("followupNew")) byId("followupNew").textContent = stats.new_count ?? 0;
      if (byId("followupInProgress")) byId("followupInProgress").textContent = stats.in_progress ?? 0;
      if (byId("followupContacted")) byId("followupContacted").textContent = stats.contacted ?? 0;
      if (byId("followupResolved")) byId("followupResolved").textContent = stats.resolved ?? 0;
      if (byId("followupHigh")) byId("followupHigh").textContent = stats.high_priority ?? 0;
    } catch (error) {
      setStatus(`Follow-up Stats Error: ${error.message}`);
    }
  }

  async function loadLogs() {
    const tbody = byId("logsBody");
    if (!tbody) return;

    try {
      const params = new URLSearchParams();
      params.set("limit", String(getLimitValue()));

      const status = byId("statusFilter")?.value;
      if (status) params.set("status", status);

      const companyId = getCompanyIdOrNull();
      if (companyId) params.set("companyId", String(companyId));

      const data = await requestJson(`${getApiBaseFromDashboard()}/logs?${params}`, {
        method: "GET",
        headers: {
          "x-admin-key": getAdminKey()
        }
      });

      renderLogs(data.data || []);
      setStatus("تم تحديث الرسائل.");
    } catch (error) {
      setStatus(`Logs Error: ${error.message}`);
    }
  }

  async function loadFollowups() {
    const tbody = byId("followupsBody");
    if (!tbody) return;

    try {
      const params = getFollowupsQueryParams();

      const data = await requestJson(`${getApiBaseFromDashboard()}/followups?${params}`, {
        method: "GET",
        headers: {
          "x-admin-key": getAdminKey()
        }
      });

      renderFollowups(data.data || []);
      await loadFollowupStats();
      setStatus("تم تحديث متابعات خدمة العملاء حسب الفلاتر المحددة.");
    } catch (error) {
      setStatus(`Follow-ups Error: ${error.message}`);
    }
  }

  async function scanNow(dryRun) {
    try {
      setStatus(dryRun ? "جاري Dry Run..." : "جاري تشغيل Scan فعلي...");

      const url = `${getApiBaseFromDashboard()}/scan-now${dryRun ? "?dryRun=true" : ""}`;

      const data = await requestJson(url, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(getScanBody())
      });

      const result = data.data || {};

      setStatus({
        foundInOdoo: result.foundInOdoo,
        skippedNoPhone: result.skippedNoPhone,
        skippedDuplicate: result.skippedDuplicate,
        skippedRepeatedPhone: result.skippedRepeatedPhone,
        created: result.created,
        sent: result.sent,
        failed: result.failed,
        dryRun: result.dryRun,
        blockedBySettings: result.blockedBySettings
      });
    } catch (error) {
      setStatus(`Scan Error: ${error.message}`);
    }
  }


  function getManualSendBody(dryRun) {
    const companyId = getCompanyIdOrNull();
    const phonesText = String(byId("manualPhones")?.value || "").trim();

    if (!companyId) {
      throw new Error("اختار Company ID قبل الإرسال اليدوي.");
    }

    if (!phonesText) {
      throw new Error("اكتب رقم تليفون واحد على الأقل.");
    }

    return {
      companyId,
      phonesText,
      customerName: String(byId("manualCustomerName")?.value || "").trim(),
      branchName: String(byId("manualBranchName")?.value || "").trim(),
      manualNote: String(byId("manualNote")?.value || "").trim(),
      createdBy: "review-sms-dashboard",
      dryRun
    };
  }

  async function manualSend(dryRun) {
    try {
      setStatus(dryRun ? "جاري Manual Dry Run..." : "جاري إرسال الرسائل اليدوية...");

      const data = await requestJson(
        `${getApiBaseFromDashboard()}/manual-send${dryRun ? "?dryRun=true" : ""}`,
        {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify(getManualSendBody(dryRun))
        }
      );

      const result = data.data || {};

      setStatus({
        totalInput: result.totalInput,
        validPhones: result.validPhones,
        invalidPhones: result.invalidPhones,
        created: result.created,
        sent: result.sent,
        failed: result.failed,
        dryRun: result.dryRun,
        blockedBySettings: result.blockedBySettings,
        blockedBySettings: result.blockedBySettings,
        manualBatchId: result.manualBatchId,
        items: result.items
      });

      if (!dryRun && !result.blockedBySettings) {
        await loadLogs();
        await loadStats();
      }
    } catch (error) {
      setStatus(`Manual Send Error: ${error.message}`);
    }
  }

  async function sendPending() {
    try {
      setStatus("جاري إرسال الرسائل المعلقة...");

      const data = await requestJson(`${getApiBaseFromDashboard()}/send-pending`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          limit: getLimitValue()
        })
      });

      setStatus(data.data || {});
    } catch (error) {
      setStatus(`Send Pending Error: ${error.message}`);
    }
  }

  async function refreshAll(showStatus = true) {
    if (showStatus) setStatus("جاري تحديث البيانات...");

    await loadStats();
    await loadFollowupStats();
    await loadLogs();
    await loadFollowups();

    if (showStatus) setStatus("تم تحديث البيانات.");
  }

  function renderLogs(rows) {
    const tbody = byId("logsBody");
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="11">لا توجد رسائل.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map((row) => {
        const reviewUrl = row.review_url || "";
        const rating = getRatingLabel(row.rating);

        return `
          <tr>
            <td>${escapeHtml(row.id)}</td>
            <td>${badge(row.status)}</td>
            <td>${escapeHtml(row.provider)}</td>
            <td>${escapeHtml(getPublicBranchName(row.branch_name))}</td>
            <td>${escapeHtml(row.customer_name)}</td>
            <td>${escapeHtml(row.customer_phone)}</td>
            <td>${escapeHtml(row.odoo_order_name)}</td>
            <td>${escapeHtml(formatMoney(row.amount_total))}</td>
            <td>${escapeHtml(rating)}</td>
            <td>
              <div class="crsms-mini-actions">
                ${
                  reviewUrl
                    ? `<a href="${escapeHtml(reviewUrl)}" target="_blank" rel="noopener">فتح</a>`
                    : ""
                }
                ${
                  reviewUrl
                    ? `<button type="button" data-copy="${escapeHtml(reviewUrl)}">نسخ</button>`
                    : ""
                }
              </div>
            </td>
            <td>${escapeHtml(formatDate(row.sent_at || row.created_at))}</td>
          </tr>
        `;
      })
      .join("");

    bindCopyButtons(tbody);
  }

  function renderFollowups(rows) {
    const tbody = byId("followupsBody");
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="12">لا توجد متابعات حتى الآن.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map((row) => {
        return `
          <tr>
            <td>${escapeHtml(row.id)}</td>
            <td>${badge(row.priority)}</td>
            <td>${badge(row.status)}</td>
            <td>${escapeHtml(getRatingLabel(row.rating))}</td>
            <td>${escapeHtml(getReasonLabel(row.dissatisfactionReason))}</td>
            <td>${escapeHtml(row.customerComment || "")}</td>
            <td>${escapeHtml(getPublicBranchName(row.branchName))}</td>
            <td>${escapeHtml(row.customerName || "")}</td>
            <td>${escapeHtml(row.customerPhone || "")}</td>
            <td>${escapeHtml(row.odooOrderName || "")}</td>
            <td>${escapeHtml(formatMoney(row.amountTotal))}</td>
            <td>
              <div class="crsms-mini-actions">
                <select class="crsms-followup-select" data-followup-status="${escapeHtml(row.id)}">
                  <option value="new" ${row.status === "new" ? "selected" : ""}>جديد</option>
                  <option value="in_progress" ${row.status === "in_progress" ? "selected" : ""}>جاري المتابعة</option>
                  <option value="contacted" ${row.status === "contacted" ? "selected" : ""}>تم التواصل</option>
                  <option value="resolved" ${row.status === "resolved" ? "selected" : ""}>تم الحل</option>
                  <option value="closed" ${row.status === "closed" ? "selected" : ""}>مغلق</option>
                </select>
                <button type="button" data-followup-update="${escapeHtml(row.id)}">حفظ</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    bindFollowupButtons(tbody);
  }

  function bindCopyButtons(container) {
    container.querySelectorAll("[data-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(button.dataset.copy);
          setStatus("تم نسخ لينك التقييم.");
        } catch (error) {
          setStatus(`Copy Error: ${error.message}`);
        }
      });
    });
  }

  function bindFollowupButtons(container) {
    container.querySelectorAll("[data-followup-update]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.followupUpdate;
        const select = container.querySelector(`[data-followup-status="${id}"]`);

        if (!id || !select) return;

        try {
          await requestJson(`${getApiBaseFromDashboard()}/followups/${encodeURIComponent(id)}/status`, {
            method: "PATCH",
            headers: adminHeaders(),
            body: JSON.stringify({
              status: select.value
            })
          });

          setStatus("تم تحديث حالة المتابعة.");
          await loadFollowups();
        } catch (error) {
          setStatus(`Update Follow-up Error: ${error.message}`);
        }
      });
    });
  }


  /* =========================
     Operations queue page
  ========================== */

  function initQueuePage() {
    const apiBaseInput = byId("apiBase");
    const adminKeyInput = byId("adminKey");

    if (apiBaseInput) {
      apiBaseInput.value = getStoredApiBase();
    }

    if (adminKeyInput) {
      adminKeyInput.value = localStorage.getItem("reviewSmsAdminKey") || "";
    }

    document.querySelectorAll("[data-queue-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.queueAction;

        if (action === "health") loadQueueHealth();
        if (action === "preview") queuePreview();
        if (action === "select-ready") selectReadyQueueRows();
        if (action === "clear-selection") clearQueueSelection();
        if (action === "send-selected-dry-run") sendSelectedQueueRows(true);
        if (action === "send-selected") sendSelectedQueueRows(false);
      });
    });

    selectedQueueOrderIds = new Set();
    lastQueueRows = [];
    setStatus("جاهز. ابحث عن فواتير Odoo بدون إرسال، ثم اختر الفواتير المراد إرسالها.");
  }

  async function loadQueueHealth() {
    try {
      const data = await requestJson(`${getApiBaseFromDashboard()}/health`);
      const health = data || {};

      const modeBadge = byId("modeBadge");
      if (modeBadge) {
        const liveSms = Boolean(health.liveSms);
        const protectedText = health.adminKeyProtected ? "Protected" : "No Admin Key";

        modeBadge.textContent = liveSms
          ? `LIVE SMS مفعّل - ${protectedText}`
          : `Mock/Test - Provider: ${health.provider || "mock"} - ${protectedText}`;

        modeBadge.classList.toggle("live", liveSms);
        modeBadge.classList.toggle("mock", !liveSms);
      }

      setStatus({
        module: health.module,
        provider: health.provider,
        liveSms: health.liveSms,
        autoCronEnv: health.autoCronEnv,
        adminKeyProtected: health.adminKeyProtected,
        settings: health.settings
      });
    } catch (error) {
      setStatus(`Health Error: ${error.message}`);
    }
  }

  function getQueueBody() {
    const body = getScanBody();
    const dates = getDateFilterValues("queue");

    if (dates.dateFrom) body.dateFrom = dates.dateFrom;
    if (dates.dateTo) body.dateTo = dates.dateTo;

    body.repeatPolicy = byId("repeatPolicy")?.value || "same_day";

    return body;
  }

  async function queuePreview() {
    try {
      setStatus("جاري البحث عن فواتير Odoo المرشحة للإرسال...");

      const data = await requestJson(`${getApiBaseFromDashboard()}/queue-preview`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(getQueueBody())
      });

      const result = data.data || {};
      lastQueueRows = result.items || [];
      selectedQueueOrderIds = new Set();

      renderQueueRows(lastQueueRows);
      updateQueueSummary(result);
      setStatus({
        message: "تم البحث بدون إرسال.",
        foundInOdoo: result.foundInOdoo,
        ready: result.ready,
        duplicates: result.duplicates,
        noValidPhone: result.noValidPhone
      });
    } catch (error) {
      setStatus(`Queue Preview Error: ${error.message}`);
    }
  }

  function queueStatusLabel(status) {
    const map = {
      ready: "جاهز للإرسال",
      duplicate: "مرسل لنفس الفاتورة",
      phone_sent_recently: "الرقم استلم رسالة خلال الفترة المحددة",
      phone_repeated_in_batch: "رقم مكرر داخل نفس البحث",
      no_valid_phone: "لا يوجد رقم صالح",
      skipped_no_valid_phone: "لا يوجد رقم صالح",
      skipped_duplicate: "مرسل لنفس الفاتورة",
      skipped_phone_sent_recently: "تم تخطي الرقم حسب سياسة التكرار",
      skipped_phone_repeated_in_batch: "تم تخطي رقم مكرر داخل الدفعة",
      dry_run: "اختبار فقط",
      sent: "تم الإرسال",
      failed: "فشل"
    };

    return map[status] || status || "-";
  }

  function updateQueueSummary(result = {}) {
    if (byId("queueFound")) byId("queueFound").textContent = result.foundInOdoo ?? 0;
    if (byId("queueReady")) byId("queueReady").textContent = result.ready ?? 0;
    if (byId("queueDuplicates")) byId("queueDuplicates").textContent = result.duplicates ?? 0;
    if (byId("queueRepeated")) byId("queueRepeated").textContent = result.repeatedPhones ?? result.skippedRepeatedPhone ?? 0;
    if (byId("queueNoPhone")) byId("queueNoPhone").textContent = result.noValidPhone ?? 0;
    updateSelectedCount();
  }

  function updateSelectedCount() {
    if (byId("queueSelected")) byId("queueSelected").textContent = selectedQueueOrderIds.size;
  }

  function renderQueueRows(rows) {
    const tbody = byId("queueBody");
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="12">لا توجد فواتير للعرض.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map((row) => {
        const canSend = Boolean(row.canSend);
        const disabled = canSend ? "" : "disabled";
        const checked = selectedQueueOrderIds.has(Number(row.orderId)) ? "checked" : "";

        return `
          <tr>
            <td>
              <input
                type="checkbox"
                data-queue-check="${escapeHtml(row.orderId)}"
                ${disabled}
                ${checked}
              />
            </td>
            <td>${escapeHtml(row.orderId)}</td>
            <td>${escapeHtml(row.orderName)}</td>
            <td>${escapeHtml(formatDate(row.orderDate))}</td>
            <td>${escapeHtml(row.customerName)}</td>
            <td>${escapeHtml(row.customerPhone || "-")}</td>
            <td>${escapeHtml(getPublicBranchName(row.branchName))}</td>
            <td>${escapeHtml(formatMoney(row.amountTotal))}</td>
            <td>${badge(row.status)}</td>
            <td>${escapeHtml(row.statusReason || queueStatusLabel(row.status))}</td>
            <td>${escapeHtml((row.phoneCandidates || []).slice(0, 4).join(" / "))}</td>
            <td>${row.recentLogId ? escapeHtml(`#${row.recentLogId} - ${formatDate(row.recentLogCreatedAt)}`) : "-"}</td>
          </tr>
        `;
      })
      .join("");

    bindQueueChecks(tbody);
    updateSelectedCount();
  }

  function bindQueueChecks(container) {
    container.querySelectorAll("[data-queue-check]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const orderId = Number(checkbox.dataset.queueCheck);
        if (!Number.isInteger(orderId)) return;

        if (checkbox.checked) {
          selectedQueueOrderIds.add(orderId);
        } else {
          selectedQueueOrderIds.delete(orderId);
        }

        updateSelectedCount();
      });
    });
  }

  function selectReadyQueueRows() {
    selectedQueueOrderIds = new Set(
      lastQueueRows
        .filter((row) => row.canSend)
        .map((row) => Number(row.orderId))
        .filter((number) => Number.isInteger(number))
    );

    renderQueueRows(lastQueueRows);
    setStatus(`تم تحديد ${selectedQueueOrderIds.size} فاتورة جاهزة للإرسال.`);
  }

  function clearQueueSelection() {
    selectedQueueOrderIds = new Set();
    renderQueueRows(lastQueueRows);
    setStatus("تم إلغاء التحديد.");
  }

  async function sendSelectedQueueRows(dryRun) {
    try {
      const orderIds = Array.from(selectedQueueOrderIds);

      if (!orderIds.length) {
        throw new Error("اختر فاتورة واحدة على الأقل من الجدول.");
      }

      setStatus(dryRun ? "جاري اختبار إرسال المحدد بدون SMS..." : "جاري إرسال الرسائل للفواتير المحددة...");

      const data = await requestJson(
        `${getApiBaseFromDashboard()}/queue-send-selected${dryRun ? "?dryRun=true" : ""}`,
        {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify({
            ...getQueueBody(),
            orderIds,
            dryRun
          })
        }
      );

      const result = data.data || {};
      setStatus({
        requested: result.requested,
        foundInOdoo: result.foundInOdoo,
        skippedNoPhone: result.skippedNoPhone,
        skippedDuplicate: result.skippedDuplicate,
        skippedRepeatedPhone: result.skippedRepeatedPhone,
        created: result.created,
        sent: result.sent,
        failed: result.failed,
        dryRun: result.dryRun,
        blockedBySettings: result.blockedBySettings,
        items: result.items
      });

      if (!dryRun && !result.blockedBySettings) {
        selectedQueueOrderIds = new Set();
      }
    } catch (error) {
      setStatus(`Queue Send Error: ${error.message}`);
    }
  }

  /* =========================
     Review page
  ========================== */

  function initReviewPage() {
    const token = new URLSearchParams(window.location.search).get("token");

    if (!token) {
      showReviewError("رابط التقييم غير مكتمل.");
      return;
    }

    selectedRating = null;

    loadReviewData(token);
    setupReviewReactions();
    setupReviewSubmit(token);
  }

  function getReviewApiBase() {
  return "https://odoo-management-intelligence-agent-production.up.railway.app/api/customer/review-sms";
}

  function showReviewError(message) {
    if (byId("reviewLoading")) byId("reviewLoading").hidden = true;
    if (byId("reviewContent")) byId("reviewContent").hidden = true;

    const errorBox = byId("reviewError");
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    }
  }

  async function loadReviewData(token) {
    try {
      const data = await requestJson(
        `${getReviewApiBase()}/review-data/${encodeURIComponent(token)}`
      );

      const review = data.data || {};
      const displayBranchName = getPublicBranchName(review.branchName);

      byId("reviewLoading").hidden = true;
      byId("reviewError").hidden = true;
      byId("reviewContent").hidden = false;

      const subtitleEl = byId("reviewSubtitle");
      if (subtitleEl) {
        subtitleEl.textContent =
          `شكراً لتسوقك من ${displayBranchName}. رأيك مهم لتحسين الخدمة.`;
      }

      const branchEl = byId("reviewBranch");
      if (branchEl) {
        branchEl.textContent = displayBranchName;
      }

      const orderEl = byId("reviewOrder");
      if (orderEl) {
        orderEl.textContent = review.orderName || "-";
      }

      const amountEl = byId("reviewAmount");
      if (amountEl) {
        amountEl.textContent = review.amountTotal
          ? `${formatMoney(review.amountTotal)} جنيه`
          : "-";
      }

      const alreadyReviewedBox = byId("alreadyReviewedBox");
      const reviewForm = byId("reviewForm");

      if (review.status === "reviewed") {
        if (alreadyReviewedBox) alreadyReviewedBox.hidden = false;
        if (reviewForm) reviewForm.hidden = true;
      } else {
        if (alreadyReviewedBox) alreadyReviewedBox.hidden = true;
        if (reviewForm) reviewForm.hidden = false;
      }
    } catch (error) {
      showReviewError(error.message);
    }
  }

  function setupReviewReactions() {
    const buttons = Array.from(document.querySelectorAll("#starsBox button"));
    const reasonBox = byId("reasonBox");
    const reasonSelect = byId("dissatisfactionReason");

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        selectedRating = Number(button.dataset.rating);

        buttons.forEach((item) => {
          const rating = Number(item.dataset.rating);
          item.classList.toggle("active", rating === selectedRating);
        });

        if ([1, 3].includes(selectedRating)) {
          if (reasonBox) reasonBox.hidden = false;
        } else {
          if (reasonBox) reasonBox.hidden = true;
          if (reasonSelect) reasonSelect.value = "";
        }

        const submitButton = byId("submitReviewBtn");
        if (submitButton) submitButton.disabled = false;
      });
    });
  }

  function setupReviewSubmit(token) {
    const form = byId("reviewForm");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!selectedRating) return;

      const submitButton = byId("submitReviewBtn");
      const messageBox = byId("reviewSubmitMessage");
      const reason = String(byId("dissatisfactionReason")?.value || "").trim();
      const comment = String(byId("reviewComment")?.value || "").trim();

      if ([1, 3].includes(selectedRating) && !reason) {
        messageBox.hidden = false;
        messageBox.className = "crsms-review-message crsms-error";
        messageBox.textContent = "من فضلك اختر سبب عدم الرضا.";
        return;
      }

      try {
        submitButton.disabled = true;
        submitButton.textContent = "جاري الإرسال...";

        await requestJson(`${getReviewApiBase()}/review/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            rating: selectedRating,
            reason,
            comment
          })
        });

        messageBox.hidden = false;
        messageBox.className = "crsms-review-message crsms-success";

        if (selectedRating === 5) {
  messageBox.innerHTML = `
    <strong>شكراً لتقييمك ❤️</strong>
    <p>فيرجينيا دايمًا معاك</p>
    <a class="crsms-coupon-link" href="./review-coupon.html">
      احصل على كوبون الشحن المجاني 🎁
    </a>
  `;
} else {
  messageBox.textContent =
    "نعتذر عن التجربة. تم تسجيل ملاحظتك وسيتم متابعتها من خدمة العملاء.";
}

        form.hidden = true;
        submitButton.textContent = "تم الإرسال";
      } catch (error) {
        messageBox.hidden = false;
        messageBox.className = "crsms-review-message crsms-error";
        messageBox.textContent = error.message;

        submitButton.disabled = false;
        submitButton.textContent = "إرسال التقييم";
      }
    });
  }
})();
