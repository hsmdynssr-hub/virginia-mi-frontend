(function installMiNotifications() {
  "use strict";

  if (window.MINotifications?.version) return;

  const ROOT_ID = "mi-global-notifications";
  const STYLE_ID = "mi-global-notifications-style";
  const FIELD_ERROR_CLASS = "mi-global-field-invalid";
  const FIELD_NOTE_CLASS = "mi-global-field-note";
  const lastMessages = new Map();
  let sequence = 0;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        width: min(780px, calc(100vw - 28px));
        z-index: 2147483000;
        display: grid;
        gap: 10px;
        pointer-events: none;
        direction: rtl;
        font-family: inherit;
      }

      #${ROOT_ID} .mi-global-note {
        --mi-note-border: #64748b;
        --mi-note-bg: #f8fafc;
        --mi-note-text: #0f172a;
        pointer-events: auto;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: start;
        gap: 10px;
        padding: 13px 14px;
        border: 1px solid color-mix(in srgb, var(--mi-note-border) 38%, transparent);
        border-inline-start: 5px solid var(--mi-note-border);
        border-radius: 14px;
        background: color-mix(in srgb, var(--mi-note-bg) 96%, transparent);
        color: var(--mi-note-text);
        box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        animation: miGlobalNoteIn 180ms ease-out both;
      }

      #${ROOT_ID} .mi-global-note[data-type="error"] {
        --mi-note-border: #dc2626;
        --mi-note-bg: #fff1f2;
        --mi-note-text: #991b1b;
      }

      #${ROOT_ID} .mi-global-note[data-type="success"] {
        --mi-note-border: #059669;
        --mi-note-bg: #ecfdf5;
        --mi-note-text: #065f46;
      }

      #${ROOT_ID} .mi-global-note[data-type="warning"] {
        --mi-note-border: #d97706;
        --mi-note-bg: #fffbeb;
        --mi-note-text: #92400e;
      }

      #${ROOT_ID} .mi-global-note[data-type="info"] {
        --mi-note-border: #2563eb;
        --mi-note-bg: #eff6ff;
        --mi-note-text: #1e40af;
      }

      #${ROOT_ID} .mi-global-note__icon {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        background: color-mix(in srgb, var(--mi-note-border) 14%, transparent);
        color: var(--mi-note-border);
        font-weight: 900;
        line-height: 1;
      }

      #${ROOT_ID} .mi-global-note__content {
        min-width: 0;
        display: grid;
        gap: 3px;
      }

      #${ROOT_ID} .mi-global-note__title {
        font-size: 14px;
        font-weight: 800;
        line-height: 1.45;
      }

      #${ROOT_ID} .mi-global-note__message {
        font-size: 14px;
        font-weight: 650;
        line-height: 1.65;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }

      #${ROOT_ID} .mi-global-note__close {
        border: 0;
        background: transparent;
        color: currentColor;
        opacity: .72;
        width: 30px;
        height: 30px;
        border-radius: 9px;
        cursor: pointer;
        font-size: 23px;
        line-height: 1;
        padding: 0;
      }

      #${ROOT_ID} .mi-global-note__close:hover,
      #${ROOT_ID} .mi-global-note__close:focus-visible {
        opacity: 1;
        background: color-mix(in srgb, currentColor 9%, transparent);
        outline: none;
      }

      .${FIELD_ERROR_CLASS} {
        border-color: #dc2626 !important;
        box-shadow: 0 0 0 3px rgba(220, 38, 38, .11) !important;
      }

      .${FIELD_NOTE_CLASS} {
        display: block;
        margin-top: 6px;
        color: #b91c1c;
        font-size: 12px;
        font-weight: 750;
        line-height: 1.55;
      }

      @keyframes miGlobalNoteIn {
        from { opacity: 0; transform: translateY(-8px) scale(.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @media (max-width: 640px) {
        #${ROOT_ID} {
          top: 8px;
          width: calc(100vw - 16px);
        }

        #${ROOT_ID} .mi-global-note {
          padding: 11px 12px;
          border-radius: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    ensureStyles();
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement("section");
    root.id = ROOT_ID;
    root.setAttribute("aria-label", "تنبيهات النظام");
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-relevant", "additions removals");
    (document.body || document.documentElement).appendChild(root);
    return root;
  }

  function normalizeType(type) {
    return ["error", "success", "warning", "info"].includes(type) ? type : "info";
  }

  function defaultTitle(type) {
    return {
      error: "تعذر تنفيذ العملية",
      success: "تمت العملية بنجاح",
      warning: "تنبيه",
      info: "معلومة"
    }[type] || "تنبيه";
  }

  function iconFor(type) {
    return { error: "!", success: "✓", warning: "!", info: "i" }[type] || "i";
  }

  function defaultDuration(type) {
    if (type === "error") return 0;
    if (type === "warning") return 7000;
    if (type === "success") return 4500;
    return 5500;
  }

  function dismiss(noteOrId) {
    const note = typeof noteOrId === "string"
      ? document.querySelector(`#${ROOT_ID} [data-note-id="${CSS.escape(noteOrId)}"]`)
      : noteOrId;
    if (!note) return;
    if (note._miTimer) clearTimeout(note._miTimer);
    note.remove();
  }

  function trimRoot(root) {
    const notes = Array.from(root.querySelectorAll(".mi-global-note"));
    while (notes.length > 5) {
      dismiss(notes.pop());
    }
  }

  function show(message, options = {}) {
    const text = String(message ?? "").trim();
    if (!text) return null;

    const type = normalizeType(options.type);
    const now = Date.now();
    const dedupeKey = `${type}:${text}`;
    const previousAt = lastMessages.get(dedupeKey) || 0;
    if (now - previousAt < (options.dedupeMs ?? 1200)) {
      const existing = Array.from(document.querySelectorAll(`#${ROOT_ID} .mi-global-note`))
        .find((node) => node.dataset.dedupeKey === dedupeKey);
      return existing || null;
    }
    lastMessages.set(dedupeKey, now);

    const root = ensureRoot();
    const id = String(options.id || `mi-note-${Date.now()}-${++sequence}`);
    if (options.id) dismiss(id);

    const note = document.createElement("article");
    note.className = "mi-global-note";
    note.dataset.noteId = id;
    note.dataset.type = type;
    note.dataset.dedupeKey = dedupeKey;
    note.setAttribute("role", type === "error" ? "alert" : "status");
    note.setAttribute("aria-live", type === "error" ? "assertive" : "polite");

    const icon = document.createElement("span");
    icon.className = "mi-global-note__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = iconFor(type);

    const content = document.createElement("div");
    content.className = "mi-global-note__content";

    if (options.title !== false) {
      const title = document.createElement("div");
      title.className = "mi-global-note__title";
      title.textContent = String(options.title || defaultTitle(type));
      content.appendChild(title);
    }

    const body = document.createElement("div");
    body.className = "mi-global-note__message";
    body.textContent = text;
    content.appendChild(body);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "mi-global-note__close";
    close.setAttribute("aria-label", "إغلاق التنبيه");
    close.textContent = "×";
    close.addEventListener("click", () => dismiss(note));

    note.append(icon, content, close);
    root.prepend(note);
    trimRoot(root);

    const duration = options.persistent === true ? 0 : (Number.isFinite(options.duration) ? options.duration : defaultDuration(type));
    if (duration > 0) {
      note._miTimer = setTimeout(() => dismiss(note), duration);
    }

    return note;
  }

  function resolveField(field) {
    if (!field) return null;
    if (typeof field === "string") return document.querySelector(field);
    return field instanceof Element ? field : null;
  }

  function clearField(field) {
    const input = resolveField(field);
    if (!input) return;
    input.classList.remove(FIELD_ERROR_CLASS);
    input.removeAttribute("aria-invalid");

    const fieldId = input.dataset.miFieldErrorId;
    if (fieldId) {
      document.getElementById(fieldId)?.remove();
      const describedBy = String(input.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter((value) => value && value !== fieldId)
        .join(" ");
      if (describedBy) input.setAttribute("aria-describedby", describedBy);
      else input.removeAttribute("aria-describedby");
      delete input.dataset.miFieldErrorId;
    }

    const wrapper = input.closest?.(".report-field, .form-group, .field, .input-group, .control-row");
    wrapper?.querySelector?.(`.${FIELD_NOTE_CLASS}[data-mi-for-field]`)?.remove();
  }

  function fieldError(field, message, options = {}) {
    const input = resolveField(field);
    const text = String(message ?? "").trim();
    show(text, { type: "error", title: options.title || "راجع البيانات المطلوبة", id: options.noteId });
    if (!input) return null;

    clearField(input);
    input.classList.add(FIELD_ERROR_CLASS);
    input.setAttribute("aria-invalid", "true");

    const note = document.createElement("small");
    const fieldId = `mi-field-error-${Date.now()}-${++sequence}`;
    note.id = fieldId;
    note.className = FIELD_NOTE_CLASS;
    note.dataset.miForField = "true";
    note.textContent = text;
    input.dataset.miFieldErrorId = fieldId;
    input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), fieldId].filter(Boolean).join(" "));

    const wrapper = input.closest?.(".report-field, .form-group, .field, .control-row");
    if (wrapper) wrapper.appendChild(note);
    else input.insertAdjacentElement("afterend", note);

    const clear = () => clearField(input);
    input.addEventListener("input", clear, { once: true });
    input.addEventListener("change", clear, { once: true });

    if (options.focus !== false) {
      try { input.focus({ preventScroll: true }); } catch (_) { input.focus?.(); }
      input.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }

    return input;
  }

  function clearAll() {
    document.getElementById(ROOT_ID)?.replaceChildren();
  }

  function classifyLegacyAlert(message) {
    const text = String(message || "");
    if (/تم\s|بنجاح|نجاح|saved|success|completed/i.test(text)) return "success";
    if (/تحذير|تنبيه|انتبه|warning/i.test(text)) return "warning";
    if (/خطأ|فشل|تعذر|غير صالح|غير صحيح|غير موجود|مطلوب|لازم|اختار|اختر|اكتب|unauthorized|invalid|failed|error|denied/i.test(text)) return "error";
    return "info";
  }

  const api = {
    version: "20260901-global-01",
    show,
    dismiss,
    clearAll,
    fieldError,
    clearField,
    error(message, options = {}) { return show(message, { ...options, type: "error" }); },
    success(message, options = {}) { return show(message, { ...options, type: "success" }); },
    warning(message, options = {}) { return show(message, { ...options, type: "warning" }); },
    info(message, options = {}) { return show(message, { ...options, type: "info" }); }
  };

  window.MINotifications = api;
  window.miNotify = show;
  window.showGlobalError = (message, options = {}) => api.error(message, options);
  window.showGlobalSuccess = (message, options = {}) => api.success(message, options);

  if (!window.__miNativeAlert) window.__miNativeAlert = window.alert.bind(window);
  window.alert = function miAlertBridge(message) {
    const type = classifyLegacyAlert(message);
    return show(message, { type });
  };

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (reason?.name === "AbortError") return;
    const message = reason?.message || (typeof reason === "string" ? reason : "حدث خطأ غير متوقع أثناء تنفيذ العملية.");
    api.error(message, { title: "خطأ غير متوقع", id: "mi-unhandled-rejection" });
  });

  window.addEventListener("error", (event) => {
    if (!event.error) return;
    const filename = String(event.filename || "");
    if (/^(chrome|edge|moz)-extension:/i.test(filename)) return;
    const message = event.error?.message || event.message;
    if (!message || /ResizeObserver loop/i.test(message)) return;
    api.error(message, { title: "خطأ في الصفحة", id: "mi-window-error" });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureRoot, { once: true });
  } else {
    ensureRoot();
  }
})();
