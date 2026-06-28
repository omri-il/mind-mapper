// app.js — bootstraps the map and wires the Hebrew toolbar, pickers, drawer, export & import.
import { MindMap } from './mindmap.js';
import * as store from './storage.js';
import { newEnvelope, validate, genId, DIR } from './schema.js';
import { applyChromeTheme } from './theme.js';
import { exportPng, exportSvg } from './export-image.js';
import { exportJSON, toMarkdown, toOPML, download, safeName } from './export-text.js';
import { callGenerate, buildForest } from './ai.js';
import * as ui from './ui.js';

const mm = new MindMap('#map');
let current = null;                          // live envelope
const autosave = store.makeAutosaver(600);
const $ = (id) => document.getElementById(id);

const DIR_NAME = { [DIR.RIGHT]: 'שורש מימין', [DIR.LEFT]: 'שורש משמאל', [DIR.SIDE]: 'דו-צדדי' };

function setTitle(t) { $('currentMapTitle').textContent = t || 'ללא שם'; }

function openEnvelope(env) {
  current = env;
  mm.load(env);
  applyChromeTheme(env.meta.theme);
  setTitle(env.meta.title);
  store.saveMap(env);
}

function newMap() {
  const env = newEnvelope('מפה חדשה');
  store.saveMap(env);
  openEnvelope(env);
  ui.toast('נוצרה מפה חדשה', 'ok');
}

function persist() {
  current = mm.syncEnvelope();
  setTitle(current.meta.title);
  autosave(current);
}

// ---------- boot ----------
function boot() {
  const lastId = store.getLastOpenedId();
  const saved = lastId ? store.loadMap(lastId) : null;
  if (saved) {
    openEnvelope(validate(saved));
  } else {
    const e = newEnvelope('מפה ראשונה');
    e.root.topic = 'הרעיון שלי';
    e.root.children = [
      { id: 'a', topic: 'נושא ראשון', children: [] },
      { id: 'b', topic: 'נושא שני', children: [] },
      { id: 'c', topic: 'נושא שלישי', children: [] },
    ];
    store.saveMap(e);
    openEnvelope(e);
  }
  mm.onChange(() => persist());
  wireToolbar();
  ui.setupGlobalDismiss();
}

// ---------- toolbar ----------
function wireToolbar() {
  // node editing
  $('btnAddChild').onclick = () => mm.addChild();
  $('btnAddSibling').onclick = () => mm.addSibling();
  $('btnEdit').onclick = () => mm.edit();
  $('btnDelete').onclick = () => { if (!mm.remove()) ui.toast('אי אפשר למחוק את הצומת המרכזי'); };

  // color picker
  ui.fillSwatches($('colorSwatches'), (c) => { mm.setColor(c); ui.closeAllPopovers(); persist(); });
  $('btnColor').onclick = () => ui.togglePopover($('popColor'));
  $('btnClearColor').onclick = () => { mm.clearColor(); ui.closeAllPopovers(); persist(); };

  // icon picker
  ui.fillEmoji($('emojiGrid'), (e) => { mm.setIcon(e); ui.closeAllPopovers(); persist(); });
  $('btnIcon').onclick = () => ui.togglePopover($('popIcon'));
  $('btnClearIcon').onclick = () => { mm.clearIcon(); ui.closeAllPopovers(); persist(); };

  // theme
  $('btnTheme').onclick = () => ui.togglePopover($('popTheme'));
  document.querySelectorAll('.theme-opt').forEach((b) => {
    b.onclick = () => {
      const key = b.dataset.theme;
      mm.setTheme(key); applyChromeTheme(key);
      ui.closeAllPopovers(); persist();
      ui.toast('הסגנון עודכן', 'ok');
    };
  });

  // view
  $('btnZoomIn').onclick = () => mm.zoomIn();
  $('btnZoomOut').onclick = () => mm.zoomOut();
  $('btnFit').onclick = () => mm.fit();
  $('btnDir').onclick = () => { const d = mm.cycleDirection(); persist(); ui.toast('כיוון פריסה: ' + DIR_NAME[d]); };

  // file
  $('btnNew').onclick = () => newMap();
  $('btnImport').onclick = () => $('fileInput').click();
  $('fileInput').onchange = onImportFile;

  // export menu
  $('btnExport').onclick = () => ui.togglePopover($('popExport'));
  document.querySelectorAll('[data-export]').forEach((b) => { b.onclick = () => doExport(b.dataset.export); });

  // maps drawer
  $('btnMaps').onclick = openDrawer;
  $('closeDrawer').onclick = ui.closeDrawer;
  $('scrim').onclick = ui.closeDrawer;
  $('drawerNew').onclick = () => { ui.closeDrawer(); newMap(); };

  // AI
  $('btnAI').onclick = openAIModal;
  $('btnExpand').onclick = runExpand;
  $('aiClose').onclick = closeAIModal;
  $('aiScrim').onclick = closeAIModal;
  $('aiGo').onclick = runGenerate;
  document.querySelectorAll('.seg-btn').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
  $('aiInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runGenerate(); });
}

// ---------- AI ----------
let aiMode = 'generate';
function openAIModal() { $('aiScrim').hidden = false; $('aiModal').hidden = false; setBusy(false); $('aiInput').value = ''; $('aiInput').focus(); }
function closeAIModal() { $('aiScrim').hidden = true; $('aiModal').hidden = true; }
function setBusy(b) { $('aiBusy').hidden = !b; $('aiGo').disabled = b; }
function setMode(m) {
  aiMode = m;
  document.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x.dataset.mode === m));
  $('aiInput').placeholder = m === 'source'
    ? 'הדבק כאן מאמר, סיכום או הערות — וה-AI יבנה מהם מפה'
    : "על מה המפה? לדוגמה: שיעור על פוטוסינתזה לכיתה ז'";
  $('aiHint').textContent = m === 'source'
    ? 'ה-AI יבנה מפה מהטקסט שלך בלבד. תיווצר מפה חדשה.'
    : 'המפה תיווצר כמפה חדשה ולא תדרוס את הנוכחית.';
}

async function runGenerate() {
  const text = $('aiInput').value.trim();
  if (!text) { ui.toast('צריך להזין טקסט', 'err'); return; }
  setBusy(true);
  try {
    const { title, nodes } = await callGenerate({ mode: aiMode, prompt: text });
    const forest = buildForest(nodes);
    if (!forest.length) throw new Error('לא התקבלה מפה');
    let root = forest.length === 1 ? forest[0] : { topic: title || 'מפת AI', children: forest, expanded: true };
    root.id = 'root';
    const env = newEnvelope(title || 'מפת AI');
    env.root = root;
    store.saveMap(env);
    openEnvelope(env);
    closeAIModal();
    ui.toast('המפה נוצרה ✨', 'ok');
  } catch (err) {
    ui.toast(err.message || 'יצירת המפה נכשלה', 'err');
  } finally {
    setBusy(false);
  }
}

async function runExpand() {
  const ctx = mm.currentContext();
  if (!ctx || !ctx.topic) { ui.toast('בחר קודם צומת להרחבה', 'err'); return; }
  ui.toast('מרחיב עם AI…');
  try {
    const { nodes } = await callGenerate({ mode: 'expand', topic: ctx.topic, path: ctx.path });
    const forest = buildForest(nodes);
    if (!mm.appendChildren(forest)) throw new Error('לא ניתן להרחיב את הצומת');
    persist();
    ui.toast('נוספו רעיונות ✨', 'ok');
  } catch (err) {
    ui.toast(err.message || 'ההרחבה נכשלה', 'err');
  }
}

// ---------- export ----------
async function doExport(kind) {
  ui.closeAllPopovers();
  const env = mm.getEnvelope();
  try {
    if (kind === 'png') { await exportPng(mm.mind, env.meta.title); }
    else if (kind === 'svg') { exportSvg(mm.mind, env.meta.title); }
    else if (kind === 'json') { exportJSON(env); }
    else if (kind === 'md') { download(toMarkdown(env.root), safeName(env.meta.title) + '.md', 'text/markdown'); }
    else if (kind === 'opml') { download(toOPML(env.root, env.meta.title), safeName(env.meta.title) + '.opml', 'text/xml'); }
    ui.toast('היצוא הושלם', 'ok');
  } catch (err) {
    console.error(err);
    ui.toast(err.message || 'הייצוא נכשל', 'err');
  }
}

// ---------- import ----------
function onImportFile(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const env = validate(JSON.parse(reader.result));
      env.meta.id = 'm_' + genId().slice(1); // avoid overwriting an existing map
      store.saveMap(env);
      openEnvelope(env);
      ui.toast('המפה יובאה', 'ok');
    } catch (err) {
      ui.toast(err.message || 'קובץ לא תקין', 'err');
    }
  };
  reader.readAsText(file);
}

// ---------- drawer ----------
function openDrawer() {
  ui.openDrawer();
  ui.renderMapsList(current?.meta.id, {
    onOpen: (id) => { const env = store.loadMap(id); if (env) { openEnvelope(validate(env)); ui.closeDrawer(); } },
    onRename: (id) => {
      const t = window.prompt('שם חדש למפה:', store.loadMap(id)?.meta.title || '');
      if (t && t.trim()) {
        store.renameMap(id, t.trim());
        if (id === current?.meta.id) { current.meta.title = t.trim(); mm._env.meta.title = t.trim(); setTitle(t.trim()); }
        openDrawer();
      }
    },
    onDuplicate: (id) => { store.duplicateMap(id); openDrawer(); ui.toast('המפה שוכפלה', 'ok'); },
    onDelete: (id) => {
      if (!window.confirm('למחוק את המפה? פעולה זו אינה הפיכה.')) return;
      store.deleteMap(id);
      if (id === current?.meta.id) {
        const next = store.listMaps()[0];
        if (next) openEnvelope(validate(store.loadMap(next.id)));
        else newMap();
      }
      openDrawer();
    },
  });
}

boot();
