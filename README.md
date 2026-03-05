# VJam FX — VJ Effects for Any Website

Chrome extension that overlays music-reactive VJ visuals on any webpage.

## Features

- **191 visual presets** in 13 categories
- **Multi-layer**: up to 3 presets running simultaneously with fade transitions
- **CSS filters**: Invert, Hue Rotate, Grayscale, Saturate, Brightness, Contrast, Sepia, Blur
- **4 blend modes**: Screen, Lighten, Difference, Exclusion (toggle selection)
- **Light page detection**: auto-switches blend to Difference on light-themed pages
- **Auto-cycle**: BPM-connected automatic preset rotation (16 beats, 4-15s clamp)
- **Blend Rnd**: randomize blend modes independently (works with or without Auto)
- **Filter Rnd**: randomize filters independently (works with or without Auto)
- **Beat detection**: video/audio element analysis + tab audio capture — no microphone needed (Web Audio API)
- **Text Effects**: random text effects with auto font/position/color
- **Scenes**: save/load preset+filter+blend configurations to 12 slots
- **Lock**: lock current preset selection to prevent changes
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
4. Audio-reactive visuals auto-start when a `<video>` or `<audio>` element is playing (no microphone needed)
5. **Reset** — full reset (all layers, filters, blend, auto, toggle OFF)
6. **Next** — random 1-3 presets (FX unchanged)
7. **Auto** — preset rotation on repeat (BPM-connected interval, FX unchanged)
8. **Blend Rnd** / **Filter Rnd** — randomize blend/filters independently
9. **Save** — save current configuration to a scene slot
10. **Text** — toggle random text effects
11. **Lock** — lock current preset selection
12. Change blend mode and CSS filters manually
13. Light pages auto-switch to Difference blend

## Development

```bash
npm install
npm test            # Run all 1722 tests
npm run test:watch  # Watch mode
```

## Architecture

```
vjam-fx/
├── manifest.json          # Manifest V3
├── background/
│   └── service-worker.js  # State persistence across page navigations
├── popup/                 # Extension popup UI
│   ├── popup.html         # Preset list, toggle, blend, filters, scenes, text
│   ├── popup.css          # Dark theme UI
│   └── popup.js           # Controller (injects via chrome.scripting)
├── content/               # Injected into pages (MAIN world)
│   ├── content.js         # VJamFXEngine — overlay, multi-layer, filters, auto-cycle
│   ├── base-preset.js     # Base class for all presets
│   ├── audio-bridge.js    # ISOLATED world — SW→MAIN audioData relay
│   ├── text-overlay.js    # Text effects overlay
│   └── presets/           # 191 visual presets (IIFE pattern)
├── offscreen/             # Offscreen document for tabCapture audio
├── lib/p5.min.js          # p5.js graphics engine
├── icons/                 # Extension icons (16/48/128px)
└── test/                  # Vitest + jsdom tests (1722 tests)
```

### Preset Categories

| Category | Count | Examples |
|----------|-------|---------|
| Immersive | 25 | Wormhole, Warp Speed, Helix Tunnel, Portal Ring, Aurora |
| Frames & Film | 13 | Neon Frame, Light Leak, Film Burn, VHS Noise, Scan Line |
| Patterns | 16 | Kaleidoscope, Mandala, Sacred Geometry, Moire |
| Organic | 17 | Cellular, Liquid, Voronoi, Coral Reef, Flow Field |
| Nature | 17 | Aurora Borealis, Ocean Waves, Fire, Lightning |
| Water | 10 | Waterfall, Ripple, Rain Puddle, Deep Sea |
| Grid & Tech | 20 | Glitch Grid, Hexgrid Pulse, Circuit Board, CRT Monitor |
| Space | 11 | Starfield, Constellation, Nebula, Black Hole |
| Neon & Glow | 15 | Neon Pulse, Laser Grid, Glow Worm, Light Trail |
| Glitch & Retro | 19 | Data Corruption, Pixel Sort, VHS Tracking, CRT Warp |
| Audio Reactive | 16 | Frequency Rings, Equalizer, Sine Waves, Waveform |
| Particles | 8 | Particle Storm, Fireflies, Confetti, Sparks |
| Weather | 4 | Rain, Neon Rain, Cyber Rain, Snow |

### Action Buttons

| Button | Behavior |
|--------|----------|
| **Reset** | Full reset: all layers removed, filters cleared, blend → screen, auto-cycle OFF, toggle OFF |
| **Next** | Random 1-3 presets (FX unchanged). User's filters/blend preserved. |
| **Auto** | Preset rotation on repeat. BPM-connected interval (16 beats, clamped 4-15s). FX unchanged. |
| **Blend Rnd** | Randomize blend modes independently (works with or without Auto) |
| **Filter Rnd** | Randomize filters independently (works with or without Auto) |
| **Save** | Save current configuration to a scene slot. Click slot to load, right-click to clear. |
| **Text** | Toggle random text effects with auto font/position/color |
| **Lock** | Lock current preset selection to prevent changes |

## Permissions

- **activeTab** — access to current tab only when user clicks the icon
- **scripting** — inject p5.js and engine into the page
- **webNavigation** — maintain visual effects across page navigations
- **tabCapture** — capture tab audio for beat detection (fallback when video element audio is unavailable)
- **offscreen** — create offscreen document for tab audio processing
- **storage** — save scene configurations and extension state

## Tech Stack

- Vanilla JavaScript (IIFE pattern, no bundler)
- p5.js for 2D canvas graphics
- Web Audio API for video/tab audio frequency analysis
- Chrome Extension Manifest V3
- Vitest + jsdom for testing

## License

ISC

---

**[Get VJam Full](https://vjam.vercel.app)** — Full VJ system with 270+ presets, HDMI output, mic input, GLSL shaders, and more.
