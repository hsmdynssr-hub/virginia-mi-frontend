(function () {
  const TYPE_CONFIG = {
    executive: {
      title: "واجهة التقارير التنفيذية",
      subtitle: "ملخصات ومؤشرات الإدارة العليا لاتخاذ القرار.",
      eyebrow: "EXECUTIVE INTELLIGENCE"
    },
    management: {
      title: "واجهة التقارير الإدارية",
      subtitle: "تحليلات الأداء والمقارنات والرقابة الإدارية.",
      eyebrow: "MANAGEMENT REPORTING"
    },
    operational: {
      title: "واجهة التقارير التشغيلية",
      subtitle: "تقارير العمل اليومي والمتابعة والتنفيذ.",
      eyebrow: "OPERATIONAL CONTROL"
    }
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadHub() {
    const type = document.body.dataset.reportType || "management";
    const config = TYPE_CONFIG[type];
    const target = document.getElementById("reportHubContent");

    try {
      const response = await apiGet("/permissions/me");
      const grouped = response.data?.grouped || [];
      const currentType = grouped.find((item) => item.code === type);
      const modules = currentType?.modules || [];

      if (!modules.length) {
        target.innerHTML = `<div class="report-hub-empty">لا توجد تقارير ${escapeHtml(config.title.replace("واجهة ", ""))} ممنوحة لحسابك حاليًا.</div>`;
        return;
      }

      target.innerHTML = `
        <div class="report-hub-modules">
          ${modules.map((module) => `
            <section class="report-hub-module">
              <h3>${escapeHtml(module.label)}</h3>
              <div class="report-hub-list">
                ${module.reports.filter(report => report.path).map((report) => `
                  <a class="report-hub-link" href="${escapeHtml(report.path)}">
                    <strong>${escapeHtml(report.label)}</strong>
                    <small>${escapeHtml(report.scopeLabel)}</small>
                  </a>
                `).join("") || '<span class="report-hub-empty">لا توجد صفحة مرتبطة حاليًا.</span>'}
              </div>
            </section>
          `).join("")}
        </div>
      `;
    } catch (error) {
      target.innerHTML = `<div class="report-hub-empty">تعذر تحميل التقارير: ${escapeHtml(error.message)}</div>`;
    }
  }

  window.renderReportHub = function renderReportHub(type) {
    const config = TYPE_CONFIG[type];
    document.body.dataset.reportType = type;
    renderLayout(
      config.title,
      config.subtitle,
      `reports-${type}`,
      `<section class="report-hub-hero"><span class="report-hub-eyebrow">${config.eyebrow}</span><h2>${config.title}</h2><p>${config.subtitle}</p></section><div id="reportHubContent"><div class="report-hub-empty">جاري تحميل التقارير المسموحة...</div></div>`
    );
    loadHub();
  };
})();
