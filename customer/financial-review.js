(function () {
  "use strict";

  let currentUser = null;
  let lastCompensationRows = [];
  let financialReviewViewMode = localStorage.getItem("financialReviewViewMode") === "cards" ? "cards" : "table";
  let activeCompensationTicketId = null;
  let compensationSearchTimer = null;

  function getCustomerServiceApiBase() {
    let apiBaseUrl = "";
    try {
      if (typeof API_BASE_URL !== "undefined" && API_BASE_URL) apiBaseUrl = API_BASE_URL;
    } catch (error) {
      apiBaseUrl = "";
    }
    if (apiBaseUrl) return `${apiBaseUrl.replace(/\/$/, "")}/customer/service-pos-review`;
    const host = window.location.host;
    if (host.includes("127.0.0.1:5500") || host.includes("localhost:5500")) {
      return "http://localhost:5050/api/customer/service-pos-review";
    }
    if (host.includes("api.mi.virginiaolive.com")) return "/api/customer/service-pos-review";
    return "https://api.mi.virginiaolive.com/api/customer/service-pos-review";
  }

  const API_BASE = getCustomerServiceApiBase();

  function el(id) { return document.getElementById(id); }
  function showElement(node) { if (node) { node.classList.remove("hidden"); node.style.display = ""; } }
  function hideElement(node) { if (node) { node.classList.add("hidden"); node.style.display = "none"; } }

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

  async function request(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getMainAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed with status ${response.status}`);
    return data || {};
  }

  function broadcastCustomerServiceUpdate() {
    const payload = { source: "financial-review", at: new Date().toISOString() };
    try { localStorage.setItem("mi-customer-service-live", JSON.stringify(payload)); } catch (_) {}
    try {
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("mi-customer-service-live");
        channel.postMessage(payload);
        channel.close();
      }
    } catch (_) {}
  }

  function setMessage(message, type = "success") {
    if (!message) {
      window.MINotifications?.dismiss?.("mi-financial-review-message");
      const box = el("financialReviewMessage");
      if (box) {
        box.textContent = "";
        box.className = "error-box hidden";
      }
      return;
    }

    if (window.MINotifications) {
      const method = type === "error" ? "error" : type === "warning" ? "warning" : "success";
      window.MINotifications[method]?.(message, {
        id: "mi-financial-review-message"
      });
      return;
    }

    const box = el("financialReviewMessage");
    if (!box) return;
    box.textContent = message;
    box.className = type === "error" ? "error-box" : "loading-box";
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMoney(value) {
    const num = Number(value || 0);
    try {
      return `${num.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج`;
    } catch (error) {
      return `${num.toFixed(2)} ج`;
    }
  }

  function formatNumber(value, digits = 0) {
    const num = Number(value || 0);
    try {
      return num.toLocaleString("ar-EG", { minimumFractionDigits: digits, maximumFractionDigits: digits });
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

  function formatDateCompact(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    try {
      const day = date.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" });
      const time = date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
      return `${day} ${time}`;
    } catch (_) {
      return formatDate(value);
    }
  }

  function toLocalIsoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function compensationStageLabel(status) {
    const labels = {
      pending_monitor_review: "المراقب",
      monitor_rejected: "مغلقة بالمراقبة",
      pending_accounting_approval: "المحاسب",
      accounting_rejected: "مغلقة محاسبيًا",
      odoo_posting: "المحاسب / Odoo",
      awaiting_payment: "المحاسب / الصرف",
      paid: "مغلقة",
      failed: "المحاسب / خطأ",
      cancelled: "ملغاة"
    };
    return labels[status] || "المراجعة المالية";
  }

  function setViewMode(mode, rerender = true) {
    financialReviewViewMode = mode === "cards" ? "cards" : "table";
    localStorage.setItem("financialReviewViewMode", financialReviewViewMode);
    document.querySelectorAll("[data-view-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.viewMode === financialReviewViewMode);
    });
    if (financialReviewViewMode === "cards") {
      hideElement(el("compensationTicketWorkspace"));
      activeCompensationTicketId = null;
    }
    if (rerender && lastCompensationRows.length) renderCompensations(lastCompensationRows, false);
  }

  function setDatePreset(preset, reload = true) {
    const today = new Date();
    let from = "";
    let to = "";
    if (preset === "today") {
      from = to = toLocalIsoDate(today);
    } else if (preset === "7days") {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      from = toLocalIsoDate(start);
      to = toLocalIsoDate(today);
    } else if (preset === "month") {
      from = toLocalIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
      to = toLocalIsoDate(today);
    }
    if (el("dateFrom")) el("dateFrom").value = from;
    if (el("dateTo")) el("dateTo").value = to;
    document.querySelectorAll("[data-date-preset]").forEach((button) => {
      button.classList.toggle("active", button.dataset.datePreset === preset);
    });
    if (reload) loadCompensations();
  }

  function applyCompensationSearch(rows) {
    const query = String(el("compensationSearch")?.value || "").trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.id, row.noteId, row.invoiceRef, row.orderNumber, row.customerName, row.customerPhone, row.reason,
        compensationIssueLabel(row.issueType), compensationStatusLabel(row.status), compensationStageLabel(row.status),
        row.odooMoveName, row.paymentReference
      ].filter((value) => value !== null && value !== undefined).join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }

  function roleLabel(role) {
    if (role === "monitor") return "مراقب / مراجعة كاميرات";
    if (role === "accountant") return "محاسب";
    if (role === "manager") return "مدير خدمة العملاء";
    if (role === "admin") return "Admin";
    return "موظف خدمة عملاء";
  }

  function canOpenFinancialReview() {
    return ["monitor", "manager", "accountant", "admin"].includes(currentUser?.role);
  }

  function canMonitorCompensation() {
    return ["monitor", "admin"].includes(currentUser?.role);
  }

  function canAccountCompensation() {
    return ["accountant", "admin"].includes(currentUser?.role);
  }

  function applyDefaultDates() {
    setDatePreset("month", false);
  }

  function applyUrlParams() {
    const params = new URLSearchParams(location.search);
    const companyId = params.get("companyId");
    if (companyId && el("companyId")) el("companyId").value = companyId;
  }

  async function verifySession() {
    try {
      const data = await request("/me");
      currentUser = data.user || null;
      if (currentUser) localStorage.setItem("customerServiceInternalUser", JSON.stringify(currentUser));
    } catch (error) {
      try {
        currentUser = JSON.parse(localStorage.getItem("customerServiceInternalUser") || "null");
      } catch (parseError) {
        currentUser = null;
      }
      if (!currentUser) {
        setMessage("تعذر التحقق من جلسة خدمة العملاء. افتح سجل الشكاوى أولًا لتحديث الجلسة.", "error");
      }
    }

    const state = el("financialReviewUserState");
    if (state && currentUser) {
      state.innerHTML = `
        <span class="page-pill">${escapeHtml(roleLabel(currentUser.role))}</span>
        <span class="page-pill">${escapeHtml(currentUser.fullName || currentUser.username || "-")}</span>
      `;
    }

    if (!currentUser || !canOpenFinancialReview()) {
      hideElement(el("financialReviewWorkArea"));
      showElement(el("financialReviewAccessDenied"));
      return false;
    }

    hideElement(el("financialReviewAccessDenied"));
    showElement(el("financialReviewWorkArea"));
    if (el("financialReviewRoleBadge")) el("financialReviewRoleBadge").textContent = roleLabel(currentUser.role);
    if (canAccountCompensation()) showElement(el("loadCompensationReportBtn"));
    else hideElement(el("loadCompensationReportBtn"));

    const statusSelect = el("compensationStatus");
    const hasTicketParam = new URLSearchParams(location.search).has("ticket");
    if (statusSelect && !hasTicketParam) {
      if (currentUser.role === "monitor") statusSelect.value = "monitor_queue";
      else if (currentUser.role === "accountant") statusSelect.value = "accountant_queue";
      else statusSelect.value = "all";
    }
    return true;
  }

  function compensationStatusLabel(status) {
    const labels = {
      pending_monitor_review: "بانتظار مراجعة المراقبة",
      monitor_rejected: "غير مستحق - المراقبة",
      pending_accounting_approval: "تم تأكيد الاستحقاق - لدى المحاسب",
      accounting_rejected: "مرفوض محاسبيًا",
      odoo_posting: "بدأت إجراءات الصرف - جاري إنشاء قيد Odoo",
      awaiting_payment: "تم قيد Odoo - بانتظار الصرف النقدي",
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
    if (!content || !currentUser || !canOpenFinancialReview()) return;
    content.innerHTML = `<div class="inventory-empty">جاري تحميل تذاكر المراجعة المالية...</div>`;
    hideElement(el("compensationTicketWorkspace"));
    activeCompensationTicketId = null;

    try {
      const params = new URLSearchParams(location.search);
      const ticketId = params.get("ticket");
      let rows = [];

      if (ticketId) {
        const data = await request(`/compensations/${encodeURIComponent(ticketId)}`);
        if (data.compensation) rows = [data.compensation];
      } else {
        const query = new URLSearchParams();
        const status = el("compensationStatus")?.value || "all";
        const phone = el("compensationPhone")?.value?.trim() || "";
        const companyId = el("companyId")?.value || "";
        const dateFrom = el("dateFrom")?.value || "";
        const dateTo = el("dateTo")?.value || "";
        const search = el("compensationSearch")?.value?.trim() || "";
        if (!["all", "monitor_queue", "accountant_queue"].includes(status)) query.set("status", status);
        if (search) query.set("search", search);
        if (phone) query.set("customerPhone", phone);
        if (companyId) query.set("companyId", companyId);
        if (dateFrom) query.set("dateFrom", dateFrom);
        if (dateTo) query.set("dateTo", dateTo);
        query.set("limit", el("compensationLimit")?.value || "100");
        const data = await request(`/compensations?${query.toString()}`);
        rows = data.compensations || [];
        if (status === "monitor_queue") {
          rows = rows.filter((row) => row.status === "pending_monitor_review");
        } else if (status === "accountant_queue") {
          const accountantStatuses = new Set(["pending_accounting_approval", "odoo_posting", "awaiting_payment", "failed"]);
          rows = rows.filter((row) => accountantStatuses.has(row.status));
        }
      }

      renderCompensations(rows);
      if (ticketId && rows[0]) openCompensationTicket(rows[0].id);
    } catch (error) {
      content.innerHTML = `<div class="inventory-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderCompensations(rows, updateSource = true) {
    const content = el("compensationContent");
    if (!content) return;
    if (updateSource) lastCompensationRows = Array.isArray(rows) ? rows : [];
    const visibleRows = applyCompensationSearch(lastCompensationRows);
    const count = el("financialReviewResultsCount");
    if (count) count.textContent = `${formatNumber(visibleRows.length)} تذكرة`;

    if (!visibleRows.length) {
      content.innerHTML = `<div class="inventory-empty">لا توجد تذاكر مراجعة مالية مطابقة.</div>`;
      hideElement(el("compensationTicketWorkspace"));
      activeCompensationTicketId = null;
      return;
    }

    if (financialReviewViewMode === "cards") {
      content.innerHTML = `<div class="compensation-list">${visibleRows.map(renderCompensationCard).join("")}</div>`;
      visibleRows.forEach(bindCompensationCard);
      return;
    }

    content.innerHTML = renderCompensationTable(visibleRows);
    bindCompensationTable();
  }

  function renderCompensationTable(rows) {
    return `<div class="financial-review-table-wrap">
      <table class="financial-review-table">
        <thead><tr>
          <th>التذكرة</th><th>التاريخ</th><th>العميل</th><th>الفاتورة / الشكوى</th><th>الموضوع</th><th>المبلغ</th><th>المرحلة</th><th>الحالة</th>
        </tr></thead>
        <tbody>${rows.map((row) => `
          <tr data-ticket-row="${escapeHtml(row.id)}" tabindex="0" role="button" aria-label="فتح تذكرة المراجعة المالية رقم ${escapeHtml(row.id)}">
            <td><strong>#${escapeHtml(row.id)}</strong><small>فتح التذكرة</small></td>
            <td>${escapeHtml(formatDateCompact(row.requestedAt))}</td>
            <td><strong>${escapeHtml(row.customerName || "-")}</strong><small>${escapeHtml(row.customerPhone || "-")}</small></td>
            <td><strong>${escapeHtml(row.invoiceRef || "-")}</strong><small>رقم الطلب: ${escapeHtml(row.orderNumber || "-")}</small><small>شكوى #${escapeHtml(row.noteId || "-")}</small></td>
            <td><strong>${escapeHtml(compensationIssueLabel(row.issueType))}</strong><small>${escapeHtml(row.reason || "-")}</small></td>
            <td><strong>${row.monitorAmount != null ? formatMoney(row.monitorAmount) : row.requestedAmount != null ? formatMoney(row.requestedAmount) : "-"}</strong><small>${row.monitorAmount != null ? "معتمد" : "محل المراجعة"}</small></td>
            <td><span class="financial-review-stage stage-${escapeHtml(row.status)}">${escapeHtml(compensationStageLabel(row.status))}</span></td>
            <td><span class="compensation-status status-${escapeHtml(row.status)}">${escapeHtml(compensationStatusLabel(row.status))}</span></td>
          </tr>`).join("")}</tbody>
      </table>
    </div>`;
  }

  function bindCompensationTable() {
    const content = el("compensationContent");
    content?.querySelectorAll("[data-ticket-row]").forEach((row) => {
      const open = () => openCompensationTicket(row.dataset.ticketRow);
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function openCompensationTicket(id) {
    const row = lastCompensationRows.find((item) => String(item.id) === String(id));
    const workspace = el("compensationTicketWorkspace");
    if (!row || !workspace) return;
    activeCompensationTicketId = row.id;
    workspace.innerHTML = `
      <div class="financial-review-ticket-workspace-head">
        <div><strong>تذكرة #${escapeHtml(row.id)}</strong><span>${escapeHtml(compensationStageLabel(row.status))}</span></div>
        <button type="button" data-close-ticket-workspace>إغلاق التذكرة</button>
      </div>
      ${renderCompensationCard(row)}`;
    showElement(workspace);
    bindCompensationCard(row);
    workspace.querySelector("[data-close-ticket-workspace]")?.addEventListener("click", () => {
      hideElement(workspace);
      activeCompensationTicketId = null;
    });
    workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderCompensationCard(row) {
    const monitorActions = canMonitorCompensation() && row.status === "pending_monitor_review" ? `
      <section class="compensation-action-box">
        <h4>مراجعة الكاميرات وتأكيد حقيقة الشكوى</h4>
        <div class="report-filter-grid">
          <label class="report-field">المبلغ المستحق<input id="monitorAmount-${row.id}" class="report-input" type="number" min="0" step="0.01" placeholder="EGP" /></label>
          <label class="report-field">تعليق المراجعة<input id="monitorComment-${row.id}" class="report-input" type="text" placeholder="ما ظهر في الكاميرات وسبب القرار" /></label>
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
        <p class="inventory-muted-text">وصلت الحالة بعد تأكيد المراقب. من هنا يبدأ المحاسب إجراءات الصرف النقدي وتسجيل القيد المالي في Odoo على شريك العميل وربطه برقم الشكوى.</p>
        <label class="report-field">تعليق المحاسب<input id="accountingComment-${row.id}" class="report-input" type="text" placeholder="ملاحظة بدء الصرف أو سبب الرفض" /></label>
        <div class="inventory-hero-actions">
          <button class="run-btn" data-accounting-approve="${row.id}" type="button">بدء إجراءات الصرف وإنشاء قيد Odoo</button>
          <button class="export-btn" data-accounting-reject="${row.id}" type="button">رفض محاسبي</button>
        </div>
      </section>` : "";

    const paymentActions = canAccountCompensation() && row.status === "awaiting_payment" ? `
      <section class="compensation-action-box">
        <h4>تأكيد الصرف النقدي للعميل</h4>
        <div class="report-filter-grid">
          <label class="report-field">المبلغ المدفوع<input id="paidAmount-${row.id}" class="report-input" type="number" min="0" step="0.01" value="${escapeHtml(row.monitorAmount || "")}" /></label>
          <label class="report-field">طريقة التحويل<input id="paymentMethod-${row.id}" class="report-input" type="text" placeholder="كاش / تحويل بنكي / وسيلة الصرف" /></label>
          <label class="report-field">مرجع التحويل<input id="paymentRef-${row.id}" class="report-input" type="text" placeholder="رقم العملية" /></label>
          <label class="report-field">إثبات التحويل<input id="paymentFile-${row.id}" class="report-input" type="file" accept="image/*,.pdf" /></label>
        </div>
        <label class="report-field">ملاحظة<input id="paymentComment-${row.id}" class="report-input" type="text" /></label>
        <div class="inventory-hero-actions"><button class="run-btn" data-payment-confirm="${row.id}" type="button">تأكيد الصرف وإغلاق الحالة</button></div>
      </section>` : "";

    const retryAction = canAccountCompensation() && (row.status === "failed" || row.odooPostingStatus === "failed")
      ? `<button class="export-btn" data-retry-odoo="${row.id}" type="button">إعادة محاولة قيد Odoo</button>`
      : "";

    return `<article class="compensation-card" data-compensation-card="${row.id}">
      <div class="compensation-card-head">
        <div><strong>تذكرة مراجعة مالية #${escapeHtml(row.id)}</strong><span class="compensation-status status-${escapeHtml(row.status)}">${escapeHtml(compensationStatusLabel(row.status))}</span></div>
        <small>${escapeHtml(formatDate(row.requestedAt))}</small>
      </div>
      <div class="compensation-meta-grid">
        <div><span>العميل</span><strong>${escapeHtml(row.customerName || "-")}</strong><small>${escapeHtml(row.customerPhone || "-")}</small></div>
        <div><span>الفاتورة / الطلب</span><strong>${escapeHtml(row.invoiceRef || "-")}</strong><small>رقم الطلب: ${escapeHtml(row.orderNumber || "-")} — شكوى #${escapeHtml(row.noteId || "-")}</small></div>
        <div><span>موضوع المراجعة</span><strong>${escapeHtml(compensationIssueLabel(row.issueType))}</strong><small>${escapeHtml(row.reason || "-")}</small></div>
        <div><span>المبلغ محل المراجعة</span><strong>${row.requestedAmount != null ? formatMoney(row.requestedAmount) : "غير محدد"}</strong><small>طلب خدمة العملاء</small></div>
        <div><span>المبلغ المعتمد</span><strong>${row.monitorAmount != null ? formatMoney(row.monitorAmount) : "لم يحدد بعد"}</strong><small>${escapeHtml(row.monitorReviewedByName || "-")}</small></div>
        <div><span>قيد Odoo المرتبط بالشكوى</span><strong>${escapeHtml(row.odooPostingStatus || "pending")}</strong><small>${escapeHtml(row.odooMoveName || row.odooPostingError || "-")}</small></div>
        <div><span>الصرف النقدي</span><strong>${escapeHtml(row.paymentStatus || "not_ready")}</strong><small>${row.paidAmount != null ? formatMoney(row.paidAmount) : "-"}</small></div>
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
    const headers = {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
      "X-Attachment-Type": type
    };
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
      if (decision === "eligible" && (amount === "" || Number(amount) <= 0)) {
        throw new Error("اكتب المبلغ المستحق قبل الاعتماد.");
      }
      if (file) await uploadCompensationAttachment(id, file, "camera_video");
      await request(`/compensations/${id}/monitor-review`, {
        method: "PATCH",
        body: JSON.stringify({ decision, amount: decision === "eligible" ? Number(amount) : null, comment })
      });
      setMessage(decision === "eligible" ? "تم تأكيد نتيجة مراجعة الكاميرات وتحويل الحالة للمحاسب المالي." : "تم تسجيل أن الحالة غير مستحقة ماليًا.", "success");
      broadcastCustomerServiceUpdate();
      await loadCompensations();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function submitAccounting(id, decision) {
    try {
      const comment = el(`accountingComment-${id}`)?.value?.trim() || "";
      await request(`/compensations/${id}/accounting-decision`, {
        method: "PATCH",
        body: JSON.stringify({ decision, comment })
      });
      setMessage(decision === "approved" ? "بدأ المحاسب إجراءات الصرف وتمت محاولة إنشاء القيد في Odoo على شريك العميل وربطه بالشكوى." : "تم رفض الحالة محاسبيًا.", "success");
      broadcastCustomerServiceUpdate();
      await loadCompensations();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function confirmCompensationPayment(id) {
    try {
      const file = el(`paymentFile-${id}`)?.files?.[0] || null;
      if (file) await uploadCompensationAttachment(id, file, "payment_proof");
      await request(`/compensations/${id}/payment`, {
        method: "PATCH",
        body: JSON.stringify({
          paidAmount: Number(el(`paidAmount-${id}`)?.value || 0),
          paymentMethod: el(`paymentMethod-${id}`)?.value?.trim() || "",
          paymentReference: el(`paymentRef-${id}`)?.value?.trim() || "",
          comment: el(`paymentComment-${id}`)?.value?.trim() || ""
        })
      });
      setMessage("تم تسجيل الصرف النقدي وإغلاق التذكرة المالية، وستظهر الحالة النهائية في سجل خدمة العملاء والتقرير.", "success");
      broadcastCustomerServiceUpdate();
      await loadCompensations();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function retryCompensationOdoo(id) {
    try {
      await request(`/compensations/${id}/retry-odoo`, { method: "POST", body: JSON.stringify({}) });
      setMessage("تمت إعادة محاولة معالجة قيد Odoo.", "success");
      broadcastCustomerServiceUpdate();
      await loadCompensations();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function loadCompensationDetails(id) {
    const box = el(`compensationDetails-${id}`);
    if (!box) return;
    if (!box.classList.contains("hidden")) {
      hideElement(box);
      return;
    }
    showElement(box);
    box.innerHTML = `<div class="inventory-empty">جاري تحميل التتبع...</div>`;
    try {
      const data = await request(`/compensations/${id}`);
      const row = data.compensation || {};
      const attachments = row.attachments || [];
      const events = data.events || [];
      box.innerHTML = `
        <h4>مرجع الشكوى</h4>
        <div class="financial-review-flow-note">الشكوى الأصلية #${escapeHtml(row.noteId || "-")} — الفاتورة: ${escapeHtml(row.invoiceRef || "-")} — رقم الطلب: ${escapeHtml(row.orderNumber || "-")} — ${escapeHtml(row.reason || "-")}</div>
        <h4>المرفقات</h4>
        <div class="compensation-attachments">${attachments.length ? attachments.map((a) => `<button class="compensation-attachment" type="button" data-open-comp-attachment="${a.id}" data-comp-request="${id}" data-comp-name="${escapeHtml(a.originalName || "attachment")}">${escapeHtml(a.originalName || a.type || "مرفق")}<small>${escapeHtml(a.type)} — ${escapeHtml(formatDate(a.uploadedAt))}</small></button>`).join("") : '<span class="inventory-muted-text">لا توجد مرفقات.</span>'}</div>
        <h4>سجل التتبع</h4>
        <div class="compensation-timeline">${events.length ? events.map((e) => `<div class="compensation-event"><span></span><div><strong>${escapeHtml(e.type)}</strong><small>${escapeHtml(e.actorName || "النظام")} — ${escapeHtml(formatDate(e.createdAt))}</small>${e.amount != null ? `<b>${formatMoney(e.amount)}</b>` : ""}${e.comment ? `<p>${escapeHtml(e.comment)}</p>` : ""}</div></div>`).join("") : '<span class="inventory-muted-text">لا توجد أحداث بعد.</span>'}</div>`;
      box.querySelectorAll("[data-open-comp-attachment]").forEach((button) => {
        button.addEventListener("click", () => openCompensationAttachment(button.dataset.compRequest, button.dataset.openCompAttachment, button.dataset.compName));
      });
    } catch (error) {
      box.innerHTML = `<div class="inventory-empty">${escapeHtml(error.message)}</div>`;
    }
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
        a.href = url;
        a.download = name || "attachment";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function loadCompensationFinancialReport() {
    if (!canAccountCompensation()) return;
    const content = el("compensationContent");
    try {
      const params = new URLSearchParams();
      const companyId = el("companyId")?.value || "";
      if (companyId) params.set("companyId", companyId);
      if (el("dateFrom")?.value) params.set("dateFrom", el("dateFrom").value);
      if (el("dateTo")?.value) params.set("dateTo", el("dateTo").value);
      if (el("compensationSearch")?.value?.trim()) params.set("search", el("compensationSearch").value.trim());
      const data = await request(`/compensations/report/financial?${params.toString()}`);
      const sum = data.summary || {};
      const summary = el("compensationSummary");
      if (summary) {
        showElement(summary);
        summary.innerHTML = `
          <div class="inventory-kpi-card"><span>إجمالي التذاكر</span><strong>${formatNumber(sum.total_cases || 0)}</strong><small>كل حالات المراجعة المالية</small></div>
          <div class="inventory-kpi-card"><span>المبالغ المعتمدة</span><strong>${formatMoney(sum.approved_amount || 0)}</strong><small>اعتماد المراقبة</small></div>
          <div class="inventory-kpi-card"><span>تم دفعه</span><strong>${formatMoney(sum.paid_amount || 0)}</strong><small>تحويلات مؤكدة</small></div>
          <div class="inventory-kpi-card"><span>معلق للدفع</span><strong>${formatMoney(sum.awaiting_payment_amount || 0)}</strong><small>${formatNumber(sum.awaiting_payment || 0)} حالة</small></div>`;
      }
      renderCompensations(data.rows || []);
    } catch (error) {
      if (content) content.innerHTML = `<div class="inventory-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  function bindEvents() {
    el("loadCompensationsBtn")?.addEventListener("click", loadCompensations);
    el("loadCompensationReportBtn")?.addEventListener("click", loadCompensationFinancialReport);
    el("compensationStatus")?.addEventListener("change", () => { setMessage(""); loadCompensations(); });
    el("companyId")?.addEventListener("change", () => { setMessage(""); loadCompensations(); });
    el("compensationLimit")?.addEventListener("change", loadCompensations);
    el("compensationSearch")?.addEventListener("input", () => {
      renderCompensations(lastCompensationRows, false);
      clearTimeout(compensationSearchTimer);
      compensationSearchTimer = setTimeout(() => loadCompensations(), 350);
    });
    el("compensationPhone")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loadCompensations();
    });
    ["dateFrom", "dateTo"].forEach((id) => {
      el(id)?.addEventListener("change", () => {
        document.querySelectorAll("[data-date-preset]").forEach((button) => button.classList.remove("active"));
      });
    });
    document.querySelectorAll("[data-date-preset]").forEach((button) => {
      button.addEventListener("click", () => setDatePreset(button.dataset.datePreset));
    });
    document.querySelectorAll("[data-view-mode]").forEach((button) => {
      button.addEventListener("click", () => setViewMode(button.dataset.viewMode));
    });
  }

  async function init() {
    applyDefaultDates();
    applyUrlParams();
    bindEvents();
    setViewMode(financialReviewViewMode, false);
    const allowed = await verifySession();
    if (allowed) await loadCompensations();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
