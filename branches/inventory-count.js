let currentInventoryCountReport = null;
let currentSessionId = null;

document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "جرد الفرع اللحظي",
    "تقرير رقابي لحظي يثبت فرق كل صنف عند لحظة تصديق الكمية حتى لا تتأثر مبيعات لاحقة بفروق الجرد.",
    "branches-inventory-count",
    buildInventoryCountContent()
  );

  bindInventoryCountEvents();
  renderInitialState();
});

function buildInventoryCountContent() {
  return `
    <div class="report-ui-page mi-bootstrap-page">
      <section class="report-card">
        <div class="report-card-head">
          <h2>إعداد جلسة الجرد</h2>
          <p>
            التقرير رقابي فقط ولا يعدل Odoo. اختار الشركة من الهيدر، ثم الفرع من هنا.
            تحميل الجلسة المفتوحة أو بدء جلسة جديدة يتم فقط بالزر.
          </p>
        </div>

        <div class="report-filter-grid">
          <label class="report-field">
            الفرع
            <select id="branchFilter" class="report-select">
              <option value="">اختر الشركة أولًا</option>
            </select>
          </label>

          <label class="report-field">
            ملاحظة بداية الجرد
            <input id="sessionNotes" class="report-input" type="text" placeholder="اختياري" />
          </label>

          <button id="loadOpenSessionBtn" type="button" class="report-btn-primary">
            تحميل الجلسة المفتوحة
          </button>
        </div>

        <div
          style="
            margin-top: 12px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: flex-end;
          "
        >
          <button id="startSessionBtn" type="button" class="report-btn-primary" style="background:#16a34a;">
            بدء جلسة جرد
          </button>

          <button id="recalculateSessionBtn" type="button" class="report-btn-primary" style="background:#2563eb;">
            تحديث الأرصدة اللحظية
          </button>

          <button id="closeSessionBtn" type="button" class="report-btn-primary" style="background:#dc2626;">
            إغلاق الجلسة
          </button>
        </div>
      </section>

      <section id="inventoryCountLoadingBox" class="hidden"></section>
      <section id="inventoryCountErrorBox" class="hidden"></section>

      <section id="sessionInfoBox" class="report-card">
        <div class="report-empty">
          اختار الشركة ثم الفرع، وبعدها حمّل الجلسة المفتوحة أو ابدأ جلسة جرد.
        </div>
      </section>

      <section id="inventoryCountKpis" class="report-kpi-grid"></section>

      <section class="report-card inventory-count-report-section">
        <div class="report-card-head">
          <h2>أصناف الجرد</h2>
          <p>
            الرصيد المتوقع لكل صنف يتم تثبيته عند لحظة تصديق السطر فقط.
            البيع بعد تصديق الصنف لا يدخل في فرق الجرد الخاص به.
          </p>
        </div>

        <div class="report-filter-grid" style="grid-template-columns: 1fr 180px 180px;">
          <label class="report-field">
            بحث عن صنف
            <input id="productSearch" class="report-input" type="text" placeholder="اكتب اسم الصنف..." />
          </label>

          <label class="report-field">
            حالة السطر
            <select id="lineStatusFilter" class="report-select">
              <option value="">كل السطور</option>
              <option value="not_counted">غير مجرود</option>
              <option value="shortage">عجز</option>
              <option value="overage">زيادة</option>
              <option value="matched">مطابق</option>
            </select>
          </label>

          <button id="applyLineFilterBtn" type="button" class="report-btn-primary">
            تطبيق
          </button>
        </div>

        <div style="margin-top: 14px;" id="inventoryCountTableBox"></div>
      </section>

      <section class="report-grid-2 inventory-count-report-section">
        <div class="report-card">
          <div class="report-card-head">
            <h2>تحليل إداري</h2>
          </div>
          <div id="inventoryCountRecommendationsBox" class="report-analysis"></div>
        </div>

        <div class="report-card">
          <div class="report-card-head">
            <h2>ملاحظات الاحتساب</h2>
          </div>
          <div id="inventoryCountNotesBox" class="report-analysis"></div>
        </div>
      </section>
    </div>
  `;
}

function bindInventoryCountEvents() {
  const companySelect = document.getElementById("companySelect");
  const branchFilter = document.getElementById("branchFilter");

  const globalLoadBtn = document.getElementById("loadBtn");
  const loadOpenSessionBtn = document.getElementById("loadOpenSessionBtn");
  const startSessionBtn = document.getElementById("startSessionBtn");
  const recalculateSessionBtn = document.getElementById("recalculateSessionBtn");
  const closeSessionBtn = document.getElementById("closeSessionBtn");

  const productSearch = document.getElementById("productSearch");
  const lineStatusFilter = document.getElementById("lineStatusFilter");
  const applyLineFilterBtn = document.getElementById("applyLineFilterBtn");

  if (globalLoadBtn) {
    globalLoadBtn.addEventListener("click", loadOpenSession);
  }

  if (companySelect) {
    companySelect.addEventListener("change", async () => {
      resetInventoryCountState();
      await loadBranchOptions();

      showSessionMessage(
        "تم تغيير الشركة. اختار الفرع، وبعدها حمّل الجلسة المفتوحة أو ابدأ جلسة جرد."
      );
    });
  }

  if (branchFilter) {
    branchFilter.addEventListener("change", () => {
      resetInventoryCountState();

      showSessionMessage(
        "تم تغيير الفرع. اضغط تحميل الجلسة المفتوحة أو ابدأ جلسة جرد جديدة."
      );
    });
  }

  if (loadOpenSessionBtn) {
    loadOpenSessionBtn.addEventListener("click", loadOpenSession);
  }

  if (startSessionBtn) {
    startSessionBtn.addEventListener("click", startInventoryCountSession);
  }

  if (recalculateSessionBtn) {
    recalculateSessionBtn.addEventListener("click", recalculateInventoryCountSession);
  }

  if (closeSessionBtn) {
    closeSessionBtn.addEventListener("click", closeInventoryCountSession);
  }

  if (productSearch) {
    productSearch.addEventListener("input", () => {
      if (!currentInventoryCountReport) return;
      renderInventoryCountTable();
    });
  }

  if (lineStatusFilter) {
    lineStatusFilter.addEventListener("change", () => {
      if (!currentInventoryCountReport) return;
      renderInventoryCountTable();
    });
  }

  if (applyLineFilterBtn) {
    applyLineFilterBtn.addEventListener("click", () => {
      if (!currentInventoryCountReport) return;
      renderInventoryCountTable();
    });
  }

  window.saveInventoryCountLine = confirmInventoryCountLine;
  window.confirmInventoryCountLine = confirmInventoryCountLine;
  window.loadInventoryCountSession = loadInventoryCountSession;
  window.getCurrentInventoryCountSessionId = () => currentSessionId;
  window.loadInventoryCountBranchOptions = loadBranchOptions;
}

function renderInitialState() {
  resetInventoryCountState();

  const branchSelect = document.getElementById("branchFilter");

  if (branchSelect) {
    branchSelect.innerHTML = `<option value="">اختر الشركة أولًا</option>`;
    branchSelect.value = "";
  }

  showSessionMessage(
    "اختار الشركة ثم الفرع، وبعدها حمّل الجلسة المفتوحة أو ابدأ جلسة جرد."
  );
}

function resetInventoryCountState() {
  currentSessionId = null;
  currentInventoryCountReport = null;

  ReportUI.hideLoading("inventoryCountLoadingBox");
  ReportUI.clearError("inventoryCountErrorBox");

  clearReport();
  hideInventoryCountReportSections();
}

function showSessionMessage(message) {
  const sessionInfoBox = document.getElementById("sessionInfoBox");
  if (!sessionInfoBox) return;

  sessionInfoBox.innerHTML = `
    <div class="report-empty">
      ${ReportUI.escapeHtml(message)}
    </div>
  `;
}

function hideInventoryCountReportSections() {
  document.querySelectorAll(".inventory-count-report-section").forEach((section) => {
    section.classList.add("hidden");
  });
}

function showInventoryCountReportSections() {
  document.querySelectorAll(".inventory-count-report-section").forEach((section) => {
    section.classList.remove("hidden");
  });
}

function getCompanyId() {
  return document.getElementById("companySelect")?.value || "";
}

function getBranchId() {
  return document.getElementById("branchFilter")?.value || "";
}

function validateCompanyAndBranch() {
  const companyId = getCompanyId();
  const branchId = getBranchId();

  if (!companyId) {
    return {
      ok: false,
      message: "لازم تختار الشركة أولًا."
    };
  }

  if (!branchId) {
    return {
      ok: false,
      message: "لازم تختار الفرع أولًا."
    };
  }

  return {
    ok: true
  };
}

function validateCompanyOnly() {
  const companyId = getCompanyId();

  if (!companyId) {
    return {
      ok: false,
      message: "لازم تختار الشركة أولًا."
    };
  }

  return {
    ok: true
  };
}

async function loadBranchOptions() {
  const select = document.getElementById("branchFilter");
  if (!select) return;

  const currentValue = select.value || "";
  const companyId = getCompanyId();

  if (!companyId) {
    select.innerHTML = `<option value="">اختر الشركة أولًا</option>`;
    select.value = "";
    return;
  }

  try {
    const response = await apiGet("/branches/overview", { companyId });
    const branches = response.data?.branches || [];

    select.innerHTML = `
      <option value="">اختر الفرع</option>
      ${branches.map((branch) => `
        <option value="${branch.branchId}">
          ${ReportUI.escapeHtml(branch.branchNameAr || branch.branchName)}
        </option>
      `).join("")}
    `;

    const stillExists = Array.from(select.options).some(
      (option) => option.value === currentValue
    );

    select.value = stillExists ? currentValue : "";
  } catch (error) {
    console.error(error);
    select.innerHTML = `<option value="">تعذر تحميل الفروع</option>`;
    select.value = "";
  }
}

function clearReport() {
  const sessionInfoBox = document.getElementById("sessionInfoBox");
  const kpisBox = document.getElementById("inventoryCountKpis");
  const tableBox = document.getElementById("inventoryCountTableBox");
  const recommendationsBox = document.getElementById("inventoryCountRecommendationsBox");
  const notesBox = document.getElementById("inventoryCountNotesBox");

  if (sessionInfoBox) {
    sessionInfoBox.innerHTML = `
      <div class="report-empty">
        اختار الشركة ثم الفرع، وبعدها حمّل الجلسة المفتوحة أو ابدأ جلسة جرد.
      </div>
    `;
  }

  if (kpisBox) kpisBox.innerHTML = "";
  if (tableBox) tableBox.innerHTML = "";
  if (recommendationsBox) recommendationsBox.innerHTML = "";
  if (notesBox) notesBox.innerHTML = "";
}

async function loadOpenSession() {
  const validation = validateCompanyAndBranch();

  if (!validation.ok) {
    ReportUI.showError("inventoryCountErrorBox", validation.message);
    return;
  }

  const branchId = getBranchId();

  try {
    ReportUI.showLoading("inventoryCountLoadingBox", "جاري البحث عن جلسة جرد مفتوحة...");
    ReportUI.clearError("inventoryCountErrorBox");

    const response = await apiGet("/branches/inventory-count/open", {
      companyId: getCompanyId(),
      branchId
    });

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل الجلسة المفتوحة");
    }

    const data = response.data || {};

    if (!data.hasOpenSession || !data.session) {
      currentSessionId = null;
      currentInventoryCountReport = null;
      clearReport();
      hideInventoryCountReportSections();

      showSessionMessage(
        "لا توجد جلسة جرد مفتوحة لهذا الفرع. اضغط بدء جلسة جرد."
      );

      return;
    }

    currentSessionId = data.session.sessionId;
    await loadInventoryCountSession(currentSessionId);
  } catch (error) {
    console.error(error);
    ReportUI.showError("inventoryCountErrorBox", error);
  } finally {
    ReportUI.hideLoading("inventoryCountLoadingBox");
  }
}

async function startInventoryCountSession() {
  const validation = validateCompanyAndBranch();

  if (!validation.ok) {
    alert(validation.message);
    return;
  }

  const branchId = getBranchId();
  const notes = document.getElementById("sessionNotes")?.value || "";

  const ok = confirm(
    "تأكيد بدء جلسة الجرد؟\n\nسيتم تثبيت رصيد بداية الجرد الآن. كل صنف سيتم تصديقه في وقته، وسيتم خصم مبيعات POS من بداية الجلسة حتى لحظة تصديق هذا الصنف فقط."
  );

  if (!ok) return;

  try {
    ReportUI.showLoading("inventoryCountLoadingBox", "جاري بدء جلسة الجرد وسحب رصيد البداية...");
    ReportUI.clearError("inventoryCountErrorBox");

    const response = await apiPost("/branches/inventory-count/start", {
      companyId: getCompanyId(),
      branchId,
      notes
    });

    if (!response.success) {
      throw new Error(response.message || "فشل بدء جلسة الجرد");
    }

    currentInventoryCountReport = response.data;
    currentSessionId = response.data?.session?.sessionId || null;

    showInventoryCountReportSections();
    renderInventoryCountReport(response.data || {});
  } catch (error) {
    console.error(error);
    ReportUI.showError("inventoryCountErrorBox", error);
  } finally {
    ReportUI.hideLoading("inventoryCountLoadingBox");
  }
}

async function loadInventoryCountSession(sessionId) {
  if (!sessionId) return;

  const validation = validateCompanyOnly();

  if (!validation.ok) {
    ReportUI.showError("inventoryCountErrorBox", validation.message);
    return;
  }

  try {
    ReportUI.showLoading("inventoryCountLoadingBox", "جاري تحميل جلسة الجرد...");
    ReportUI.clearError("inventoryCountErrorBox");

    const response = await apiGet(`/branches/inventory-count/${sessionId}`, {
      companyId: getCompanyId()
    });

    if (!response.success) {
      throw new Error(response.message || "فشل تحميل جلسة الجرد");
    }

    currentInventoryCountReport = response.data;
    currentSessionId = response.data?.session?.sessionId || null;

    showInventoryCountReportSections();
    renderInventoryCountReport(response.data || {});
  } catch (error) {
    console.error(error);
    ReportUI.showError("inventoryCountErrorBox", error);
  } finally {
    ReportUI.hideLoading("inventoryCountLoadingBox");
  }
}

async function recalculateInventoryCountSession() {
  if (!currentSessionId) {
    alert("لا توجد جلسة جرد مفتوحة محملة.");
    return;
  }

  const validation = validateCompanyOnly();

  if (!validation.ok) {
    alert(validation.message);
    return;
  }

  try {
    ReportUI.showLoading("inventoryCountLoadingBox", "جاري تحديث الأرصدة اللحظية للأصناف غير المصدق عليها...");
    ReportUI.clearError("inventoryCountErrorBox");

    const response = await apiPost(`/branches/inventory-count/${currentSessionId}/recalculate`, {
      companyId: getCompanyId()
    });

    if (!response.success) {
      throw new Error(response.message || "فشل تحديث الأرصدة");
    }

    currentInventoryCountReport = response.data;
    showInventoryCountReportSections();
    renderInventoryCountReport(response.data || {});
  } catch (error) {
    console.error(error);
    ReportUI.showError("inventoryCountErrorBox", error);
  } finally {
    ReportUI.hideLoading("inventoryCountLoadingBox");
  }
}


async function confirmInventoryCountLine(lineId) {
  if (!currentSessionId) {
    alert("لا توجد جلسة جرد مفتوحة.");
    return;
  }

  const validation = validateCompanyOnly();

  if (!validation.ok) {
    alert(validation.message);
    return;
  }

  const countedInput = document.getElementById(`countedQuantity_${lineId}`);
  const notesInput = document.getElementById(`lineNotes_${lineId}`);

  const countedQuantity = countedInput ? String(countedInput.value || "").trim() : "";
  const notes = notesInput ? notesInput.value : "";

  if (countedQuantity === "") {
    alert("اكتب كمية الجرد الفعلية قبل التصديق.");
    return;
  }

  const row =
    (currentInventoryCountReport?.rows || [])
      .find((item) => Number(item.lineId) === Number(lineId));

  if (row && isLineConfirmed(row)) {
    alert("هذا السطر تم تصديقه بالفعل.");
    return;
  }

  const productName = row?.productName || "الصنف المحدد";

  const ok = confirm(
    `تأكيد تصديق كمية الجرد للصنف: ${productName}؟\n\n` +
    "سيتم تسجيل وقت التصديق الآن، واحتساب مبيعات POS من بداية الجلسة حتى هذه اللحظة فقط.\n" +
    "أي بيع بعد التصديق لن يدخل في فرق هذا الصنف."
  );

  if (!ok) return;

  try {
    const response = await apiPatch(
      `/branches/inventory-count/${currentSessionId}/lines/${lineId}`,
      {
        companyId: getCompanyId(),
        countedQuantity,
        notes
      }
    );

    if (!response.success) {
      throw new Error(response.message || "فشل تصديق كمية الجرد");
    }

    currentInventoryCountReport = response.data;
    showInventoryCountReportSections();
    renderInventoryCountReport(response.data || {});
  } catch (error) {
    console.error(error);
    alert(error.message || "حدث خطأ أثناء تصديق كمية الجرد");
  }
}

async function closeInventoryCountSession() {
  if (!currentSessionId || !currentInventoryCountReport) {
    alert("لا توجد جلسة جرد مفتوحة محملة.");
    return;
  }

  const validation = validateCompanyOnly();

  if (!validation.ok) {
    alert(validation.message);
    return;
  }

  const summary = currentInventoryCountReport.summary || {};

  const ok = confirm(
    `تأكيد إغلاق جلسة الجرد؟\n\n` +
    `عدد الأصناف غير المجردة: ${summary.notCountedLinesCount || 0}\n` +
    `عدد أصناف العجز: ${summary.shortageLinesCount || 0}\n` +
    `عدد أصناف الزيادة: ${summary.overageLinesCount || 0}\n\n` +
    `التقرير رقابي فقط ولن يتم تعديل Odoo.`
  );

  if (!ok) return;

  try {
    ReportUI.showLoading("inventoryCountLoadingBox", "جاري إغلاق جلسة الجرد...");
    ReportUI.clearError("inventoryCountErrorBox");

    const notes = document.getElementById("sessionNotes")?.value || "";

    const response = await apiPost(`/branches/inventory-count/${currentSessionId}/close`, {
      companyId: getCompanyId(),
      notes
    });

    if (!response.success) {
      throw new Error(response.message || "فشل إغلاق جلسة الجرد");
    }

    currentInventoryCountReport = response.data;
    showInventoryCountReportSections();
    renderInventoryCountReport(response.data || {});
    alert("تم إغلاق جلسة الجرد. التقرير جاهز للإدارة.");
  } catch (error) {
    console.error(error);
    ReportUI.showError("inventoryCountErrorBox", error);
  } finally {
    ReportUI.hideLoading("inventoryCountLoadingBox");
  }
}

function renderInventoryCountReport(data) {
  currentInventoryCountReport = data;
  currentSessionId = data?.session?.sessionId || currentSessionId;

  renderSessionInfo(data.session || {});
  renderInventoryCountKpis(data.summary || {});
  renderInventoryCountTable();

  ReportUI.renderRecommendations(
    "inventoryCountRecommendationsBox",
    data.recommendations || []
  );

  ReportUI.renderNotes(
    "inventoryCountNotesBox",
    data.notes || []
  );
}

function renderSessionInfo(session) {
  const container = document.getElementById("sessionInfoBox");
  if (!container) return;

  if (!session.sessionId) {
    container.innerHTML = `
      <div class="report-empty">
        لا توجد جلسة محملة.
      </div>
    `;
    return;
  }

  const statusType = session.status === "OPEN" ? "good" : "info";
  const statusText = session.status === "OPEN" ? "مفتوحة" : "مغلقة";

  container.innerHTML = `
    <div class="report-card-head">
      <h2>بيانات جلسة الجرد</h2>
      <p>هذه الجلسة لا تقوم بأي تعديل على Odoo، فقط تقرير رقابي للإدارة.</p>
    </div>

    <div class="report-table-wrap">
      <table class="report-table" style="min-width: 760px;">
        <tbody>
          <tr>
            <th>رقم الجلسة</th>
            <td>#${ReportUI.escapeHtml(session.sessionId)}</td>
            <th>الفرع</th>
            <td>${ReportUI.escapeHtml(session.displayName || "-")}</td>
          </tr>
          <tr>
            <th>الحالة</th>
            <td>${ReportUI.statusPill(statusText, statusType)}</td>
            <th>بداية الجرد</th>
            <td>${formatDateTime(session.startedAt)}</td>
          </tr>
          <tr>
            <th>نهاية الجرد</th>
            <td>${session.endedAt ? formatDateTime(session.endedAt) : "-"}</td>
            <th>ملاحظات</th>
            <td>${ReportUI.escapeHtml(session.notes || "-")}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderInventoryCountKpis(summary) {
  ReportUI.renderKpis("inventoryCountKpis", [
    {
      title: "عدد الأصناف",
      value: ReportUI.number(summary.linesCount),
      hint: "إجمالي أصناف الجلسة"
    },
    {
      title: "تم جرده",
      value: ReportUI.number(summary.countedLinesCount),
      hint: "أصناف لها كمية فعلية"
    },
    {
      title: "غير مجرود",
      value: ReportUI.number(summary.notCountedLinesCount),
      hint: "أصناف لم يتم تسجيلها"
    },
    {
      title: "بيع محتسب",
      value: ReportUI.number(summary.posSoldQuantity, 3),
      hint: "حتى وقت التصديق أو الآن لغير المصدق"
    },
    {
      title: "الرصيد المتوقع",
      value: ReportUI.number(summary.expectedAvailableQuantity, 3),
      hint: "بداية الجرد - البيع المحتسب"
    },
    {
      title: "فرق الجرد",
      value: ReportUI.number(summary.differenceQuantity, 3),
      hint: "الفعلي - المتوقع"
    }
  ]);
}

function getFilteredRows() {
  const data = currentInventoryCountReport || {};
  const rows = Array.isArray(data.rows) ? data.rows : [];

  const search =
    document.getElementById("productSearch")?.value?.trim().toLowerCase() || "";

  const status =
    document.getElementById("lineStatusFilter")?.value || "";

  return rows.filter((row) => {
    const name = String(row.productName || "").toLowerCase();

    if (search && !name.includes(search)) {
      return false;
    }

    if (!status) {
      return true;
    }

    const counted = isLineConfirmed(row);

    const diff = Number(row.differenceQuantity || 0);

    if (status === "not_counted") {
      return !counted;
    }

    if (status === "shortage") {
      return counted && diff < 0;
    }

    if (status === "overage") {
      return counted && diff > 0;
    }

    if (status === "matched") {
      return counted && diff === 0;
    }

    return true;
  });
}


function renderInventoryCountTable() {
  const rows = getFilteredRows();

  ReportUI.renderTable("inventoryCountTableBox", {
    rows,
    minWidth: 1500,
    emptyMessage: "لا توجد أصناف مطابقة للفلاتر.",
    columns: [
      {
        key: "productName",
        label: "الصنف",
        width: "240px",
        className: "report-cell-strong",
        format: (value) => ReportUI.escapeHtml(value || "-")
      },
      {
        key: "startAvailableQuantity",
        label: "بداية الجرد",
        width: "110px",
        format: (value) => ReportUI.number(value, 3)
      },
      {
        key: "posSoldQuantity",
        label: "بيع محتسب",
        width: "120px",
        format: (value, row) => renderPosSoldQuantity(row)
      },
      {
        key: "expectedAvailableQuantity",
        label: "المتوقع وقت العد",
        width: "130px",
        className: "report-money-strong",
        format: (value, row) => renderExpectedQuantity(row)
      },
      {
        key: "countedQuantity",
        label: "الجرد الفعلي",
        width: "140px",
        format: (_, row) => renderCountInput(row)
      },
      {
        key: "countedAt",
        label: "وقت الجرد",
        width: "145px",
        format: (_, row) => renderCountedAt(row)
      },
      {
        key: "differenceQuantity",
        label: "الفرق",
        width: "110px",
        format: (value, row) => renderDifference(row)
      },
      {
        key: "notes",
        label: "ملاحظة",
        width: "170px",
        format: (_, row) => renderLineNotes(row)
      },
      {
        key: "actions",
        label: "تصديق",
        width: "110px",
        format: (_, row) => renderConfirmButton(row)
      }
    ]
  });
}

function isSessionOpen() {
  return currentInventoryCountReport?.session?.status === "OPEN";
}

function isLineConfirmed(row) {
  return Boolean(
    row?.countedAt ||
    (
      row?.countedQuantity !== null &&
      row?.countedQuantity !== undefined
    )
  );
}

function renderPosSoldQuantity(row) {
  const label = isLineConfirmed(row) ? "حتى التصديق" : "حتى الآن";

  return `
    <div class="report-stack">
      <b>${ReportUI.number(row.posSoldQuantity, 3)}</b>
      <small>${ReportUI.escapeHtml(label)}</small>
    </div>
  `;
}

function renderExpectedQuantity(row) {
  const label = isLineConfirmed(row) ? "مثبت" : "لحظي";

  return `
    <div class="report-stack">
      <b>${ReportUI.number(row.expectedAvailableQuantity, 3)}</b>
      <small>${ReportUI.escapeHtml(label)}</small>
    </div>
  `;
}


function renderCountInput(row) {
  const value =
    row.countedQuantity === null ||
    row.countedQuantity === undefined
      ? ""
      : row.countedQuantity;

  if (isLineConfirmed(row)) {
    return `
      <div class="report-stack">
        <b>${ReportUI.number(value, 3)}</b>
        <small>تم التصديق</small>
      </div>
    `;
  }

  const disabled = isSessionOpen() ? "" : "disabled";

  return `
    <input
      id="countedQuantity_${row.lineId}"
      class="report-input"
      type="number"
      step="0.001"
      value="${ReportUI.escapeHtml(value)}"
      ${disabled}
      style="height:34px; font-size:12px;"
    />
  `;
}

function renderCountedAt(row) {
  if (!isLineConfirmed(row)) {
    return ReportUI.statusPill("لم يصدق", "warn");
  }

  return `
    <div class="report-stack">
      <b>${formatDateTime(row.countedAt || row.lastCalculatedAt)}</b>
      <small>وقت تثبيت الفرق</small>
    </div>
  `;
}

function renderLineNotes(row) {
  const disabled =
    isSessionOpen() && !isLineConfirmed(row)
      ? ""
      : "disabled";

  return `
    <input
      id="lineNotes_${row.lineId}"
      class="report-input"
      type="text"
      value="${ReportUI.escapeHtml(row.notes || "")}"
      ${disabled}
      style="height:34px; font-size:12px;"
      placeholder="اختياري"
    />
  `;
}

function renderConfirmButton(row) {
  if (!isSessionOpen()) {
    return ReportUI.statusPill("مغلقة", "info");
  }

  if (isLineConfirmed(row)) {
    return ReportUI.statusPill("تم التصديق", "good");
  }

  return `
    <button
      type="button"
      onclick="confirmInventoryCountLine(${Number(row.lineId)})"
      class="report-btn-primary"
      style="height:34px; min-width:82px; font-size:11px; background:#16a34a;"
    >
      تصديق
    </button>
  `;
}

function renderDifference(row) {
  const counted = isLineConfirmed(row);

  if (!counted) {
    return ReportUI.statusPill("لم يجرد", "warn");
  }

  const diff = Number(row.differenceQuantity || 0);

  if (diff < 0) {
    return `
      <div class="report-stack">
        <div>${ReportUI.statusPill("عجز", "bad")}</div>
        <div><b>${ReportUI.number(diff, 3)}</b></div>
      </div>
    `;
  }

  if (diff > 0) {
    return `
      <div class="report-stack">
        <div>${ReportUI.statusPill("زيادة", "info")}</div>
        <div><b>${ReportUI.number(diff, 3)}</b></div>
      </div>
    `;
  }

  return ReportUI.statusPill("مطابق", "good");
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
