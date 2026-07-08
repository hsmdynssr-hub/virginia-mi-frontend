function createReportPage(config) {
  renderLayout(
    config.title,
    config.subtitle,
    config.activePage,
    `
      ${config.extraFiltersHtml || ""}
      <div id="reportArea"></div>
    `
  );

  const reportArea = document.getElementById("reportArea");

  function renderInitialState() {
    if (!reportArea) return;

    reportArea.innerHTML = `
      <div class="report-panel">
        <h3>التقرير لم يتم تحميله بعد</h3>
        <p>
          اختار الفلاتر المطلوبة ثم اضغط زر
          <strong>تحديث التقرير</strong>
          لعرض البيانات.
        </p>
      </div>
    `;
  }

  function renderFilterChangedState() {
    if (!reportArea) return;

    reportArea.innerHTML = `
      <div class="report-panel">
        <h3>تم تغيير الفلاتر</h3>
        <p>
          اضغط زر <strong>تحديث التقرير</strong> لتطبيق الفلاتر الجديدة.
        </p>
      </div>
    `;
  }

  async function loadReport() {
    try {
      showLoading();

      const params = {
        ...getFilters(),
        ...(config.getExtraParams ? config.getExtraParams() : {})
      };

      const response = await apiGet(config.endpoint, params);
      const data = response.data || {};
      const summary = data.summary || {};

      const kpis = (config.kpis || []).map((kpi) => ({
        label: kpi.label,
        hint: kpi.hint,
        value: kpi.value(summary, data, response)
      }));

      let html = "";

      if (kpis.length) {
        html += reportKpiGrid(kpis);
      }

      html += reportAnalysis(
        data.insights || [],
        data.recommendations || []
      );

      (config.tables || []).forEach((table) => {
        const rows = table.rows(data, response) || [];

        html += reportPanel(
          table.title,
          reportTable(table.columns, rows, table.limit || 300)
        );
      });

      reportArea.innerHTML = html;
    } catch (error) {
      showError(error);
    }
  }

  const loadBtn = document.getElementById("loadBtn");

  if (loadBtn) {
    loadBtn.addEventListener("click", loadReport);
  }

  const companySelect = document.getElementById("companySelect");

  if (companySelect) {
    companySelect.addEventListener("change", renderFilterChangedState);
  }

  if (config.bindExtraEvents) {
    config.bindExtraEvents(loadReport, renderFilterChangedState);
  }

  renderInitialState();

  return {
    loadReport,
    renderInitialState,
    renderFilterChangedState
  };
}