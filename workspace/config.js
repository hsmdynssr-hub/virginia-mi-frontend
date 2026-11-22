// No keys or Odoo credentials belong here. Preview server uses a local API.
window.WORKSPACE_API = ['localhost','127.0.0.1'].includes(location.hostname)
  ? `${location.origin}/api` : 'https://api.mi.virginiaolive.com/api';

window.WORKSPACE_ATTACHMENTS_ENABLED = false;
