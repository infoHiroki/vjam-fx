# VJam FX — VJ Effects for Any Website

Chrome extension that overlays music-reactive VJ visuals on any webpage.

## Features

- **61 visual presets** in 8 categories (Immersive, Frames & Film, Patterns, Organic, Grid & Tech, Space & Nature, Audio Reactive, Weather)
- **Multi-layer**: up to 3 presets running simultaneously with fade transitions
- **CSS filters**: Invert, Hue Rotate, Grayscale, Saturate, Brightness, Contrast, Sepia, Blur
- **4 blend modes**: Screen, Lighten, Difference, Exclusion (manual selection)
- **Auto-cycle**: BPM-connected automatic preset rotation (filters randomized, blend mode preserved)
- **Beat detection**: real-time microphone analysis (Web Audio API)
- **OSD feedback**: on-screen display for active presets and effects
- **Navigation persistence**: effects survive page navigations via Service Worker
- **Zero impact when OFF**: no background scripts, no content scripts

## Install (Development)

1. Clone this repo
2. `npm install`
3. Open `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select this folder
6. Click the VJam FX icon on any webpage

## Usage

1. Click the extension icon in the toolbar
2. Select presets from the categorized list (multi-select for layers)
3. Toggle ON — effects appear on the current page
4. Allow microphone access for beat-reactive visuals
5. **Reset** — full reset (all layers, filters, auto-cycle OFF)
6. **Next** — random 1-3 layers + random filters (one shot)
7. **Auto** — Next on repeat (BPM-connected interval)
8. Change blend mode manually via dropdown
9. Toggle CSS filters for additional effects

## Development

```bash
npm install
npm test            # Run all 597 tests
npm run test:watch  # Watch mode
```

## Architecture

```
vjam-fx/
├── manifest.json          # Manifest V3
├── background/
│   └── service-worker.js  # State persistence across page navigations
├── popup/                 # Extension popup UI
│   ├── popup.html         # Preset list, toggle, blend, filters, mic
│   ├── popup.css          # Dark theme UI
│   └── popup.js           # Controller (injects via chrome.scripting)
├── content/               # Injected into pages (MAIN world)
│   ├── content.js         # VJamFXEngine — overlay, multi-layer, filters, OSD, auto-cycle
│   ├── base-preset.js     # Base class for all presets
│   ├── audio-analyzer.js  # Microphone FFT, beat detection, BPM estimation
│   └── presets/           # 61 visual presets (IIFE pattern)
├── lib/p5.min.js          # p5.js graphics engine
├── icons/                 # Extension icons (16/48/128px)
└── test/                  # Vitest + jsdom tests (597 tests)
```

### Preset Categories

| Category | Count | Examples |
|----------|-------|---------|
| Immersive | 19 | Wormhole, Warp Speed, Helix Tunnel, Portal Ring, Aurora |
| Frames & Film | 8 | Neon Frame, Light Leak, Film Burn, VHS Noise, Scan Line |
| Patterns | 6 | Kaleidoscope, Mandala, Sacred Geometry, Moire |
| Organic | 8 | Cellular, Liquid, Voronoi, Coral Reef, Flow Field |
| Grid & Tech | 6 | Glitch Grid, Hexgrid Pulse, Circuit Board, CRT Monitor |
| Space & Nature | 6 | Starfield, Constellation, Bokeh, Terrain |
| Audio Reactive | 5 | Frequency Rings, Equalizer, Sine Waves |
| Weather | 3 | Rain, Neon Rain, Cyber Rain |

### Action Buttons

| Button | Behavior |
|--------|----------|
| **Reset** | Full reset: all layers removed, filters cleared, blend → screen, auto-cycle OFF, toggle OFF |
| **Next** | Random 1-3 layers + random filters (one shot). Blend mode unchanged. |
| **Auto** | Next on repeat. BPM-connected interval (16 beats, clamped 4-15s). Blend mode unchanged. |

## Permissions

- **activeTab** — access to current tab only when user clicks the icon
- **scripting** — inject p5.js and engine into the page

## Tech Stack

- Vanilla JavaScript (IIFE pattern, no bundler)
- p5.js for 2D canvas graphics
- Web Audio API for microphone and frequency analysis
- Chrome Extension Manifest V3
- Vitest + jsdom for testing

## License

ISC

---

**[Get VJam Full](https://vjam.vercel.app)** — Full VJ system with 190+ presets, video/image layers, and more.
