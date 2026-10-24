'use strict';
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const systemAdmin=()=>{const u=getCurrentUser();return [u.role,...(Array.isArray(u.roles)?u.roles:[])].some(r=>['admin','super_admin','owner'].includes(String(typeof r==='string'?r:r?.code||r?.name||'').toLowerCase()));};
 const permission=code=>isAdmin()||systemAdmin()||getUserPermissions().includes(code);
 const access=()=>systemAdmin()||['olive.receive','olive.admin','olive.settings','olive.mill.receive','olive.mill.cost','olive.traders.view'].some(permission);
 const basePermission=hasPermission;
 window.hasPermission=page=>page==='olive-home'?access():page==='olive-advanced'?systemAdmin():basePermission(page);
 Object.assign(REPORT_PAGE_MAP,{'olive-mill-receiving':'olive.mill.receive','olive-mill-cost':'olive.mill.cost','olive-advanced':'olive.admin','olive-traders':'olive.traders.view'});
 const pages=['olive-home','olive-receive','olive-admin','olive-settings','olive-mill-receiving','olive-mill-cost','olive-advanced','olive-traders'];
 const module={id:'olive',label:'موسم الزيتون',pages,groups:[{id:'operations',label:'تشغيل',links:[{page:'olive-home'},{page:'olive-receive'},{page:'olive-settings'},{page:'olive-mill-receiving'}]},{id:'reports',label:'متابعة وتحليل',links:[{page:'olive-admin'},{page:'olive-mill-cost'}]},{id:'management',label:'إدارة',links:[{page:'olive-advanced'}]}]};
 pages.forEach(page=>MI_PAGE_MODULE_MAP.set(page,module));
 const baseToolbar=shouldShowReportToolbar;
 window.shouldShowReportToolbar=page=>pages.includes(page)?false:baseToolbar(page);
 const baseNavigation=renderMiSectionNavigation;
 window.renderMiSectionNavigation=page=>!pages.includes(page)?baseNavigation(page):`<nav class="mi-section-nav mi-section-nav-grouped" aria-label="تنقل موسم الزيتون"><a class="mi-section-dashboard-link" href="../dashboard/index.html"><span aria-hidden="true">←</span><strong>لوحة الإدارة</strong></a>${page!=='olive-home'?'<a class="mi-section-dashboard-link" href="./home.html"><strong>بوابة الزيتون</strong></a>':''}<div class="mi-section-nav-context"><span class="mi-section-module-label">موسم الزيتون</span></div></nav>`;
 window.OlivePortal={systemAdmin,permission,access,esc};
})();
