# VJam FX — Chrome Extension — Claude Code Settings

## Overview
VJamの無料Chrome拡張。任意のWebページにVJエフェクトを重ねる。VJam本体への導線。

## Development Rules
- **MVP / KISS / YAGNI**
- **Commit**: 日本語、絵文字+簡潔1行、Co-Authored-By: Claude

## Tech Stack
- Vanilla JavaScript (IIFE pattern, no bundler)
- p5.js (2D graphics)
- Chrome Extension Manifest V3
- Service Worker (状態永続化)
- Vitest + jsdom (testing, 627 tests)

## Architecture
- **Popup**: `popup/` — UI controller, injects via `chrome.scripting.executeScript`
- **Content (MAIN world)**: `content/` — VJamFXEngine, 60 presets (8カテゴリ), audio-analyzer
- **Service Worker**: `background/service-worker.js` — ページ遷移で状態復帰
- **Communication**: Popup → MAIN world via `executeScript({ world: 'MAIN', func })`
- **On-demand injection only**

## Key Constraints
- Content scripts run in MAIN world (need access to p5 global)
- Presets use IIFE pattern (CSP互換) — `window.VJamFX.presets[name]` に登録
- p5.js injected first as classic script, then engine
- ブレンド: 排他トグル3つ（Lighten/Diff/Exclusion）＋デフォルトscreen、Auto対応
- フィルタ: 重ね掛けトグル8つ、Auto対応
- ライトページ自動検出 → blendをdifferenceに自動切替（screenのままの場合のみ）

## UI: 3ボタン + Auto個別トグル
- **Reset**: 全リセット（レイヤー・フィルタ・ブレンド・Auto・トグル全OFF）
- **Next**: ランダム1-3プリセット（FX維持）
- **Auto**: プリセットローテーション（BPM連動、16ビート、4-15秒クランプ）
  - **Blend Auto**: Auto中にブレンドモードもランダム変更
  - **Filter Auto**: Auto中にフィルターもランダム変更
  - Blend Auto / Filter AutoはプリセットAutoがON時のみ有効

## Testing
```bash
npm test          # vitest run (627 tests)
npm run test:watch
```

## Manual Testing
1. `chrome://extensions/` → Developer mode → Load unpacked → select this folder
2. Open any website (not chrome://)
3. Click VJam FX icon → Select preset → Toggle ON
4. Allow microphone for beat detection
