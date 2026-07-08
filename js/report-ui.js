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
    return `
      <span class="report-pill ${escapeHtml(type)}">
        ${escapeHtml(label)}
      </span>
    `;
  }

  function pillList(items = [], type = "good") {
    if (!items.length) {
      return statusPill("غير متاح", "bad");
    }

    return `
      <div class="report-pill-list">
        ${items.map((item) => statusPill(item, type)).join("")}
      </div>
    `;
  }

  function stack(items = []) {
    return `
      <div class="report-stack">
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

    container.innerHTML = cards
      .map((card) => `
        <div class="report-kpi-card">
          <span>${escapeHtml(card.title)}</span>
          <strong title="${escapeHtml(card.value)}">${escapeHtml(card.value)}</strong>
          <small title="${escapeHtml(card.hint || "")}">
            ${escapeHtml(card.hint || "")}
          </small>
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
        <div class="report-empty">
          ${escapeHtml(config.emptyMessage || "لا توجد بيانات.")}
        </div>
      `;
      return;
    }

    const minWidth = config.minWidth || 980;

    container.innerHTML = `
      <div class="report-table-wrap">
        <table class="report-table" style="min-width: ${Number(minWidth)}px;">
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
      container.innerHTML = `<div class="report-empty">لا توجد توصيات.</div>`;
      return;
    }

    container.innerHTML = recommendations
      .map((item) => `
        <div class="report-recommendation ${escapeHtml(item.level || "info")}">
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
      container.innerHTML = `<div class="report-empty">لا توجد ملاحظات.</div>`;
      return;
    }

    container.innerHTML = `
      <ul>
        ${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
    `;
  }

  function showLoading(containerId, message = "جاري تحميل التقرير...") {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.className = "report-loading";
    container.textContent = message;
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

    container.className = "report-error";
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