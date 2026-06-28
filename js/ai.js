// ai.js — talk to the Gemini proxy and turn its flat node list into a mind-elixir tree.
import { API_BASE } from './config.js';
import { genId } from './schema.js';

export async function callGenerate(payload) {
  let r;
  try {
    r = await fetch(API_BASE + '/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('לא ניתן להתחבר לשירות ה-AI');
  }
  const data = await r.json().catch(() => ({ error: 'תשובה לא תקינה מהשרת' }));
  if (!r.ok) throw new Error(data.error || ('שגיאה ' + r.status));
  return data; // { title, nodes:[{id,parent,topic,icon}] }
}

export async function health() {
  try {
    const r = await fetch(API_BASE + '/api/health', { method: 'GET' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// Flat [{id,parent,topic,icon}] -> array of mind-elixir nodeData trees (forest).
export function buildForest(nodes) {
  const byId = new Map();
  nodes.forEach((n) => {
    byId.set(String(n.id), {
      _parent: String(n.parent ?? ''),
      topic: String(n.topic ?? '').trim() || '—',
      icon: n.icon || '',
      children: [],
    });
  });
  const roots = [];
  byId.forEach((node) => {
    const p = node._parent;
    if (p && byId.has(p) && byId.get(p) !== node) byId.get(p).children.push(node);
    else roots.push(node);
  });
  const clean = (node) => {
    const out = { id: genId(), topic: node.topic, children: node.children.map(clean) };
    if (node.icon) out.icons = [node.icon];
    if (out.children.length) out.expanded = true;
    return out;
  };
  return roots.map(clean);
}
