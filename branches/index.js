let editingSourceId = null;

document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "ذكاء الفروع",
    "فصل الفروع ككيان إداري مستقل عن نقاط البيع، وتجهيز ربط كل فرع بمصادره من POS والمخزون.",
    "branches",
    buildBranchesOverviewContent()
  );

  bindBranchesEvents();
  renderInitialState();
});

function buildBranchesOverviewContent() {
  return `
    <section id="branchesLoadingBox" class="loading-box hidden">
      جاري تحميل بيانات الفروع...
    </section>

    <section id="branchesErrorBox" class="error-box hidden"></section>

    <section id="branchesPendingBox" class="inventory-report-card">
      <h2>بيانات الفروع لم يتم تحميلها بعد</h2>
      <p class="inventory-muted-text">
        اختار الشركة من الهيدر، وبعدها اضغط <strong>تحديث التقرير</strong>
        لتحميل الفروع ومصادر الربط.
      </p>
    </section>

    <section id="branchesKpiGrid" class="inventory-kpi-grid"></section>

    <section class="inventory-report-card">
      <h2>تعريف الفروع الإدارية</h2>
      <p class="inventory-muted-text">
        هذه الصفحة لا تعرض POS كفرع. الفرع هنا كيان إداري مستقل يمكن ربطه بنقطة بيع، موقع مخزني، مستودع، موقع شحن أو موقع تحويل.
      </p>
      <div id="branchesTableBox"></div>
    </section>

    <section class="inventory-report-grid">
      <div class="inventory-report-card">
        <h2>مصادر الفروع</h2>
        <div id="branchSourcesBox"></div>
      </div>

      <div class="inventory-report-card">
        <h2>ملاحظات إدارية</h2>
        <div id="branchesNotesBox" class="analysis-box"></div>
      </div>
    </section>

    <section class="inventory-report-card">
      <h2>إضافة / ربط مصدر بفرع</h2>
      <p class="inventory-muted-text">
        اختر الفرع، ثم نوع المصدر، ثم اختر المصدر مباشرة من Odoo. بعد الاختيار سيظهر تأكيد واضح قبل الحفظ.
      </p>

      <div class="filters-grid">
        <label>
          1) الفرع
          <select id="sourceBranchId">
            <option value="">اختر الفرع</option>
          </select>
        </label>

        <label>
          2) نوع المصدر
          <select id="sourceType">
            <option value="POS_CONFIG">نقطة بيع POS</option>
            <option value="STOCK_LOCATION">موقع مخزني</option>
            <option value="WAREHOUSE">مستودع</option>
            <option value="SHIPPING_LOCATION">موقع شحن</option>
            <option value="TRANSFER_LOCATION">موقع تحويل</option>
          </select>
        </label>

        <label>
          3) المصدر من Odoo
          <select id="sourceOptionId">
            <option value="">اختر المصدر</option>
          </select>
        </label>

        <label>
          Odoo ID
          <input id="sourceOdooId" class="control" type="number" placeholder="يتحدد تلقائيًا" readonly />
        </label>

        <label>
          اسم المصدر
          <input id="sourceName" class="control" type="text" placeholder="يتحدد تلقائيًا" />
        </label>

        <label>
          ملاحظة
          <input id="sourceNotes" class="control" type="text" placeholder="اختياري" />
        </label>
      </div>

      <div
        id="linkPreviewBox"
        class="analysis-box"
        style="
          margin-top: 18px;
          padding: 22px;
          border: 1px solid #bfdbfe;
          border-radius: 18px;
          background: linear-gradient(135deg, #eff6ff, #ecfeff);
        "
      >
        اختار الفرع والمصدر، وسيظهر هنا تأكيد الربط قبل الحفظ.
      </div>

      <div
        style="
          margin-top: 18px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        "
      >
        <button
          id="clearBranchSourceBtn"
          type="button"
          style="
            height: 46px;
            padding: 0 22px;
            border-radius: 14px;
            border: 1px solid #cbd5e1;
            background: #ffffff;
            color: #334155;
            font-weight: 800;
            cursor: pointer;
          "
        >
          مسح الاختيار
        </button>

        <button
          id="saveBranchSourceBtn"
          type="button"
          style="
            height: 52px;
            min-width: 240px;
            padding: 0 28px;
            border-radius: 16px;
            border: 0;
            background: #16a34a;
            color: #ffffff;
            font-size: 16px;
            font-weight: 900;
            cursor: pointer;
            box-shadow: 0 12px 28px rgba(22, 163, 74, 0.28);
          "
        >
          ✅ حفظ الربط الآن
        </button>
      </div>
    </section>
  `;
}

function bindBranchesEvents() {
  const loadBtn = document.getElementById("loadBtn");

  if (loadBtn) {
    loadBtn.addEventListener("click", async () => {
      await loadBranchesOverview();
      await loadSourceOptions();
      updateLinkPreview();
    });
  }

  const companySelect = document.getElementById("companySelect");

  if (companySelect) {
    companySelect.addEventListener("change", () => {
      editingSourceId = null;
      clearBranchesReport();
      resetBranchSourceSelectors();
      renderFilterChangedState();
      updateLinkPreview();
    });
  }

  const sourceBranch = document.getElementById("sourceBranchId");

  if (sourceBranch) {
    sourceBranch.addEventListener("change", updateLinkPreview);
  }

  const sourceType = document.getElementById("sourceType");

  if (sourceType) {
    sourceType.addEventListener("change", async () => {
      await loadSourceOptions();
      updateLinkPreview();
    });
  }

  const sourceOption = document.getElementById("sourceOptionId");

  if (sourceOption) {
    sourceOption.addEventListener("change", () => {
      applySelectedSourceOption();
      updateLinkPreview();
    });
  }

  const sourceNotes = document.getElementById("sourceNotes");

  if (sourceNotes) {
    sourceNotes.addEventListener("input", updateLinkPreview);
  }

  const saveBtn = document.getElementById("saveBranchSourceBtn");

  if (saveBtn) {
    saveBtn.addEventListener("click", saveBranchSource);
  }

  const clearBtn = document.getElementById("clearBranchSourceBtn");

  if (clearBtn) {
    clearBtn.addEventListener("click", clearBranchSourceForm);
  }

  window.loadBranchesOverview = loadBranchesOverview;
  window.loadSourceOptions = loadSourceOptions;
  window.editBranchSource = editBranchSource;
  window.disableBranchSource = disableBranchSource;
}

function getSelectedCompanyId() {
  return document.getElementById("companySelect")?.value || "";
}

function validateBranchesCompany() {
  const companyId = getSelectedCompanyId();

  if (!companyId) {
    return {
      ok: false,
      message: "لازم تختار الشركة قبل تحميل بيانات الفروع."
    };
  }

  return {
    ok: true
  };
}

function getBranchesFilters() {
  return {
    companyId: getSelectedCompanyId()
  };
}

function renderInitialState() {
  hideBranchesLoadingBox();
  clearBranchesError();
  clearBranchesReport();
  resetBranchSourceSelectors();

  showBranchesPendingMessage(
    "بيانات الفروع لم يتم تحميلها بعد",
    "اختار الشركة من الهيدر، وبعدها اضغط تحديث التقرير لتحميل الفروع ومصادر الربط."
  );

  updateLinkPreview();
}

function renderFilterChangedState() {
  hideBranchesLoadingBox();
  clearBranchesError();

  showBranchesPendingMessage(
    "تم تغيير الشركة",
    "اضغط تحديث التقرير لتحميل الفروع ومصادر الربط الخاصة بالشركة الجديدة."
  );
}

function showBranchesPendingMessage(title, message) {
  const pendingBox = document.getElementById("branchesPendingBox");
  if (!pendingBox) return;

  pendingBox.classList.remove("hidden");
  pendingBox.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <p class="inventory-muted-text">${escapeHtml(message)}</p>
  `;
}

function hideBranchesPendingBox() {
  document.getElementById("branchesPendingBox")?.classList.add("hidden");
}

function hideBranchesLoadingBox() {
  document.getElementById("branchesLoadingBox")?.classList.add("hidden");
}

function clearBranchesError() {
  const errorBox = document.getElementById("branchesErrorBox");

  if (!errorBox) return;

  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function showBranchesError(message) {
  const errorBox = document.getElementById("branchesErrorBox");

  if (!errorBox) {
    alert(message);
    return;
  }

  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearBranchesReport() {
  [
    "branchesKpiGrid",
    "branchesTableBox",
    "branchSourcesBox",
    "branchesNotesBox"
  ].forEach((id) => {
    const element = document.getElementById(id);

    if (element) {
      element.innerHTML = "";
    }
  });
}

function resetBranchSourceSelectors() {
  const branchSelect = document.getElementById("sourceBranchId");
  const sourceOptionSelect = document.getElementById("sourceOptionId");
  const sourceOdooIdInput = document.getElementById("sourceOdooId");
  const sourceNameInput = document.getElementById("sourceName");
  const sourceNotesInput = document.getElementById("sourceNotes");
  const saveBtn = document.getElementById("saveBranchSourceBtn");

  editingSourceId = null;

  if (branchSelect) {
    branchSelect.innerHTML = `<option value="">اختر الشركة ثم اضغط تحديث التقرير</option>`;
    branchSelect.value = "";
  }

  if (sourceOptionSelect) {
    sourceOptionSelect.innerHTML = `<option value="">اختر الشركة ثم اضغط تحديث التقرير</option>`;
    sourceOptionSelect.value = "";
  }

  if (sourceOdooIdInput) sourceOdooIdInput.value = "";
  if (sourceNameInput) sourceNameInput.value = "";
  if (sourceNotesInput) sourceNotesInput.value = "";

  if (saveBtn) {
    saveBtn.textContent = "✅ حفظ الربط الآن";
    saveBtn.style.background = "#16a34a";
    saveBtn.disabled = false;
  }
}

async function loadBranchesOverview() {
  const validation = validateBranchesCompany();

  if (!validation.ok) {
    showBranchesError(validation.message);
    return;
  }

  const loadingBox = document.getElementById("branchesLoadingBox");

  try {
    if (loadingBox) loadingBox.classList.remove("hidden");

    clearBranchesError();

    const filters = getBranchesFilters();

    const response =
      await apiGet("/branches/overview", {
        companyId: filters.companyId
      });

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل بيانات الفروع");
    }

    renderBranchesOverview(response.data || {});
  } catch (error) {
    console.error(error);

    showBranchesError(
      error.message || "حدث خطأ أثناء تحميل بيانات الفروع"
    );
  } finally {
    if (loadingBox) loadingBox.classList.add("hidden");
  }
}

async function loadSourceOptions() {
  const companyId = getSelectedCompanyId();

  const sourceType =
    document.getElementById("sourceType")?.value || "POS_CONFIG";

  const sourceOptionSelect =
    document.getElementById("sourceOptionId");

  const sourceOdooIdInput =
    document.getElementById("sourceOdooId");

  const sourceNameInput =
    document.getElementById("sourceName");

  if (!sourceOptionSelect) return;

  if (!companyId) {
    sourceOptionSelect.innerHTML = `
      <option value="">اختر الشركة أولًا</option>
    `;

    if (sourceOdooIdInput) sourceOdooIdInput.value = "";
    if (sourceNameInput) sourceNameInput.value = "";

    return;
  }

  sourceOptionSelect.innerHTML = `
    <option value="">جاري تحميل المصادر...</option>
  `;

  if (sourceOdooIdInput) sourceOdooIdInput.value = "";
  if (sourceNameInput) sourceNameInput.value = "";

  try {
    const response =
      await apiGet("/branches/source-options", {
        companyId,
        sourceType
      });

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل مصادر Odoo");
    }

    renderSourceOptions(response.data?.options || []);
  } catch (error) {
    console.error(error);

    sourceOptionSelect.innerHTML = `
      <option value="">فشل تحميل المصادر</option>
    `;
  }
}

function renderSourceOptions(options) {
  const select = document.getElementById("sourceOptionId");
  if (!select) return;

  if (!options.length) {
    select.innerHTML = `
      <option value="">لا توجد مصادر متاحة لهذا النوع</option>
    `;
    return;
  }

  select.innerHTML = `
    <option value="">اختر المصدر</option>
    ${options.map((option) => {
      const labelParts = [];

      if (option.displayName) labelParts.push(option.displayName);
      else if (option.name) labelParts.push(option.name);

      if (option.code) labelParts.push(`[${option.code}]`);

      labelParts.push(`#${option.odooId}`);

      const label = labelParts.join(" ");

      return `
        <option
          value="${option.odooId}"
          data-name="${escapeHtml(option.displayName || option.name || "")}"
        >
          ${escapeHtml(label)}
        </option>
      `;
    }).join("")}
  `;
}

function applySelectedSourceOption() {
  const select = document.getElementById("sourceOptionId");
  const sourceOdooIdInput = document.getElementById("sourceOdooId");
  const sourceNameInput = document.getElementById("sourceName");

  if (!select) return;

  const selectedOption =
    select.options[select.selectedIndex];

  const selectedId = select.value || "";
  const selectedName =
    selectedOption?.dataset?.name ||
    selectedOption?.textContent ||
    "";

  if (sourceOdooIdInput) {
    sourceOdooIdInput.value = selectedId;
  }

  if (sourceNameInput) {
    sourceNameInput.value = selectedName
      .replace(/\s+#\d+$/, "")
      .trim();
  }
}

function updateLinkPreview() {
  const previewBox = document.getElementById("linkPreviewBox");
  if (!previewBox) return;

  const branchSelect = document.getElementById("sourceBranchId");
  const sourceTypeSelect = document.getElementById("sourceType");
  const sourceOptionSelect = document.getElementById("sourceOptionId");
  const sourceOdooId = document.getElementById("sourceOdooId")?.value || "";
  const sourceName = document.getElementById("sourceName")?.value || "";
  const notes = document.getElementById("sourceNotes")?.value || "";

  const branchName =
    branchSelect?.options?.[branchSelect.selectedIndex]?.textContent?.trim() || "";

  const sourceTypeLabel =
    sourceTypeSelect?.options?.[sourceTypeSelect.selectedIndex]?.textContent?.trim() || "";

  const selectedSourceLabel =
    sourceOptionSelect?.options?.[sourceOptionSelect.selectedIndex]?.textContent?.trim() || "";

  if (!branchSelect?.value || !sourceTypeSelect?.value || !sourceOptionSelect?.value) {
    previewBox.innerHTML = `
      <strong>${editingSourceId ? "وضع التعديل مفعل." : "لسه الربط غير مكتمل."}</strong>
      <br />
      اختار الفرع + نوع المصدر + المصدر من Odoo، وبعدها اضغط حفظ.
    `;
    return;
  }

  previewBox.innerHTML = `
    <strong>${editingSourceId ? "تأكيد تعديل الربط:" : "تأكيد قبل الحفظ:"}</strong>
    <br />
    أنت الآن ${editingSourceId ? "تعدل ربط" : "تربط"}:
    <br />
    <strong>${escapeHtml(branchName)}</strong>
    <br />
    مع:
    <br />
    <strong>${escapeHtml(sourceTypeLabel)}</strong>
    —
    <strong>${escapeHtml(sourceName || selectedSourceLabel)}</strong>
    <br />
    Odoo ID:
    <strong>#${escapeHtml(sourceOdooId)}</strong>
    ${
      notes
        ? `<br />ملاحظة: <strong>${escapeHtml(notes)}</strong>`
        : ""
    }
  `;
}

function clearBranchSourceForm() {
  editingSourceId = null;

  const fields = [
    "sourceBranchId",
    "sourceOptionId",
    "sourceOdooId",
    "sourceName",
    "sourceNotes"
  ];

  fields.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.value = "";
  });

  const saveBtn = document.getElementById("saveBranchSourceBtn");

  if (saveBtn) {
    saveBtn.textContent = "✅ حفظ الربط الآن";
    saveBtn.style.background = "#16a34a";
  }

  updateLinkPreview();
}

function renderBranchesOverview(data) {
  hideBranchesPendingBox();
  renderBranchesKpis(data.summary || {});
  renderBranchesTable(data.branches || []);
  renderBranchSources(data.branches || []);
  renderBranchesNotes(data.notes || []);
  renderBranchSourceFormOptions(data.branches || []);
  updateLinkPreview();
}

function formatNumber(value, digits = 0) {
  const num = Number(value || 0);

  return num.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function canManageBranchSources() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const permissions = Array.isArray(user.permissions)
      ? user.permissions
      : [];

    const roles = Array.isArray(user.roles)
      ? user.roles
      : [];

    if (permissions.includes("*")) return true;
    if (permissions.includes("branches.manage")) return true;
    if (user.role === "admin" || user.role === "super_admin") return true;

    return roles.some((role) => {
      return ["admin", "super_admin"].includes(role.code);
    });
  } catch {
    return false;
  }
}

function renderBranchesKpis(summary) {
  const container = document.getElementById("branchesKpiGrid");
  if (!container) return;

  const cards = [
    {
      title: "عدد الفروع",
      value: formatNumber(summary.branchesCount),
      hint: "كل الفروع المسجلة للشركة"
    },
    {
      title: "فروع نشطة",
      value: formatNumber(summary.activeBranchesCount),
      hint: "الفروع المتاحة للتقارير"
    },
    {
      title: "مصادر مرتبطة",
      value: formatNumber(summary.sourcesCount),
      hint: "إجمالي مصادر Odoo المرتبطة بالفروع"
    },
    {
      title: "مصادر POS",
      value: formatNumber(summary.posSourcesCount),
      hint: "عدد نقاط البيع المرتبطة بالفروع"
    },
    {
      title: "مصادر مخزون",
      value: formatNumber(summary.stockSourcesCount),
      hint: "مواقع مخزنية مرتبطة بالفروع"
    },
    {
      title: "مستودعات",
      value: formatNumber(summary.warehouseSourcesCount),
      hint: "مستودعات مرتبطة بالفروع"
    }
  ];

  container.innerHTML = cards
    .map((card) => `
      <div class="inventory-kpi-card">
        <span>${card.title}</span>
        <strong>${card.value}</strong>
        <small>${card.hint}</small>
      </div>
    `)
    .join("");
}

function renderBranchesTable(branches) {
  const container = document.getElementById("branchesTableBox");
  if (!container) return;

  if (!branches.length) {
    container.innerHTML = `
      <div class="inventory-empty">
        لا توجد فروع مسجلة لهذه الشركة.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="inventory-table-wrap">
      <table class="inventory-data-table">
        <thead>
          <tr>
            <th>الفرع</th>
            <th>الكود</th>
            <th>الشركة</th>
            <th>الحالة</th>
            <th>مصادر POS</th>
            <th>مصادر مخزون</th>
            <th>إجمالي المصادر</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${branches.map((branch) => `
            <tr>
              <td>${escapeHtml(branch.branchNameAr || branch.branchName || "-")}</td>
              <td>${escapeHtml(branch.branchCode || "-")}</td>
              <td>${branch.companyId === 1 ? "فيرجينيا" : "كليوباترا"}</td>
              <td>
                <span class="status-chip ${branch.isActive ? "active" : "inactive"}">
                  ${branch.statusLabel || (branch.isActive ? "نشط" : "موقوف")}
                </span>
              </td>
              <td>${formatNumber(branch.posSourcesCount)}</td>
              <td>${formatNumber(branch.stockSourcesCount)}</td>
              <td>${formatNumber(branch.sourcesCount)}</td>
              <td>${escapeHtml(branch.notes || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderBranchSources(branches) {
  const container = document.getElementById("branchSourcesBox");
  if (!container) return;

  const rows = [];

  branches.forEach((branch) => {
    (branch.sources || []).forEach((source) => {
      rows.push({
        sourceId: source.sourceId || source.id,
        branchId: branch.branchId,
        branchName: branch.branchNameAr || branch.branchName,
        sourceTypeLabel: source.sourceTypeLabel || source.sourceType,
        sourceType: source.sourceType,
        sourceOdooId: source.sourceOdooId,
        sourceName: source.sourceName,
        notes: source.notes || "",
        isActive: source.isActive
      });
    });
  });

  if (!rows.length) {
    container.innerHTML = `
      <div class="inventory-empty">
        لم يتم ربط مصادر Odoo بالفروع حتى الآن.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="inventory-table-wrap">
      <table class="inventory-data-table">
        <thead>
          <tr>
            <th>الفرع</th>
            <th>نوع المصدر</th>
            <th>Odoo ID</th>
            <th>اسم المصدر</th>
            <th>الحالة</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.branchName || "-")}</td>
              <td>${escapeHtml(row.sourceTypeLabel || row.sourceType || "-")}</td>
              <td>${row.sourceOdooId || "-"}</td>
              <td>${escapeHtml(row.sourceName || "-")}</td>
              <td>
                <span class="status-chip ${row.isActive ? "active" : "inactive"}">
                  ${row.isActive ? "نشط" : "موقوف"}
                </span>
              </td>
              <td>
                ${renderSourceActions(row)}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSourceActions(row) {
  if (!canManageBranchSources()) {
    return `<span class="inventory-muted-text">بدون صلاحية</span>`;
  }

  const encoded = encodeURIComponent(JSON.stringify(row));

  return `
    <button
      type="button"
      onclick="editBranchSource('${encoded}')"
      style="
        border: 0;
        border-radius: 10px;
        padding: 8px 12px;
        margin: 2px;
        background: #2563eb;
        color: #fff;
        font-weight: 800;
        cursor: pointer;
      "
    >
      تعديل
    </button>

    <button
      type="button"
      onclick="disableBranchSource(${Number(row.sourceId)})"
      style="
        border: 0;
        border-radius: 10px;
        padding: 8px 12px;
        margin: 2px;
        background: #dc2626;
        color: #fff;
        font-weight: 800;
        cursor: pointer;
      "
    >
      حذف من التقرير
    </button>
  `;
}

async function editBranchSource(encodedRow) {
  const row = JSON.parse(decodeURIComponent(encodedRow));

  editingSourceId = row.sourceId;

  const branchSelect = document.getElementById("sourceBranchId");
  const sourceTypeSelect = document.getElementById("sourceType");
  const sourceOdooIdInput = document.getElementById("sourceOdooId");
  const sourceNameInput = document.getElementById("sourceName");
  const sourceNotesInput = document.getElementById("sourceNotes");
  const saveBtn = document.getElementById("saveBranchSourceBtn");

  if (branchSelect) branchSelect.value = row.branchId;
  if (sourceTypeSelect) sourceTypeSelect.value = row.sourceType;

  await loadSourceOptions();

  const sourceOptionSelect = document.getElementById("sourceOptionId");

  if (sourceOptionSelect) {
    sourceOptionSelect.value = String(row.sourceOdooId || "");
  }

  if (sourceOdooIdInput) sourceOdooIdInput.value = row.sourceOdooId || "";
  if (sourceNameInput) sourceNameInput.value = row.sourceName || "";
  if (sourceNotesInput) sourceNotesInput.value = row.notes || "";

  if (saveBtn) {
    saveBtn.textContent = "✅ حفظ التعديل الآن";
    saveBtn.style.background = "#2563eb";
  }

  updateLinkPreview();

  document.getElementById("linkPreviewBox")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

async function disableBranchSource(sourceId) {
  const companyId = getSelectedCompanyId();

  if (!companyId) {
    alert("لازم تختار الشركة قبل تعطيل الربط.");
    return;
  }

  const ok = confirm(
    "تأكيد حذف الربط من التقارير؟\n\nلن يتم مسح السجل نهائيًا، سيتم تعطيله فقط حتى لا يدخل في التقارير."
  );

  if (!ok) return;

  try {
    const response =
      await apiPatch(
        `/branches/sources/${sourceId}/status`,
        {
          companyId,
          isActive: false
        }
      );

    if (!response.success) {
      throw new Error(response.message || "فشل تعطيل الربط");
    }

    await loadBranchesOverview();

    alert("تم تعطيل الربط بنجاح ولن يدخل في التقارير.");
  } catch (error) {
    console.error(error);
    alert(error.message || "حدث خطأ أثناء تعطيل الربط");
  }
}

function renderBranchesNotes(notes) {
  const container = document.getElementById("branchesNotesBox");
  if (!container) return;

  if (!notes.length) {
    container.innerHTML = `<p>لا توجد ملاحظات.</p>`;
    return;
  }

  container.innerHTML = `
    <ul>
      ${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
    </ul>
  `;
}

function renderBranchSourceFormOptions(branches) {
  const select = document.getElementById("sourceBranchId");
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = `
    <option value="">اختر الفرع</option>
    ${branches.map((branch) => `
      <option value="${branch.branchId}">
        ${escapeHtml(branch.branchNameAr || branch.branchName)}
      </option>
    `).join("")}
  `;

  const stillExists = Array.from(select.options).some(
    (option) => option.value === currentValue
  );

  if (stillExists) {
    select.value = currentValue;
  }
}

async function saveBranchSource() {
  const branchId = document.getElementById("sourceBranchId")?.value || "";
  const sourceType = document.getElementById("sourceType")?.value || "";
  const sourceOdooId = document.getElementById("sourceOdooId")?.value || "";
  const sourceName = document.getElementById("sourceName")?.value || "";
  const notes = document.getElementById("sourceNotes")?.value || "";

  const companyId = getSelectedCompanyId();

  if (!companyId) {
    alert("لازم تختار الشركة قبل حفظ الربط.");
    return;
  }

  if (!branchId) {
    alert("اختار الفرع الأول.");
    return;
  }

  if (!sourceType) {
    alert("اختار نوع المصدر.");
    return;
  }

  if (!sourceOdooId) {
    alert("اختار المصدر من Odoo.");
    return;
  }

  const wasEditing = Boolean(editingSourceId);

  const confirmSave = confirm(
    wasEditing
      ? `تأكيد تعديل الربط؟\n\nسيتم تعديل الربط إلى:\n${sourceName}`
      : `تأكيد الحفظ؟\n\nسيتم ربط المصدر:\n${sourceName}\n\nبالفرع المختار.`
  );

  if (!confirmSave) return;

  const button = document.getElementById("saveBranchSourceBtn");

  try {
    if (button) {
      button.disabled = true;
      button.textContent = wasEditing ? "جاري تعديل الربط..." : "جاري الحفظ...";
    }

    const payload = {
      companyId,
      branchId,
      sourceType,
      sourceOdooId: Number(sourceOdooId),
      sourceName,
      notes
    };

    const response = wasEditing
      ? await apiPatch(
          `/branches/sources/${editingSourceId}`,
          payload
        )
      : await apiPost(
          `/branches/${branchId}/sources`,
          payload
        );

    if (!response.success) {
      throw new Error(
        response.message ||
        (wasEditing ? "فشل تعديل الربط" : "فشل حفظ المصدر")
      );
    }

    editingSourceId = null;

    document.getElementById("sourceOptionId").value = "";
    document.getElementById("sourceOdooId").value = "";
    document.getElementById("sourceName").value = "";
    document.getElementById("sourceNotes").value = "";

    if (button) {
      button.textContent = "✅ حفظ الربط الآن";
      button.style.background = "#16a34a";
    }

    await loadBranchesOverview();

    alert(wasEditing ? "تم تعديل الربط بنجاح." : "تم حفظ ربط المصدر بنجاح.");
  } catch (error) {
    console.error(error);
    alert(error.message || "حدث خطأ أثناء حفظ المصدر");
  } finally {
    if (button) {
      button.disabled = false;

      if (!editingSourceId) {
        button.textContent = "✅ حفظ الربط الآن";
        button.style.background = "#16a34a";
      }
    }

    updateLinkPreview();
  }
}