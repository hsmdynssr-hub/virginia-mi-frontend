document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "مينو الأسعار والمخزون",
    "أسعار من قوائم أسعار Odoo ومخزون من مواقع الصالة والساحل والأون لاين.",
    "menu-prices",
    buildMenuPricesContent()
  );

  bindMenuPricesEvents();
  renderMenuInitialState();
});

let menuDiscovery = {
  channels: [],
  pricelists: [],
  locations: [],

  posCategories: []
};

let lastMenuFilters = null;

function buildMenuPricesContent() {
  return `
    <div class="report-ui-page menu-prices-page">
      <section class="report-card">
        <div class="report-card-head">
          <h2>فلاتر المينو</h2>
          <p>
            اختار الشركة من الهيدر، ثم القناة وقائمة الأسعار وموقع المخزون.
            المينو لا يتم تحميله تلقائيًا إلا عند الضغط على تحديث المينو.
          </p>
        </div>

        <div class="menu-filter-grid">
          <label class="report-field">
            القناة / المعرض
            <select id="menuChannel" class="report-select">
              <option value="">اختر الشركة أولًا</option>
            </select>
          </label>

          <label class="report-field">
            قائمة السعر الحالي
            <select id="menuPricelist" class="report-select">
              <option value="">اختر الشركة أولًا</option>
            </select>
          </label>

          <label class="report-field">
            قائمة السعر قبل الخصم
            <select id="menuComparePricelist" class="report-select">
              <option value="">بدون سعر قبل الخصم</option>
            </select>
          </label>

          <label class="report-field">
            موقع المخزون
            <select id="menuLocation" class="report-select">
              <option value="">اختر الشركة أولًا</option>
            </select>
          </label>

          <label class="report-field">
            طريقة العرض
            <select id="menuViewMode" class="report-select">
              <option value="classic">Classic جدول</option>
              <option value="dynamic">Dynamic كروت</option>
            </select>
          </label>

          <label class="report-field">
            فئة نقطة البيع
            <select id="menuPosCategory" class="report-select">
              <option value="">كل فئات نقاط البيع</option>
            </select>
          </label>

          <label class="report-field">
            الحالة
            <select id="menuStatus" class="report-select">
              <option value="all">كل المنتجات</option>
              <option value="available">متوفر</option>
              <option value="limited">كمية محدودة</option>
              <option value="out_of_stock">أوت أوف ستوك</option>
            </select>
          </label>

          <label class="report-field">
            حد الكمية المحدودة
            <input id="limitedThreshold" class="report-input" type="number" min="1" value="5" />
          </label>

          <label class="report-field">
            بحث عن منتج
            <input id="menuSearch" class="report-input" type="text" placeholder="اسم / كود / باركود" />
          </label>

          <label class="report-field">
            عدد المنتجات
            <input id="menuLimit" class="report-input" type="number" min="20" max="1000" value="300" />
          </label>

          <label class="menu-check-field">
            <input id="menuShowQty" type="checkbox" checked />
            عرض الكمية الرقمية
          </label>

          <label class="menu-check-field">
            <input id="menuOnlyPosProducts" type="checkbox" checked />
            منتجات نقاط البيع فقط
          </label>

          <button id="loadMenuBtn" type="button" class="report-btn-primary">
            تحديث المينو
          </button>

          <button id="exportMenuExcelBtn" type="button" class="report-btn-secondary">
            تصدير Excel
          </button>
        </div>
      </section>

      <section id="menuLoadingBox" class="hidden"></section>
      <section id="menuErrorBox" class="hidden"></section>

      <section id="menuPendingBox" class="report-card">
        <div class="report-card-head">
          <h2>المينو لم يتم تحميله بعد</h2>
          <p>اختار الشركة، ثم القناة وقائمة الأسعار وموقع المخزون، وبعدها اضغط تحديث المينو.</p>
        </div>
      </section>

      <section id="menuKpis" class="report-kpi-grid"></section>

      <section id="menuOutputSection" class="report-card menu-output-section hidden">
        <div class="report-card-head">
          <h2 id="menuOutputTitle">قائمة المنتجات</h2>
          <p id="menuOutputHint">السعر من قائمة الأسعار والكمية من موقع المخزون المختار.</p>
        </div>
        <div id="menuOutput"></div>
      </section>

      <section class="report-grid-2 menu-output-section hidden">
        <div class="report-card">
          <div class="report-card-head">
            <h2>ملاحظات الاحتساب</h2>
          </div>
          <div id="menuNotes" class="report-analysis"></div>
        </div>

        <div class="report-card">
          <div class="report-card-head">
            <h2>تنبيه إداري</h2>
          </div>
          <div class="report-analysis">
            <p>
              لو قائمة الأسعار لا تحتوي قاعدة مناسبة للمنتج، يستخدم النظام سعر البيع من كارت الصنف تلقائيًا.
              هذا هو منطق الـ Default/Public price في Odoo.
            </p>
          </div>
        </div>
      </section>
    </div>
  `;
}

function bindMenuPricesEvents() {
  const companySelect = document.getElementById("companySelect");
  const loadBtn = document.getElementById("loadMenuBtn");
  const channelSelect = document.getElementById("menuChannel");
  const viewMode = document.getElementById("menuViewMode");
  const exportBtn = document.getElementById("exportMenuExcelBtn");

  if (companySelect) {
    companySelect.addEventListener("change", async () => {
      await loadMenuDiscovery();
      renderMenuFilterChangedState();
    });
  }

  if (loadBtn) {
    loadBtn.addEventListener("click", loadMenuReport);
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", exportMenuExcel);
  }

  if (channelSelect) {
    channelSelect.addEventListener("change", applySelectedChannelDefaults);
  }

  [
    "menuPricelist",
    "menuComparePricelist",
    "menuLocation",
    "menuPosCategory",
    "menuStatus",
    "limitedThreshold",
    "menuSearch",
    "menuLimit",
    "menuShowQty",
    "menuOnlyPosProducts"
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener("change", renderMenuFilterChangedState);
  });

  if (viewMode) {
    viewMode.addEventListener("change", () => {
      renderMenuFilterChangedState();
    });
  }

  window.loadMenuPrices = loadMenuReport;
  window.loadMenuDiscovery = loadMenuDiscovery;
  window.exportMenuExcel = exportMenuExcel;
}

function renderMenuInitialState() {
  hideMenuLoading();
  clearMenuError();
  clearMenuReport();
  showPending("المينو لم يتم تحميله بعد", "اختار الشركة، ثم اضغط تحديث المينو بعد تحديد القناة والمصادر.");
}

function renderMenuFilterChangedState() {
  hideMenuLoading();
  clearMenuError();
  clearMenuReport();
  showPending("تم تغيير الفلاتر", "اضغط تحديث المينو لتطبيق الاختيارات الجديدة.");
}

async function loadMenuDiscovery() {
  const companyId = getCompanyId();

  if (!companyId) {
    menuDiscovery = {
      channels: [],
      pricelists: [],
      locations: [],
    
      posCategories: []
    };
    renderDiscoveryOptions();
    return;
  }

  try {
    const response = await apiGet("/menu/discovery", { companyId });
    const data = response.data || {};

    menuDiscovery = {
      channels: data.channels || [],
      pricelists: data.pricelists || [],
      locations: data.locations || [],
      posCategories: data.posCategories || []
    };

    renderDiscoveryOptions();
  } catch (error) {
    console.error(error);
    showMenuError(error);
  }
}

function renderDiscoveryOptions() {
  renderChannelOptions();
  renderPricelistOptions();
  renderLocationOptions();
  renderPosCategoryOptions();
  applySelectedChannelDefaults();
}

function renderChannelOptions() {
  const select = document.getElementById("menuChannel");
  if (!select) return;

  if (!menuDiscovery.channels.length) {
    select.innerHTML = `<option value="">اختر الشركة أولًا</option>`;
    return;
  }

  select.innerHTML = menuDiscovery.channels
    .map((channel) => `
      <option value="${escapeHtml(channel.code)}">
        ${escapeHtml(channel.name)}${channel.isMapped ? "" : " - يحتاج ربط"}
      </option>
    `)
    .join("");
}

function renderPricelistOptions() {
  const currentSelect = document.getElementById("menuPricelist");
  const compareSelect = document.getElementById("menuComparePricelist");

  if (!currentSelect && !compareSelect) return;

  if (!menuDiscovery.pricelists.length) {
    if (currentSelect) currentSelect.innerHTML = `<option value="">لا توجد قوائم أسعار</option>`;
    if (compareSelect) compareSelect.innerHTML = `<option value="">لا توجد قوائم أسعار</option>`;
    return;
  }

  const options = menuDiscovery.pricelists
    .map((item) => `
      <option value="${Number(item.id)}">
        ${escapeHtml(item.name)}
      </option>
    `)
    .join("");

  if (currentSelect) {
    currentSelect.innerHTML = `
      <option value="">اختر قائمة السعر الحالي</option>
      ${options}
    `;
  }

  if (compareSelect) {
    compareSelect.innerHTML = `
      <option value="">بدون سعر قبل الخصم</option>
      ${options}
    `;
  }
}

function renderLocationOptions() {
  const select = document.getElementById("menuLocation");
  if (!select) return;

  if (!menuDiscovery.locations.length) {
    select.innerHTML = `<option value="">لا توجد مواقع مخزون</option>`;
    return;
  }

  select.innerHTML = `
    <option value="">اختر موقع المخزون</option>
    ${menuDiscovery.locations
      .map((item) => `
        <option value="${Number(item.id)}">
          ${escapeHtml(item.completeName || item.name)}
        </option>
      `)
      .join("")}
  `;
}


function renderPosCategoryOptions() {
  const select = document.getElementById("menuPosCategory");
  if (!select) return;

  select.innerHTML = `
    <option value="">كل فئات نقاط البيع</option>
    ${menuDiscovery.posCategories
      .map((item) => `
        <option value="${Number(item.id)}">
          ${escapeHtml(item.name || item.rawName)}
        </option>
      `)
      .join("")}
  `;
}

function applySelectedChannelDefaults() {
  const channelCode = document.getElementById("menuChannel")?.value;
  const channel = menuDiscovery.channels.find((item) => item.code === channelCode);

  if (!channel) return;

  const pricelistSelect = document.getElementById("menuPricelist");
  const locationSelect = document.getElementById("menuLocation");
  const showQty = document.getElementById("menuShowQty");
  const posCategorySelect = document.getElementById("menuPosCategory");
  const threshold = document.getElementById("limitedThreshold");

  if (pricelistSelect && channel.pricelistId) {
    pricelistSelect.value = String(channel.pricelistId);
  }

  if (locationSelect && channel.locationId) {
    locationSelect.value = String(channel.locationId);
  }

  if (showQty) {
    showQty.checked = channel.showQty !== false;
  }

  if (posCategorySelect && Array.isArray(channel.posCategoryIds) && channel.posCategoryIds.length === 1) {
    posCategorySelect.value = String(channel.posCategoryIds[0]);
  }

  if (threshold && channel.limitedThreshold) {
    threshold.value = channel.limitedThreshold;
  }

  renderMenuFilterChangedState();
}

function collectMenuFilters() {
  const companyId = getCompanyId();
  const channelCode = document.getElementById("menuChannel")?.value || "";
  const pricelistId = document.getElementById("menuPricelist")?.value || "";
  const comparePricelistId = document.getElementById("menuComparePricelist")?.value || "";
  const locationId = document.getElementById("menuLocation")?.value || "";
  const posCategoryId = document.getElementById("menuPosCategory")?.value || "";

  if (!companyId) throw new Error("اختار الشركة من الهيدر أولًا.");
  if (!channelCode) throw new Error("اختار القناة / المعرض.");
  if (!pricelistId) throw new Error("اختار قائمة الأسعار.");
  if (!locationId) throw new Error("اختار موقع المخزون.");

  return {
    companyId,
    channelCode,
    pricelistId,
    comparePricelistId,
    locationId,
    posCategoryId,
    onlyPosProducts: document.getElementById("menuOnlyPosProducts")?.checked !== false,
    status: document.getElementById("menuStatus")?.value || "all",
    search: document.getElementById("menuSearch")?.value || "",
    limitedThreshold: document.getElementById("limitedThreshold")?.value || 5,
    limit: document.getElementById("menuLimit")?.value || 300,
    viewMode: document.getElementById("menuViewMode")?.value || "classic",
    showQty: document.getElementById("menuShowQty")?.checked !== false
  };
}

async function loadMenuReport() {
  try {
    const filters = collectMenuFilters();

    hidePending();
    clearMenuError();
    clearMenuReport();
    showMenuLoading("جاري تحميل المينو من Odoo...");

    const response = await apiGet("/menu/prices", filters);
    const data = response.data || {};

    hideMenuLoading();
    lastMenuFilters = filters;
    renderMenuReport(data, filters);
  } catch (error) {
    hideMenuLoading();
    showMenuError(error);
  }
}


async function exportMenuExcel() {
  const button = document.getElementById("exportMenuExcelBtn");

  try {
    const filters = lastMenuFilters || collectMenuFilters();

    if (button) {
      button.disabled = true;
      button.textContent = "جاري تصدير Excel...";
    }

    await apiDownload(
      "/exports/excel",
      {
        report: "menu.prices",
        ...filters
      },
      "menu-prices.xlsx"
    );
  } catch (error) {
    console.error(error);
    showMenuError(error);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "تصدير Excel";
    }
  }
}

function formatPriceSource(value) {
  const source = String(value || "").trim();

  if (source === "product_card_list_price") return "سعر كارت الصنف";
  if (source.startsWith("pricelist.item.fixed")) return "قاعدة سعر ثابت";
  if (source.startsWith("pricelist.item.percentage")) return "قاعدة خصم نسبة";
  if (source.startsWith("pricelist.item.formula")) return "قاعدة معادلة سعر";
  if (source === "pricelist._get_product_price") return "دالة Odoo";
  if (source === "pricelist.price_get") return "دالة Odoo قديمة";
  if (source === "fallback_list_price") return "سعر كارت الصنف";

  return source || "-";
}

function renderMenuReport(data, filters) {
  const rows = data.rows || [];
  const summary = data.summary || {};

  hidePending();
  showMenuSections();

  ReportUI.renderKpis("menuKpis", [
    {
      title: "منتجات ظاهرة",
      value: ReportUI.number(summary.displayedProductsCount),
      hint: `من أصل ${ReportUI.number(summary.loadedProductsCount)} منتج محمل`
    },
    {
      title: "منتجات POS",
      value: ReportUI.number(summary.posProductsCount),
      hint: "منتجات متاحة في نقاط البيع ضمن الفلاتر"
    },
    {
      title: "متوفر",
      value: ReportUI.number(summary.availableCount),
      hint: "كمية أعلى من حد الكمية المحدودة"
    },
    {
      title: "كمية محدودة",
      value: ReportUI.number(summary.limitedCount),
      hint: "كمية أكبر من صفر وأقل من أو تساوي الحد"
    },
    {
      title: "أوت أوف ستوك",
      value: ReportUI.number(summary.outOfStockCount),
      hint: "الكمية المتاحة صفر أو أقل"
    },
    {
      title: "إجمالي الكمية المتاحة",
      value: ReportUI.number(summary.totalAvailableQty, 2),
      hint: filters.showQty ? "معروضة في المينو" : "غير معروضة في الكروت للعميل"
    },
    {
      title: "متوسط السعر الحالي",
      value: ReportUI.money(summary.averagePrice),
      hint: "متوسط أسعار المنتجات الظاهرة"
    },
    {
      title: "منتجات عليها خصم",
      value: ReportUI.number(summary.discountedProductsCount),
      hint: "سعر المقارنة أكبر من السعر الحالي"
    },
    {
      title: "إجمالي الوفر",
      value: ReportUI.money(summary.totalDiscountAmount),
      hint: "إجمالي فرق السعر للمنتجات الظاهرة"
    },
    {
      title: "متوسط الخصم",
      value: ReportUI.percent(summary.averageDiscountPercent),
      hint: "متوسط نسبة الخصم على المنتجات المخفضة"
    },
    {
      title: "أسعار من كارت الصنف",
      value: ReportUI.number(summary.productCardPriceCount + (summary.compareProductCardPriceCount || 0)),
      hint: "قوائم أسعار بدون قاعدة مناسبة، فتم استخدام سعر البيع من كارت الصنف"
    }
  ]);

  document.getElementById("menuOutputTitle").textContent =
    filters.viewMode === "dynamic"
      ? "عرض Dynamic للمينو"
      : "عرض Classic للمينو";

  document.getElementById("menuOutputHint").textContent =
    `${data.channel?.name || "القناة"} - السعر الحالي من قائمة الأسعار المختارة، وسعر المقارنة اختياري لحساب الخصم.`;

  if (filters.viewMode === "dynamic") {
    renderDynamicMenu(rows, filters);
  } else {
    renderClassicMenu(rows, filters);
  }

  ReportUI.renderNotes("menuNotes", data.notes || []);
}

function renderClassicMenu(rows, filters) {
  const columns = [
    {
      key: "productName",
      label: "المنتج",
      width: "260px",
      format: (value, row) => `
        <div class="menu-product-cell">
          <strong>${escapeHtml(value)}</strong>
          <small>${escapeHtml(row.internalCode || row.barcode || "-")}</small>
        </div>
      `
    },
    {
      key: "posCategoryName",
      label: "فئة نقطة البيع",
      width: "210px",
      format: (value) => value || "-"
    },
    {
      key: "price",
      label: "السعر الحالي",
      width: "120px",
      className: "report-money",
      format: (value) => ReportUI.money(value)
    },
    {
      key: "comparePrice",
      label: "السعر قبل الخصم",
      width: "140px",
      className: "report-money",
      format: (value) => value ? ReportUI.money(value) : "-"
    },
    {
      key: "discountAmount",
      label: "الوفر",
      width: "120px",
      className: "report-money",
      format: (value) => value ? ReportUI.money(value) : "-"
    },
    {
      key: "discountPercent",
      label: "نسبة الخصم",
      width: "120px",
      format: (value) => value ? ReportUI.percent(value) : "-"
    },
    {
      key: "availableQty",
      label: "الكمية المتاحة",
      width: "130px",
      format: (value) => filters.showQty ? ReportUI.number(value, 2) : "مخفية"
    },
    {
      key: "statusLabel",
      label: "الحالة",
      width: "140px",
      format: (value, row) => ReportUI.statusPill(value, row.statusType)
    },
    {
      key: "priceSource",
      label: "مصدر السعر",
      width: "170px",
      format: (value) => ReportUI.statusPill(
        formatPriceSource(value),
        value === "product_card_list_price" || value === "fallback_list_price" ? "info" : "good"
      )
    }
  ];

  ReportUI.renderTable("menuOutput", {
    rows,
    columns,
    minWidth: 1040,
    emptyMessage: "لا توجد منتجات مطابقة للفلاتر."
  });
}

function renderDynamicMenu(rows, filters) {
  const output = document.getElementById("menuOutput");
  if (!output) return;

  if (!rows.length) {
    output.innerHTML = `<div class="report-empty">لا توجد منتجات مطابقة للفلاتر.</div>`;
    return;
  }

  output.innerHTML = `
    <div class="menu-card-grid">
      ${rows.map((row) => `
        <article class="menu-item-card ${escapeHtml(row.status)}">
          <div class="menu-item-top">
            <span>${escapeHtml(row.posCategoryName || "منتج POS")}</span>
            ${ReportUI.statusPill(row.statusLabel, row.statusType)}
          </div>

          <h3>${escapeHtml(row.productName)}</h3>

          <div class="menu-price-line">
            <strong>${ReportUI.money(row.price)}</strong>
            <small>${escapeHtml(row.internalCode || row.barcode || "")}</small>
          </div>

          ${row.hasDiscount
            ? `<div class="menu-discount-line">
                <span class="menu-old-price">${ReportUI.money(row.comparePrice)}</span>
                <span class="menu-save-badge">وفر ${ReportUI.money(row.discountAmount)} - ${ReportUI.percent(row.discountPercent)}</span>
              </div>`
            : ""}

          <div class="menu-stock-line">
            ${filters.showQty
              ? `الكمية المتاحة: <b>${ReportUI.number(row.availableQty, 2)}</b>`
              : "الكمية الرقمية مخفية"}
          </div>

          ${row.priceSource === "product_card_list_price" || row.priceSource === "fallback_list_price"
            ? `<div class="menu-warning menu-info">السعر من كارت الصنف</div>`
            : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function showMenuSections() {
  document.querySelectorAll(".menu-output-section").forEach((section) => {
    section.classList.remove("hidden");
  });
}

function hideMenuSections() {
  document.querySelectorAll(".menu-output-section").forEach((section) => {
    section.classList.add("hidden");
  });
}

function clearMenuReport() {
  document.getElementById("menuKpis").innerHTML = "";
  document.getElementById("menuOutput").innerHTML = "";
  document.getElementById("menuNotes").innerHTML = "";
  hideMenuSections();
}

function showPending(title, message) {
  const box = document.getElementById("menuPendingBox");
  if (!box) return;

  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="report-card-head">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function hidePending() {
  document.getElementById("menuPendingBox")?.classList.add("hidden");
}

function showMenuLoading(message) {
  const box = document.getElementById("menuLoadingBox");
  if (!box) return;
  box.className = "report-loading";
  box.textContent = message;
}

function hideMenuLoading() {
  const box = document.getElementById("menuLoadingBox");
  if (!box) return;
  box.className = "hidden";
  box.textContent = "";
}

function showMenuError(error) {
  const box = document.getElementById("menuErrorBox");
  if (!box) return;
  box.className = "report-error";
  box.textContent = error?.message || String(error || "حدث خطأ أثناء تحميل المينو.");
}

function clearMenuError() {
  const box = document.getElementById("menuErrorBox");
  if (!box) return;
  box.className = "hidden";
  box.textContent = "";
}

function escapeHtml(value) {
  if (window.ReportUI?.escapeHtml) {
    return window.ReportUI.escapeHtml(value);
  }

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
