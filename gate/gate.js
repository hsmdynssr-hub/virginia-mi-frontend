(() => {
  let selected = null;
  let allDeliveries = [];

  const $ = (id) => document.getElementById(id);

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[c]));

  const today = () => new Date().toISOString().slice(0, 10);

  const fmt = (v) => {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleString("ar-EG");
  };

  function currentUserName() {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return String(
        u.displayName ||
        u.name ||
        u.fullName ||
        u.username ||
        ""
      ).trim();
    } catch (_) {
      return "";
    }
  }

  function cid() {
    const v = $("companyId").value || localStorage.getItem("companyId") || "1";
    localStorage.setItem("companyId", v);
    return Number(v);
  }

  function normalizeArabic(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizePo(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/\bPO\b/g, "")
      .replace(/\bP\b/g, "")
      .replace(/[^0-9A-Z\u0600-\u06FF]/g, "")
      .trim();
  }

  function daysAgoIso(days) {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - Number(days));
    return d;
  }

  function visibleDeliveries() {
    const period = $("periodFilter").value;
    const qRaw = $("deliverySearch").value.trim();
    const qText = normalizeArabic(qRaw);
    const qPo = normalizePo(qRaw);

    return allDeliveries.filter((row) => {
      if (period !== "all") {
        const rawDate = row.scheduled_from || row.scheduled_date;
        if (rawDate) {
          const dt = new Date(rawDate);
          if (!Number.isNaN(dt.getTime()) && dt < daysAgoIso(period)) return false;
        }
      }

      if (!qRaw) return true;

      const supplier = normalizeArabic(row.supplier_name);
      const poText = normalizeArabic(row.purchase_order_name);
      const delivery = normalizeArabic(row.delivery_reference);
      const receipt = normalizeArabic(row.receipt_reference);

      const poNormalized = normalizePo(row.purchase_order_name);
      const deliveryNormalized = normalizePo(row.delivery_reference);
      const receiptNormalized = normalizePo(row.receipt_reference);

      return (
        supplier.includes(qText) ||
        poText.includes(qText) ||
        delivery.includes(qText) ||
        receipt.includes(qText) ||
        (qPo && poNormalized.includes(qPo)) ||
        (qPo && deliveryNormalized.includes(qPo)) ||
        (qPo && receiptNormalized.includes(qPo))
      );
    });
  }

  function renderDeliveries() {
    const rows = visibleDeliveries();
    $("kExpected").textContent = rows.length;

    $("expectedBody").innerHTML = rows.map((x) => `
      <tr>
        <td>${esc(x.supplier_name || "-")}</td>
        <td>${esc(x.purchase_order_name || "-")}</td>
        <td>${esc(x.delivery_reference || "-")}</td>
        <td>${fmt(x.scheduled_from || x.scheduled_date)}</td>
        <td>${esc(x.warehouse_name || "-")}</td>
        <td><button class="gray" data-pick="${esc(x.id)}">اختيار</button></td>
      </tr>
    `).join("") || `<tr><td colspan="6">لا توجد نتائج مطابقة.</td></tr>`;

    document.querySelectorAll("[data-pick]").forEach((b) => {
      b.onclick = () => {
        const row = allDeliveries.find((x) => String(x.id) === String(b.dataset.pick));
        if (row) pick(row);
      };
    });
  }

  function clearSelected() {
    selected = null;
    $("selectedDelivery").textContent =
      "حركة غير مرتبطة — يمكن التسجيل بدون مستند Odoo.";
    $("supplierName").value = "";
  }

  function pick(row) {
    selected = row;
    $("supplierName").value = row.supplier_name || "";
    $("direction").value = "INBOUND";
    $("selectedDelivery").innerHTML =
      `<b>${esc(row.supplier_name || "مورد")}</b><br>` +
      `أمر الشراء: ${esc(row.purchase_order_name || "-")} — ` +
      `رقم التوصيل: ${esc(row.delivery_reference || "-")}`;
  }

  async function schedule(refresh = true) {
    // Pull a broad window once, then keep the small period filter in the browser.
    const from = new Date();
    from.setFullYear(from.getFullYear() - 2);

    const r = await apiGet("/gate/user/schedule", {
      companyId: cid(),
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: today(),
      refresh: refresh ? "1" : "0"
    });

    allDeliveries = r.data?.deliveries || [];
    renderDeliveries();
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

  function actionButtons(v) {
    const id = esc(v.visit_uuid);
    const arr = [];
    const type = movementType(v);

    if (type === "INBOUND") {
      if (!v.receiving_started_at) {
        arr.push(`<button class="gray" data-ev="RECEIVING_STARTED" data-id="${id}">بدء الاستلام</button>`);
      }
      if (v.receiving_started_at && !v.receiving_completed_at) {
        arr.push(`<button class="warn" data-ev="RECEIVING_COMPLETED" data-id="${id}">تم التسليم للمخزن</button>`);
      }
    } else if (type === "OUTBOUND") {
      if (!v.loading_completed_at) {
        arr.push(`<button class="warn" data-ev="LOADING_COMPLETED" data-id="${id}">تم تحميل الشحنة</button>`);
      }
    }

    if (["INBOUND", "OUTBOUND"].includes(type) && !v.overnight) {
      arr.push(`<button class="gray" data-ev="OVERNIGHT_STARTED" data-id="${id}">تسجيل مبيت</button>`);
    }

    arr.push(`<button class="danger" data-ev="EXITED_SITE" data-id="${id}">تسجيل الخروج</button>`);
    return arr.join(" ");
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

  async function dashboard() {
    const r = await apiGet("/gate/user/dashboard", {
      companyId: cid(),
      date: today()
    });

    const d = r.data || {};
    $("kEntered").textContent = d.enteredToday || 0;
    $("kExited").textContent = d.exitedToday || 0;
    $("kInside").textContent = d.insideCount || 0;
    $("kOvernight").textContent = d.overnightCount || 0;

    $("insideBody").innerHTML = (d.inside || []).map((v) => `
      <tr>
        <td>${esc(movementLabel(v))}</td>
        <td>${esc(v.driver_name || "-")}</td>
        <td>${esc(v.vehicle_plate || "-")}</td>
        <td>${esc(v.supplier_name || "-")}</td>
        <td>${fmt(v.entered_at)}</td>
        <td>${esc(arabicStatus(v.status))}</td>
        <td>${actionButtons(v)}</td>
      </tr>
    `).join("") || `<tr><td colspan="7">لا توجد سيارات داخل الشركة.</td></tr>`;

    document.querySelectorAll("[data-ev]").forEach((b) => {
      b.onclick = async () => {
        b.disabled = true;
        try {
          await apiPost(`/gate/user/visits/${b.dataset.id}/events`, {
            companyId: cid(),
            eventType: b.dataset.ev,
            eventTime: new Date().toISOString()
          });
          await refresh(false);
        } catch (e) {
          alert(e.message);
        } finally {
          b.disabled = false;
        }
      };
    });
  }

  function sampleStatusLabel(status) {
    const map = {
      REGISTERED_AT_GATE: "مسجلة بالبوابة",
      HANDED_TO_WAREHOUSE: "تم تسليمها للمخزن",
      WAITING_ODOO_RECEIPT: "استلمها المخزن - بانتظار Odoo",
      ODOO_LINKED: "مرتبطة بـ Odoo"
    };
    return map[status] || status || "-";
  }

  async function loadPendingSamples() {
    const r = await apiGet("/gate/user/samples/pending", {
      companyId: cid()
    });

    $("samplePendingBody").innerHTML = (r.data || []).map((s) => `
      <tr>
        <td><strong>${esc(s.sample_code || "-")}</strong></td>
        <td>${esc(s.sample_description || "-")}</td>
        <td>${esc(s.package_count || 1)}</td>
        <td>${fmt(s.gate_registered_at)}</td>
        <td>${esc(sampleStatusLabel(s.status))}</td>
        <td>
          ${s.status === "REGISTERED_AT_GATE"
            ? `<button class="ok" data-sample-handoff="${esc(s.sample_uuid)}">تم التسليم للمخزن</button>`
            : ""}
        </td>
      </tr>
    `).join("") || `<tr><td colspan="6">لا توجد عينات معلقة بالبوابة.</td></tr>`;

    document.querySelectorAll("[data-sample-handoff]").forEach((b) => {
      b.onclick = async () => {
        b.disabled = true;
        try {
          await apiPost(`/gate/user/samples/${b.dataset.sampleHandoff}/handoff`, {
            companyId: cid(),
            actorName: currentUserName()
          });
          await loadPendingSamples();
        } catch (e) {
          alert(e.message);
        } finally {
          b.disabled = false;
        }
      };
    });
  }

  async function refresh(syncOdoo = false) {
    await Promise.all([
      schedule(syncOdoo),
      dashboard(),
      loadPendingSamples()
    ]);
  }

  function updateMovementForm() {
    const type = $("movementType").value;
    const logistics = type === "INBOUND" || type === "OUTBOUND";
    const sample = type === "SAMPLE";

    $("vehiclePlate").required = logistics;
    $("driverName").required = !sample;
    $("driverLicense").style.display = logistics ? "" : "none";
    $("vehicleLicense").style.display = logistics ? "" : "none";
    $("vehicleType").style.display = logistics ? "" : "none";
    $("overnightWrap").style.display = logistics ? "flex" : "none";

    $("hostName").style.display = logistics ? "none" : "";
    $("visitReason").style.display = logistics ? "none" : "";
    $("contactPhone").style.display = logistics ? "none" : "";

    document.querySelectorAll(".sample-only").forEach((el) => {
      el.style.display = sample ? "" : "none";
    });

    $("hostName").style.display = (!logistics && !sample) ? "" : "none";
    $("visitReason").style.display = (!logistics && !sample) ? "" : "none";
    $("contactPhone").style.display = logistics ? "none" : "";

    if (sample) {
      $("supplierName").placeholder = "المورد / الجهة الأصلية";
      $("driverName").placeholder = "اسم مُسلّم العينة";
      $("contactPhone").placeholder = "هاتف مُسلّم العينة";
      $("vehiclePlate").placeholder = "رقم السيارة إن وجد";
      $("submitVisitBtn").textContent = "تسجيل العينة وتوليد الكود";
      $("selectedDelivery").textContent =
        "العينة لها كود مستقل ولا تدخل سايكل استلام المخزن العادي من صفحة البوابة.";
      $("overnightWrap").style.display = "none";
      $("overnight").checked = false;
      selected = null;
      return;
    }

    $("supplierName").placeholder = logistics ? "المورد / الجهة" : "الجهة / الشركة";
    $("driverName").placeholder =
      type === "VISIT" ? "اسم الزائر" :
      type === "MAINTENANCE" ? "اسم الفني" :
      type === "SAMPLE" ? "اسم مُسلّم العينة" :
      "اسم السائق";

    $("visitReason").placeholder =
      type === "MAINTENANCE" ? "نوع / سبب الصيانة" : "سبب الزيارة";

    $("submitVisitBtn").textContent =
      type === "VISIT" ? "تسجيل دخول الزائر" :
      type === "MAINTENANCE" ? "تسجيل دخول فني الصيانة" :
      type === "SAMPLE" ? "تسجيل العينة وتوليد الكود" :
      "تسجيل دخول السيارة";

    if (!logistics) {
      selected = null;
      $("selectedDelivery").textContent =
        type === "VISIT"
          ? "تسجيل زيارة مستقلة — لا تحتاج إلى مستند Odoo."
          : "تسجيل صيانة مستقلة — لا تحتاج إلى مستند Odoo.";
      $("overnight").checked = false;
    }
  }

  $("movementType").onchange = updateMovementForm;

  $("visitForm").onsubmit = async (e) => {
    e.preventDefault();

    const type = $("movementType").value;
    const logistics = type === "INBOUND" || type === "OUTBOUND";

    if (type === "SAMPLE") {
      const r = await apiPost("/gate/user/samples", {
        companyId: cid(),
        sourceSupplierName: $("supplierName").value.trim(),
        deliveredByName: $("driverName").value.trim(),
        deliveredByPhone: $("contactPhone").value.trim(),
        deliveredByIdentity: $("driverIdentity").value.trim(),
        vehiclePlate: $("vehiclePlate").value.trim(),
        sampleDescription: $("sampleDescription").value.trim(),
        packageCount: Number($("samplePackageCount").value || 1),
        purchaseOrderReference: $("samplePoReference").value.trim(),
        gateOperator: $("gateOperator").value.trim(),
        notes: $("notes").value.trim()
      });

      alert(`تم تسجيل العينة بنجاح\nكود العينة: ${r.data?.sample_code || "-"}`);

      e.target.reset();
      $("movementType").value = "INBOUND";
      $("samplePackageCount").value = "1";
      $("gateOperator").value = currentUserName();
      clearSelected();
      updateMovementForm();
      await refresh(false);
      return;
    }

    await apiPost("/gate/user/visits", {
      companyId: cid(),
      visitType: logistics ? "LOGISTICS" : type,
      direction: logistics ? type : null,
      gateOperator: $("gateOperator").value.trim(),
      expectedDeliveryId: logistics ? (selected?.id || null) : null,
      supplierName: $("supplierName").value.trim() || (logistics ? selected?.supplier_name : null) || null,
      purchaseOrderName: logistics ? (selected?.purchase_order_name || null) : null,
      deliveryReference: logistics ? (selected?.delivery_reference || null) : null,
      receiptReference: logistics ? (selected?.receipt_reference || null) : null,
      vehiclePlate: $("vehiclePlate").value.trim(),
      vehicleType: logistics ? $("vehicleType").value.trim() : null,
      personName: $("driverName").value.trim(),
      driverName: $("driverName").value.trim(),
      contactPhone: logistics ? null : $("contactPhone").value.trim(),
      driverLicense: logistics ? $("driverLicense").value.trim() : null,
      driverIdentity: $("driverIdentity").value.trim(),
      vehicleLicense: logistics ? $("vehicleLicense").value.trim() : null,
      hostName: logistics ? null : $("hostName").value.trim(),
      visitReason: logistics ? null : $("visitReason").value.trim(),
      entryDecision: "ALLOWED",
      overnight: logistics ? $("overnight").checked : false,
      notes: $("notes").value.trim(),
      eventTime: new Date().toISOString()
    });

    e.target.reset();
    $("movementType").value = "INBOUND";
    $("gateOperator").value = currentUserName();
    clearSelected();
    updateMovementForm();
    await refresh(false);
  };

  $("refreshBtn").onclick = () => refresh(true);
  $("companyId").onchange = () => refresh(true);

  $("periodFilter").onchange = renderDeliveries;
  $("deliverySearch").oninput = renderDeliveries;

  $("clearSearch").onclick = () => {
    $("deliverySearch").value = "";
    renderDeliveries();
  };

  $("companyId").value = localStorage.getItem("companyId") || "1";
  $("gateOperator").value = currentUserName();
  updateMovementForm();

  refresh(true).catch((e) => alert(e.message));
})();
