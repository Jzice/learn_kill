# AGENTS

This file provides guidance to agents when working with code in this repository.

## Repository Overview

学堂杀 (Xuetangsha) is a browser-based, Sanguosha-like identity card game themed on school subjects. It was refactored from a single-file HTML game into a modular TypeScript project that builds back to a **single self-contained HTML file**.

Stack: TypeScript (strict) + Vite + `vite-plugin-singlefile` + esbuild. No runtime framework; the UI is string-templated `innerHTML` re-rendered from a single state object, exactly as in the original.

## Commands

```bash
npm install          # first time only
npm run dev          # dev server with HMR (PeerJS CDN mode)
npm run dev:bundled  # dev server with bundled PeerJS
npm run build        # build BOTH modes into dist/
npm run build:cdn        # dist/学堂杀.html          (PeerJS via CDN <script>)
npm run build:bundled    # dist/学堂杀.bundled.html  (peerjs npm pkg inlined, offline-ready)
npm run typecheck     # tsc --noEmit (must pass with zero errors)
npm run clean         # remove dist/
```

Smoke tests (headless Chromium via playwright-core, auto-starts a static server):

```bash
node scripts/smoke.mjs "学堂杀.html"          # single-player flow + console error check (19 checks)
node scripts/smoke-net.mjs "学堂杀.html"      # two-tab multiplayer: create/join/sync/personalization (14 checks)
node scripts/repro-net.mjs "学堂杀.html"      # multiplayer battle stress regression (deadlock detection, exit code = result)
node scripts/verify-lazy.mjs                  # verify per-grade question-bank lazy loading (dev mode)
```

Detailed docs live in `docs/`: [docs/架构设计.md](docs/架构设计.md) (architecture) and
[docs/游戏机制.md](docs/游戏机制.md) (game mechanics). Read them before larger changes.

## Build Architecture (read before changing build config)

- `vite.config.ts` reads `VITE_PEERJS_MODE` (`cdn` | `bundled`, set by `scripts/build.mjs` / `scripts/dev.mjs`, no cross-env needed). It controls three things via small local plugins: (1) alias `#peer` to either `src/net/peer.cdn.ts` (reads global `window.Peer` from a CDN script tag injected into `index.html`) or `src/net/peer.bundled.ts` (`import Peer from 'peerjs'`); (2) `transformIndexHtml` injects the PeerJS CDN script tag in cdn mode only; (3) `closeBundle` renames `dist/index.html` to the mode-specific filename. `emptyOutDir:false` lets both artifacts coexist.
- `vite.config.ts` sets `root: src/`, so `index.html` references `/main.ts` (not `/src/main.ts`).
- `src/types/peerjs.d.ts` is a hand-written minimal declaration covering both the global `window.Peer` and `module 'peerjs'`. If you use more PeerJS APIs, extend it there (no @types/peerjs dependency).
- Question bank data is generated: `src/data/banks/g01..g12.ts` + `src/data/banks/manifest.ts` are produced by `scripts/build-banks.mjs` from `data/questions/<grade>/<subject>.tsv` — the single source of truth (the original single-file game's built-in bank was migrated into these TSVs in v1.7.4). Regenerate with `npm run build:banks` after editing TSVs; never hand-edit generated data.
- **Question bank is lazy-loaded per grade**: `src/data/bankLoader.ts` dynamically `import()`s a grade module only when needed (game start / quiz fallback). The lobby renders grade counts from `GRADE_BANK_META` (manifest) without loading any questions. External imports (URL/file) merge into the runtime `QUESTION_BANK` and may create grades not in the manifest. In the single-file build dynamic chunks are inlined (same payload) but module factories still execute lazily; in dev mode loading is truly network-lazy.

## Source Layout (`src/`)

- `main.ts` — the ONLY place with init side effects: mounts ~31 window globals for inline `onclick` handlers, then runs the init sequence (picker bindings, profile/lobby renders, external bank URL loading). No game logic here.
- `core/` — `types.ts` (all domain types incl. the `NetMessage` union), `dom.ts` (escapeHtml/sleep/inputValue/togglePanel), `sound.ts` (WebAudio oscillator SFX), `fx.ts` (DOM animation layer).
- `data/` — pure data + derivation: `factions.ts`, `grades.ts`, `characters.ts` (roles/ROLE_CONFIG/charPoolForGrade), `cards.ts` (deck construction), `banks/` (generated per-grade question modules + manifest), `bankLoader.ts` (lazy loader, runtime QUESTION_BANK store), `questionBank.ts` (external import/merge/URL loading).
- `profile/` — localStorage profile (`xuetangsha_profile_v1`): score/levels/achievements **plus personalization fields** (name/avatar/gender/mood/moodIcon, `AVATAR_OPTIONS`/`MOOD_ICON_OPTIONS`/`GENDER_OPTIONS`, `localIdentity()`/`identityFromProfile()`), settlement.
- `game/` — engine: `state.ts` (the `G` object + `quizStats`), `rules.ts` (distance/hand-limit/skill primitives), `quiz.ts` (quiz modal + learning rewards), `damage.ts`, `actions.ts` (card resolution), `skills.ts` (the big `switch(skillId)`), `turn.ts` (runTurn phases), `ai.ts`, `loop.ts`, `choice.ts` (Promise bridge for local/remote choices), `marks.ts`, `log.ts`, `chat.ts`, `setup.ts` (player assembly + startSingle/hostStartGame/exitGame).
- `net/` — `network.ts` (NET object, host-authoritative sync, onPeerData/onClientData), `protocol.ts` (typed message union — extend this first when adding networked features), `rooms.ts` (create/join/leave/close), `peer.cdn.ts` / `peer.bundled.ts`.
- `ui/` — `render.ts` (single top-level `render()`), `hand.ts`, `lobby.ts` (pickers, SELECTED_* state, room member lists, bank management UI), `modals.ts` (rules), `dock.ts` (mobile), `playzone.ts`.

## Critical Invariants (1:1 parity with the original)

1. **`G` (game/state.ts) field names/shape must not change** — `state_sync` serializes it directly and clients unpack it structurally.
2. **Inline handlers**: generated HTML (seats, action buttons, mark menu) calls `openMarkMenu(i)`, `handleLocalChoice(v)`, `clickTargetSeat(i)`, etc. Any new function referenced from a template string must be mounted on `window` in `main.ts` and declared in `globals.d.ts`.
3. **Module cycles are intentional** (ui ↔ game ↔ net). They are safe ONLY because no module has top-level side effects except `main.ts`; all cross-module calls happen inside function bodies. Never add top-level code that touches another module's bindings.
4. **Mutable shared state ownership**: `playLog` (log.ts), `chatMessages` (chat.ts), `ROLE_MARKS` (marks.ts), `SELECTED_*` (ui/lobby.ts), unread counters (ui/dock.ts) are `let`/objects owned by one module; other modules read via live bindings or call exported mutators (`resetPlayLog`, `bumpUnreadLog`, `clearRoleMarks`, ...). Do not assign to imported bindings.
5. **Magic numbers are load-bearing**: 80ms sync debounce, 20s remote-quiz timeout, 1.5s quiz feedback delay, 100/60 log caps, deck composition (30 sha / 15 shan / 8 tao / 5 jiu / tricks / equips), `xts-` peer ID prefix, 6-digit room codes, AI probabilities (0.6/0.62/0.55), reward roll thresholds (0.30/0.55/0.72/0.88).
6. `dist/学堂杀.html` must remain a drop-in single-file game — verify with `node scripts/verify-dist.mjs` (checks single-file inlining + CDN tag presence per mode) and the smoke scripts above after any change.
