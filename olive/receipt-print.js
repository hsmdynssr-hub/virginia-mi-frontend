"use strict";
(function(){
const m=v=>new Intl.NumberFormat("ar-EG",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0));
function render(r, s = {}, companyId = 1) {
  const width = Number(s.paper_width_mm || 80);


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

  const logo = s.logo_url
    ? `<img
         src="${esc(s.logo_url)}"
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

  return `<!doctype html>
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
    color: #000; font-weight:700;
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
    border-bottom: 2px solid #000;
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
    color: #000;
    margin: 2px 0 0;
  }

  .company-meta {
    margin-top: 3px;
    font-size: 9.8px;
    color: #000; font-weight:700;
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
    border: 1.3px solid #000;
    border-radius: 5px;
    padding: 4px 6px;
    background: #fff;
  }

  .meta-label {
    display: block;
    font-size: 8.7px;
    color: #000; font-weight:800;
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
    color: #000;
    padding: 3px 0;
    border-bottom: 1.5px solid #000;
    margin-bottom: 2px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    border-bottom: 1px dotted #000;
    padding: 3px 0;
  }

  .info-row .label {
    color: #000;
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
    background: #000;
    color: #fff;
    font-weight: 900;
    padding: 4px 2px;
    border: 1px solid #000;
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
    border: 1.8px solid #000;
    border-radius: 7px;
    overflow: hidden;
  }

  .grand {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 7px 8px;
    background: #fff;
    border-bottom: 1px solid #cbd9c5;
  }

  .grand .label {
    font-size: 12px;
    font-weight: 900;
  }

  .grand .value {
    font-size: 18px;
    font-weight: 900;
    color: #000;
  }

  .money-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px dotted #000;
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
    background: #fff; border:1.3px solid #000;
  }

  .operator {
    margin-top: 7px;
    border-top: 1px dashed #000;
    padding-top: 5px;
  }

  .note {
    margin-top: 7px;
    padding: 6px;
    text-align: center;
    font-size: 9.5px;
    border: 1px dashed #000;
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
    color: #000;
    font-size: 9px;
    border-top: 1px solid #000;
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

  ${r.receiving_status === "CANCELLED" ? `<div class="status">سند ملغى — ${esc(r.cancellation_reason || "")}</div>` : ""}
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
</body>
</html>`;
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

function print(r,s,companyId){
  const w=window.open("","_blank","width=460,height=860");if(!w)return;
  w.document.write(render(r,s,companyId));w.document.close();
  w.addEventListener("load",()=>setTimeout(()=>w.print(),300));
}
window.OliveReceiptPrint={render,print};
})();
