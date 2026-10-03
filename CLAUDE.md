# VJam FX — Chrome Extension — Claude Code Settings

## Overview
VJamの無料Chrome拡張。任意のWebページにVJエフェクトを重ねる。VJam本体への導線。

## Development Rules
- **MVP / KISS / YAGNI**
- **Commit**: 日本語、絵文字+簡潔1行、Co-Authored-By: Claude
- **PR マージ**: lead の Claude が見て問題なければ、「おけ」を待たずにマージしてよい(2026-10-01〜)

## Tech Stack
- Vanilla JavaScript (IIFE pattern, no bundler)
- p5.js (2D graphics)
- Chrome Extension Manifest V3
- Service Worker (状態永続化)
- Vitest + jsdom (testing, 4066 tests) + Playwright e2e (`tests/e2e/`, 103)

## Architecture
- **Popup**: `popup/` — UI controller, injects via `chrome.scripting.executeScript`
- **Content (MAIN world)**: `content/` — VJamFXEngine, 370 presets, video audio capture
- **デフォルトプール**: `content/default-pool.json`(Next / Auto / Rnd の抽選対象。手動は全部選べる)。選ぶ画面と計測は `tools/`(`tools/README.md`)、決定版の記録は `tools/curate/selected-pool.json`
- **Safari(iPad)版**: `safari/`(Xcode)+ `scripts/build-safari-ext.sh`(共有ソース → `build/safari-ext/`、manifest は `safari/manifest.patch.json`)。手順は `safari/README.md`
- **MSE タップ**: `content/mse-tap.js`(Safari のみ。document_start / MAIN world)。MediaSource の append と標準 HLS の区切りから音声をデコードして BPM・ビートを出す。`__vjamMse` があるときエンジンは createMediaElementSource を張らない
- **Audio Bridge**: `content/audio-bridge.js` — ISOLATED world, SW→MAIN audioData relay
- **Service Worker**: `background/service-worker.js` — ページ遷移で状態復帰
- **Communication**: Popup → MAIN world via `executeScript({ world: 'MAIN', func })`
- **On-demand injection only**

## Audio（両方起動方式）
- Popup が `startVideoAudio`(content) + `startTabAudio`(SW) を**順次await**
- **createMediaElementSource**: `<video>`/`<audio>`要素から直接音声取得（録音インジケータなし）
- **tabCapture fallback**: offscreen document経由、全タブ音声取得（録音インジケータあり）
- CORS/MSE無音検出: createMediaElementSource成功後2秒間analyserをチェック
  - 非無音 → tabCapture停止（インジケータ消える、フルスクリーン対応）
  - 無音 → analyser切断、tabCapture継続（`_externalAudioData`経由で音反応）
- `_stopVideoAudio()`: analyserのみ切断（source→destination維持、音声再生継続）
- `_destroyVideoAudio()`: AudioContext完全破棄（destroy時のみ）
- tabCapture停止/開始はpopup/SWが直接制御（contentからはbridge経由で`stopTabCapture`/`pauseTabCapture`/`resumeTabCapture`送信）
- フルスクリーン時: tabCaptureをpause→exit時にresume（録音インジケータがフルスクリーンをブロックする対策）
- silence-checkはctx.resume()完了後に開始（AudioContext suspended対策）
- silence-checkタイマーは`_silenceCheckTimer`に参照保持（再呼び出し時にクリア）
- `createMediaElementSource` は1要素1回制限 → try-catch + 既存ctx再利用

## Key Constraints
- Content scripts run in MAIN world (need access to p5 global)
- Presets use IIFE pattern (CSP互換) — `window.VJamFX.presets[name]` に登録
- p5.js injected first as classic script, then engine
- ブレンド: 排他トグル3つ（Lighten/Diff/Exclusion）＋デフォルトscreen、Auto対応
- フィルタ: 重ね掛けトグル8つ、Auto対応
- オーバーレイの中身(レイヤー・キャンバス・テキスト)は Shadow DOM の中。ホストの位置・z-index などは `!important` で固定(動画サイトのフルサイズ表示が、プレイヤー以外を `right:100000px !important` で画面外へ飛ばすため)。p5 の隠しキャンバスは MutationObserver で表に出す(`<style>` は CSP で止まるので使わない)
- 背景未指定（html・body とも透明で画像なし）のページは、overlay を作るとき html に `Canvas` を入れて合成の相手を作る（無いと黒キャンバスがページを覆う。外すとき元に戻す）
- ライトページ自動検出(body→html背景) → 既定screenは描画だけdifferenceに置換（`blendMode`はscreenのまま＝popup/SWに漏らさない）、ランダムblendはdifference/exclusionのみ
- Popup非同期操作: `_busy`フラグ + `_pendingStart`/`_pendingStop`で排他制御（last-action-wins）
- createGraphicsプリセット: `windowResized`時に古いバッファを`.remove()`してからnew
- audio-bridge: `event.source === window`でpostMessage origin検証

## UI: Auto が主役・手動は畳む(見本 `tools/design/mockup/index.html`)
- **いつもの画面**(上から): ヘッダー(ロゴ `popup/lockup.png`・設定・ON/OFF)→ ステージ → `Next` / `Auto` → チップ → Opacity → `Manual` の行 → フッター
- **ステージ**: `AUTO` / `MANUAL` / `OFF`、BPM(取れるときだけ)と拍の点(60 / BPM 秒で脈打つ)、出ているレイヤー名(最大 5)。名前と BPM は popup が開いている間 1 秒おきにエンジンから読む(表示だけ。popup の状態には入れない)
- **Next**: ランダム1-3プリセット（選択分のみinject、FX維持）。Auto が ON なら Auto は切らず、そのセットから 1 手ずつ続ける
- **Auto** / **Stop Auto**: 1 手ずつ積み上げる(#59)。1 手 = 設定の Cycle 秒数(既定 15 秒)がたった後の次の拍(拍を待つのは最大 1 秒、BPM が取れなければ秒数で。Rnd も同じ)で、変えるのは 1 枚だけ
  - 流れ: 1 枚(トグル ON の Auto も 1 枚から)→ 1 枚ずつ足す → 上限で一番古い 1 枚を入れ替え(2〜4 手)→ ブレイク(新しい 1 枚だけ残す)→ また足す。4〜6 回のブレイクに 1 回は休み(全部消して 0.5 秒 → 1 枚から)
  - 上限は 3。端末のレイヤー上限・重いものを除いたプールの本数・音(rms の 8 秒平均が山の半分未満なら 2)のほうが小さければそちら。超えたら一番古い 1 枚を減らす
  - 足すものはプールから(出ているもの・重いものを除く)。WebGL は 1 枚まで、カテゴリ(popup がプールの `categories` で渡す)がかぶらないものを優先
  - Auto 中の blend / filter(Rnd)はブレイクと入れ替えの 3 割で変える。エフェクトのロック中は枚数を変えない
  - フェード既定 5 秒(Cycle の半分まで)、dip の片道はフェードの 1/4(0.3〜1.5 秒)。消えていくレイヤーは 20fps に落とし、フェードの半分で `noLoop()`
  - 重いもの判定はレイヤーを足した・外したフェードの間だけ数えない(フェード + 3 秒で効く)。重いものの入れ替えも 1 手と数える
- **チップ**: `Blend Rnd` / `Filter Rnd` / `All tabs`。ON は緑の点
  - **Blend Rnd** / **Filter Rnd**: ランダム変更（Auto ON/OFF問わず独立動作）。手動の Blend / Filters の `Rnd` と同じもの
  - Auto ONでBlend Rnd / Filter Rndも自動ON、Auto OFFでも独立動作を継続
  - **All tabs**: 設定の All tabs と同じもの
- **Manual**(開いたときだけ): Effect・Filters・Blend・Scenes・Text・Reset・Audio。開いているかは `vjamfx_manual_open`(storage.local)に覚える
- **Reset**(手動の中): 全リセット（レイヤー・フィルタ・ブレンド・Auto・トグル全OFF）
- **フッター**: この端末で重くて外しているもの `N skipped`(0 のときは出さない)・VJam 本体へのリンク
- **動かないページ**(chrome:// など): ロゴ・マーク・`This page can't be overlaid` だけ
- **Lock**: テキスト表示（`Lock`/`Locked`）、locked時オレンジ
- **色**: 緑は ON のスイッチと「Rnd などが ON の点」だけ。ピンク→紫のグラデーションはステージのメーターだけ。アイコンは HTML の中の細い線の SVG(絵文字・記号は使わない)

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
- 空スロット: `border-style: dashed`、保存済み: `solid` + 明るい枠
- Saveモード中: オレンジ枠 + パルスアニメーション

## Text（ON/OFFパターン）
- **ON**: テキスト入力値でautoText開始（ランダムエフェクト/フォント/位置/色）
- **OFF**: autoText停止 + テキストクリア
- エフェクト/フォント選択UIは削除（自動ランダム）

## Testing
```bash
npm test          # vitest run (4066 tests)
npm run test:e2e  # Playwright で実物の拡張を Chromium に読み込んで popup から操作(103)
npm run test:watch
```

## Manual Testing
1. `chrome://extensions/` → Developer mode → Load unpacked → select this folder
2. Open any website (not chrome://)
3. Click VJam FX icon → Select preset → Toggle ON
4. Play a video with audio → beat detection auto-starts via `<video>` element
