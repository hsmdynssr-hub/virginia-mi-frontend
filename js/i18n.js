(function initializeProjectLocalization() {
  const STORAGE_KEY = "mi-language";
  const SUPPORTED = new Set(["ar", "en"]);
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  let observer = null;

  function getLanguage() {
    const stored = String(localStorage.getItem(STORAGE_KEY) || "").toLowerCase();
    return SUPPORTED.has(stored) ? stored : "ar";
  }

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getLocale(language) {
    return window.MI_LOCALES?.[language] || { strings: {} };
  }

  function translateText(value, language = getLanguage()) {
    const raw = String(value ?? "");
    if (!raw) return raw;

    const leading = raw.match(/^\s*/)?.[0] || "";
    const trailing = raw.match(/\s*$/)?.[0] || "";
    const clean = normalize(raw);
    if (!clean) return raw;

    const locale = getLocale(language);
    if (Object.prototype.hasOwnProperty.call(locale.strings || {}, clean)) {
      return `${leading}${locale.strings[clean]}${trailing}`;
    }

    return raw;
  }

  function translateTextNode(node, language) {
    if (!node?.parentElement) return;
    if (node.parentElement.closest("script, style, noscript, textarea, [data-mi-no-translate]")) return;

    if (!originalText.has(node)) {
      originalText.set(node, node.nodeValue);
    }

    const source = originalText.get(node);
    const next = translateText(source, language);
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function translateAttributes(element, language) {
    const attributes = ["placeholder", "title", "aria-label", "data-empty-label"];
    if (!originalAttributes.has(element)) originalAttributes.set(element, {});
    const stored = originalAttributes.get(element);

    attributes.forEach((name) => {
      if (!element.hasAttribute(name)) return;
      if (!(name in stored)) stored[name] = element.getAttribute(name);
      const next = translateText(stored[name], language);
      if (element.getAttribute(name) !== next) element.setAttribute(name, next);
    });

    if (element instanceof HTMLInputElement && ["button", "submit", "reset"].includes(element.type)) {
      if (!("value" in stored)) stored.value = element.value;
      element.value = translateText(stored.value, language);
    }
  }

  function translateTree(root = document.body, language = getLanguage()) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root, language);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root, language);

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
    );

    let current = walker.nextNode();
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) translateTextNode(current, language);
      else translateAttributes(current, language);
      current = walker.nextNode();
    }
  }

  function applyDocumentLanguage(language = getLanguage()) {
    const locale = window.MI_LOCALES?.[language] || window.MI_LOCALES?.ar || {
      code: "ar",
      dir: "rtl"
    };

    document.documentElement.lang = locale.code;
    document.documentElement.dir = locale.dir;
    document.body?.setAttribute("dir", locale.dir);
    document.body?.classList.toggle("mi-language-en", language === "en");
    document.body?.classList.toggle("mi-language-ar", language === "ar");

    if (document.title) {
      if (!document.documentElement.dataset.miOriginalTitle) {
        document.documentElement.dataset.miOriginalTitle = document.title;
      }
      document.title = translateText(document.documentElement.dataset.miOriginalTitle, language);
    }
  }

  function createLanguageButton() {
    let button = document.querySelector("[data-mi-language-toggle]");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      const internalNavigation = document.querySelector(".crsms-return-bar");
      button.className = internalNavigation
        ? "mi-language-toggle"
        : "mi-language-toggle floating";
      button.dataset.miLanguageToggle = "true";
      (internalNavigation || document.body).appendChild(button);
    }

    const language = getLanguage();
    button.innerHTML = language === "ar"
      ? '<span aria-hidden="true">◎</span><strong>EN</strong>'
      : '<span aria-hidden="true">◎</span><strong>عربي</strong>';
    button.setAttribute(
      "aria-label",
      language === "ar" ? "Switch to English" : "التبديل إلى العربية"
    );

    if (button.dataset.miLanguageBound !== "true") {
      button.dataset.miLanguageBound = "true";
      button.addEventListener("click", () => {
        const next = getLanguage() === "ar" ? "en" : "ar";
        localStorage.setItem(STORAGE_KEY, next);
        window.location.reload();
      });
    }
  }

  function startObserver() {
    if (observer || !document.body) return;

    let scheduled = false;
    const pendingRoots = new Set();

    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => pendingRoots.add(node));
      });

      if (scheduled || !pendingRoots.size) return;
      scheduled = true;

      window.requestAnimationFrame(() => {
        scheduled = false;
        const language = getLanguage();
        pendingRoots.forEach((node) => translateTree(node, language));
        pendingRoots.clear();
        createLanguageButton();
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function refresh() {
    const language = getLanguage();
    applyDocumentLanguage(language);
    translateTree(document.body, language);
    createLanguageButton();
  }

  function boot() {
    refresh();
    startObserver();
    window.dispatchEvent(new CustomEvent("mi-i18n-ready", {
      detail: { language: getLanguage() }
    }));
  }

  window.MI18n = {
    getLanguage,
    setLanguage(language) {
      if (!SUPPORTED.has(language)) return;
      localStorage.setItem(STORAGE_KEY, language);
      window.location.reload();
    },
    translate: translateText,
    refresh
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
