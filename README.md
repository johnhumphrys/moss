# Moss

Moss is a local-first desktop moodboard for browsing image folders as a visual library. It is designed as a viewing experience, not an editing tool.

## Current MVP

- choose a local folder as a vault
- discover nested folders as boards automatically
- browse boards from a cinematic sidebar
- view a masonry-style image grid
- open images in a focused viewer
- inspect file details from an info panel
- switch between dark and light mode
- persist theme choice to a hidden `.moss` file in the vault root

## Vault Metadata

Moss reads and writes a `.moss` JSON file in the vault root.

Example:

```json
{
  "version": 1,
  "title": "My Vault",
  "theme": "dark",
  "boards": {
    "friday-gallery": {
      "title": "Friday Gallery",
      "cover": "Friday Gallery/cover.jpg"
    }
  }
}
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
