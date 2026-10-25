(() => {
  const $ = (id) => document.getElementById(id);
  let capabilities={canReviewGate:false,canApproveTransport:false},generation=0,tableInitialized=false;
  function selectTable(){const selected=$('gateView').value;document.querySelectorAll('[data-gate-table]').forEach(node=>node.hidden=node.dataset.gateTable!==selected);}
  $('gateView').onchange=selectTable;

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
    if(v.visit_type==='TRANSPORT')return 'مورد إدريس نقل';
    if(v.visit_type === "EXCEPTIONAL_PURCHASE")return "شراء استثنائي بدون أمر شراء";
    const type = movementType(v);
    if (type === "VISIT") return "زيارة";
    if (type === "MAINTENANCE") return "صيانة";
    if (type === "OUTBOUND") return "شحن";
    return "توريد";
  }

  function syncStatus(v) {
    const s = v.odoo_sync_status || "WAITING_ODOO_LINK";
    if(s==='NOT_REQUIRED')return '<span class="tag">لا يتطلب ربط أودو</span>';

    if (s === "SYNCED") {
      return `<span class="tag">${esc(v.odoo_reference || "تمت المزامنة")}</span>`;
    }

    if (s === "SYNC_ERROR") {
      return `<span class="warn">خطأ في المزامنة</span>`;
    }

    return `<span class="warn">غير مرتبط</span>`;
  }

  function supplierDetails(v){
    const name=esc(v.supplier_name || "-");
    return `${name}<div>${(v.supplied_items || []).map(item=>`${esc(item.productName||item.name||'حمولة')}: ${esc(item.quantity)} ${esc(item.unit)}`).join("<br>")}</div>${v.visit_type==='TRANSPORT'?`<small>من ${esc(v.transport_from)} إلى ${esc(v.transport_to)}</small>`:''}${v.visit_type==='EXCEPTIONAL_PURCHASE'?`<small>سبب الشراء: ${esc(v.visit_reason || "-")}</small>`:''}`;
  }

  async function ensureAdmin() {
    const r=await apiGet('/gate/control/access',{companyId:cid()});capabilities=r.data;
    for(const option of $('gateView').options)option.disabled=option.value!=='transport'&&!capabilities.canReviewGate;
    if(!capabilities.canReviewGate||!tableInitialized&&new URLSearchParams(location.search).get('view')==='transport')$('gateView').value='transport';
    document.querySelector('.gate-kpis').hidden=!capabilities.canReviewGate;tableInitialized=true;selectTable();
  }

  async function loadDashboard(revision) {
    const r = await apiGet("/gate/admin/dashboard", {
      companyId: cid(),
      date: today()
    });
    if(revision!==generation)return;

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
        <td>${supplierDetails(v)}</td>
        <td>${fmt(v.entered_at)}</td>
        <td>${esc(arabicStatus(v.status))}</td>
        <td>${esc(v.gate_operator || "-")}</td>
      </tr>
    `).join("") || `<tr><td colspan="7">لا توجد سيارات داخل الشركة الآن.</td></tr>`;

    $("unlinkedBody").innerHTML = rows.map((v) => `
      <tr>
        <td>${esc(movementLabel(v))}</td>
        <td>${esc(v.vehicle_plate || "-")}</td>
        <td>${supplierDetails(v)}</td>
        <td>${esc(["VISIT","MAINTENANCE"].includes(movementType(v)) ? "-" : arabicDirection(v.direction))}</td>
        <td>${fmt(v.entered_at)}</td>
        <td>${esc(v.gate_operator || "-")}</td>
        <td>
          <div class="syncbox">
            <input
              data-ref="${esc(v.visit_uuid)}"
              placeholder="${v.visit_type === 'EXCEPTIONAL_PURCHASE' ? 'رقم طلب الشراء في أودو، مثال P04760' : 'مثال: رئيسي/IN/03270 أو P04760'}"
            >
            <button class="ok" data-sync="${esc(v.visit_uuid)}">
              ${v.visit_type === 'EXCEPTIONAL_PURCHASE' ? 'ربط بطلب شراء أودو' : 'مزامنة مع Odoo'}
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

  async function loadReport(revision) {
    const r = await apiGet("/gate/admin/report", {
      companyId: cid(),
      dateFrom: $("dateFrom").value,
      dateTo: $("dateTo").value,
      limit: 1000
    });
    if(revision!==generation)return;

    $("reportBody").innerHTML = (r.data || []).map((v) => `
      <tr>
        <td>${esc(movementLabel(v))}</td>
        <td>${esc(v.vehicle_plate || "-")}</td>
        <td>${supplierDetails(v)}</td>
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

  async function loadTransport(revision){
    const companyId=cid(),r=await apiGet('/gate/transport',{companyId,dateFrom:$('dateFrom').value,dateTo:$('dateTo').value});if(revision!==generation)return;
    $('transportBody').innerHTML=(r.data||[]).map(row=>{const p=row.movement_payload,key=`gate-transport:${companyId}:${row.entry_uuid}`,pending=JSON.parse(sessionStorage.getItem(key)||'null');
     return `<tr><td>إدريس نقل<small>${esc(p.personName)} — ${esc(p.vehiclePlate)}</small></td><td>من ${esc(p.transportFrom)}<br>إلى ${esc(p.transportTo)}</td><td>${(p.items||[]).map(i=>`${esc(i.productName||'حمولة نقل')}: ${esc(i.quantity)} ${esc(i.unit)}`).join('<br>')}</td><td>${fmt(p.enteredAt)}<small>${fmt(row.exited_at)}</small></td><td>${esc(p.operatorName)}</td><td>${row.amount?esc(row.amount):capabilities.canApproveTransport?`<input data-transport-amount="${esc(row.entry_uuid)}" type="text" inputmode="decimal" aria-label="قيمة النقل" value="${esc(pending?.amount||'')}" ${pending?'disabled':''}>`:'بانتظار مسؤول النقل'}</td><td>${row.amount?`معتمد بواسطة ${esc(row.approved_name)}<small>${fmt(row.approved_at)}</small><small>${esc(row.reason)}</small>`:capabilities.canApproveTransport?`<input data-transport-reason="${esc(row.entry_uuid)}" placeholder="سبب / بيان الاعتماد" value="${esc(pending?.reason||'')}" ${pending?'disabled':''}><button data-transport-approve="${esc(row.entry_uuid)}">${pending?'إعادة نفس الاعتماد':'اعتماد قيمة النقل'}</button>`:'غير معتمد'}</td></tr>`;
    }).join('')||'<tr><td colspan="7">لا توجد نقلات إدريس في الفترة المختارة</td></tr>';
    $('transportBody').onclick=async event=>{const button=event.target.closest('[data-transport-approve]');if(!button)return;const id=button.dataset.transportApprove,key=`gate-transport:${companyId}:${id}`;
     try{if(companyId!==cid())throw Error('تغيرت الشركة؛ حدّث الصفحة');let payload=JSON.parse(sessionStorage.getItem(key)||'null');if(!payload){const a=document.querySelector(`[data-transport-amount="${CSS.escape(id)}"]`),reason=document.querySelector(`[data-transport-reason="${CSS.escape(id)}"]`);if(!/^\d{1,12}(\.\d{1,2})?$/.test(a.value)||Number(a.value)<=0||!reason.value.trim())throw Error('أدخل قيمة موجبة وبيان الاعتماد');payload={companyId,requestKey:crypto.randomUUID(),amount:a.value,reason:reason.value.trim()};sessionStorage.setItem(key,JSON.stringify(payload));a.disabled=reason.disabled=true;}
      button.disabled=true;await apiPost(`/gate/transport/${id}/approve`,payload);sessionStorage.removeItem(key);$('controlMessage').textContent='تم اعتماد النقل وحفظ القيمة والمنفذ';await loadAll();
     }catch(e){$('controlMessage').textContent=e.message;button.textContent='إعادة نفس الاعتماد';}finally{button.disabled=false;}
    };
  }
  async function loadAll() {
    const revision=++generation;$('loadBtn').disabled=true;
    try{await ensureAdmin();if(revision!==generation)return;await Promise.all([...(capabilities.canReviewGate?[loadDashboard(revision),loadReport(revision)]:[]),loadTransport(revision)]);}
    catch(e){if(revision===generation)$('controlMessage').textContent=e.message;}
    finally{if(revision===generation)$('loadBtn').disabled=false;}
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
