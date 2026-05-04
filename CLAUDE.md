# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start both renderer (Vite on :4173) and Electron main process
npm run build        # Build renderer then compile Electron TypeScript
npm run lint         # ESLint
npm run test         # Run all tests
npm run test:unit    # Unit tests only (src/lib/ utilities)
npm run test:int     # Integration test (src/App.int.test.tsx)
npm run test:ui      # UI test (src/App.ui.test.tsx)
npm run test:coverage # Run with coverage (80% threshold enforced on src/lib/)
```

Run a single test file:
```bash
npx vitest run src/lib/board-utils.unit.test.ts
```

## Architecture

Moss is an Electron + React + TypeScript desktop app. The two processes communicate via a `contextBridge` API exposed as `window.moss`.

**Electron main process** (`electron/main.ts`) — all filesystem work lives here:
- Scans a vault (root folder) into a `VaultData` object on every mutating operation
- Persists metadata to a `.moss` JSON file at the vault root (theme, starred assets, board titles)
- Manages a thumbnail cache in Electron's `userData` directory (keyed by `sha1(relativePath:modifiedAt:size)`)
- Exposes IPC handlers: `vault:*`, `theme:*`, `asset:*`, `assets:*`, `board:*`

**Preload** (`electron/preload.cts`) — compiled as CommonJS, exposes `window.moss` as the typed bridge between renderer and main.

**Renderer** (`src/App.tsx`) — a single large React component with no routing:
- Checks `typeof window.moss` to detect whether it's running inside Electron or a plain browser (tests use the latter)
- All state lives in `App`; `src/lib/` holds pure utility functions extracted for testability
- Images are lazy-loaded via `IntersectionObserver` with a 400px root margin; `visibleAssetIds` drives which previews to request

**`src/lib/` utilities** (covered by unit tests at 80%+):
- `board-utils.ts` — board ID helpers (`isTopLevelBoard`, `getParentBoardId`, `buildBoardCountParts`)
- `asset-utils.ts` — cover asset selection, drag path extraction, visible-asset seeding, selection toggle
- `album-dialog.ts` — builds create/rename dialog state; normalizes album name input
- `formatters.ts` — `formatBytes`, `formatDate`

## Key Data Model

- **Board ID** = POSIX-style relative path from vault root (e.g. `cycling/heroes`). Top-level boards have no `/`.
- **`synthetic: true`** boards (e.g. `__starred__`) are virtual — they must not be used as move/rename targets.
- **`.moss`** file stores the only app-owned metadata; all images remain ordinary files.
- The Electron build has two `tsconfig` files: `tsconfig.json` (renderer, targets DOM) and `tsconfig.electron.json` (main + preload, targets Node).
