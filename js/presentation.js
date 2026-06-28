// presentation.js — full-screen presenter: walk the tree depth-first and smoothly
// zoom to + highlight one idea at a time (Prezi-style). Editing is locked; arrows/buttons navigate.
export class Presentation {
  constructor(mm, { onUpdate, onExit } = {}) {
    this.mm = mm;
    this.onUpdate = onUpdate;
    this.onExit = onExit;
    this.steps = [];
    this.i = 0;
    this.active = false;
    this._keyHandler = null;
    this._cur = null;
  }

  start() {
    const root = this.mm.getEnvelope().root;
    this.steps = [];
    const walk = (n) => { this.steps.push(n.id); (n.children || []).forEach(walk); };
    walk(root);
    if (!this.steps.length) return;

    this.active = true;
    this.mm.setPresenting(true);              // suspend auto re-center; camera is ours now
    document.body.classList.add('presenting');
    this.mm.lockEditing(true);
    this._bindKeys();
    try { document.documentElement.requestFullscreen?.(); } catch {}
    // wait for the full-screen reflow before the first focus
    requestAnimationFrame(() => requestAnimationFrame(() => this.go(0)));
  }

  go(i) {
    if (!this.active) return;
    this.i = Math.max(0, Math.min(this.steps.length - 1, i));
    const id = this.steps[this.i];
    requestAnimationFrame(() => {
      this.mm.presentFocus(id, this.i === 0); // step 0 = whole-map overview
      this._highlight(id);                    // highlight AFTER focus so the class lands on the live node
    });
    this.onUpdate?.(this.i + 1, this.steps.length, this._topic(id));
  }
  next() { if (this.i < this.steps.length - 1) this.go(this.i + 1); }
  prev() { if (this.i > 0) this.go(this.i - 1); }
  overview() { this._clearHighlight(); this.mm.presentFocus(null, true); }

  exit() {
    if (!this.active) return;
    this.active = false;
    this._unbindKeys();
    this._clearHighlight();
    this.mm.lockEditing(false);
    document.body.classList.remove('presenting');
    this.mm.setPresenting(false);
    this.mm.recenter();
    try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
    this.onExit?.();
  }

  _topic(id) {
    const find = (n) => (n.id === id ? n : (n.children || []).reduce((a, c) => a || find(c), null));
    return find(this.mm.getEnvelope().root)?.topic || '';
  }
  _highlight(id) {
    this._clearHighlight();
    const el = this.mm.nodeEl(id);
    if (el) { el.classList.add('present-current'); this._cur = el; }
  }
  _clearHighlight() {
    document.querySelectorAll('me-tpc.present-current').forEach((e) => e.classList.remove('present-current'));
    this._cur = null;
  }

  _bindKeys() {
    this._keyHandler = (e) => {
      const k = e.key;
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); e.stopImmediatePropagation(); this.next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(k)) { e.preventDefault(); e.stopImmediatePropagation(); this.prev(); }
      else if (k === 'Home') { e.preventDefault(); e.stopImmediatePropagation(); this.go(0); }
      else if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.exit(); }
      else { e.stopImmediatePropagation(); } // block stray edit keys
    };
    document.addEventListener('keydown', this._keyHandler, true);
  }
  _unbindKeys() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler, true);
    this._keyHandler = null;
  }
}
