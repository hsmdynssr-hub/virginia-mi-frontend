"use strict";

let catalog = [];
let printSettings = null;
let last = null;

const $ = x => document.getElementById(x);
const m = v => new Intl.NumberFormat("ar-EG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(v || 0));

document.addEventListener("DOMContentLoaded", async () => {
  if (!getToken()) {
    location.href = "../admin/login.html";
    return;
  }

  await Promise.all([loadCatalog(), loadPrint()]);
  add();

  $("add").onclick = add;
  $("f").onsubmit = save;
  $("full").onclick = () => { $("paid").value = total().toFixed(2); };
  $("print").onclick = () => last && prt(last);
  $("new").onclick = () => location.reload();
});

async function loadCatalog() {
  const r = await apiGet("/olive/catalog", { companyId: Number(getCompanyId() || 1) });
  catalog = (r.data || r).filter(x => x.active);
}

async function loadPrint() {
  const r = await apiGet("/olive/settings/receipt", { companyId: Number(getCompanyId() || 1) });
  printSettings = r.data || r;
}

function options() {
  return `<option value="">اختر الصنف</option>` +
    catalog.map(x =>
      `<option value="${x.id}" data-price="${x.current_price ?? ""}">${esc(x.name)}</option>`
    ).join("");
}

function add() {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><select class="v" required>${options()}</select></td>
    <td><input class="w" type="number" min=".001" step=".001" required></td>
    <td><input class="p" type="number" min="0" step=".01" required></td>
    <td class="t">0.00</td>
    <td><button type="button" class="btn red del">×</button></td>
  `;

  $("lines").appendChild(tr);

  tr.querySelector(".v").onchange = e => {
    const o = e.target.selectedOptions[0];
    const p = o?.dataset.price;
    tr.querySelector(".p").value = p === "" ? "" : Number(p).toFixed(2);
    tr.dataset.catalogPrice = p;
    calc();
  };

  tr.querySelector(".p").oninput = () => {
    const cp = tr.dataset.catalogPrice;
    tr.classList.toggle(
      "override",
      cp !== undefined &&
      cp !== "" &&
      Math.abs(Number(tr.querySelector(".p").value || 0) - Number(cp)) > .0001
    );
    calc();
  };

  tr.querySelector(".w").oninput = calc;
  tr.querySelector(".del").onclick = () => {
    if ($("lines").children.length > 1) tr.remove();
    calc();
  };
}

function total() {
  return [...$("lines").children].reduce(
    (s, r) =>
      s +
      Number(r.querySelector(".w").value || 0) *
      Number(r.querySelector(".p").value || 0),
    0
  );
}

function calc() {
  [...$("lines").children].forEach(r => {
    r.querySelector(".t").textContent = m(
      Number(r.querySelector(".w").value || 0) *
      Number(r.querySelector(".p").value || 0)
    );
  });
  $("grand").textContent = m(total());
}

async function img(file) {
  if (!file) return null;

  const im = await new Promise((ok, no) => {
    const x = new Image();
    x.onload = () => ok(x);
    x.onerror = no;
    x.src = URL.createObjectURL(file);
  });

  const sc = Math.min(1, 1400 / Math.max(im.width, im.height));
  const c = document.createElement("canvas");
  c.width = im.width * sc;
  c.height = im.height * sc;
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);

  const d = c.toDataURL("image/jpeg", .72);
  URL.revokeObjectURL(im.src);

  return {
    fileName: (file.name || "image") + ".jpg",
    mimeType: "image/jpeg",
    base64: d.split(",")[1]
  };
}

async function save(e) {
  e.preventDefault();
  $("save").disabled = true;

  try {
    const lines = [...$("lines").children].map(r => {
      const id = Number(r.querySelector(".v").value);
      const c = catalog.find(x => Number(x.id) === id);
      return {
        varietyId: id,
        varietyName: c?.name || "",
        weightKg: Number(r.querySelector(".w").value),
        pricePerKg: Number(r.querySelector(".p").value)
      };
    });

    if (lines.some(x => !x.varietyId || !x.varietyName || x.weightKg <= 0 || x.pricePerKg < 0)) {
      throw Error("راجع الصنف والوزن والسعر");
    }

    if (Number($("paid").value || 0) > total() + .01) {
      throw Error("المدفوع أكبر من الإجمالي");
    }

    const a = [];
    const i = await img($("idcard").files[0]);
    const d = await img($("doc").files[0]);

    if (i) a.push({ ...i, type: "ID_CARD" });
    if (d) a.push({ ...d, type: "RECEIPT" });

    const r = await apiPost("/olive/receipts", {
      companyId: Number(getCompanyId() || 1),
      siteCode: $("siteCode").value,
      supplierName: $("supplierName").value,
      supplierPhone: $("supplierPhone").value,
      supplierNationalId: $("supplierNationalId").value,
      supplierAddress: $("supplierAddress").value,
      vehiclePlate: $("vehiclePlate").value,
      lines,
      paidAmount: Number($("paid").value || 0),
      paymentMethod: $("method").value,
      paymentReference: $("ref").value,
      notes: $("notes").value,
      attachments: a
    });

    last = r.data || r;
    $("print").disabled = false;
    $("msg").innerHTML = `<div class="msg ok">تم الحفظ: ${last.receipt_no}</div>`;
  } catch (x) {
    $("msg").innerHTML = `<div class="msg err">${esc(x.message || "فشل الحفظ")}</div>`;
  } finally {
    $("save").disabled = false;
  }
}

function prt(r) {
  const s = printSettings || {};
  const width = Number(s.paper_width_mm || 80);
  const companyId = Number(getCompanyId() || 1);

  const w = window.open("", "_blank", "width=460,height=860");
  if (!w) return;

  const dt = new Date(r.created_at);
  const dateText = dt.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const timeText = dt.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const logo = s.has_logo
    ? `<img
         src="https://api.mi.virginiaolive.com/api/olive/settings/receipt/logo?companyId=${companyId}"
         class="logo"
         alt="logo"
       >`
    : "";

  const supplierPhone = s.show_supplier_phone && r.supplier_phone
    ? infoRow("الهاتف", r.supplier_phone)
    : "";

  const supplierNationalId = s.show_supplier_national_id && r.supplier_national_id
    ? infoRow("الرقم القومي", r.supplier_national_id)
    : "";

  const vehicle = s.show_vehicle_plate && r.vehicle_plate
    ? infoRow("السيارة", r.vehicle_plate)
    : "";

  const items = (r.lines || []).map(x => `
    <tr>
      <td class="item-name">${esc(x.variety_name)}</td>
      <td>${qty(x.weight_kg)}</td>
      <td>${m(x.price_per_kg)}</td>
      <td>${m(x.line_total)}</td>
    </tr>
  `).join("");

  const paymentStatus =
    Number(r.balance_amount || 0) <= 0
      ? "مسدد بالكامل"
      : Number(r.paid_amount || 0) > 0
        ? "مسدد جزئياً"
        : "غير مسدد";

  w.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(r.receipt_no || "فاتورة شراء زيتون")}</title>
<style>
  @page {
    size: ${width}mm auto;
    margin: 2.5mm;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
  }

  body {
    width: ${width - 5}mm;
    margin: 0 auto;
    color: #111;
    font-family: Tahoma, Arial, "Segoe UI", sans-serif;
    font-size: 11.5px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .receipt {
    width: 100%;
  }

  .header {
    text-align: center;
    padding-bottom: 7px;
    border-bottom: 2px solid #2f5f25;
  }

  .logo {
    max-width: 48mm;
    max-height: 18mm;
    object-fit: contain;
    display: block;
    margin: 0 auto 4px;
  }

  .company {
    font-size: 17px;
    font-weight: 900;
    margin: 0;
  }

  .title {
    font-size: 15px;
    font-weight: 900;
    color: #2f5f25;
    margin: 2px 0 0;
  }

  .company-meta {
    margin-top: 3px;
    font-size: 9.8px;
    color: #444;
  }

  .receipt-no {
    margin: 7px 0 3px;
    text-align: center;
    font-family: Consolas, monospace;
    font-weight: 900;
    font-size: 12px;
    letter-spacing: .2px;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 7px;
    margin-bottom: 6px;
  }

  .meta-box {
    border: 1px solid #d7d7d7;
    border-radius: 5px;
    padding: 4px 6px;
    background: #fafafa;
  }

  .meta-label {
    display: block;
    font-size: 8.7px;
    color: #666;
    margin-bottom: 1px;
  }

  .meta-value {
    font-weight: 800;
    font-size: 10.5px;
  }

  .section {
    margin-top: 7px;
  }

  .section-title {
    font-size: 11.5px;
    font-weight: 900;
    color: #2f5f25;
    padding: 3px 0;
    border-bottom: 1px solid #2f5f25;
    margin-bottom: 2px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    border-bottom: 1px dotted #aaa;
    padding: 3px 0;
  }

  .info-row .label {
    color: #555;
    white-space: nowrap;
  }

  .info-row .value {
    font-weight: 800;
    text-align: left;
    overflow-wrap: anywhere;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 5px;
    table-layout: fixed;
    font-size: 9.5px;
  }

  th {
    background: #2f5f25;
    color: #fff;
    font-weight: 900;
    padding: 4px 2px;
    border: 1px solid #2f5f25;
  }

  td {
    padding: 4px 2px;
    text-align: center;
    border-bottom: 1px solid #ddd;
    vertical-align: middle;
  }

  th:nth-child(1), td:nth-child(1) { width: 34%; }
  th:nth-child(2), td:nth-child(2) { width: 21%; }
  th:nth-child(3), td:nth-child(3) { width: 21%; }
  th:nth-child(4), td:nth-child(4) { width: 24%; }

  .item-name {
    font-weight: 800;
    text-align: right;
  }

  .totals {
    margin-top: 7px;
    border: 1.5px solid #2f5f25;
    border-radius: 7px;
    overflow: hidden;
  }

  .grand {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 7px 8px;
    background: #eef5ea;
    border-bottom: 1px solid #cbd9c5;
  }

  .grand .label {
    font-size: 12px;
    font-weight: 900;
  }

  .grand .value {
    font-size: 18px;
    font-weight: 900;
    color: #214918;
  }

  .money-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px dotted #b6b6b6;
    font-size: 10.5px;
  }

  .money-row:last-child {
    border-bottom: 0;
  }

  .money-row strong {
    font-weight: 900;
  }

  .status {
    margin-top: 5px;
    text-align: center;
    font-weight: 900;
    padding: 4px 6px;
    border-radius: 5px;
    background: #f3f3f3;
  }

  .operator {
    margin-top: 7px;
    border-top: 1px dashed #777;
    padding-top: 5px;
  }

  .note {
    margin-top: 7px;
    padding: 6px;
    text-align: center;
    font-size: 9.5px;
    border: 1px dashed #aaa;
    border-radius: 5px;
  }

  .signature {
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: flex-end;
  }

  .signature .line {
    flex: 1;
    border-bottom: 1px solid #111;
    height: 15px;
  }

  .footer {
    margin-top: 10px;
    text-align: center;
    color: #555;
    font-size: 9px;
    border-top: 1px solid #ddd;
    padding-top: 5px;
  }

  @media print {
    body {
      width: ${width - 5}mm;
    }
  }
</style>
</head>
<body>
<div class="receipt">

  <div class="header">
    ${logo}
    <div class="company">${esc(s.company_name || "VIRGINIA")}</div>
    <div class="title">${esc(s.receipt_title || "فاتورة شراء زيتون")}</div>
    ${
      s.company_address || s.company_phone
        ? `<div class="company-meta">
             ${s.company_address ? esc(s.company_address) : ""}
             ${s.company_address && s.company_phone ? " • " : ""}
             ${s.company_phone ? esc(s.company_phone) : ""}
           </div>`
        : ""
    }
  </div>

  <div class="receipt-no">${esc(r.receipt_no || "")}</div>

  <div class="meta-grid">
    <div class="meta-box">
      <span class="meta-label">التاريخ</span>
      <span class="meta-value">${esc(dateText)}</span>
    </div>
    <div class="meta-box">
      <span class="meta-label">الوقت</span>
      <span class="meta-value">${esc(timeText)}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">بيانات المورد</div>
    ${infoRow("المورد", r.supplier_name || "-")}
    ${supplierPhone}
    ${supplierNationalId}
    ${vehicle}
  </div>

  <div class="section">
    <div class="section-title">تفاصيل الاستلام</div>
    <table>
      <thead>
        <tr>
          <th>الصنف</th>
          <th>الكمية كجم</th>
          <th>السعر</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${items}
      </tbody>
    </table>
  </div>

  <div class="totals">
    <div class="grand">
      <span class="label">الإجمالي</span>
      <span class="value">${m(r.total_amount)} جنيه</span>
    </div>

    <div class="money-row">
      <span>المدفوع</span>
      <strong>${m(r.paid_amount)} جنيه</strong>
    </div>

    <div class="money-row">
      <span>المتبقي</span>
      <strong>${m(r.balance_amount)} جنيه</strong>
    </div>
  </div>

  <div class="status">${paymentStatus}</div>

  <div class="operator">
    ${infoRow("المحاسب", r.created_by || "-")}
  </div>

  ${
    r.notes
      ? `<div class="note"><strong>ملاحظات:</strong><br>${esc(r.notes)}</div>`
      : ""
  }

  ${
    s.footer_text
      ? `<div class="note">${esc(s.footer_text)}</div>`
      : ""
  }

  <div class="signature">
    <span>توقيع المورد:</span>
    <div class="line"></div>
  </div>

  <div class="footer">
    ${esc(r.receipt_no || "")}
  </div>

</div>
<script>
  window.addEventListener("load", function () {
    setTimeout(function () { window.print(); }, 300);
  });
<\/script>
</body>
</html>`);

  w.document.close();
}

function infoRow(label, value) {
  return `
    <div class="info-row">
      <span class="label">${esc(label)}</span>
      <span class="value">${esc(value)}</span>
    </div>
  `;
}

function qty(v) {
  return new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  }).format(Number(v || 0));
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
