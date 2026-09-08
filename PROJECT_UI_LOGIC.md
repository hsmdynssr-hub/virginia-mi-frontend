# MI Frontend — Project UI Contract (V20)

## Navigation
- The dashboard is the only global entry point.
- Internal pages never render a global sidebar.
- Every module gets one compact local navigator below the page header.
- The navigator always contains a return link to the dashboard and only the current module's groups/pages.
- Module links are permission-aware.

## Page structure
Every internal module page follows the same order:
1. Canonical page header.
2. Module-local navigation.
3. Shared report/company toolbar when the page needs it.
4. Optional module runtime/status bar.
5. Page content, cards, filters, tables and actions.

## Canonical header
- One page header only; legacy per-page promotional heroes must not reappear.
- Header title, subtitle, pill, account tools and labels are white without exception.
- Dark indigo/mauve header with the shared orange underline is the project identity.
- Account/language/logout controls live inside the same safe header column.

## Module grouping
Modules can use groups that fit their work, e.g. تشغيل / تقارير / إعدادات / رقابة / تحليلات.
Groups are not forced to be identical across modules.

## Tables
- `table-system.js` and `table-system.css` are the single source of table behavior.
- Tables scroll inside their own wrapper, never by widening the whole page.
- Rows grow with content.
- Order/invoice/reference/code columns are constrained and use LTR internally where needed.
- Dynamically created tables receive the same treatment.

## Legacy cleanup
- Global sidebar selectors and sidebar behavior are intentionally removed from the active layout code/styles.
- V18/premium incremental theme files are not part of this build.
- `mi-app.css` is the final project-wide UI layer and is kept last in cascade order.
- Customer Care keeps only its scoped runtime/report behavior in `customer-module.css`; its header/navigation come from the shared shell.

## Public pages
Customer-facing public pages (public menu, review/coupon submission pages) keep their dedicated public design and do not inherit the internal administration shell.
