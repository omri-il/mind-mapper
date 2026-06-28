// mindmap.js — thin wrapper around a MindElixir instance: init, edit ops, theme,
// direction, camera, and change notifications. Keeps the rest of the app decoupled
// from mind-elixir's exact API surface (one place to fix if the library changes).
import MindElixir from 'https://cdn.jsdelivr.net/npm/mind-elixir@5/dist/MindElixir.js';
import { toMindElixir, fromMindElixir, DIR } from './schema.js';
import { getTheme } from './theme.js';

export class MindMap {
  constructor(selector) {
    this.mind = new MindElixir({
      el: selector,
      direction: MindElixir.RIGHT,
      draggable: true,
      editable: true,
      contextMenu: false,
      toolBar: false,
      keypress: true,
      allowUndo: true,
      locale: 'en',
      newTopicName: 'נושא חדש',
    });
    this._env = null;
  }

  // Load an envelope into the map.
  load(env) {
    this._env = env;
    this.mind.init(toMindElixir(env, getTheme(env.meta.theme)));
    this._applyDirection(env.meta.direction);
    this.selectRoot();
  }

  selectRoot() {
    const rootEl = MindElixir.E('root');
    if (rootEl) this.mind.selectNode(rootEl);
  }

  current() { return this.mind.currentNode || null; }
  currentList() {
    if (this.mind.currentNodes?.length) return this.mind.currentNodes;
    return this.mind.currentNode ? [this.mind.currentNode] : [];
  }

  // Rebuild the envelope from the live map (for save/export).
  getEnvelope() {
    return fromMindElixir(this.mind.getData(), this._env);
  }
  // Keep our cached envelope fresh (called by autosave path).
  syncEnvelope() { this._env = this.getEnvelope(); return this._env; }

  onChange(cb) {
    this.mind.bus.addListener('operation', (op) => cb(op));
  }
  onSelect(cb) {
    this.mind.bus.addListener('selectNodes', (nodes) => cb(nodes));
  }

  // ---- node editing (operate on the current selection) ----
  async addChild() {
    if (!this.current()) this.selectRoot();
    await this.mind.addChild();
    this.mind.beginEdit();
  }
  async addSibling() {
    const el = this.current();
    if (!el || el.nodeObj?.id === 'root') { await this.addChild(); return; }
    await this.mind.insertSibling('after');
    this.mind.beginEdit();
  }
  edit() {
    if (!this.current()) this.selectRoot();
    this.mind.beginEdit();
  }
  remove() {
    const list = this.currentList().filter((el) => el?.nodeObj?.id !== 'root');
    if (!list.length) return false;
    this.mind.removeNodes(list);
    return true;
  }

  setColor(bg) {
    const el = this.current(); if (!el) return;
    this.mind.reshapeNode(el, { style: { background: bg, color: readableText(bg) } });
  }
  clearColor() {
    const el = this.current(); if (!el) return;
    this.mind.reshapeNode(el, { style: { background: '', color: '' } });
  }
  setIcon(emoji) {
    const el = this.current(); if (!el) return;
    this.mind.reshapeNode(el, { icons: [emoji] });
  }
  clearIcon() {
    const el = this.current(); if (!el) return;
    this.mind.reshapeNode(el, { icons: [] });
  }

  // Append AI-generated subtrees as children of the current node, then re-render.
  appendChildren(children) {
    const el = this.current();
    if (!el?.nodeObj || !children?.length) return false;
    const obj = el.nodeObj;
    obj.children = obj.children || [];
    obj.children.push(...children);
    obj.expanded = true;
    this.mind.refresh();
    const again = MindElixir.E(obj.id);
    if (again) this.mind.selectNode(again);
    return true;
  }

  // The selected node's topic + its path from the root (for AI context).
  currentContext() {
    const el = this.current();
    if (!el?.nodeObj) return null;
    const topic = el.nodeObj.topic || '';
    const root = this.mind.getData().nodeData;
    const trail = findTrail(root, el.nodeObj.id) || [];
    const path = trail.slice(0, -1).map((n) => n.topic);
    return { topic, path: path.join(' › ') };
  }

  // ---- theme ----
  setTheme(key) {
    this.mind.changeTheme(getTheme(key), true);
    if (this._env) this._env.meta.theme = key;
  }

  // ---- direction ----
  _applyDirection(dir) {
    if (dir === DIR.LEFT) this.mind.initLeft();
    else if (dir === DIR.SIDE) this.mind.initSide();
    else this.mind.initRight();
  }
  cycleDirection() {
    const cur = this._env?.meta.direction ?? DIR.RIGHT;
    const next = cur === DIR.RIGHT ? DIR.LEFT : cur === DIR.LEFT ? DIR.SIDE : DIR.RIGHT;
    if (this._env) this._env.meta.direction = next;
    this._applyDirection(next);
    return next;
  }

  // ---- camera ----
  zoomIn() { this.mind.scale(Math.min((this.mind.scaleVal || 1) * 1.2, 3)); }
  zoomOut() { this.mind.scale(Math.max((this.mind.scaleVal || 1) / 1.2, 0.2)); }
  fit() { this.mind.scaleFit(); }
}

// return the chain of nodes [root, ..., target] for a given id, or null
function findTrail(node, id, trail = []) {
  if (!node) return null;
  const next = [...trail, node];
  if (node.id === id) return next;
  for (const c of node.children || []) {
    const r = findTrail(c, id, next);
    if (r) return r;
  }
  return null;
}

// pick black or white text for a given background hex for readable contrast
function readableText(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1f2738' : '#ffffff';
}
