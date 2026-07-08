function reportKpi(label, value, hint = "") {
  return `
    <div class="card" title="${hint}">
      <h3>${label}</h3>
      <strong>${value ?? "-"}</strong>
    </div>
  `;
}

function reportKpiGrid(items = []) {
  return `
    <div class="cards-grid">
      ${items.map((item) => reportKpi(item.label, item.value, item.hint)).join("")}
    </div>
  `;
}

function reportPanel(title, body) {
  return `
    <div class="panel">
      <h3>${title}</h3>
      ${body}
    </div>
  `;
}

function reportAnalysis(items = [], recommendations = []) {
  return reportPanel("التحليل والتوصيات", `
    <div class="analysis-box">
      ${items.map((i) => `<p>${i}</p>`).join("") || "<p>لا يوجد تحليل.</p>"}
      ${recommendations.map((r) => `<p><b>توصية:</b> ${r}</p>`).join("")}
    </div>
  `);
}

function reportTable(columns, rows = [], limit = 300) {
  const safeRows = rows.slice(0, limit);

  if (!safeRows.length) {
    return `<div class="empty">لا توجد بيانات</div>`;
  }

  return `
    <div class="table-wrap">
      <table>
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