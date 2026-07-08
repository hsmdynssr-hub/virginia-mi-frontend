let selectedOdooCategory = null;
let currentImportBatchId = null;

const selectedTemplateCategoryIds = new Set();
const selectedFgWarehouseIds = new Set();
const selectedRawWarehouseIds = new Set();

let finishedGoodCategoriesCache = [];
let warehouseCache = [];

document.addEventListener("DOMContentLoaded", async () => {
  renderLayout(
    "إدارة التارجت",
    "تحميل قالب التارجت من منتجات المنتج التام، رفع ملف Excel، مراجعة الأخطاء، واعتماد التارجت.",
    "forecast-targets",
    buildTargetsPage()
  );

  bindTargetEvents();
  await refreshTargetPage();
});

function buildTargetsPage() {
  return `
    <section class="inventory-report-grid forecast-target-compact">
      <div class="inventory-report-card">
        <h2>1) إعداد فئات المنتج التام</h2>

        <div class="filters-grid">
          <label>
            بحث في فئات Odoo
            <input class="control" id="categorySearch" placeholder="مثال: منتجات تامة / طحينة" />
          </label>

          <label>
            &nbsp;
            <button class="run-btn" id="searchCategoriesBtn">بحث</button>
          </label>
        </div>

        <div class="analysis-box" style="margin-top:12px;">
          <label>
            اختر فئة من Odoo لاعتمادها كمنتج تام
            <select class="control" id="odooCategorySelect">
              <option value="">ابحث أولًا عن الفئات</option>
            </select>
          </label>

          <button class="run-btn" id="approveSelectedCategoryBtn" type="button" style="margin-top:12px;">
            اعتماد الفئة المختارة كمنتج تام
          </button>
        </div>

        <div class="analysis-box" style="margin-top:14px;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
            <div>
              <strong>الفئات المعتمدة للتارجت</strong>
              <p style="margin:6px 0 0;">
                هذه هي الفئات التي تم اعتمادها كمنتج تام. اختر منها فئة أو أكثر لتحميل قالب Excel.
              </p>
            </div>

            <button class="inventory-refresh-btn" id="toggleCategoriesPanelBtn" type="button">
              عرض / إخفاء الفئات المعتمدة
            </button>
          </div>
        </div>

        <div id="finishedCategoriesPanel" class="inventory-report-card" style="display:none; margin-top:12px;">
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
            <button class="run-btn" id="selectAllCategoriesBtn" type="button">اختيار الكل</button>
            <button class="export-btn" id="clearCategoriesBtn" type="button">إلغاء الاختيار</button>
          </div>

          <div id="finishedCategoriesBox"></div>
        </div>
      </div>

      <div class="inventory-report-card">
        <h2>2) تحميل قالب Excel</h2>

        <div class="filters-grid">
          <label>
            اسم التارجت
            <input class="control" id="targetName" placeholder="Target July 2026" />
          </label>
        </div>

        <div class="analysis-box">
          <p id="selectedTemplateCategoriesText">
            لم يتم اختيار فئات. سيتم تحميل كل فئات المنتج التام المعتمدة.
          </p>
        </div>

        <button class="inventory-refresh-btn" id="downloadTemplateBtn">
          تحميل قالب التارجت Excel
        </button>

        <div class="analysis-box">
          <p>القالب يحتوي على product_id و category_id من Odoo. المستخدم يملأ target_qty فقط.</p>
        </div>
      </div>
    </section>

    <section class="inventory-report-card forecast-target-compact-card">
      <h2>3) رفع ملف التارجت</h2>

      <div class="filters-grid">
        <label>
          ملف Excel
          <input class="control" type="file" id="targetExcelFile" accept=".xlsx,.xls" />
        </label>

        <label>
          خصم المتاح من المنتج التام؟
          <select class="control" id="includeFgStock">
            <option value="true">نعم، اخصم المتاح من التارجت</option>
            <option value="false">لا، تجاهل مخزون المنتج التام</option>
          </select>
        </label>

        <label>
          خصم المتاح من الخامات ومستلزمات التعبئة؟
          <select class="control" id="includeRawStock">
            <option value="true">نعم، اخصم المتاح من الخامات</option>
            <option value="false">لا، تجاهل مخزون الخامات</option>
          </select>
        </label>
      </div>

      <div id="fgWarehousesPanel" class="analysis-box warehouse-panel" style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
          <div>
            <strong>مستودعات خصم المنتج التام</strong>
            <p style="margin:6px 0 0;">
              اختر المستودعات التي سيتم خصم رصيد المنتج التام منها قبل احتساب المطلوب تصنيعه.
            </p>
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="run-btn" id="selectRecommendedFgWarehousesBtn" type="button">اختيار المقترح</button>
            <button class="run-btn" id="selectAllFgWarehousesBtn" type="button">اختيار الكل</button>
            <button class="export-btn" id="clearFgWarehousesBtn" type="button">إلغاء الاختيار</button>
          </div>
        </div>

        <div id="fgWarehousesBox" style="margin-top:12px;"></div>
      </div>

      <div id="rawWarehousesPanel" class="analysis-box warehouse-panel" style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
          <div>
            <strong>مستودعات خصم الخامات ومستلزمات التعبئة</strong>
            <p style="margin:6px 0 0;">
              اختر المستودعات التي سيتم خصم رصيد الخامات ومستلزمات التعبئة منها بعد تفجير BOM.
            </p>
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="run-btn" id="selectRecommendedRawWarehousesBtn" type="button">اختيار المقترح</button>
            <button class="run-btn" id="selectAllRawWarehousesBtn" type="button">اختيار الكل</button>
            <button class="export-btn" id="clearRawWarehousesBtn" type="button">إلغاء الاختيار</button>
          </div>
        </div>

        <div id="rawWarehousesBox" style="margin-top:12px;"></div>
      </div>

      <button class="run-btn" id="uploadTargetBtn" style="margin-top:14px;">
        رفع ومراجعة الملف
      </button>

      <div id="importSummaryBox"></div>
      <div id="importRowsBox"></div>
    </section>

    <section class="inventory-report-card forecast-target-compact-card">
      <h2>4) التارجتات المحفوظة</h2>
      <div id="targetsListBox"></div>
    </section>

    <section id="loadingBox" class="loading-box hidden">
      جاري التنفيذ...
    </section>

    <section id="errorBox" class="error-box hidden"></section>
  `;
}

function bindTargetEvents() {
  document.getElementById("searchCategoriesBtn")
    ?.addEventListener("click", searchOdooCategories);

  document.getElementById("approveSelectedCategoryBtn")
    ?.addEventListener("click", approveSelectedOdooCategory);

  document.getElementById("downloadTemplateBtn")
    ?.addEventListener("click", downloadTargetTemplate);

  document.getElementById("uploadTargetBtn")
    ?.addEventListener("click", uploadTargetExcel);

  document.getElementById("companySelect")
    ?.addEventListener("change", refreshTargetPage);

  document.getElementById("loadBtn")
    ?.addEventListener("click", refreshTargetPage);

  document.getElementById("toggleCategoriesPanelBtn")
    ?.addEventListener("click", toggleFinishedCategoriesPanel);

  document.getElementById("selectAllCategoriesBtn")
    ?.addEventListener("click", selectAllTemplateCategories);

  document.getElementById("clearCategoriesBtn")
    ?.addEventListener("click", clearTemplateCategories);

  document.getElementById("includeFgStock")
    ?.addEventListener("change", updateFgWarehousesPanelVisibility);

  document.getElementById("includeRawStock")
    ?.addEventListener("change", updateRawWarehousesPanelVisibility);

  document.getElementById("selectRecommendedFgWarehousesBtn")
    ?.addEventListener("click", selectRecommendedFgWarehouses);

  document.getElementById("selectAllFgWarehousesBtn")
    ?.addEventListener("click", selectAllFgWarehouses);

  document.getElementById("clearFgWarehousesBtn")
    ?.addEventListener("click", clearFgWarehouses);

  document.getElementById("selectRecommendedRawWarehousesBtn")
    ?.addEventListener("click", selectRecommendedRawWarehouses);

  document.getElementById("selectAllRawWarehousesBtn")
    ?.addEventListener("click", selectAllRawWarehouses);

  document.getElementById("clearRawWarehousesBtn")
    ?.addEventListener("click", clearRawWarehouses);
}

function getCompanyId() {
  return document.getElementById("companySelect")?.value || "1";
}

function getDateFrom() {
  return document.getElementById("dateFrom")?.value || "";
}

function getDateTo() {
  return document.getElementById("dateTo")?.value || getDateFrom();
}

function getTargetName() {
  return document.getElementById("targetName")?.value || `Target ${getDateFrom()} - ${getDateTo()}`;
}

function getApiBaseUrl() {
  if (typeof API_BASE_URL !== "undefined") return API_BASE_URL;

  return window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:5050/api"
      : "https://odoo-management-intelligence-agent-production.up.railway.app/api";
}

function getTargetAuthToken() {
  if (typeof getAuthToken === "function") {
    return getAuthToken();
  }

  return localStorage.getItem("token") || "";
}

function showLoading() {
  document.getElementById("loadingBox")?.classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loadingBox")?.classList.add("hidden");
}

function showError(error) {
  const box = document.getElementById("errorBox");
  if (!box) return;

  box.textContent = error.message || "حدث خطأ";
  box.classList.remove("hidden");
}

function clearError() {
  const box = document.getElementById("errorBox");
  if (!box) return;

  box.textContent = "";
  box.classList.add("hidden");
}

async function refreshTargetPage() {
  try {
    clearError();
    showLoading();

    selectedFgWarehouseIds.clear();
    selectedRawWarehouseIds.clear();

    await Promise.all([
      searchOdooCategories(),
      loadFinishedGoodCategories(),
      loadWarehouses(),
      loadTargets()
    ]);

    updateFgWarehousesPanelVisibility();
    updateRawWarehousesPanelVisibility();
  } catch (error) {
    console.error(error);
    showError(error);
  } finally {
    hideLoading();
  }
}

async function searchOdooCategories() {
  try {
    clearError();
    showLoading();

    const companyId = getCompanyId();
    const search = document.getElementById("categorySearch")?.value || "";

    const response = await apiGet("/forecast/targets/odoo-categories", {
      companyId,
      search,
      limit: 100
    });

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل فئات Odoo");
    }

    renderOdooCategories(response.data || []);
  } catch (error) {
    console.error(error);
    showError(error);
  } finally {
    hideLoading();
  }
}

function renderOdooCategories(rows) {
  const select = document.getElementById("odooCategorySelect");
  if (!select) return;

  if (!rows.length) {
    select.innerHTML = `<option value="">لا توجد فئات مطابقة من Odoo</option>`;
    return;
  }

  select.innerHTML = `
    <option value="">اختر فئة لاعتمادها</option>
    ${rows.map((row) => `
      <option
        value="${escapeHtml(row.categoryId)}"
        data-category-name="${escapeHtml(row.categoryName)}"
        data-products-count="${escapeHtml(row.productsCount || 0)}"
      >
        ${escapeHtml(row.categoryName)} - عدد المنتجات: ${escapeHtml(row.productsCount || 0)}
      </option>
    `).join("")}
  `;
}

async function approveSelectedOdooCategory() {
  const select = document.getElementById("odooCategorySelect");

  if (!select || !select.value) {
    showError(new Error("اختر فئة من القائمة أولًا"));
    return;
  }

  const selectedOption = select.options[select.selectedIndex];

  const category = {
    categoryId: Number(select.value),
    categoryName:
      selectedOption.dataset.categoryName ||
      selectedOption.textContent ||
      `Category ${select.value}`,
    productsCount: Number(selectedOption.dataset.productsCount || 0)
  };

  await saveFinishedGoodCategory(category);
}

async function saveFinishedGoodCategory(category) {
  try {
    clearError();
    showLoading();

    selectedOdooCategory = category;

    const response = await apiPost("/forecast/targets/finished-good-categories", {
      companyId: Number(getCompanyId()),
      categoryId: Number(category.categoryId),
      categoryName: category.categoryName,
      isActive: true
    });

    if (!response.success) {
      throw new Error(response.message || "فشل حفظ الفئة");
    }

    await loadFinishedGoodCategories();
  } catch (error) {
    console.error(error);
    showError(error);
  } finally {
    hideLoading();
  }
}

async function loadFinishedGoodCategories() {
  const companyId = getCompanyId();

  const response = await apiGet("/forecast/targets/finished-good-categories", {
    companyId
  });

  if (!response.success) {
    throw new Error(response.message || "فشل تحميل فئات المنتج التام");
  }

  finishedGoodCategoriesCache = response.data || [];

  syncSelectedCategoriesWithCache();
  renderFinishedGoodCategories(finishedGoodCategoriesCache);
  updateSelectedTemplateCategoriesText();
}

function syncSelectedCategoriesWithCache() {
  const validIds = new Set(
    finishedGoodCategoriesCache.map((row) => String(row.categoryId))
  );

  Array.from(selectedTemplateCategoryIds).forEach((id) => {
    if (!validIds.has(String(id))) {
      selectedTemplateCategoryIds.delete(id);
    }
  });
}

function renderFinishedGoodCategories(rows) {
  const container = document.getElementById("finishedCategoriesBox");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div class="inventory-empty">لم يتم اعتماد فئات منتج تام بعد</div>`;
    return;
  }

  container.innerHTML = `
    <div class="checkbox-grid">
      ${rows.map((row) => {
        const id = String(row.categoryId);
        const checked = selectedTemplateCategoryIds.has(id) ? "checked" : "";

        return `
          <label class="checkbox-card">
            <input
              type="checkbox"
              class="template-category-checkbox"
              value="${escapeHtml(id)}"
              ${checked}
            />
            <span>
              <strong>${escapeHtml(row.categoryName)}</strong>
              <small>Category ID: ${escapeHtml(row.categoryId)} - ${row.isActive ? "نشطة" : "موقوفة"}</small>
            </span>
          </label>
        `;
      }).join("")}
    </div>
  `;

  document
    .querySelectorAll(".template-category-checkbox")
    .forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selectedTemplateCategoryIds.add(String(checkbox.value));
        } else {
          selectedTemplateCategoryIds.delete(String(checkbox.value));
        }

        updateSelectedTemplateCategoriesText();
      });
    });
}

function toggleFinishedCategoriesPanel() {
  const panel = document.getElementById("finishedCategoriesPanel");
  if (!panel) return;

  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

function selectAllTemplateCategories() {
  finishedGoodCategoriesCache.forEach((row) => {
    selectedTemplateCategoryIds.add(String(row.categoryId));
  });

  renderFinishedGoodCategories(finishedGoodCategoriesCache);
  updateSelectedTemplateCategoriesText();
}

function clearTemplateCategories() {
  selectedTemplateCategoryIds.clear();

  renderFinishedGoodCategories(finishedGoodCategoriesCache);
  updateSelectedTemplateCategoriesText();
}

function getSelectedTemplateCategoryIds() {
  return Array.from(selectedTemplateCategoryIds)
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);
}

function updateSelectedTemplateCategoriesText() {
  const container = document.getElementById("selectedTemplateCategoriesText");
  if (!container) return;

  const selectedIds = getSelectedTemplateCategoryIds();

  if (!selectedIds.length) {
    container.textContent =
      "لم يتم اختيار فئات. سيتم تحميل كل فئات المنتج التام المعتمدة.";
    return;
  }

  const selectedNames = finishedGoodCategoriesCache
    .filter((row) => selectedIds.includes(Number(row.categoryId)))
    .map((row) => row.categoryName);

  container.textContent =
    `سيتم تحميل قالب Excel للفئات المختارة فقط: ${selectedNames.join("، ")}`;
}

async function loadWarehouses() {
  const response = await apiGet("/forecast/targets/warehouses", {
    companyId: getCompanyId(),
    purpose: "all",
    limit: 500
  });

  if (!response.success) {
    throw new Error(response.message || "فشل تحميل المستودعات");
  }

  warehouseCache = response.data || [];

  renderFgWarehouses();
  renderRawWarehouses();
}

function getWarehouseLabel(row) {
  const code = row.warehouseCode ? ` / ${row.warehouseCode}` : "";
  return `${row.warehouseName}${code}`;
}

function getWarehouseHint(row) {
  const stock = row.stockLocationName ? `Stock: ${row.stockLocationName}` : "";
  const view = row.viewLocationName ? `View: ${row.viewLocationName}` : "";

  return [stock, view].filter(Boolean).join(" - ");
}

function renderWarehouseCheckboxes({
  containerId,
  selectedSet,
  checkboxClass,
  purpose
}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!warehouseCache.length) {
    container.innerHTML = `<div class="inventory-empty">لا توجد مستودعات من Odoo</div>`;
    return;
  }

  const rows = [...warehouseCache].sort((a, b) => {
    const aRecommended =
      purpose === "finished_goods"
        ? a.isFinishedGoods
        : a.isRawOrPackaging;

    const bRecommended =
      purpose === "finished_goods"
        ? b.isFinishedGoods
        : b.isRawOrPackaging;

    if (aRecommended && !bRecommended) return -1;
    if (!aRecommended && bRecommended) return 1;

    return String(a.warehouseName || "").localeCompare(String(b.warehouseName || ""));
  });

  container.innerHTML = `
    <div class="checkbox-grid">
      ${rows.map((row) => {
        const id = String(row.warehouseId);
        const checked = selectedSet.has(id) ? "checked" : "";

        const recommended =
          purpose === "finished_goods"
            ? row.isFinishedGoods
            : row.isRawOrPackaging;

        return `
          <label class="checkbox-card ${recommended ? "checkbox-card-recommended" : ""}">
            <input
              type="checkbox"
              class="${checkboxClass}"
              value="${escapeHtml(id)}"
              ${checked}
            />
            <span>
              <strong>${escapeHtml(getWarehouseLabel(row))}</strong>
              <small>Warehouse ID: ${escapeHtml(row.warehouseId)} ${recommended ? " - مقترح" : ""}</small>
              <small>${escapeHtml(getWarehouseHint(row))}</small>
            </span>
          </label>
        `;
      }).join("")}
    </div>
  `;

  document
    .querySelectorAll(`.${checkboxClass}`)
    .forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selectedSet.add(String(checkbox.value));
        } else {
          selectedSet.delete(String(checkbox.value));
        }
      });
    });
}

function renderFgWarehouses() {
  renderWarehouseCheckboxes({
    containerId: "fgWarehousesBox",
    selectedSet: selectedFgWarehouseIds,
    checkboxClass: "fg-warehouse-checkbox",
    purpose: "finished_goods"
  });
}

function renderRawWarehouses() {
  renderWarehouseCheckboxes({
    containerId: "rawWarehousesBox",
    selectedSet: selectedRawWarehouseIds,
    checkboxClass: "raw-warehouse-checkbox",
    purpose: "raw_packaging"
  });
}

function updateFgWarehousesPanelVisibility() {
  const panel = document.getElementById("fgWarehousesPanel");
  const includeFgStock =
    document.getElementById("includeFgStock")?.value !== "false";

  if (!panel) return;

  panel.style.display = includeFgStock ? "block" : "none";
}

function updateRawWarehousesPanelVisibility() {
  const panel = document.getElementById("rawWarehousesPanel");
  const includeRawStock =
    document.getElementById("includeRawStock")?.value !== "false";

  if (!panel) return;

  panel.style.display = includeRawStock ? "block" : "none";
}

function selectRecommendedFgWarehouses() {
  selectedFgWarehouseIds.clear();

  warehouseCache
    .filter((row) => row.isFinishedGoods)
    .forEach((row) => selectedFgWarehouseIds.add(String(row.warehouseId)));

  renderFgWarehouses();
}

function selectAllFgWarehouses() {
  warehouseCache.forEach((row) => {
    selectedFgWarehouseIds.add(String(row.warehouseId));
  });

  renderFgWarehouses();
}

function clearFgWarehouses() {
  selectedFgWarehouseIds.clear();

  renderFgWarehouses();
}

function selectRecommendedRawWarehouses() {
  selectedRawWarehouseIds.clear();

  warehouseCache
    .filter((row) => row.isRawOrPackaging)
    .forEach((row) => selectedRawWarehouseIds.add(String(row.warehouseId)));

  renderRawWarehouses();
}

function selectAllRawWarehouses() {
  warehouseCache.forEach((row) => {
    selectedRawWarehouseIds.add(String(row.warehouseId));
  });

  renderRawWarehouses();
}

function clearRawWarehouses() {
  selectedRawWarehouseIds.clear();

  renderRawWarehouses();
}

function getSelectedFgWarehouseIds() {
  return Array.from(selectedFgWarehouseIds)
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);
}

function getSelectedRawWarehouseIds() {
  return Array.from(selectedRawWarehouseIds)
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);
}

async function downloadTargetTemplate() {
  try {
    clearError();

    const params = new URLSearchParams({
      companyId: getCompanyId(),
      targetName: getTargetName(),
      dateFrom: getDateFrom(),
      dateTo: getDateTo()
    });

    const selectedCategoryIds = getSelectedTemplateCategoryIds();

    if (selectedCategoryIds.length) {
      params.set("categoryIds", JSON.stringify(selectedCategoryIds));
    }

    const url = `${getApiBaseUrl()}/forecast/targets/template?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getTargetAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error("فشل تحميل قالب التارجت");
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `forecast-target-template-${getCompanyId()}-${getDateFrom()}-${getDateTo()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error(error);
    showError(error);
  }
}

async function uploadTargetExcel() {
  try {
    clearError();
    showLoading();

    const fileInput = document.getElementById("targetExcelFile");
    const file = fileInput?.files?.[0];

    if (!file) {
      throw new Error("اختار ملف Excel الأول");
    }

    const includeFgStock =
      document.getElementById("includeFgStock")?.value !== "false";

    const includeRawStock =
      document.getElementById("includeRawStock")?.value !== "false";

    const fgWarehouseIds =
      includeFgStock
        ? getSelectedFgWarehouseIds()
        : [];

    const rawWarehouseIds =
      includeRawStock
        ? getSelectedRawWarehouseIds()
        : [];

    if (includeFgStock && !fgWarehouseIds.length) {
      throw new Error("اختر مستودع واحد على الأقل لخصم رصيد المنتج التام، أو اختر عدم خصم مخزون المنتج التام.");
    }

    if (includeRawStock && !rawWarehouseIds.length) {
      throw new Error("اختر مستودع واحد على الأقل لخصم الخامات ومستلزمات التعبئة، أو اختر عدم خصم مخزون الخامات.");
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append("companyId", getCompanyId());
    formData.append("targetName", getTargetName());
    formData.append("dateFrom", getDateFrom());
    formData.append("dateTo", getDateTo());

    formData.append("includeFgStock", includeFgStock ? "true" : "false");
    formData.append("includeRawStock", includeRawStock ? "true" : "false");

    formData.append("fgWarehouseIds", JSON.stringify(fgWarehouseIds));
    formData.append("rawWarehouseIds", JSON.stringify(rawWarehouseIds));

    const response = await fetch(`${getApiBaseUrl()}/forecast/targets/import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getTargetAuthToken()}`
      },
      body: formData
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.message || "فشل رفع ملف التارجت");
    }

    currentImportBatchId = json.batch?.id || null;

    renderImportPreview(json);
  } catch (error) {
    console.error(error);
    showError(error);
  } finally {
    hideLoading();
  }
}

function renderImportPreview(result) {
  renderImportSummary(result.batch, result.summary);
  renderImportRows(result.rows || []);
}

function renderImportSummary(batch, summary = {}) {
  const container = document.getElementById("importSummaryBox");
  if (!container) return;

  container.innerHTML = `
    <div class="inventory-kpi-grid">
      <div class="inventory-kpi-card">
        <span>Batch ID</span>
        <strong>${escapeHtml(batch?.id || "-")}</strong>
        <small>رقم عملية الاستيراد</small>
      </div>

      <div class="inventory-kpi-card">
        <span>إجمالي الصفوف</span>
        <strong>${escapeHtml(summary.totalRows || 0)}</strong>
        <small>كل صفوف الملف</small>
      </div>

      <div class="inventory-kpi-card">
        <span>صفوف صحيحة</span>
        <strong>${escapeHtml(summary.validRows || 0)}</strong>
        <small>جاهزة للاعتماد</small>
      </div>

      <div class="inventory-kpi-card">
        <span>صفوف بها أخطاء</span>
        <strong>${escapeHtml(summary.errorRows || 0)}</strong>
        <small>لازم تتصلح قبل الاعتماد</small>
      </div>
    </div>

    <div class="analysis-box">
      <p>خصم المنتج التام: <strong>${batch?.includeFgStock ? "نعم" : "لا"}</strong></p>
      <p>خصم الخامات/التعبئة: <strong>${batch?.includeRawStock !== false ? "نعم" : "لا"}</strong></p>
      <p>مستودعات المنتج التام المختارة: <strong>${escapeHtml((batch?.fgWarehouseIds || []).join(", ") || "-")}</strong></p>
      <p>مستودعات الخامات/التعبئة المختارة: <strong>${escapeHtml((batch?.rawWarehouseIds || []).join(", ") || "-")}</strong></p>
    </div>

    <button class="run-btn" onclick="confirmImportBatch()" ${summary.errorRows > 0 ? "disabled" : ""}>
      اعتماد التارجت
    </button>
  `;
}

function renderImportRows(rows) {
  const container = document.getElementById("importRowsBox");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div class="inventory-empty">لا توجد صفوف للعرض</div>`;
    return;
  }

  container.innerHTML = `
    <div class="inventory-table-wrap">
      <table class="inventory-data-table">
        <thead>
          <tr>
            <th>Row</th>
            <th>Product ID</th>
            <th>المنتج</th>
            <th>الفئة</th>
            <th>الكمية</th>
            <th>الأولوية</th>
            <th>الحالة</th>
            <th>الأخطاء</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.rowNumber)}</td>
              <td>${escapeHtml(row.productId || "-")}</td>
              <td>${escapeHtml(row.productName || "-")}</td>
              <td>${escapeHtml(row.categoryName || "-")}</td>
              <td>${escapeHtml(formatNumber(row.targetQty, 4))}</td>
              <td>${escapeHtml(row.priority || "normal")}</td>
              <td>${row.isValid ? "صحيح" : "خطأ"}</td>
              <td>${escapeHtml((row.errors || []).join(", "))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function confirmImportBatch() {
  try {
    clearError();
    showLoading();

    if (!currentImportBatchId) {
      throw new Error("لا توجد عملية استيراد لاعتمادها");
    }

    const response = await apiPost(
      `/forecast/targets/import/${currentImportBatchId}/confirm`,
      {}
    );

    if (!response.success) {
      throw new Error(response.message || "فشل اعتماد التارجت");
    }

    document.getElementById("importSummaryBox").innerHTML = `
      <div class="analysis-box">
        <p>تم اعتماد التارجت بنجاح. Target ID: <strong>${escapeHtml(response.target?.id || "-")}</strong></p>
        <p>عدد السطور: <strong>${escapeHtml(response.linesCount || 0)}</strong></p>
      </div>
    `;

    currentImportBatchId = null;
    await loadTargets();
  } catch (error) {
    console.error(error);
    showError(error);
  } finally {
    hideLoading();
  }
}

async function loadTargets() {
  const companyId = getCompanyId();

  const response = await apiGet("/forecast/targets", {
    companyId,
    limit: 50
  });

  if (!response.success) {
    throw new Error(response.message || "فشل تحميل التارجتات");
  }

  renderTargetsList(response.data || []);
}

function canDeleteTargets() {
  if (typeof isAdmin === "function") {
    return isAdmin();
  }

  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    const roles = Array.isArray(user.roles) ? user.roles : [];

    if (user.role === "admin") return true;
    if (user.role === "super_admin") return true;
    if (permissions.includes("*")) return true;

    return roles.some((role) =>
      ["admin", "super_admin"].includes(role.code)
    );
  } catch {
    return false;
  }
}

function renderTargetsList(rows) {
  const container = document.getElementById("targetsListBox");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div class="inventory-empty">لا توجد تارجتات محفوظة</div>`;
    return;
  }

  const showDelete = canDeleteTargets();

  container.innerHTML = `
    <div class="inventory-table-wrap">
      <table class="inventory-data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>اسم التارجت</th>
            <th>الفترة</th>
            <th>الحالة</th>
            <th>خصم FG</th>
            <th>خصم خامات</th>
            <th>مستودعات FG</th>
            <th>مستودعات خامات</th>
            <th>إجراء</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.id)}</td>
              <td>${escapeHtml(row.targetName)}</td>
              <td>${escapeHtml(formatDate(row.dateFrom))} → ${escapeHtml(formatDate(row.dateTo))}</td>
              <td>${escapeHtml(row.status)}</td>
              <td>${row.includeFgStock ? "نعم" : "لا"}</td>
              <td>${row.includeRawStock !== false ? "نعم" : "لا"}</td>
              <td>${escapeHtml((row.fgWarehouseIds || []).join(", ") || "-")}</td>
              <td>${escapeHtml((row.rawWarehouseIds || []).join(", ") || "-")}</td>
              <td>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <a class="run-btn" href="./target-report.html?targetId=${row.id}">
                    فتح التقرير
                  </a>

                  ${
                    showDelete
                      ? `<button
                          class="export-btn delete-target-btn"
                          data-target-id="${escapeHtml(row.id)}"
                          data-target-name="${escapeHtml(row.targetName)}"
                          type="button"
                        >
                          حذف
                        </button>`
                      : ""
                  }
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  document
    .querySelectorAll(".delete-target-btn")
    .forEach((button) => {
      button.addEventListener("click", () => {
        deleteTarget(
          button.dataset.targetId,
          button.dataset.targetName
        );
      });
    });
}

async function deleteTarget(targetId, targetName) {
  if (!canDeleteTargets()) {
    showError(new Error("الحذف متاح للمدير فقط"));
    return;
  }

  const confirmed = confirm(
    `هل تريد حذف التارجت؟\n${targetName}\n\nسيتم حذف التقرير وسطور التارجت المرتبطة به.`
  );

  if (!confirmed) return;

  try {
    clearError();
    showLoading();

    const response = await fetch(
      `${getApiBaseUrl()}/forecast/targets/${targetId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getTargetAuthToken()}`
        }
      }
    );

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.message || "فشل حذف التارجت");
    }

    await loadTargets();
  } catch (error) {
    console.error(error);
    showError(error);
  } finally {
    hideLoading();
  }
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function formatNumber(value, digits = 2) {
  const number = Number(value || 0);

  return number.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.saveFinishedGoodCategory = saveFinishedGoodCategory;
window.confirmImportBatch = confirmImportBatch;
window.deleteTarget = deleteTarget;