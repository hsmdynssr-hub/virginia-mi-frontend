'use strict';
(() => {
  const params = new URLSearchParams(location.search);
  const root = document.getElementById('professionalMenuApp');
  const alias = root?.dataset.menuList;
  if (!params.has('menu') && !alias) return;
  const token = params.get('menu') || '';
  // Public copy is localized here, including dynamic numbers and messages. The
  // generic exact-match observer must not reinterpret authoritative product names.
  root.setAttribute('data-mi-no-translate', 'true');
  const english = window.MI18n?.getLanguage() === 'en';
  const premium = ['de', 'online'].includes(alias) && window.VirginiaMenu;
  const online = alias === 'online';
  const assetBase = new URL('../', document.currentScript.src).href + 'menu/assets/';
  const locale = english ? 'en-EG' : 'ar-EG';
  const translations = {
    'فيرجينيا': 'Virginia', 'فيرجينيا — المنيو': 'Virginia — product menu',
    'منيو فيرجينيا': 'Virginia menu', 'قائمة الأسعار': 'Price list',
    'تصفّح منتجاتنا، واختر ما يناسبك.': 'Explore our products and find your favourites.',
    'آخر تحديث:': 'Last updated:', 'بحث': 'Search', 'البحث في المنيو': 'Search the menu',
    'ما الذي تبحث عنه؟': 'What are you looking for?', 'التصنيف': 'Category',
    'كل التصنيفات': 'All categories', 'التوافر': 'Availability', 'كل المنتجات': 'All products',
    'المتوفر': 'Available', 'غير المتوفر': 'Unavailable', 'تصفّح المنتجات': 'Browse products',
    'المنتجات': 'Products', 'متوفر': 'Available', 'كمية محدودة': 'Limited stock',
    'غير متوفر': 'Out of stock', 'التوافر يحتاج تأكيدًا': 'Availability needs confirmation',
    'الصورة غير متاحة': 'Image unavailable', 'سعر البيع:': 'Regular price:',
    'سعر البيع': 'Selling price', 'سعر بيع المصنع': 'Factory showroom price',
    'عند الشراء من الصالة': 'when you buy at the showroom',
    'نعرض آخر تحديث متاح. الأسعار والتوافر يحتاجان تأكيدًا.': 'Showing the last available update. Please confirm prices and availability.',
    'المنيو غير متاح حاليًا': 'The menu is currently unavailable',
    'لحظة، نحضّر لك المنيو': 'Getting your menu ready',
    'تعذر تحميل المنتجات. تأكد من اتصالك وحاول مرة أخرى.': 'Products could not be loaded. Check your connection and try again.',
    'جارٍ تحميل المنتجات والأسعار…': 'Loading products and prices…',
    'إعادة المحاولة': 'Try again', 'لا توجد منتجات مطابقة لاختياراتك.': 'No products match your selection.',
    'لا توجد منتجات للعرض حاليًا.': 'There are no products to display right now.',
    'جرّب اسمًا آخر أو اعرض كل المنتجات.': 'Try another name or view all products.',
    'يمكنك زيارة المنيو مرة أخرى لاحقًا.': 'Please check the menu again later.',
    'عرض كل المنتجات': 'View all products', 'اسم المنتج': 'Product name', 'إغلاق': 'Close',
    'تكبير الصورة': 'Enlarge image', 'صورة المنتج': 'Product image',
    'تعذر عرض الصورة. حاول مرة أخرى.': 'The image could not be displayed. Please try again.'
  };
  const t = value => english ? (translations[value] || value) : value;
  const productName = row => english ? (row.productNameEn || row.productName) : row.productName;
  const nameParts = value => {
    const match = String(value || '').match(/^\s*\[([^\]\r\n]+)\]\s*([\s\S]+)$/);
    return match ? { code: match[1].trim(), name: match[2].trim() } : { code: '', name: String(value || '') };
  };
  const categoryName = row => english ? (row.categoryNameEn || row.categoryName) : row.categoryName;
  function localizeUI(scope = root) {
    if (!english) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('[data-menu-source]')) continue;
      const original = node.nodeValue, clean = original.trim();
      if (translations[clean]) node.nodeValue = original.replace(clean, translations[clean]);
    }
    scope.querySelectorAll('[placeholder],[aria-label]').forEach(element => {
      for (const attribute of ['placeholder', 'aria-label']) if (element.hasAttribute(attribute)) element.setAttribute(attribute, t(element.getAttribute(attribute)));
    });
  }
  document.body.className = 'customer-menu-body';
  const state = { data: null, query: '', category: '', failed: false };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const format = value => Number(value).toLocaleString(locale, { maximumFractionDigits: 2 });
  const apiBase = ['localhost', '127.0.0.1'].includes(location.hostname) ? location.origin + '/api' : 'https://api.mi.virginiaolive.com/api';
  const menuImageUrl=value=>/^https:\/\//.test(value||'')?value:/^\/public-menu\/images\/[a-f0-9-]{36}$/.test(value||'')?apiBase+value:'';
  const icon = name => {
    const paths = {
      search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
      spark: '<path d="m12 2 2.8 6.3L22 12l-7.2 3.7L12 22l-2.8-6.3L2 12l7.2-3.7L12 2Z"/>',
      image: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  };
  const categoryIcon = id => {
    const icons = {
      '': '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
      olive: '<ellipse cx="9" cy="15" rx="4" ry="6" transform="rotate(-30 9 15)"/><path d="M11 10Q12 3 21 3Q20 10 11 10Z"/>',
      tahini: '<path d="M3 12h18q-1 9-9 9T3 12ZM12 12V3m-4 5 4 4 4-4"/>',
      coconut: '<path d="M3 13a9 9 0 0 0 18 0M3 13a9 4 0 0 1 18 0 9 4 0 0 1-18 0Z"/>',
      dates: '<ellipse cx="8" cy="14" rx="4" ry="7" transform="rotate(25 8 14)"/><ellipse cx="17" cy="10" rx="4" ry="7" transform="rotate(25 17 10)"/>',
      pickles: '<rect x="6" y="6" width="12" height="15" rx="3"/><path d="M5 6h14M8 3h8M9 12h6m-6 4h6"/>',
      herbs: '<path d="M4 20Q5 4 20 4Q20 19 4 20Zm0 0 11-11"/>',
      soap: '<rect x="3" y="10" width="18" height="11" rx="4"/><circle cx="8" cy="5" r="2"/><circle cx="16" cy="4" r="1.5"/>',
      oils: '<path d="M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/>',
      hair: '<rect x="7" y="8" width="10" height="13" rx="3"/><path d="M10 8V4h4v4m-2-4V2h5"/>'
    };
    return '<svg class="material-category-icon" viewBox="0 0 24 24" aria-hidden="true">'+(icons[id] || icons.herbs)+'</svg>';
  };
  const brand = () => `<div class="customer-menu-topline"><a class="customer-menu-brand" href="${escape(location.pathname + location.search)}" aria-label="فيرجينيا — المنيو">${premium ? `<img src="${assetBase}logo.png" width="160" height="66" alt="Virginia · فيرجينيا">` : '<span>VIRGINIA</span><small>فيرجينيا</small>'}</a><button type="button" class="customer-menu-language" data-mi-language-toggle="true" aria-label="Switch to English">EN</button></div>`;
  const missingImage = () => `<span class="customer-menu-image-fallback">${icon('image')}<span>الصورة غير متاحة</span></span>`;
  function render() {
    const focused = root.contains(document.activeElement) ? document.activeElement : null;
    const focus = focused?.id ? { id: focused.id, start: focused.selectionStart, end: focused.selectionEnd } : null;
    if (!state.data) {
      root.innerHTML = `<main class="customer-menu-shell">${brand()}<section class="customer-menu-initial" aria-busy="${!state.failed}"><span class="customer-menu-seal">${icon('spark')}</span><h1>${state.failed ? 'المنيو غير متاح حاليًا' : 'لحظة، نحضّر لك المنيو'}</h1><p role="status">${state.failed ? 'تعذر تحميل المنتجات. تأكد من اتصالك وحاول مرة أخرى.' : 'جارٍ تحميل المنتجات والأسعار…'}</p>${state.failed ? '<button type="button" class="customer-menu-reset" id="customerRetry">إعادة المحاولة</button>' : '<div class="customer-menu-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>'}</section></main>`;
      root.querySelector('#customerRetry')?.addEventListener('click', () => { state.failed = false; render(); load(); });
      localizeUI();
      return;
    }
    const data = state.data, currency = ['EGP', 'LE', 'ج.م', 'ج'].includes(data.currency) ? (english ? 'EGP' : 'ج.م') : data.currency;
    const money = value => `${format(value)} ${escape(currency)}`;
    const stale = data.stale || state.failed || Date.now() - Date.parse(data.updatedAt) >= 86400000;
    // Older snapshots remain readable while the next publication is generated.
    const posCategories = Array.isArray(data.categories);
    const categories = premium ? premium.groups.filter(group => data.rows.some(row => premium.category(row) === group.id)) : posCategories ? data.categories : [...new Set(data.rows.map(row => row.categoryName).filter(Boolean))].map(name => ({ id: name, name, nameEn: categoryName(data.rows.find(row => row.categoryName === name)) }));
    root.innerHTML = `<main class="customer-menu-shell">
      ${brand()}
      ${premium ? window.VirginiaWelcome.markup(english) : ''}
      <header class="customer-menu-header">
        <div class="customer-menu-heading"><span class="customer-menu-eyebrow">منيو فيرجينيا <span aria-hidden="true">/</span> قائمة الأسعار</span><h1 data-menu-source>${escape(premium ? (online ? (english ? 'Virginia online menu' : 'قائمة منتجات فيرجينيا أونلاين') : (english ? 'From Virginia’s olive press' : 'من معصرة فيرجينيا')) : (english ? data.titleEn || data.title : data.title))}</h1>${premium ? `<p class="menu-subtitle">${english ? 'Goodness from nature. A choice for every day.' : 'خيرات الطبيعة… واختيارات تليق بيومك.'}</p>` : ''}</div>
        <div class="customer-menu-art" aria-hidden="true"><svg viewBox="0 0 120 120"><polygon points="60,3 70,33 94,14 87,44 117,47 91,63 112,87 81,84 78,115 59,91 38,115 38,84 7,90 27,65 2,48 33,44 25,14 49,33"/><circle cx="59" cy="60" r="17"/></svg></div>
      </header>
      <p class="customer-menu-updated">${icon('clock')}<span><span>${t('آخر تحديث:')}</span> <time datetime="${escape(data.updatedAt)}">${escape(new Date(data.updatedAt).toLocaleString(locale))}</time></span></p>
      <p class="customer-menu-warning" role="status" ${stale ? '' : 'hidden'}>نعرض آخر تحديث متاح. الأسعار والتوافر يحتاجان تأكيدًا.</p>
      <form class="customer-menu-filters" role="search" aria-label="البحث في المنيو">
        <label class="customer-menu-search"><span class="customer-menu-sr-only">بحث</span>${icon('search')}<input id="customerSearch" type="search" placeholder="ما الذي تبحث عنه؟" value="${escape(state.query)}" autocomplete="off"></label>
        <label><span>التصنيف</span><select id="customerCategory"><option value="">كل التصنيفات</option>${categories.map(category => `<option data-menu-source ${String(category.id) === state.category ? 'selected' : ''} value="${escape(category.id)}">${escape(english ? category.nameEn || category.name : category.name)}</option>`).join('')}</select></label>
      </form>
      ${premium ? `<nav class="premium-categories" aria-label="${english ? 'Product categories' : 'أقسام المنتجات'}"><button type="button" data-category="" aria-pressed="true">${categoryIcon('')}${english ? 'All products' : 'كل المنتجات'}</button>${categories.map(c=>`<button type="button" data-category="${c.id}" aria-pressed="false">${categoryIcon(c.id)}${escape(english ? c.nameEn : c.name)}</button>`).join('')}</nav>` : ''}
      <div class="customer-menu-results-heading"><h2>تصفّح المنتجات</h2><p id="customerResultCount" role="status" aria-live="polite" aria-atomic="true"></p></div>
      <section class="customer-menu-grid" aria-label="المنتجات"></section>
      <footer class="customer-menu-footer">${icon('spark')}<span>VIRGINIA <span aria-hidden="true">·</span> فيرجينيا</span></footer>
      <dialog class="customer-menu-name-dialog" id="customerNameDialog" aria-labelledby="customerFullName"><form method="dialog"><button type="submit" aria-label="إغلاق">×</button></form><p>اسم المنتج</p><h2 id="customerFullName" data-menu-source></h2></dialog>
      <dialog class="customer-menu-photo-dialog" id="customerPhotoDialog" aria-labelledby="customerPhotoTitle"><form method="dialog"><span id="customerPhotoTitle">صورة المنتج</span><button type="submit" aria-label="إغلاق">×</button></form><img id="customerFullPhoto" alt="" hidden><p id="customerPhotoError" role="status" hidden></p></dialog>
    </main>`;
    const grid = root.querySelector('.customer-menu-grid');
    function cards() {
      const selected = new Set(state.category ? [Number(state.category)] : []);
      if (!premium && posCategories && state.category) {
        let changed = true;
        while (changed) { changed = false; for (const category of categories) if (category.parentId != null && selected.has(category.parentId) && !selected.has(category.id)) { selected.add(category.id); changed = true; } }
      }
      const inCategory = row => !state.category || (premium ? premium.category(row) === state.category : posCategories ? (state.category === '0' ? !row.posCategoryIds?.length : (row.posCategoryIds || []).some(id => selected.has(id))) : row.categoryName === state.category);
      const rows = data.rows.filter(row => (!state.query || [row.productName, row.productNameEn, row.barcode, row.sku].some(name => String(name || '').toLocaleLowerCase().includes(state.query.toLocaleLowerCase()))) && inCategory(row));
      root.querySelector('#customerResultCount').textContent = english ? `${format(rows.length)} ${rows.length === 1 ? 'product' : 'products'}` : `${format(rows.length)} منتج`;
      if (premium) rows.sort((a,b)=>premium.groups.findIndex(g=>g.id===premium.category(a))-premium.groups.findIndex(g=>g.id===premium.category(b)) || Number(!(a.imageUrl || window.VirginiaProductImages?.[a.productId]))-Number(!(b.imageUrl || window.VirginiaProductImages?.[b.productId])));
      root.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===state.category)));
      grid.innerHTML = rows.length ? rows.map(row => {
        const display = nameParts(productName(row));
        // Odoo's bracketed display-name prefix can be an internal reference;
        // show the exact supplied code without inventing a barcode or changing the source.
        const code = nameParts(row.productName).code || display.code;
        const status = stale ? 'unknown' : row.status;
        const label = ({ available: 'متوفر', limited: 'كمية محدودة', out_of_stock: 'غير متوفر', unknown: 'التوافر يحتاج تأكيدًا' })[status] || 'التوافر يحتاج تأكيدًا';
        const imageUrl=menuImageUrl(row.imageUrl) || (premium && window.VirginiaProductImages?.[row.productId] ? assetBase + window.VirginiaProductImages[row.productId] : '');
        const image = imageUrl ? `<button type="button" class="customer-menu-photo" aria-haspopup="dialog" aria-label="${escape(t('تكبير الصورة') + ': ' + display.name)}"><img src="${escape(imageUrl)}" alt="${escape(english ? productName(row) : row.imageAlt || row.productName)}" loading="lazy" decoding="async" width="480" height="480"><span class="customer-menu-photo-hint" aria-hidden="true">${icon('search')}</span></button>` : missingImage();
        const saving = !stale && !online && Number.isFinite(row.comparePrice) && Number.isFinite(row.price) && data.presentation === 'factory' && Number(row.comparePrice) > Number(row.price) && Number(row.price) > 0;
        return `<article class="customer-menu-card" data-menu-tone="${escape(premium?.category(row) || 'other')}" data-product="${escape(row.productId)}">
          <div class="customer-menu-visual"><div class="customer-menu-image">${image}</div><span class="customer-menu-status" data-status="${escape(status)}">${escape(label)}</span></div>
          <div class="customer-menu-card-content"><h3 data-menu-source><button type="button" class="customer-menu-name" aria-haspopup="dialog" title="${escape(display.name)}">${escape(display.name)}</button></h3><p class="premium-size" data-menu-source>${escape(premium?.size(display.name) || '')}</p><details class="premium-details"><summary>${english ? 'Product details' : 'تفاصيل المنتج'}</summary><p class="customer-menu-product-code" data-menu-source ${code ? '' : 'aria-hidden="true"'}>${code ? `<span class="customer-menu-sr-only">${english ? 'Product code' : 'كود الصنف'}: </span><bdi dir="ltr">${escape(code)}</bdi>` : ''}</p></details>
            <div class="customer-menu-price">
              <div class="customer-menu-price-heading"><span>${data.presentation === 'factory' && !online ? 'سعر بيع المصنع' : (english ? 'Online price' : 'سعر الأونلاين')}</span>${saving ? `<span class="customer-menu-saving"><strong>${english ? 'Save' : 'وفّر'} ${money(Math.round((row.comparePrice - row.price) * 100) / 100)}</strong><span class="customer-menu-sr-only">عند الشراء من الصالة</span></span>` : ''}</div>
              <div class="customer-menu-price-amount"><strong>${format(row.price)} <small>${escape(currency)}</small></strong>${saving ? `<span class="customer-menu-compare"><span>${english ? 'Online' : 'الأونلاين'}:</span> <del>${format(row.comparePrice)}<span class="customer-menu-sr-only"> ${escape(currency)}</span></del></span>` : ''}</div>
            </div>
            ${online ? `<a class="premium-shop" href="https://virginiaolive.com/" target="_blank" rel="noopener noreferrer" aria-label="${escape((english ? 'Shop on Virginia: ' : 'تسوّق من فيرجينيا: ') + display.name)}"><span>${english ? 'Love it? Shop Virginia' : 'عجبك؟ اطلبه من فيرجينيا'}</span><span aria-hidden="true">↗</span></a><small class="premium-shop-note">${english ? 'Browse details & order on our official store' : 'التفاصيل وإتمام الطلب على متجرنا الرسمي'}</small>` : ''}
          </div>
        </article>`;
      }).join('') : `<div class="customer-menu-empty">${icon('search')}<h3>${data.rows.length ? 'لا توجد منتجات مطابقة لاختياراتك.' : 'لا توجد منتجات للعرض حاليًا.'}</h3><p>${data.rows.length ? 'جرّب اسمًا آخر أو اعرض كل المنتجات.' : 'يمكنك زيارة المنيو مرة أخرى لاحقًا.'}</p>${data.rows.length ? '<button type="button" class="customer-menu-reset" id="customerReset">عرض كل المنتجات</button>' : ''}</div>`;
      localizeUI(grid);
      grid.querySelectorAll('.customer-menu-name').forEach(button => button.addEventListener('click', () => {
        root.querySelector('#customerFullName').textContent = button.textContent;
        root.querySelector('#customerNameDialog').showModal();
      }));
      grid.querySelectorAll('.customer-menu-photo').forEach(button => button.addEventListener('click', () => {
        const photo = root.querySelector('#customerFullPhoto'), thumbnail = button.querySelector('img');
        root.querySelector('#customerPhotoError').hidden = true;
        photo.alt = thumbnail.alt; photo.hidden = false;
        photo.onerror = () => { photo.hidden = true; const error = root.querySelector('#customerPhotoError'); error.textContent = t('تعذر عرض الصورة. حاول مرة أخرى.'); error.hidden = false; };
        // Reuse Shopify's original URL, without adding resize or quality parameters.
        photo.src = thumbnail.src;
        root.querySelector('#customerPhotoDialog').showModal();
      }));
      grid.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { const container = img.closest('.customer-menu-image'); container.innerHTML = missingImage(); localizeUI(container); }, { once: true }));
      grid.querySelector('#customerReset')?.addEventListener('click', () => {
        state.query = ''; state.category = ''; 
        root.querySelector('#customerSearch').value = '';
        root.querySelector('#customerCategory').value = '';
        
        cards(); root.querySelector('#customerSearch').focus();
      });
    }
    root.querySelector('form').addEventListener('submit', event => event.preventDefault());
    root.querySelector('#customerSearch').addEventListener('input', event => { state.query = event.target.value.trim(); cards(); });
    root.querySelector('#customerCategory').addEventListener('change', event => { state.category = event.target.value; cards(); });
    root.querySelector('#customerPhotoDialog').addEventListener('close', () => { const photo = root.querySelector('#customerFullPhoto'); photo.onerror = null; photo.removeAttribute('src'); photo.hidden = true; });
    root.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{state.category=button.dataset.category;root.querySelector('#customerCategory').value=state.category;cards();root.querySelector('.customer-menu-results-heading').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}));
    if(premium)window.VirginiaWelcome.bind(root);
    cards();
    localizeUI();
    if (focus) {
      const input = document.getElementById(focus.id);
      input?.focus({ preventScroll: true });
      if (input?.type === 'search' && focus.start !== null) input.setSelectionRange(focus.start, focus.end);
    }
  }
  let loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    try {
      if (alias ? !['de', 'sahel', 'online'].includes(alias) : !/^[a-f0-9]{48}$/.test(token)) throw new Error('Invalid menu');
      const endpoint = alias ? 'by-name/' + alias : token;
      const response = await fetch(`${apiBase}/public-menu/${encodeURI(endpoint)}`, { cache: 'no-cache', credentials: 'omit', signal: AbortSignal.timeout(20000) });
      const payload = await response.json();
      if (!response.ok || !payload.success || !Array.isArray(payload.data?.rows)) throw new Error('Unavailable menu');
      state.data = premium ? { ...payload.data, rows: payload.data.rows.filter(row=>!premium.isOffer(row)) } : payload.data; state.failed = false;
      document.title = `${online ? 'Menu Online' : 'Menu Offline'} | Virginia`;
    } catch (_) { state.failed = true; }
    finally { loading = false; render(); }
  }
  if (premium) window.VirginiaWelcome.mount(root, english, assetBase + 'logo.png');
  render(); load();
  setInterval(load, 86400000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
})();
