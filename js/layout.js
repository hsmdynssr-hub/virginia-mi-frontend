/*
  Shared UI foundation — V20 project-wide dashboard-first shell
  --------------------
  Every authenticated page that loads layout.js inherits Bootstrap RTL and
  the project theme from one place. Existing page styles remain loaded during
  the gradual migration.
*/
(function ensureSharedUiFoundation() {
  const scriptUrl = document.currentScript?.src || window.location.href;
  const assetUrl = (relativePath) => new URL(relativePath, scriptUrl).href;

  if (!document.querySelector('meta[name="viewport"]')) {
    const viewport = document.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1.0";
    document.head.appendChild(viewport);
  }

  function hasStylesheet(fragment) {
    return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some((link) => String(link.href || "").includes(fragment));
  }

  if (!hasStylesheet("bootstrap.rtl.min.css")) {
    const bootstrapCss = document.createElement("link");
    bootstrapCss.rel = "stylesheet";
    bootstrapCss.href = assetUrl("../vendor/bootstrap/css/bootstrap.rtl.min.css");

    const firstStylesheet = document.querySelector('link[rel="stylesheet"]');
    document.head.insertBefore(bootstrapCss, firstStylesheet || null);
  }

  if (!hasStylesheet("bootstrap-theme.css")) {
    const themeCss = document.createElement("link");
    themeCss.rel = "stylesheet";
    themeCss.href = `${assetUrl("../css/bootstrap-theme.css")}?v=20260715-8`;
    document.head.appendChild(themeCss);
  }

  if (!hasStylesheet("app-modern.css")) {
    const modernCss = document.createElement("link");
    modernCss.rel = "stylesheet";
    modernCss.href = `${assetUrl("../css/app-modern.css")}?v=dual-theme-20260830-01`;
    modernCss.dataset.miModernUi = "true";
    document.head.appendChild(modernCss);
  }

  if (!hasStylesheet("report-toolbar-fixed.css")) {
    const reportToolbarCss = document.createElement("link");
    reportToolbarCss.rel = "stylesheet";
    reportToolbarCss.href = `${assetUrl("../css/report-toolbar-fixed.css")}?v=20260815-05`;
    reportToolbarCss.dataset.miReportToolbar = "true";
    document.head.appendChild(reportToolbarCss);
  }


  function loadLocalizationScripts() {
    if (window.MI18n || document.querySelector('script[data-mi-i18n-loader="true"]')) {
      window.MI18n?.refresh?.();
      return;
    }

    const sources = [
      assetUrl("../locales/ar.js"),
      assetUrl("../locales/en.js"),
      assetUrl("./i18n.js")
    ];

    const loadNext = (index) => {
      if (index >= sources.length) {
        window.MI18n?.refresh?.();
        return;
      }

      const source = sources[index];
      const existing = Array.from(document.scripts)
        .find((script) => String(script.src || "").split("?")[0] === source.split("?")[0]);

      if (existing) {
        if (existing.dataset.miLoaded === "true") loadNext(index + 1);
        else existing.addEventListener("load", () => loadNext(index + 1), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = `${source}?v=20260815-02`;
      script.async = false;
      script.dataset.miI18nLoader = "true";
      script.addEventListener("load", () => {
        script.dataset.miLoaded = "true";
        loadNext(index + 1);
      }, { once: true });
      document.head.appendChild(script);
    };

    loadNext(0);
  }

  loadLocalizationScripts();

  const hasBootstrapJs = Array.from(document.scripts)
    .some((script) => String(script.src || "").includes("bootstrap.bundle.min.js"));

  if (!hasBootstrapJs) {
    const bootstrapJs = document.createElement("script");
    bootstrapJs.src = assetUrl("../vendor/bootstrap/js/bootstrap.bundle.min.js");
    bootstrapJs.defer = true;
    bootstrapJs.dataset.miUiFoundation = "true";
    document.head.appendChild(bootstrapJs);
  }
})();

function setupMiThemeSwitcher() {
  document.documentElement.dataset.miTheme = "light";
  localStorage.removeItem("mi-visual-theme");
}

const MI_VISUAL_TONES = ["purple", "teal", "success", "warning"];
const MI_VISUAL_ICONS = ["📊", "◆", "✓", "⚡", "💰", "📦", "↗", "⚠"];

function escapeMiUiText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getMiUserInitials(user = getCurrentUser()) {
  const source = String(user?.fullName || user?.username || "MI").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function decorateSemanticActions(root = document) {
  const scope = root?.querySelectorAll ? root : document;
  scope.querySelectorAll('button, a.run-btn, a.export-btn, a.ops-action, a.dashboard-module-main-link').forEach((element) => {
    if (element.dataset.miSemanticAction === "true") return;
    element.dataset.miSemanticAction = "true";

    const text = String(element.textContent || element.getAttribute("aria-label") || "").trim();
    let tone = "neutral";

    if (element.classList.contains("logout-btn") || /حذف|رفض|إلغاء|خروج|إغلاق نهائي/i.test(text)) tone = "danger";
    else if (/حفظ|اعتماد|موافقة|تأكيد|إرسال|إنشاء|دفع|صرف|حل|إتمام/i.test(text)) tone = "success";
    else if (/مراجعة|تحقق|تنبيه|تصعيد|تحذير|تعليق/i.test(text)) tone = "warning";
    else if (/تقرير|تصدير|سجل|تفاصيل|تتبع|صلاحيات/i.test(text)) tone = "secondary";
    else if (/بحث|تحديث|تحميل|تشغيل|عرض|تطبيق|فتح|دخول/i.test(text)) tone = "primary";
    else if (/مسح|رجوع|إعادة تعيين/i.test(text)) tone = "neutral";

    element.classList.add(`mi-action-${tone}`);
  });
}

function enhanceLegacyReportUi(root = document) {
  const scope = root.querySelectorAll ? root : document;
  decorateSemanticActions(scope);

  scope.querySelectorAll(
    ".inventory-kpi-card, .report-kpi-card, .kpi-card, .cards-grid > .card, .kpi-grid > article, .stats-grid > article, .summary-grid > article, .metric-card, .stat-card"
  ).forEach((card, index) => {
    if (card.dataset.miEnhanced === "true") return;

    card.dataset.miEnhanced = "true";
    card.classList.add("mi-kpi-card", "h-100");

    const cardText = String(card.textContent || "").toLowerCase();
    const isDanger = /مرتجع|خطر|سالب|عجز|متأخر|خسار|نفاد/.test(cardText);
    const isWarning = /خصم|تحذير|قريب|معلق|مراجعة/.test(cardText);
    const isSuccess = /صافي|ربح|هامش|متاح|آمن|منجز|أفضل/.test(cardText);

    card.dataset.tone ||= isDanger
      ? "danger"
      : isWarning
        ? "warning"
        : isSuccess
          ? "success"
          : MI_VISUAL_TONES[index % MI_VISUAL_TONES.length];

    card.dataset.icon ||= isDanger
      ? "⚠"
      : isWarning
        ? "!"
        : isSuccess
          ? "✓"
          : MI_VISUAL_ICONS[index % MI_VISUAL_ICONS.length];
    card.style.setProperty("--mi-delay", `${(index % 12) * 45}ms`);

    card.querySelector(".card-label, span")?.classList.add("mi-kpi-label");
    card.querySelector("strong")?.classList.add("mi-kpi-value");
    card.querySelector("small")?.classList.add("mi-kpi-hint");
  });

  scope.querySelectorAll(".inventory-report-card, .report-ui-page > .report-card, .panel, .report-panel, .filter-panel, .summary-panel, .table-card")
    .forEach((card) => card.classList.add("mi-report-card"));

  scope.querySelectorAll(
    ".inventory-report-card > h2, .report-card-head > h2, .panel-title > h3, .panel > h3"
  ).forEach((title) => title.classList.add("mi-report-title"));

  scope.querySelectorAll(".inventory-table-wrap, .table-wrap, .report-table-wrap")
    .forEach((wrapper) => {
      wrapper.classList.add("table-responsive", "mi-table-scroll");
      wrapper.tabIndex = 0;
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute("aria-label", "جدول قابل للتحريك أفقيًا");
    });

  scope.querySelectorAll(
    ".inventory-data-table, .data-table, .report-table, .table-wrap > table, .content table"
  ).forEach((table) => {
    table.classList.add("table", "table-hover", "table-striped", "align-middle", "mi-data-table");
  });

  scope.querySelectorAll(
    ".filters-grid select, .report-field select, .report-filters select, .filter-panel select, .content .control-row select"
  )
    .forEach((select) => select.classList.add("form-select"));

  scope.querySelectorAll(
    ".filters-grid input, .report-field input, .report-filters input, .filter-panel input, .content .control-row input"
  )
    .forEach((input) => input.classList.add("form-control"));

  scope.querySelectorAll(
    ".primary-btn, .run-btn, .report-btn-primary, .filter-actions button, .report-actions button"
  )
    .forEach((button) => button.classList.add("btn", "btn-primary"));

  scope.querySelectorAll(".inventory-empty, .report-empty, .empty")
    .forEach((empty) => empty.classList.add("alert", "mi-empty-state"));
}

function observeLegacyReportUi() {
  if (window.__miVisualObserver) return;

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;

    window.requestAnimationFrame(() => {
      scheduled = false;
      enhanceLegacyReportUi(document);
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.__miVisualObserver = observer;
}

const REPORT_PAGE_MAP = {
  dashboard: "dashboard.index",

  "admin-users": "admin.users",
  "admin-roles": "admin.roles",
  "admin-report-classification": "admin.users",

  branches: "branches.overview",
  "branches-overview": "branches.overview",
  "branches-sales": "branches.sales",
  "branches-stock": "branches.stock",
  "branches-inventory-count": "branches.inventory_count",
  "branches-replenishment": "branches.replenishment",
  "branches-comparison": "branches.comparison",

  "menu-prices": "menu.prices",

  pos: "pos.index",
  "pos-summary": "pos.summary",
  "pos-branch-sales": "pos.branch_sales",
  "pos-cashiers": "pos.cashiers",
  "pos-peak-hours": "pos.peak_hours",
  "pos-returns": "pos.returns",
  "pos-discounts": "pos.discounts",
  "pos-offers": "pos.offers",
  "alerts-dashboard": "alerts.view",
  
  

  customer: "customer.index",
  "customer-pos-phones": "customer.pos_phones",
  "customer-service-pos-review": "customer.service_pos_review",
  "customer-financial-review": "customer.service_pos_review",
  "customer-service-management-report": "customer.service_management_report",
  "customer-vip": "customer.vip",
  "customer-migration": "customer.migration",
  "customer-rfm": "customer.rfm",
  

  

  "customer-review-sms-dashboard": "customer.review_sms.view",
  "customer-review-sms-settings": "admin.users",
  "customer-review-sms-queue": "customer.review_sms.send",
  "customer-review-sms-manual": "customer.review_sms.send",
  "customer-review-followups": "customer.review_sms.followup",
  "customer-review-coupons-dashboard": "customer.review_sms.view",
  production: "production.index",
  "production-daily": "production.daily",
  "production-report": "production.report",
  "production-mo-cost": "production.mo_cost",

  costing: "costing.overview",
  "costing-overview": "costing.overview",

  purchase: "purchase.index",
  "purchase-daily": "purchase.daily",
  "purchase-report": "purchase.report",
  "purchase-price": "purchase.price",
  "purchase-order-control": "purchase.order_control",
  "purchase-supplier-performance": "purchase.supplier_performance",
  "purchase-open-orders": "purchase.open_orders",

  inventory: "inventory.index",
  "inventory-executive-summary": "inventory.executive_summary",
  "inventory-historical-executive-summary": "inventory.historical_executive_summary",
  "inventory-movement-analysis-report": "inventory.movement_analysis",
  "inventory-intermediate-control": "inventory.intermediate_control",
  "inventory-flow-control": "inventory.flow_control",
  "inventory-movement-intelligence": "inventory.movement_intelligence",
  "inventory-reorder-risk": "inventory.operational.reorder_risk",

  forecast: "forecast.index",
  "forecast-products": "forecast.products",
  "forecast-targets": "forecast.targets",
  "forecast-target-report": "forecast.target_report",

  "forecast-planning-achievement": "forecast_planning.achievement",
  "forecast-planning-feasibility": "forecast_planning.feasibility"
};

const EXPORT_ENABLED_PAGES = new Set([
  "inventory-executive-summary",
  "inventory-historical-executive-summary",
  "inventory-intermediate-control",
  "pos-branch-sales",
  "pos-peak-hours",
  "forecast-target-report",
  "forecast-planning-achievement",
  "customer-pos-phones",
  "production-mo-cost",
  "costing-overview",
  "alerts-dashboard"
]);
const PAGES_WITHOUT_REPORT_TOOLBAR = new Set([
  "dashboard",

  "admin-users",
  "admin-roles",
  "admin-report-classification",
  "inventory-reorder-risk",

  "branches",
  "menu-prices",
  "pos",
  "customer",
  
  "customer-review-sms-dashboard",
  "customer-review-sms-settings",
  "customer-review-sms-queue",
  "customer-review-sms-manual",
  "customer-review-followups",
  "customer-review-coupons-dashboard",
  "production",
  "purchase",
  "inventory",
  "forecast",
  "forecast-planning-achievement",
  "forecast-planning-feasibility"
]);

const STANDALONE_CUSTOMER_PAGES = new Set([
  "customer-service-pos-review",
  "customer-financial-review",
  "customer-service-management-report",
  "customer-review-sms-dashboard",
  "customer-review-sms-settings",
  "customer-review-sms-queue",
  "customer-review-sms-manual",
  "customer-review-followups",
  "customer-review-coupons-dashboard"
]);

// Dashboard-first application navigation. Every module uses a compact local navigator.
const MI_MODULE_DEFINITIONS = [
  {
    id: "branches",
    label: "ذكاء الفروع",
    pages: ["branches","branches-sales","branches-stock","branches-inventory-count","branches-replenishment"],
    groups: [{ id:"operations", label:"تشغيل", icon:"⚡", links:[
      {page:"branches",label:"نظرة عامة",href:"../branches/index.html"},
      {page:"branches-sales",label:"مبيعات الفروع",href:"../branches/sales.html"},
      {page:"branches-stock",label:"مخزون الفروع",href:"../branches/stock.html"},
      {page:"branches-inventory-count",label:"الجرد اللحظي",href:"../branches/inventory-count.html"},
      {page:"branches-replenishment",label:"احتياجات وإعادة الطلب",href:"../branches/replenishment.html"}
    ]}]
  },
  {
    id: "menu",
    label: "المنيو والأسعار",
    pages: ["menu-prices"],
    groups: [{ id:"operations", label:"تشغيل", icon:"⚡", links:[
      {page:"menu-prices",label:"الأسعار والمخزون",href:"../menu/prices.html"}
    ]}]
  },
  {
    id: "pos",
    label: "المبيعات ونقاط البيع",
    pages: ["pos","pos-summary","pos-branch-sales","pos-branches","pos-cashiers","pos-peak-hours","pos-returns","pos-discounts","pos-offers","alerts-dashboard"],
    groups: [
      { id:"operations", label:"تشغيل", icon:"⚡", links:[
        {page:"pos",label:"مركز المبيعات",href:"../pos/index.html"},
        {page:"pos-summary",label:"ملخص نقاط البيع",href:"../pos/summary.html"},
        {page:"pos-branch-sales",label:"مبيعات الفروع",href:"../pos/branch-sales.html"},
        {page:"pos-branches",label:"الفروع ونقاط البيع",href:"../pos/branches.html",permission:"pos.index"},
        {page:"pos-cashiers",label:"أداء الكاشير",href:"../pos/cashiers.html"},
        {page:"pos-peak-hours",label:"ساعات الذروة",href:"../pos/peak-hours.html"},
        {page:"pos-returns",label:"المرتجعات",href:"../pos/returns.html"}
      ]},
      { id:"control", label:"رقابة", icon:"◉", links:[
        {page:"alerts-dashboard",label:"التنبيهات",href:"../pos/alerts-dashboard.html"},
        {page:"pos-discounts",label:"الخصومات",href:"../pos/discounts.html"},
        {page:"pos-offers",label:"العروض",href:"../pos/offers.html"}
      ]}
    ]
  },
  {
    id: "customer",
    label: "خدمة العملاء",
    pages: ["customer","customer-pos-phones","customer-service-pos-review","customer-financial-review","customer-service-management-report","customer-review-sms-dashboard","customer-review-sms-settings","customer-review-sms-queue","customer-review-sms-manual","customer-review-followups","customer-review-coupons-dashboard","customer-vip","customer-migration","customer-rfm"],
    groups: [
      { id:"operations", label:"تشغيل", icon:"⚡", links:[
        {page:"customer",label:"مركز الخدمة",href:"../customer/index.html"},
        {page:"customer-pos-phones",label:"متابعة عملاء نقاط البيع",href:"../customer/pos-phones.html"},
        {page:"customer-service-pos-review",label:"سجل الشكاوى",href:"../customer/service-pos-review.html"},
        {page:"customer-financial-review",label:"المراجعة والتحقق المالي",href:"../customer/financial-review.html"},
        {page:"customer-review-sms-queue",label:"تشغيل رسائل التقييم",href:"../customer/review-sms-queue.html"},
        {page:"customer-review-sms-manual",label:"الإرسال اليدوي للعملاء",href:"../customer/review-sms-manual.html"},
        {page:"customer-review-followups",label:"متابعة العملاء غير الراضين",href:"../customer/review-followups.html"}
      ]},
      { id:"reports", label:"تقارير", icon:"▦", links:[
        {page:"customer-service-management-report",label:"تقرير أداء خدمة العملاء",href:"../customer/customer-service-management-report.html"},
        {page:"customer-review-sms-dashboard",label:"متابعة تقييمات العملاء",href:"../customer/review-sms-dashboard.html"},
        {page:"customer-review-coupons-dashboard",label:"متابعة مكافآت العملاء",href:"../customer/review-coupons-dashboard.html"}
      ]},
      { id:"settings", label:"إعدادات", icon:"⚙", links:[
        {page:"customer-review-sms-settings",label:"إعدادات رسائل التقييم",href:"../customer/review-sms-settings.html"}
      ]}
    ]
  },
  {
    id: "production",
    label: "الإنتاج والتصنيع",
    pages: ["production","production-daily","production-report","production-mo-cost"],
    groups: [
      { id:"operations", label:"تشغيل", icon:"⚡", links:[
        {page:"production",label:"مركز الإنتاج",href:"../production/index.html"},
        {page:"production-daily",label:"الإنتاج اليومي",href:"../production/daily.html"}
      ]},
      { id:"reports", label:"تقارير", icon:"▦", links:[
        {page:"production-report",label:"تقرير الإنتاج",href:"../production/report.html"},
        {page:"production-mo-cost",label:"تكلفة أمر التصنيع",href:"../production/mo-cost.html"}
      ]}
    ]
  },
  {
    id: "costing",
    label: "مراقبة التكاليف",
    pages: ["costing","costing-overview"],
    groups: [{ id:"reports", label:"تحليل", icon:"▦", links:[
      {page:"costing-overview",label:"التكاليف ونقطة التعادل",href:"../costing/index.html"}
    ]}]
  },
  {
    id: "purchase",
    label: "المشتريات والموردون",
    pages: ["purchase","purchase-daily","purchase-report","purchase-price","purchase-order-control","purchase-supplier-performance","purchase-open-orders"],
    groups: [
      { id:"operations", label:"تشغيل", icon:"⚡", links:[
        {page:"purchase",label:"مركز المشتريات",href:"../purchase/index.html"},
        {page:"purchase-daily",label:"مشتريات اليوم",href:"../purchase/daily.html"},
        {page:"purchase-order-control",label:"متابعة أوامر الشراء",href:"../purchase/order-control.html"},
        {page:"purchase-open-orders",label:"الأوامر المفتوحة",href:"../purchase/open-orders.html"}
      ]},
      { id:"reports", label:"تحليلات", icon:"▦", links:[
        {page:"purchase-report",label:"تقرير المشتريات بالفترة",href:"../purchase/report.html"},
        {page:"purchase-price",label:"تغير أسعار الشراء",href:"../purchase/price-intelligence.html"},
        {page:"purchase-supplier-performance",label:"كفاءة الموردين",href:"../purchase/supplier-performance.html"}
      ]}
    ]
  },
  {
    id: "inventory",
    label: "المخزون والمواقع",
    pages: ["inventory","inventory-intermediate-control","inventory-flow-control","inventory-movement-intelligence","inventory-executive-summary","inventory-historical-executive-summary","inventory-movement-analysis-report","inventory-reorder-risk"],
    groups: [
      { id:"operations", label:"تشغيل", icon:"⚡", links:[
        {page:"inventory",label:"مركز المخزون",href:"../inventory/index.html"},
        {page:"inventory-intermediate-control",label:"رقابة المخازن الوسيطة",href:"../inventory/intermediate-control.html"},
        {page:"inventory-flow-control",label:"التحكم في تدفق المخزون",href:"../inventory/flow-control.html"},
        {page:"inventory-movement-intelligence",label:"ذكاء حركة المخزون",href:"../inventory/movement-intelligence.html"},
        {page:"inventory-reorder-risk",label:"إعادة الطلب والمخاطر",href:"../inventory/reorder-risk.html"}
      ]},
      { id:"reports", label:"تقارير", icon:"▦", links:[
        {page:"inventory-executive-summary",label:"الملخص التنفيذي",href:"../inventory/executive-summary.html"},
        {page:"inventory-historical-executive-summary",label:"الملخص التاريخي",href:"../inventory/historical-executive-summary.html"},
        {page:"inventory-movement-analysis-report",label:"تحليل حركة الصنف",href:"../inventory/movement-analysis-report.html"}
      ]}
    ]
  },
  {
    id: "forecast",
    label: "التوقعات والأهداف",
    pages: ["forecast","forecast-products","forecast-targets","forecast-target-report"],
    groups: [
      { id:"operations", label:"تشغيل", icon:"⚡", links:[
        {page:"forecast",label:"مركز التوقعات",href:"../forecast/index.html"},
        {page:"forecast-products",label:"منتجات التارجت",href:"../forecast/products.html"},
        {page:"forecast-targets",label:"إدارة التارجت",href:"../forecast/targets.html"}
      ]},
      { id:"reports", label:"تقارير", icon:"▦", links:[
        {page:"forecast-target-report",label:"تقرير التارجت",href:"../forecast/target-report.html"}
      ]}
    ]
  },
  {
    id: "planning",
    label: "تخطيط التوقعات",
    pages: ["forecast-planning-achievement","forecast-planning-feasibility"],
    groups: [{ id:"planning", label:"تخطيط", icon:"◈", links:[
      {page:"forecast-planning-achievement",label:"الفوركاست والمبيعات الفعلية",href:"../forecast-planning/index.html"},
      {page:"forecast-planning-feasibility",label:"قابلية التحقيق والخامات",href:"../forecast-planning/feasibility.html"}
    ]}]
  },
  {
    id: "admin",
    label: "الإدارة والصلاحيات",
    pages: ["admin-users","admin-roles","admin-report-classification"],
    groups: [{ id:"settings", label:"إدارة", icon:"⚙", links:[
      {page:"admin-users",label:"المستخدمون والصلاحيات",href:"../admin/users.html"},
      {page:"admin-roles",label:"الأدوار والصلاحيات",href:"../admin/roles.html"},
      {page:"admin-report-classification",label:"تصنيف التقارير",href:"../admin/report-classification.html"}
    ]}]
  },
  {
    id: "reports",
    label: "مركز التقارير",
    pages: ["reports-executive","reports-management","reports-operational"],
    groups: [{ id:"reports", label:"التقارير", icon:"▦", links:[
      {page:"reports-executive",label:"تنفيذي",href:"../reports/executive.html",always:true},
      {page:"reports-management",label:"إداري",href:"../reports/management.html",always:true},
      {page:"reports-operational",label:"تشغيلي",href:"../reports/operational.html",always:true}
    ]}]
  }
];


// Customer Care module model — one source of truth for every internal page.
// The visual contract is based on the two reference workbenches that proved most
// usable in testing: complaints + financial review.
const MI_CUSTOMER_PAGE_MODEL = {
  "customer-pos-phones": { group:"operations", kicker:"متابعة نقاط البيع", title:"متابعة عملاء نقاط البيع", subtitle:"كل أرقام عملاء POS مع حالة الرسالة والتقييم والمتابعة والكوبون في شاشة واحدة." },
  "customer-service-pos-review": { group:"operations", kicker:"تشغيل الشكاوى", title:"سجل شكاوى وملاحظات العملاء", subtitle:"بحث الفواتير وتسجيل ملاحظات خدمة العملاء ومتابعة معالجة الحالات حتى الإغلاق." },
  "customer-financial-review": { group:"operations", kicker:"المسار المالي", title:"المراجعة والتحقق المالي", subtitle:"متابعة التذاكر بعد اعتماد المدير، من مراجعة المراقب وحتى إجراءات المحاسب والقيد والصرف." },
  "customer-service-management-report": { group:"reports", kicker:"تقارير الإدارة", title:"تقرير أداء خدمة العملاء", subtitle:"مؤشرات الشكاوى وسرعة المعالجة ونتائج التقييم وأداء فريق خدمة العملاء في شاشة موحدة." },
  "customer-review-sms-dashboard": { group:"reports", kicker:"متابعة التقييمات", title:"متابعة تقييمات العملاء", subtitle:"متابعة حالة الإرسال وتفاعل العملاء ونتائج التقييم من مساحة تشغيل واحدة." },
  "customer-review-sms-queue": { group:"operations", kicker:"تشغيل الرسائل", title:"تشغيل رسائل التقييم", subtitle:"مراجعة الفواتير المؤهلة وتشغيل إرسال رسائل التقييم للعملاء الجاهزين فقط." },
  "customer-review-sms-manual": { group:"operations", kicker:"إرسال مباشر", title:"الإرسال اليدوي للعملاء", subtitle:"إرسال رابط التقييم إلى عميل أو مجموعة عملاء باستخدام سياسات الحماية والمكافآت المعتمدة." },
  "customer-review-followups": { group:"operations", kicker:"استعادة رضا العملاء", title:"متابعة العملاء غير الراضين", subtitle:"توثيق التواصل وتوزيع الحالات ومتابعتها حتى الحل والإغلاق." },
  "customer-review-coupons-dashboard": { group:"reports", kicker:"مكافآت العملاء", title:"متابعة مكافآت العملاء", subtitle:"متابعة المكافآت والتعويضات وحالة الإصدار والاستخدام والانتهاء من شاشة واحدة." },
  "customer-review-sms-settings": { group:"settings", kicker:"إعدادات التشغيل", title:"إعدادات رسائل التقييم", subtitle:"التحكم في إرسال الرسائل وقواعد اختيار العملاء والمكافآت من حساب المشروع الحالي." }
};

const MI_CUSTOMER_GROUP_LABELS = {
  operations: "تشغيل",
  reports: "تقارير",
  settings: "إعدادات"
};

function getMiCustomerPageModel(activePage) {
  return MI_CUSTOMER_PAGE_MODEL[activePage] || null;
}

function isMiCustomerModulePage(activePage) {
  return MI_PAGE_MODULE_MAP?.get?.(activePage)?.id === "customer" || activePage === "customer-pos-phones";
}

// Old customer pages historically carried their own hero/navigation. Before the
// unified shell mounts we remove that chrome and preserve only real functional
// controls (health, provider mode, refresh, Shopify state) in one compact runtime bar.
function normalizeStandaloneCustomerChrome(pageMain, activePage) {
  const model = getMiCustomerPageModel(activePage);
  if (!model || !pageMain) return;

  pageMain.querySelectorAll(".crsms-return-bar, .service-page-toolbar, .cs-management-nav").forEach((node) => node.remove());

  const legacyHero = pageMain.querySelector(".crsms-operation-hero, .crsms-dashboard-hero, .inventory-hero-card");
  if (!legacyHero) return;

  const runtime = document.createElement("section");
  runtime.className = "mi-customer-runtime-bar";
  runtime.dataset.miCustomerRuntime = "true";
  runtime.innerHTML = `
    <div class="mi-customer-runtime-copy">
      <span class="mi-customer-runtime-dot" aria-hidden="true"></span>
      <div><small>حالة التشغيل</small><strong>${escapeMiUiText(model.kicker)}</strong></div>
    </div>
    <div class="mi-customer-runtime-tools"></div>
  `;
  const tools = runtime.querySelector(".mi-customer-runtime-tools");

  const move = (selector, className = "") => {
    const node = legacyHero.querySelector(selector);
    if (!node) return;
    if (className) node.classList.add(className);
    tools.appendChild(node);
  };

  // Preserve the minimum functional state only — never the old hero card itself.
  move("#modeBadge", "mi-runtime-badge");
  move(".crsms-company-chip", "mi-runtime-company");
  move("[data-action='refresh-all']", "mi-runtime-action");
  move("[data-action='health']", "mi-runtime-action");
  move("[data-queue-action='health']", "mi-runtime-action");
  move("[data-followups-action='health']", "mi-runtime-action");
  move("#shopifyStatusBadge", "mi-runtime-action");

  legacyHero.remove();
  if (tools.children.length) pageMain.insertBefore(runtime, pageMain.firstChild);
}

const MI_PAGE_MODULE_MAP = new Map();
MI_MODULE_DEFINITIONS.forEach((module) => module.pages.forEach((page) => MI_PAGE_MODULE_MAP.set(page, module)));

const MI_APP_NAVIGATION_PAGES = new Set([
  "dashboard",
  ...MI_MODULE_DEFINITIONS.flatMap((module) => module.pages)
]);

function ensureMiAppStyles() {
  const existing = document.querySelector('link[data-mi-unified-ui="true"], link[data-mi-app-navigation="true"]');
  if (existing) {
    // Keep the unified identity as the final stylesheet in cascade order, even
    // after legacy compatibility styles are injected by old report pages.
    document.head.appendChild(existing);
    return;
  }
  const scriptUrl = document.currentScript?.src || window.location.href;
  const href = new URL("../css/mi-app.css?v=20260908-project-unified-01", scriptUrl).href;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.miAppNavigation = "true";
  link.dataset.miUnifiedUi = "true";
  document.head.appendChild(link);
}

function ensureMiCustomerModuleStyles(activePage) {
  if (MI_PAGE_MODULE_MAP.get(activePage)?.id !== "customer") return;
  const scriptUrl = document.currentScript?.src || window.location.href;
  const href = new URL("../css/customer-module.css?v=20260908-project-unified-01", scriptUrl).href;
  let link = document.querySelector('link[data-mi-customer-module-ui="true"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.miCustomerModuleUi = "true";
  }
  // Always keep this scoped customer layer last in cascade order.
  document.head.appendChild(link);
}

function getMiSectionNavigation(activePage) {
  return MI_PAGE_MODULE_MAP.get(activePage) || null;
}

function getMiModulePageContext(activePage) {
  const section = getMiSectionNavigation(activePage);
  if (!section) return null;
  const activeGroup = section.groups.find((group) =>
    group.links.some((item) => item.page === activePage)
  ) || section.groups[0] || null;
  return {
    section,
    group: activeGroup,
    pill: activeGroup ? `${section.label} · ${activeGroup.label}` : section.label
  };
}

function canShowMiModuleLink(item, activePage) {
  if (item.always || item.page === activePage || isAdmin()) return true;
  if (item.permission) return getUserPermissions().includes(item.permission);
  return hasPermission(item.page);
}

function renderMiSectionNavigation(activePage) {
  const section = getMiSectionNavigation(activePage);
  if (!section) return "";

  const groups = section.groups.map((group) => {
    const visibleLinks = group.links.filter((item) => canShowMiModuleLink(item, activePage));
    if (!visibleLinks.length) return "";
    const isActiveGroup = visibleLinks.some((item) => item.page === activePage);
    const links = visibleLinks.map((item) => `
      <a class="mi-section-menu-link ${item.page === activePage ? "active" : ""}"
         data-page="${item.page}" href="${item.href}">
        <span>${item.label}</span>
        ${item.page === activePage ? '<small>الصفحة الحالية</small>' : ''}
      </a>
    `).join("");

    return `
      <details class="mi-section-nav-group ${isActiveGroup ? "active" : ""}">
        <summary>
          <span class="mi-section-group-icon" aria-hidden="true">${group.icon}</span>
          <strong>${group.label}</strong>
          <span class="mi-section-group-arrow" aria-hidden="true">⌄</span>
        </summary>
        <div class="mi-section-menu">${links}</div>
      </details>
    `;
  }).join("");

  return `
    <nav class="mi-section-nav mi-section-nav-grouped" aria-label="تنقل ${section.label}">
      <a class="mi-section-dashboard-link" href="../dashboard/index.html">
        <span aria-hidden="true">←</span>
        <strong>لوحة الإدارة</strong>
      </a>
      <div class="mi-section-nav-context">
        <span class="mi-section-module-label">${section.label}</span>
        <div class="mi-section-nav-groups">${groups}</div>
      </div>
    </nav>
  `;
}

function setupMiSectionNavigation() {
  const groups = Array.from(document.querySelectorAll(".mi-section-nav-group"));
  if (!groups.length) return;

  groups.forEach((group) => {
    group.addEventListener("toggle", () => {
      if (!group.open) return;
      groups.forEach((other) => {
        if (other !== group) other.open = false;
      });
    });
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".mi-section-nav-group")) return;
    groups.forEach((group) => { group.open = false; });
  }, { capture: true });
}

function shouldShowReportToolbar(activePage) {
  return !PAGES_WITHOUT_REPORT_TOOLBAR.has(activePage);
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function getUserPermissions() {
  const user = getCurrentUser();
  return Array.isArray(user.permissions) ? user.permissions : [];
}

function getUserRoles() {
  const user = getCurrentUser();
  return Array.isArray(user.roles) ? user.roles : [];
}

function isAdmin() {
  const user = getCurrentUser();
  const roles = getUserRoles();
  const permissions = getUserPermissions();

  if (user.role === "admin") return true;
  if (user.role === "super_admin") return true;
  if (permissions.includes("*")) return true;

  return roles.some((role) => {
    return ["admin", "super_admin"].includes(role.code);
  });
}

function getReportCodeForPage(pageCode) {
  return REPORT_PAGE_MAP[pageCode] || "";
}

function hasPermission(pageCode) {
  if (isAdmin()) return true;

  if (pageCode === "dashboard") {
    return true;
  }

  if ([
    "admin-users",
    "admin-roles",
    "admin-report-classification",
    "customer-review-sms-settings"
  ].includes(pageCode)) {
    return false;
  }

  const permissions = getUserPermissions();

  if (pageCode === "customer-financial-review") {
    return [
      "customer.service_compensation.monitor",
      "customer.service_compensation.accounting",
      "customer.review_sms.manage_followups"
    ].some((permission) => permissions.includes(permission));
  }

  const reportCode = getReportCodeForPage(pageCode);

  if (!reportCode) return false;

  return permissions.includes(reportCode);
}

async function syncCurrentUserPermissions() {
  if (isAdmin()) return;

  try {
    const response = await apiGet("/permissions/me");
    const freshPermissions = (response.data?.reports || [])
      .map(report => report.code)
      .filter(Boolean)
      .sort();
    const currentPermissions = [...getUserPermissions()].sort();

    if (JSON.stringify(freshPermissions) === JSON.stringify(currentPermissions)) {
      return;
    }

    const user = getCurrentUser();
    localStorage.setItem("user", JSON.stringify({
      ...user,
      permissions: freshPermissions
    }));
    window.location.reload();
  } catch (error) {
    console.warn("Could not refresh user permissions", error.message);
  }
}

function guardPage(activePage) {
  if (typeof ensureLocalDevSession === "function") {
    ensureLocalDevSession();
  }

  const token =
    typeof getAuthToken === "function"
      ? getAuthToken()
      : localStorage.getItem("token");

  if (!token) {
    window.location.href = "../admin/login.html";
    return false;
  }

  if (!hasPermission(activePage)) {
    return false;
  }

  return true;
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("companyId");
  localStorage.removeItem("branchCode");
  window.location.href = "../admin/login.html";
}

function renderPermissionDenied(reportName = "هذا التقرير") {
  return `
    <section class="permission-denied-card">
      <div class="permission-orbit">
        <div class="permission-icon">☕🔒</div>
      </div>

      <span class="permission-badge">No Permission</span>

      <h2>استنى يا نجم 🚫📊</h2>

      <p>
        التقرير ده لسه مش ضمن صلاحياتك 😌
        <br />
        اشرب كوباية قهوة فرنساوي ☕🇫🇷 وخد بريك صغير...
        <br />
        وبعدين ارجع لصاحبك أو مسؤول النظام وخلّيه يديك الصلاحية
        عشان تشوف تفاصيل <strong>${reportName}</strong> 😉
      </p>

      <div class="permission-note">
        متقلقش... الأرقام مستنياك أول ما الصلاحية تتفعل 📈✨
      </div>

      <div class="permission-actions">
        <a href="../dashboard/index.html" class="permission-btn primary">
          🏠 الرجوع للداش بورد
        </a>

        <button class="permission-btn secondary" onclick="window.history.back()">
          ↩️ ارجع للصفحة السابقة
        </button>
      </div>
    </section>
  `;
}

const REPORT_TIMEZONE = "Africa/Cairo";

function getReportCalendarDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, Number(part.value)])
  );

  return new Date(Date.UTC(values.year, values.month - 1, values.day));
}

function toISODate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function applyDatePreset(preset) {
  const dateFrom = document.getElementById("dateFrom");
  const dateTo = document.getElementById("dateTo");
  const customDates = document.getElementById("customDates");

  const today = getReportCalendarDate();
  const from = new Date(today);
  const to = new Date(today);

  if (preset === "today") {
    // today only
  } else if (preset === "yesterday") {
    from.setUTCDate(today.getUTCDate() - 1);
    to.setUTCDate(today.getUTCDate() - 1);
  } else if (preset === "last2") {
    from.setUTCDate(today.getUTCDate() - 1);
  } else if (preset === "last7") {
    from.setUTCDate(today.getUTCDate() - 6);
  } else if (preset === "last30") {
    from.setUTCDate(today.getUTCDate() - 29);
  } else if (preset === "thisMonth") {
    from.setUTCDate(1);
  } else if (preset === "last6CompleteMonths") {
    to.setUTCDate(1);
    to.setUTCDate(0);
    from.setUTCFullYear(to.getUTCFullYear(), to.getUTCMonth() - 5, 1);
  } else if (preset === "custom") {
    if (customDates) customDates.hidden = false;
    syncDatePresetButtons(preset);
    return;
  }

  if (customDates) customDates.hidden = true;
  if (dateFrom) dateFrom.value = toISODate(from);
  if (dateTo) dateTo.value = toISODate(to);
  syncDatePresetButtons(preset);
}

function syncDatePresetButtons(activePreset) {
  document.querySelectorAll("[data-date-preset-button]").forEach((button) => {
    const isActive = button.dataset.datePresetButton === activePreset;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function notifyDateRangeChanged() {
  const dateFrom = document.getElementById("dateFrom");
  dateFrom?.dispatchEvent(new Event("change", { bubbles: true }));
}

async function loadAllowedCompaniesForCurrentUser() {
  try {
    const response = await apiGet("/company-access/me");

    const companies =
      response.data ||
      response.companies ||
      [];

    if (
      response.success &&
      Array.isArray(companies) &&
      companies.length
    ) {
      return companies;
    }

    console.warn("Company access returned empty list", response);
  } catch (error) {
    console.warn("Could not load allowed companies", error.message);
  }

  const user = getCurrentUser();

  const isSuperUser =
    user.role === "admin" ||
    user.role === "super_admin" ||
    getUserPermissions().includes("*") ||
    getUserRoles().some((role) => {
      return ["admin", "super_admin"].includes(role.code);
    });

  if (isSuperUser) {
    return [
      {
        companyId: 1,
        companyName: "فيرجينيا"
      },
      {
        companyId: 2,
        companyName: "كليوباترا"
      }
    ];
  }

  return null;
}

async function applyCompanyAccessToDropdown() {
  const companySelect = document.getElementById("companySelect");

  if (!companySelect) return;

  const allowedCompanies =
    await loadAllowedCompaniesForCurrentUser();

  if (!allowedCompanies || !allowedCompanies.length) {
    companySelect.innerHTML = `
      <option value="">لا توجد شركات مسموحة</option>
    `;
    localStorage.removeItem("companyId");
    localStorage.removeItem("branchCode");
    syncCompanyContextGate([]);
    return;
  }

  const savedCompanyId = String(localStorage.getItem("companyId") || "");
  const allowedCompanyIds = new Set(
    allowedCompanies.map(company => String(company.companyId))
  );

  companySelect.innerHTML = `
    <option value="">اختر الشركة</option>
    ${
      allowedCompanies
        .map(company => `
          <option value="${company.companyId}">
            ${company.companyName}
          </option>
        `)
        .join("")
    }
  `;

  if (allowedCompanyIds.has(savedCompanyId)) {
    companySelect.value = savedCompanyId;
  } else if (allowedCompanies.length === 1) {
    companySelect.value = String(allowedCompanies[0].companyId);
    setCompanyId(companySelect.value);
  } else {
    companySelect.value = "";
    localStorage.removeItem("companyId");
  }

  syncCompanyContextGate(allowedCompanies);

  companySelect.addEventListener("change", () => {
    const newCompanyId = setCompanyId(companySelect.value);

    if (typeof setBranchCode === "function") {
      setBranchCode("");
    } else {
      localStorage.removeItem("branchCode");
    }

    window.dispatchEvent(
      new CustomEvent("company-context-changed", {
        detail: {
          companyId: newCompanyId
        }
      })
    );

    syncCompanyContextGate(allowedCompanies);
  });
}

function syncCompanyContextGate(allowedCompanies = []) {
  const activeCompanyId = String(localStorage.getItem("companyId") || "");
  const selectedCompany = allowedCompanies.find(
    company => String(company.companyId) === activeCompanyId
  );
  let gate = document.getElementById("miCompanyContextGate");

  if (selectedCompany) {
    gate?.remove();
    document.body.classList.remove("mi-company-context-required");
    return;
  }

  if (!gate) {
    gate = document.createElement("section");
    gate.id = "miCompanyContextGate";
    gate.className = "mi-company-context-gate";
    document.body.appendChild(gate);
  }

  gate.innerHTML = `
    <div class="mi-company-context-dialog" role="dialog" aria-modal="true" aria-labelledby="miCompanyGateTitle">
      <span class="mi-company-context-icon">🏢</span>
      <div>
        <small>نطاق العمل الحالي</small>
        <h2 id="miCompanyGateTitle">اختر الشركة قبل فتح التقارير</h2>
        <p>سيُطبّق اختيارك تلقائيًا على المشروع كله، ويمكن تغييره لاحقًا من الهيدر.</p>
      </div>
      <div class="mi-company-context-options">
        ${allowedCompanies.map(company => `
          <button type="button" data-company-context-choice="${company.companyId}">
            <strong>${company.companyName}</strong>
            <span>الدخول إلى تقارير الشركة</span>
          </button>
        `).join("")}
      </div>
      ${allowedCompanies.length > 1 ? '<p class="mi-company-context-note">حسابك مصرح له بالشركتين؛ اختر الشركة النشطة الآن ويمكنك التبديل بينهما من الهيدر.</p>' : ""}
    </div>
  `;

  gate.querySelectorAll("[data-company-context-choice]").forEach(button => {
    button.addEventListener("click", () => {
      const companyId = setCompanyId(button.dataset.companyContextChoice);
      const companySelect = document.getElementById("companySelect");
      if (companySelect) companySelect.value = companyId;
      syncCompanyContextGate(allowedCompanies);
      window.dispatchEvent(new CustomEvent("company-context-changed", {
        detail: { companyId }
      }));
    });
  });

  document.body.classList.add("mi-company-context-required");
}


function initLayout(activePage) {
  const companySelect = document.getElementById("companySelect");
  const datePreset = document.getElementById("datePreset");

  if (companySelect) {
    applyCompanyAccessToDropdown();
  }

  if (datePreset) {
    const defaultPreset = activePage === "costing-overview"
      ? "thisMonth"
      : "today";

    datePreset.value = defaultPreset;
    applyDatePreset(defaultPreset);

    datePreset.addEventListener("change", () => {
      applyDatePreset(datePreset.value);
      notifyDateRangeChanged();
    });

    document.querySelectorAll("[data-date-preset-button]").forEach((button) => {
      button.addEventListener("click", () => {
        const preset = button.dataset.datePresetButton || "today";
        datePreset.value = preset;
        applyDatePreset(preset);

        if (preset !== "custom") {
          notifyDateRangeChanged();
        }
      });
    });
  }

  syncCurrentUserPermissions();
}

function renderLayout(title, subtitle, activePage, contentHtml) {
  document.body.classList.add("mi-report-design-v2");
  const unifiedNavigation = activePage === "dashboard" || MI_APP_NAVIGATION_PAGES.has(activePage) || Boolean(activePage);
  if (unifiedNavigation) ensureMiAppStyles();
  ensureMiCustomerModuleStyles(activePage);
  const customerModel = getMiCustomerPageModel(activePage);
  if (customerModel) {
    title = customerModel.title;
    subtitle = customerModel.subtitle;
  }
  document.body.classList.toggle("mi-app-navigation", unifiedNavigation);
  document.body.classList.toggle("mi-app-unified", unifiedNavigation);
  document.body.classList.toggle("mi-app-dashboard", activePage === "dashboard");
  document.body.classList.toggle("mi-app-service", ["customer-service-pos-review", "customer-financial-review"].includes(activePage));
  const moduleContext = getMiModulePageContext(activePage);
  const activeModuleId = moduleContext?.section?.id || (activePage === "dashboard" ? "dashboard" : "general");
  const activeModuleGroup = customerModel?.group || moduleContext?.group?.id || "";
  document.body.classList.toggle("mi-customer-module-page", activeModuleId === "customer");
  document.body.dataset.miModule = activeModuleId;
  if (activeModuleGroup) document.body.dataset.miModuleGroup = activeModuleGroup;
  else delete document.body.dataset.miModuleGroup;
  const customerGroup = customerModel?.group || "";
  if (customerGroup) document.body.dataset.miCustomerGroup = customerGroup;
  else delete document.body.dataset.miCustomerGroup;
  const isAllowed = guardPage(activePage);

    window.ACTIVE_PAGE = activePage;
  document.body.dataset.activePage = activePage;

  const finalContentHtml = isAllowed
    ? contentHtml
    : renderPermissionDenied(title || "هذا التقرير");

  const showReportToolbar = shouldShowReportToolbar(activePage);
  const currentUser = getCurrentUser() || {};
  const currentUserName = escapeMiUiText(currentUser.fullName || currentUser.username || "User");
  const currentUserRole = escapeMiUiText(currentUser.role === "admin" || currentUser.role === "super_admin" ? "إدارة النظام" : "حساب المستخدم");
  const currentUserInitials = escapeMiUiText(getMiUserInitials(currentUser));
  const sectionNavigationHtml = unifiedNavigation ? renderMiSectionNavigation(activePage) : "";
  const customerPill = customerModel
    ? `خدمة العملاء · ${MI_CUSTOMER_GROUP_LABELS[customerModel.group] || "تشغيل"}`
    : (moduleContext?.pill || (activePage === "dashboard" ? "لوحة الإدارة" : "منصة الإدارة"));

  const reportToolbarHtml = STANDALONE_CUSTOMER_PAGES.has(activePage)
  ? ""
  : showReportToolbar
  ? `
    <section id="reportToolbar" class="report-toolbar mi-unified-filter-toolbar">
      <div class="mi-filter-intro">
        <span>فلاتر</span>
        <strong>فلتر التقرير</strong>
      </div>

      <div class="header-actions">
        <div class="filter-row">
          <label class="context-field company-context-field">
            <span>الشركة</span>
            <select id="companySelect" class="control company-control">
              <option value="">اختر الشركة</option>
            </select>
          </label>

          <label id="branchScopeField" class="context-field branch-context-field">
            <span>الفرع / النطاق</span>
            <select id="branchCode" class="control branch-control" disabled>
              <option value="">اختر الشركة أولًا</option>
            </select>
          </label>

          <div class="context-field date-context-field">
            <span>الفترة</span>
            <div class="date-preset-switcher" role="group" aria-label="الفترة الزمنية">
              <button type="button" data-date-preset-button="today">اليوم</button>
              <button type="button" data-date-preset-button="yesterday">أمس</button>
              <button type="button" data-date-preset-button="thisMonth">هذا الشهر</button>
              <button type="button" data-date-preset-button="custom">📅 مخصص</button>
            </div>
          </div>

          <select id="datePreset" class="date-preset-compat" aria-hidden="true" tabindex="-1">
            <option value="today">اليوم</option>
            <option value="yesterday">أمس</option>
            <option value="thisMonth">هذا الشهر</option>
            <option value="custom">مخصص</option>
          </select>

          <div id="customDates" class="custom-dates" hidden>
            <label><span>من</span><input class="control" type="date" id="dateFrom" /></label>
            <label><span>إلى</span><input class="control" type="date" id="dateTo" /></label>
          </div>

          <button class="run-btn" id="loadBtn">تحديث التقرير</button>
        </div>
      </div>
    </section>
  `
  : `
    <section class="mi-context-toolbar mi-context-toolbar-compact">
      <label class="context-field company-context-field">
        <span>الشركة</span>
        <select id="companySelect" class="control company-control">
          <option value="">اختر الشركة</option>
        </select>
      </label>
    </section>
  `;

  document.body.innerHTML = `
    <div class="app-shell ${unifiedNavigation ? "mi-app-shell" : ""}">

      <main class="main">
        <section class="mi-page-hero">

          

          <div class="mi-hero-account-bar mi-compact-account-tools">
            <button type="button" class="mi-language-toggle mi-tool-capsule" data-mi-language-toggle aria-label="تغيير اللغة" title="Language">
              <span class="mi-tool-symbol" aria-hidden="true">A/ع</span>
              <span class="mi-tool-copy"><strong>EN</strong><small>اللغة</small></span>
            </button>
            <div class="user-chip mi-account-capsule" title="${currentUserName}" aria-label="المستخدم الحالي">
              <span class="mi-account-avatar">${currentUserInitials}</span>
              <span class="mi-account-copy"><strong>${currentUserName}</strong><small>${currentUserRole}</small></span>
            </div>
            <button class="logout-btn mi-logout-capsule" onclick="logout()" aria-label="تسجيل الخروج" title="تسجيل الخروج">
              <span aria-hidden="true">↪</span><strong>خروج</strong>
            </button>
          </div>

          <div class="mi-hero-heading">
            <span class="page-pill">${customerPill}</span>
            <h2>${title}</h2>
            <p>${subtitle}</p>
          </div>
        </section>

        ${sectionNavigationHtml}
        ${reportToolbarHtml}

        <section class="content mi-bootstrap-page">
          ${finalContentHtml}
        </section>
      </main>
    </div>
  `;

  document.documentElement.classList.remove("mi-app-preboot");
  document.documentElement.classList.add("mi-app-ready");

  initLayout(activePage);
  loadReportExportEngine(activePage);
  loadReportFiltersEngine(activePage);
  enhanceLegacyReportUi(document);
  observeLegacyReportUi();
  setupMiThemeSwitcher();
  setupMiSectionNavigation();
  window.MI18n?.refresh?.();
}

function kpiCard(label, value, hint = "") {
  return `
    <div class="card" title="${hint}">
      <span class="card-label">${label}</span>
      <strong>${value ?? "-"}</strong>
    </div>
  `;
}

function renderKpis(items) {
  return `<div class="cards-grid">${items.join("")}</div>`;
}

function renderPanel(title, body) {
  return `
    <div class="panel">
      <div class="panel-title">
        <h3>${title}</h3>
      </div>
      ${body}
    </div>
  `;
}

function renderTable(columns, rows) {
  if (!rows || rows.length === 0) {
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
          ${rows.map((row) => `
            <tr>
              ${columns.map((c) => {
                const value = c.format ? c.format(row[c.key], row) : row[c.key];
                return `<td title="${c.hint || ""}">${value ?? ""}</td>`;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function showLoading(targetId = "reportArea") {
  document.getElementById(targetId).innerHTML = `
    <div class="empty loading-box">
      <span class="loader-dot"></span>
      جاري تحميل التقرير...
    </div>
  `;
}

function showError(error, targetId = "reportArea") {
  const message = error?.message || String(error || "حدث خطأ أثناء تحميل التقرير");
  window.MINotifications?.error?.(message, {
    title: "حدث خطأ أثناء تحميل التقرير",
    id: `mi-report-error-${targetId}`
  });

  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = `
    <div class="error-box">
      حدث خطأ أثناء تحميل التقرير<br>
      ${message}
    </div>
  `;
}

function loadReportExportEngine(activePage) {
  if (window.ReportExport) {
    window.ReportExport.setup(activePage);
    return;
  }

  const existingScript =
    document.querySelector('script[data-report-export-engine="true"]');

  if (existingScript) {
    existingScript.addEventListener("load", () => {
      window.ReportExport?.setup(activePage);
    });

    return;
  }

  const script = document.createElement("script");

  script.src = "../js/report-export.js";
  script.dataset.reportExportEngine = "true";

  script.onload = () => {
    window.ReportExport?.setup(activePage);
  };

  script.onerror = () => {
    console.warn("Report export engine failed to load");
  };

  document.body.appendChild(script);
}

function loadReportFiltersEngine(activePage) {
  if (window.ReportFilters) {
    window.ReportFilters.setup?.(activePage);
    return;
  }

  const existingScript =
    document.querySelector('script[data-report-filters-engine="true"]');

  if (existingScript) {
    existingScript.addEventListener("load", () => {
      window.ReportFilters?.setup?.(activePage);
    });

    return;
  }

  const script = document.createElement("script");

  script.src = "../js/report-filters.js?v=20260815-02";
  script.dataset.reportFiltersEngine = "true";

  script.onload = () => {
    window.ReportFilters?.setup?.(activePage);
  };

  script.onerror = () => {
    console.warn("Report filters engine failed to load");
  };

  document.body.appendChild(script);
}

function mountStandaloneCustomerPage() {
  if (document.body?.dataset.miSidebarMounted === "true") return;

  const activePage = document.body?.dataset.activePage || (() => {
    if (document.body?.classList.contains("service-pos-page")) return "customer-service-pos-review";
    if (document.body?.classList.contains("cs-management-page")) return "customer-service-management-report";
    const fileName = location.pathname.split("/").pop();
    return {
      "financial-review.html": "customer-financial-review",
      "review-sms-dashboard.html": "customer-review-sms-dashboard",
      "review-sms-queue.html": "customer-review-sms-queue",
      "review-sms-manual.html": "customer-review-sms-manual",
      "review-followups.html": "customer-review-followups",
      "review-coupons-dashboard.html": "customer-review-coupons-dashboard",
      "review-sms-settings.html": "customer-review-sms-settings"
    }[fileName];
  })();

  const model = getMiCustomerPageModel(activePage);
  if (!activePage || !model) return;

  const pageMain = document.querySelector("body > main");
  if (!pageMain) return;

  normalizeStandaloneCustomerChrome(pageMain, activePage);
  document.body.dataset.miSidebarMounted = "true";
  renderLayout(model.title, model.subtitle, activePage, pageMain.outerHTML);
}

document.addEventListener("DOMContentLoaded", mountStandaloneCustomerPage);
