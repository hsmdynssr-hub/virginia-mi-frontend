function safeNumber(value, digits = 2) {
  const number = Number(value || 0);
  const safeDigits = Math.min(Math.max(Number(digits || 0), 0), 6);

  return number.toLocaleString("ar-EG", {
    minimumFractionDigits: safeDigits,
    maximumFractionDigits: safeDigits
  });
}

function safePercent(value) {
  if (value === null || value === undefined || value === "") {
    return "لا يوجد";
  }

  return `${safeNumber(value, 2)}%`;
}

function formatCostSource(source) {
  const map = {
    finished_good_valuation: "قيمة المنتج التام",
    raw_material_consumption: "استهلاك الخامات",
    no_valuation: "لا توجد Valuation"
  };

  return map[source] || source || "غير محدد";
}

function formatRisk(row) {
  const label = row.statusLabel || "";

  if (row.riskLevel === "high") return `⚠️ ${label}`;
  if (row.riskLevel === "low") return `✅ ${label}`;

  return label || "طبيعي";
}

function buildMoCostRows(rows) {
  return (rows || []).map((row) => ({
    ...row,

    producedQtyText: safeNumber(row.producedQty, 3),
    totalCostText: safeNumber(row.totalCost, 2),
    currentUnitCostText: safeNumber(row.currentUnitCost, 4),

    previousMoUnitCostText:
      row.previousMoUnitCost > 0
        ? safeNumber(row.previousMoUnitCost, 4)
        : "لا يوجد",

    previousMonthUnitCostText:
      row.previousMonthUnitCost > 0
        ? safeNumber(row.previousMonthUnitCost, 4)
        : "لا يوجد",

    diffVsPreviousMoText:
      row.diffVsPreviousMo === null || row.diffVsPreviousMo === undefined
        ? "لا يوجد"
        : safeNumber(row.diffVsPreviousMo, 4),

    diffVsPreviousMoPercentText: safePercent(row.diffVsPreviousMoPercent),

    diffVsPreviousMonthText:
      row.diffVsPreviousMonth === null || row.diffVsPreviousMonth === undefined
        ? "لا يوجد"
        : safeNumber(row.diffVsPreviousMonth, 4),

    diffVsPreviousMonthPercentText: safePercent(row.diffVsPreviousMonthPercent),

    costSourceText: formatCostSource(row.costSource),
    riskText: formatRisk(row)
  }));
}

function buildProductSummaryRows(rows) {
  return (rows || []).map((row) => ({
    ...row,

    producedQtyText: safeNumber(row.producedQty, 3),
    totalCostText: safeNumber(row.totalCost, 2),
    weightedUnitCostText: safeNumber(row.weightedUnitCost, 4)
  }));
}

renderLayout(
  "تقرير تكلفة أمر التصنيع",
  "تحليل تكلفة الوحدة الفعلية حسب valuation ومقارنتها بالأمر السابق والشهر السابق",
  "production-mo-cost",
  `<div id="reportArea"></div>`
);

function renderInitialState() {
  const reportArea = document.getElementById("reportArea");

  if (!reportArea) return;

  reportArea.innerHTML = `
    <div class="report-panel">
      <h3>التقرير لم يتم تحميله بعد</h3>
      <p>
        اختار الفلاتر المطلوبة ثم اضغط
        <strong>تحديث التقرير</strong>
        لعرض تكلفة أوامر التصنيع.
      </p>
    </div>
  `;
}

function renderFilterChangedState() {
  const reportArea = document.getElementById("reportArea");

  if (!reportArea) return;

  reportArea.innerHTML = `
    <div class="report-panel">
      <h3>تم تغيير الفلاتر</h3>
      <p>
        اضغط
        <strong>تحديث التقرير</strong>
        لتطبيق الفلاتر الجديدة.
      </p>
    </div>
  `;
}

async function loadMoCostReport() {
  try {
    showLoading();

    const report = await apiGet("/production/mo-cost", {
      ...getFilters(),
      state: "done",
      limit: 500
    });

    const data = report.data || {};
    const summary = data.summary || {};

    const rows = buildMoCostRows(data.rows || []);
    const productSummary = buildProductSummaryRows(data.productSummary || []);

    const analysis = data.analysis || {};
    const insights = analysis.insights || [];
    const risks = analysis.risks || [];
    const recommendations = analysis.recommendations || [];
    const warnings = data.warnings || [];

    document.getElementById("reportArea").innerHTML = `
      ${renderKpis([
        kpiCard(
          "أوامر التصنيع",
          safeNumber(summary.ordersCount, 0),
          "عدد أوامر التصنيع المكتملة في الفترة."
        ),

        kpiCard(
          "الكمية المنتجة",
          safeNumber(summary.producedQty, 3),
          "إجمالي كمية المنتج التام."
        ),

        kpiCard(
          "إجمالي التكلفة",
          safeNumber(summary.totalCost, 2),
          "إجمالي تكلفة التصنيع الفعلية حسب valuation."
        ),

        kpiCard(
          "متوسط تكلفة الوحدة",
          safeNumber(summary.weightedUnitCost, 4),
          "إجمالي التكلفة ÷ إجمالي الكمية المنتجة."
        )
      ])}

      ${renderKpis([
        kpiCard(
          "أوامر زادت تكلفتها",
          safeNumber(summary.increasedOrdersCount, 0),
          "أوامر تكلفة وحدتها أعلى من المقارنة السابقة."
        ),

        kpiCard(
          "أوامر بدون تكلفة",
          safeNumber(summary.noCostOrdersCount, 0),
          "أوامر لا يظهر لها valuation واضح."
        ),

        kpiCard(
          "أعلى تكلفة وحدة",
          safeNumber(summary.highestUnitCost, 4),
          summary.highestUnitCostOrderName
            ? `${summary.highestUnitCostOrderName} - ${summary.highestUnitCostProductName}`
            : "لا يوجد"
        ),

        kpiCard(
          "أكبر زيادة",
          summary.biggestIncreasePercent === null ||
          summary.biggestIncreasePercent === undefined
            ? "لا يوجد"
            : `${safeNumber(summary.biggestIncreasePercent, 2)}%`,
          summary.biggestIncreaseOrderName
            ? `${summary.biggestIncreaseOrderName} - ${summary.biggestIncreaseProductName}`
            : "لا يوجد"
        )
      ])}

      ${renderPanel("التحليل الإداري", `
        <div class="analysis-box">
          ${
            insights.length
              ? insights.map((item) => `<p>${item}</p>`).join("")
              : "<p>لا يوجد تحليل.</p>"
          }
        </div>
      `)}

      ${
        risks.length
          ? renderPanel("مخاطر تحتاج مراجعة", `
              <div class="analysis-box">
                ${risks.map((item) => `<p>⚠️ ${item}</p>`).join("")}
              </div>
            `)
          : ""
      }

      ${
        recommendations.length
          ? renderPanel("توصيات الإدارة", `
              <div class="analysis-box">
                ${recommendations.map((item) => `<p>✅ ${item}</p>`).join("")}
              </div>
            `)
          : ""
      }

      ${
        warnings.length
          ? renderPanel("ملاحظات", `
              <div class="analysis-box">
                ${warnings.map((item) => `<p>⚠️ ${item}</p>`).join("")}
              </div>
            `)
          : ""
      }

      ${renderPanel("ملخص تكلفة المنتج", renderTable(
        [
          { key: "productName", label: "المنتج", hint: "اسم المنتج التام." },
          { key: "ordersCount", label: "عدد الأوامر", hint: "عدد أوامر التصنيع للمنتج." },
          { key: "producedQtyText", label: "الكمية المنتجة", hint: "إجمالي الكمية المنتجة." },
          { key: "totalCostText", label: "إجمالي التكلفة", hint: "إجمالي تكلفة التصنيع." },
          { key: "weightedUnitCostText", label: "متوسط تكلفة الوحدة", hint: "تكلفة مرجحة حسب الكمية." },
          { key: "increasedOrdersCount", label: "أوامر زادت", hint: "أوامر بها زيادة تكلفة." },
          { key: "noCostOrdersCount", label: "بدون تكلفة", hint: "أوامر بدون valuation واضح." }
        ],
        productSummary
      ))}

      ${renderPanel("تفاصيل تكلفة أوامر التصنيع", renderTable(
        [
          { key: "moName", label: "أمر التصنيع", hint: "رقم أمر التصنيع." },
          { key: "dateFinished", label: "تاريخ الإنهاء", hint: "تاريخ إغلاق أمر التصنيع." },
          { key: "productName", label: "المنتج التام", hint: "المنتج الناتج من التصنيع." },
          { key: "producedQtyText", label: "كمية المنتج التام", hint: "الكمية المنتجة فعليًا." },
          { key: "totalCostText", label: "إجمالي التكلفة", hint: "تكلفة أمر التصنيع الفعلية." },
          { key: "currentUnitCostText", label: "تكلفة الوحدة الحالية", hint: "إجمالي التكلفة ÷ الكمية المنتجة." },
          { key: "previousMoUnitCostText", label: "تكلفة الأمر السابق", hint: "تكلفة الوحدة في أمر التصنيع السابق لنفس المنتج." },
          { key: "previousMonthUnitCostText", label: "تكلفة الشهر السابق", hint: "متوسط تكلفة الوحدة المرجح لنفس المنتج في الشهر السابق." },
          { key: "diffVsPreviousMoText", label: "فرق عن الأمر السابق", hint: "تكلفة الوحدة الحالية - تكلفة الأمر السابق." },
          { key: "diffVsPreviousMoPercentText", label: "فرق % عن السابق", hint: "نسبة الفرق عن الأمر السابق." },
          { key: "diffVsPreviousMonthPercentText", label: "فرق % عن الشهر", hint: "نسبة الفرق عن الشهر السابق." },
          { key: "costSourceText", label: "مصدر التكلفة", hint: "هل التكلفة من المنتج التام أم الخامات." },
          { key: "riskText", label: "الحالة", hint: "تصنيف إداري للتكلفة." }
        ],
        rows.slice(0, 100)
      ))}

      ${renderPanel("ملاحظة تفاصيل التقرير", `
        <div class="analysis-box">
          <p>
            يتم عرض أول 100 أمر تصنيع فقط في الواجهة للحفاظ على سرعة الصفحة.
            التفاصيل الكاملة لكل أوامر التصنيع في الفترة سيتم عرضها في Excel Export.
          </p>
        </div>
      `)}
    `;
  } catch (error) {
    showError(error);
  }
}

function bindFilterEvents() {
  document
    .querySelectorAll("select, input, textarea")
    .forEach((el) => {
      const type = String(el.type || "").toLowerCase();

      if (
        type === "button" ||
        type === "submit" ||
        type === "file" ||
        el.id === "loadBtn"
      ) {
        return;
      }

      el.addEventListener("change", renderFilterChangedState);
      el.addEventListener("input", renderFilterChangedState);
    });
}

document.getElementById("loadBtn")?.addEventListener("click", loadMoCostReport);

bindFilterEvents();
renderInitialState();