// outline.js — render the map tree as an indented RTL list; click an item to focus its node.
export function renderOutline(container, root, onPick) {
  container.innerHTML = '';
  if (!root) return;
  const add = (node, depth) => {
    const li = document.createElement('li');
    li.className = 'outline-item' + (depth === 0 ? ' root' : '');
    li.style.paddingInlineStart = depth * 14 + 8 + 'px';
    const emoji = node.icons && node.icons[0] ? `<span class="o-emoji">${node.icons[0]}</span>` : '';
    li.innerHTML = emoji + '<span class="o-text"></span>';
    li.querySelector('.o-text').textContent = node.topic || '';
    li.addEventListener('click', () => onPick(node.id));
    container.appendChild(li);
    (node.children || []).forEach((c) => add(c, depth + 1));
  };
  add(root, 0);
}
