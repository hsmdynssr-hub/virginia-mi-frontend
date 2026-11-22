// Controlled Pilot uses existing MI HTTPS API; no secrets.
window.WORKSPACE_API = ['localhost','127.0.0.1'].includes(location.hostname) ? location.origin+'/api' : 'https://api.mi.virginiaolive.com/api';
window.WORKSPACE_ATTACHMENTS_ENABLED = false;
