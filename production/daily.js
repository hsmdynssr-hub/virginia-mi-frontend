function safeNumber(value, digits = 2) {
  const number = Number(value || 0);
  const safeDigits = Math.min(Math.max(Number(digits || 0), 0), 6);

  return number.toLocaleString("ar-EG", {
    minimumFractionDigits: safeDigits,
    maximumFractionDigits: safeDigits
  });
}

function safePercent(value) {
  const number = Number(value || 0);
  return `${safeNumber(number, 2)}%`;
}

function buildProductRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    totalPlannedQtyText: safeNumber(row.totalPlannedQty, 3),
    totalProducedQtyText: safeNumber(row.totalProducedQty, 3),
    totalRemainingQtyText: safeNumber(row.totalRemainingQty, 3),
    completionPercentText: safePercent(row.completionPercent)
  }));
}

renderLayout(
  "تقرير الإنتاج اليومي",
  "متابعة أوامر التصنيع اليومية بصورة إدارية مختصرة",
  "production-daily",
  `<div id="reportArea"></div>`
);

function renderInitialState() {
  document.getElementById("reportArea").innerHTML = `
    <div class="report-panel">
      <h3>التقرير لم يتم تحميله بعد</h3>
      <p>اختار الفلاتر المطلوبة ثم اضغط <strong>تحديث التقرير</strong> لعرض البيانات.</p>
    </div>
  `;
}

function renderFilterChangedState() {
  document.getElementById("reportArea").innerHTML = `
    <div class="report-panel">
      <h3>تم تغيير الفلاتر</h3>
      <p>اضغط <strong>تحديث التقرير</strong> لتطبيق الفلاتر الجديدة.</p>
    </div>
  `;
}

async function loadReport() {
  try {
    showLoading();

    const report = await apiGet("/production/daily", getFilters());
    const data = report.data || {};

    const summary = data.analysis?.executiveSummary || {};
    const insights = data.analysis?.insights || [];
    const productSummary = buildProductRows(data.productSummary || []);

    const doneOrders = Number(summary.doneOrdersCount || 0);
    const inProgressOrders = Number(summary.inProgressOrdersCount || 0);
    const cancelledOrders = Number(summary.cancelledOrdersCount || 0);

    document.getElementById("reportArea").innerHTML = `
      ${renderKpis([
        kpiCard(
          "أوامر التصنيع",
          safeNumber(summary.totalOrders, 0),
          "إجمالي أوامر التصنيع خلال اليوم."
        ),

        kpiCard(
          "مكتمل",
          safeNumber(doneOrders, 0),
          "أوامر تصنيع تم إغلاقها."
        ),

        kpiCard(
          "تحت التشغيل",
          safeNumber(inProgressOrders, 0),
          "أوامر لم تغلق بعد."
        ),

        kpiCard(
          "نسبة الإنجاز",
          safePercent(summary.completionPercent),
          "المنتج فعليًا ÷ المخطط."
        )
      ])}

      ${renderKpis([
        kpiCard(
          "ملغي",
          safeNumber(cancelledOrders, 0),
          "أوامر تصنيع ملغية."
        ),

        kpiCard(
          "عدد المنتجات",
          safeNumber(productSummary.length, 0),
          "عدد المنتجات التي ظهر لها إنتاج."
        ),

        kpiCard(
          "إجمالي المخطط",
          safeNumber(summary.totalPlannedQty, 3),
          "إجمالي الكميات المخططة."
        ),

        kpiCard(
          "إجمالي المنتج",
          safeNumber(summary.totalProducedQty, 3),
          "إجمالي الكميات المنتجة فعليًا."
        )
      ])}

      ${renderPanel("التحليل الإداري", `
        <div class="analysis-box">
          ${
            insights.length
              ? insights.map((item) => `<p>${item}</p>`).join("")
              : "<p>لا يوجد تحليل متاح لهذا اليوم.</p>"
          }
        </div>
      `)}

      ${renderPanel("ملخص الإنتاج حسب المنتج", renderTable(
        [
          { key: "productName", label: "المنتج", hint: "اسم المنتج المصنع." },
          { key: "ordersCount", label: "عدد الأوامر", hint: "عدد أوامر التصنيع لهذا المنتج." },
          { key: "totalPlannedQtyText", label: "المخطط", hint: "إجمالي الكمية المخططة." },
          { key: "totalProducedQtyText", label: "المنتج", hint: "إجمالي الكمية المنتجة." },
          { key: "totalRemainingQtyText", label: "المتبقي", hint: "المخطط ناقص المنتج." },
          { key: "completionPercentText", label: "نسبة الإنجاز", hint: "المنتج ÷ المخطط." }
        ],
        productSummary
      ))}

      ${renderPanel("ملاحظة", `
        <div class="analysis-box">
          <p>الواجهة تعرض ملخصًا إداريًا فقط. التفاصيل الثقيلة لأوامر التصنيع يتم نقلها لاحقًا إلى Excel Export.</p>
        </div>
      `)}
    `;
  } catch (error) {
    showError(error);
  }
}

function bindFilterEvents() {
  [
    "companySelect",
    "dateFrom",
    "dateTo"
  ].forEach((id) => {
    document
      .getElementById(id)
      ?.addEventListener("change", renderFilterChangedState);
  });
}

document.getElementById("loadBtn")?.addEventListener("click", loadReport);

bindFilterEvents();
renderInitialState();