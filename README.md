# VJam FX — VJ Effects for Any Website

Chrome extension that overlays music-reactive VJ visuals on any webpage.

## Features

- 10 visual presets (Neon Tunnel, Kaleidoscope, Mandala, Starfield, Rain, etc.)
- Real-time beat detection via microphone (Web Audio API)
- 4 blend modes: Screen, Lighten, Difference, Exclusion
- Zero performance impact when OFF (no background scripts)
- Works on any website

## Install (Development)

1. Clone this repo
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" → select this folder
5. Click the VJam FX icon on any webpage

## Usage

1. Click the extension icon in the toolbar
2. Select a preset
3. Toggle ON
4. Allow microphone access for beat-reactive visuals
5. Change blend mode to adjust how effects interact with the page

## Development

```bash
npm install
npm test          # Run tests (vitest)
npm run test:watch  # Watch mode
```

## Architecture

- **Manifest V3** — no persistent background scripts
- **On-demand injection** — content script only injected when user activates
- **ESM modules** — presets loaded via dynamic `import()`
- **p5.js** — graphics engine (bundled)
- **Web Audio API** — microphone input, FFT analysis, beat detection

## Tech Stack

- Vanilla JavaScript (no build step)
- p5.js for 2D graphics
- Web Audio API for audio analysis
- Vitest + jsdom for testing

## License

ISC

---

**[Get VJam Full](https://vjam.vercel.app)** — Full VJ system with 190+ presets, video/image layers, and more.
