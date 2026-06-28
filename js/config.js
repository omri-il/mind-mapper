// config.js — where the AI proxy lives. Local dev points at a local server;
// production (github.io / custom domain) points at the VPS proxy.
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
export const API_BASE = isLocal ? 'http://localhost:5055' : 'https://mind-ai.omri-iram.co.il';
