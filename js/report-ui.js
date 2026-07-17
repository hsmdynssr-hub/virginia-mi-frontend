window.ReportUI = (() => {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function number(value, digits = 0) {
    const num = Number(value || 0);

    return num.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function money(value, currency = "ج") {
    return `${number(value, 2)} ${currency}`;
  }

  function percent(value) {
    return `${number(value, 2)}%`;
  }

  function statusPill(label, type = "info") {
    const toneClass = {
      good: "text-bg-success",
      success: "text-bg-success",
      bad: "text-bg-danger",
      danger: "text-bg-danger",
      warning: "text-bg-warning",
      info: "text-bg-primary"
    }[type] || "text-bg-secondary";

    return `
      <span class="report-pill badge rounded-pill ${toneClass} ${escapeHtml(type)}">
        ${escapeHtml(label)}
      </span>
    `;
  }

  function pillList(items = [], type = "good") {
    if (!items.length) {
      return statusPill("غير متاح", "bad");
    }

    return `
      <div class="report-pill-list d-flex flex-wrap gap-2">
        ${items.map((item) => statusPill(item, type)).join("")}
      </div>
    `;
  }

  function stack(items = []) {
    return `
      <div class="report-stack d-grid gap-1">
        ${items.map((item) => `
          <div>
            ${escapeHtml(item.label)}:
            <b>${escapeHtml(item.value)}</b>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderKpis(containerId, cards = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // KPI containers use the shared report CSS grid. Mixing Bootstrap's
    // `.row/.col` flex rules with `.report-kpi-grid` makes the cards collapse
    // into very narrow columns on some viewport sizes.
    container.classList.remove("row", "row-cols-1", "row-cols-md-2", "row-cols-xl-4", "g-3");

    container.innerHTML = cards
      .map((card, index) => `
        <div class="report-kpi-card mi-kpi-card h-100"
              data-tone="${escapeHtml(card.tone || ["purple", "teal", "success", "warning"][index % 4])}"
              data-icon="${escapeHtml(card.icon || ["📊", "◆", "✓", "⚡"][index % 4])}"
              style="--mi-delay:${index * 45}ms">
          <span class="mi-kpi-label">${escapeHtml(card.title)}</span>
          <strong class="mi-kpi-value" title="${escapeHtml(card.value)}">${escapeHtml(card.value)}</strong>
          <small class="mi-kpi-hint" title="${escapeHtml(card.hint || "")}">
            ${escapeHtml(card.hint || "")}
          </small>
          ${Number.isFinite(Number(card.progress)) ? `
            <div class="mi-kpi-progress" aria-label="${escapeHtml(card.progress)}%">
              <span style="--mi-progress:${Math.min(Math.max(Number(card.progress), 0), 100)}%"></span>
            </div>
          ` : ""}
        </div>
      `)
      .join("");
  }

  function renderTable(containerId, config = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const rows = Array.isArray(config.rows) ? config.rows : [];
    const columns = Array.isArray(config.columns) ? config.columns : [];

    if (!rows.length) {
      container.innerHTML = `
        <div class="report-empty alert mi-empty-state py-4">
          ${escapeHtml(config.emptyMessage || "لا توجد بيانات.")}
        </div>
      `;
      return;
    }

    const minWidth = config.minWidth || 980;

    container.innerHTML = `
      <div class="report-table-wrap table-responsive">
        <table class="report-table table table-hover table-striped align-middle mi-data-table" style="min-width: ${Number(minWidth)}px;">
          <thead>
            <tr>
              ${columns.map((column) => `
                <th style="${column.width ? `width:${column.width};` : ""}">
                  ${escapeHtml(column.label)}
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                ${columns.map((column) => {
                  const rawValue = row[column.key];

                  const value = typeof column.format === "function"
                    ? column.format(rawValue, row)
                    : escapeHtml(rawValue ?? "");

                  return `
                    <td class="${escapeHtml(column.className || "")}">
                      ${value}
                    </td>
                  `;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderRecommendations(containerId, recommendations = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!recommendations.length) {
      container.innerHTML = `<div class="report-empty alert mi-empty-state py-4">لا توجد توصيات.</div>`;
      return;
    }

    container.innerHTML = recommendations
      .map((item) => `
        <div class="report-recommendation mi-insight-item ${escapeHtml(item.level || "info")}">
          <strong>${escapeHtml(item.title || "-")}</strong>
          <p>${escapeHtml(item.message || "")}</p>
          ${
            Array.isArray(item.branches) && item.branches.length
              ? `<small>الفروع: ${item.branches.map(escapeHtml).join("، ")}</small>`
              : ""
          }
        </div>
      `)
      .join("");
  }

  function renderNotes(containerId, notes = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!notes.length) {
      container.innerHTML = `<div class="report-empty alert mi-empty-state py-4">لا توجد ملاحظات.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="d-grid gap-2">
        ${notes.map((note) => `<div class="mi-insight-item">${escapeHtml(note)}</div>`).join("")}
      </div>
    `;
  }

  function showLoading(containerId, message = "جاري تحميل التقرير...") {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.className = "report-loading alert alert-warning d-flex align-items-center";
    container.innerHTML = `<span class="spinner-border spinner-border-sm mi-loading-spinner" aria-hidden="true"></span>${escapeHtml(message)}`;
    container.classList.remove("hidden");
  }

  function hideLoading(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.classList.add("hidden");
  }

  function showError(containerId, error) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.className = "report-error alert alert-danger";
    container.textContent =
      error?.message || String(error || "حدث خطأ أثناء تحميل التقرير.");
    container.classList.remove("hidden");
  }

  function clearError(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.textContent = "";
    container.classList.add("hidden");
  }

  return {
    escapeHtml,
    number,
    money,
    percent,
    statusPill,
    pillList,
    stack,
    renderKpis,
    renderTable,
    renderRecommendations,
    renderNotes,
    showLoading,
    hideLoading,
    showError,
    clearError
  };
})();
