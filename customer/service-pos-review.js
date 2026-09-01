(function () {
  "use strict";

  const CS_USER_KEY = "customerServiceInternalUser";

  let currentUser = null;
  let lastInvoices = [];
  let setupNeedsBootstrap = false;
  let userManagementEventsBound = false;

  function getCustomerServiceApiBase() {
    let apiBaseUrl = "";

    try {
      if (typeof API_BASE_URL !== "undefined" && API_BASE_URL) {
        apiBaseUrl = API_BASE_URL;
      }
    } catch (error) {
      apiBaseUrl = "";
    }

    if (apiBaseUrl) {
      return `${apiBaseUrl.replace(/\/$/, "")}/customer/service-pos-review`;
    }

    const host = window.location.host;

    if (host.includes("127.0.0.1:5500") || host.includes("localhost:5500")) {
      return "http://localhost:5050/api/customer/service-pos-review";
    }

    if (host.includes("api.mi.virginiaolive.com")) {
      return "/api/customer/service-pos-review";
    }

    return "https://api.mi.virginiaolive.com/api/customer/service-pos-review";
  }

  const API_BASE = getCustomerServiceApiBase();

  function el(id) {
    return document.getElementById(id);
  }

  function showElement(element) {
    if (!element) return;
    element.classList.remove("hidden");
    element.style.display = "";
  }

  function hideElement(element) {
    if (!element) return;
    element.classList.add("hidden");
    element.style.display = "none";
  }

  function getMainAuthToken() {
    if (typeof window.getAuthToken === "function") {
      return window.getAuthToken() || "";
    }
    if (typeof window.getToken === "function") {
      return window.getToken() || "";
    }
    const token = String(localStorage.getItem("token") || "").trim();
    return token && token !== "dev-bypass-token" ? token : "";
  }

  function getStoredCompanyId() {
    try {
      if (typeof window.getCompanyId === "function") {
        const companyId = String(window.getCompanyId() || "").trim();
        if (companyId) return companyId;
      }
    } catch (_) {}

    return String(localStorage.getItem("companyId") || "").trim();
  }

  function syncComplaintCompanySelector(companyId = "") {
    const normalizedCompanyId = String(companyId || getStoredCompanyId() || "").trim();
    const companyField = el("companyId");

    if (companyField && normalizedCompanyId) {
      const optionExists = Array.from(companyField.options || []).some(
        (option) => String(option.value) === normalizedCompanyId
      );
      if (optionExists) companyField.value = normalizedCompanyId;
    }

    return normalizedCompanyId;
  }

  function persistComplaintCompany(companyId) {
    const normalizedCompanyId = String(companyId || "").trim();

    if (typeof window.setCompanyId === "function") {
      window.setCompanyId(normalizedCompanyId);
    } else if (normalizedCompanyId) {
      localStorage.setItem("companyId", normalizedCompanyId);
    } else {
      localStorage.removeItem("companyId");
    }

    const headerCompany = el("companySelect");
    if (headerCompany && headerCompany.value !== normalizedCompanyId) {
      headerCompany.value = normalizedCompanyId;
    }

    return normalizedCompanyId;
  }

  function getSelectedCompanyId(required = false) {
    const companyId =
      String(el("companyId")?.value || "").trim() ||
      String(el("companySelect")?.value || "").trim() ||
      getStoredCompanyId();

    if (companyId) syncComplaintCompanySelector(companyId);

    if (required && !companyId) {
      throw new Error("لازم تختار الشركة قبل تنفيذ العملية.");
    }

    return companyId;
  }

  function setMessage(message, type = "success") {
    if (!message) {
      window.MINotifications?.dismiss?.("mi-customer-service-message");
      const box = el("csMessage");
      if (box) {
        box.replaceChildren();
        box.className = "cs-global-note hidden";
      }
      return;
    }

    if (window.MINotifications) {
      const method = type === "error" ? "error" : type === "warning" ? "warning" : "success";
      window.MINotifications[method]?.(message, {
        id: "mi-customer-service-message"
      });
      return;
    }

    const box = el("csMessage");
    if (!box) return;
    box.textContent = message;
    box.className = `cs-global-note ${type === "error" ? "cs-global-note--error" : "cs-global-note--success"}`;
  }

  function clearFieldError(input) {
    if (!input) return;
    if (window.MINotifications?.clearField) {
      window.MINotifications.clearField(input);
      return;
    }
    input.classList.remove("cs-field-invalid");
    input.removeAttribute("aria-invalid");
    const field = input.closest?.(".report-field");
    field?.querySelector?.(".cs-field-error")?.remove();
  }

  function setFieldError(input, message) {
    if (!input) return;
    if (window.MINotifications?.fieldError) {
      window.MINotifications.fieldError(input, message, {
        noteId: "mi-customer-service-validation"
      });
      return;
    }

    clearFieldError(input);
    input.classList.add("cs-field-invalid");
    input.setAttribute("aria-invalid", "true");
    const field = input.closest?.(".report-field");
    if (field) {
      const note = document.createElement("small");
      note.className = "cs-field-error";
      note.textContent = message;
      field.appendChild(note);
    }
    input.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }

  function formatMoney(value) {
    const num = Number(value || 0);

    try {
      return `${num.toLocaleString("ar-EG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} ج`;
    } catch (error) {
      return `${num.toFixed(2)} ج`;
    }
  }

  function formatNumber(value, digits = 0) {
    const num = Number(value || 0);

    try {
      return num.toLocaleString("ar-EG", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    } catch (error) {
      return String(value || 0);
    }
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("ar-EG");
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function findDataElement(selector, datasetKey, value) {
    const expected = String(value ?? "");
    return Array.from(document.querySelectorAll(selector)).find(
      (node) => String(node.dataset?.[datasetKey] ?? "") === expected
    ) || null;
  }

  function syncFinancialReviewRequestUi(invoiceId) {
    const checkbox = findDataElement("[data-financial-review-toggle]", "financialReviewToggle", invoiceId);
    const fields = el(`financialReviewFields-${invoiceId}`);
    const noteType = el(`noteType-${invoiceId}`);
    const saveButton = findDataElement("[data-save-note]", "saveNote", invoiceId);
    const enabled = Boolean(checkbox?.checked);

    if (fields) {
      fields.classList.toggle("hidden", !enabled);
      fields.setAttribute("aria-hidden", enabled ? "false" : "true");
    }
    if (enabled && noteType) noteType.value = "complaint";
    if (saveButton) {
      saveButton.textContent = enabled
        ? "حفظ الشكوى وإرسالها للمدير"
        : "حفظ وإرسال للمدير";
    }
  }

  async function request(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    const mainToken = getMainAuthToken();
    if (mainToken) {
      headers.Authorization = `Bearer ${mainToken}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`;

      throw new Error(message);
    }

    if (String(options.method || "GET").toUpperCase() !== "GET") {
      try {
        const liveChannel = new BroadcastChannel("mi-customer-service-live");
        liveChannel.postMessage({ path, at: Date.now() });
        liveChannel.close();
      } catch (_) {
        localStorage.setItem("mi-customer-service-live", String(Date.now()));
      }
    }

    return data;
  }

  function defaultDates() {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);

    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - 30);
    const from = fromDate.toISOString().slice(0, 10);

    if (el("dateFrom") && !el("dateFrom").value) el("dateFrom").value = from;
    if (el("dateTo") && !el("dateTo").value) el("dateTo").value = to;
  }

  function getUrlParams() {
    return new URLSearchParams(window.location.search || "");
  }

  function applyUrlParamsToFilters() {
    const params = getUrlParams();

    const companyId = params.get("companyId");
    const invoiceRef = params.get("invoiceRef");
    const customerPhone = params.get("customerPhone");
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");

    if (companyId && el("companyId")) {
      el("companyId").value = companyId;
      persistComplaintCompany(companyId);
    } else {
      syncComplaintCompanySelector();
    }

    if (invoiceRef && el("invoiceRef")) {
      el("invoiceRef").value = invoiceRef;
    }

    if (customerPhone && el("customerPhone")) {
      el("customerPhone").value = customerPhone;
    }

    if (dateFrom && el("dateFrom")) {
      el("dateFrom").value = dateFrom;
    }

    if (dateTo && el("dateTo")) {
      el("dateTo").value = dateTo;
    }
  }

  async function autoSearchFromUrlAfterLogin() {
    const params = getUrlParams();

    const invoiceRef = params.get("invoiceRef");
    const customerPhone = params.get("customerPhone");

    if (!currentUser) return;
    if (!invoiceRef && !customerPhone) return;

    await searchInvoices();
  }

  function readStoredUser() {
    const raw = localStorage.getItem(CS_USER_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function readMainProjectUser() {
    try {
      if (typeof window.getCurrentUser === "function") {
        return window.getCurrentUser() || null;
      }

      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function buildMainSessionFallbackUser() {
    const user = readMainProjectUser();

    if (!getMainAuthToken() || !user || user.id === undefined || user.id === null) {
      return null;
    }

    return {
      id: user.id,
      fullName: user.fullName || user.full_name || user.name || user.username || "مستخدم النظام",
      username: user.username || `main.${user.id}`,
      role: "agent",
      isMainSessionFallback: true
    };
  }

  function isManagerUser() {
    return currentUser?.role === "manager" || currentUser?.role === "admin";
  }

  function canCreateCompensation() {
    return ["agent", "manager", "admin"].includes(currentUser?.role);
  }

  function canMonitorCompensation() {
    return ["monitor", "admin"].includes(currentUser?.role);
  }

  function canAccountCompensation() {
    return ["accountant", "admin"].includes(currentUser?.role);
  }

  function isAdminUser() {
    return currentUser?.role === "admin";
  }

  function roleLabel(role) {
    if (role === "monitor") return "مراقب / مراجعة كاميرات";
    if (role === "accountant") return "محاسب";
    if (role === "manager") return "مدير خدمة العملاء";
    if (role === "admin") return "Admin";
    return "موظف خدمة عملاء";
  }

  function removeUserManagementPanel() {
    const panel = el("userManagementPanel");
    if (panel) panel.remove();
  }

  function ensureBootstrapCard() {
    if (el("bootstrapCard")) return;

    const loginCard = el("loginCard");
    const card = document.createElement("section");

    card.id = "bootstrapCard";
    card.className = "report-card hidden";

    card.innerHTML = `
      <div class="report-card-head">
        <h2>إنشاء أول مدير خدمة عملاء</h2>
        <p>
          لا يوجد مستخدمون داخليون حتى الآن. أنشئ أول مدير مرة واحدة فقط، وبعدها يتم إنشاء الموظفين من داخل النظام.
        </p>
      </div>

      <div class="report-filter-grid">
        <label class="report-field">
          اسم المدير
          <input id="bootstrapFullName" class="report-input" type="text" placeholder="مثال: مدير خدمة العملاء" />
        </label>

        <label class="report-field">
          اسم المستخدم
          <input id="bootstrapUsername" class="report-input" type="text" placeholder="مثال: cs.manager" />
        </label>

        <label class="report-field">
          كلمة السر
          <input id="bootstrapPassword" class="report-input" type="password" placeholder="6 أحرف على الأقل" />
        </label>
      </div>

      <div class="inventory-hero-actions">
        <button class="run-btn" id="bootstrapBtn" type="button">
          إنشاء أول مدير والدخول
        </button>
      </div>
    `;

    if (loginCard?.parentNode) {
      loginCard.parentNode.insertBefore(card, loginCard);
    } else {
      document.body.prepend(card);
    }
  }

  async function checkSetupStatus() {
    try {
      const data = await request("/setup-status");
      setupNeedsBootstrap = Boolean(data.needsBootstrap);
    } catch (error) {
      setupNeedsBootstrap = false;
      console.warn("Could not check customer service setup status", error.message);
    }
  }

  function updateUserUi() {
    const bootstrapCard = el("bootstrapCard");
    const loginCard = el("loginCard");
    const workArea = el("workArea");
    const state = el("csUserState");
    const managerPanel = el("managerPanel");
    const complaintTrackingPanel = el("complaintTrackingPanel");
    const compensationPanel = el("compensationPanel");
    const compensationReportBtn = el("loadCompensationReportBtn");

    if (setupNeedsBootstrap) {
      showElement(bootstrapCard);
      hideElement(loginCard);
      hideElement(workArea);
      hideElement(managerPanel);
      hideElement(complaintTrackingPanel);
      hideElement(compensationPanel);
      removeUserManagementPanel();

      if (state) {
        state.innerHTML = `
          <span class="page-pill">إعداد أول مرة</span>
          <span class="page-pill">أنشئ أول مدير خدمة عملاء</span>
        `;
      }

      return;
    }

    hideElement(bootstrapCard);

    if (!currentUser) {
      hideElement(loginCard);
      hideElement(workArea);
      hideElement(managerPanel);
      hideElement(complaintTrackingPanel);
      hideElement(compensationPanel);
      removeUserManagementPanel();

      if (state) {
        state.innerHTML = `
          <span class="page-pill">جلسة الدخول الرئيسية مطلوبة</span>
          <span class="page-pill">أعد تسجيل الدخول من لوحة الإدارة</span>
        `;
      }

      return;
    }

    hideElement(loginCard);
    showElement(workArea);
    if (["agent", "manager", "admin"].includes(currentUser.role)) showElement(complaintTrackingPanel);
    else hideElement(complaintTrackingPanel);
    showElement(compensationPanel);
    if (compensationReportBtn) {
      if (canAccountCompensation()) showElement(compensationReportBtn);
      else hideElement(compensationReportBtn);
    }
    if (el("compensationRoleBadge")) {
      el("compensationRoleBadge").textContent = roleLabel(currentUser.role);
    }

    if (state) {
      state.innerHTML = `
        <span class="page-pill">${escapeHtml(roleLabel(currentUser.role))}</span>
        <span class="page-pill">${escapeHtml(currentUser.fullName || currentUser.username)}</span>
        <span class="page-pill">المستخدم الداخلي: ${escapeHtml(currentUser.username)}</span>
      `;
    }

    if (managerPanel) {
      if (isManagerUser()) {
        showElement(managerPanel);
        removeUserManagementPanel();
      } else {
        hideElement(managerPanel);
        removeUserManagementPanel();
      }
    }
  }

  async function performLogin(username, password) {
    const data = await request("/internal-login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });

    localStorage.setItem(CS_USER_KEY, JSON.stringify(data.user));

    currentUser = data.user;
    setupNeedsBootstrap = false;

    updateUserUi();

    return data;
  }

  async function bootstrapManager() {
    const fullName = el("bootstrapFullName")?.value?.trim();
    const username = el("bootstrapUsername")?.value?.trim();
    const password = el("bootstrapPassword")?.value || "";

    if (!fullName || !username || !password) {
      setMessage("اكتب اسم المدير واسم المستخدم وكلمة السر.", "error");
      return;
    }

    const btn = el("bootstrapBtn");
    if (btn) btn.disabled = true;

    try {
      await request("/bootstrap-manager", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          username,
          password
        })
      });

      await performLogin(username, password);

      setMessage("تم إنشاء أول مدير وتسجيل الدخول بنجاح.", "success");

    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function login() {
    const username = el("loginUsername")?.value?.trim();
    const password = el("loginPassword")?.value || "";

    if (!username || !password) {
      setMessage("اكتب اسم المستخدم وكلمة السر الداخلية.", "error");
      return;
    }

    const btn = el("loginBtn");
    if (btn) btn.disabled = true;

    try {
      await performLogin(username, password);

      setMessage("تم تسجيل الدخول الداخلي بنجاح.", "success");

      await autoSearchFromUrlAfterLogin();

      if (isAdminUser()) {
        await loadUsers();
      }
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function logout() {
    try {
      await request("/internal-logout", {
        method: "POST",
        body: JSON.stringify({
          token: ""
        })
      });
    } catch (error) {
      console.warn(error);
    }

    localStorage.removeItem(CS_USER_KEY);

    currentUser = null;
    lastInvoices = [];
    renderResults([]);
    updateUserUi();
    setMessage("تم تسجيل الخروج الداخلي.", "success");
  }

  async function verifySession() {
    let sessionWarning = "";

    try {
      const data = await request("/me");
      currentUser = data.user;
      localStorage.setItem(CS_USER_KEY, JSON.stringify(data.user));
    } catch (error) {
      localStorage.removeItem(CS_USER_KEY);
      currentUser = buildMainSessionFallbackUser();

      if (currentUser) {
        sessionWarning =
          "تم فتح الصفحة بجلسة المشروع، لكن تعذر الاتصال بخدمة المتابعة.";
        console.warn("Customer service session initialization failed", error.message);
      }
    }

    updateUserUi();

    if (sessionWarning) {
      setMessage(sessionWarning, "error");
    }
  }

  function buildSearchQuery() {
    const params = new URLSearchParams();

    const companyId = getSelectedCompanyId(true);
    const dateFrom = el("dateFrom")?.value || "";
    const dateTo = el("dateTo")?.value || "";
    const customerPhone = el("customerPhone")?.value?.trim() || "";
    const invoiceRef = el("invoiceRef")?.value?.trim() || "";
    const configId = el("configId")?.value?.trim() || "";

    if (!companyId) {
      throw new Error("لازم تختار الشركة قبل البحث.");
    }

    params.set("companyId", companyId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (customerPhone) params.set("customerPhone", customerPhone);
    if (invoiceRef) params.set("invoiceRef", invoiceRef);
    if (configId) params.set("configId", configId);

    params.set("limit", "100");
    params.set("linesLimit", "10000");

    return params;
  }

  async function searchInvoices() {
    const customerPhone = el("customerPhone")?.value?.trim() || "";
    const invoiceRef = el("invoiceRef")?.value?.trim() || "";

    if (!customerPhone && !invoiceRef) {
      setMessage("اكتب رقم عميل أو رقم فاتورة Odoo للبحث.", "error");
      return;
    }

    const btn = el("searchBtn");
    if (btn) btn.disabled = true;

    setMessage("جاري البحث...", "success");

    try {
      const params = buildSearchQuery();
      const data = await request(`/search?${params.toString()}`);

      lastInvoices = data.invoices || [];

      renderSummary(data.summary || {});
      renderResults(lastInvoices);

      if (!lastInvoices.length) {
        setMessage("لا توجد فواتير مطابقة.", "error");
      } else {
        setMessage(`تم العثور على ${lastInvoices.length} فاتورة.`, "success");
      }
    } catch (error) {
      renderResults([]);
      setMessage(error.message, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderSummary(summary) {
    const card = el("summaryCard");
    showElement(card);

    if (el("invoiceCount")) {
      el("invoiceCount").textContent = formatNumber(summary.invoiceCount || 0);
    }

    if (el("totalAmount")) {
      el("totalAmount").textContent = formatMoney(summary.totalAmount || 0);
    }
  }

  function renderResults(invoices) {
    const container = el("results");
    if (!container) return;

    if (!invoices || !invoices.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = invoices.map(renderInvoiceCard).join("");

    invoices.forEach((invoice) => {
      const openBtn = document.querySelector(`[data-open-invoice="${invoice.posOrderId}"]`);
      if (openBtn) {
        openBtn.addEventListener("click", () => logOpenInvoice(invoice));
      }

      // Bind save directly on every freshly rendered invoice card.
      // A capture-phase delegated fallback also exists in bindEvents().
      const saveBtn = findDataElement("[data-save-note]", "saveNote", invoice.posOrderId);
      if (saveBtn && !saveBtn.dataset.saveBound) {
        saveBtn.dataset.saveBound = "1";
        saveBtn.addEventListener("click", (event) => handleSaveNoteClick(saveBtn, event));
      }
      syncFinancialReviewRequestUi(invoice.posOrderId);

      document
        .querySelector(`[data-print-receipt="${invoice.posOrderId}"]`)
        ?.addEventListener("click", () => printThermalReceipt(invoice));

      document
        .querySelector(`[data-download-odoo-pdf="${invoice.posOrderId}"]`)
        ?.addEventListener("click", (event) => downloadOfficialOdooPdf(invoice, event.currentTarget));
    });
  }

  function renderInvoiceCard(invoice) {
    const lines = invoice.lines || [];

    const rows = lines.map((line) => `
      <tr>
        <td>${escapeHtml(line.productName || "-")}</td>
        <td class="num">${formatNumber(line.quantity || 0, 3)}</td>
        <td class="num">${formatMoney(line.unitPrice || 0)}</td>
        <td class="num">${formatMoney(line.lineTotal || 0)}</td>
      </tr>
    `).join("");

    return `
      <article class="report-card">
        <div class="report-card-head">
          <div>
            <h2>
              رقم الفاتورة: ${escapeHtml(invoice.invoiceRef || "-")}
              <span class="muted">— رقم الطلب: ${escapeHtml(invoice.orderNumber || "-")}</span>
            </h2>
            <p>
              ${escapeHtml(formatDate(invoice.dateOrder))}
              — العميل: ${escapeHtml(invoice.customerName || "-")}
              — رقم العميل: ${escapeHtml(invoice.customerPhone || "-")}
            </p>
          </div>

          <div class="inventory-hero-actions">
            <button class="run-btn" type="button" data-print-receipt="${escapeHtml(invoice.posOrderId)}">
              طباعة إيصال 80mm
            </button>
            <button class="export-btn" type="button" data-download-odoo-pdf="${escapeHtml(invoice.posOrderId)}">
              ${invoice.accountMoveId ? "فاتورة Odoo PDF" : "فاتورة POS بصيغة PDF"}
            </button>
            <button class="run-btn" type="button" data-open-invoice="${escapeHtml(invoice.posOrderId)}">
              تسجيل فتح الفاتورة
            </button>
          </div>
        </div>

        <div class="inventory-kpi-grid">
          <div class="inventory-kpi-card">
            <span>الإجمالي</span>
            <strong>${formatMoney(invoice.amountTotal || 0)}</strong>
            <small>قيمة الفاتورة</small>
          </div>

          <div class="inventory-kpi-card">
            <span>الفرع / POS</span>
            <strong>${escapeHtml(invoice.configName || invoice.branchCode || "-")}</strong>
            <small>نقطة البيع</small>
          </div>

          <div class="inventory-kpi-card">
            <span>الكاشير</span>
            <strong>${escapeHtml(invoice.cashierName || "-")}</strong>
            <small>منفذ الفاتورة</small>
          </div>

          <div class="inventory-kpi-card">
            <span>طريقة السداد</span>
            <strong>${escapeHtml(invoice.paymentSummary || "-")}</strong>
            <small>Payment Summary</small>
          </div>
        </div>

        <div class="inventory-table-wrap">
          <table class="inventory-data-table report-table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الكمية</th>
                <th>سعر الوحدة</th>
                <th>إجمالي السطر</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="4">لا توجد سطور لهذه الفاتورة.</td></tr>`}
            </tbody>
          </table>
        </div>

        <section class="inventory-report-card">
          <h3>ملاحظة خدمة العملاء</h3>

          <div class="report-filter-grid">
            <label class="report-field">
              نوع الملاحظة
              <select id="noteType-${escapeHtml(invoice.posOrderId)}" class="report-select">
                <option value="general">عام</option>
                <option value="inquiry">استفسار</option>
                <option value="complaint">شكوى</option>
                <option value="purchase_confirmation">تأكيد شراء</option>
                <option value="price_review">مراجعة سعر</option>
                <option value="payment_issue">مشكلة دفع</option>
                <option value="product_issue">مشكلة منتج</option>
                <option value="other">أخرى</option>
              </select>
            </label>
          </div>

          <label class="report-field">
            نص الملاحظة
            <textarea id="noteText-${escapeHtml(invoice.posOrderId)}" class="report-input" placeholder="اكتب نتيجة المكالمة أو مراجعة العميل..."></textarea>
          </label>

          ${canCreateCompensation() ? `
          <label class="financial-review-toggle">
            <input type="checkbox" data-financial-review-toggle="${escapeHtml(invoice.posOrderId)}" />
            <span>
              <strong>يتطلب مراجعة وتحقق مالي</strong>
              <small>يتم تسجيل الطلب مع الشكوى، ولا ينتقل للمراجعة المالية إلا بعد موافقة المدير المختص.</small>
            </span>
          </label>

          <div id="financialReviewFields-${escapeHtml(invoice.posOrderId)}" class="report-filter-grid financial-review-fields hidden" aria-hidden="true">
            <label class="report-field">
              موضوع المراجعة المالية
              <select id="compIssueType-${escapeHtml(invoice.posOrderId)}" class="report-select">
                <option value="missing_product">منتج لم يستلمه العميل</option>
                <option value="price_difference">فرق سعر</option>
                <option value="payment_difference">فرق / خطأ دفع</option>
                <option value="wrong_product">منتج خاطئ</option>
                <option value="quality_issue">مشكلة جودة</option>
                <option value="other">أخرى</option>
              </select>
            </label>
            <label class="report-field">
              مبلغ محل المراجعة (اختياري)
              <input id="compRequestedAmount-${escapeHtml(invoice.posOrderId)}" class="report-input" type="number" min="0" step="0.01" placeholder="المبلغ النهائي يحدده مسار المراجعة" />
            </label>
          </div>` : ""}
          <div class="inventory-hero-actions">
            <button class="run-btn" type="button" data-save-note="${escapeHtml(invoice.posOrderId)}">
              حفظ وإرسال للمدير
            </button>
          </div>
        </section>
      </article>
    `;
  }

  async function logOpenInvoice(invoice) {
    try {
      await request("/open-invoice", {
        method: "POST",
        body: JSON.stringify({ invoice })
      });

      setMessage("تم تسجيل فتح الفاتورة في سجل الحركات.", "success");
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function saveNote(invoice) {
    const financialReviewRequested = Boolean(
      findDataElement("[data-financial-review-toggle]", "financialReviewToggle", invoice.posOrderId)?.checked
    );
    const selectedNoteType = el(`noteType-${invoice.posOrderId}`)?.value || "general";
    const noteType = financialReviewRequested ? "complaint" : selectedNoteType;
    const noteTextInput = el(`noteText-${invoice.posOrderId}`);
    const amountInput = el(`compRequestedAmount-${invoice.posOrderId}`);
    clearFieldError(noteTextInput);
    clearFieldError(amountInput);

    const plainNoteText = noteTextInput?.value?.trim() || "";

    if (!plainNoteText) {
      const message = "اكتب نص الملاحظة أولًا.";
      setMessage(message, "error");
      setFieldError(noteTextInput, message);
      return;
    }

    const issueType = el(`compIssueType-${invoice.posOrderId}`)?.value || "other";
    const requestedRaw = amountInput?.value;
    const requestedAmount = requestedRaw === "" || requestedRaw === null || requestedRaw === undefined
      ? null
      : Number(requestedRaw);

    if (financialReviewRequested && requestedAmount !== null && (!Number.isFinite(requestedAmount) || requestedAmount < 0)) {
      const message = "مبلغ المراجعة المالية غير صالح.";
      setMessage(message, "error");
      setFieldError(amountInput, message);
      return;
    }

    try {
      const companyId = invoice.companyId || el("companyId")?.value || null;

      const data = await request("/notes", {
        method: "POST",
        body: JSON.stringify({
          companyId,
          branchCode: invoice.branchCode || invoice.configName || null,
          customerPhone: invoice.customerPhone || null,
          customerName: invoice.customerName || null,
          odooPartnerId: invoice.partnerId || null,
          posOrderId: invoice.posOrderId || null,
          invoiceRef: invoice.invoiceRef || null,
          orderNumber: invoice.orderNumber || null,
          posReference: invoice.posReference || null,
          invoiceDate: invoice.dateOrder || null,
          noteType,
          noteText: plainNoteText,
          financialReviewRequested,
          financialReviewIssueType: financialReviewRequested ? issueType : null,
          financialReviewRequestedAmount: financialReviewRequested ? requestedAmount : null
        })
      });

      const noteId = data?.note?.id;

      if (!noteId) {
        throw new Error("تم حفظ الملاحظة لكن لم يتم استلام رقمها من السيرفر.");
      }

      await request(`/notes/${noteId}/submit`, {
        method: "PATCH",
        body: JSON.stringify({})
      });

      setMessage(
        financialReviewRequested
          ? `تم تسجيل الشكوى رقم ${noteId}. طلب المراجعة المالية الآن بانتظار موافقة المدير المختص، ولم يتم تحويله للمراقبة بعد.`
          : `تم حفظ الملاحظة رقم ${noteId} وإرسالها للمدير.`,
        "success"
      );

      const textarea = el(`noteText-${invoice.posOrderId}`);
      if (textarea) {
        textarea.value = "";
        clearFieldError(textarea);
      }
      clearFieldError(el(`compRequestedAmount-${invoice.posOrderId}`));
      const checkbox = findDataElement("[data-financial-review-toggle]", "financialReviewToggle", invoice.posOrderId);
      if (checkbox) checkbox.checked = false;
      syncFinancialReviewRequestUi(invoice.posOrderId);
      if (financialReviewRequested) await loadComplaintTracking();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  function noteBaseStatusLabel(status) {
    const labels = { draft: "مسودة", submitted: "بانتظار موافقة المدير", approved: "تم تصديق المدير", returned: "مرتجع لخدمة العملاء", closed: "مغلق" };
    return labels[status] || status || "-";
  }

  function financialWorkflowStatusLabel(status) {
    const labels = {
      draft: "طلب مالي في مسودة الشكوى",
      pending_manager_approval: "بانتظار موافقة المدير المختص",
      approved_pending_financial_ticket: "تم التصديق - بانتظار فتح تذكرة المراجعة",
      pending_monitor_review: "بانتظار مراجعة الكاميرات",
      monitor_rejected: "غير مستحق بعد مراجعة الكاميرات",
      pending_accounting_approval: "تم تأكيد الاستحقاق - لدى المحاسب",
      accounting_rejected: "مرفوض محاسبيًا",
      odoo_posting: "بدأت إجراءات الصرف - جاري قيد Odoo",
      awaiting_payment: "تم قيد Odoo - بانتظار الصرف النقدي",
      paid: "تم الدفع وإغلاق التعويض",
      failed: "تعثر قيد Odoo - لدى المحاسب",
      cancelled: "ملغي",
      returned_to_customer_service: "مرتجع لخدمة العملاء",
      closed_without_financial_review: "مغلق دون استكمال المراجعة المالية"
    };
    return labels[status] || status || "-";
  }

  function effectiveFinancialStatus(note, ticket = null) {
    if (!note?.financialReviewRequested) return null;
    if (ticket?.status) return ticket.status;
    if (note.financialWorkflowStatus) return note.financialWorkflowStatus;
    if (note.status === "approved") return "approved_pending_financial_ticket";
    if (note.status === "returned") return "returned_to_customer_service";
    if (note.status === "closed") return "closed_without_financial_review";
    if (note.status === "draft") return "draft";
    return "pending_manager_approval";
  }

  async function loadComplaintTracking() {
    const content = el("complaintTrackingContent");
    if (!content || !currentUser || ["monitor", "accountant"].includes(currentUser.role)) return;
    content.innerHTML = `<div class="inventory-empty">جاري تحميل حالات الشكاوى...</div>`;
    try {
      const params = new URLSearchParams();
      const companyId = getSelectedCompanyId(false);
      if (companyId) params.set("companyId", companyId);
      params.set("status", "all");
      params.set("limit", "300");
      const data = await request(`/notes?${params.toString()}`);
      const notes = (data.notes || []).filter((note) => note.noteType === "complaint");
      if (!notes.length) {
        content.innerHTML = `<div class="inventory-empty">لا توجد شكاوى مسجلة ضمن النطاق الحالي.</div>`;
        return;
      }
      content.innerHTML = `<div class="inventory-table-wrap"><table class="inventory-data-table report-table">
        <thead><tr><th>#</th><th>التاريخ</th><th>الفاتورة</th><th>العميل</th><th>حالة المدير</th><th>الحالة الحالية</th><th>تذكرة المالية</th><th>نتيجة الكاميرات</th><th>Odoo</th><th>الصرف</th></tr></thead>
        <tbody>${notes.map((note) => {
          const status = effectiveFinancialStatus(note);
          const monitorText = note.financialMonitorDecision === "eligible" ? `مستحق${note.financialMonitorAmount != null ? ` — ${formatMoney(note.financialMonitorAmount)}` : ""}` : note.financialMonitorDecision === "not_eligible" ? "غير مستحق" : "-";
          const odooText = note.financialOdooMoveName || note.financialOdooPostingStatus || "-";
          const paymentText = note.financialPaymentStatus === "paid" ? `تم الدفع${note.financialPaidAmount != null ? ` — ${formatMoney(note.financialPaidAmount)}` : ""}` : (note.financialPaymentStatus || "-");
          return `<tr><td>${escapeHtml(note.id)}</td><td>${escapeHtml(formatDate(note.createdAt))}</td><td>${escapeHtml(note.invoiceRef || "-")}</td><td>${escapeHtml(note.customerName || note.customerPhone || "-")}</td><td>${escapeHtml(noteBaseStatusLabel(note.status))}</td><td><strong>${escapeHtml(status ? financialWorkflowStatusLabel(status) : noteBaseStatusLabel(note.status))}</strong></td><td>${note.financialTicketId ? `<a class="financial-review-link" href="./financial-review.html?ticket=${encodeURIComponent(note.financialTicketId)}&companyId=${encodeURIComponent(note.companyId || "")}">#${escapeHtml(note.financialTicketId)}</a>` : "-"}</td><td>${escapeHtml(monitorText)}</td><td>${escapeHtml(odooText)}</td><td>${escapeHtml(paymentText)}</td></tr>`;
        }).join("")}</tbody></table></div>`;
    } catch (error) {
      content.innerHTML = `<div class="inventory-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  async function loadFinancialTicketIndex(companyId) {
    try {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", companyId);
      params.set("limit", "300");
      const data = await request(`/compensations?${params.toString()}`);
      const index = new Map();
      (data.compensations || []).forEach((row) => {
        if (row.noteId !== null && row.noteId !== undefined) {
          index.set(String(row.noteId), row);
        }
      });
      return index;
    } catch (error) {
      console.warn("Could not load financial review ticket index", error.message);
      return new Map();
    }
  }

  async function loadNotes() {
    const content = el("managerContent");
    if (!content) return;

    content.innerHTML = `<div class="inventory-empty">جاري تحميل الملاحظات...</div>`;

    try {
      const status = el("notesStatus")?.value || "submitted";
      const params = new URLSearchParams();
      const companyId = getSelectedCompanyId(false);

      if (companyId) params.set("companyId", companyId);
      params.set("status", status);
      params.set("limit", "300");

      const [data, financialTicketIndex] = await Promise.all([
        request(`/notes?${params.toString()}`),
        loadFinancialTicketIndex(companyId)
      ]);

      const notes = data.notes || [];

      if (!notes.length) {
        content.innerHTML = `<div class="inventory-empty">لا توجد ملاحظات.</div>`;
        return;
      }

      content.innerHTML = `
        <div class="inventory-table-wrap">
          <table class="inventory-data-table report-table">
            <thead>
              <tr>
                <th>رقم</th>
                <th>الحالة</th>
                <th>الموظف</th>
                <th>العميل</th>
                <th>الفاتورة</th>
                <th>الملاحظة</th>
                <th>المراجعة المالية</th>
                <th>تعليق المدير</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              ${notes.map((note) => renderManagerNoteRow(note, financialTicketIndex.get(String(note.id)))).join("")}
            </tbody>
          </table>
        </div>
      `;

      notes.forEach((note) => {
        const existingTicket = financialTicketIndex.get(String(note.id)) || null;
        const approveBtn = document.querySelector(`[data-approve-note="${note.id}"]`);
        const returnBtn = document.querySelector(`[data-return-note="${note.id}"]`);
        const closeBtn = document.querySelector(`[data-close-note="${note.id}"]`);
        const retryFinancialBtn = document.querySelector(`[data-create-financial-ticket="${note.id}"]`);

        if (approveBtn) approveBtn.addEventListener("click", () => managerAction(note, "approve", existingTicket));
        if (returnBtn) returnBtn.addEventListener("click", () => managerAction(note, "return", existingTicket));
        if (closeBtn) closeBtn.addEventListener("click", () => managerAction(note, "close", existingTicket));
        if (retryFinancialBtn) retryFinancialBtn.addEventListener("click", () => retryFinancialReviewTicket(note));
      });
    } catch (error) {
      content.innerHTML = "";
      setMessage(error.message, "error");
    }
  }

  function renderManagerNoteRow(note, existingTicket = null) {
    const financialRequest = note.financialReviewRequested
      ? {
          issueType: note.financialReviewIssueType || "other",
          requestedAmount: note.financialReviewRequestedAmount
        }
      : null;
    let financialCell = `<span class="inventory-muted-text">لا يوجد طلب مالي</span>`;
    const financialMeta = financialRequest
      ? `<small class="financial-review-meta">${escapeHtml(compensationIssueLabel(financialRequest.issueType))}${financialRequest.requestedAmount !== null && financialRequest.requestedAmount !== undefined ? ` — ${formatMoney(financialRequest.requestedAmount)}` : " — المبلغ غير محدد"}</small>`
      : "";

    if (financialRequest) {
      if (existingTicket) {
        const liveStatus = effectiveFinancialStatus(note, existingTicket);
        financialCell = `
          <span class="financial-review-badge approved">${escapeHtml(financialWorkflowStatusLabel(liveStatus))}</span>
          <a class="financial-review-link" href="./financial-review.html?ticket=${encodeURIComponent(existingTicket.id)}&companyId=${encodeURIComponent(note.companyId || "")}">تذكرة #${escapeHtml(existingTicket.id)}</a>
          ${financialMeta}
          ${existingTicket.monitorDecision === "eligible" && existingTicket.monitorAmount != null ? `<small class="financial-review-meta">المراقب أكد: ${formatMoney(existingTicket.monitorAmount)}</small>` : ""}
          ${existingTicket.odooMoveName ? `<small class="financial-review-meta">قيد Odoo: ${escapeHtml(existingTicket.odooMoveName)}</small>` : ""}
        `;
      } else if (note.status === "approved") {
        financialCell = `
          <span class="financial-review-badge pending">تمت الموافقة ولم تُنشأ التذكرة</span>
          ${financialMeta}
          <button class="export-btn financial-review-retry" type="button" data-create-financial-ticket="${escapeHtml(note.id)}">إعادة إرسال للمراجعة المالية</button>
        `;
      } else if (note.status === "returned" || note.status === "closed") {
        financialCell = `<span class="financial-review-badge rejected">لم يتم النقل</span>${financialMeta}`;
      } else {
        financialCell = `<span class="financial-review-badge pending">بانتظار موافقة المدير</span>${financialMeta}`;
      }
    }

    const approveLabel = financialRequest && !existingTicket
      ? "تصديق ونقل للمراجعة المالية"
      : "تصديق";
    const managerActions = existingTicket
      ? `<span class="inventory-muted-text">انتقلت للمسار المالي — متابعة فقط</span>`
      : `<div class="inventory-hero-actions">
          <button class="run-btn" type="button" data-approve-note="${escapeHtml(note.id)}">${approveLabel}</button>
          <button class="run-btn" type="button" data-return-note="${escapeHtml(note.id)}">إرجاع</button>
          <button class="run-btn" type="button" data-close-note="${escapeHtml(note.id)}">إغلاق</button>
        </div>`;

    return `
      <tr>
        <td>${escapeHtml(note.id)}</td>
        <td>${escapeHtml(noteBaseStatusLabel(note.status))}</td>
        <td>${escapeHtml(note.createdByName || note.createdBy || "-")}</td>
        <td>
          ${escapeHtml(note.customerName || "-")}
          <br />
          <span class="inventory-muted-text">${escapeHtml(note.customerPhone || "-")}</span>
        </td>
        <td>${escapeHtml(note.invoiceRef || "-")}</td>
        <td>${escapeHtml(note.noteText || "-")}</td>
        <td>${financialCell}</td>
        <td>
          <textarea id="managerComment-${escapeHtml(note.id)}" class="report-input" placeholder="تعليق المدير"></textarea>
        </td>
        <td>${managerActions}</td>
      </tr>
    `;
  }

  async function retryFinancialReviewTicket(note) {
    if (!note.financialReviewRequested) {
      setMessage("هذه الشكوى لا تحتوي على طلب مراجعة مالية.", "error");
      return;
    }

    try {
      const data = await request(`/notes/${encodeURIComponent(note.id)}/financial-review-ticket`, {
        method: "POST",
        body: JSON.stringify({})
      });
      const ticketId = data?.compensation?.id;
      if (!ticketId) throw new Error("لم يتم استلام رقم تذكرة المراجعة المالية.");
      setMessage(`تم إنشاء/استعادة تذكرة المراجعة المالية رقم ${ticketId}. الحالة الآن بانتظار المراقبة.`, "success");
      await loadNotes();
      await loadComplaintTracking();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function managerAction(note, action, existingTicket = null) {
    const noteId = note.id;
    const managerComment = el(`managerComment-${noteId}`)?.value?.trim() || "";
    const financialReviewRequested = Boolean(note.financialReviewRequested);

    try {
      const data = await request(`/notes/${noteId}/${action}`, {
        method: "PATCH",
        body: JSON.stringify({ managerComment })
      });

      if (action === "approve" && financialReviewRequested) {
        const ticketId = data?.financialReviewTicket?.id || existingTicket?.id || null;
        if (ticketId) {
          setMessage(`تم تصديق الشكوى وإنشاء/تأكيد تذكرة المراجعة المالية رقم ${ticketId}. الحالة الآن بانتظار المراقبة.`, "success");
        } else if (data?.financialReviewTicketError) {
          setMessage(`تم تصديق الشكوى، لكن تعذر إنشاء تذكرة المراجعة المالية: ${data.financialReviewTicketError}. استخدم زر إعادة الإرسال من حالة «تم التصديق».`, "error");
        } else {
          setMessage("تم تصديق الشكوى. يمكن إعادة إرسالها للمراجعة المالية من حالة «تم التصديق» إذا لم تظهر التذكرة.", "success");
        }
      } else {
        setMessage("تم تنفيذ إجراء المدير.", "success");
      }
      await loadNotes();
      await loadComplaintTracking();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function loadActivity() {
    const content = el("managerContent");
    if (!content) return;

    content.innerHTML = `<div class="inventory-empty">جاري تحميل سجل الحركات...</div>`;

    try {
      const params = new URLSearchParams();
      const companyId = getSelectedCompanyId(false);

      if (companyId) params.set("companyId", companyId);
      params.set("limit", "300");

      const data = await request(`/activity?${params.toString()}`);
      const rows = data.rows || [];

      if (!rows.length) {
        content.innerHTML = `<div class="inventory-empty">لا توجد حركات مسجلة.</div>`;
        return;
      }

      content.innerHTML = `
        <div class="inventory-table-wrap">
          <table class="inventory-data-table report-table">
            <thead>
              <tr>
                <th>الوقت</th>
                <th>المستخدم</th>
                <th>الحركة</th>
                <th>العميل</th>
                <th>الفاتورة</th>
                <th>بيانات إضافية</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td>${escapeHtml(formatDate(row.created_at))}</td>
                  <td>${escapeHtml(row.user_full_name || row.username || row.user_id || "-")}</td>
                  <td>${escapeHtml(row.action || "-")}</td>
                  <td>${escapeHtml(row.customer_phone || "-")}</td>
                  <td>${escapeHtml(row.invoice_ref || "-")}</td>
                  <td>${escapeHtml(row.metadata ? JSON.stringify(row.metadata) : "-")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      content.innerHTML = "";
      setMessage(error.message, "error");
    }
  }

  function ensureUserManagementPanel() {
    if (!isAdminUser()) {
      removeUserManagementPanel();
      return;
    }

    const managerPanel = el("managerPanel");
    if (!managerPanel || el("userManagementPanel")) {
      bindUserManagementEvents();
      return;
    }

    const panel = document.createElement("section");
    panel.id = "userManagementPanel";
    panel.className = "report-card";

    panel.innerHTML = `
      <div class="report-card-head">
        <h2>إدارة مستخدمي خدمة العملاء</h2>
        <p>إنشاء موظفين ومديرين، تفعيل أو إيقاف المستخدم، وتغيير كلمة السر.</p>
      </div>

      <section class="inventory-report-card">
        <h3>إضافة مستخدم جديد</h3>

        <div class="report-filter-grid">
          <label class="report-field">
            الاسم
            <input id="newCsFullName" class="report-input" type="text" placeholder="اسم الموظف" />
          </label>

          <label class="report-field">
            اسم المستخدم
            <input id="newCsUsername" class="report-input" type="text" placeholder="مثال: cs.agent2" />
          </label>

          <label class="report-field">
            كلمة السر
            <input id="newCsPassword" class="report-input" type="password" placeholder="6 أحرف على الأقل" />
          </label>

          <label class="report-field">
            الدور
            <select id="newCsRole" class="report-select">
              <option value="agent">موظف خدمة عملاء</option>
              <option value="monitor">مراقب / كاميرات</option>
              <option value="accountant">محاسب</option>
              <option value="manager">مدير خدمة عملاء</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>

        <div class="inventory-hero-actions">
          <button class="run-btn" id="createCsUserBtn" type="button">
            إضافة المستخدم
          </button>
        </div>
      </section>

      <section class="inventory-report-card">
        <h3>المستخدمون الحاليون</h3>

        <div class="report-filter-grid">
          <label class="report-field">
            بحث
            <input id="csUsersSearch" class="report-input" type="text" placeholder="اسم أو username" />
          </label>

          <label class="report-field">
            الدور
            <select id="csUsersRoleFilter" class="report-select">
              <option value="all">كل الأدوار</option>
              <option value="agent">موظف خدمة عملاء</option>
              <option value="monitor">مراقب / كاميرات</option>
              <option value="accountant">محاسب</option>
              <option value="manager">مدير</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>

        <div class="inventory-hero-actions">
          <button class="run-btn" id="loadCsUsersBtn" type="button">
            تحميل المستخدمين
          </button>
        </div>

        <div id="csUsersTable"></div>
      </section>
    `;

    managerPanel.appendChild(panel);
    bindUserManagementEvents();
  }

  function bindUserManagementEvents() {
    if (userManagementEventsBound) return;
    userManagementEventsBound = true;

    document.addEventListener("click", async (event) => {
      const createBtn = event.target.closest("#createCsUserBtn");
      if (createBtn) {
        await createCsUser();
        return;
      }

      const loadBtn = event.target.closest("#loadCsUsersBtn");
      if (loadBtn) {
        await loadUsers();
        return;
      }

      const updateBtn = event.target.closest("[data-update-cs-user]");
      if (updateBtn) {
        await updateCsUser(updateBtn.dataset.updateCsUser);
        return;
      }

      const passwordBtn = event.target.closest("[data-reset-cs-password]");
      if (passwordBtn) {
        await resetCsUserPassword(passwordBtn.dataset.resetCsPassword);
      }
    });
  }

  async function createCsUser() {
    if (!isAdminUser()) {
      setMessage("إدارة مستخدمي خدمة العملاء متاحة للـ Admin فقط.", "error");
      return;
    }

    const fullName = el("newCsFullName")?.value?.trim();
    const username = el("newCsUsername")?.value?.trim();
    const password = el("newCsPassword")?.value || "";
    const role = el("newCsRole")?.value || "agent";

    if (!fullName || !username || !password) {
      setMessage("اكتب الاسم واسم المستخدم وكلمة السر.", "error");
      return;
    }

    try {
      await request("/users", {
        method: "POST",
        body: JSON.stringify({ fullName, username, password, role })
      });

      setMessage("تم إضافة المستخدم بنجاح.", "success");

      if (el("newCsFullName")) el("newCsFullName").value = "";
      if (el("newCsUsername")) el("newCsUsername").value = "";
      if (el("newCsPassword")) el("newCsPassword").value = "";
      if (el("newCsRole")) el("newCsRole").value = "agent";

      await loadUsers();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function loadUsers() {
    if (!isAdminUser()) return;

    const container = el("csUsersTable");
    if (container) {
      container.innerHTML = `<div class="inventory-empty">جاري تحميل المستخدمين...</div>`;
    }

    try {
      const params = new URLSearchParams();

      const search = el("csUsersSearch")?.value?.trim() || "";
      const role = el("csUsersRoleFilter")?.value || "all";
      const companyId = getSelectedCompanyId(false);

      if (companyId) params.set("companyId", companyId);
      if (search) params.set("search", search);
      if (role && role !== "all") params.set("role", role);
      params.set("limit", "300");

      const data = await request(`/users?${params.toString()}`);

      renderCsUsers(data.users || []);
    } catch (error) {
      if (container) container.innerHTML = "";
      setMessage(error.message, "error");
    }
  }

  function renderCsUsers(users) {
    const container = el("csUsersTable");
    if (!container) return;

    if (!users.length) {
      container.innerHTML = `<div class="inventory-empty">لا يوجد مستخدمون.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="inventory-table-wrap">
        <table class="inventory-data-table report-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>اسم المستخدم</th>
              <th>الدور</th>
              <th>نشط</th>
              <th>تاريخ الإنشاء</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            ${users.map((user) => `
              <tr>
                <td>${escapeHtml(user.fullName || "-")}</td>
                <td>${escapeHtml(user.username || "-")}</td>
                <td>
                  <select class="report-select" data-cs-user-role="${escapeHtml(user.id)}">
                    <option value="agent" ${user.role === "agent" ? "selected" : ""}>موظف خدمة عملاء</option>
                    <option value="monitor" ${user.role === "monitor" ? "selected" : ""}>مراقب / كاميرات</option>
                    <option value="accountant" ${user.role === "accountant" ? "selected" : ""}>محاسب</option>
                    <option value="manager" ${user.role === "manager" ? "selected" : ""}>مدير</option>
                    <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    data-cs-user-active="${escapeHtml(user.id)}"
                    ${user.isActive ? "checked" : ""}
                  />
                </td>
                <td>${escapeHtml(formatDate(user.createdAt))}</td>
                <td>
                  <div class="inventory-hero-actions">
                    <button class="run-btn" type="button" data-update-cs-user="${escapeHtml(user.id)}">
                      حفظ
                    </button>
                    <button class="run-btn" type="button" data-reset-cs-password="${escapeHtml(user.id)}">
                      تغيير كلمة السر
                    </button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function updateCsUser(userId) {
    if (!isAdminUser()) {
      setMessage("تعديل مستخدمي خدمة العملاء متاح للـ Admin فقط.", "error");
      return;
    }

    const role = document.querySelector(`[data-cs-user-role="${userId}"]`)?.value || "agent";
    const isActive = Boolean(
      document.querySelector(`[data-cs-user-active="${userId}"]`)?.checked
    );

    try {
      await request(`/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify({ role, isActive })
      });

      setMessage("تم تحديث المستخدم.", "success");
      await loadUsers();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function resetCsUserPassword(userId) {
    if (!isAdminUser()) {
      setMessage("تغيير كلمة السر متاح للـ Admin فقط.", "error");
      return;
    }

    const password = window.prompt("اكتب كلمة السر الجديدة للمستخدم:");

    if (!password) return;

    if (String(password).length < 6) {
      setMessage("كلمة السر لازم تكون 6 أحرف على الأقل.", "error");
      return;
    }

    try {
      await request(`/users/${encodeURIComponent(userId)}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password })
      });

      setMessage("تم تغيير كلمة السر.", "success");
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  function clearSearch() {
    if (el("customerPhone")) el("customerPhone").value = "";
    if (el("invoiceRef")) el("invoiceRef").value = "";
    if (el("configId")) el("configId").value = "";
    lastInvoices = [];
    renderResults([]);

    hideElement(el("summaryCard"));
    setMessage("", "success");
  }


  function getReviewSmsApiBase() {
    let apiBaseUrl = "";

    try {
      if (typeof API_BASE_URL !== "undefined" && API_BASE_URL) {
        apiBaseUrl = API_BASE_URL;
      }
    } catch (error) {
      apiBaseUrl = "";
    }

    if (apiBaseUrl) {
      return `${apiBaseUrl.replace(/\/$/, "")}/customer/review-sms`;
    }

    const host = window.location.host;

    if (host.includes("127.0.0.1:5500") || host.includes("localhost:5500")) {
      return "http://localhost:5050/api/customer/review-sms";
    }

    if (host.includes("api.mi.virginiaolive.com")) {
      return "/api/customer/review-sms";
    }

    return "https://api.mi.virginiaolive.com/api/customer/review-sms";
  }

  function getReviewSmsAdminKey() {
    return "";
  }

  async function reviewSmsRequest(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    const mainToken = getMainAuthToken();
    if (mainToken) headers.Authorization = `Bearer ${mainToken}`;

    const response = await fetch(`${getReviewSmsApiBase()}${path}`, {
      ...options,
      headers
    });

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok || data?.success === false) {
      const message =
        data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`;

      throw new Error(message);
    }

    return data;
  }

  function reviewRatingLabel(rating) {
    const value = Number(rating);

    if (value === 5) return "😍 راضٍ جدًا";
    if (value === 3) return "😐 محايد";
    if (value === 1) return "😡 غير راضٍ";

    return rating ? String(rating) : "-";
  }

  function reviewReasonLabel(reason) {
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

    return map[reason] || reason || "-";
  }

  function reviewPriorityLabel(priority) {
    if (priority === "high") return "عالية";
    if (priority === "medium") return "متوسطة";
    if (priority === "low") return "منخفضة";
    return priority || "-";
  }

  function reviewStatusLabel(status) {
    const map = {
      new: "جديد",
      in_progress: "جاري المتابعة",
      contacted: "تم التواصل",
      resolved: "تم الحل",
      closed: "مغلق"
    };

    return map[status] || status || "-";
  }

  function canSetReviewFollowupStatus(status) {
    if (isManagerUser()) return true;

    return ["new", "in_progress", "contacted"].includes(status);
  }

  function buildReviewFollowupQuery() {
    const params = new URLSearchParams();

    const companyId = getSelectedCompanyId(false);
    const status = el("reviewFollowupStatus")?.value || "all";
    const priority = el("reviewFollowupPriority")?.value || "all";
    const customerPhone = el("reviewFollowupPhone")?.value?.trim() || "";
    const orderRef = el("reviewFollowupOrderRef")?.value?.trim() || "";

    if (companyId) params.set("companyId", companyId);
    if (status && status !== "all") params.set("status", status);
    if (priority && priority !== "all") params.set("priority", priority);
    if (customerPhone) params.set("customerPhone", customerPhone);
    if (orderRef) params.set("orderRef", orderRef);

    params.set("limit", "300");

    return params;
  }

  async function loadReviewFollowupStats() {
    try {
      const params = new URLSearchParams();
      const companyId = getSelectedCompanyId(false);

      if (companyId) params.set("companyId", companyId);

      const data = await reviewSmsRequest(`/followups/stats?${params.toString()}`);
      const stats = data.data || {};

      if (el("reviewFollowupTotal")) {
        el("reviewFollowupTotal").textContent = formatNumber(stats.total || 0);
      }

      if (el("reviewFollowupNew")) {
        el("reviewFollowupNew").textContent = formatNumber(stats.new_count || 0);
      }

      if (el("reviewFollowupHigh")) {
        el("reviewFollowupHigh").textContent = formatNumber(stats.high_priority || 0);
      }

      if (el("reviewFollowupResolved")) {
        el("reviewFollowupResolved").textContent = formatNumber(stats.resolved || 0);
      }
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function loadReviewFollowups() {
    const container = el("reviewFollowupsContent");
    if (!container) return;

    container.innerHTML = `<div class="inventory-empty">جاري تحميل متابعات تقييم العملاء...</div>`;

    try {
      const params = buildReviewFollowupQuery();
      const data = await reviewSmsRequest(`/followups?${params.toString()}`);

      const rows = data.data || [];

      await loadReviewFollowupStats();
      renderReviewFollowups(rows);

      if (!rows.length) {
        setMessage("لا توجد متابعات تقييم مطابقة للفلاتر.", "success");
      } else {
        setMessage(`تم تحميل ${rows.length} متابعة تقييم.`, "success");
      }
    } catch (error) {
      container.innerHTML = "";
      setMessage(error.message, "error");
    }
  }

  function renderReviewFollowups(rows) {
    const container = el("reviewFollowupsContent");
    if (!container) return;

    if (!rows.length) {
      container.innerHTML = `<div class="inventory-empty">لا توجد متابعات تقييم عملاء.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="inventory-table-wrap">
        <table class="inventory-data-table report-table">
          <thead>
            <tr>
              <th>رقم</th>
              <th>الأولوية</th>
              <th>الحالة</th>
              <th>التقييم</th>
              <th>سبب عدم الرضا</th>
              <th>ملاحظة العميل</th>
              <th>الفرع</th>
              <th>العميل</th>
              <th>الموبايل</th>
              <th>الفاتورة</th>
              <th>القيمة</th>
              <th>ملاحظة داخلية</th>
              <th>تحديث الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(renderReviewFollowupRow).join("")}
          </tbody>
        </table>
      </div>
    `;

    rows.forEach((row) => {
      const btn = document.querySelector(`[data-update-review-followup="${row.id}"]`);
      if (btn) {
        btn.addEventListener("click", () => updateReviewFollowupStatus(row.id));
      }
    });
  }

  function renderReviewFollowupRow(row) {
    const currentStatus = row.status || "new";

    return `
      <tr>
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(reviewPriorityLabel(row.priority))}</td>
        <td>${escapeHtml(reviewStatusLabel(currentStatus))}</td>
        <td>${escapeHtml(reviewRatingLabel(row.rating))}</td>
        <td>${escapeHtml(reviewReasonLabel(row.dissatisfactionReason))}</td>
        <td>${escapeHtml(row.customerComment || "-")}</td>
        <td>${escapeHtml(row.branchName || "-")}</td>
        <td>
          ${escapeHtml(row.customerName || "-")}
          <br />
          <span class="inventory-muted-text">${escapeHtml(row.customerPhone || "-")}</span>
        </td>
        <td>${escapeHtml(row.customerPhone || "-")}</td>
        <td>${escapeHtml(row.odooOrderName || "-")}</td>
        <td>${formatMoney(row.amountTotal || 0)}</td>
        <td>
          <textarea
            id="reviewFollowupNote-${escapeHtml(row.id)}"
            class="report-input"
            placeholder="ملاحظة المتابعة الداخلية"
          >${escapeHtml(row.internalNote || "")}</textarea>
        </td>
        <td>
          <div class="inventory-hero-actions">
            <select id="reviewFollowupStatus-${escapeHtml(row.id)}" class="report-select">
              <option value="new" ${currentStatus === "new" ? "selected" : ""}>جديد</option>
              <option value="in_progress" ${currentStatus === "in_progress" ? "selected" : ""}>جاري المتابعة</option>
              <option value="contacted" ${currentStatus === "contacted" ? "selected" : ""}>تم التواصل</option>
              <option value="resolved" ${currentStatus === "resolved" ? "selected" : ""} ${isManagerUser() ? "" : "disabled"}>تم الحل</option>
              <option value="closed" ${currentStatus === "closed" ? "selected" : ""} ${isManagerUser() ? "" : "disabled"}>مغلق</option>
            </select>

            <button class="run-btn" type="button" data-update-review-followup="${escapeHtml(row.id)}">
              حفظ
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  async function updateReviewFollowupStatus(id) {
    const status = el(`reviewFollowupStatus-${id}`)?.value || "new";
    const internalNote = el(`reviewFollowupNote-${id}`)?.value?.trim() || "";

    if (!canSetReviewFollowupStatus(status)) {
      setMessage("الموظف يستطيع تحديث الحالة إلى جاري المتابعة أو تم التواصل فقط. الحل والإغلاق للمدير.", "error");
      return;
    }

    try {
      await reviewSmsRequest(`/followups/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          internalNote,
          assignedTo: currentUser?.fullName || currentUser?.username || ""
        })
      });

      setMessage("تم تحديث متابعة التقييم.", "success");
      await loadReviewFollowups();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  function bindReviewFollowupEvents() {
    el("loadReviewFollowupsBtn")?.addEventListener("click", loadReviewFollowups);
    el("refreshReviewFollowupStatsBtn")?.addEventListener("click", loadReviewFollowupStats);

    el("reviewFollowupOrderRef")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loadReviewFollowups();
    });

    el("reviewFollowupPhone")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loadReviewFollowups();
    });
  }



  function compensationStatusLabel(status) {
    const labels = {
      pending_monitor_review: "بانتظار مراجعة المراقبة",
      monitor_rejected: "غير مستحق - المراقبة",
      pending_accounting_approval: "تم تأكيد الاستحقاق - لدى المحاسب",
      accounting_rejected: "مرفوض محاسبيًا",
      odoo_posting: "بدأت إجراءات الصرف - جاري قيد Odoo",
      awaiting_payment: "تم قيد Odoo - بانتظار الصرف",
      paid: "تم الدفع وإغلاق التعويض",
      failed: "خطأ يحتاج مراجعة",
      cancelled: "ملغي"
    };
    return labels[status] || status || "-";
  }

  function compensationIssueLabel(type) {
    const labels = {
      missing_product: "منتج لم يستلمه العميل",
      price_difference: "فرق سعر",
      payment_difference: "فرق / خطأ دفع",
      wrong_product: "منتج خاطئ",
      quality_issue: "مشكلة جودة",
      other: "أخرى"
    };
    return labels[type] || type || "-";
  }

  async function loadCompensations() {
    const content = el("compensationContent");
    if (!content || !currentUser) return;
    content.innerHTML = `<div class="inventory-empty">جاري تحميل حالات التعويض...</div>`;
    try {
      const params = new URLSearchParams();
      const status = el("compensationStatus")?.value || "all";
      const phone = el("compensationPhone")?.value?.trim() || "";
      const companyId = getSelectedCompanyId(false);
      if (status !== "all") params.set("status", status);
      if (phone) params.set("customerPhone", phone);
      if (companyId) params.set("companyId", companyId);
      params.set("limit", el("compensationLimit")?.value || "100");
      const data = await request(`/compensations?${params.toString()}`);
      renderCompensations(data.compensations || []);
    } catch (error) {
      content.innerHTML = `<div class="inventory-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderCompensations(rows) {
    const content = el("compensationContent");
    if (!content) return;
    if (!rows.length) {
      content.innerHTML = `<div class="inventory-empty">لا توجد حالات تعويض مطابقة.</div>`;
      return;
    }
    content.innerHTML = `<div class="compensation-list">${rows.map(renderCompensationCard).join("")}</div>`;
    rows.forEach((row) => bindCompensationCard(row));
  }

  function renderCompensationCard(row) {
    const monitorActions = canMonitorCompensation() && row.status === "pending_monitor_review" ? `
      <section class="compensation-action-box">
        <h4>مراجعة الكاميرات وتأكيد حقيقة الشكوى</h4>
        <div class="report-filter-grid">
          <label class="report-field">المبلغ المستحق<input id="monitorAmount-${row.id}" class="report-input" type="number" min="0" step="0.01" placeholder="EGP" /></label>
          <label class="report-field">تعليق المراجعة<input id="monitorComment-${row.id}" class="report-input" type="text" placeholder="نتيجة مراجعة الواقعة" /></label>
          <label class="report-field">فيديو / إثبات<input id="monitorFile-${row.id}" class="report-input" type="file" accept="video/*,image/*,.pdf" /></label>
        </div>
        <div class="inventory-hero-actions">
          <button class="run-btn" data-monitor-approve="${row.id}" type="button">تأكيد الاستحقاق وتحويل للمحاسب</button>
          <button class="export-btn" data-monitor-reject="${row.id}" type="button">غير مستحق</button>
        </div>
      </section>` : "";

    const accountingActions = canAccountCompensation() && row.status === "pending_accounting_approval" ? `
      <section class="compensation-action-box">
        <h4>إجراءات المحاسب المالي</h4>
        <label class="report-field">تعليق المحاسب<input id="accountingComment-${row.id}" class="report-input" type="text" placeholder="ملاحظة الاعتماد أو الرفض" /></label>
        <div class="inventory-hero-actions">
          <button class="run-btn" data-accounting-approve="${row.id}" type="button">بدء إجراءات الصرف وإنشاء قيد Odoo</button>
          <button class="export-btn" data-accounting-reject="${row.id}" type="button">رفض</button>
        </div>
      </section>` : "";

    const paymentActions = canAccountCompensation() && row.status === "awaiting_payment" ? `
      <section class="compensation-action-box">
        <h4>تأكيد الصرف النقدي للعميل</h4>
        <div class="report-filter-grid">
          <label class="report-field">المبلغ المدفوع<input id="paidAmount-${row.id}" class="report-input" type="number" min="0" step="0.01" value="${escapeHtml(row.monitorAmount || "")}" /></label>
          <label class="report-field">طريقة التحويل<input id="paymentMethod-${row.id}" class="report-input" type="text" placeholder="تحويل بنكي / كاش / ..." /></label>
          <label class="report-field">مرجع التحويل<input id="paymentRef-${row.id}" class="report-input" type="text" placeholder="رقم العملية" /></label>
          <label class="report-field">إثبات التحويل<input id="paymentFile-${row.id}" class="report-input" type="file" accept="image/*,.pdf" /></label>
        </div>
        <label class="report-field">ملاحظة<input id="paymentComment-${row.id}" class="report-input" type="text" /></label>
        <div class="inventory-hero-actions"><button class="run-btn" data-payment-confirm="${row.id}" type="button">تأكيد الصرف وإغلاق الحالة</button></div>
      </section>` : "";

    const retryAction = canAccountCompensation() && (row.status === "failed" || row.odooPostingStatus === "failed") ? `<button class="export-btn" data-retry-odoo="${row.id}" type="button">إعادة محاولة قيد Odoo</button>` : "";

    return `<article class="compensation-card" data-compensation-card="${row.id}">
      <div class="compensation-card-head">
        <div><strong>تعويض #${escapeHtml(row.id)}</strong><span class="compensation-status status-${escapeHtml(row.status)}">${escapeHtml(compensationStatusLabel(row.status))}</span></div>
        <small>${escapeHtml(formatDate(row.requestedAt))}</small>
      </div>
      <div class="compensation-meta-grid">
        <div><span>العميل</span><strong>${escapeHtml(row.customerName || "-")}</strong><small>${escapeHtml(row.customerPhone || "-")}</small></div>
        <div><span>الفاتورة</span><strong>${escapeHtml(row.invoiceRef || "-")}</strong><small>شكوى #${escapeHtml(row.noteId || "-")}</small></div>
        <div><span>المشكلة</span><strong>${escapeHtml(compensationIssueLabel(row.issueType))}</strong><small>${escapeHtml(row.reason || "-")}</small></div>
        <div><span>المبلغ المعتمد</span><strong>${row.monitorAmount != null ? formatMoney(row.monitorAmount) : "لم يحدد بعد"}</strong><small>${escapeHtml(row.monitorReviewedByName || "-")}</small></div>
        <div><span>Odoo</span><strong>${escapeHtml(row.odooPostingStatus || "pending")}</strong><small>${escapeHtml(row.odooMoveName || row.odooPostingError || "-")}</small></div>
        <div><span>الدفع</span><strong>${escapeHtml(row.paymentStatus || "not_ready")}</strong><small>${row.paidAmount != null ? formatMoney(row.paidAmount) : "-"}</small></div>
      </div>
      <div class="inventory-hero-actions compensation-card-tools">
        <button class="export-btn" data-view-compensation="${row.id}" type="button">التفاصيل والتتبع</button>${retryAction}
      </div>
      ${monitorActions}${accountingActions}${paymentActions}
      <div id="compensationDetails-${row.id}" class="compensation-details hidden"></div>
    </article>`;
  }

  function bindCompensationCard(row) {
    document.querySelector(`[data-view-compensation="${row.id}"]`)?.addEventListener("click", () => loadCompensationDetails(row.id));
    document.querySelector(`[data-monitor-approve="${row.id}"]`)?.addEventListener("click", () => submitMonitorReview(row.id, "eligible"));
    document.querySelector(`[data-monitor-reject="${row.id}"]`)?.addEventListener("click", () => submitMonitorReview(row.id, "not_eligible"));
    document.querySelector(`[data-accounting-approve="${row.id}"]`)?.addEventListener("click", () => submitAccounting(row.id, "approved"));
    document.querySelector(`[data-accounting-reject="${row.id}"]`)?.addEventListener("click", () => submitAccounting(row.id, "rejected"));
    document.querySelector(`[data-payment-confirm="${row.id}"]`)?.addEventListener("click", () => confirmCompensationPayment(row.id));
    document.querySelector(`[data-retry-odoo="${row.id}"]`)?.addEventListener("click", () => retryCompensationOdoo(row.id));
  }

  async function uploadCompensationAttachment(id, file, type) {
    if (!file) return null;
    const headers = { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), "X-Attachment-Type": type };
    const token = getMainAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}/compensations/${encodeURIComponent(id)}/attachments`, { method: "POST", headers, body: file });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || data?.error || "تعذر رفع المرفق.");
    return data?.attachment || null;
  }

  async function submitMonitorReview(id, decision) {
    try {
      const amount = el(`monitorAmount-${id}`)?.value;
      const comment = el(`monitorComment-${id}`)?.value?.trim() || "";
      const file = el(`monitorFile-${id}`)?.files?.[0] || null;
      if (file) await uploadCompensationAttachment(id, file, "camera_video");
      await request(`/compensations/${id}/monitor-review`, { method: "PATCH", body: JSON.stringify({ decision, amount: decision === "eligible" ? Number(amount) : null, comment }) });
      setMessage(decision === "eligible" ? "تم تأكيد الاستحقاق بعد مراجعة الكاميرات وتحويل الحالة للمحاسب المالي." : "تم تسجيل أن العميل غير مستحق للتعويض.", "success");
      await loadCompensations();
    } catch (error) { setMessage(error.message, "error"); }
  }

  async function submitAccounting(id, decision) {
    try {
      const comment = el(`accountingComment-${id}`)?.value?.trim() || "";
      await request(`/compensations/${id}/accounting-decision`, { method: "PATCH", body: JSON.stringify({ decision, comment }) });
      setMessage(decision === "approved" ? "بدأ المحاسب إجراءات الصرف وتمت معالجة قيد Odoo المرتبط بالشكوى وشريك العميل." : "تم رفض التعويض محاسبيًا.", "success");
      await loadCompensations();
    } catch (error) { setMessage(error.message, "error"); }
  }

  async function confirmCompensationPayment(id) {
    try {
      const file = el(`paymentFile-${id}`)?.files?.[0] || null;
      if (file) await uploadCompensationAttachment(id, file, "payment_proof");
      await request(`/compensations/${id}/payment`, { method: "PATCH", body: JSON.stringify({
        paidAmount: Number(el(`paidAmount-${id}`)?.value || 0),
        paymentMethod: el(`paymentMethod-${id}`)?.value?.trim() || "",
        paymentReference: el(`paymentRef-${id}`)?.value?.trim() || "",
        comment: el(`paymentComment-${id}`)?.value?.trim() || ""
      }) });
      setMessage("تم تسجيل الصرف وإغلاق حالة التعويض، والحالة محدثة في سجل خدمة العملاء.", "success");
      await loadCompensations();
    } catch (error) { setMessage(error.message, "error"); }
  }

  async function retryCompensationOdoo(id) {
    try {
      await request(`/compensations/${id}/retry-odoo`, { method: "POST", body: JSON.stringify({}) });
      setMessage("تمت إعادة محاولة معالجة قيد Odoo.", "success");
      await loadCompensations();
    } catch (error) { setMessage(error.message, "error"); }
  }

  async function loadCompensationDetails(id) {
    const box = el(`compensationDetails-${id}`);
    if (!box) return;
    if (!box.classList.contains("hidden")) { hideElement(box); return; }
    showElement(box);
    box.innerHTML = `<div class="inventory-empty">جاري تحميل التتبع...</div>`;
    try {
      const data = await request(`/compensations/${id}`);
      const row = data.compensation || {};
      const attachments = row.attachments || [];
      const events = data.events || [];
      box.innerHTML = `
        <h4>المرفقات</h4>
        <div class="compensation-attachments">${attachments.length ? attachments.map(a => `<button class="compensation-attachment" type="button" data-open-comp-attachment="${a.id}" data-comp-request="${id}" data-comp-name="${escapeHtml(a.originalName || "attachment")}">${escapeHtml(a.originalName || a.type || "مرفق")}<small>${escapeHtml(a.type)} — ${escapeHtml(formatDate(a.uploadedAt))}</small></button>`).join("") : '<span class="inventory-muted-text">لا توجد مرفقات.</span>'}</div>
        <h4>سجل التتبع</h4>
        <div class="compensation-timeline">${events.length ? events.map(e => `<div class="compensation-event"><span></span><div><strong>${escapeHtml(e.type)}</strong><small>${escapeHtml(e.actorName || "النظام")} — ${escapeHtml(formatDate(e.createdAt))}</small>${e.amount != null ? `<b>${formatMoney(e.amount)}</b>` : ""}${e.comment ? `<p>${escapeHtml(e.comment)}</p>` : ""}</div></div>`).join("") : '<span class="inventory-muted-text">لا توجد أحداث بعد.</span>'}</div>`;
      box.querySelectorAll("[data-open-comp-attachment]").forEach((button) => {
        button.addEventListener("click", () => openCompensationAttachment(button.dataset.compRequest, button.dataset.openCompAttachment, button.dataset.compName));
      });
    } catch (error) { box.innerHTML = `<div class="inventory-empty">${escapeHtml(error.message)}</div>`; }
  }

  async function openCompensationAttachment(requestId, attachmentId, name) {
    try {
      const headers = {};
      const token = getMainAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${API_BASE}/compensations/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachmentId)}`, { headers });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "تعذر فتح المرفق.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = url; a.download = name || "attachment"; document.body.appendChild(a); a.click(); a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { setMessage(error.message, "error"); }
  }

  async function loadCompensationFinancialReport() {
    if (!canAccountCompensation()) return;
    const content = el("compensationContent");
    try {
      const params = new URLSearchParams();
      const companyId = getSelectedCompanyId(false);
      if (companyId) params.set("companyId", companyId);
      if (el("dateFrom")?.value) params.set("dateFrom", el("dateFrom").value);
      if (el("dateTo")?.value) params.set("dateTo", el("dateTo").value);
      const data = await request(`/compensations/report/financial?${params.toString()}`);
      const sum = data.summary || {};
      const summary = el("compensationSummary");
      if (summary) {
        showElement(summary);
        summary.innerHTML = `
          <div class="inventory-kpi-card"><span>إجمالي الحالات</span><strong>${formatNumber(sum.total_cases || 0)}</strong><small>كل طلبات التعويض</small></div>
          <div class="inventory-kpi-card"><span>المبالغ المعتمدة</span><strong>${formatMoney(sum.approved_amount || 0)}</strong><small>اعتماد المراقبة</small></div>
          <div class="inventory-kpi-card"><span>تم دفعه</span><strong>${formatMoney(sum.paid_amount || 0)}</strong><small>تحويلات مؤكدة</small></div>
          <div class="inventory-kpi-card"><span>معلق للدفع</span><strong>${formatMoney(sum.awaiting_payment_amount || 0)}</strong><small>${formatNumber(sum.awaiting_payment || 0)} حالة</small></div>`;
      }
      renderCompensations(data.rows || []);
    } catch (error) { if (content) content.innerHTML = `<div class="inventory-empty">${escapeHtml(error.message)}</div>`; }
  }

  async function handleSaveNoteClick(saveButton, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!saveButton || saveButton.disabled) return false;

    const invoiceId = String(saveButton.dataset.saveNote || "");
    const invoice = lastInvoices.find((item) => String(item?.posOrderId ?? "") === invoiceId);

    if (!invoice) {
      setMessage("تعذر تحديد الفاتورة المرتبطة بزر الحفظ. أعد البحث عن الفاتورة وحاول مرة أخرى.", "error");
      console.error("[CustomerService] Save invoice not found", { invoiceId, lastInvoices });
      return false;
    }

    const originalText = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = "جاري الحفظ...";
    setMessage("جاري حفظ الشكوى وإرسالها للمدير...", "success");
    console.info("[CustomerService] Save complaint click", { invoiceId });

    try {
      await saveNote(invoice);
    } catch (error) {
      console.error("[CustomerService] Save complaint failed", error);
      setMessage(error?.message || "تعذر حفظ الشكوى.", "error");
    } finally {
      saveButton.disabled = false;
      syncFinancialReviewRequestUi(invoice.posOrderId);
      if (saveButton.textContent === "جاري الحفظ...") {
        saveButton.textContent = originalText;
      }
    }
    return false;
  }

  function bindEvents() {
    // Capture phase guarantees the save click is seen even if another widget
    // stops bubbling later in the DOM tree. Direct per-card binding is kept
    // as a second safety net for dynamically rendered invoice cards.
    document.addEventListener("click", async (event) => {
      if (event.target?.id === "bootstrapBtn") {
        await bootstrapManager();
        return;
      }

      const saveButton = event.target?.closest?.("[data-save-note]");
      if (saveButton) {
        await handleSaveNoteClick(saveButton, event);
        return;
      }
    }, true);

    document.addEventListener("change", (event) => {
      const toggle = event.target?.closest?.("[data-financial-review-toggle]");
      if (!toggle) return;
      syncFinancialReviewRequestUi(toggle.dataset.financialReviewToggle);
    });

    el("loginBtn")?.addEventListener("click", login);
    el("logoutBtn")?.addEventListener("click", logout);
    el("searchBtn")?.addEventListener("click", searchInvoices);
    el("clearBtn")?.addEventListener("click", clearSearch);
    el("loadComplaintTrackingBtn")?.addEventListener("click", loadComplaintTracking);
    el("loadNotesBtn")?.addEventListener("click", loadNotes);
    el("loadActivityBtn")?.addEventListener("click", loadActivity);
    el("loadCompensationsBtn")?.addEventListener("click", loadCompensations);
    el("loadCompensationReportBtn")?.addEventListener("click", loadCompensationFinancialReport);
    bindReviewFollowupEvents();

    el("loginPassword")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") login();
    });

    el("invoiceRef")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") searchInvoices();
    });

    el("customerPhone")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") searchInvoices();
    });

    el("companyId")?.addEventListener("change", () => {
      const companyId = persistComplaintCompany(el("companyId")?.value || "");
      setMessage("", "success");

      window.dispatchEvent(new CustomEvent("company-context-changed", {
        detail: { companyId }
      }));
    });

    window.addEventListener("company-context-changed", (event) => {
      const companyId = String(event?.detail?.companyId || getStoredCompanyId() || "").trim();
      syncComplaintCompanySelector(companyId);
      setMessage("", "success");
    });
  }

  function printThermalReceipt(invoice) {
    const receiptWindow = window.open("", "_blank", "width=420,height=720");
    if (!receiptWindow) {
      setMessage("اسمح بالنوافذ المنبثقة حتى تعمل طباعة الإيصال.", "error");
      return;
    }

    const rows = (invoice.lines || []).map((line) => `
      <tr>
        <td>${escapeHtml(line.productName || "-")}</td>
        <td>${formatNumber(line.quantity || 0, 3)}</td>
        <td>${formatMoney(line.lineTotal || 0)}</td>
      </tr>
    `).join("");

    receiptWindow.document.write(`<!doctype html>
      <html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إيصال ${escapeHtml(invoice.invoiceRef || "")}</title>
      <style>
        @page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{width:74mm;margin:0 auto;color:#000;background:#fff;font-family:Tahoma,Arial,sans-serif;font-size:11px;line-height:1.45}h1{margin:0;text-align:center;font-size:18px}h2{margin:3px 0 10px;text-align:center;font-size:12px}.meta{border-block:1px dashed #000;padding:7px 0;margin:7px 0}.meta div{display:flex;justify-content:space-between;gap:8px}table{width:100%;border-collapse:collapse}th,td{padding:4px 2px;border-bottom:1px dashed #777;text-align:right}th:nth-child(2),td:nth-child(2){text-align:center}th:last-child,td:last-child{text-align:left}.total{display:flex;justify-content:space-between;margin-top:9px;padding-top:7px;border-top:2px solid #000;font-size:14px;font-weight:700}.footer{text-align:center;margin-top:12px;border-top:1px dashed #000;padding-top:8px}.no-print{width:100%;margin-top:12px;padding:8px;border:0;color:#fff;background:#4f612c;font-weight:700;cursor:pointer}@media print{.no-print{display:none}}
      </style></head><body>
      <h1>Virginia</h1><h2>إيصال مبيعات</h2>
      <section class="meta">
        <div><span>رقم الفاتورة</span><strong>${escapeHtml(invoice.invoiceRef || "-")}</strong></div>
        <div><span>رقم الطلب</span><strong>${escapeHtml(invoice.orderNumber || "-")}</strong></div>
        <div><span>التاريخ</span><strong>${escapeHtml(formatDate(invoice.dateOrder))}</strong></div>
        <div><span>الفرع</span><strong>${escapeHtml(invoice.configName || invoice.branchCode || "-")}</strong></div>
        <div><span>الكاشير</span><strong>${escapeHtml(invoice.cashierName || "-")}</strong></div>
      </section>
      <table><thead><tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr></thead><tbody>${rows || '<tr><td colspan="3">لا توجد أصناف</td></tr>'}</tbody></table>
      <div class="total"><span>الإجمالي</span><strong>${formatMoney(invoice.amountTotal || 0)}</strong></div>
      <div class="footer">شكرًا لزيارتكم</div>
      <button class="no-print" onclick="window.print()">طباعة الإيصال</button>
      </body></html>`);
    receiptWindow.document.close();
    receiptWindow.focus();
  }

  async function downloadOfficialOdooPdf(invoice, button) {
    if (!invoice.accountMoveId) {
      printA4PosInvoice(invoice);
      return;
    }

    const originalText = button?.textContent || "فاتورة Odoo PDF";
    try {
      if (button) {
        button.disabled = true;
        button.textContent = "جاري تجهيز PDF...";
      }
      const headers = {};
      const token = getMainAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${API_BASE}/invoices/${encodeURIComponent(invoice.posOrderId)}/pdf`, { headers });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || "تعذر تحميل فاتورة Odoo PDF");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `odoo-invoice-${invoice.invoiceRef || invoice.posOrderId}.pdf`.replace(/[^a-zA-Z0-9_.-]+/g, "-");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("تم تجهيز فاتورة Odoo PDF بنجاح.", "success");
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  function printA4PosInvoice(invoice) {
    const invoiceWindow = window.open("", "_blank", "width=960,height=820");
    if (!invoiceWindow) {
      setMessage("اسمح بالنوافذ المنبثقة حتى تعمل فاتورة PDF.", "error");
      return;
    }

    const rows = (invoice.lines || []).map((line, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(line.productName || "-")}</td>
        <td>${formatNumber(line.quantity || 0, 3)}</td>
        <td>${formatMoney(line.unitPrice || 0)}</td>
        <td>${formatMoney(line.lineTotal || 0)}</td>
      </tr>
    `).join("");

    invoiceWindow.document.write(`<!doctype html>
      <html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة POS ${escapeHtml(invoice.invoiceRef || "")}</title>
      <style>
        @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#253018;background:#eef1e5;font-family:Tahoma,Arial,sans-serif;font-size:13px}.sheet{width:210mm;min-height:276mm;margin:14px auto;padding:14mm;background:#fff;box-shadow:0 12px 36px rgba(45,58,24,.16)}header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:4px solid #667a35}.brand h1{margin:0;color:#4f612c;font-size:30px}.brand p{margin:4px 0 0;color:#788067}.title{text-align:left}.title h2{margin:0;color:#263018;font-size:24px}.title strong{display:block;margin-top:5px;color:#8b6b28}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:9px 26px;margin:18px 0;padding:14px;border:1px solid #dfe5cc;border-radius:12px;background:#fafbf5}.meta div{display:flex;justify-content:space-between;gap:10px}.meta span{color:#737b64}.meta strong{color:#263018}table{width:100%;border-collapse:collapse;margin-top:16px}th{padding:10px 8px;color:#fff;background:#5b6e31;text-align:right}td{padding:9px 8px;border-bottom:1px solid #e7eadc}th:first-child,td:first-child{width:42px;text-align:center}th:nth-child(3),td:nth-child(3){text-align:center}th:nth-child(4),td:nth-child(4),th:last-child,td:last-child{text-align:left}.summary{width:330px;margin:20px 0 0 auto;padding:14px;border:2px solid #667a35;border-radius:12px}.summary div{display:flex;justify-content:space-between}.summary strong{font-size:18px;color:#4f612c}.footer{margin-top:30px;padding-top:12px;border-top:1px dashed #aeb89a;color:#69725b;text-align:center}.actions{width:210mm;margin:0 auto 18px;display:flex;justify-content:center}.actions button{padding:11px 26px;border:0;border-radius:9px;color:#fff;background:#4f612c;font-weight:700;cursor:pointer}@media print{body{background:#fff}.sheet{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.actions{display:none}}
      </style></head><body>
      <main class="sheet">
        <header><div class="brand"><h1>Virginia</h1><p>Virginia Olive</p></div><div class="title"><h2>فاتورة مبيعات POS</h2><strong>${escapeHtml(invoice.invoiceRef || "-")}</strong></div></header>
        <section class="meta">
          <div><span>رقم الطلب</span><strong>${escapeHtml(invoice.orderNumber || "-")}</strong></div>
          <div><span>التاريخ</span><strong>${escapeHtml(formatDate(invoice.dateOrder))}</strong></div>
          <div><span>العميل</span><strong>${escapeHtml(invoice.customerName || "عميل نقدي")}</strong></div>
          <div><span>رقم العميل</span><strong>${escapeHtml(invoice.customerPhone || "-")}</strong></div>
          <div><span>الفرع / POS</span><strong>${escapeHtml(invoice.configName || invoice.branchCode || "-")}</strong></div>
          <div><span>الكاشير</span><strong>${escapeHtml(invoice.cashierName || "-")}</strong></div>
          <div><span>طريقة السداد</span><strong>${escapeHtml(invoice.paymentSummary || "-")}</strong></div>
          <div><span>مرجع Odoo</span><strong>${escapeHtml(invoice.orderReference || invoice.posOrderId || "-")}</strong></div>
        </section>
        <table><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows || '<tr><td colspan="5">لا توجد أصناف</td></tr>'}</tbody></table>
        <section class="summary"><div><span>إجمالي الفاتورة</span><strong>${formatMoney(invoice.amountTotal || 0)}</strong></div></section>
        <footer class="footer">تم إنشاء هذه النسخة من بيانات طلب نقطة البيع المسجلة في Odoo.</footer>
      </main>
      <div class="actions"><button onclick="window.print()">طباعة أو حفظ PDF</button></div>
      </body></html>`);
    invoiceWindow.document.close();
    invoiceWindow.focus();
  }


  async function init() {
    defaultDates();
    applyUrlParamsToFilters();
    bindEvents();
    syncComplaintCompanySelector();

    // The shared layout loads company permissions asynchronously. Re-sync once it
    // has populated the header selector so the complaint page always mirrors
    // the persisted project-wide company context after refresh/navigation.
    setTimeout(() => syncComplaintCompanySelector(), 0);
    setTimeout(() => syncComplaintCompanySelector(), 500);

    setupNeedsBootstrap = false;

    await verifySession();

    const refreshComplaintState = () => {
      if (!currentUser) return;
      loadComplaintTracking();
      if (isManagerUser()) loadNotes();
    };
    window.addEventListener("storage", (event) => {
      if (event.key === "mi-customer-service-live") refreshComplaintState();
    });
    if ("BroadcastChannel" in window) {
      try {
        const channel = new BroadcastChannel("mi-customer-service-live");
        channel.addEventListener("message", refreshComplaintState);
      } catch (_) {}
    }

    if (currentUser) {
      await autoSearchFromUrlAfterLogin();
      if (["agent", "manager", "admin"].includes(currentUser.role)) await loadComplaintTracking();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
