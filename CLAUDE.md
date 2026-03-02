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
- Vitest + jsdom (testing, 1689 tests)

## Architecture
- **Popup**: `popup/` — UI controller, injects via `chrome.scripting.executeScript`
- **Content (MAIN world)**: `content/` — VJamFXEngine, 194 presets (14カテゴリ), video audio capture
- **Audio Bridge**: `content/audio-bridge.js` — ISOLATED world, SW→MAIN audioData relay
- **Service Worker**: `background/service-worker.js` — ページ遷移で状態復帰
- **Communication**: Popup → MAIN world via `executeScript({ world: 'MAIN', func })`
- **On-demand injection only**

## Audio（両方起動方式）
- Popup が `startVideoAudio`(content) + `startTabAudio`(SW) を**同時発火**
- **createMediaElementSource**: `<video>`/`<audio>`要素から直接音声取得（録音インジケータなし）
- **tabCapture fallback**: offscreen document経由、全タブ音声取得（録音インジケータあり）
- CORS/MSE無音検出: createMediaElementSource成功後2秒間analyserをチェック
  - 非無音 → tabCapture停止（インジケータ消える、フルスクリーン対応）
  - 無音 → analyser切断、tabCapture継続（`_externalAudioData`経由で音反応）
- `_stopVideoAudio()`: analyserのみ切断（source→destination維持、音声再生継続）
- `_destroyVideoAudio()`: AudioContext完全破棄（destroy時のみ）
- tabCapture停止/開始はpopup/SWが直接制御（contentからは`stopTabCapture`のみ成功時にbridge経由で送信）
- silence-checkタイマーは`_silenceCheckTimer`に参照保持（再呼び出し時にクリア）
- `createMediaElementSource` は1要素1回制限 → try-catch + 既存ctx再利用

## Key Constraints
- Content scripts run in MAIN world (need access to p5 global)
- Presets use IIFE pattern (CSP互換) — `window.VJamFX.presets[name]` に登録
- p5.js injected first as classic script, then engine
- ブレンド: 排他トグル3つ（Lighten/Diff/Exclusion）＋デフォルトscreen、Auto対応
- フィルタ: 重ね掛けトグル8つ、Auto対応
- ライトページ自動検出 → blendをdifferenceに自動切替（screenのままの場合のみ）
- Popup非同期操作: `_busy`フラグで`_startAll`/`_stopAll`の排他制御
- createGraphicsプリセット: `windowResized`時に古いバッファを`.remove()`してからnew
- audio-bridge: `event.source === window`でpostMessage origin検証

## UI: 3ボタン + Auto個別トグル
- **Reset**: 全リセット（レイヤー・フィルタ・ブレンド・Auto・トグル全OFF）
- **Next**: ランダム1-3プリセット（選択分のみinject、FX維持）
- **Auto**: プリセットローテーション（BPM連動、16ビート、4-15秒クランプ）
  - **Blend Rnd**: ブレンドモードをランダム変更（Auto ON/OFF問わず独立動作）
  - **Filter Rnd**: フィルターをランダム変更（Auto ON/OFF問わず独立動作）
  - Auto ONでBlend Rnd / Filter Rndも自動ON、Auto OFFでも独立動作を継続
- **Lock**: テキスト表示（`Lock`/`Locked`）、locked時オレンジ

## Auto/Rnd 状態管理ルール
- **Auto/Rndの真実はpopupのフラグのみ** — シーン・SW状態には保存しない
- **シーン保存**: レイヤー・ブレンド・フィルター・オパシティ・ロックのみ（Auto/Rnd除外）
- **シーンロード**: 現在のAuto/Rnd状態を維持、Rnd ONならシーン内でblend/filterだけランダム
- **kill後の復帰**: Next・シーンロード・Toggle再開時、engine側タイマーが止まるのでAuto/Rndコマンドを再送
- engine `kill()` は `_stopAutoCycle()` + `_stopAutoFX()` を両方呼ぶ

## Preset Injection
- `_injectPreset(id)`: 個別inject（1ファイル1 executeScript）
- `_injectAllPresets()`: 20並列×バッチでPromise.all、失敗は個別catch（Auto用）
- SW re-inject: 同じ20並列バッチ方式（ページ遷移復帰時）


## Scenes（Save Modeパターン）
- `Save`ボタン → スロット選択で保存（自動でSaveモード解除）
- 通常クリック → 保存済みスロット読込
- 右クリック(contextmenu) → スロットクリア
- 空スロット: `border-style: dashed`、保存済み: `solid` + 緑枠
- Saveモード中: オレンジ枠 + パルスアニメーション

## Text（ON/OFFパターン）
- **ON**: テキスト入力値でautoText開始（ランダムエフェクト/フォント/位置/色）
- **OFF**: autoText停止 + テキストクリア
- エフェクト/フォント選択UIは削除（自動ランダム）

## Testing
```bash
npm test          # vitest run (1689 tests)
npm run test:watch
```

## Manual Testing
1. `chrome://extensions/` → Developer mode → Load unpacked → select this folder
2. Open any website (not chrome://)
3. Click VJam FX icon → Select preset → Toggle ON
4. Play a video with audio → beat detection auto-starts via `<video>` element
