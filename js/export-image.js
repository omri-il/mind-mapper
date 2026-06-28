// export-image.js — PNG/SVG export via mind-elixir's built-in methods.
import { download, safeName } from './export-text.js';

export async function exportPng(mind, title) {
  const blob = await mind.exportPng(); // Promise<Blob|null>
  if (!blob) throw new Error('ייצוא PNG נכשל');
  download(blob, safeName(title) + '.png');
}

export function exportSvg(mind, title) {
  const blob = mind.exportSvg(); // Blob (sync)
  if (!blob) throw new Error('ייצוא SVG נכשל');
  download(blob, safeName(title) + '.svg');
}
