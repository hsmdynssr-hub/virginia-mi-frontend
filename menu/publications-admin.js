'use strict';
window.MenuPublicationAdmin = (() => {
  let sequence = 0, context = null, publications = [], busy = false;
  const codes = ['showroom', 'sahel', 'online'];
  const labels = { showroom: 'الصالة DE', sahel: 'الساحل', online: 'الأونلاين' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const nameKey = value => String(value || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/[\s\-_]/g, '');
  const aliases = { showroom: ['DE', 'الصالة DE', 'قائمة اسعار DE'], sahel: ['الساحل', 'قائمة اسعار الساحل', 'قائمة الساحل', 'sahel'], online: ['الاونلاين', 'اونلاين', 'قائمة اسعار الاونلاين', 'قائمة اسعار اونلاين', 'online', 'online pricelist'] };
  const matches = (code, name) => aliases[code].some(alias => nameKey(alias) === nameKey(name));
  const canPublish = () => (typeof isAdmin === 'function' && isAdmin()) || (typeof getUserPermissions === 'function' && getUserPermissions().includes('menu.publish'));
  const date = value => value ? new Date(value).toLocaleString('ar-EG') : 'لم يُنشر بعد';
  function publicUrl(token) { const url = new URL('./public-menu.html', location.href); url.searchParams.set('menu', token); return url.href; }
  function options(items, selected) { return '<option value="">اختر</option>' + items.map(item => `<option value="${Number(item.id)}" ${Number(item.id) === Number(selected) ? 'selected' : ''}>${escape(item.completeName || item.name)}</option>`).join(''); }
  function render(message = '') {
    const root = document.getElementById('menuPublicationsPanel');
    if (!root || !context) return;
    const enabled = canPublish(), discovery = context.discovery;
    root.innerHTML = `<div class="report-card-head"><h2>روابط المنيو الثابتة</h2><p>تحديث تلقائي كل 24 ساعة. التحديث اليدوي للاستثناءات فقط. إعدادات النشر مستقلة عن بحث التقرير وحد عرض صفحته.</p></div>
      <p role="status" id="menuPublicationMessage">${escape(message)}</p>
      ${enabled ? '' : '<p>النشر والتحديث اليدوي يتطلبان صلاحية «نشر المنيو وتحديثه يدويًا» من الأدمن.</p>'}
      <div class="menu-publication-grid">${codes.map(code => {
        const saved = publications.find(item => item.channelCode === code), config = saved?.config || {};
        const lists = discovery.pricelists.filter(item => item.active && matches(code, item.name));
        const current = config.pricelistId || (lists.length === 1 ? lists[0].id : '');
        const online = discovery.pricelists.filter(item => item.active && matches('online', item.name));
        const compare = config.comparePricelistId || (online.length === 1 ? online[0].id : '');
        const channel = discovery.channels.find(item => item.code === code);
        return `<section class="menu-publication" data-channel="${code}">
          <h3>${escape(saved?.title || lists.find(item => item.id === current)?.name || labels[code])}</h3>
          <label class="report-field">قائمة أودو<select data-field="pricelistId" ${enabled && !busy ? '' : 'disabled'}>${options(lists, current)}</select></label>
          ${code === 'showroom' ? `<label class="report-field">قائمة سعر البيع للمقارنة<select data-field="comparePricelistId" ${enabled && !busy ? '' : 'disabled'}>${options(online, compare)}</select></label>` : ''}
          ${code !== 'online' ? `<label class="report-field">موقع التوافر<select data-field="locationId" ${enabled && !busy ? '' : 'disabled'}>${options(discovery.locations.filter(item => item.active), config.locationId || channel?.locationId)}</select></label>` : '<p>التوافر والصور من Shopify.</p>'}
          <label class="report-field">فئة المنتجات<select data-field="posCategoryId" ${enabled && !busy ? '' : 'disabled'}><option value="">كل الفئات</option>${discovery.posCategories.map(item => `<option value="${Number(item.id)}" ${Number(item.id) === Number(config.posCategoryId) ? 'selected' : ''}>${escape(item.name)}</option>`).join('')}</select></label>
          <label><input type="checkbox" data-field="onlyPosProducts" ${config.onlyPosProducts !== false ? 'checked' : ''} ${enabled && !busy ? '' : 'disabled'}> منتجات نقاط البيع فقط</label>
          <p>آخر تحديث: ${escape(date(saved?.refreshedAt))}</p>
          ${saved ? `<p>التحديث التالي: ${escape(date(saved.nextRefreshAt))} · ${Number(saved.productCount)} منتج</p>
            ${saved.lastError ? '<p role="status">تعذر آخر تحديث؛ النسخة السابقة ما زالت متاحة.</p>' : ''}
            ${saved.missingImages || saved.unknownAvailability ? `<p>صور تحتاج مطابقة: ${Number(saved.missingImages)} · توافر يحتاج مراجعة: ${Number(saved.unknownAvailability)}</p>` : ''}
            ${saved.untranslatedNames || saved.untranslatedCategories ? `<p>أسماء تحتاج ترجمة إنجليزية: ${Number(saved.untranslatedNames || 0)} · فئات تحتاج ترجمة: ${Number(saved.untranslatedCategories || 0)}</p>` : ''}
            <label class="report-field">الرابط الثابت<input class="menu-publication-link" type="url" readonly value="${escape(publicUrl(saved.token))}"></label>
            <div class="menu-publication-actions"><button type="button" data-action="copy">نسخ الرابط</button><a href="${escape(publicUrl(saved.token))}" target="_blank" rel="noopener">فتح المنيو</a></div>` : ''}
          ${enabled ? `<div class="menu-publication-actions"><button type="button" data-action="publish" ${busy ? 'disabled' : ''}>${saved ? 'حفظ الإعدادات وتحديث المنيو' : 'حفظ ونشر المنيو'}</button>${saved ? `<button type="button" data-action="refresh" ${busy ? 'disabled' : ''}>تحديث استثنائي الآن</button>` : ''}</div>` : ''}
        </section>`;
      }).join('')}</div>`;
    root.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => action(button)));
  }
  async function action(button) {
    const section = button.closest('[data-channel]'), code = section.dataset.channel, operation = button.dataset.action;
    if (operation === 'copy') {
      const input = section.querySelector('.menu-publication-link');
      try { await navigator.clipboard.writeText(input.value); document.getElementById('menuPublicationMessage').textContent = 'تم نسخ الرابط الثابت.'; }
      catch (_) { input.focus(); input.select(); document.getElementById('menuPublicationMessage').textContent = 'الرابط محدد؛ يمكنك نسخه.'; }
      return;
    }
    if (busy || !canPublish()) return;
    const requestSequence = sequence, companyId = context.companyId;
    const body = { companyId };
    if (operation === 'publish') section.querySelectorAll('[data-field]').forEach(field => { body[field.dataset.field] = field.type === 'checkbox' ? field.checked : field.value; });
    busy = true; section.querySelectorAll('button').forEach(item => item.disabled = true);
    document.getElementById('menuPublicationMessage').textContent = 'جارٍ تحديث المنيو؛ الرابط السابق يظل متاحًا أثناء التحديث…';
    try {
      const response = await apiPost(`/menu/publications/${code}/${operation}?companyId=${encodeURIComponent(companyId)}`, body);
      if (sequence !== requestSequence) return;
      publications = publications.filter(item => item.channelCode !== code).concat(response.data);
      busy = false; render('تم تحديث المنيو. الرابط ثابت والتحديث التلقائي التالي بعد 24 ساعة.');
    } catch (error) {
      if (sequence !== requestSequence) return;
      busy = false;
      // Preserve unsaved selections so a failed upstream call does not erase them.
      section.querySelectorAll('button').forEach(item => item.disabled = false);
      document.getElementById('menuPublicationMessage').textContent = error.message || 'تعذر التحديث؛ بقيت النسخة السابقة.';
    }
  }
  async function load(companyId, discovery) {
    const requestSequence = ++sequence;
    context = { companyId, discovery }; publications = []; busy = false;
    render('جارٍ تحميل إعدادات الروابط…');
    try {
      const response = await apiGet('/menu/publications', { companyId });
      if (sequence !== requestSequence) return;
      publications = response.data || []; render();
    } catch (error) { if (sequence === requestSequence) render(error.message || 'تعذر تحميل إعدادات الروابط.'); }
  }
  function clear() { sequence++; context = null; publications = []; busy = false; const root = document.getElementById('menuPublicationsPanel'); if (root) root.replaceChildren(); }
  return { load, clear };
})();
