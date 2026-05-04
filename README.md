# Moss

[![CI](https://github.com/johnhumphrys/moss/actions/workflows/ci.yml/badge.svg)](https://github.com/johnhumphrys/moss/actions/workflows/ci.yml)
![Coverage](https://img.shields.io/badge/coverage-80%25%2B-brightgreen)

Moss is a local-first Electron app for turning ordinary folders into a visual moodboard library. It is designed first as a browsing and curation experience: cinematic albums, fast image viewing, drag-and-drop organization, and a filesystem-native workflow where your content stays in normal directories.

## Overview

Moss treats a root folder as your visual library. Each folder becomes an album, nested folders become sub-albums, and a hidden `.moss` file stores app metadata like theme, starred assets, and album naming without taking ownership away from the filesystem.

The goal is to feel more like a personal visual workspace than an image editor:
- browse albums as collage-style covers
- open images in a focused viewer
- star images and surface them across albums
- drag images between albums
- create and rename albums from inside the app
- keep everything local and human-readable on disk

## How It Works

- The library root is a normal directory on your machine.
- Albums are normal folders inside that root.
- Sub-albums are nested folders.
- Images remain regular files that can still be accessed outside Moss.
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

The repo is set up to run the following on every push and pull request through GitHub Actions:

- `npm run lint`
- `npm run test`
- `npm run test:coverage`
- `npm run build`

Coverage thresholds are enforced in the repo, with an 80%+ minimum for the covered utility modules and supporting tests across unit, integration, and UI layers.

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
