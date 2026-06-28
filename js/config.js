// config.js — where the AI proxy lives.
// - Served from the VPS (mindmap.omri-iram.co.il): same origin, no CORS.
// - Local dev: a local proxy on :5055.
// - Anywhere else (e.g. the github.io mirror): the VPS proxy, cross-origin (CORS allow-listed).
const h = location.hostname;
export const API_BASE =
  h === 'mindmap.omri-iram.co.il' ? '' :
  (h === 'localhost' || h === '127.0.0.1') ? 'http://localhost:5055' :
  'https://mindmap.omri-iram.co.il';
