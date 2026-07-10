const REPORT_PAGE_MAP = {
  dashboard: "dashboard.index",

  "admin-users": "admin.users",
  "admin-roles": "admin.roles",

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
  
  

  customer: "customer.index",
  "customer-pos-phones": "customer.pos_phones",
  "customer-service-pos-review": "customer.service_pos_review",
  

  

  /*
    Customer Review SMS pages.
    مبدئيًا مربوطة على صلاحية مراجعة خدمة العملاء عشان تظهر فورًا
    للمستخدمين المصرح لهم بخدمة العملاء. نقدر نفصلها لاحقًا بصلاحيات مستقلة.
  */
  "customer-review-sms-dashboard": "customer.service_pos_review",
  "customer-review-sms-queue": "customer.service_pos_review",
  "customer-review-followups": "customer.service_pos_review",
  "customer-review-coupon": "customer.service_pos_review",
  production: "production.index",
  "production-daily": "production.daily",
  "production-report": "production.report",
  "production-mo-cost": "production.mo_cost",

  purchase: "purchase.index",
  "purchase-daily": "purchase.daily",
  "purchase-report": "purchase.report",
  "purchase-price": "purchase.price",
  "purchase-order-control": "purchase.order_control",
  "purchase-supplier-performance": "purchase.supplier_performance",
  "purchase-open-orders": "purchase.open_orders",

  inventory: "inventory.index",
  "inventory-executive-summary": "inventory.executive_summary",
  "inventory-intermediate-control": "inventory.intermediate_control",
  "inventory-flow-control": "inventory.flow_control",
  "inventory-movement-intelligence": "inventory.movement_intelligence",

  forecast: "forecast.index",
  "forecast-products": "forecast.products",
  "forecast-targets": "forecast.targets",
  "forecast-target-report": "forecast.target_report",

  "forecast-planning-achievement": "forecast_planning.achievement"
};

const EXPORT_ENABLED_PAGES = new Set([
  "inventory-executive-summary",
  "inventory-intermediate-control",
  "pos-branch-sales",
  "pos-peak-hours",
  "forecast-target-report",
  "forecast-planning-achievement",
  "customer-pos-phones",
  "production-mo-cost"
]);
const PAGES_WITHOUT_REPORT_TOOLBAR = new Set([
  "dashboard",

  "admin-users",
  "admin-roles",

  "branches",
  "menu-prices",
  "pos",
  "customer",
  
  "customer-review-sms-dashboard",
  "customer-review-sms-queue",
  "customer-review-followups",
  "customer-review-coupon",
  "production",
  "purchase",
  "inventory",
  "forecast",
  "forecast-planning-achievement"
]);

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

  const reportCode = getReportCodeForPage(pageCode);

  if (!reportCode) return false;

  const permissions = getUserPermissions();

  return permissions.includes(reportCode);
}

function guardPage(activePage) {
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    if (typeof ensureLocalDevSession === "function") {
      ensureLocalDevSession();
    } else if (!localStorage.getItem("token")) {
      localStorage.setItem("token", "dev-bypass-token");
    }
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

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function applyDatePreset(preset) {
  const dateFrom = document.getElementById("dateFrom");
  const dateTo = document.getElementById("dateTo");
  const customDates = document.getElementById("customDates");

  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);

  if (preset === "today") {
    // today only
  } else if (preset === "yesterday") {
    from.setDate(today.getDate() - 1);
    to.setDate(today.getDate() - 1);
  } else if (preset === "last2") {
    from.setDate(today.getDate() - 1);
  } else if (preset === "last7") {
    from.setDate(today.getDate() - 6);
  } else if (preset === "last30") {
    from.setDate(today.getDate() - 29);
  } else if (preset === "thisMonth") {
    from.setDate(1);
  } else if (preset === "custom") {
    if (customDates) customDates.style.display = "flex";
    return;
  }

  if (customDates) customDates.style.display = "none";
  if (dateFrom) dateFrom.value = toISODate(from);
  if (dateTo) dateTo.value = toISODate(to);
}

function applySidebarPermissions() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    const page = link.dataset.page;

    if (!hasPermission(page)) {
      link.style.display = "none";
    } else {
      link.style.display = "";
    }
  });

  document.querySelectorAll(".nav-accordion").forEach((accordion) => {
    const visibleLinks = accordion.querySelectorAll(
      '.nav-link:not([style*="display: none"])'
    );

    accordion.style.display = visibleLinks.length ? "" : "none";
  });

  document.querySelectorAll(".nav-group").forEach((group) => {
    let next = group.nextElementSibling;
    let hasVisibleLink = false;

    while (next && !next.classList.contains("nav-group")) {
      if (
        next.classList.contains("nav-link") &&
        next.style.display !== "none"
      ) {
        hasVisibleLink = true;
      }

      if (
        next.classList.contains("nav-accordion") &&
        next.style.display !== "none"
      ) {
        hasVisibleLink = true;
      }

      next = next.nextElementSibling;
    }

    if (!hasVisibleLink) {
      group.style.display = "none";
    } else {
      group.style.display = "";
    }
  });
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

  const isLocalDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  const isSuperUser =
    user.role === "admin" ||
    user.role === "super_admin" ||
    user.isDevBypass === true ||
    getUserPermissions().includes("*") ||
    getUserRoles().some((role) => {
      return ["admin", "super_admin"].includes(role.code);
    });

  if (isLocalDev || isSuperUser) {
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
    return;
  }

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

  /*
    مهم:
    لا نختار الشركة تلقائيًا من localStorage.
    كل صفحة تقرير لازم المستخدم يختار الشركة بنفسه.
  */
  companySelect.value = "";
  localStorage.removeItem("companyId");

  if (typeof setBranchCode === "function") {
    setBranchCode("");
  } else {
    localStorage.removeItem("branchCode");
  }

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
  });
}


function initLayout(activePage) {
  const companySelect = document.getElementById("companySelect");
  const datePreset = document.getElementById("datePreset");

  if (companySelect) {
    applyCompanyAccessToDropdown();
  }

  if (datePreset) {
    datePreset.value = "today";
    applyDatePreset("today");

    datePreset.addEventListener("change", () => {
      applyDatePreset(datePreset.value);
    });
  }

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === activePage);
  });

  applySidebarPermissions();
}

function renderLayout(title, subtitle, activePage, contentHtml) {
  const isAllowed = guardPage(activePage);

    window.ACTIVE_PAGE = activePage;
  document.body.dataset.activePage = activePage;

  const finalContentHtml = isAllowed
    ? contentHtml
    : renderPermissionDenied(title || "هذا التقرير");

    const reportToolbarHtml = shouldShowReportToolbar(activePage)
  ? `
    <section id="reportToolbar" class="topbar report-toolbar">
      <div class="page-heading">
        <span class="page-pill">Filters</span>
        <h2>فلاتر التقرير</h2>
        <p>اختر الفترة الزمنية ثم حدّث التقرير أو صدّر التفاصيل إلى Excel</p>
      </div>

      <div class="header-actions">
        <div class="filter-row">
          <select id="datePreset" class="control date-preset">
            <option value="today">اليوم</option>
            <option value="yesterday">أمس</option>
            <option value="last2">آخر يومين</option>
            <option value="last7">آخر 7 أيام</option>
            <option value="last30">آخر 30 يوم</option>
            <option value="thisMonth">الشهر الحالي</option>
            <option value="custom">تاريخ مخصص</option>
          </select>

          <div id="customDates" class="custom-dates">
            <input class="control" type="date" id="dateFrom" />
            <input class="control" type="date" id="dateTo" />
          </div>

          <button class="run-btn" id="loadBtn">تحديث التقرير</button>
        </div>
      </div>
    </section>
  `
  : "";

  document.body.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-logo">MI</div>
          <div>
            <h1>Management Intelligence</h1>
            <p>Odoo Enterprise 18</p>
          </div>
        </div>

        <nav class="nav">
          <a data-page="dashboard" class="nav-link" href="../dashboard/index.html">
            <span>🏠</span> لوحة الإدارة
          </a>

          <div class="nav-group">⚙️ Administration</div>
          <a data-page="admin-users" class="nav-link" href="../admin/users.html">إدارة المستخدمين</a>
          <a data-page="admin-roles" class="nav-link" href="../admin/roles.html">الأدوار والصلاحيات</a>

          <div class="nav-accordion" data-accordion="branches">
            <button type="button" class="nav-accordion-head" data-accordion-toggle="branches">
              <span>ذكاء الفروع 🏬 Branches</span>
              <span class="nav-accordion-arrow">⌄</span>
            </button>

            <div class="nav-accordion-body">
              <a data-page="branches" class="nav-link" href="../branches/index.html">نظرة عامة على الفروع</a>
              <a data-page="branches-sales" class="nav-link" href="../branches/sales.html">مبيعات الفروع</a>
              <a data-page="branches-stock" class="nav-link" href="../branches/stock.html">مخزون الفروع</a>
              <a data-page="branches-inventory-count" class="nav-link" href="../branches/inventory-count.html">جرد الفرع اللحظي</a>
              <a data-page="branches-replenishment" class="nav-link" href="../branches/replenishment.html"> احتياجات الفروع واعاده الطلب</a>
              <a data-page="branches-comparison" class="nav-link" href="../branches/comparison.html">مقارنة الفروع</a>
            </div>
          </div>


          <div class="nav-accordion" data-accordion="Menu">
            <button type="button" class="nav-accordion-head" data-accordion-toggle="Menu">
              <span>مينو الأسعار والمخزون 🧾 Menu</span>
              <span class="nav-accordion-arrow">⌄</span>
            </button>

            <div class="nav-accordion-body">
              <a data-page="menu-prices" class="nav-link" href="../menu/prices.html">مينو الأسعار والمخزون</a>
            </div>
          </div>

          <div class="nav-accordion" data-accordion="pos">
            <button type="button" class="nav-accordion-head" data-accordion-toggle="pos">
              <span>POS نقاط البيع 🧾</span>
              <span class="nav-accordion-arrow">⌄</span>
            </button>

            <div class="nav-accordion-body">
              <a data-page="pos" class="nav-link" href="../pos/index.html">صفحة تقارير نقاط البيع</a>
              <a data-page="pos-summary" class="nav-link" href="../pos/summary.html">ملخص نقاط البيع</a>
              <a data-page="pos-branch-sales" class="nav-link" href="../pos/branch-sales.html">تحليل أداء المعارض</a>
              <a data-page="pos-cashiers" class="nav-link" href="../pos/cashiers.html">تحليل الكاشيرات</a>
              <a data-page="pos-peak-hours" class="nav-link" href="../pos/peak-hours.html">تحليل ساعات البيع</a>
            </div>
          </div>

          <div class="nav-accordion" data-accordion="Customers">
            <button type="button" class="nav-accordion-head" data-accordion-toggle="Customers">
              <span>العملاء 👥 Customers</span>
              <span class="nav-accordion-arrow">⌄</span>
            </button>

            <div class="nav-accordion-body">
              <a data-page="customer" class="nav-link" href="../customer/index.html">صفحة تقارير العملاء</a>
              <a data-page="customer-pos-phones" class="nav-link" href="../customer/pos-phones.html">أرقام عملاء نقاط البيع</a>
              <a data-page="customer-service-pos-review" class="nav-link" href="../customer/service-pos-review.html">مراجعة خدمات نقاط البيع</a>
            

              <a data-page="customer-review-sms-queue" class="nav-link" href="../customer/review-sms-queue.html">تشغيل رسائل تقييم العملاء</a>
              <a data-page="customer-review-followups" class="nav-link" href="../customer/review-followups.html">متابعة العملاء الغاضبين</a>
              <a data-page="customer-review-sms-dashboard" class="nav-link" href="../customer/review-sms-dashboard.html">لوحة إعدادات رسائل التقييم</a>
              <a data-page="customer-review-coupon" class="nav-link" href="../customer/review-coupon.html">كوبون الشحن المجاني</a>
</div>
          </div>

          <div class="nav-accordion" data-accordion="Production">
            <button type="button" class="nav-accordion-head" data-accordion-toggle="Production">
              <span>الإنتاج والتصنيع 🏭 Production</span>
              <span class="nav-accordion-arrow">⌄</span>
            </button>

            <div class="nav-accordion-body">
              <a data-page="production" class="nav-link" href="../production/index.html">صفحة تقارير الإنتاج</a>
              <a data-page="production-daily" class="nav-link" href="../production/daily.html">إنتاج يومي</a>
              <a data-page="production-report" class="nav-link" href="../production/report.html">إنتاج بالفترة</a>
              <a data-page="production-mo-cost" class="nav-link" href="../production/mo-cost.html">تكلفة أمر التصنيع</a>
            </div>
          </div>

          <div class="nav-accordion" data-accordion="Purchase">
            <button type="button" class="nav-accordion-head" data-accordion-toggle="Purchase">
              <span>المشتريات والموردين 📦 Purchase</span>
              <span class="nav-accordion-arrow">⌄</span>
            </button>

            <div class="nav-accordion-body">
              <a data-page="purchase" class="nav-link" href="../purchase/index.html">صفحة تقارير المشتريات</a>
              <a data-page="purchase-daily" class="nav-link" href="../purchase/daily.html">مشتريات يومي</a>
              <a data-page="purchase-report" class="nav-link" href="../purchase/report.html">مشتريات بالفترة</a>
              <a data-page="purchase-price" class="nav-link" href="../purchase/price-intelligence.html">تغير أسعار الشراء</a>
              <a data-page="purchase-order-control" class="nav-link" href="../purchase/order-control.html">متابعة أوامر الشراء</a>
              <a data-page="purchase-supplier-performance" class="nav-link" href="../purchase/supplier-performance.html">كفاءة الموردين</a>
              <a data-page="purchase-open-orders" class="nav-link" href="../purchase/open-orders.html">أوامر شراء مفتوحة</a>
            </div>
          </div>

          <div class="nav-accordion" data-accordion="Inventory">
            <button type="button" class="nav-accordion-head" data-accordion-toggle="Inventory">
              <span>المخزون والمواقع 🏬 Inventory</span>
              <span class="nav-accordion-arrow">⌄</span>
            </button>

            <div class="nav-accordion-body">
              <a data-page="inventory" class="nav-link" href="../inventory/index.html">داشبورد المخزون</a>
              <a data-page="inventory-intermediate-control" class="nav-link" href="../inventory/intermediate-control.html">رقابة المخازن الوسيطة</a>
              <a data-page="inventory-executive-summary" class="nav-link" href="../inventory/executive-summary.html">ملخص المخزون التنفيذي</a>
              <a data-page="inventory-flow-control" class="nav-link" href="../inventory/flow-control.html">تحكم حركة المخزون</a>
              <a data-page="inventory-movement-intelligence" class="nav-link" href="../inventory/movement-intelligence.html">تحليل حركة المخزون</a>
            </div>
          </div>

          <div class="nav-accordion" data-accordion="Forecast">
            <button type="button" class="nav-accordion-head" data-accordion-toggle="Forecast">
              <span>التوقعات والتارجت 🎯 Forecast</span>
              <span class="nav-accordion-arrow">⌄</span>
            </button>

            <div class="nav-accordion-body">
              <a data-page="forecast" class="nav-link" href="../forecast/index.html">صفحة تقارير التارجت</a>
              <a data-page="forecast-products" class="nav-link" href="../forecast/products.html">منتجات التارجت</a>
              <a data-page="forecast-targets" class="nav-link" href="../forecast/targets.html">إدارة التارجت</a>
              <a data-page="forecast-target-report" class="nav-link" href="../forecast/target-report.html">تقرير التارجت</a>
            </div>
          </div>

          <div class="nav-accordion" data-accordion="ForecastPlanning">
            <button type="button" class="nav-accordion-head" data-accordion-toggle="ForecastPlanning">
              <span>تخطيط الفوركاست 📈 Forecast Planning</span>
              <span class="nav-accordion-arrow">⌄</span>
            </button>

            <div class="nav-accordion-body">
              <a data-page="forecast-planning-achievement" class="nav-link" href="../forecast-planning/index.html">تحقق الفوركاست والمبيعات الفعلية</a>
            </div>
          </div>
        </nav>
      </aside>

      <main class="main">

        <header class="topbar">
          <div class="page-heading">
            <span class="page-pill">Executive Report</span>
            <h2>${title}</h2>
            <p>${subtitle}</p>
          </div>

          <div class="header-actions">
            <div class="filter-row">
              <select id="companySelect" class="control company-control">
              <option value="">اختر الشركة</option>
              </select>

              <div class="user-chip">
                👤 ${getCurrentUser()?.fullName || getCurrentUser()?.username || "User"}
              </div>

              <button class="export-btn" onclick="logout()">تسجيل الخروج</button>
            </div>
          </div>
        </header>
        ${reportToolbarHtml}

        <section class="content">
          ${finalContentHtml}
        </section>
      </main>
    </div>
  `;

  initLayout(activePage);
  setupSidebarAccordions(activePage);
  loadReportExportEngine(activePage);
  loadReportFiltersEngine(activePage);
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
  document.getElementById(targetId).innerHTML = `
    <div class="error-box">
      حدث خطأ أثناء تحميل التقرير<br>
      ${error.message}
    </div>
  `;
}

function setupSidebarAccordions(activePage) {
  const accordions = document.querySelectorAll(".nav-accordion");

  accordions.forEach((accordion) => {
    if (accordion.style.display === "none") return;

    const key = accordion.dataset.accordion;
    const button = accordion.querySelector("[data-accordion-toggle]");
    const hasActiveChild = !!accordion.querySelector(
      `.nav-link[data-page="${activePage}"]`
    );

    const savedState = localStorage.getItem(`sidebar-accordion-${key}`);

    const shouldOpen =
      hasActiveChild || savedState === "open";

    accordion.classList.toggle("open", shouldOpen);

    if (!button) return;

    button.addEventListener("click", () => {
      const isOpen = accordion.classList.toggle("open");

      localStorage.setItem(
        `sidebar-accordion-${key}`,
        isOpen ? "open" : "closed"
      );
    });
  });
}

function getExportAuthToken() {
  if (typeof getAuthToken === "function") {
    return getAuthToken();
  }

  return localStorage.getItem("token") || "";
}

function getCurrentExportParams(activePage) {
  const params = new URLSearchParams(window.location.search);

  const companyId = document.getElementById("companySelect")?.value;
  const dateFrom = document.getElementById("dateFrom")?.value;
  const dateTo = document.getElementById("dateTo")?.value;

  if (companyId) params.set("companyId", companyId);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const branchCode = document.getElementById("branchCode")?.value;
  if (branchCode) params.set("branchCode", branchCode);

  const branchId = document.getElementById("branchId")?.value;
  if (branchId) params.set("branchId", branchId);

  const periodMode = document.getElementById("periodMode")?.value;
  if (periodMode) params.set("periodMode", periodMode);

  const year = document.getElementById("year")?.value;
  if (year) params.set("year", year);

  const monthFrom = document.getElementById("monthFrom")?.value;
  if (monthFrom) params.set("monthFrom", monthFrom);

  const monthTo = document.getElementById("monthTo")?.value;
  if (monthTo) params.set("monthTo", monthTo);

  const channelType = document.getElementById("channelType")?.value;
  if (channelType) params.set("channelType", channelType);

  const channelName = document.getElementById("channelName")?.value;
  if (channelName) params.set("channelName", channelName);

  const productGroup = document.getElementById("productGroup")?.value;
  if (productGroup) params.set("productGroup", productGroup);

  const itemNo = document.getElementById("itemNo")?.value;
  if (itemNo) params.set("itemNo", itemNo);

  const reportCode = getReportCodeForPage(activePage);
  params.set("report", reportCode);

  return params;
}

function getFilenameFromDisposition(headerValue) {
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

async function downloadGenericExcel(activePage) {
  const reportCode = getReportCodeForPage(activePage);

  if (!reportCode) {
    alert("لا يوجد كود تصدير لهذا التقرير");
    return;
  }

  if (!hasPermission(activePage)) {
    alert("ليس لديك صلاحية تصدير هذا التقرير");
    return;
  }

  const button = document.getElementById("exportExcelBtn");

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "جاري تصدير Excel...";
    }

    const params = getCurrentExportParams(activePage);
    const token = getExportAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/exports/excel?${params.toString()}`,
      {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "فشل تصدير Excel");
    }

    const blob = await response.blob();

    const filename =
      getFilenameFromDisposition(
        response.headers.get("Content-Disposition")
      ) || `${reportCode}.xlsx`;

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
    alert(error.message || "حدث خطأ أثناء تصدير Excel");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "⬇ Export Excel";
    }
  }
}

function setupGenericExcelExport(activePage) {
  const button = document.getElementById("exportExcelBtn");
  if (!button) return;

  button.addEventListener("click", () => {
    downloadGenericExcel(activePage);
  });
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

  script.src = "../js/report-filters.js";
  script.dataset.reportFiltersEngine = "true";

  script.onload = () => {
    window.ReportFilters?.setup?.(activePage);
  };

  script.onerror = () => {
    console.warn("Report filters engine failed to load");
  };

  document.body.appendChild(script);
}