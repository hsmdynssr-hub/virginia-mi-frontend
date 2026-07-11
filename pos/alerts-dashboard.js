(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number)
      ? number.toLocaleString("ar-EG", { maximumFractionDigits: 2 })
      : "0";
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("ar-EG");
  }

  function statusBadge(status) {
    const value = String(status || "UNKNOWN").toUpperCase();
    const className = value === "SENT"
      ? "sent"
      : value === "FAILED"
        ? "failed"
        : "pending";

    return `<span class="alerts-status-badge ${className}">${escapeHtml(value)}</span>`;
  }

  function setStatus(message, isError = false) {
    const box = byId("alertsDashboardStatus");
    if (!box) return;
    box.textContent = message;
    box.classList.toggle("error", isError);
  }

  function collectFilters() {
    const standard = typeof getFilters === "function" ? getFilters() : {};
    const companyId = byId("companySelect")?.value || standard.companyId;

    if (!companyId) {
      throw new Error("اختر الشركة أولًا.");
    }

    return {
      ...standard,
      companyId,
      dateFrom: byId("dateFrom")?.value || standard.dateFrom || "",
      dateTo: byId("dateTo")?.value || standard.dateTo || "",
      eventType: byId("alertEventType")?.value || "all",
      status: byId("alertStatus")?.value || "all",
      branchName: byId("alertBranchName")?.value.trim() || "",
      cashierName: byId("alertCashierName")?.value.trim() || "",
      limit: byId("alertLimit")?.value || "500"
    };
  }

  function renderSummary(summary) {
    return renderKpis([
      kpiCard("إجمالي المشاكل", formatNumber(summary.totalProblems), "مرتجعات + خصومات يدوية مسجلة."),
      kpiCard("عدد المرتجعات", formatNumber(summary.returnsCount), "عدد تنبيهات مرتجع POS."),
      kpiCard("الخصومات اليدوية", formatNumber(summary.manualDiscountsCount), "بعد استبعاد العروض والكوبونات."),
      kpiCard("وصلت Telegram", formatNumber(summary.telegramSent), "رسائل Telegram المسجلة SENT."),
      kpiCard("فشل Telegram", formatNumber(summary.telegramFailed), "محاولات إرسال مسجلة FAILED."),
      kpiCard("نسبة نجاح الإرسال", `${formatNumber(summary.telegramSuccessRate)}%`, "الناجح ÷ محاولات Telegram."),
      kpiCard("الفواتير المتأثرة", formatNumber(summary.affectedOrders), "عدد الفواتير المختلفة."),
      kpiCard("قيمة المرتجعات", `${formatNumber(summary.totalReturnValue)} ج`, "إجمالي قيمة المرتجعات المسجلة."),
      kpiCard("قيمة الخصومات", `${formatNumber(summary.totalDiscountValue)} ج`, "إجمالي قيمة الخصومات اليدوية التقديرية.")
    ]);
  }

  function renderBranchCashier(rows) {
    return renderTable(
      [
        { key: "branchName", label: "الفرع" },
        { key: "cashierName", label: "الكاشير" },
        { key: "total", label: "إجمالي المشاكل" },
        { key: "returnsCount", label: "المرتجعات" },
        { key: "discountsCount", label: "الخصومات اليدوية" },
        { key: "sentCount", label: "تم الإرسال" },
        { key: "failedCount", label: "فشل" }
      ],
      rows || []
    );
  }

  function renderDetails(rows) {
    if (!rows.length) {
      return `<div class="alerts-empty">لا توجد مشاكل مطابقة للفلاتر.</div>`;
    }

    const body = rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.eventTypeLabel)}</td>
        <td>${escapeHtml(row.branchName)}</td>
        <td>${escapeHtml(row.posName)}</td>
        <td>${escapeHtml(row.cashierName)}</td>
        <td>${escapeHtml(row.orderName)}</td>
        <td>${escapeHtml(row.productName)}</td>
        <td>${formatNumber(row.qty)}</td>
        <td>${formatNumber(row.returnValue)}</td>
        <td>${formatNumber(row.discountPercent)}%</td>
        <td>${formatNumber(row.discountValue)}</td>
        <td>${statusBadge(row.telegramStatus)}</td>
        <td>${escapeHtml(row.telegramMessageId || "-")}</td>
        <td>${escapeHtml(formatDateTime(row.detectedAt))}</td>
        <td>${escapeHtml(formatDateTime(row.telegramSentAt))}</td>
        <td title="${escapeHtml(row.errorMessage || "")}">${escapeHtml(row.errorMessage || "-")}</td>
      </tr>
    `).join("");

    return `
      <div class="alerts-table-wrap">
        <table class="alerts-details-table">
          <thead>
            <tr>
              <th>المشكلة</th><th>الفرع</th><th>نقطة البيع</th><th>الكاشير</th>
              <th>الفاتورة</th><th>المنتج</th><th>الكمية</th><th>قيمة المرتجع</th>
              <th>نسبة الخصم</th><th>قيمة الخصم</th><th>Telegram</th><th>Message ID</th>
              <th>وقت المشكلة</th><th>وقت الإرسال</th><th>الخطأ</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  async function loadAlertsDashboard() {
    const reportArea = byId("reportArea");

    try {
      const filters = collectFilters();
      setStatus("جاري تحميل تقرير التنبيهات...");

      if (typeof showLoading === "function") showLoading();

      const response = await apiGet("/alerts/dashboard", filters);
      const report = response.data || {};
      const summary = report.summary || {};
      const branchRows = report.byBranchCashier || [];
      const rows = report.rows || [];

      reportArea.innerHTML = `
        ${renderSummary(summary)}
        ${renderPanel("الحصر حسب الفرع والكاشير", renderBranchCashier(branchRows))}
        ${renderPanel("تفاصيل المشاكل المرسلة إلى Telegram", renderDetails(rows))}
      `;

      setStatus(`تم تحميل ${formatNumber(summary.totalProblems)} مشكلة حسب الفلاتر.`);
    } catch (error) {
      setStatus(error.message || "فشل تحميل تقرير التنبيهات.", true);
      if (typeof showError === "function") showError(error);
    }
  }

  const loadButton = byId("loadBtn");
  if (loadButton) {
    loadButton.addEventListener("click", loadAlertsDashboard);
  }

  if (window.ReportExport?.setup) {
    window.ReportExport.setup("alerts-dashboard");
  } else {
    window.addEventListener("load", () => {
      window.ReportExport?.setup("alerts-dashboard");
    }, { once: true });
  }
})();
