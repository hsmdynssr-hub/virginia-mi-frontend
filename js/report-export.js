(function () {
  const EXPORT_PAGES = new Set([
    "pos-summary",
    "pos-cashiers",
    "pos-peak-hours",
    "pos-branches",
  

    "customer-pos-phones",

    "forecast-target-report",

    "inventory-executive-summary",
    "inventory-intermediate-control",

    "production-mo-cost",

    "branches-sales",
    "branches-stock",
    "branches-replenishment",
    "branches-inventory-count",

    "alerts-dashboard",
    "review-coupons"
  ]);

  const BUILT_IN_REPORT_MAP = {
    "alerts-dashboard": "alerts.telegram_dashboard",
    "review-coupons": "customer.review_coupons"
  };

  const CUSTOM_PARAMS = {
    "review-coupons": () => {
      return {
        companyId: document.getElementById("companyId")?.value || "",
        status: document.getElementById("couponStatusFilter")?.value || "all",
        customerPhone: document.getElementById("couponPhoneFilter")?.value || "",
        dateFrom: document.getElementById("couponDateFrom")?.value || "",
        dateTo: document.getElementById("couponDateTo")?.value || "",
        limit: "100000"
      };
    },

    "alerts-dashboard": () => {
      return {
        companyId: document.getElementById("companySelect")?.value || "",
        eventType: document.getElementById("alertEventType")?.value || "all",
        status: document.getElementById("alertStatus")?.value || "all",
        branchName: document.getElementById("alertBranchName")?.value || "",
        cashierName: document.getElementById("alertCashierName")?.value || "",
        dateFrom: document.getElementById("dateFrom")?.value || "",
        dateTo: document.getElementById("dateTo")?.value || "",
        limit: "100000"
      };
    },

    "forecast-target-report": () => {
      const params = new URLSearchParams(window.location.search);

      return {
        targetId: params.get("targetId"),
        maxDepth: "10"
      };
    },

    "pos-summary": () => {
      return {
        branchCode:
          document.getElementById("branchCode")?.value || "all",
        mode: "export",
        limit: "100000",
        linesLimit: "250000"
      };
    },

    "pos-cashiers": () => {
      return {
        branchCode:
  document.getElementById("branchCode")?.value ||
  document.getElementById("cashierBranchCode")?.value ||
  "all",
        limit: "30000"
      };
    },

    "pos-peak-hours": () => {
      return {
        branchCode:
  document.getElementById("branchCode")?.value ||
  document.getElementById("peakHoursBranchCode")?.value ||
  "all",
        limit: "100000"
      };
    },

    "customer-pos-phones": () => {
      return {
        branchCode:
          document.getElementById("branchCode")?.value || "all",

        periodMode:
          document.getElementById("periodMode")?.value || "monthly",

        limit: "100000",
        linesLimit: "250000"
      };
    },

    "production-mo-cost": () => {
      return {
        state: "done",
        limit: "100000"
      };
    },

    "branches-sales": () => {
      return {
        branchCode:
          document.getElementById("branchFilter")?.value || "all"
      };
    },

    "branches-stock": () => {
      return {
        branchId:
          document.getElementById("branchFilter")?.value || ""
      };
    },

    "branches-replenishment": () => {
      return {
        branchId:
          document.getElementById("branchFilter")?.value || "",

        targetCoverDays:
          document.getElementById("targetCoverDays")?.value || "7",

        safetyDays:
          document.getElementById("safetyDays")?.value || "2",

        onlyNeeds:
          document.getElementById("onlyNeeds")?.value || "true"
      };
    },

    "branches-inventory-count": () => {
      const sessionId =
        typeof window.getCurrentInventoryCountSessionId === "function"
          ? window.getCurrentInventoryCountSessionId()
          : "";

      return {
        sessionId
      };
    }
  };

  function getReportCode(activePage) {
    if (BUILT_IN_REPORT_MAP[activePage]) {
      return BUILT_IN_REPORT_MAP[activePage];
    }

    if (typeof REPORT_PAGE_MAP === "undefined") {
      return "";
    }

    return REPORT_PAGE_MAP[activePage] || "";
  }

  function isPageExportEnabled(activePage) {
    if (!EXPORT_PAGES.has(activePage)) {
      return false;
    }

    const reportCode = getReportCode(activePage);

    if (!reportCode) {
      return false;
    }

    if (typeof hasPermission === "function") {
      if (["alerts-dashboard", "review-coupons"].includes(activePage)) return true;
      return hasPermission(activePage);
    }

    return true;
  }

  function getToken() {
    if (typeof getAuthToken === "function") {
      return getAuthToken();
    }

    if (typeof window.getToken === "function") {
      return window.getToken();
    }

    return localStorage.getItem("token") || "";
  }

  function getApiBaseUrl() {
    if (typeof API_BASE_URL !== "undefined") {
      return API_BASE_URL;
    }

    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return "http://localhost:5050/api";
    }

    return "https://odoo-mi-api.vercel.app/api";
  }

  function setParamIfValue(params, key, value) {
    if (value === undefined || value === null) return;

    const stringValue = String(value).trim();

    if (!stringValue) return;

    params.set(key, stringValue);
  }

  function collectStandardFilters(params) {
    const companyId = document.getElementById("companySelect")?.value;
    const dateFrom = document.getElementById("dateFrom")?.value;
    const dateTo = document.getElementById("dateTo")?.value;

    setParamIfValue(params, "companyId", companyId);
    setParamIfValue(params, "dateFrom", dateFrom);
    setParamIfValue(params, "dateTo", dateTo);

    document
      .querySelectorAll("input[id], select[id]")
      .forEach((element) => {
        const id = element.id;

        if (!id) return;

        if (
          [
            "companySelect",
            "datePreset",
            "dateFrom",
            "dateTo"
          ].includes(id)
        ) {
          return;
        }

        if (element.type === "password") return;

        if (element.type === "checkbox") {
          params.set(id, element.checked ? "true" : "false");
          return;
        }

        setParamIfValue(params, id, element.value);
      });
  }

  function buildExportParams(activePage) {
    const params = new URLSearchParams(window.location.search);
    const reportCode = getReportCode(activePage);

    params.set("report", reportCode);

    collectStandardFilters(params);

    const customGetter = CUSTOM_PARAMS[activePage];

    if (typeof customGetter === "function") {
      const customParams = customGetter() || {};

      Object.entries(customParams).forEach(([key, value]) => {
        setParamIfValue(params, key, value);
      });
    }

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

  function findHeroCard() {
    return document.querySelector("#reportToolbar")
      || document.querySelector(".report-toolbar")
      || document.querySelector(".filter-row")
      || document.querySelector(".inventory-hero-card")
      || document.querySelector(".dashboard-hero")
      || document.querySelector(".panel")
      || document.querySelector(".report-card");
  }

  function findRefreshButton(hero) {
    if (!hero) return null;

    return hero.querySelector("#loadBtn")
      || hero.querySelector(".inventory-refresh-btn")
      || hero.querySelector("#refreshTargetReportBtn")
      || hero.querySelector("#refreshBranchSalesBtn")
      || hero.querySelector("#loadBranchSalesBtn")
      || hero.querySelector("#loadBranchStockBtn")
      || hero.querySelector("#loadReplenishmentBtn")
      || hero.querySelector("#loadOpenSessionBtn")
      || document.getElementById("loadBtn");
  }

  function ensureButtonWrapper(refreshButton) {
    if (!refreshButton) return null;

    const parent = refreshButton.parentElement;

    if (!parent) return null;

    const isGoodWrapper =
      parent.dataset?.exportButtonWrapper === "true";

    if (isGoodWrapper) {
      return parent;
    }

    const wrapper = document.createElement("div");

    wrapper.dataset.exportButtonWrapper = "true";
    wrapper.style.display = "flex";
    wrapper.style.gap = "10px";
    wrapper.style.alignItems = "center";
    wrapper.style.flexWrap = "wrap";

    parent.insertBefore(wrapper, refreshButton);
    wrapper.appendChild(refreshButton);

    return wrapper;
  }

  function createExportButton(activePage) {
    const button = document.createElement("button");

    button.type = "button";
    button.id = "reportExportExcelBtn";
    button.className = "inventory-refresh-btn export-btn report-btn-primary";
    button.textContent = "تصدير Excel";

    button.addEventListener("click", () => {
      downloadExcel(activePage);
    });

    return button;
  }

  function removeOldTopExportBar() {
    document.querySelectorAll(".export-bar").forEach((item) => {
      item.remove();
    });
  }

  function removeDuplicateExportButtons() {
    const buttons = Array.from(
      document.querySelectorAll("#reportExportExcelBtn")
    );

    buttons.slice(1).forEach((button) => button.remove());
  }

  async function downloadExcel(activePage) {
    const button = document.getElementById("reportExportExcelBtn");
    const reportCode = getReportCode(activePage);

    if (!reportCode) {
      alert("لا يوجد كود تصدير لهذا التقرير");
      return;
    }

    try {
      if (button) {
        button.disabled = true;
        button.textContent = "جاري التصدير...";
      }

      const params = buildExportParams(activePage);
      const token = getToken();

      if (
        activePage === "branches-inventory-count" &&
        !params.get("sessionId")
      ) {
        alert("لا توجد جلسة جرد محملة للتصدير.");
        return;
      }

      const exportUrl = activePage === "alerts-dashboard"
        ? `${getApiBaseUrl()}/alerts/dashboard/export/excel?${params.toString()}`
        : activePage === "review-coupons"
          ? `${getApiBaseUrl()}/customer/review-sms/coupons/export/excel?${params.toString()}`
          : `${getApiBaseUrl()}/exports/excel?${params.toString()}`;

      const response = await fetch(
        exportUrl,
        {
          method: "GET",
          headers: {
            ...(activePage === "review-coupons"
              ? { "x-admin-key": localStorage.getItem("reviewSmsAdminKey") || "" }
              : token
                ? { Authorization: `Bearer ${token}` }
                : {})
          },
          cache: "no-store"
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
        button.textContent = "تصدير Excel";
      }
    }
  }

  function setup(activePage) {
    removeOldTopExportBar();

    if (!isPageExportEnabled(activePage)) {
      return;
    }

    if (document.getElementById("reportExportExcelBtn")) {
      removeDuplicateExportButtons();
      return;
    }

    const hero = findHeroCard();

    if (!hero) return;

    const refreshButton = findRefreshButton(hero);

    if (refreshButton) {
      const wrapper = ensureButtonWrapper(refreshButton);

      if (wrapper) {
        wrapper.appendChild(createExportButton(activePage));
        return;
      }
    }

    hero.appendChild(createExportButton(activePage));
  }

  window.ReportExport = {
    setup,
    downloadExcel,
    exportExcel: downloadExcel,
    buildExportParams
  };
})();
