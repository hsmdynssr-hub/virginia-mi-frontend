"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  renderLayout(
    "مطابقة تقييم المخزون مع الحسابات",
    "مقارنة تقييم Odoo برصيد حساب المخزون المرحّل، ثم تضييق فترة الفرق حتى الوصول إلى السبب والقيد.",
    "inventory-valuation-reconciliation",
    buildReconciliationContent()
  );

  initializeReconciliationDates();
  bindReconciliationEvents();

  const status = document.getElementById("reconStatus");
  if (status) {
    status.className = "alert recon-status is-warning mb-3";
    status.classList.remove("d-none");
    status.innerHTML = "اختر الشركة والفترة ثم اضغط <strong>تحديث التقرير</strong>.";
  }
});

function buildReconciliationContent() {
  return `
    <div class="container-fluid mi-bootstrap-page px-0 recon-page">
      <section class="mi-filter-card mb-3">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-4 col-xl-3">
            <label class="form-label" for="reconAccountCode">حساب المخزون</label>
            <input id="reconAccountCode" class="form-control" value="143001" inputmode="numeric" />
            <div class="form-text">الحساب المحاسبي الذي تتم مطابقته مع تقييم المخزون.</div>
          </div>
          <div class="col-12 col-md-8 col-xl-9">
            <div class="alert alert-light border mb-0 recon-small">
              <strong>منهج القياس:</strong> تقييم المخزون يُستخرج بنفس أسلوب شاشة Odoo
              <span class="recon-mono">web_read_group → stock.valuation.layer → categ_id</span>
              مع الأصناف المخزنية فقط، والحساب المحاسبي يشمل القيود <strong>Posted</strong> فقط.
            </div>
          </div>
        </div>
      </section>

      <section id="reconLoading" class="alert alert-warning d-none" role="status">
        <span class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
        جاري بناء المطابقة من Odoo...
      </section>
      <section id="reconError" class="alert alert-danger d-none" role="alert"></section>

      <section id="reconStatus" class="alert recon-status d-none mb-3"></section>

      <section id="reconKpis" class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3 mb-4"></section>

      <section class="mi-report-card mb-4">
        <div class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3">
          <div>
            <h2 class="mi-report-title mb-1">مسار الفرق عبر الزمن</h2>
            <div class="text-secondary recon-small">اضغط «تحقيق» على الفترة التي تغير فيها الفرق لتضييقها تلقائيًا حتى اليوم المتسبب.</div>
          </div>
          <div id="reconAccountBadge"></div>
        </div>
        <div id="reconTimeline"></div>
      </section>

      <section id="reconInvestigationCard" class="mi-report-card d-none">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h2 class="mi-report-title mb-1">نتيجة التحقيق</h2>
            <div id="reconInvestigationRange" class="text-secondary recon-small"></div>
          </div>
          <button id="closeInvestigationBtn" class="btn btn-outline-secondary btn-sm">إغلاق التحقيق</button>
        </div>
        <div id="reconInvestigation"></div>
      </section>
    </div>
  `;
}

function initializeReconciliationDates() {
  const dateFrom = document.getElementById("dateFrom");
  const dateTo = document.getElementById("dateTo");
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  if (dateFrom) dateFrom.value = yearStart;
  if (dateTo) dateTo.value = today;
  const datePreset = document.getElementById("datePreset");
  if (datePreset) datePreset.value = "custom";
  const customDates = document.getElementById("customDates");
  if (customDates) {
    customDates.hidden = false;
    customDates.style.display = "flex";
  }
}

function bindReconciliationEvents() {
  document.getElementById("loadBtn")?.addEventListener("click", loadReconciliationReport);
  document.getElementById("companySelect")?.addEventListener("change", () => {
    clearInvestigation();
  });
  document.getElementById("closeInvestigationBtn")?.addEventListener("click", clearInvestigation);
  window.loadReconciliationReport = loadReconciliationReport;
}

function getReconFilters() {
  return {
    companyId: document.getElementById("companySelect")?.value || "",
    dateFrom: document.getElementById("dateFrom")?.value || "",
    dateTo: document.getElementById("dateTo")?.value || "",
    accountCode: document.getElementById("reconAccountCode")?.value?.trim() || "143001"
  };
}

async function loadReconciliationReport() {
  const filters = getReconFilters();
  if (!filters.companyId) {
    showReconciliationError("لازم تختار الشركة أولًا.");
    return;
  }
  if (!filters.dateFrom || !filters.dateTo) {
    showReconciliationError("حدد تاريخ البداية والنهاية.");
    return;
  }

  setReconLoading(true);
  clearReconError();
  clearInvestigation();

  try {
    const response = await apiGet("/inventory/valuation-reconciliation", filters);
    if (!response.success) throw new Error(response.message || "فشل تحميل المطابقة.");
    renderReconciliationReport(response.data || {});
  } catch (error) {
    showReconciliationError(error.message || "فشل تحميل المطابقة.");
  } finally {
    setReconLoading(false);
  }
}

function renderReconciliationReport(data) {
  const summary = data.summary || {};
  const company = data.company || {};
  const accounts = data.accounts || [];

  renderReconStatus(summary, company);
  renderReconKpis(summary);
  renderReconTimeline(data.timeline || [], data.filters || {});

  const badge = document.getElementById("reconAccountBadge");
  if (badge) {
    badge.innerHTML = accounts.map((account) =>
      `<span class="badge text-bg-light border">${escapeHtml(account.code)} — ${escapeHtml(account.name)}</span>`
    ).join(" ");
  }
}

function renderReconStatus(summary, company) {
  const box = document.getElementById("reconStatus");
  if (!box) return;

  const difference = Number(summary.difference || 0);
  const rate = Number(summary.differenceRate || 0);
  const matched = Math.abs(difference) < 0.01;

  box.className = `alert recon-status mb-3 ${matched ? "is-ok" : rate <= 0.25 ? "is-warning" : "is-danger"}`;
  box.classList.remove("d-none");
  box.innerHTML = matched
    ? `<strong>مطابقة كاملة.</strong> تقييم المخزون يساوي الرصيد المحاسبي المرحّل للشركة ${escapeHtml(company.name || "")} في تاريخ الإقفال.`
    : `<strong>يوجد فرق يحتاج تفسيرًا:</strong> ${formatMoney(difference)} — نسبة ${formatPercent(rate)}. التقرير لا يفترض السبب؛ استخدم التحقيق على الفترات التي تغير فيها الفرق.`;
}

function renderReconKpis(summary) {
  const root = document.getElementById("reconKpis");
  if (!root) return;

  const cards = [
    ["تقييم المخزون في Odoo", summary.inventoryValuation, "نفس منطق شاشة تقييم المخزون"],
    ["رصيد المخزون المحاسبي", summary.accountingValuation, "Posted فقط"],
    ["الفرق عند الإقفال", summary.difference, `النسبة ${formatPercent(summary.differenceRate || 0)}`],
    ["تغير الفرق خلال الفترة", summary.periodDifferenceChange, `فرق الافتتاح ${formatMoney(summary.openingDifference || 0)}`]
  ];

  root.innerHTML = cards.map(([label, value, sub]) => `
    <div class="col">
      <article class="mi-report-card recon-kpi">
        <div class="text-secondary recon-small mb-2">${escapeHtml(label)}</div>
        <div class="recon-value">${formatMoney(value)}</div>
        <div class="recon-sub">${escapeHtml(String(sub))}</div>
      </article>
    </div>
  `).join("");
}

function renderReconTimeline(rows, filters) {
  const root = document.getElementById("reconTimeline");
  if (!root) return;

  if (!rows.length) {
    root.innerHTML = '<div class="alert alert-light border">لا توجد بيانات للفترة المختارة.</div>';
    return;
  }

  root.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover align-middle recon-table mb-0">
        <thead>
          <tr>
            <th>الفترة</th>
            <th>تقييم المخزون</th>
            <th>المحاسبة</th>
            <th>الفرق</th>
            <th>تغير الفرق</th>
            <th>الحالة</th>
            <th class="recon-action-cell">الإجراء</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => {
            const change = row.differenceChange;
            const material = Boolean(row.isMaterial);
            const changeClass = Number(change || 0) > 0 ? "recon-change-positive" : "recon-change-negative";
            const investigationFrom = index === 0 ? filters.dateFrom : addOneDay(rows[index - 1].date);
            return `
              <tr>
                <td>${row.isOpening ? "افتتاح قبل الفترة" : escapeHtml(row.date || "")}</td>
                <td>${formatMoney(row.valuation)}</td>
                <td>${formatMoney(row.accounting)}</td>
                <td>${formatMoney(row.difference)}</td>
                <td class="${material ? `recon-change-material ${changeClass}` : ""}">${change === null ? "—" : formatMoney(change)}</td>
                <td>${row.isOpening ? '<span class="badge text-bg-secondary">Opening</span>' : material ? '<span class="badge text-bg-warning">تغير جوهري</span>' : '<span class="badge text-bg-light border">مستقر نسبيًا</span>'}</td>
                <td>
                  ${row.isOpening ? "—" : `<button class="btn btn-sm ${material ? "btn-primary" : "btn-outline-primary"}" onclick="investigateReconPeriod('${investigationFrom}','${row.date}')">تحقيق</button>`}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function investigateReconPeriod(dateFrom, dateTo) {
  const filters = getReconFilters();
  setReconLoading(true);
  clearReconError();

  try {
    const response = await apiGet("/inventory/valuation-reconciliation/investigate", {
      companyId: filters.companyId,
      accountCode: filters.accountCode,
      dateFrom,
      dateTo,
      timezone: "Africa/Cairo"
    });

    if (!response.success) throw new Error(response.message || "فشل التحقيق.");
    renderInvestigation(response.data || {});
  } catch (error) {
    showReconciliationError(error.message || "فشل التحقيق.");
  } finally {
    setReconLoading(false);
  }
}
window.investigateReconPeriod = investigateReconPeriod;

function renderInvestigation(data) {
  const card = document.getElementById("reconInvestigationCard");
  const root = document.getElementById("reconInvestigation");
  const range = document.getElementById("reconInvestigationRange");
  if (!card || !root) return;

  card.classList.remove("d-none");
  if (range) {
    range.textContent = `${data.filters?.dateFrom || ""} → ${data.filters?.dateTo || ""} | النافذة النهائية: ${data.narrowedWindow?.dateFrom || ""} → ${data.narrowedWindow?.dateTo || ""}`;
  }

  const explanation = data.explanation || {};
  const events = data.events || [];
  const path = data.narrowingPath || [];

  root.innerHTML = `
    <div class="row row-cols-1 row-cols-md-3 g-3 mb-4">
      <div class="col"><div class="border rounded p-3 h-100"><div class="text-secondary recon-small">تغير الفرق المستهدف</div><strong>${formatMoney(data.target?.differenceChange || 0)}</strong></div></div>
      <div class="col"><div class="border rounded p-3 h-100"><div class="text-secondary recon-small">المبلغ المفسر</div><strong>${formatMoney(explanation.explainedAmount || 0)}</strong></div></div>
      <div class="col"><div class="border rounded p-3 h-100"><div class="text-secondary recon-small">نسبة التفسير</div><strong>${formatPercent(explanation.coveragePercent || 0)}</strong></div></div>
    </div>

    ${path.length ? `
      <h3 class="h6 mb-3">مسار تضييق الفترة</h3>
      <div class="mb-4">
        ${path.map((step) => `
          <div class="recon-path-step">
            <strong>${escapeHtml(step.windowFrom)} → ${escapeHtml(step.windowTo)}</strong>
            <span class="text-secondary"> — تم اختيار ${escapeHtml(step.selected?.from || "")} → ${escapeHtml(step.selected?.to || "")} لأن تغير الفرق فيه ${formatMoney(step.selected?.differenceChange || 0)}</span>
          </div>
        `).join("")}
      </div>
    ` : ""}

    <h3 class="h6 mb-3">الأحداث التي تغير فيها الفرق</h3>
    ${events.length ? events.map(renderInvestigationEvent).join("") : '<div class="alert alert-light border">لم يظهر تغير يومي داخل النافذة النهائية.</div>'}
  `;

  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderInvestigationEvent(event) {
  const cause = event.rootCause || {};
  const confirmed = cause.status === "confirmed";
  const details = event.details || [];

  return `
    <article class="border rounded p-3 mb-3 ${confirmed ? "recon-cause-confirmed" : "recon-cause-unexplained"}">
      <div class="d-flex flex-wrap justify-content-between gap-2 mb-3">
        <div>
          <strong>${escapeHtml(event.date || "")}</strong>
          <div class="text-secondary recon-small">تغير الفرق: ${formatMoney(event.differenceChange || 0)}</div>
        </div>
        <span class="badge ${confirmed ? "text-bg-success" : cause.status === "partial" ? "text-bg-warning" : "text-bg-danger"}">
          ${escapeHtml(cause.label || "غير مفسر")}
        </span>
      </div>

      <div class="row row-cols-1 row-cols-md-4 g-2 mb-3 recon-small">
        <div class="col"><div class="border rounded p-2"><span class="text-secondary">حركة التقييم</span><br><strong>${formatMoney(event.valuationChange || 0)}</strong></div></div>
        <div class="col"><div class="border rounded p-2"><span class="text-secondary">الحركة المحاسبية</span><br><strong>${formatMoney(event.accountingChange || 0)}</strong></div></div>
        <div class="col"><div class="border rounded p-2"><span class="text-secondary">قيمة Draft</span><br><strong>${formatMoney(event.draft?.value || 0)}</strong></div></div>
        <div class="col"><div class="border rounded p-2"><span class="text-secondary">الثقة</span><br><strong>${Number(cause.confidence || 0)}%</strong></div></div>
      </div>

      ${confirmed ? `
        <div class="alert alert-success py-2">
          <strong>السبب مؤكد:</strong> صافي قيود تقييم المخزون المسودة يساوي تغير الفرق في هذا اليوم. المعالجة: مراجعة القيود والحركة المرجعية ثم ترحيل القيود الصحيحة من داخل Odoo وإعادة تشغيل المطابقة.
        </div>
      ` : `
        <div class="alert alert-warning py-2">
          لا توجد قيود Draft تفسر هذا التغير بالكامل. لا يفترض التقرير سببًا غير مثبت؛ الخطوة التالية هي مراجعة تاريخ القيود المرحّلة وإعادة التقييم / Landed Cost للحركة المعنية.
        </div>
      `}

      ${details.length ? `
        <div class="table-responsive">
          <table class="table table-sm mb-0">
            <thead><tr><th>القيد</th><th>الحركة / المنتج</th><th>قيمة SVL</th><th>الحسابات</th></tr></thead>
            <tbody>
              ${details.map((row) => `
                <tr>
                  <td><strong class="recon-mono">${escapeHtml(row.accountMoveName || String(row.accountMoveId || ""))}</strong><br><small>${escapeHtml(row.accountMoveDate || "")} — ${escapeHtml(row.accountMoveState || "")}</small></td>
                  <td>${escapeHtml(row.productName || "")}<br><small>${escapeHtml(row.stockMoveName || "")}</small></td>
                  <td>${formatMoney(row.value || 0)}</td>
                  <td>${(row.journalLines || []).map((line) => `${escapeHtml(line.accountCode || "")} ${escapeHtml(line.accountName || "")} (${formatMoney(line.balance || 0)})`).join("<br>")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : ""}
    </article>
  `;
}

function clearInvestigation() {
  document.getElementById("reconInvestigationCard")?.classList.add("d-none");
  const root = document.getElementById("reconInvestigation");
  if (root) root.innerHTML = "";
}

function setReconLoading(active) {
  document.getElementById("reconLoading")?.classList.toggle("d-none", !active);
}

function showReconciliationError(message) {
  const box = document.getElementById("reconError");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("d-none");
}

function clearReconError() {
  const box = document.getElementById("reconError");
  if (!box) return;
  box.textContent = "";
  box.classList.add("d-none");
}

function formatMoney(value) {
  return new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 4 }).format(Number(value || 0))}%`;
}

function addOneDay(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
