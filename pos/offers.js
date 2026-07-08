(function () {
  document.addEventListener("DOMContentLoaded", () => {
    renderLayout(
      "العروض وتأثيرها",
      "تحليل قيمة الهدايا والتنازلات حسب قوائم أسعار الفروع، مع أثرها على الهامش.",
      "pos-offers",
      buildOffersPage()
    );

    initOffersPage();
    renderInitialState();
  });

  function buildOffersPage() {
    return `
      <main class="inventory-page">
        <section id="offersLoading" class="inventory-loading-box" style="display:none;">
          جاري تحميل تقرير العروض...
        </section>

        <section id="offersError" class="inventory-error-box" style="display:none;"></section>

        <section id="offersPendingBox" class="inventory-panel">
          <div class="inventory-panel-header">
            <div>
              <h2>التقرير لم يتم تحميله بعد</h2>
              <p>
                اختار الشركة ثم الفرع / النطاق من الهيدر، وبعدها اضغط
                <strong>تحديث التقرير</strong>
                لعرض بيانات العروض.
              </p>
            </div>
          </div>
        </section>

        <section id="offersKpis" class="inventory-kpi-grid"></section>

        <section class="inventory-panel pos-offers-section">
          <div class="inventory-panel-header">
            <div>
              <h2>ملخص العروض</h2>
              <p>
                ملخص العرض حسب اسمه الرسمي في Odoo مع عدد مرات التطبيق الحقيقي
                وقيمة الهدية أو التنازل والهامش.
              </p>
            </div>
          </div>

          <div id="offersSummaryTable"></div>
        </section>

        <section class="inventory-panel pos-offers-section">
          <div class="inventory-panel-header">
            <div>
              <h2>تفاصيل التقرير</h2>
              <p>
                تفاصيل الفروع والمنتجات والفواتير والمردود لا تُعرض في المتصفح
                لتخفيف الصفحة. استخدم Excel للتفاصيل الكاملة.
              </p>
            </div>
          </div>

          <div id="offersExportOnlyNotice"></div>
        </section>

        <section class="inventory-panel pos-offers-section">
          <div class="inventory-panel-header">
            <div>
              <h2>ملاحظات تحليلية</h2>
              <p>قواعد الحساب والتصنيف المستخدمة في التقرير.</p>
            </div>
          </div>

          <div id="offersNotes"></div>
        </section>
      </main>
    `;
  }

  function initOffersPage() {
    const refreshBtn = document.getElementById("refreshPosOffersBtn");
    const loadBtn = document.getElementById("loadBtn");
    const companySelect = document.getElementById("companySelect");

    refreshBtn?.addEventListener("click", loadOffersReport);
    loadBtn?.addEventListener("click", loadOffersReport);

    companySelect?.addEventListener("change", async () => {
      await applyReportFiltersForPage("pos-offers");
      renderFilterChangedState();
    });

    document.addEventListener("change", (event) => {
      const target = event.target;

      if (!target) return;

      if (
        target.id === "branchCode" ||
        target.id === "datePreset" ||
        target.id === "dateFrom" ||
        target.id === "dateTo"
      ) {
        renderFilterChangedState();
      }
    });
  }

  async function applyReportFiltersForPage(activePage) {
    for (let i = 0; i < 30; i += 1) {
      if (window.ReportFilters?.apply) {
        await window.ReportFilters.apply(activePage);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  function renderInitialState() {
    showLoading(false);
    showError("");
    clearReport();
    hideReportSections();

    showPendingMessage(
      "التقرير لم يتم تحميله بعد",
      "اختار الشركة ثم الفرع / النطاق من الهيدر، وبعدها اضغط تحديث التقرير لعرض بيانات العروض."
    );
  }

  function renderFilterChangedState() {
    showLoading(false);
    showError("");
    clearReport();
    hideReportSections();

    showPendingMessage(
      "تم تغيير الفلاتر",
      "اضغط تحديث التقرير لتطبيق الشركة والفرع والفترة الجديدة."
    );
  }

  function showPendingMessage(title, message) {
    const pendingBox = document.getElementById("offersPendingBox");
    if (!pendingBox) return;

    pendingBox.style.display = "block";
    pendingBox.innerHTML = `
      <div class="inventory-panel-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(message)}</p>
        </div>
      </div>
    `;
  }

  function hidePendingBox() {
    const pendingBox = document.getElementById("offersPendingBox");
    if (!pendingBox) return;

    pendingBox.style.display = "none";
  }

  function hideReportSections() {
    document.querySelectorAll(".pos-offers-section").forEach((section) => {
      section.style.display = "none";
    });
  }

  function showReportSections() {
    document.querySelectorAll(".pos-offers-section").forEach((section) => {
      section.style.display = "";
    });
  }

  function clearReport() {
    [
      "offersKpis",
      "offersSummaryTable",
      "offersExportOnlyNotice",
      "offersNotes"
    ].forEach((id) => {
      const element = document.getElementById(id);

      if (element) {
        element.innerHTML = "";
      }
    });
  }

  function getSelectedCompanyId() {
    return document.getElementById("companySelect")?.value || "";
  }

  function getSelectedBranchCode() {
    return document.getElementById("branchCode")?.value || "";
  }

  function validateOffersContext() {
    const companyId = getSelectedCompanyId();
    const branchCode = getSelectedBranchCode();

    if (!companyId) {
      return {
        ok: false,
        message: "لازم تختار الشركة قبل تحميل تقرير العروض."
      };
    }

    if (!branchCode) {
      return {
        ok: false,
        message: "لازم تختار الفرع أو كل الفروع المسموحة قبل تحميل تقرير العروض."
      };
    }

    return {
      ok: true
    };
  }

  function getFilters(mode = "summary") {
    const isExport = mode === "export";

    return {
      companyId: getSelectedCompanyId(),
      dateFrom: document.getElementById("dateFrom")?.value || "",
      dateTo: document.getElementById("dateTo")?.value || "",
      branchCode: getSelectedBranchCode(),

      mode,

      limit: isExport ? 100000 : 5000,
      linesLimit: isExport ? 250000 : 50000
    };
  }

  async function loadOffersReport() {
    const validation = validateOffersContext();

    if (!validation.ok) {
      showError(validation.message);
      return;
    }

    showLoading(true);
    showError("");

    try {
      const response = await apiGet("/pos/offers", getFilters("summary"));

      if (!response?.success) {
        throw new Error(response?.message || "فشل تحميل تقرير العروض");
      }

      hidePendingBox();
      showReportSections();
      renderReport(response.data || {});
    } catch (error) {
      console.error(error);
      showError(error.message || "حدث خطأ أثناء تحميل تقرير العروض");
    } finally {
      showLoading(false);
    }
  }

  function renderReport(data) {
    renderKpis(data.summary || {});
    renderOffersSummary(data.offerSummary || []);
    renderExportOnlyNotice(data.detailCounts || {});
    renderNotes(data.notes || []);
  }

  function renderKpis(summary) {
    const container = document.getElementById("offersKpis");
    if (!container) return;

    const cards = [
      {
        title: "العروض المستخدمة",
        value: formatNumber(summary.activeOffersCount),
        hint: "عدد العروض أو التركيبات التي ظهرت في الفترة"
      },
      {
        title: "الفواتير المتأثرة",
        value: formatNumber(summary.affectedOrders),
        hint: "عدد الفواتير التي ظهر بها عرض أو Combo"
      },
      {
        title: "مرات التطبيق الحقيقي",
        value: formatNumber(summary.applicationCount),
        hint: "محسوبة من كمية الهدايا/التنازلات وليس من عدد السطور"
      },
      {
        title: "كمية مدفوعة",
        value: formatNumber(summary.paidQty),
        hint: "الكمية التي دفع العميل مقابلها داخل العروض"
      },
      {
        title: "كمية هدية / مخفضة",
        value: formatNumber(summary.giftQty),
        hint: "كمية الهدايا أو الأصناف المخفضة داخل العروض"
      },
      {
        title: "إجمالي قيمة الهدايا/التنازلات",
        value: formatMoney(summary.expectedOfferValue),
        hint: "القيمة الإدارية المتوقعة حسب سعر الفرع"
      },
      {
        title: "خصم Odoo المسجل",
        value: formatMoney(summary.odooRecordedDiscountValue),
        hint: "ما ظهر فعليًا كسطر خصم داخل Odoo"
      },
      {
        title: "فرق التحقق",
        value: formatMoney(summary.verificationDiff),
        hint: "المتوقع إداريًا - المسجل في Odoo"
      },
      {
        title: "أصل القيمة",
        value: formatMoney(summary.originalValue),
        hint: "قيمة المنتجات قبل العرض حسب السعر المرجعي"
      },
      {
        title: "المحصل",
        value: formatMoney(summary.collectedValue),
        hint: "ما تم تحصيله فعليًا من العميل"
      },
      {
        title: "تكلفة المنتجات",
        value: formatMoney(summary.productCost),
        hint: "تكلفة المنتجات الداخلة في العرض"
      },
      {
        title: "الهامش قبل العرض",
        value: formatMoney(summary.grossMarginBeforeOffer),
        hint: "أصل القيمة - تكلفة المنتجات"
      },
      {
        title: "الهامش بعد العرض",
        value: formatMoney(summary.grossMarginAfterOffer),
        hint: "المحصل - تكلفة المنتجات"
      },
      {
        title: "انخفاض الهامش",
        value: formatPercent(summary.marginDropPercent),
        hint: formatMoney(summary.marginDropValue)
      },
      {
        title: "صافي أثر العروض",
        value: formatMoney(summary.netRevenueImpact),
        hint: "إجمالي أثر العرض بعد عزل مردود العروض"
      },
      {
        title: "أعلى عرض تكلفة",
        value: summary.topOfferName || "-",
        hint: formatMoney(summary.topOfferValue)
      }
    ];

    container.innerHTML = cards.map(renderKpiCard).join("");
  }

  function renderKpiCard(card) {
    return `
      <article class="inventory-kpi-card">
        <p>${escapeHtml(card.title)}</p>
        <strong>${escapeHtml(card.value)}</strong>
        <span>${escapeHtml(card.hint || "")}</span>
      </article>
    `;
  }

  function renderOffersSummary(rows) {
    renderTable("offersSummaryTable", rows, [
      ["اسم العرض", "offerName"],
      ["نوع العرض", "offerType"],
      ["مصدر العرض", "offerSource"],
      ["مرات التطبيق الحقيقي", "applicationCount", formatNumber],
      ["عدد السطور المحتسبة", "usesCount", formatNumber],
      ["فواتير متأثرة", "affectedOrders", formatNumber],
      ["منتجات متأثرة", "affectedProducts", formatNumber],
      ["فروع متأثرة", "affectedBranches", formatNumber],
      ["قوائم سعر", "affectedPricelists", formatNumber],
      ["كمية مدفوعة", "paidQty", formatNumber],
      ["كمية هدية/مخفضة", "giftQty", formatNumber],
      ["أصل القيمة", "originalValue", formatMoney],
      ["المحصل", "collectedValue", formatMoney],
      ["قيمة الهدية/التنازل", "expectedOfferValue", formatMoney],
      ["خصم Odoo المسجل", "odooRecordedDiscountValue", formatMoney],
      ["فرق التحقق", "verificationDiff", formatMoney],
      ["خصم Reward", "rewardDiscountValue", formatMoney],
      ["خصم Combo", "comboDiscountValue", formatMoney],
      ["إجمالي خصم العرض", "offerDiscountValue", formatMoney],
      ["مردود مبيعات وعروض", "salesAndOffersReturns", formatMoney],
      ["صافي الأثر", "netRevenueImpact", formatMoney],
      ["تكلفة المنتجات", "productCost", formatMoney],
      ["الهامش قبل العرض", "grossMarginBeforeOffer", formatMoney],
      ["الهامش بعد العرض", "grossMarginAfterOffer", formatMoney],
      ["انخفاض الهامش", "marginDropValue", formatMoney],
      ["انخفاض الهامش %", "marginDropPercent", formatPercent],
      ["هامش بعد العرض %", "grossMarginAfterOfferPercent", formatPercent],
      ["متوسط تكلفة التطبيق", "averageCostPerApplication", formatMoney],
      ["متوسط سعر الهدية", "averageGiftUnitPrice", formatMoney],
      ["التقييم", "evaluation"]
    ]);
  }

  function renderExportOnlyNotice(detailCounts) {
    const container = document.getElementById("offersExportOnlyNotice");
    if (!container) return;

    const productDetails = detailCounts.productDetails || 0;
    const branchDetails = detailCounts.branchDetails || 0;
    const orderDetails = detailCounts.orderDetails || 0;
    const refundDetails = detailCounts.refundDetails || 0;
    const excludedSalesReturns = detailCounts.excludedSalesReturns || 0;

    container.innerHTML = `
      <div class="inventory-empty-box">
        التفاصيل الثقيلة لا تُعرض في المتصفح.
        <br>
        المنتجات: ${escapeHtml(formatNumber(productDetails))}
        |
        الفروع: ${escapeHtml(formatNumber(branchDetails))}
        |
        الفواتير: ${escapeHtml(formatNumber(orderDetails))}
        |
        مردود العروض: ${escapeHtml(formatNumber(refundDetails))}
        |
        مردود مبيعات مستبعد: ${escapeHtml(formatNumber(excludedSalesReturns))}
        <br>
        استخدم زر تصدير Excel للحصول على التفاصيل الكاملة.
      </div>
    `;
  }

  function renderNotes(notes) {
    const container = document.getElementById("offersNotes");
    if (!container) return;

    if (!notes.length) {
      container.innerHTML = `<p class="inventory-empty-text">لا توجد ملاحظات.</p>`;
      return;
    }

    container.innerHTML = `
      <ul class="inventory-notes-list">
        ${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
    `;
  }

  function renderTable(containerId, rows, columns) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!Array.isArray(rows) || !rows.length) {
      container.innerHTML = `
        <div class="inventory-empty-box">
          لا توجد بيانات في الفترة المحددة.
        </div>
      `;
      return;
    }

    const header = columns
      .map(([label]) => `<th>${escapeHtml(label)}</th>`)
      .join("");

    const body = rows
      .map((row) => {
        const cells = columns.map(([label, key, formatter]) => {
          const rawValue = row ? row[key] : "";
          const value = formatter ? formatter(rawValue, row) : rawValue;

          return `<td>${escapeHtml(value)}</td>`;
        }).join("");

        return `<tr>${cells}</tr>`;
      })
      .join("");

    container.innerHTML = `
      <div class="inventory-table-wrapper">
        <table class="inventory-table">
          <thead>
            <tr>${header}</tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function showLoading(isLoading) {
    const loading = document.getElementById("offersLoading");

    if (loading) {
      loading.style.display = isLoading ? "block" : "none";
    }
  }

  function showError(message) {
    const errorBox = document.getElementById("offersError");
    if (!errorBox) return;

    if (!message) {
      errorBox.style.display = "none";
      errorBox.textContent = "";
      return;
    }

    errorBox.style.display = "block";
    errorBox.textContent = message;
  }

  function formatMoney(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  }

  function formatNumber(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat("ar-EG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(number);
  }

  function formatPercent(value) {
    return `${formatNumber(value)}%`;
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
})();