const API_BASE_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5050/api"
    : "https://odoo-management-intelligence-agent-production.up.railway.app/api";

window.API_BASE_URL = API_BASE_URL;

const VALID_COMPANY_IDS = new Set(["1", "2"]);

function normalizeCompanyId(companyId) {
  const value = String(companyId || "").trim();

  return VALID_COMPANY_IDS.has(value) ? value : "";
}

function getCompanyId() {
  const domValue =
    document.getElementById("companySelect")?.value ||
    document.getElementById("companyId")?.value ||
    "";

  return normalizeCompanyId(domValue);
}

function setCompanyId(companyId) {
  const normalizedCompanyId = normalizeCompanyId(companyId);

  if (!normalizedCompanyId) {
    localStorage.removeItem("companyId");
    return "";
  }

  localStorage.setItem("companyId", normalizedCompanyId);
  return normalizedCompanyId;
}

function getBranchStorageKey(companyId = getCompanyId()) {
  const normalizedCompanyId = normalizeCompanyId(companyId);

  return normalizedCompanyId
    ? `branchCode:${normalizedCompanyId}`
    : "branchCode";
}

function getBranchCode() {
  const possibleIds = [
    "branchCode",
    "cashierBranchCode",
    "peakHoursBranchCode",
    "posBranchCode"
  ];

  for (const id of possibleIds) {
    const value = document.getElementById(id)?.value;

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return String(
    localStorage.getItem(getBranchStorageKey()) ||
    localStorage.getItem("branchCode") ||
    ""
  ).trim();
}

function setBranchCode(branchCode) {
  const value = String(branchCode || "").trim();
  const key = getBranchStorageKey();

  if (!value) {
    localStorage.removeItem(key);
    localStorage.removeItem("branchCode");
    return "";
  }

  localStorage.setItem(key, value);
  localStorage.setItem("branchCode", value);

  return value;
}

function getBranchId() {
  const possibleIds = [
    "branchId",
    "branchFilter"
  ];

  for (const id of possibleIds) {
    const value = document.getElementById(id)?.value;

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

function getDefaultDates() {
  const today = new Date();

  return {
    dateFrom: today.toISOString().slice(0, 10),
    dateTo: today.toISOString().slice(0, 10)
  };
}

function isUsableToken(token) {
  return Boolean(
    token &&
    token !== "null" &&
    token !== "undefined" &&
    String(token).trim()
  );
}

function getToken() {
  const directToken =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("appToken") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("odoo_mi_token") ||
    localStorage.getItem("odooMiToken");

  if (isUsableToken(directToken)) {
    return directToken;
  }

  const possibleJsonKeys = [
    "user",
    "auth",
    "session",
    "currentUser",
    "loginData"
  ];

  for (const key of possibleJsonKeys) {
    try {
      const value = localStorage.getItem(key);
      if (!value) continue;

      const parsed = JSON.parse(value);

      const nestedToken =
        parsed.token ||
        parsed.authToken ||
        parsed.accessToken ||
        parsed.jwt ||
        parsed.appToken;

      if (isUsableToken(nestedToken)) {
        return nestedToken;
      }
    } catch (_) {}
  }

  return "";
}

function getAuthToken() {
  return getToken();
}

function isLocalDevHost() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

function ensureLocalDevSession() {
  if (!isLocalDevHost()) return;

  const token = getToken();

  if (!token) {
    localStorage.setItem("token", "dev-bypass-token");
  }

  const currentUserRaw = localStorage.getItem("user");

  if (!currentUserRaw) {
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: 0,
        username: "dev-admin",
        fullName: "Development Admin",
        role: "admin",
        roles: [
          { id: 0, code: "admin", name: "Development Admin" },
          { id: 1, code: "super_admin", name: "Development Super Admin" }
        ],
        permissions: ["*"],
        isDevBypass: true
      })
    );
  }
}

function getAuthHeaders({ json = true } = {}) {
  ensureLocalDevSession();

  const token = getToken();

  const headers = {};

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function getFilters() {
  const filters = {
    companyId: getCompanyId(),
    dateFrom: document.getElementById("dateFrom")?.value,
    dateTo: document.getElementById("dateTo")?.value
  };

  const branchCode = getBranchCode();

  if (branchCode) {
    filters.branchCode = branchCode;
  }

  const branchId = getBranchId();

  if (branchId && branchId !== "all") {
    filters.branchId = branchId;
  }

  return filters;
}

function isContextFreeApiPath(path) {
  const normalizedPath = String(path || "");

  return (
    normalizedPath.startsWith("/auth") ||
    normalizedPath.startsWith("/company-access") ||
    normalizedPath.startsWith("/permissions") ||
    normalizedPath.startsWith("/roles") ||
    normalizedPath.startsWith("/users") ||
    normalizedPath === "/health" ||
    normalizedPath.endsWith("/health") ||
    normalizedPath === "/report-filters/options"
  );
}

function isReportApiPath(path) {
  const normalizedPath = String(path || "");

  return [
    "/pos",
    "/branches",
    "/customer",
    "/production",
    "/purchase",
    "/inventory",
    "/forecast",
    "/forecast-planning",
    "/exports"
  ].some((prefix) => normalizedPath.startsWith(prefix));
}

function shouldRequireCompanyForPath(path) {
  if (isContextFreeApiPath(path)) return false;

  return isReportApiPath(path);
}

function ensureCompanyContextForParams(path, params = {}) {
  const nextParams = { ...(params || {}) };

  if (!shouldRequireCompanyForPath(path)) {
    return nextParams;
  }

  if (!nextParams.companyId) {
    nextParams.companyId = getCompanyId();
  }

  nextParams.companyId = normalizeCompanyId(nextParams.companyId);

  if (!nextParams.companyId) {
    throw new Error("لازم تختار الشركة قبل تحميل التقرير.");
  }

  return nextParams;
}

function ensureCompanyContextForBody(path, body = {}) {
  if (!shouldRequireCompanyForPath(path)) {
    return body;
  }

  if (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer
  ) {
    return body;
  }

  const nextBody = { ...(body || {}) };

  if (!nextBody.companyId) {
    nextBody.companyId = getCompanyId();
  }

  nextBody.companyId = normalizeCompanyId(nextBody.companyId);

  if (!nextBody.companyId) {
    throw new Error("لازم تختار الشركة قبل تنفيذ العملية.");
  }

  return nextBody;
}

function validateRequiredCompanyContext() {
  const companyId = getCompanyId();

  if (!companyId) {
    return {
      ok: false,
      message: "لازم تختار الشركة أولًا."
    };
  }

  return {
    ok: true,
    companyId
  };
}

async function handleApiResponse(response) {
  let data = null;

  try {
    data = await response.json();
  } catch (_) {
    data = {
      success: false,
      message: `Invalid API response. Status: ${response.status}`
    };
  }

  if (response.status === 401) {
    console.warn("AUTH ERROR:", data);

    throw new Error(
      data.message ||
      "الجلسة غير صالحة. اعمل Login مرة تانية."
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      `API request failed. Status: ${response.status}`
    );
  }

  return data;
}

async function apiGet(path, params = {}) {
  ensureLocalDevSession();

  const safeParams = ensureCompanyContextForParams(path, params);

  const url = new URL(`${API_BASE_URL}${path}`);

  Object.entries(safeParams || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getAuthHeaders({ json: false }),
    cache: "no-store"
  });

  return handleApiResponse(response);
}

async function apiPost(path, body = {}) {
  ensureLocalDevSession();

  const safeBody = ensureCompanyContextForBody(path, body);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(safeBody),
    cache: "no-store"
  });

  return handleApiResponse(response);
}

async function apiPut(path, body = {}) {
  ensureLocalDevSession();

  const safeBody = ensureCompanyContextForBody(path, body);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(safeBody),
    cache: "no-store"
  });

  return handleApiResponse(response);
}

async function apiPatch(path, body = {}) {
  ensureLocalDevSession();

  const safeBody = ensureCompanyContextForBody(path, body);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(safeBody),
    cache: "no-store"
  });

  return handleApiResponse(response);
}

async function apiDelete(path, body = null) {
  ensureLocalDevSession();

  const safeBody = body
    ? ensureCompanyContextForBody(path, body)
    : null;

  const options = {
    method: "DELETE",
    headers: getAuthHeaders(),
    cache: "no-store"
  };

  if (safeBody) {
    options.body = JSON.stringify(safeBody);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, options);

  return handleApiResponse(response);
}

async function apiDownload(path, params = {}, filename = "download.xlsx") {
  ensureLocalDevSession();

  const safeParams = ensureCompanyContextForParams(path, params);

  const url = new URL(`${API_BASE_URL}${path}`);

  Object.entries(safeParams || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getAuthHeaders({ json: false }),
    cache: "no-store"
  });

  if (response.status === 401) {
    throw new Error("الجلسة غير صالحة. اعمل Login مرة تانية.");
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    throw new Error(
      `Download failed: ${response.status} ${errorText.slice(0, 200)}`
    );
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

window.getToken = getToken;
window.getAuthToken = getAuthToken;
window.getCompanyId = getCompanyId;
window.setCompanyId = setCompanyId;
window.getBranchCode = getBranchCode;
window.setBranchCode = setBranchCode;
window.getBranchId = getBranchId;
window.getBranchStorageKey = getBranchStorageKey;
window.getDefaultDates = getDefaultDates;
window.getFilters = getFilters;
window.validateRequiredCompanyContext = validateRequiredCompanyContext;

window.apiGet = apiGet;
window.apiPost = apiPost;
window.apiPut = apiPut;
window.apiPatch = apiPatch;
window.apiDelete = apiDelete;
window.apiDownload = apiDownload;

window.__debugAuth = function () {
  return {
    apiBaseUrl: API_BASE_URL,
    token: getToken(),
    tokenExists: Boolean(getToken()),
    user: (() => {
      try {
        return JSON.parse(localStorage.getItem("user") || "{}");
      } catch {
        return {};
      }
    })(),
    companyId: getCompanyId(),
    branchCode: getBranchCode(),
    branchId: getBranchId(),
    localStorageKeys: Object.keys(localStorage)
  };
};