function formatNumber(value, digits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: digits
  });
}

function formatMoney(value) {
  return formatNumber(value, 2);
}

function formatPercent(value) {
  return `${formatNumber(value, 2)}%`;
}

function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function stateBadge(state) {
  const map = {
    draft: "badge-yellow",
    sent: "badge-blue",
    purchase: "badge-green",
    done: "badge-gray",
    cancel: "badge-red"
  };

  return `<span class="badge ${map[state] || "badge-gray"}">${state || ""}</span>`;
}