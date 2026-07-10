
const MENU_STORAGE_KEY = "mi.professionalMenu.payload";

document.addEventListener("DOMContentLoaded", () => {
  renderProfessionalMenuPage();
});

function renderProfessionalMenuPage() {
  const root = document.getElementById("professionalMenuApp");
  if (!root) return;

  const payload = readMenuPayload();

  if (!payload || !payload.data || !Array.isArray(payload.data.rows) || !payload.data.rows.length) {
    root.innerHTML = `
      <main class="professional-menu-shell">
        <section class="menu-empty">
          <h2>لا توجد بيانات لعرض المينو الاحترافي</h2>
          <p>ارجع إلى صفحة المينو، اضغط "تحديث المينو"، ثم "فتح المينو الاحترافي".</p>
        </section>
      </main>
    `;
    return;
  }

  const state = {
    rows: payload.data.rows || [],
    filters: payload.filters || {},
    data: payload.data || {},
    query: "",
    stockMode: "all",
    viewMode: "all",
    category: "all"
  };

  root.innerHTML = `
    <main class="professional-menu-shell">
      <section class="professional-menu-hero">
        <div class="professional-menu-brand">
          <div>
            <span class="professional-menu-badge">Virginia Olive • Menu Showcase</span>
            <h1>${escapeHtml(buildHeroTitle(payload))}</h1>
            <p>${escapeHtml(buildHeroSubtitle(payload))}</p>
          </div>
          <div class="professional-menu-badge">${escapeHtml(formatGeneratedAt(payload.generatedAt))}</div>
        </div>
        <div class="professional-menu-hero-stats" id="heroStats"></div>
      </section>

      <section class="professional-menu-toolbar">
        <div class="toolbar-grid">
          <input id="customerMenuSearch" class="toolbar-input" type="text" placeholder="ابحث عن منتج / كود / باركود" />
          <select id="customerMenuStock" class="toolbar-select">
            <option value="all">كل الحالات</option>
            <option value="available">المتوفر فقط</option>
            <option value="limited">كمية محدودة</option>
            <option value="out_of_stock">أوت أوف ستوك</option>
          </select>
          <select id="customerMenuMode" class="toolbar-select">
            <option value="all">كل المنتجات</option>
            <option value="discounted">العروض فقط</option>
            <option value="normal">بدون خصومات</option>
          </select>
          <select id="customerMenuCategory" class="toolbar-select"></select>
        </div>
        <div class="toolbar-chips">
          <button class="toolbar-chip active" data-chip="all">الكل</button>
          <button class="toolbar-chip" data-chip="discounted">العروض</button>
          <button class="toolbar-chip" data-chip="available">المتاح</button>
          <button class="toolbar-chip" data-chip="out_of_stock">الأوت أوف ستوك</button>
        </div>
      </section>

      <section class="professional-menu-sections" id="professionalMenuSections"></section>

      <section class="footer-note">
        <strong>ملاحظة:</strong>
        الأسعار والحالة الظاهرة هنا مبنية على اختيارات صفحة المينو الحالية
        (قائمة السعر، قائمة المقارنة، موقع المخزون، وفلاتر المتاح).
      </section>
    </main>
  `;

  bindProfessionalMenuUi(state);
  renderProfessionalMenu(state);
}

function bindProfessionalMenuUi(state) {
  const searchInput = document.getElementById("customerMenuSearch");
  const stockSelect = document.getElementById("customerMenuStock");
  const modeSelect = document.getElementById("customerMenuMode");
  const categorySelect = document.getElementById("customerMenuCategory");

  renderCategoryOptions(state.rows);

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      state.query = String(event.target.value || "").trim().toLowerCase();
      renderProfessionalMenu(state);
    });
  }

  if (stockSelect) {
    stockSelect.addEventListener("change", (event) => {
      state.stockMode = String(event.target.value || "all");
      renderProfessionalMenu(state);
    });
  }

  if (modeSelect) {
    modeSelect.addEventListener("change", (event) => {
      state.viewMode = String(event.target.value || "all");
      renderProfessionalMenu(state);
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener("change", (event) => {
      state.category = String(event.target.value || "all");
      renderProfessionalMenu(state);
    });
  }

  document.querySelectorAll("[data-chip]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-chip]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      const value = button.dataset.chip || "all";
      if (value === "discounted") {
        state.viewMode = "discounted";
        if (modeSelect) modeSelect.value = "discounted";
      } else if (value === "available" || value === "out_of_stock") {
        state.stockMode = value;
        if (stockSelect) stockSelect.value = value;
      } else {
        state.viewMode = "all";
        state.stockMode = "all";
        if (modeSelect) modeSelect.value = "all";
        if (stockSelect) stockSelect.value = "all";
      }

      renderProfessionalMenu(state);
    });
  });
}

function renderCategoryOptions(rows) {
  const select = document.getElementById("customerMenuCategory");
  if (!select) return;

  const categories = Array.from(new Set(
    rows.map((row) => normalizeText(row.posCategoryName) || "منتجات مميزة")
  )).sort((a, b) => a.localeCompare(b, "ar"));

  select.innerHTML = `
    <option value="all">كل المجموعات</option>
    ${categories.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
  `;
}

function renderProfessionalMenu(state) {
  const filteredRows = applyFilters(state.rows, state);
  renderHeroStats(filteredRows, state.rows);
  renderGroupedCards(filteredRows, state.filters);
}

function renderHeroStats(rows, allRows) {
  const hero = document.getElementById("heroStats");
  if (!hero) return;

  const discounted = rows.filter((row) => row.hasDiscount).length;
  const available = rows.filter((row) => row.status === "available").length;
  const avgPrice = rows.length
    ? rows.reduce((sum, row) => sum + safeNumber(row.price), 0) / rows.length
    : 0;
  const totalSave = rows.reduce((sum, row) => sum + safeNumber(row.discountAmount), 0);

  const stats = [
    { label: "منتجات ظاهرة", value: formatNumber(rows.length) },
    { label: "منتجات عليها عروض", value: formatNumber(discounted) },
    { label: "منتجات متوفرة", value: formatNumber(available) },
    { label: "متوسط السعر", value: formatMoney(avgPrice) }
  ];

  if (allRows.length && rows.length !== allRows.length) {
    stats[0].label = "نتيجة الفلاتر";
  }
  if (discounted > 0) {
    stats[1].value = `${formatNumber(discounted)} • وفر ${formatMoney(totalSave)}`;
  }

  hero.innerHTML = stats.map((item) => `
    <div class="hero-stat">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join("");
}

function renderGroupedCards(rows, filters) {
  const container = document.getElementById("professionalMenuSections");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `
      <section class="menu-empty">
        <h3>لا توجد منتجات مطابقة للفلاتر الحالية</h3>
        <p>جرّب تغيير البحث أو حالة المنتج أو مجموعة المنتجات.</p>
      </section>
    `;
    return;
  }

  const groups = new Map();

  rows.forEach((row) => {
    const groupName = normalizeText(row.posCategoryName) || "منتجات مميزة";
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName).push(row);
  });

  container.innerHTML = Array.from(groups.entries()).map(([groupName, groupRows]) => `
    <section class="menu-group">
      <div class="menu-group-header">
        <div>
          <h2>${escapeHtml(groupName)}</h2>
          <p>${escapeHtml(buildGroupHint(groupRows))}</p>
        </div>
        <div class="professional-menu-badge">${escapeHtml(formatNumber(groupRows.length))} منتج</div>
      </div>

      <div class="menu-group-grid">
        ${groupRows.map((row) => buildProductCard(row, filters)).join("")}
      </div>
    </section>
  `).join("");
}

function buildProductCard(row, filters) {
  const statusClass =
    row.status === "available"
      ? "status-available"
      : row.status === "limited"
      ? "status-limited"
      : "status-out";

  const compareBlock = row.hasDiscount
    ? `
        <div class="customer-compare">
          <span class="compare-price">${formatMoney(row.comparePrice)}</span>
          <span class="save-badge">وفر ${formatMoney(row.discountAmount)} • ${formatPercent(row.discountPercent)}</span>
        </div>
      `
    : "";

  const qtyLabel = filters && filters.showQty
    ? `
        <div class="meta-line">
          <span>الكمية المتاحة</span>
          <strong>${escapeHtml(formatNumber(row.availableQty, 2))}</strong>
        </div>
      `
    : "";

  return `
    <article class="customer-product-card ${escapeHtml(row.status || "")}">
      <div class="customer-product-top">
        <div>
          <div class="card-code">${escapeHtml(row.internalCode || row.barcode || "")}</div>
          <h3 class="customer-product-name">${escapeHtml(row.productName || "منتج")}</h3>
        </div>
        <span class="status-pill ${statusClass}">${escapeHtml(row.statusLabel || "—")}</span>
      </div>

      <div class="customer-price-line">
        <div class="customer-price">${formatMoney(row.price)}</div>
      </div>

      ${compareBlock}

      <div class="customer-meta">
        ${qtyLabel}
        <div class="meta-line">
          <span>القسم</span>
          <strong>${escapeHtml(normalizeText(row.posCategoryName) || "منتجات مميزة")}</strong>
        </div>
        <div class="meta-line">
          <span>الحالة</span>
          <strong>${escapeHtml(row.statusLabel || "—")}</strong>
        </div>
      </div>
    </article>
  `;
}

function applyFilters(rows, state) {
  return rows.filter((row) => {
    const haystack = [
      normalizeText(row.productName),
      normalizeText(row.internalCode),
      normalizeText(row.barcode),
      normalizeText(row.posCategoryName)
    ].join(" ").toLowerCase();

    const matchesQuery = !state.query || haystack.includes(state.query);
    const matchesStock = state.stockMode === "all" || String(row.status) === state.stockMode;
    const matchesCategory =
      state.category === "all" ||
      (normalizeText(row.posCategoryName) || "منتجات مميزة") === state.category;

    let matchesMode = true;
    if (state.viewMode === "discounted") matchesMode = Boolean(row.hasDiscount);
    if (state.viewMode === "normal") matchesMode = !row.hasDiscount;

    return matchesQuery && matchesStock && matchesCategory && matchesMode;
  });
}

function readMenuPayload() {
  try {
    const raw = sessionStorage.getItem(MENU_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("professional menu payload parse failed", error);
    return null;
  }
}

function buildHeroTitle(payload) {
  const channelName = normalizeText(payload.data?.channel?.name) || "مينو فيرجينيا";
  return `مينو ${channelName} الاحترافي`;
}

function buildHeroSubtitle(payload) {
  const filters = payload.filters || {};
  const compareEnabled = Boolean(filters.comparePricelistId);
  if (compareEnabled) {
    return "عرض تسويقي احترافي يبرز السعر الحالي والسعر قبل الخصم والمنتجات المتاحة للعرض أمام العميل.";
  }
  return "عرض تسويقي احترافي للمنتجات المتاحة بأسعار قائمة الأسعار المختارة، جاهز للعرض أمام العميل.";
}

function buildGroupHint(rows) {
  const discounted = rows.filter((row) => row.hasDiscount).length;
  const available = rows.filter((row) => row.status === "available").length;
  if (discounted > 0) {
    return `${available} متوفر • ${discounted} منتج عليه خصم`;
  }
  return `${available} منتج متوفر داخل هذه المجموعة`;
}

function formatGeneratedAt(value) {
  if (!value) return "تم التحضير الآن";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "تم التحضير الآن";
    return `تحديث ${date.toLocaleString("ar-EG")}`;
  } catch (_) {
    return "تم التحضير الآن";
  }
}

function formatMoney(value) {
  return `${formatNumber(value, 2)} ج`;
}

function formatPercent(value) {
  return `${formatNumber(value, 2)}%`;
}

function formatNumber(value, digits = 0) {
  const number = safeNumber(value);
  return number.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeText(value) {
  if (value === null || value === undefined || value === false) return "";
  return String(value).trim();
}

function escapeHtml(value) {
  return normalizeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
