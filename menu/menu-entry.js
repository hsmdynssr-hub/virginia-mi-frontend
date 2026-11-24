// Hide the menu before the first paint only when JavaScript is available.
// A failed application load restores the readable, unpriced HTML fallback.
document.documentElement.classList.add('menu-gated');
window.setTimeout(() => {
  if (!window.VirginiaMenuReady) {
    document.documentElement.classList.remove('menu-gated');
    const root = document.getElementById('professionalMenuApp');
    if (root) { root.hidden = false; root.inert = false; }
  }
}, 3500);
