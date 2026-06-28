// ui.js — reusable UI bits: toasts, popovers, color/emoji pickers, maps drawer.
import { listMaps } from './storage.js';

// ---- toasts ----
export function toast(msg, kind = '') {
  const wrap = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2200);
  setTimeout(() => el.remove(), 2600);
}

// ---- popovers ----
export function closeAllPopovers() {
  document.querySelectorAll('.popover').forEach((p) => (p.hidden = true));
}
export function togglePopover(pop) {
  const willOpen = pop.hidden;
  closeAllPopovers();
  pop.hidden = !willOpen;
}
export function setupGlobalDismiss() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tb-pop-wrap') && !e.target.closest('.popover')) closeAllPopovers();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllPopovers(); });
}

// ---- pickers ----
export const COLORS = [
  '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#ff5d8f', '#ff9f1c', '#2ec4b6', '#3a86ff',
  '#fb5607', '#06d6a0', '#e63946', '#64748b', '#1f2738', '#ffffff',
];
export const EMOJIS = [
  '💡', '🎯', '⭐', '📌', '✅', '⚠️', '❓', '🔥', '🚀', '🧠', '📊', '📅',
  '💰', '👥', '❤️', '🔑', '⚙️', '🔍', '✏️', '📂', '⏰', '🚩', '📖', '🎓',
  '🌱', '🌟', '🧩', '🔗', '📝', '💬', '🏆', '🎨', '🔔', '📈', '🛠️', '🌍',
];
export function fillSwatches(container, onPick) {
  container.innerHTML = '';
  COLORS.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'swatch'; b.style.background = c; b.title = c;
    b.addEventListener('click', () => onPick(c));
    container.appendChild(b);
  });
}
export function fillEmoji(container, onPick) {
  container.innerHTML = '';
  EMOJIS.forEach((e) => {
    const b = document.createElement('button');
    b.textContent = e;
    b.addEventListener('click', () => onPick(e));
    container.appendChild(b);
  });
}

// ---- drawer ----
export function openDrawer() {
  document.getElementById('drawer').hidden = false;
  document.getElementById('scrim').hidden = false;
}
export function closeDrawer() {
  document.getElementById('drawer').hidden = true;
  document.getElementById('scrim').hidden = true;
}
export function renderMapsList(activeId, handlers) {
  const ul = document.getElementById('mapsList');
  ul.innerHTML = '';
  const maps = listMaps();
  if (!maps.length) {
    ul.innerHTML = '<li style="color:var(--muted);padding:10px">אין מפות שמורות עדיין</li>';
    return;
  }
  maps.forEach((m) => {
    const li = document.createElement('li');
    li.className = 'map-item' + (m.id === activeId ? ' active' : '');
    li.innerHTML = `
      <div class="mi-main">
        <div class="mi-title"></div>
        <div class="mi-date">${formatDate(m.updatedAt)}</div>
      </div>
      <div class="mi-actions">
        <button data-act="rename" title="שנה שם">✏️</button>
        <button data-act="dup" title="שכפל">⧉</button>
        <button data-act="del" title="מחק">🗑️</button>
      </div>`;
    li.querySelector('.mi-title').textContent = m.title || 'ללא שם';
    li.querySelector('.mi-main').addEventListener('click', () => handlers.onOpen(m.id));
    li.querySelector('[data-act=rename]').addEventListener('click', (e) => { e.stopPropagation(); handlers.onRename(m.id); });
    li.querySelector('[data-act=dup]').addEventListener('click', (e) => { e.stopPropagation(); handlers.onDuplicate(m.id); });
    li.querySelector('[data-act=del]').addEventListener('click', (e) => { e.stopPropagation(); handlers.onDelete(m.id); });
    ul.appendChild(li);
  });
}
function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) + ' ' +
           d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
