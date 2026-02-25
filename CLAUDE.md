# VJam FX — Chrome Extension — Claude Code Settings

## Overview
VJamの無料Chrome拡張。任意のWebページにVJエフェクトを重ねる。VJam本体への導線。

## Development Rules
- **MVP / KISS / YAGNI**
- **Commit**: 日本語、絵文字+簡潔1行、Co-Authored-By: Claude

## Tech Stack
- Vanilla JavaScript (ESM modules, no bundler)
- p5.js (2D graphics)
- Chrome Extension Manifest V3
- Vitest + jsdom (testing)

## Architecture
- **Popup**: `popup/` — UI controller, injects via `chrome.scripting.executeScript`
- **Content (MAIN world)**: `content/` — VJamFXEngine, presets, audio-analyzer
- **Communication**: Popup → MAIN world via `executeScript({ world: 'MAIN', func })`
- **No background scripts**
- **On-demand injection only**

## Key Constraints
- Content scripts run in MAIN world (need access to p5 global)
- Presets loaded via ESM dynamic `import()` from `web_accessible_resources`
- `import.meta.url` used for base URL resolution
- p5.js injected first as classic script, then engine as ESM module

## Testing
```bash
npm test          # vitest run (133 tests)
npm run test:watch
```

## Manual Testing
1. `chrome://extensions/` → Developer mode → Load unpacked → select this folder
2. Open any website (not chrome://)
3. Click VJam FX icon → Select preset → Toggle ON
4. Allow microphone for beat detection
