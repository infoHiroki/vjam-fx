# VJam FX — VJ Effects for Any Website

Chrome extension that overlays music-reactive VJ visuals on any webpage.

## Features

- 10 visual presets (Neon Tunnel, Kaleidoscope, Mandala, Starfield, Rain, etc.)
- Real-time beat detection via microphone (Web Audio API)
- 4 blend modes: Screen, Lighten, Difference, Exclusion
- Zero performance impact when OFF (no background scripts, no content scripts)
- Works on any website

## Install (Development)

1. Clone this repo
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select this folder
5. Click the VJam FX icon on any webpage

## Usage

1. Click the extension icon in the toolbar
2. Select a preset from the list
3. Toggle ON — effects appear on the current page
4. Allow microphone access for beat-reactive visuals
5. Change blend mode to adjust how effects interact with the page
6. Toggle OFF — overlay is removed, page returns to normal

## How It Works

1. **No background scripts** — extension only activates when you click the icon
2. **On-demand injection** — p5.js and the effect engine are injected into the page's MAIN world only when you toggle ON
3. **Overlay canvas** — a `position:fixed` canvas sits on top of the page with `mix-blend-mode: screen` (black becomes transparent, effects glow through)
4. **Audio analysis** — microphone input is analyzed for bass/mid/treble frequencies and beat detection
5. **Preset system** — each preset is an ESM module loaded via dynamic `import()`, so only the active preset is loaded

## Development

```bash
npm install
npm test            # Run all 133 tests
npm run test:watch  # Watch mode
```

## Architecture

```
vjam-fx/
├── manifest.json          # Manifest V3 (activeTab + scripting)
├── popup/                 # Extension popup UI
│   ├── popup.html         # Preset list, toggle, blend mode, mic
│   ├── popup.css          # Dark theme UI
│   └── popup.js           # Controller (injects via chrome.scripting)
├── content/               # Injected into pages (MAIN world)
│   ├── content.js         # VJamFXEngine — overlay, preset lifecycle, audio loop
│   ├── base-preset.js     # Base class for all presets
│   ├── audio-analyzer.js  # Microphone FFT, beat detection, BPM estimation
│   └── presets/            # 10 visual presets (ESM modules)
├── lib/p5.min.js          # p5.js graphics engine (1MB)
├── icons/                 # Extension icons (16/48/128px)
└── test/                  # Vitest + jsdom tests (133 tests)
```

### Injection Flow

```
Popup (toggle ON)
  → chrome.scripting.executeScript (MAIN world)
    → Step 1: Load p5.min.js (classic script, sets window.p5)
    → Step 2: import('content/content.js') (ESM module)
      → Creates VJamFXEngine singleton (window._vjamFxEngine)
    → Step 3: _sendCommand({ action: 'start', preset: '...' })
      → Engine creates overlay div
      → import('presets/neon-tunnel.js') (ESM, loads on demand)
      → import('audio-analyzer.js') → getUserMedia → FFT + beat detection
      → requestAnimationFrame loop: audioData → preset.updateAudio() / onBeat()
```

### Communication (Popup → Engine)

All commands use `chrome.scripting.executeScript({ world: 'MAIN', func })` to call `window._vjamFxEngine.handleMessage()` directly. No content script relay needed.

## Permissions

- **activeTab** — access to current tab only when user clicks the icon
- **scripting** — inject p5.js and engine into the page

No `host_permissions` needed. Resources are listed in `web_accessible_resources` for ESM `import()`.

## Tech Stack

- Vanilla JavaScript (no build step, no bundler)
- p5.js for 2D canvas graphics
- Web Audio API for microphone and frequency analysis
- Chrome Extension Manifest V3
- Vitest + jsdom for testing

## License

ISC

---

**[Get VJam Full](https://vjam.vercel.app)** — Full VJ system with 190+ presets, video/image layers, and more.
