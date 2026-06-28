// app.js — bootstraps the map and wires the toolbar + unified sidebar (Maps/Format/AI/Outline).
import { MindMap } from './mindmap.js';
import * as store from './storage.js';
import { newEnvelope, validate, genId, DIR } from './schema.js';
import { applyChromeTheme } from './theme.js';
import { exportPng, exportSvg } from './export-image.js';
import { exportJSON, toMarkdown, toOPML, download, safeName } from './export-text.js';
import { callGenerate, buildForest } from './ai.js';
import { initSidebar } from './sidebar.js';
import { renderOutline } from './outline.js';
import { Presentation } from './presentation.js';
import * as ui from './ui.js';

const mm = new MindMap('#map');
let current = null;
let side = null;
let present = null;
const autosave = store.makeAutosaver(600);
const $ = (id) => document.getElementById(id);

const DIR_NAME = { [DIR.LEFT]: 'שורש מימין', [DIR.RIGHT]: 'שורש משמאל', [DIR.SIDE]: 'דו-צדדי' };

function setTitle(t) { $('currentMapTitle').textContent = t || 'ללא שם'; }

function openEnvelope(env) {
  current = env;
  mm.load(env);
  applyChromeTheme(env.meta.theme);
  setTitle(env.meta.title);
  store.saveMap(env);
  refreshOutline();
  updateFmtTarget();
  renderMaps();
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
  refreshOutline();
}

function refreshOutline() {
  try { renderOutline($('outlineList'), mm.getEnvelope().root, (id) => mm.focusNodeById(id)); } catch {}
}
function updateFmtTarget() {
  const cur = mm.current();
  $('fmtTarget').textContent = cur?.nodeObj?.topic || 'לא נבחר צומת';
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
  mm.onSelect(() => updateFmtTarget());

  side = initSidebar();
  present = new Presentation(mm, {
    onUpdate: (i, n, topic) => {
      $('presCount').textContent = i + ' / ' + n;
      $('presCaption').textContent = topic || '';
      $('presCaption').hidden = !topic;
    },
    onExit: () => { $('presenterBar').hidden = true; $('presCaption').hidden = true; },
  });
  wireToolbar();
  wireSidebar();
  ui.setupGlobalDismiss();
}

// ---------- toolbar ----------
function wireToolbar() {
  $('btnAddChild').onclick = () => mm.addChild();
  $('btnAddSibling').onclick = () => mm.addSibling();
  $('btnEdit').onclick = () => mm.edit();
  $('btnDelete').onclick = () => { if (!mm.remove()) ui.toast('אי אפשר למחוק את הצומת המרכזי'); };

  $('btnZoomIn').onclick = () => mm.zoomIn();
  $('btnZoomOut').onclick = () => mm.zoomOut();
  $('btnFit').onclick = () => mm.fit();
  $('btnDir').onclick = () => { const d = mm.cycleDirection(); persist(); ui.toast('כיוון פריסה: ' + DIR_NAME[d]); };

  $('btnNew').onclick = () => newMap();
  $('btnImport').onclick = () => $('fileInput').click();
  $('fileInput').onchange = onImportFile;

  $('btnExport').onclick = () => ui.togglePopover($('popExport'));
  document.querySelectorAll('[data-export]').forEach((b) => { b.onclick = () => doExport(b.dataset.export); });

  $('btnMaps').onclick = () => side.openTab('maps');
  $('btnSidebar').onclick = () => side.toggle();

  // presentation
  $('btnPresent').onclick = () => { $('presenterBar').hidden = false; present.start(); };
  $('presNext').onclick = () => present.next();
  $('presPrev').onclick = () => present.prev();
  $('presOverview').onclick = () => present.overview();
  $('presExit').onclick = () => present.exit();
}

// ---------- sidebar wiring ----------
function wireSidebar() {
  // Maps
  $('paneNewMap').onclick = () => newMap();
  renderMaps();

  // Format
  ui.fillSwatches($('fmtColors'), (c) => { mm.setColor(c); persist(); });
  ui.fillEmoji($('fmtEmoji'), (e) => { mm.setIcon(e); persist(); });
  $('fmtClearColor').onclick = () => { mm.clearColor(); persist(); };
  $('fmtClearIcon').onclick = () => { mm.clearIcon(); persist(); };
  $('fmtFontUp').onclick = () => { mm.setFontDelta(4); persist(); };
  $('fmtFontDown').onclick = () => { mm.setFontDelta(-4); persist(); };
  document.querySelectorAll('.theme-opt').forEach((b) => {
    b.onclick = () => {
      const key = b.dataset.theme;
      mm.setTheme(key); applyChromeTheme(key); persist();
      ui.toast('הסגנון עודכן', 'ok');
    };
  });

  // AI
  $('aiGo').onclick = runGenerate;
  $('btnExpand').onclick = runExpand;
  document.querySelectorAll('.seg-btn').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
  $('aiInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runGenerate(); });
}

function renderMaps() {
  ui.renderMapsList(current?.meta.id, {
    onOpen: (id) => { const env = store.loadMap(id); if (env) openEnvelope(validate(env)); },
    onRename: (id) => {
      const t = window.prompt('שם חדש למפה:', store.loadMap(id)?.meta.title || '');
      if (t && t.trim()) {
        store.renameMap(id, t.trim());
        if (id === current?.meta.id) { current.meta.title = t.trim(); mm._env.meta.title = t.trim(); setTitle(t.trim()); }
        renderMaps();
      }
    },
    onDuplicate: (id) => { store.duplicateMap(id); renderMaps(); ui.toast('המפה שוכפלה', 'ok'); },
    onDelete: (id) => {
      if (!window.confirm('למחוק את המפה? פעולה זו אינה הפיכה.')) return;
      store.deleteMap(id);
      if (id === current?.meta.id) {
        const next = store.listMaps()[0];
        if (next) openEnvelope(validate(store.loadMap(next.id)));
        else newMap();
      } else { renderMaps(); }
    },
  });
}

// ---------- AI ----------
let aiMode = 'generate';
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
    const root = forest.length === 1 ? forest[0] : { topic: title || 'מפת AI', children: forest, expanded: true };
    root.id = 'root';
    const env = newEnvelope(title || 'מפת AI');
    env.root = root;
    store.saveMap(env);
    openEnvelope(env);
    $('aiInput').value = '';
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
      env.meta.id = 'm_' + genId().slice(1);
      store.saveMap(env);
      openEnvelope(env);
      ui.toast('המפה יובאה', 'ok');
    } catch (err) {
      ui.toast(err.message || 'קובץ לא תקין', 'err');
    }
  };
  reader.readAsText(file);
}

boot();
