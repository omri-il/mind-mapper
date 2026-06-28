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

## Layout & interaction (UX overhaul)
- **Shell is flex** (`body` flex-column `100dvh` → `.toolbar` + `.workspace` row → `#map` + `.sidebar`).
  This gives `#map` a definite height so mind-elixir's `.map-container{height:100%}` fills the
  viewport (fixes the old "dead bottom half" — `position:fixed top/bottom` left height `auto`).
- **Grab-to-pan**: `mouseSelectionButton:2` frees the left button; `mindmap.js _initInteractions()`
  pans via `mind.move(dx,dy)` on left-drag of empty background, wheel = pan / ctrl+wheel(pinch) =
  zoom-to-cursor, and a `ResizeObserver` on `#map` re-centers (`toCenter`) after resize/sidebar
  toggle. One-off camera moves add a `.animate` class on `.map-canvas` for a smooth transition.
- **Unified sidebar** (`js/sidebar.js`): rail (🗂️ Maps / 🎨 Format / ✨ AI / 📋 Outline) + panel,
  collapsible (toolbar `#btnSidebar` toggles `body.side-collapsed`). Replaced the old pop-out drawer,
  toolbar pop-ups, and center AI modal.

## File map
- `index.html` — RTL flex shell, Hebrew fonts, lean toolbar, `#map`, `.sidebar` (4 panes).
- `js/app.js` — orchestrator: boot, toolbar + sidebar wiring, export/import.
- `js/sidebar.js` — sidebar tab switching + collapse. `js/outline.js` — tree → RTL outline + focus.
- `js/mindmap.js` — mind-elixir wrapper (the ONLY place that touches its API); pan/zoom/resize,
  `focusNodeById`, `setFontDelta`, `appendChildren`, `findTrail`.
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
- **Phase 2 ✅ DONE & verified live**: AI map from a prompt, from pasted text (grounded), and
  expand-a-branch. Front-end `js/ai.js` + AI modal; backend `server/` Express Gemini proxy
  (`gemini-3.5-flash`, flat-list `responseSchema`, CORS allow-list, rate limit, `/api/health`).
  Verified end-to-end in the browser against real Gemini (generate + expand).
- **Phase 3 ✅ DONE & verified**: full-screen presentation mode (`js/presentation.js`) — DFS step
  walk, smooth zoom-to-each-idea (`mm.presentFocus`), current-node highlight, caption + counter,
  arrow/space/Esc keys, editing locked, fullscreen. (Progressive collapse/reveal was dropped — it
  tripped mind-elixir's `refresh()`; we use a zoom tour over the fully-expanded map instead.)
- **Phase 4 ⏳** Real-time co-editing. **Phase 5 ⏳** Stylus ink.
- Full roadmap: `C:\Users\omrii\.claude\plans\that-can-also-support-elegant-papert.md`.
- **RTL canvas note:** the map subtree is forced `direction: ltr` (mind-elixir's pan/centre math
  needs LTR or the map drifts off-screen on wide screens); node TEXT is `direction: rtl`, and
  mind-elixir **LEFT** = root-on-right. `meta.direction` stores the mind-elixir constant (schema v2
  migrates v1 maps by flipping LEFT/RIGHT).

## Live URLs & hosting
- **Primary app: https://mindmap.omri-iram.co.il** — served from the **VPS** (nginx static root
  `/var/www/mindmap`, with `location /api/` → the node proxy on `127.0.0.1:5055`). Same-origin API
  (no CORS for the primary app). This mirrors Bio-Podcast/micropod.
- **Mirror: https://omri-il.github.io/mind-mapper/** — GitHub Pages (master root). Its AI calls
  the VPS cross-origin (CORS allow-lists the github.io origin).
- **AI proxy:** systemd `mindmapper-ai.service` on the VPS (`/root/Projects/mind-mapper/server`),
  key in `server/.env` (gitignored). Health: `https://mindmap.omri-iram.co.il/api/health`.
- `js/config.js` picks the API base by hostname: mindmap domain → same-origin `''`; localhost →
  `http://localhost:5055`; else → `https://mindmap.omri-iram.co.il`.

## Deploy
- **Front-end change → both targets:** `git push` (updates the github.io mirror), then on the VPS
  `cd /root/Projects/mind-mapper && git pull && rsync -a --delete index.html css js /var/www/mindmap/`
  (only static files — never `server/`, `.git`, `.env`). Bump `?v=N` on `style.css`/`app.js` in
  `index.html` when they change.
- **Server change:** VPS `git pull` then `systemctl restart mindmapper-ai`.
- DNS: `mindmap.omri-iram.co.il` A → `147.79.114.195` (Hostinger). TLS via Let's Encrypt (certbot).

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
