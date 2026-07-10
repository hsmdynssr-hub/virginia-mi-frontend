
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
        <section class="empty-block">
          <h2>لا توجد بيانات لعرض المينو الاحترافي</h2>
          <p>ارجع إلى صفحة المينو، اضغط "تحديث المينو" ثم "فتح المينو الاحترافي".</p>
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
        <div class="hero-topbar">
          <span class="brand-chip">Virginia Olive • Menu Showcase</span>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <span class="channel-chip">${escapeHtml(normalizeText(payload.data?.channel?.name) || 'قناة غير محددة')}</span>
            <span class="time-chip">${escapeHtml(formatGeneratedAt(payload.generatedAt))}</span>
          </div>
        </div>

        <div class="hero-main">
          <div class="hero-title">
            <h1>${escapeHtml(buildHeroTitle(payload))}</h1>
            <p>${escapeHtml(buildHeroSubtitle(payload))}</p>
          </div>
          <div class="hero-quick-panel" id="heroQuickPanel"></div>
        </div>

        <div class="hero-stats-grid" id="heroStats"></div>
      </section>

      <section class="toolbar-card">
        <div class="toolbar-head">
          <div>
            <h2>فلترة وعرض المنتجات</h2>
            <p>ابحث بسرعة، اعرض العروض فقط، أو فلتر حسب حالة المنتج والمجموعة.</p>
          </div>
        </div>

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

      <section class="offers-strip" id="featuredOffersBlock"></section>

      <section class="professional-menu-sections" id="professionalMenuSections"></section>

      <section class="footer-note">
        <strong>ملاحظة:</strong>
        هذا العرض التسويقي يعتمد على نفس البيانات التي تم تحميلها من صفحة المينو الأصلية،
        لذلك أي تغيير في الفلاتر أو قائمة الأسعار يتم من الصفحة الأصلية ثم إعادة فتح هذا العرض.
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
        state.stockMode = "all";
        if (modeSelect) modeSelect.value = "discounted";
        if (stockSelect) stockSelect.value = "all";
      } else if (value === "available" || value === "out_of_stock") {
        state.stockMode = value;
        state.viewMode = "all";
        if (stockSelect) stockSelect.value = value;
        if (modeSelect) modeSelect.value = "all";
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
  renderHeroState(filteredRows, state.rows, state.filters);
  renderFeaturedOffers(filteredRows);
  renderGroupedCards(filteredRows, state.filters);
}

function renderHeroState(rows, allRows, filters) {
  const heroStats = document.getElementById("heroStats");
  const quickPanel = document.getElementById("heroQuickPanel");
  if (!heroStats || !quickPanel) return;

  const discounted = rows.filter((row) => row.hasDiscount).length;
  const available = rows.filter((row) => row.status === "available").length;
  const avgPrice = rows.length ? rows.reduce((sum, row) => sum + safeNumber(row.price), 0) / rows.length : 0;
  const totalSave = rows.reduce((sum, row) => sum + safeNumber(row.discountAmount), 0);
  const compareEnabled = rows.some((row) => row.hasDiscount);

  const topOffer = [...rows]
    .filter((row) => row.hasDiscount)
    .sort((a, b) => safeNumber(b.discountAmount) - safeNumber(a.discountAmount))[0];

  quickPanel.innerHTML = `
    <div class="quick-highlight">
      <span class="label">الحالة الحالية</span>
      <strong>${compareEnabled ? 'عرض خصومات وتسويق' : 'عرض أسعار مباشر'}</strong>
    </div>
    <div class="quick-highlight">
      <span class="label">أقوى وفر ظاهر</span>
      <strong>${topOffer ? formatMoney(topOffer.discountAmount) : 'لا يوجد'}</strong>
    </div>
  `;

  const stats = [
    { label: rows.length === allRows.length ? 'منتجات ظاهرة' : 'نتيجة الفلاتر', value: formatNumber(rows.length) },
    { label: 'منتجات عليها عروض', value: formatNumber(discounted) },
    { label: 'منتجات متوفرة', value: formatNumber(available) },
    { label: 'متوسط السعر', value: formatMoney(avgPrice) }
  ];

  heroStats.innerHTML = stats.map((item) => `
    <div class="hero-stat">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join('');

  if (discounted > 0) {
    heroStats.insertAdjacentHTML('beforeend', `
      <div class="hero-stat">
        <span>إجمالي الوفر الظاهر</span>
        <strong>${escapeHtml(formatMoney(totalSave))}</strong>
      </div>
    `);
  }
}

function renderFeaturedOffers(rows) {
  const container = document.getElementById('featuredOffersBlock');
  if (!container) return;

  const offers = [...rows]
    .filter((row) => row.hasDiscount)
    .sort((a, b) => safeNumber(b.discountAmount) - safeNumber(a.discountAmount))
    .slice(0, 3);

  if (!offers.length) {
    container.innerHTML = `
      <div class="offers-header">
        <h2>العروض المميزة</h2>
        <p>لا توجد خصومات حالية في نتائج الفلاتر الحالية.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="offers-header">
      <h2>العروض المميزة</h2>
      <p>أهم المنتجات التي تحمل فرق سعر واضح ويمكن استخدامها مباشرة في العرض أمام العميل.</p>
    </div>
    <div class="offers-cards">
      ${offers.map((row, index) => `
        <article class="offer-card">
          <span class="offer-badge">عرض #${index + 1}</span>
          <h3>${escapeHtml(row.productName || 'منتج')}</h3>
          <div class="offer-prices">
            <span class="offer-now">${formatMoney(row.price)}</span>
            <span class="offer-before">${formatMoney(row.comparePrice)}</span>
            <span class="offer-save">وفر ${formatMoney(row.discountAmount)} • ${formatPercent(row.discountPercent)}</span>
          </div>
          <div class="offer-footer">
            <span>${escapeHtml(normalizeText(row.posCategoryName) || 'منتجات مميزة')}</span>
            <span>${escapeHtml(row.statusLabel || '—')}</span>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderGroupedCards(rows, filters) {
  const container = document.getElementById("professionalMenuSections");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `
      <section class="empty-block">
        <h3>لا توجد منتجات مطابقة للفلاتر الحالية</h3>
        <p>جرّب تغيير البحث أو حالة المنتج أو المجموعة أو نوع العرض.</p>
      </section>
    `;
    return;
  }

  const groups = new Map();
  rows.forEach((row) => {
    const groupName = normalizeText(row.posCategoryName) || "منتجات مميزة";
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(row);
  });

  container.innerHTML = Array.from(groups.entries()).map(([groupName, groupRows]) => `
    <section class="menu-group">
      <div class="menu-group-head">
        <div class="menu-group-title">
          <h2>${escapeHtml(groupName)}</h2>
          <p>${escapeHtml(buildGroupHint(groupRows))}</p>
        </div>
        <span class="group-chip">${escapeHtml(formatNumber(groupRows.length))} منتج</span>
      </div>
      <div class="menu-group-grid">
        ${groupRows.map((row) => buildProductCard(row, filters)).join('')}
      </div>
    </section>
  `).join('');
}

function buildProductCard(row, filters) {
  const statusClass = row.status === 'available' ? 'status-available' : row.status === 'limited' ? 'status-limited' : 'status-out';
  const cardClass = normalizeText(row.status) || '';
  const qtyBlock = filters && filters.showQty ? `
    <div class="meta-line">
      <span>الكمية المتاحة</span>
      <strong>${escapeHtml(formatNumber(row.availableQty, 2))}</strong>
    </div>
  ` : '';

  const compareBlock = row.hasDiscount ? `
    <div class="compare-row">
      <span class="compare-before">${formatMoney(row.comparePrice)}</span>
      <span class="compare-save">وفر ${formatMoney(row.discountAmount)} • ${formatPercent(row.discountPercent)}</span>
    </div>
  ` : '';

  return `
    <article class="customer-product-card ${escapeHtml(cardClass)}">
      <div class="card-top">
        <div>
          <div class="card-code">${escapeHtml(row.internalCode || row.barcode || '')}</div>
          <h3 class="customer-product-name">${escapeHtml(row.productName || 'منتج')}</h3>
        </div>
        <span class="status-pill ${statusClass}">${escapeHtml(row.statusLabel || '—')}</span>
      </div>

      <div class="price-main">
        <div class="price-now">${formatMoney(row.price)}</div>
      </div>

      ${compareBlock}

      <div class="card-meta">
        ${qtyBlock}
        <div class="meta-line">
          <span>المجموعة</span>
          <strong>${escapeHtml(normalizeText(row.posCategoryName) || 'منتجات مميزة')}</strong>
        </div>
        <div class="meta-line">
          <span>الحالة</span>
          <strong>${escapeHtml(row.statusLabel || '—')}</strong>
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
    ].join(' ').toLowerCase();

    const matchesQuery = !state.query || haystack.includes(state.query);
    const matchesStock = state.stockMode === 'all' || String(row.status) === state.stockMode;
    const matchesCategory = state.category === 'all' || (normalizeText(row.posCategoryName) || 'منتجات مميزة') === state.category;

    let matchesMode = true;
    if (state.viewMode === 'discounted') matchesMode = Boolean(row.hasDiscount);
    else if (state.viewMode === 'normal') matchesMode = !row.hasDiscount;

    return matchesQuery && matchesStock && matchesCategory && matchesMode;
  });
}

function readMenuPayload() {
  try {
    const raw = sessionStorage.getItem(MENU_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('professional menu payload parse failed', error);
    return null;
  }
}

function buildHeroTitle(payload) {
  const channelName = normalizeText(payload.data?.channel?.name) || 'مينو فيرجينيا';
  return `مينو ${channelName} الاحترافي`;
}

function buildHeroSubtitle(payload) {
  const compareEnabled = Boolean(payload.filters?.comparePricelistId);
  return compareEnabled
    ? 'عرض تسويقي احترافي يبرز السعر الحالي والسعر قبل الخصم، مع إظهار المنتجات المتاحة والخصومات بشكل واضح أمام العميل.'
    : 'عرض تسويقي احترافي لأسعار المنتجات المتاحة، مناسب للعرض المباشر في الصالة أو لخدمة العملاء.';
}

function buildGroupHint(rows) {
  const available = rows.filter((row) => row.status === 'available').length;
  const discounted = rows.filter((row) => row.hasDiscount).length;
  return discounted > 0
    ? `${available} متوفر • ${discounted} منتج عليه خصم`
    : `${available} منتج متوفر داخل هذه المجموعة`;
}

function formatGeneratedAt(value) {
  try {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return 'تحديث الآن';
    return `تحديث ${date.toLocaleString('ar-EG')}`;
  } catch (_) {
    return 'تحديث الآن';
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
  return number.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeText(value) {
  if (value === null || value === undefined || value === false) return '';
  return String(value).trim();
}

function escapeHtml(value) {
  return normalizeText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
