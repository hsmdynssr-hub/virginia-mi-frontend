(() => {
  const $ = (id) => document.getElementById(id);

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[c]));

  const fmt = (v) => {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleString("ar-EG");
  };

  function cid() {
    const v = $("companyId").value || localStorage.getItem("companyId") || "1";
    localStorage.setItem("companyId", v);
    return Number(v);
  }

  function today() {
    return new Date().toISOString().slice(0,10);
  }

  function firstDayOfMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
  }

  function arabicStatus(v) {
    const map = {
      ENTERED_SITE: "داخل الشركة",
      OVERNIGHT_STARTED: "مبيت",
      RECEIVING_STARTED: "جارٍ الاستلام",
      RECEIVING_COMPLETED: "تم التسليم للمخزن",
      LOADING_COMPLETED: "تم تحميل الشحنة",
      EXITED_SITE: "خرج"
    };
    return map[v] || v || "-";
  }

  function arabicDirection(v) {
    return String(v || "INBOUND").toUpperCase() === "OUTBOUND"
      ? "خروج / شحن"
      : "دخول / توريد";
  }

  function movementType(v) {
    const type = String(v.visit_type || "").toUpperCase();
    if (type === "VISIT") return "VISIT";
    if (type === "MAINTENANCE") return "MAINTENANCE";
    return String(v.direction || "INBOUND").toUpperCase() === "OUTBOUND"
      ? "OUTBOUND"
      : "INBOUND";
  }

  function movementLabel(v) {
    const type = movementType(v);
    if (type === "VISIT") return "زيارة";
    if (type === "MAINTENANCE") return "صيانة";
    if (type === "OUTBOUND") return "شحن";
    return "توريد";
  }

  function syncStatus(v) {
    const s = v.odoo_sync_status || "WAITING_ODOO_LINK";

    if (s === "SYNCED") {
      return `<span class="tag">${esc(v.odoo_reference || "تمت المزامنة")}</span>`;
    }

    if (s === "SYNC_ERROR") {
      return `<span class="warn">خطأ في المزامنة</span>`;
    }

    return `<span class="warn">غير مرتبط</span>`;
  }

  async function ensureAdmin() {
    await apiGet("/gate/admin/access", {});
  }

  async function loadDashboard() {
    const r = await apiGet("/gate/admin/dashboard", {
      companyId: cid(),
      date: today()
    });

    const d = r.data || {};
    const rows = (d.waitingOdooLink || []).filter((v) => !["VISIT","MAINTENANCE"].includes(movementType(v)));
    const inside = d.inside || [];

    const inboundCount = inside.filter((v) => movementType(v) === "INBOUND").length;
    const outboundCount = inside.filter((v) => movementType(v) === "OUTBOUND").length;
    const visitCount = inside.filter((v) => movementType(v) === "VISIT").length;
    const maintenanceCount = inside.filter((v) => movementType(v) === "MAINTENANCE").length;

    $("kInside").textContent = d.insideCount || 0;
    $("kInbound").textContent = inboundCount;
    $("kOutbound").textContent = outboundCount;
    $("kVisits").textContent = visitCount;
    $("kMaintenance").textContent = maintenanceCount;
    $("kOvernight").textContent = d.overnightCount || 0;

    $("insideSummaryBody").innerHTML = inside.map((v) => `
      <tr>
        <td>${esc(movementLabel(v))}</td>
        <td>${esc(v.driver_name || "-")}</td>
        <td>${esc(v.vehicle_plate || "-")}</td>
        <td>${esc(v.supplier_name || "-")}</td>
        <td>${fmt(v.entered_at)}</td>
        <td>${esc(arabicStatus(v.status))}</td>
        <td>${esc(v.gate_operator || "-")}</td>
      </tr>
    `).join("") || `<tr><td colspan="7">لا توجد سيارات داخل الشركة الآن.</td></tr>`;

    $("unlinkedBody").innerHTML = rows.map((v) => `
      <tr>
        <td>${esc(movementLabel(v))}</td>
        <td>${esc(v.vehicle_plate || "-")}</td>
        <td>${esc(v.supplier_name || "-")}</td>
        <td>${esc(["VISIT","MAINTENANCE"].includes(movementType(v)) ? "-" : arabicDirection(v.direction))}</td>
        <td>${fmt(v.entered_at)}</td>
        <td>${esc(v.gate_operator || "-")}</td>
        <td>
          <div class="syncbox">
            <input
              data-ref="${esc(v.visit_uuid)}"
              placeholder="مثال: رئيسي/IN/03270 أو P04760"
            >
            <button class="ok" data-sync="${esc(v.visit_uuid)}">
              مزامنة مع Odoo
            </button>
          </div>
          ${v.odoo_sync_error ? `<div class="warn">${esc(v.odoo_sync_error)}</div>` : ""}
        </td>
      </tr>
    `).join("") || `<tr><td colspan="6">لا توجد حركات بانتظار الربط.</td></tr>`;

    document.querySelectorAll("[data-sync]").forEach((b) => {
      b.onclick = async () => {
        const visitUuid = b.dataset.sync;
        const input = document.querySelector(`[data-ref="${CSS.escape(visitUuid)}"]`);
        const reference = String(input?.value || "").trim();

        if (!reference) {
          alert("أدخل رقم مستند Odoo أولاً.");
          return;
        }

        b.disabled = true;

        try {
          const r = await apiPost(`/gate/admin/visits/${visitUuid}/odoo-sync`, {
            companyId: cid(),
            reference
          });

          alert(`تم الربط والمزامنة مع ${r.data?.matchedDocument?.name || reference}`);
          await loadAll();
        } catch (e) {
          alert(e.message);
        } finally {
          b.disabled = false;
        }
      };
    });
  }

  async function loadReport() {
    const r = await apiGet("/gate/admin/report", {
      companyId: cid(),
      dateFrom: $("dateFrom").value,
      dateTo: $("dateTo").value,
      limit: 1000
    });

    $("reportBody").innerHTML = (r.data || []).map((v) => `
      <tr>
        <td>${esc(movementLabel(v))}</td>
        <td>${esc(v.vehicle_plate || "-")}</td>
        <td>${esc(v.supplier_name || "-")}</td>
        <td>${esc(["VISIT","MAINTENANCE"].includes(movementType(v)) ? "-" : arabicDirection(v.direction))}</td>
        <td>${esc(arabicStatus(v.status))}</td>
        <td>${syncStatus(v)}</td>
        <td>${fmt(v.entered_at)}</td>
        <td>${fmt(movementType(v) === "OUTBOUND" ? v.loading_completed_at : movementType(v) === "INBOUND" ? v.receiving_completed_at : null)}</td>
        <td>${fmt(v.exited_at)}</td>
        <td>${esc(v.gate_operator || "-")}</td>
      </tr>
    `).join("") || `<tr><td colspan="9">لا توجد حركات في الفترة المختارة.</td></tr>`;
  }

  async function loadAll() {
    await Promise.all([
      loadDashboard(),
      loadReport()
    ]);
  }

  $("loadBtn").onclick = loadAll;
  $("companyId").onchange = loadAll;

  $("companyId").value = localStorage.getItem("companyId") || "1";
  $("dateFrom").value = firstDayOfMonth();
  $("dateTo").value = today();

  ensureAdmin()
    .then(loadAll)
    .catch((e) => {
      alert("ليس لديك صلاحية إدارة ومتابعة البوابة.");
      console.error(e);
    });
})();
