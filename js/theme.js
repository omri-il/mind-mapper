// theme.js — two mind-elixir theme presets built on top of the library defaults,
// so every default cssVar key stays defined and only our accents differ.
import MindElixir from 'https://cdn.jsdelivr.net/npm/mind-elixir@5/dist/MindElixir.js';

const BASE = MindElixir.THEME; // light default theme (full cssVar set)

const CLEAN_PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
const PLAYFUL_PALETTE = ['#ff5d8f', '#ff9f1c', '#2ec4b6', '#3a86ff', '#8338ec', '#fb5607', '#06d6a0', '#e63946'];

export const THEMES = {
  clean: {
    name: 'clean',
    palette: CLEAN_PALETTE,
    cssVar: {
      ...BASE.cssVar,
      '--root-color': '#ffffff',
      '--root-bgcolor': '#4f46e5',
      '--root-radius': '14px',
      '--main-radius': '10px',
      '--main-color': '#1f2738',
      '--main-bgcolor': '#ffffff',
      '--color': '#3a4256',
      '--bgcolor': '#ffffff',
      '--selected': '#4f46e5',
      '--main-line-width': '2px',
    },
  },
  playful: {
    name: 'playful',
    palette: PLAYFUL_PALETTE,
    cssVar: {
      ...BASE.cssVar,
      '--root-color': '#ffffff',
      '--root-bgcolor': '#ec4899',
      '--root-radius': '22px',
      '--main-radius': '18px',
      '--main-color': '#2a1832',
      '--main-bgcolor': '#fff7fb',
      '--color': '#3a2330',
      '--bgcolor': '#fffafd',
      '--selected': '#ec4899',
      '--main-line-width': '3px',
    },
  },
};

export function getTheme(key) { return THEMES[key] || THEMES.clean; }

// Reflect the chosen theme on our own (non-map) chrome via a body attribute.
export function applyChromeTheme(key) {
  document.body.dataset.theme = key === 'playful' ? 'playful' : 'clean';
}
