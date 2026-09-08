/* Global structural table manager. Keeps every table inside its own layout boundary. */
(() => {
  "use strict";

  const WRAPPER_SELECTOR = [
    ".mi-table-shell",
    ".table-responsive",
    ".table-wrap",
    ".inventory-table-wrap",
    ".report-table-wrap",
    ".mi-table-scroll",
    ".financial-review-table-wrap",
    ".cs-management-table-wrap"
  ].join(",");

  const HEADER_HINTS = {
    long: /ملاحظة|وصف|تفاصيل|تعليق|سبب|الخطأ|شرح|description|note|comment|details|reason|error/i,
    code: /فاتورة|طلب|كود|مرجع|invoice|order|reference|code/i,
    tiny: /^(#|م|id)$/i,
    compact: /تاريخ|الحالة|النوع|التقييم|القيمة|المبلغ|ساعات|الهاتف|الفرع|الموظف|المحاسب|الصرف|قيد|كاميرات|date|status|type|rating|amount|phone|branch|employee|account/i,
    wide: /العميل|اسم|منتج|customer|product/i
  };

  const WIDTHS = {
    tiny: 72,
    compact: 124,
    standard: 156,
    wide: 184,
    code: 220,
    long: 320
  };

  const ignoreTable = (table) =>
    !table ||
    table.dataset.miTable === "off" ||
    table.classList.contains("no-mi-table-style") ||
    table.closest("[data-mi-table-scope='off']");

  const headerCells = (table) => Array.from(table.tHead?.rows?.[0]?.cells || table.rows?.[0]?.cells || []);

  const classifyHeader = (text) => {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (HEADER_HINTS.long.test(normalized)) return "long";
    if (HEADER_HINTS.code.test(normalized)) return "code";
    if (HEADER_HINTS.tiny.test(normalized)) return "tiny";
    if (HEADER_HINTS.compact.test(normalized)) return "compact";
    if (HEADER_HINTS.wide.test(normalized)) return "wide";
    return "standard";
  };

  const ensureWrapper = (table) => {
    const existing = table.closest(WRAPPER_SELECTOR);
    if (existing) {
      existing.classList.add("mi-table-shell");
      existing.style.setProperty("min-width", "0", "important");
      existing.style.setProperty("max-width", "100%", "important");
      return existing;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "mi-table-shell";
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", table.getAttribute("aria-label") || "جدول بيانات قابل للتمرير");
    wrapper.tabIndex = 0;
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
    return wrapper;
  };

  const syncGeneratedColgroup = (table, columnKinds) => {
    table.querySelectorAll('colgroup[data-mi-generated="true"]').forEach((node) => node.remove());
    if (table.querySelector('colgroup:not([data-mi-generated="true"])')) return;

    const group = document.createElement("colgroup");
    group.dataset.miGenerated = "true";
    columnKinds.forEach((kind) => {
      const col = document.createElement("col");
      const width = WIDTHS[kind || "standard"] || WIDTHS.standard;
      col.dataset.miGeneratedCol = "true";
      col.style.setProperty("--mi-generated-col-width", `${width}px`);
      col.style.width = `${width}px`;
      group.appendChild(col);
    });
    table.insertBefore(group, table.firstChild);
  };

  const decorateColumns = (table) => {
    const headers = headerCells(table);
    if (!headers.length) return;

    const columnKinds = [];
    let visualIndex = 0;

    headers.forEach((header) => {
      const span = Math.max(1, Number(header.colSpan) || 1);
      const kind = classifyHeader(header.textContent);
      header.classList.add(`mi-col-${kind}`);
      header.dataset.miColumnKind = kind;
      header.style.setProperty("--mi-col-width", `${WIDTHS[kind]}px`);
      for (let offset = 0; offset < span; offset += 1) columnKinds[visualIndex + offset] = kind;
      visualIndex += span;
    });

    syncGeneratedColgroup(table, columnKinds);

    table.querySelectorAll("tbody tr, tfoot tr").forEach((row) => {
      let columnIndex = 0;
      Array.from(row.cells || []).forEach((cell) => {
        const span = Math.max(1, Number(cell.colSpan) || 1);
        const kind = columnKinds[columnIndex] || "standard";
        const spanWidth = Array.from({ length: span }, (_, offset) => WIDTHS[columnKinds[columnIndex + offset] || kind] || WIDTHS.standard)
          .reduce((sum, width) => sum + width, 0);
        cell.classList.remove("mi-col-tiny", "mi-col-compact", "mi-col-standard", "mi-col-wide", "mi-col-code", "mi-col-long", "mi-table-long-cell");
        cell.classList.add(`mi-col-${kind}`);
        if (kind === "long") cell.classList.add("mi-table-long-cell");
        cell.dataset.miColumnKind = kind;
        cell.style.setProperty("--mi-col-width", `${spanWidth}px`);

        const text = String(cell.textContent || "").replace(/\s+/g, " ").trim();
        if (kind !== "long" && text.length > 38 && !cell.hasAttribute("title")) cell.title = text;
        columnIndex += span;
      });
    });

    const totalWidth = columnKinds.reduce((sum, kind) => sum + (WIDTHS[kind || "standard"] || WIDTHS.standard), 0);
    table.style.setProperty("--mi-table-min-width", `${Math.max(720, totalWidth)}px`);
  };

  const manageTable = (table) => {
    if (!(table instanceof HTMLTableElement) || ignoreTable(table)) return;

    table.classList.add("mi-managed-table");
    table.dataset.miTableManaged = "true";
    ensureWrapper(table);
    decorateColumns(table);
  };

  const scan = (root = document) => {
    if (root instanceof HTMLTableElement) manageTable(root);
    if (root instanceof Element) root.closest("table") && manageTable(root.closest("table"));
    root.querySelectorAll?.("table").forEach(manageTable);
  };

  let refreshQueued = false;
  const queueRefresh = (node) => {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      scan(node instanceof Element ? node : document);
    });
  };

  const boot = () => {
    scan(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          queueRefresh(mutation.target.parentElement || document.body);
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) queueRefresh(node);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.MITableSystem = { scan, manageTable, version: "20260908-06" };
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
