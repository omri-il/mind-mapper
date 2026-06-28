# 🧠 Mind-Mapper — מפת חשיבה

A **Hebrew-first** web mind mapping tool — intuitive, colorful, and built to brainstorm *and*
present ideas. RTL is a first-class citizen (something every major tool gets wrong).

**Live:** _(coming soon — GitHub Pages)_

## Why
Every major mind mapping tool (XMind, MindMeister, Miro, FigJam…) handles Hebrew/RTL badly or not
at all. Mind-Mapper puts the root on the right and grows branches leftward, the natural Hebrew
reading flow, with proper Hebrew text everywhere.

## Features (Phase 1 — shipping)
- ✍️ Create / edit / drag-reparent nodes; keyboard (Tab = child, Enter = sibling) or toolbar
- 🎨 Branch colors, emoji icons, and **two switchable themes** (clean-modern & organic-playful)
- 💾 Auto-save to your browser + a "My maps" drawer (new / open / rename / duplicate / delete)
- ⬇️ Export to **PNG, SVG, JSON, Markdown, OPML**; import JSON maps
- 🔄 Layout toggle: root-right (default) / root-left / both-sides
- 📴 Works fully offline — no account, no server

## Roadmap
- **Phase 2** — AI: prompt → map, expand-a-branch, paste-text → map (via a small Gemini proxy)
- **Phase 3** — Presentation mode (zoom-to-branch + reveal one idea at a time)
- **Phase 4** — Real-time co-editing (Yjs)
- **Phase 5** — Freehand stylus / Windows-Ink drawing

## Tech
Buildless static app: vanilla JS ES modules + [mind-elixir](https://mind-elixir.com) (v5, via
jsDelivr CDN). No build step. State in LocalStorage.

## Run locally
```bash
npm run serve     # serves on http://localhost:5173 (Python http.server)
npm test          # Playwright smoke test (uses installed Chrome/Edge)
```

## Deploy
Push to `master` → GitHub Pages serves the repo root. Bump the `?v=N` query on `style.css` /
`app.js` in `index.html` after changing them, to bust the browser cache.
