// sidebar.js — tab switching + collapse for the unified side panel.
export function initSidebar({ onTab } = {}) {
  const sidebar = document.getElementById('sidebar');
  const rail = [...sidebar.querySelectorAll('.rail-btn')];
  const panes = [...sidebar.querySelectorAll('.side-pane')];
  let active = 'maps';

  function isCollapsed() { return document.body.classList.contains('side-collapsed'); }
  function setCollapsed(c) { document.body.classList.toggle('side-collapsed', c); }

  function show(tab) {
    active = tab;
    rail.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    panes.forEach((p) => (p.hidden = p.dataset.pane !== tab));
    onTab?.(tab);
  }
  function openTab(tab) { show(tab); setCollapsed(false); }
  function toggle() { setCollapsed(!isCollapsed()); }

  rail.forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab)));

  show(active);
  return { show, openTab, setCollapsed, toggle, get active() { return active; } };
}
