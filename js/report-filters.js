(function () {
  function escapeHtml(value) {
    if (value === null || value === undefined) return "";

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getCurrentCompanyId() {
    if (typeof getCompanyId === "function") {
      return getCompanyId();
    }

    return (
      document.getElementById("companySelect")?.value ||
      localStorage.getItem("companyId") ||
      ""
    );
  }

  function getCurrentActivePage() {
    return (
      window.ACTIVE_PAGE ||
      document.body?.dataset?.activePage ||
      ""
    );
  }

  function getReportCode(activePage) {
    return typeof getReportCodeForPage === "function"
      ? getReportCodeForPage(activePage)
      : "";
  }

  async function loadReportFilterOptions(activePage, extraParams = {}) {
    const reportCode = getReportCode(activePage);

    if (!reportCode) {
      console.warn("No report code found for page", activePage);
      return null;
    }

    const companyId = getCurrentCompanyId();

    if (!companyId) {
      return {
        branchFilter: {
          enabled: false
        },
        branches: []
      };
    }

    const response = await apiGet("/report-filters/options", {
      report: reportCode,
      companyId,
      ...extraParams
    });

    return response.data || response;
  }

  function ensureGlobalBranchFilterField() {
    let field = document.getElementById("branchScopeField");

    if (field) {
      return {
        field,
        select: document.getElementById("branchCode")
      };
    }

    const toolbar = document.getElementById("reportToolbar");
    const filterRow = toolbar?.querySelector(".filter-row");

    if (!filterRow) {
      return {
        field: null,
        select: null
      };
    }

    field = document.createElement("label");
    field.id = "branchScopeField";
    field.className = "context-field branch-context-field";
    field.style.display = "none";

    field.innerHTML = `
      <span style="display:block;font-size:12px;font-weight:800;margin-bottom:6px;color:#e5f3ff;">
        الفرع / النطاق
      </span>

      <select id="branchCode" class="control branch-control">
        <option value="">اختر الشركة أولًا</option>
      </select>
    `;

    const loadBtn = document.getElementById("loadBtn");

    if (loadBtn && loadBtn.parentElement === filterRow) {
      filterRow.insertBefore(field, loadBtn);
    } else {
      filterRow.appendChild(field);
    }

    return {
      field,
      select: document.getElementById("branchCode")
    };
  }

  function getStoredBranchCode() {
    if (typeof getBranchCode === "function") {
      return getBranchCode();
    }

    return localStorage.getItem("branchCode") || "";
  }

  function storeBranchCode(value) {
    if (typeof setBranchCode === "function") {
      setBranchCode(value);
      return;
    }

    if (!value) {
      localStorage.removeItem("branchCode");
      return;
    }

    localStorage.setItem("branchCode", value);
  }

  function hideBranchFilter(field, select) {
    if (field) {
      field.style.display = "none";
    }

    if (select) {
      select.innerHTML = "";
      select.dataset.required = "false";
    }
  }

  function renderBranchOptions(select, options) {
    const { field } = ensureGlobalBranchFilterField();

    if (!select) return;

    const branchFilter = options?.branchFilter || {};
    const branches = Array.isArray(options?.branches)
      ? options.branches
      : [];

    if (!branchFilter.enabled) {
      hideBranchFilter(field, select);
      return;
    }

    if (field) {
      field.style.display = "block";
    }

    select.dataset.required = "true";

    const canSelectAll = branchFilter.canSelectAll !== false;

    const placeholder =
      `<option value="">اختر الفرع / النطاق</option>`;

    const allOption = canSelectAll
      ? `<option value="all">كل الفروع المسموحة</option>`
      : "";

    const branchOptions = branches
      .map((branch) => {
        const branchCode =
          branch.branchCode ||
          branch.code ||
          branch.sourceCode ||
          branch.branchId ||
          "";

        const branchName =
          branch.branchName ||
          branch.name ||
          branch.branchNameAr ||
          branchCode;

        return `
          <option value="${escapeHtml(branchCode)}">
            ${escapeHtml(branchName)}
          </option>
        `;
      })
      .join("");

    select.innerHTML = `${placeholder}${allOption}${branchOptions}`;

    const storedBranchCode = getStoredBranchCode();

    const hasStoredOption = Array.from(select.options).some((option) => {
      return String(option.value) === String(storedBranchCode);
    });

    if (storedBranchCode && hasStoredOption) {
      select.value = storedBranchCode;
    } else {
      select.value = "";
      storeBranchCode("");
    }

    select.onchange = () => {
      storeBranchCode(select.value);

      window.dispatchEvent(
        new CustomEvent("branch-context-changed", {
          detail: {
            branchCode: select.value
          }
        })
      );
    };
  }

  async function applyReportFilters(activePage, options = {}) {
    const { field, select } = ensureGlobalBranchFilterField();

    if (!select) {
      return null;
    }

    const companyId = getCurrentCompanyId();

    if (!companyId) {
      hideBranchFilter(field, select);
      return null;
    }

    const filterOptions =
      await loadReportFilterOptions(activePage, options.params || {});

    if (!filterOptions) return null;

    renderBranchOptions(select, filterOptions);

    return filterOptions;
  }

  function isElementVisible(element) {
    if (!element) return false;

    return Boolean(
      element.offsetWidth ||
      element.offsetHeight ||
      element.getClientRects().length
    );
  }

  function validateReportContext() {
    const companyId = getCurrentCompanyId();

    if (!companyId) {
      return {
        ok: false,
        message: "لازم تختار الشركة قبل تحميل التقرير."
      };
    }

    const branchField = document.getElementById("branchScopeField");
    const branchSelect = document.getElementById("branchCode");

    const branchRequired =
      branchSelect?.dataset?.required === "true" &&
      isElementVisible(branchField);

    if (branchRequired && !branchSelect.value) {
      return {
        ok: false,
        message: "لازم تختار الفرع أو كل الفروع المسموحة قبل تحميل التقرير."
      };
    }

    return {
      ok: true
    };
  }

  function bindContextValidation() {
    const loadBtn = document.getElementById("loadBtn");

    if (!loadBtn || loadBtn.dataset.contextValidationBound === "true") {
      return;
    }

    loadBtn.dataset.contextValidationBound = "true";

    loadBtn.addEventListener(
      "click",
      (event) => {
        const validation = validateReportContext();

        if (!validation.ok) {
          event.preventDefault();
          event.stopImmediatePropagation();
          alert(validation.message);
        }
      },
      true
    );
  }

  function bindCompanyChange(activePage) {
    const companySelect = document.getElementById("companySelect");

    if (!companySelect || companySelect.dataset.reportFiltersBound === "true") {
      return;
    }

    companySelect.dataset.reportFiltersBound = "true";

    companySelect.addEventListener("change", async () => {
      storeBranchCode("");

      try {
        await applyReportFilters(activePage);
      } catch (error) {
        console.warn("Could not reload branch filters", error.message);
      }
    });
  }

  async function setup(activePage = getCurrentActivePage(), options = {}) {
    if (!activePage) return null;

    ensureGlobalBranchFilterField();
    bindContextValidation();
    bindCompanyChange(activePage);

    try {
      return await applyReportFilters(activePage, options);
    } catch (error) {
      console.warn("Could not apply report filters", error.message);
      return null;
    }
  }

  window.ReportFilters = {
    setup,
    loadOptions: loadReportFilterOptions,
    apply: applyReportFilters,
    validate: validateReportContext
  };
})();