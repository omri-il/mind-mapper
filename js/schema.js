// schema.js — the MindMap envelope and its adapter to/from mind-elixir data.
// The envelope's `root` IS a mind-elixir nodeData tree, so JSON export round-trips
// losslessly and AI-generated maps use the exact same shape.

export const MM_FORMAT = 'mindmapper';
export const MM_VERSION = 1;

// Direction constants (match MindElixir.LEFT/RIGHT/SIDE)
export const DIR = { LEFT: 0, RIGHT: 1, SIDE: 2 };

export function genId() {
  if (globalThis.crypto?.randomUUID) return 'n' + crypto.randomUUID().slice(0, 8);
  return 'n' + Math.random().toString(36).slice(2, 10);
}

function nowISO() { return new Date().toISOString(); }

// Recursively guarantee every node has a stable id (mind-elixir auto-ids on init,
// but AI/import data may not). Returns the same object.
export function ensureIds(node) {
  if (!node) return node;
  if (!node.id) node.id = genId();
  if (Array.isArray(node.children)) node.children.forEach(ensureIds);
  return node;
}

// A brand-new empty map envelope.
export function newEnvelope(title = 'מפה חדשה', direction = DIR.RIGHT, theme = 'clean') {
  const root = { id: 'root', topic: title === 'מפה חדשה' ? 'נושא מרכזי' : title, children: [] };
  return {
    format: MM_FORMAT,
    version: MM_VERSION,
    meta: {
      id: 'm_' + genId().slice(1),
      title,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      direction,
      locale: 'he',
      theme,
    },
    root,
  };
}

// Envelope -> the data object mind-elixir's init() expects.
export function toMindElixir(env, themeObj) {
  return {
    nodeData: env.root,
    direction: env.meta.direction ?? DIR.RIGHT,
    theme: themeObj || undefined,
  };
}

// mind-elixir getData() -> updated envelope (preserves meta/presentation/ink).
export function fromMindElixir(meData, prevEnv) {
  const env = structuredClone(prevEnv);
  env.root = meData.nodeData;
  if (typeof meData.direction === 'number') env.meta.direction = meData.direction;
  env.meta.updatedAt = nowISO();
  return env;
}

// Validate + migrate an unknown object into a current-version envelope.
// Throws if it's clearly not a mind map file.
export function validate(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('קובץ לא תקין');

  // Accept a raw mind-elixir export ({nodeData,...}) too.
  if (!obj.format && obj.nodeData) {
    const env = newEnvelope(obj.nodeData.topic || 'מפה מיובאת', obj.direction ?? DIR.RIGHT);
    env.root = ensureIds(obj.nodeData);
    return env;
  }
  if (obj.format !== MM_FORMAT || !obj.root) throw new Error('זה לא קובץ מפת חשיבה');

  const env = obj;
  env.version = MM_VERSION; // future migrations would branch on obj.version here
  env.meta = env.meta || {};
  env.meta.id = env.meta.id || ('m_' + genId().slice(1));
  env.meta.title = env.meta.title || 'מפה מיובאת';
  env.meta.direction = env.meta.direction ?? DIR.RIGHT;
  env.meta.locale = env.meta.locale || 'he';
  env.meta.theme = env.meta.theme || 'clean';
  env.meta.createdAt = env.meta.createdAt || nowISO();
  env.meta.updatedAt = nowISO();
  ensureIds(env.root);
  return env;
}
