/* Shared Bootstrap report renderers. New reports should reuse these helpers. */
function reportKpi(label, value, hint = "", tone = "purple", icon = "📊", delay = 0) {
  return `
    <div class="col">
     <div class="mi-kpi-card h-100" data-tone="${tone}" data-icon="${icon}" style="--mi-delay:${delay}ms" title="${hint}">
      <span class="mi-kpi-label">${label}</span>
      <strong class="mi-kpi-value">${value ?? "-"}</strong>
      <small class="mi-kpi-hint">${hint}</small>
     </div>
    </div>
  `;
}

function reportKpiGrid(items = []) {
  return `
    <div class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3 mb-4">
      ${items.map((item, index) => reportKpi(
        item.label,
        item.value,
        item.hint,
        item.tone || ["purple", "teal", "success", "warning"][index % 4],
        item.icon || ["📊", "◆", "✓", "⚡"][index % 4],
        index * 45
      )).join("")}
    </div>
  `;
}

function reportPanel(title, body) {
  return `
    <section class="mi-report-card">
      <h3 class="mi-report-title">${title}</h3>
      ${body}
    </section>
  `;
}

function reportAnalysis(items = [], recommendations = []) {
  return reportPanel("التحليل والتوصيات", `
    <div class="d-grid gap-2">
      ${items.map((i) => `<div class="mi-insight-item">${i}</div>`).join("") || '<div class="alert mi-empty-state">لا يوجد تحليل.</div>'}
      ${recommendations.map((r) => `<div class="mi-insight-item"><b>توصية:</b> ${r}</div>`).join("")}
    </div>
  `);
}

function reportTable(columns, rows = [], limit = 300) {
  const safeRows = rows.slice(0, limit);

  if (!safeRows.length) {
    return `<div class="alert mi-empty-state py-4">لا توجد بيانات</div>`;
  }

  return `
    <div class="table-responsive">
      <table class="table table-hover table-striped align-middle mi-data-table">
        <thead>
          <tr>
            ${columns.map((c) => `<th title="${c.hint || ""}">${c.label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${safeRows.map((row) => `
            <tr>
              ${columns.map((c) => {
                const raw = row[c.key];
                const value = c.format ? c.format(raw, row) : raw;
                return `<td title="${c.hint || ""}">${value ?? ""}</td>`;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}
