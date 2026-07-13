(function () {
  "use strict";

  const CS_TOKEN_KEY = "customerServiceInternalToken";
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

    if (host.includes("odoo-management-intelligence-agent-production.up.railway.app")) {
      return "/api/customer/service-pos-review";
    }

    return "https://odoo-management-intelligence-agent-production.up.railway.app/api/customer/service-pos-review";
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
    if (typeof window.getToken === "function") {
      const sharedToken = window.getToken();
      if (sharedToken) return sharedToken;
    }
    const keys = [
      "authToken",
      "token",
      "accessToken",
      "jwt",
      "appToken",
      "odooMiToken",
      "miToken",
      "adminToken"
    ];

    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }

    return "";
  }

  function getCsToken() {
    return localStorage.getItem(CS_TOKEN_KEY) || "";
  }

  function getSelectedCompanyId(required = false) {
    const companyId = el("companyId")?.value || el("companySelect")?.value || "";

    if (required && !companyId) {
      throw new Error("لازم تختار الشركة قبل تنفيذ العملية.");
    }

    return companyId;
  }

  function setMessage(message, type = "success") {
    const box = el("csMessage");
    if (!box) return;

    if (!message) {
      box.textContent = "";
      box.className = "error-box hidden";
      return;
    }

    box.textContent = message;
    box.className = type === "error" ? "error-box" : "loading-box";
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

  async function request(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    const mainToken = getMainAuthToken();
    if (mainToken) {
      headers.Authorization = `Bearer ${mainToken}`;
    }

    const csToken = getCsToken();
    if (csToken) {
      headers["X-CS-Token"] = csToken;
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

  function isManagerUser() {
    return currentUser?.role === "manager" || currentUser?.role === "admin";
  }

  function isAdminUser() {
    return currentUser?.role === "admin";
  }

  function roleLabel(role) {
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

    if (setupNeedsBootstrap) {
      showElement(bootstrapCard);
      hideElement(loginCard);
      hideElement(workArea);
      hideElement(managerPanel);
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

    localStorage.setItem(CS_TOKEN_KEY, data.token);
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
          token: getCsToken()
        })
      });
    } catch (error) {
      console.warn(error);
    }

    localStorage.removeItem(CS_TOKEN_KEY);
    localStorage.removeItem(CS_USER_KEY);

    currentUser = null;
    lastInvoices = [];
    renderResults([]);
    updateUserUi();
    setMessage("تم تسجيل الخروج الداخلي.", "success");
  }

  async function verifySession() {
    try {
      const data = await request("/me");
      currentUser = data.user;
      localStorage.setItem(CS_USER_KEY, JSON.stringify(data.user));
    } catch (error) {
      localStorage.removeItem(CS_TOKEN_KEY);
      localStorage.removeItem(CS_USER_KEY);
      currentUser = null;
    }

    updateUserUi();
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

      const noteBtn = document.querySelector(`[data-save-note="${invoice.posOrderId}"]`);
      if (noteBtn) {
        noteBtn.addEventListener("click", () => saveNote(invoice));
      }
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
            <h2>فاتورة: ${escapeHtml(invoice.invoiceRef || "-")}</h2>
            <p>
              ${escapeHtml(formatDate(invoice.dateOrder))}
              — العميل: ${escapeHtml(invoice.customerName || "-")}
              — رقم العميل: ${escapeHtml(invoice.customerPhone || "-")}
            </p>
          </div>

          <button class="run-btn" type="button" data-open-invoice="${escapeHtml(invoice.posOrderId)}">
            تسجيل فتح الفاتورة
          </button>
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
    const noteType = el(`noteType-${invoice.posOrderId}`)?.value || "general";
    const noteText = el(`noteText-${invoice.posOrderId}`)?.value?.trim() || "";

    if (!noteText) {
      setMessage("اكتب نص الملاحظة أولًا.", "error");
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
          posReference: invoice.posReference || null,
          invoiceDate: invoice.dateOrder || null,
          noteType,
          noteText
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

      setMessage(`تم حفظ الملاحظة رقم ${noteId} وإرسالها للمدير.`, "success");

      const textarea = el(`noteText-${invoice.posOrderId}`);
      if (textarea) textarea.value = "";
    } catch (error) {
      setMessage(error.message, "error");
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

      const data = await request(`/notes?${params.toString()}`);

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
                <th>تعليق المدير</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              ${notes.map(renderManagerNoteRow).join("")}
            </tbody>
          </table>
        </div>
      `;

      notes.forEach((note) => {
        const approveBtn = document.querySelector(`[data-approve-note="${note.id}"]`);
        const returnBtn = document.querySelector(`[data-return-note="${note.id}"]`);
        const closeBtn = document.querySelector(`[data-close-note="${note.id}"]`);

        if (approveBtn) approveBtn.addEventListener("click", () => managerAction(note.id, "approve"));
        if (returnBtn) returnBtn.addEventListener("click", () => managerAction(note.id, "return"));
        if (closeBtn) closeBtn.addEventListener("click", () => managerAction(note.id, "close"));
      });
    } catch (error) {
      content.innerHTML = "";
      setMessage(error.message, "error");
    }
  }

  function renderManagerNoteRow(note) {
    return `
      <tr>
        <td>${escapeHtml(note.id)}</td>
        <td>${escapeHtml(note.status)}</td>
        <td>${escapeHtml(note.createdByName || note.createdBy || "-")}</td>
        <td>
          ${escapeHtml(note.customerName || "-")}
          <br />
          <span class="inventory-muted-text">${escapeHtml(note.customerPhone || "-")}</span>
        </td>
        <td>${escapeHtml(note.invoiceRef || "-")}</td>
        <td>${escapeHtml(note.noteText || "-")}</td>
        <td>
          <textarea id="managerComment-${escapeHtml(note.id)}" class="report-input" placeholder="تعليق المدير"></textarea>
        </td>
        <td>
          <div class="inventory-hero-actions">
            <button class="run-btn" type="button" data-approve-note="${escapeHtml(note.id)}">تصديق</button>
            <button class="run-btn" type="button" data-return-note="${escapeHtml(note.id)}">إرجاع</button>
            <button class="run-btn" type="button" data-close-note="${escapeHtml(note.id)}">إغلاق</button>
          </div>
        </td>
      </tr>
    `;
  }

  async function managerAction(noteId, action) {
    const managerComment = el(`managerComment-${noteId}`)?.value?.trim() || "";

    try {
      await request(`/notes/${noteId}/${action}`, {
        method: "PATCH",
        body: JSON.stringify({ managerComment })
      });

      setMessage("تم تنفيذ إجراء المدير.", "success");
      await loadNotes();
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
              <option value="agent">موظف</option>
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
                    <option value="agent" ${user.role === "agent" ? "selected" : ""}>موظف</option>
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

    if (host.includes("odoo-management-intelligence-agent-production.up.railway.app")) {
      return "/api/customer/review-sms";
    }

    return "https://odoo-management-intelligence-agent-production.up.railway.app/api/customer/review-sms";
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


  function bindEvents() {
    document.addEventListener("click", async (event) => {
      if (event.target?.id === "bootstrapBtn") {
        await bootstrapManager();
      }
    });

    el("loginBtn")?.addEventListener("click", login);
    el("logoutBtn")?.addEventListener("click", logout);
    el("searchBtn")?.addEventListener("click", searchInvoices);
    el("clearBtn")?.addEventListener("click", clearSearch);
    el("loadNotesBtn")?.addEventListener("click", loadNotes);
    el("loadActivityBtn")?.addEventListener("click", loadActivity);
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
      setMessage("", "success");
    });
  }

  async function init() {
    defaultDates();
    applyUrlParamsToFilters();
    bindEvents();

    setupNeedsBootstrap = false;

    await verifySession();

    if (currentUser) {
      await autoSearchFromUrlAfterLogin();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
