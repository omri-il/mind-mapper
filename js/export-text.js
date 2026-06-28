// export-text.js — JSON / Markdown / OPML serializers + small download helpers.

export function safeName(title) {
  return (title || 'mind-map').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 60) || 'mind-map';
}

export function download(blobOrText, filename, mime = 'application/octet-stream') {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJSON(env) {
  download(JSON.stringify(env, null, 2), safeName(env.meta.title) + '.mindmap.json', 'application/json');
}

// ---- Markdown (nested bullets under an H1 root) ----
export function toMarkdown(root) {
  const lines = ['# ' + nodeText(root), ''];
  (root.children || []).forEach((c) => walkMd(c, 0, lines));
  return lines.join('\n') + '\n';
}
function walkMd(node, depth, lines) {
  lines.push('  '.repeat(depth) + '- ' + nodeText(node));
  (node.children || []).forEach((c) => walkMd(c, depth + 1, lines));
}

// ---- OPML 2.0 ----
export function toOPML(root, title) {
  const body = (root.children || []).map((c) => outline(c, 1)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>${xml(title || nodeText(root))}</title></head>
  <body>
    <outline text="${xml(nodeText(root))}">
${body}
    </outline>
  </body>
</opml>
`;
}
function outline(node, depth) {
  const pad = '  '.repeat(depth + 2);
  const kids = (node.children || []).map((c) => outline(c, depth + 1)).join('\n');
  if (kids) return `${pad}<outline text="${xml(nodeText(node))}">\n${kids}\n${pad}</outline>`;
  return `${pad}<outline text="${xml(nodeText(node))}"/>`;
}

function nodeText(node) {
  const icons = Array.isArray(node.icons) && node.icons.length ? node.icons.join('') + ' ' : '';
  return icons + (node.topic || '');
}
function xml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
