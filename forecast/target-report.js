document.addEventListener("DOMContentLoaded", async () => {
  renderLayout(
    "تقرير التارجت",
    "تحليل المنتجات المستهدفة، المطلوب تصنيعه، الخامات المطلوبة، والعجز المتوقع من Multi-Level BOM.",
    "forecast-target-report",
    buildTargetReportPage()
  );

  bindTargetReportEvents();
  renderTargetPendingState();
});

function getTargetId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("targetId");
}

function buildTargetReportPage() {
  return `
    <div class="container-fluid mi-bootstrap-page px-0">
    <section id="targetPendingBox" class="mi-pending-card p-4 mb-4"></section>
    <section id="targetInfoBox"></section>

    <section id="targetKpiGrid" class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3 mb-4"></section>

    <section class="mi-report-card target-report-section hidden">
      <h2 class="mi-report-title"><span class="mi-section-icon">🎯</span>منتجات التارجت</h2>
      <div id="targetProductsTable"></div>
    </section>

    <section class="mi-report-card target-report-section hidden">
      <h2 class="mi-report-title"><span class="mi-section-icon">🏭</span>خطة تصنيع المنتجات الوسيطة</h2>
      <div id="manufacturingTable"></div>
    </section>

    <section class="mi-report-card target-report-section hidden">
      <h2 class="mi-report-title"><span class="mi-section-icon">🛒</span>خطة شراء الخامات</h2>
      <div id="purchaseTable"></div>
    </section>

    <section class="mi-report-card target-report-section hidden">
      <h2 class="mi-report-title"><span class="mi-section-icon">⚠</span>المخاطر والتنبيهات</h2>
      <div id="risksBox"></div>
    </section>

    <section class="mi-report-card target-report-section hidden">
      <h2 class="mi-report-title"><span class="mi-section-icon">🧩</span>BOM Trace</h2>
      <div id="bomTreesBox"></div>
    </section>

    <section class="mi-report-card target-report-section hidden">
      <h2 class="mi-report-title"><span class="mi-section-icon">ℹ</span>ملاحظات التقرير</h2>
      <div id="notesBox"></div>
    </section>

    <section id="loadingBox" class="alert alert-warning d-flex align-items-center hidden" role="status">
      <span class="spinner-border spinner-border-sm mi-loading-spinner" aria-hidden="true"></span>
      جاري تحميل تقرير التارجت...
    </section>

    <section id="errorBox" class="alert alert-danger hidden" role="alert"></section>
    </div>
  `;
}

function renderTargetPendingState() {
  const pending = document.getElementById("targetPendingBox");
  if (!pending) return;

  pending.innerHTML = `
    <h2 class="h6 fw-bold mb-2">التقرير لم يتم تحميله بعد</h2>
    <p class="mb-0">اضغط <strong>تحديث التقرير</strong> لعرض تحليل التارجت وخطط التصنيع والشراء.</p>
  `;
}

function bindTargetReportEvents() {
  document.getElementById("refreshTargetReportBtn")
    ?.addEventListener("click", loadTargetReport);

  document.getElementById("loadBtn")
    ?.addEventListener("click", loadTargetReport);

    document.getElementById("exportTargetReportBtn")
  ?.addEventListener("click", downloadTargetReportExcel);
}

function showLoading() {
  document.getElementById("loadingBox")?.classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loadingBox")?.classList.add("hidden");
}

function showError(error) {
  const box = document.getElementById("errorBox");
  if (!box) return;

  box.textContent = error.message || "حدث خطأ أثناء تحميل التقرير";
  box.classList.remove("hidden");
}

function clearError() {
  const box = document.getElementById("errorBox");
  if (!box) return;

  box.textContent = "";
  box.classList.add("hidden");
}

async function loadTargetReport() {
  try {
    clearError();
    showLoading();

    const targetId = getTargetId();

    if (!targetId) {
  document.getElementById("errorBox").innerHTML = `
    Target ID غير موجود في الرابط.
    <br />
    افتح التقرير من صفحة إدارة التارجت.
    <br /><br />
    <a class="run-btn" href="./targets.html">الرجوع لإدارة التارجت</a>
  `;

  document.getElementById("errorBox").classList.remove("hidden");
  return;
}

    const response = await apiGet(`/forecast/targets/${targetId}/report`, {
      maxDepth: 10
    });

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل تقرير التارجت");
    }

    document.getElementById("targetPendingBox")?.classList.add("hidden");
    document.querySelectorAll(".target-report-section").forEach((section) => {
      section.classList.remove("hidden");
    });
    renderTargetReport(response);
  } catch (error) {
    console.error(error);
    showError(error);
  } finally {
    hideLoading();
  }
}

function renderTargetReport(report) {
  renderTargetInfo(report.target, report.settings);
  renderKpis(report.data?.summary || {});
  renderTargetProducts(report.data?.targetProducts || []);
  renderManufacturingRequirements(report.data?.manufacturingRequirements || []);
  renderPurchaseRequirements(report.data?.purchaseRequirements || []);
  renderRisks(report.data?.risks || []);
  renderBomTrees(report.data?.bomTrees || []);
  renderNotes(report.data?.notes || []);
}

function renderTargetInfo(target, settings) {
  const container = document.getElementById("targetInfoBox");
  if (!container) return;

  container.innerHTML = `
    <section class="mi-report-card mb-4">
      <div class="row g-3">
        <div class="col-12 col-md"><span class="text-secondary small d-block">Target</span><strong>${target?.targetName || "-"}</strong></div>
        <div class="col-6 col-md"><span class="text-secondary small d-block">Company</span><strong>${target?.companyId || "-"}</strong></div>
        <div class="col-12 col-md"><span class="text-secondary small d-block">Period</span><strong>${formatDate(target?.dateFrom)} → ${formatDate(target?.dateTo)}</strong></div>
        <div class="col-6 col-md"><span class="text-secondary small d-block">Status</span><span class="badge text-bg-primary">${target?.status || "-"}</span></div>
        <div class="col-12 col-md"><span class="text-secondary small d-block">FG Stock Mode</span><strong>${settings?.stockMode || "-"}</strong></div>
      </div>
    </section>
  `;
}

function renderKpis(summary) {
  const grid = document.getElementById("targetKpiGrid");
  if (!grid) return;

  const cards = [
    {
      title: "عدد منتجات التارجت",
      value: formatNumber(summary.targetProductsCount, 0),
      hint: "عدد المنتجات النهائية داخل التارجت"
    },
    {
      title: "إجمالي كمية التارجت",
      value: formatNumber(summary.totalTargetQty, 4),
      hint: "إجمالي الكميات المطلوبة"
    },
    {
      title: "بيع فترة التارجت",
      value: formatNumber(summary.totalSalesPeriodQty, 4),
      hint: "إجمالي الكمية المباعة في نفس فترة التارجت"
    },
    {
      title: "بيع نفس الفترة السنة السابقة",
      value: formatNumber(summary.totalPreviousYearQty, 4),
      hint: "إجمالي الكمية المباعة لنفس الفترة من السنة السابقة"
    },
    {
      title: "متوسط البيع اليومي",
      value: formatNumber(summary.totalAverageDailySalesQty, 4),
      hint: "متوسط البيع اليومي داخل فترة التارجت"
    },
    {
      title: "فرق التارجت عن الفترة",
      value: `${formatNumber(summary.targetVsPeriodPercent, 2)}%`,
      hint: "مقارنة التارجت مع بيع الفترة"
    },
    {
      title: "فرق التارجت عن السنة السابقة",
      value: `${formatNumber(summary.targetVsPreviousYearPercent, 2)}%`,
      hint: "مقارنة التارجت مع نفس الفترة السنة السابقة"
    },
    {
      title: "المتاح منتج تام",
      value: formatNumber(summary.totalAvailableFgQty, 4),
      hint: "المتاح من المنتج التام حسب المخازن المختارة"
    },
    {
      title: "المطلوب تصنيعه",
      value: formatNumber(summary.totalToManufactureQty, 4),
      hint: "التارجت بعد خصم المنتج التام المتاح"
    },
    {
      title: "منتجات وسيطة",
      value: formatNumber(summary.intermediateProductsCount, 0),
      hint: "منتجات لها BOM داخلي"
    },
    {
      title: "خامات نهائية",
      value: formatNumber(summary.rawMaterialsCount, 0),
      hint: "خامات لا يوجد لها BOM"
    },
    {
      title: "خامات ناقصة",
      value: formatNumber(summary.rawMaterialShortageCount, 0),
      hint: "خامات مطلوب شراؤها"
    }
  ];

  grid.innerHTML = cards
    .map((card, index) => `
      <div class="col">
       <div class="mi-kpi-card h-100"
            data-tone="${["purple", "teal", "success", "warning"][index % 4]}"
            data-icon="${["🎯", "📦", "↗", "📅", "📊", "%", "%", "✅", "🏭", "🧩", "🌾", "⚠"][index]}"
            style="--mi-delay:${index * 45}ms">
        <span class="mi-kpi-label">${card.title}</span>
        <strong class="mi-kpi-value">${card.value}</strong>
        <small class="mi-kpi-hint">${card.hint}</small>
       </div>
      </div>
    `)
    .join("");
}

function renderTargetProducts(rows) {
  const container = document.getElementById("targetProductsTable");
  if (!container) return;

  container.innerHTML = buildTable({
    columns: [
      { label: "Product ID", render: (row) => row.productId },
      { label: "المنتج", render: (row) => row.productName },
      { label: "الفئة", render: (row) => row.categoryName || "-" },
      { label: "التارجت", render: (row) => formatNumber(row.targetQty, 4) },
      { label: "بيع الفترة", render: (row) => formatNumber(row.salesPeriodQty, 4) },
      { label: "متوسط يومي", render: (row) => formatNumber(row.averageDailySalesQty, 4) },
      { label: "بيع السنة السابقة", render: (row) => formatNumber(row.previousYearQty, 4) },
      { label: "نمو البيع", render: (row) => `${formatNumber(row.salesGrowthPercent, 2)}%` },
      { label: "فرق التارجت/الفترة", render: (row) => `${formatNumber(row.targetVsPeriodPercent, 2)}%` },
      { label: "فرق التارجت/السنة", render: (row) => `${formatNumber(row.targetVsPreviousYearPercent, 2)}%` },
      { label: "المتاح تام", render: (row) => formatNumber(row.availableFgQty, 4) },
      { label: "المطلوب تصنيع", render: (row) => formatNumber(row.toManufactureQty, 4) },
      { label: "تغطية المخزون", render: (row) => `${formatNumber(row.coveragePercent, 2)}%` },
      { label: "الأولوية", render: (row) => row.priority || "normal" }
    ],
    rows
  });
}

function renderManufacturingRequirements(rows) {
  const container = document.getElementById("manufacturingTable");
  if (!container) return;

  container.innerHTML = buildTable({
    columns: [
      { label: "Product ID", render: (row) => row.productId },
      { label: "المنتج الوسيط", render: (row) => row.productName },
      { label: "الفئة", render: (row) => row.categoryName || "-" },
      { label: "المطلوب", render: (row) => formatNumber(row.requiredQty, 4) },
      { label: "المتاح", render: (row) => formatNumber(row.availableQty, 4) },
      { label: "العجز", render: (row) => formatNumber(row.shortageQty, 4) },
      { label: "تصنيع مقترح", render: (row) => formatNumber(row.suggestedActionQty, 4) },
      { label: "UoM", render: (row) => row.uomName || "-" }
    ],
    rows
  });
}

function renderPurchaseRequirements(rows) {
  const container = document.getElementById("purchaseTable");
  if (!container) return;

  container.innerHTML = buildTable({
    columns: [
      { label: "Product ID", render: (row) => row.productId },
      { label: "الخامة", render: (row) => row.productName },
      { label: "الفئة", render: (row) => row.categoryName || "-" },
      { label: "المطلوب", render: (row) => formatNumber(row.requiredQty, 4) },
      { label: "المتاح", render: (row) => formatNumber(row.availableQty, 4) },
      { label: "العجز", render: (row) => formatNumber(row.shortageQty, 4) },
      { label: "شراء مقترح", render: (row) => formatNumber(row.suggestedActionQty, 4) },
      { label: "UoM", render: (row) => row.uomName || "-" }
    ],
    rows
  });
}

function renderRisks(risks) {
  const container = document.getElementById("risksBox");
  if (!container) return;

  if (!risks.length) {
    container.innerHTML = `<div class="alert alert-success mb-0">لا توجد مخاطر واضحة</div>`;
    return;
  }

  container.innerHTML = `
    <div class="d-grid gap-2">
      ${risks.map((risk) => `
        <div class="mi-insight-item mi-risk-item">
          <strong>${risk.level || "info"}:</strong>
          ${risk.message || "-"}
        </div>
      `).join("")}
    </div>
  `;
}

function renderBomTrees(trees) {
  const container = document.getElementById("bomTreesBox");
  if (!container) return;

  if (!trees.length) {
    container.innerHTML = `<div class="alert mi-empty-state py-4">لا توجد BOM Trees للعرض</div>`;
    return;
  }

  container.innerHTML = trees
    .map((item) => `
      <details class="bom-tree-card">
        <summary>
          ${item.targetProductName}
          — Target: ${formatNumber(item.targetQty, 4)}
          — Manufacture: ${formatNumber(item.toManufactureQty, 4)}
        </summary>

        <div class="bom-tree-body">
          ${renderBomNode(item.tree)}
        </div>
      </details>
    `)
    .join("");
}

function renderBomNode(node) {
  if (!node) return "";

  return `
    <div class="bom-node level-${node.level || 0}">
      <div>
        <strong>${node.productName}</strong>
        <span>(${node.type})</span>
        <span>Qty: ${formatNumber(node.requiredQty, 4)}</span>
      </div>

      ${(node.children || []).map((child) => `
        <div class="bom-child">
          <span>↳ ${child.componentProductName}</span>
          <span>Required: ${formatNumber(child.componentRequiredQty, 4)}</span>
          ${renderBomNode(child.child)}
        </div>
      `).join("")}
    </div>
  `;
}

function renderNotes(notes) {
  const container = document.getElementById("notesBox");
  if (!container) return;

  if (!notes.length) {
    container.innerHTML = `<div class="alert mi-empty-state py-4">لا توجد ملاحظات</div>`;
    return;
  }

  container.innerHTML = `
    <div class="d-grid gap-2">
      ${notes.map((note) => `<div class="mi-insight-item">${note}</div>`).join("")}
    </div>
  `;
}

function buildTable({ columns, rows }) {
  if (!rows || rows.length === 0) {
    return `<div class="alert mi-empty-state py-4">لا توجد بيانات</div>`;
  }

  return `
    <div class="table-responsive">
      <table class="table table-hover table-striped align-middle mi-data-table">
        <thead>
          <tr>
            ${columns.map((column) => `<th>${column.label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              ${columns.map((column) => `<td>${column.render(row)}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function formatNumber(value, digits = 2) {
  const number = Number(value || 0);

  return number.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}
function buildTargetReportExportQuery() {
  const query = new URLSearchParams();

  query.set("report", "forecast.target_report");

  const targetId = getTargetId();
  if (targetId) query.set("targetId", targetId);

  const companyId = document.getElementById("companySelect")?.value;
  if (companyId) query.set("companyId", companyId);

  query.set("maxDepth", "10");

  return query.toString();
}

function getTargetReportExportToken() {
  if (typeof getAuthToken === "function") {
    return getAuthToken();
  }

  return localStorage.getItem("token") || "";
}

function getFilenameFromContentDisposition(headerValue) {
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

async function downloadTargetReportExcel() {
  const exportBtn = document.getElementById("exportTargetReportBtn");

  try {
    clearError();

    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.textContent = "جاري التصدير...";
    }

    const query = buildTargetReportExportQuery();
    const token = getTargetReportExportToken();

    const response = await fetch(
      `${API_BASE_URL}/exports/excel?${query}`,
      {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "فشل تصدير تقرير التارجت Excel");
    }

    const blob = await response.blob();

    const filename =
      getFilenameFromContentDisposition(
        response.headers.get("Content-Disposition")
      ) || "forecast-target-report.xlsx";

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    showError(error);
  } finally {
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.textContent = "تصدير Excel";
    }
  }
}
