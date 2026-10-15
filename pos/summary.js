// This page uses only the grouped Odoo API. Prevent the shared legacy exporter/filter toolbar.
window.loadReportExportEngine=function(){};
const originalPosSummaryToolbar=window.shouldShowReportToolbar;
if(typeof originalPosSummaryToolbar==='function')window.shouldShowReportToolbar=function(page){return page==='pos-summary'?false:originalPosSummaryToolbar.apply(this,arguments);};
let groupedGeneration=0,groupedController=null,groupedBusy=false,groupedCurrency='';
const cairoToday=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(v=>[v.type,v.value]));return `${p.year}-${p.month}-${p.day}`;};
document.addEventListener("DOMContentLoaded", () => {
  renderLayout(
    "ملخص نقاط البيع",
    "ملخص تنفيذي موحد للمبيعات، المرتجعات، الخصومات، الفروع، الكاشيرات، وساعات الذروة.",
    "pos-summary",
    buildPosSummaryPage()
  );

  bindPosSummaryEvents();
  renderInitialState();
  initGroupedCatalog();
});

function buildPosSummaryPage() {
  return `
    <div class="container-fluid mi-bootstrap-page px-0">
    <section class="mi-report-card mb-4">
      <a class="btn btn-outline-secondary mb-3" href="../dashboard/index.html">الرجوع للصفحة الرئيسية</a>
      <p>المصدر: تقرير أودو الجاهز — تجميع داخل أودو، بدون كاش أو تخزين أو تحميل فواتير.</p>
      <form id="groupedForm" class="row g-3 align-items-end">
        <label class="col-md-3">من<input class="form-control" type="date" id="groupedFrom" required></label>
        <label class="col-md-3">إلى<input class="form-control" type="date" id="groupedTo" required></label>
        <label class="col-md-3">الفرع / المعرض<select class="form-select" id="groupedBranch"><option value="all">جارٍ جلب الفروع المسموحة…</option></select></label>
        <div class="col-md-3"><button type="submit" class="btn btn-primary" id="groupedLoad" disabled>تحديث التقرير من أودو</button></div>
      </form>
      <div class="d-flex flex-wrap gap-2 mt-3">
        <button type="button" class="btn btn-outline-secondary" id="groupedYtd">السنة الحالية حتى اليوم</button>
        <button type="button" class="btn btn-outline-secondary" id="groupedPreviousYear">السنة السابقة كاملة</button>
        <label>السنة <input id="groupedYear" type="number" min="1900" max="2100" style="width:100px" aria-label="رقم السنة"></label>
        <button type="button" class="btn btn-outline-secondary" id="groupedFullYear">عرض سنة كاملة</button>
      </div>
      <p id="groupedFetched" class="small text-secondary mt-3" role="status"></p>
      <button class="btn btn-outline-secondary" type="button" id="groupedExport" disabled>تنزيل الجداول المعروضة CSV</button>
    </section>
    <section id="loadingBox" class="alert alert-warning d-flex align-items-center hidden" role="status">
      <span class="spinner-border spinner-border-sm mi-loading-spinner" aria-hidden="true"></span>
      جاري تحميل ملخص نقاط البيع...
    </section>

    <section id="errorBox" class="alert alert-danger hidden" role="alert"></section>

    <section id="pendingBox" class="mi-pending-card p-4 mb-4">
      <h2 class="h6 fw-bold mb-2">التقرير لم يتم تحميله بعد</h2>
      <p class="mb-0">
        اختار الشركة ثم الفرع / النطاق، وبعدها اضغط
        <strong>تحديث التقرير</strong>
        لعرض البيانات.
      </p>
    </section>

    <section id="kpiGrid" class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3 mb-4"></section>

    <section class="mi-report-card pos-summary-section">
      <h2 class="mi-report-title"><span class="mi-section-icon">📊</span>مقارنة المبيعات مع نفس الفترة من السنة السابقة</h2>
      <button type="button" class="btn btn-outline-primary mb-3" data-grouped-section="comparison" disabled>جلب المقارنة من أودو</button><div id="periodComparisonGrid">تجلب عند الطلب.</div>
    </section>

    <section class="mi-report-card pos-summary-section">
      <h2 class="mi-report-title"><span class="mi-section-icon">⚡</span>مؤشرات إدارية سريعة</h2>
      <div id="highlightsBox"></div>
    </section>

    <section class="mi-report-card pos-summary-section">
      <h2 class="mi-report-title"><span class="mi-section-icon">🏬</span>ملخص المعارض</h2>
      <p class="text-secondary small">
        كل الفروع والمعارض حسب صافي المبيعات، والإجمالي أسفل الجدول.
      </p>
      <div id="branchesTable"></div><h3 class="h6 mt-3" id="groupedReviewHeading" hidden>نقاط تحتاج مراجعة الربط — تدخل في إجمالي الكل</h3><div id="groupedReview"></div>
    </section>

    <section class="mi-report-card pos-summary-section">
      <h2 class="mi-report-title"><span class="mi-section-icon">👤</span>ملخص الكاشيرات</h2>
      <p class="text-secondary small">
        الكاشير المسجل على الفاتورة، بتجميع مباشر داخل أودو.
      </p>
      <button type="button" class="btn btn-outline-primary mb-3" data-grouped-section="cashiers" disabled>جلب الكاشيرات من أودو</button><div id="cashiersTable">تجلب عند الطلب.</div>
    </section>

    <section class="mi-report-card pos-summary-section">
      <h2 class="mi-report-title"><span class="mi-section-icon">⏱</span>ساعات الذروة</h2>
      <p class="text-secondary small">
        أقوى الساعات حسب عدد الفواتير. هذا مؤشر ضغط وليس مدة خدمة العميل.
      </p>
      <button type="button" class="btn btn-outline-primary mb-3" data-grouped-section="hours" disabled>جلب ساعات البيع من أودو</button><div id="hoursTable">تجلب عند الطلب.</div>
    </section>

    <section class="mi-report-card pos-summary-section">
      <h2 class="mi-report-title"><span class="mi-section-icon">⚠</span>تحذيرات إدارية</h2>
      <div id="warningsBox"></div>
    </section>

    <section class="mi-report-card pos-summary-section">
      <h2 class="mi-report-title"><span class="mi-section-icon">ℹ</span>ملاحظات الحساب</h2>
      <div id="notesBox"></div>
    </section>
    </div>
  `;
}

function resetGrouped(){groupedGeneration++;groupedController?.abort();groupedBusy=false;renderFilterChangedState();document.getElementById('groupedFetched').textContent='تغيرت الفلاتر؛ اضغط تحديث.';document.getElementById('groupedExport').disabled=true;document.getElementById('groupedReview').innerHTML='';document.getElementById('groupedReviewHeading').hidden=true;document.querySelectorAll('[data-grouped-section]').forEach(b=>b.disabled=true);document.getElementById('groupedLoad').disabled=false;}
function bindPosSummaryEvents(){
 document.getElementById('groupedFrom').value=document.getElementById('groupedTo').value=cairoToday();
 document.getElementById('groupedYear').value=cairoToday().slice(0,4);
 const period=(from,to)=>{document.getElementById('groupedFrom').value=from;document.getElementById('groupedTo').value=to;resetGrouped();};
 document.getElementById('groupedYtd').onclick=()=>period(cairoToday().slice(0,4)+'-01-01',cairoToday());
 document.getElementById('groupedPreviousYear').onclick=()=>{const y=Number(cairoToday().slice(0,4))-1;period(y+'-01-01',y+'-12-31');};
 document.getElementById('groupedFullYear').onclick=()=>{const y=Number(document.getElementById('groupedYear').value);if(!Number.isInteger(y)||y<1900||y>2100){showErrorMessage('اختر سنة صحيحة');return;}period(y+'-01-01',y+'-12-31');};
 document.getElementById('groupedForm').onsubmit=e=>{e.preventDefault();loadPosSummaryReport();};
 for(const id of ['groupedFrom','groupedTo','groupedBranch'])document.getElementById(id).onchange=resetGrouped;
 document.querySelectorAll('[data-grouped-section]').forEach(b=>b.onclick=()=>loadPosSummaryReport(b.dataset.groupedSection));
 window.addEventListener('company-context-changed',()=>{resetGrouped();initGroupedCatalog();});
 document.getElementById('groupedExport').onclick=()=>{const rows=[['ملخص نقاط البيع — تقرير أودو'],['الفترة',document.getElementById('groupedFrom').value,document.getElementById('groupedTo').value],['النطاق',document.getElementById('groupedBranch').selectedOptions[0]?.textContent||''],['العملة',groupedCurrency],[]];document.querySelectorAll('#kpiGrid .mi-kpi-card,#periodComparisonGrid .mi-kpi-card').forEach(c=>rows.push([c.querySelector('.mi-kpi-label')?.textContent||'',c.querySelector('.mi-kpi-value')?.textContent||'']));document.querySelectorAll('#branchesTable table,#groupedReview table,#cashiersTable table,#hoursTable table').forEach(t=>{rows.push([]);t.querySelectorAll('tr').forEach(tr=>rows.push([...tr.cells].map(c=>c.textContent.trim())));});const safe=v=>{v=String(v);if(/^[=+@-]/.test(v.trimStart()))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};const blob=new Blob(['\ufeff'+rows.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='pos-odoo-'+document.getElementById('groupedFrom').value+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
async function groupedFetch(section,signal){const q=new URLSearchParams({...getPosSummaryFilters(),section});const r=await fetch((window.API_BASE_URL||'https://api.mi.virginiaolive.com/api')+'/pos-grouped/summary?'+q,{headers:getAuthHeaders(),cache:'no-store',signal});const body=await r.json();if(!r.ok||body.success===false)throw Error(body.message||'تعذر جلب تقرير أودو');return body.data;}
async function initGroupedCatalog(){const generation=++groupedGeneration;groupedController?.abort();const ctl=groupedController=new AbortController();const timer=setTimeout(()=>ctl.abort(),95000);document.getElementById('groupedLoad').disabled=true;try{const d=await groupedFetch('catalog',ctl.signal);if(generation!==groupedGeneration)return;const opts=items=>items.map(b=>`<option value="${escapeHtml(b.branchCode)}">${escapeHtml(b.branchName)}</option>`).join('');const permanent=d.branches.filter(b=>!b.isExhibition),exhibitions=d.branches.filter(b=>b.isExhibition);document.getElementById('groupedBranch').innerHTML='<option value="all">كل الفروع والمعارض المسموحة</option>'+(permanent.length?'<optgroup label="فروع البيع الدائمة">'+opts(permanent)+'</optgroup>':'')+(exhibitions.length?'<optgroup label="المعارض والمواسم">'+opts(exhibitions)+'</optgroup>':'');document.getElementById('groupedLoad').disabled=false;}catch(e){if(generation===groupedGeneration)showErrorMessage(e.name==='AbortError'?'انتهت مهلة جلب الفروع؛ أعد فتح الصفحة.':e.message);}finally{clearTimeout(timer);}}

function renderInitialState() {
  hideError();
  hideLoading();
  clearReportData();

  const pendingBox = document.getElementById("pendingBox");

  if (pendingBox) {
    pendingBox.classList.remove("hidden");
    pendingBox.innerHTML = `
      <h2 class="h6 fw-bold mb-2">التقرير لم يتم تحميله بعد</h2>
      <p class="mb-0">
        اختار الشركة ثم الفرع / النطاق، وبعدها اضغط
        <strong>تحديث التقرير</strong>
        لعرض ملخص نقاط البيع.
      </p>
    `;
  }

  hideReportSections();
}

function renderFilterChangedState() {
  hideError();
  hideLoading();
  clearReportData();

  const pendingBox = document.getElementById("pendingBox");

  if (pendingBox) {
    pendingBox.classList.remove("hidden");
    pendingBox.innerHTML = `
      <h2 class="h6 fw-bold mb-2">تم تغيير الفلاتر</h2>
      <p class="mb-0">
        اضغط <strong>تحديث التقرير</strong> لتطبيق الشركة والفرع والفترة الجديدة.
      </p>
    `;
  }

  hideReportSections();
}

function hideReportSections() {
  document.querySelectorAll(".pos-summary-section").forEach((section) => {
    section.classList.add("hidden");
  });
}

function showReportSections() {
  document.querySelectorAll(".pos-summary-section").forEach((section) => {
    section.classList.remove("hidden");
  });
}

function clearReportData() {
  const ids = [
    "kpiGrid",
    "periodComparisonGrid",
    "highlightsBox",
    "branchesTable",
    "cashiersTable",
    "hoursTable",
    "warningsBox",
    "notesBox"
  ];

  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.innerHTML = "";
  });
}

function hideLoading() {
  document.getElementById("loadingBox")?.classList.add("hidden");
}

function showLoadingBox() {
  document.getElementById("loadingBox")?.classList.remove("hidden");
}

function hideError() {
  const errorBox = document.getElementById("errorBox");

  if (!errorBox) return;

  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function showErrorMessage(message) {
  const errorBox = document.getElementById("errorBox");

  if (!errorBox) {
    alert(message);
    return;
  }

  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function validatePosSummaryContext(){const f=getPosSummaryFilters();return{ok:!!f.companyId&&!!f.dateFrom&&!!f.dateTo&&f.dateFrom<=f.dateTo,message:'اختر الشركة والفترة بصورة صحيحة.'};}
function getPosSummaryFilters(){return{companyId:String(getCompanyId()||''),dateFrom:document.getElementById('groupedFrom').value,dateTo:document.getElementById('groupedTo').value,branchCode:document.getElementById('groupedBranch').value||'all'};}
async function loadPosSummaryReport(section='summary'){
 if(typeof section!=='string')section='summary';if(groupedBusy)return;const validation=validatePosSummaryContext();if(!validation.ok){showErrorMessage(validation.message);return;}
 const generation=++groupedGeneration;groupedController?.abort();const ctl=groupedController=new AbortController(),timer=setTimeout(()=>ctl.abort(),95000);groupedBusy=true;hideError();showLoadingBox();document.querySelectorAll('#groupedLoad,[data-grouped-section]').forEach(b=>b.disabled=true);
 if(section==='summary'){document.getElementById('groupedFetched').textContent='جارٍ الجلب من أودو…';clearReportData();document.getElementById('groupedReview').innerHTML='';document.getElementById('groupedReviewHeading').hidden=true;document.getElementById('groupedExport').disabled=true;hideReportSections();}else document.getElementById(section==='comparison'?'periodComparisonGrid':section==='cashiers'?'cashiersTable':'hoursTable').innerHTML='جارٍ الجلب من أودو…';
 let succeeded=false;
 try{const d=await groupedFetch(section,ctl.signal);if(generation!==groupedGeneration)return;groupedCurrency=d.currency.name;document.getElementById('pendingBox').classList.add('hidden');showReportSections();
 if(section==='summary'){renderPosSummaryReport(d);document.getElementById('groupedReviewHeading').hidden=!d.reviewRows.length;renderTable('groupedReview',d.reviewRows,[["الموقع / ملاحظة الربط","branchName"],["الفواتير","ordersCount",v=>formatNumber(v,0)],["الصافي","netSales",formatMoney]]);}
 else if(section==='comparison')renderPeriodComparison(d.comparison);
 else if(section==='cashiers'){renderCashiers(d.cashiers);const cards=document.querySelectorAll('#kpiGrid .mi-kpi-value');if(cards[14])cards[14].textContent=formatNumber(d.summary.activeCashiersCount,0);}
 else{renderHours(d.hours);const cards=document.querySelectorAll('#kpiGrid .mi-kpi-value');if(cards[17])cards[17].textContent=d.summary.peakHourByOrders?.hourLabel||'—';}
 document.getElementById('groupedFetched').textContent='آخر جلب لهذا الجزء: '+new Date(d.meta.fetchedAt).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'})+' — '+d.meta.groupRows+' صف تجميع من أودو — العملة: '+groupedCurrency+' — بدون كاش.';document.getElementById('groupedExport').disabled=false;succeeded=true;
 }catch(e){if(generation!==groupedGeneration)return;showErrorMessage(e.name==='AbortError'?'انتهت مهلة أودو؛ اختر فترة أقصر أو أعد المحاولة.':e.message);if(section!=='summary')document.getElementById(section==='comparison'?'periodComparisonGrid':section==='cashiers'?'cashiersTable':'hoursTable').innerHTML='تعذر الجلب؛ أعد المحاولة.';}
 finally{clearTimeout(timer);if(generation===groupedGeneration){groupedBusy=false;hideLoading();document.getElementById('groupedLoad').disabled=false;document.querySelectorAll('[data-grouped-section]').forEach(b=>b.disabled=section==='summary'&&!succeeded);}}
}

function renderPosSummaryReport(data){
 renderPosSummaryKpis(data.summary);renderHighlights([{label:"أفضل فرع / معرض",value:data.summary.topBranchName||"—",metric:"حسب صافي المبيعات"},{label:"المصدر والعملة",value:"تقرير أودو — "+groupedCurrency,metric:"بدون تخزين نتائج"}]);renderBranches(data.branches);renderWarnings(data.warnings);renderNotes(data.notes);
 document.getElementById('periodComparisonGrid').textContent='تجلب المقارنة من أودو عند الضغط على الزر.';
 document.getElementById('cashiersTable').textContent='يجلب تجميع الكاشيرات عند الضغط على الزر.';
 document.getElementById('hoursTable').textContent='يجلب تجميع ساعات البيع عند الضغط على الزر.';
 const footer=document.querySelector('#branchesTable table');if(footer){const r=data.summary;const values=['إجمالي النطاق — يشمل بنود المراجعة',formatNumber(r.ordersCount,0),formatMoney(r.grossSales),formatMoney(r.returnsValue),formatMoney(r.negativeAdjustmentsValue),formatMoney(r.netSales),formatMoney(r.averageTicket),formatPercent(r.customerCaptureRate)];footer.insertAdjacentHTML('beforeend','<tfoot><tr>'+values.map(v=>'<th>'+escapeHtml(v)+'</th>').join('')+'</tr></tfoot>');}
}

function renderPosSummaryKpis(summary) {
  const kpiGrid = document.getElementById("kpiGrid");
  if (!kpiGrid) return;

  const cards = [
    {
      title: "عدد الفواتير",
      value: formatNumber(summary.ordersCount, 0),
      hint: "إجمالي فواتير POS في الفترة",
      tone: "purple"
    },
    {
      title: "إجمالي المبيعات",
      value: formatMoney(summary.grossSales),
      hint: "المبيعات الموجبة فقط قبل المرتجعات",
      tone: "teal"
    },
    {
      title: "المرتجعات / استرداد أموال",
      value: formatMoney(summary.returnsValue),
      hint: "استرداد أموال فقط، وليس كل سطر سالب",
      tone: "danger"
    },
    {
      title: "العروض والتعديلات السالبة",
      value: formatMoney(summary.negativeAdjustmentsValue),
      hint: "سطور سالبة داخل فواتير البيع العادية مثل عروض أو كوبونات أو تسويات",
      tone: "warning"
    },
    {
      title: "صافي المبيعات",
      value: formatMoney(summary.netSales),
      hint: "إجمالي المبيعات - المرتجعات - العروض والتعديلات السالبة",
      tone: "success"
    },
    {
      title: "متوسط الفاتورة",
      value: formatMoney(summary.averageTicket),
      hint: "صافي المبيعات ÷ عدد الفواتير",
      tone: "teal"
    },
    {
      title: "إجمالي الخصومات",
      value: formatMoney(summary.totalDiscountValue),
      hint: "خصم تقرير أودو على سطور البيع العادي الموجبة"
    },
    {
      title: "نسبة الخصم",
      value: formatPercent(summary.discountPercent),
      hint: "إجمالي الخصم ÷ إجمالي المبيعات"
    },
    {
      title: "نسبة المرتجعات",
      value: formatPercent(summary.returnsPercent),
      hint: "استرداد الأموال ÷ إجمالي المبيعات"
    },
    {
      title: "نسبة العروض والتعديلات",
      value: formatPercent(summary.negativeAdjustmentsPercent),
      hint: "العروض والتعديلات السالبة ÷ إجمالي المبيعات"
    },
    {
      title: "إجمالي الهامش",
      value: formatMoney(summary.totalMargin),
      hint: "هامش تقرير أودو بعملة الشركة إن توفر"
    },
    {
      title: "نسبة الهامش",
      value: formatPercent(summary.marginPercent),
      hint: "الهامش ÷ صافي المبيعات"
    },
    {
      title: "تسجيل العملاء",
      value: formatPercent(summary.customerCaptureRate),
      hint: "نسبة الفواتير المرتبطة بعميل"
    },
    {
      title: "الفروع النشطة",
      value: formatNumber(summary.activeBranchesCount, 0),
      hint: "عدد الفروع التي لديها فواتير"
    },
    {
      title: "الكاشيرات النشطة",
      value: summary.activeCashiersCount==null?"عند جلب الكاشيرات":formatNumber(summary.activeCashiersCount, 0),
      hint: "عدد الكاشيرات الذين لديهم فواتير"
    },
    {
      title: "نقاط البيع النشطة",
      value: formatNumber(summary.activePosConfigsCount, 0),
      hint: "عدد POS Configs النشطة"
    },
    {
      title: "أفضل معرض",
      value: summary.topBranchName || "-",
      hint: "حسب صافي المبيعات"
    },
    {
      title: "أقوى ساعة",
      value: summary.peakHourByOrders?.hourLabel || "عند جلب الساعات",
      hint: "حسب عدد الفواتير"
    }
  ];

  cards.push({title:"صافي تقرير أودو الجاهز",value:formatMoney(summary.reportNetSales),hint:"يشمل السطور الموجبة داخل فواتير الاسترداد إن وجدت"});
  const icons = ["🧾", "💰", "↩", "🎁", "✅", "🛒", "🏷", "%", "↩", "%", "📈", "%", "👥", "🏬", "👤", "🧾", "🏆", "⏱"];

  kpiGrid.innerHTML = cards
    .map((card, index) => {
      const percentValue = String(card.value || "").includes("%")
        ? Math.min(Math.max(Number.parseFloat(String(card.value)), 0), 100)
        : null;

      return `
      <div class="col">
       <div class="mi-kpi-card h-100"
            data-tone="${escapeHtml(card.tone || ["purple", "teal", "success", "warning"][index % 4])}"
            data-icon="${icons[index] || "📊"}"
            style="--mi-delay:${index * 45}ms">
        <span class="mi-kpi-label">${escapeHtml(card.title)}</span>
        <strong class="mi-kpi-value">${escapeHtml(card.value)}</strong>
        <small class="mi-kpi-hint">${escapeHtml(card.hint)}</small>
        ${percentValue !== null ? `
          <div class="mi-kpi-progress"><span style="--mi-progress:${percentValue}%"></span></div>
        ` : ""}
       </div>
      </div>
    `;
    })
    .join("");
}

function formatPeriodLabel(period = {}) {
  if (!period.dateFrom || !period.dateTo) return "-";
  return `${period.dateFrom} إلى ${period.dateTo}`;
}

function signedPercent(value) {
  if(value===null||value===undefined||value==='')return "—";
  const number = Number(value);
  const sign = number > 0 ? "+" : "";
  return `${sign}${formatPercent(number)}`;
}

function signedMoney(value) {
  if(value===null||value===undefined||value==='')return "—";
  const number = Number(value);
  const sign = number > 0 ? "+" : "";
  return `${sign}${formatMoney(number)}`;
}

function renderPeriodComparison(comparison = {}) {
  const container = document.getElementById("periodComparisonGrid");
  if (!container) return;

  const current = comparison.current || {};
  const previous = comparison.previous || {};
  const changes = comparison.changes || {};
  const currentPeriodLabel = formatPeriodLabel(comparison.currentPeriod);
  const previousPeriodLabel = formatPeriodLabel(comparison.previousPeriod);

  const cards = [
    {
      title: "إجمالي المبيعات — الفترة الحالية",
      value: formatMoney(current.grossSales || 0),
      hint: currentPeriodLabel,
      tone: "teal",
      icon: "💰"
    },
    {
      title: "صافي المبيعات — الفترة الحالية",
      value: formatMoney(current.netSales || 0),
      hint: currentPeriodLabel,
      tone: "success",
      icon: "✅"
    },
    {
      title: "عدد الأوردرات — الفترة الحالية",
      value: formatNumber(current.ordersCount || 0),
      hint: currentPeriodLabel,
      tone: "purple",
      icon: "🧾"
    },
    {
      title: "إجمالي المبيعات — السنة السابقة",
      value: formatMoney(previous.grossSales),
      hint: previousPeriodLabel,
      tone: "teal",
      icon: "💰"
    },
    {
      title: "صافي المبيعات — السنة السابقة",
      value: formatMoney(previous.netSales),
      hint: previousPeriodLabel,
      tone: "success",
      icon: "✅"
    },
    {
      title: "عدد الأوردرات — السنة السابقة",
      value: formatNumber(previous.ordersCount || 0),
      hint: previousPeriodLabel,
      tone: "purple",
      icon: "🧾"
    },
    {
      title: "تغير إجمالي المبيعات",
      value: signedPercent(changes.grossSalesPercent),
      hint: signedMoney(changes.grossSales),
      tone: Number(changes.grossSales || 0) >= 0 ? "success" : "danger",
      icon: "📈"
    },
    {
      title: "تغير صافي المبيعات",
      value: signedPercent(changes.netSalesPercent),
      hint: signedMoney(changes.netSales),
      tone: Number(changes.netSales || 0) >= 0 ? "success" : "danger",
      icon: "📉"
    },
    {
      title: "تغير عدد الأوردرات",
      value: signedPercent(changes.ordersCountPercent),
      hint: `${Number(changes.ordersCount || 0) > 0 ? "+" : ""}${formatNumber(changes.ordersCount || 0)} أوردر`,
      tone: Number(changes.ordersCount || 0) >= 0 ? "success" : "danger",
      icon: "📊"
    }
  ];

  container.innerHTML = `
    <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
      ${cards.map((card, index) => `
        <div class="col">
          <div class="mi-kpi-card h-100"
               data-tone="${escapeHtml(card.tone)}"
               data-icon="${card.icon}"
               style="--mi-delay:${index * 45}ms">
            <span class="mi-kpi-label">${escapeHtml(card.title)}</span>
            <strong class="mi-kpi-value">${escapeHtml(card.value)}</strong>
            <small class="mi-kpi-hint">${escapeHtml(card.hint)}</small>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}
function renderHighlights(rows) {
  const container = document.getElementById("highlightsBox");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div class="alert mi-empty-state py-4">لا توجد مؤشرات.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3">
      ${rows.map((item, index) => `
        <div class="col">
         <div class="mi-kpi-card h-100"
              data-tone="${["teal", "purple", "success", "warning"][index % 4]}"
              data-icon="${["⚡", "🏆", "📈", "💡"][index % 4]}"
              style="--mi-delay:${index * 55}ms">
          <span class="mi-kpi-label">${escapeHtml(item.label)}</span>
          <strong class="mi-kpi-value">${escapeHtml(item.value || "-")}</strong>
          <small class="mi-kpi-hint">${escapeHtml(item.metric || "-")}</small>
         </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderBranches(rows) {
  renderTable("branchesTable", rows, [
    ["المعرض", "branchName"],
    ["عدد الفواتير", "ordersCount", (v) => formatNumber(v, 0)],
    ["إجمالي المبيعات", "grossSales", formatMoney],
    ["المرتجعات / استرداد أموال", "returnsValue", formatMoney],
    ["العروض والتعديلات السالبة", "negativeAdjustmentsValue", formatMoney],
    ["صافي المبيعات", "netSales", formatMoney],
    ["متوسط الفاتورة", "averageTicket", formatMoney],
    ["تسجيل العملاء", "customerCaptureRate", formatPercent]
  ]);
}

function renderCashiers(rows) {
  renderTable("cashiersTable", rows, [
    ["الكاشير", "cashierName"],
    ["عدد الفواتير", "ordersCount", (v) => formatNumber(v, 0)],
    ["إجمالي المبيعات", "grossSales", formatMoney],
    ["المرتجعات / استرداد أموال", "returnsValue", formatMoney],
    ["العروض والتعديلات السالبة", "negativeAdjustmentsValue", formatMoney],
    ["صافي المبيعات", "netSales", formatMoney],
    ["متوسط الفاتورة", "averageTicket", formatMoney],
    ["تسجيل العملاء", "customerCaptureRate", formatPercent]
  ]);
}

function renderHours(rows) {
  renderTable("hoursTable", rows, [
    ["الساعة", "hourLabel"],
    ["عدد الفواتير", "ordersCount", (v) => formatNumber(v, 0)],
    ["إجمالي المبيعات", "grossSales", formatMoney],
    ["المرتجعات / استرداد أموال", "returnsValue", formatMoney],
    ["صافي المبيعات", "netSales", formatMoney],
    ["متوسط الفاتورة", "averageTicket", formatMoney],
    ["فاصل الفواتير / دقيقة", "averageInvoiceGapMinutes", formatNullableNumber],
    ["التقييم", "evaluationLabel"]
  ]);
}

function renderWarnings(warnings) {
  const container = document.getElementById("warningsBox");
  if (!container) return;

  if (!warnings.length) {
    container.innerHTML = `
      <div class="alert alert-success mb-0">
        لا توجد تحذيرات إدارية واضحة في الفترة المحددة.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="d-grid gap-2">
        ${warnings.map((warning) => `
          <div class="mi-insight-item mi-risk-item">
            <strong>${escapeHtml(warning.level || "info")}:</strong>
            ${escapeHtml(warning.message || warning)}
          </div>
        `).join("")}
    </div>
  `;
}

function renderNotes(notes) {
  const container = document.getElementById("notesBox");
  if (!container) return;

  if (!notes.length) {
    container.innerHTML = `<div class="alert mi-empty-state py-4">لا توجد ملاحظات.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="d-grid gap-2">
        ${notes.map((note) => `
          <div class="mi-insight-item">${escapeHtml(note)}</div>
        `).join("")}
    </div>
  `;
}

function renderTable(containerId, rows, columns) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!Array.isArray(rows) || !rows.length) {
    container.innerHTML = `<div class="alert mi-empty-state py-4">لا توجد بيانات.</div>`;
    return;
  }

  const header = columns
    .map(([label]) => `<th>${escapeHtml(label)}</th>`)
    .join("");

  const body = rows
    .map((row) => {
      const cells = columns.map(([label, key, formatter]) => {
        const raw = row[key];
        const value = formatter ? formatter(raw, row) : raw;

        return `<td>${escapeHtml(value)}</td>`;
      }).join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover table-striped align-middle mi-data-table">
        <thead>
          <tr>${header}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function formatNumber(value, digits = 2) {
  if(value===null||value===undefined||value==='')return "—";
  const number = Number(value);

  return number.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatNullableNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  return formatNumber(value, 2);
}

function formatMoney(value) {
  return value==null?"—":`${formatNumber(value, 2)} ${groupedCurrency}`;
}

function formatPercent(value) {
  return value==null?"—":`${formatNumber(value, 2)}%`;
}

function escapeHtml(value) {
  
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
