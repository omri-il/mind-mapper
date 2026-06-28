// storage.js — LocalStorage persistence: a maps index + one entry per map, plus autosave.
import { genId } from './schema.js';

const INDEX_KEY = 'mm:index';
const MAP_KEY = (id) => 'mm:map:' + id;
const LAST_KEY = 'mm:last';

function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function writeJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// index = [{ id, title, updatedAt }] sorted by updatedAt desc
export function listMaps() {
  return readJSON(INDEX_KEY, []).slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

function upsertIndex(meta) {
  const idx = readJSON(INDEX_KEY, []);
  const i = idx.findIndex((m) => m.id === meta.id);
  const row = { id: meta.id, title: meta.title, updatedAt: meta.updatedAt };
  if (i >= 0) idx[i] = row; else idx.push(row);
  writeJSON(INDEX_KEY, idx);
}

export function saveMap(env) {
  writeJSON(MAP_KEY(env.meta.id), env);
  upsertIndex(env.meta);
  writeJSON(LAST_KEY, env.meta.id);
  return env;
}

export function loadMap(id) { return readJSON(MAP_KEY(id), null); }

export function deleteMap(id) {
  localStorage.removeItem(MAP_KEY(id));
  writeJSON(INDEX_KEY, readJSON(INDEX_KEY, []).filter((m) => m.id !== id));
  if (readJSON(LAST_KEY, null) === id) localStorage.removeItem(LAST_KEY);
}

export function renameMap(id, title) {
  const env = loadMap(id); if (!env) return null;
  env.meta.title = title; env.meta.updatedAt = new Date().toISOString();
  return saveMap(env);
}

export function duplicateMap(id) {
  const env = loadMap(id); if (!env) return null;
  const copy = structuredClone(env);
  copy.meta.id = 'm_' + genId().slice(1);
  copy.meta.title = env.meta.title + ' (עותק)';
  copy.meta.createdAt = copy.meta.updatedAt = new Date().toISOString();
  return saveMap(copy);
}

export function getLastOpenedId() { return readJSON(LAST_KEY, null); }
export function setLastOpenedId(id) { writeJSON(LAST_KEY, id); }

// Debounced autosave helper.
export function makeAutosaver(delay = 600) {
  let t = null;
  return function autosave(env) {
    clearTimeout(t);
    t = setTimeout(() => saveMap(env), delay);
  };
}
