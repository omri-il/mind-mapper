# Mind-Mapper — CLAUDE.md

Hebrew-first web mind mapping & presentation tool. Buildless static front-end (vanilla JS ES
modules + mind-elixir v5 from jsDelivr), deployed to GitHub Pages. RTL is the core differentiator.

## How it's built
- **No build step.** `index.html` loads ES modules from `js/` and mind-elixir from the CDN
  (pinned `@5`). To deploy: push `master`; GitHub Pages serves the repo root.
- **Cache-busting:** after editing `css/style.css` or any `js/*.js`, bump the `?v=N` on the
  `style.css` and `app.js` tags in `index.html` to the same number, or users get stale code.
- **State:** LocalStorage. Keys: `mm:index` (maps list), `mm:map:<id>` (each map), `mm:last`.

## Core library: mind-elixir v5 (v5.13.0)
- ESM: `https://cdn.jsdelivr.net/npm/mind-elixir@5/dist/MindElixir.js`
- CSS: `https://cdn.jsdelivr.net/npm/mind-elixir@5/dist/MindElixir.css` (separate file — required)
- We **disable** its built-in chrome (`contextMenu:false, toolBar:false`) and use our own Hebrew
  RTL toolbar. We keep its canvas + nodes (DOM nodes → native Hebrew bidi).
- Key API used (all in `js/mindmap.js`): `new MindElixir(opts).init(data)`, `getData()`,
  `changeTheme(theme,true)`, `initRight/initLeft/initSide()`, `addChild()`, `insertSibling('after')`,
  `beginEdit()`, `removeNodes([])`, `reshapeNode(topicEl,{style,icons})`, `selectNode()`,
  `bus.addListener('operation'|'selectNodes')`, `scale()/scaleFit()`, `exportPng()/exportSvg()`,
  static `MindElixir.E(id)`, `MindElixir.new(topic)`, `MindElixir.THEME`, `MindElixir.RIGHT`(=1)/`LEFT`(=0)/`SIDE`(=2).
- **RTL layout:** `direction: RIGHT` on an `<html dir="rtl">` page renders **root on the right,
  branches flowing left** — the Hebrew-natural layout. (Visual outcome is what matters; the
  constant name is mind-elixir's.)

## Data model (`js/schema.js`)
One envelope `*.mindmap.json`: `{ format:'mindmapper', version, meta:{id,title,direction,theme,…},
root, presentation?, ink? }`. `root` **is** a mind-elixir `nodeData` tree, so JSON export is a
valid re-importable map and AI maps (later) use the same shape. `validate()` migrates/normalizes
and also accepts a raw mind-elixir export.

## File map
- `index.html` — RTL shell, Hebrew fonts, toolbar, `#map`, drawer, modals.
- `js/app.js` — orchestrator: boot, toolbar wiring, export/import, drawer.
- `js/mindmap.js` — mind-elixir wrapper (the ONLY place that touches its API).
- `js/schema.js` — envelope ↔ nodeData adapter, ids, validate/migrate.
- `js/storage.js` — LocalStorage CRUD + debounced autosave.
- `js/theme.js` — `clean` + `playful` presets (built on `MindElixir.THEME`).
- `js/export-image.js` / `js/export-text.js` — PNG/SVG / JSON/Markdown/OPML + download helper.
- `js/ui.js` — toasts, popovers, color/emoji pickers, maps drawer rendering.
- `test/smoke.mjs` — Playwright smoke test (drives installed Chrome/Edge).
- `server/` — _(Phase 2+)_ VPS-only AI proxy + collab server; never deployed to Pages.

## Status
- **Phase 1 ✅ DONE & verified** (9/9 smoke checks, 0 console errors): RTL mapping, colors, emoji,
  2 themes, save/load + drawer, autosave, export PNG/SVG/JSON/MD/OPML, import, direction toggle.
- **Phase 2 ⏳** AI (prompt→map, expand, paste-text→map) via `server/` Gemini proxy — see plan.
- **Phase 3 ⏳** Presentation mode. **Phase 4 ⏳** Real-time co-editing. **Phase 5 ⏳** Stylus ink.
- Full roadmap: `C:\Users\omrii\.claude\plans\that-can-also-support-elegant-papert.md`.

## Verify / test
```bash
npm run serve     # http://localhost:5173
npm test          # Playwright smoke (needs Chrome/Edge installed)
```
Manual check that automation can't fully judge: type Hebrew into nodes (correct RTL), confirm
root-right / branches-left, switch themes, export each format.

## Deploy notes
- GitHub repo: omri-il/mind-mapper. GitHub Pages on `master` (root).
- To list publicly: add a `tool-card` in `tools-hub/index.html` (general category) once a public
  URL exists.
- Phase 2 server follows the **Bio-Podcast** pattern (Express + `.env` + systemd + Nginx);
  CORS allow-listed to the Pages origin; `GEMINI_API_KEY` in `server/.env` (gitignored).
