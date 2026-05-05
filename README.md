# Moss

[![CI](https://github.com/johnhumphrys/moss/actions/workflows/ci.yml/badge.svg)](https://github.com/johnhumphrys/moss/actions/workflows/ci.yml)
![Coverage](https://img.shields.io/badge/coverage-80%25%2B-brightgreen)

Moss is a desktop app for browsing your image folders as a visual library. Point it at a folder, and it turns everything inside into albums you can browse, star, and organise — without moving your files or locking them into any format.

It's for people who keep images in folders and want a nicer way to look at them.

## What it does

- Your folders become albums. Nested folders become sub-albums. Nothing moves.
- Browse albums as collage-style covers and open images in a focused full-screen viewer.
- Star images to surface them across your whole library.
- Drag images between albums, create new ones, rename them — all from inside the app.
- Everything stays as normal files on disk. Open them in anything else whenever you like.

Moss stores one small metadata file (`.moss`) at your library root for things like theme preference and starred images. That's the only thing it adds.

## Download

Grab the latest release from the [GitHub releases page](https://github.com/johnhumphrys/moss/releases).

Available for macOS (Apple Silicon + Intel) and Windows. After installing on macOS, if it's flagged as unverified, go to **System Settings → Privacy & Security** and click **Open Anyway**.

---

## How It Works

- The library root is a normal directory on your machine.
- Albums are normal folders inside that root.
- Sub-albums are nested folders.
- Images remain regular files accessible outside Moss.
- `.moss` stores Moss-specific metadata in the root folder.

Example `.moss`:

```json
{
  "version": 1,
  "theme": "dark",
  "viewerInfoOpen": false,
  "starredAssets": [
    "cycling/hero.jpg"
  ],
  "boards": {
    "cycling": {
      "title": "Cycling"
    }
  }
}
```

## Stack

- Electron
- React
- TypeScript
- Vite
- Vitest
- ESLint

## Quality Gates

Runs on every push and pull request via GitHub Actions:

- `npm run lint`
- `npm run test`
- `npm run test:coverage`
- `npm run build`

Coverage thresholds are enforced at 80%+ for utility modules across unit, integration, and UI layers.

## Development

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run lint
npm run test
npm run test:unit
npm run test:int
npm run test:ui
npm run test:coverage
npm run build
```
