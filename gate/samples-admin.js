(() => {
  const $ = (id) => document.getElementById(id);

  function cid() {
    const v = $("companyId").value || localStorage.getItem("companyId") || "1";
    localStorage.setItem("companyId", v);
    return Number(v);
  }

  function currentUserName() {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return String(u.displayName || u.name || u.fullName || u.username || "").trim();
    } catch (_) {
      return "";
    }
  }

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function statusLabel(v) {
    const map = {
      REGISTERED_AT_GATE: "مسجلة بالبوابة",
      HANDED_TO_WAREHOUSE: "تم تسليمها للمخزن",
      WAITING_ODOO_RECEIPT: "بانتظار إيصال Odoo",
      ODOO_LINKED: "مرتبطة بـ Odoo"
    };
    return map[v] || v || "-";
  }

  function today() {
    return new Date().toISOString().slice(0,10);
  }

  function firstDay() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
  }

  async function load() {
    const r = await apiGet("/gate/samples/admin/list", {
      companyId: cid(),
      status: $("status").value,
      dateFrom: $("dateFrom").value,
      dateTo: $("dateTo").value,
      limit: 1000
    });

    $("body").innerHTML = (r.data || []).map((s) => {
      const linked = s.status === "ODOO_LINKED";
      return `
        <tr>
          <td><strong>${esc(s.sample_code || "-")}</strong></td>
          <td>${esc(s.source_supplier_name || "-")}</td>
          <td>${esc(s.sample_description || "-")}</td>
          <td>${esc(s.package_count || 1)}</td>
          <td>${esc(s.purchase_order_reference || "بدون")}</td>
          <td>${esc(statusLabel(s.status))}</td>
          <td>
            ${linked
              ? `<b>${esc(s.odoo_reference || "-")}</b><br><small>${esc(s.odoo_link_type || "")}</small>`
              : `<div class="sync">
                   <input data-ref="${esc(s.sample_uuid)}" placeholder="رقم إيصال Odoo أو مرجع PO">
                   <button class="ok" data-link="${esc(s.sample_uuid)}">ربط مع Odoo</button>
                 </div>
                 ${s.odoo_sync_error ? `<div>${esc(s.odoo_sync_error)}</div>` : ""}`
            }
          </td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="7">لا توجد عينات في الفترة المحددة.</td></tr>`;

    document.querySelectorAll("[data-link]").forEach((b) => {
      b.onclick = async () => {
        const id = b.dataset.link;
        const input = document.querySelector(`[data-ref="${CSS.escape(id)}"]`);
        const reference = String(input?.value || "").trim();
        if (!reference) return alert("أدخل رقم إيصال Odoo أو المرجع.");

        b.disabled = true;
        try {
          const r = await apiPost(`/gate/samples/admin/${id}/odoo-link`, {
            companyId: cid(),
            reference,
            actorName: currentUserName()
          });

          alert(`تم ربط العينة مع ${r.data?.matchedDocument?.name || reference}`);
          await load();
        } catch (e) {
          alert(e.message);
        } finally {
          b.disabled = false;
        }
      };
    });
  }

  $("companyId").value = localStorage.getItem("companyId") || "1";
  $("dateFrom").value = firstDay();
  $("dateTo").value = today();
  $("loadBtn").onclick = load;
  $("companyId").onchange = load;
  $("status").onchange = load;

  apiGet("/gate/samples/admin/access", {})
    .then(load)
    .catch((e) => {
      alert("ليس لديك صلاحية إدارة العينات.");
      console.error(e);
    });
})();
