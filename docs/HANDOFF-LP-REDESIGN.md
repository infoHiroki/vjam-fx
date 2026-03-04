# VJam本体LP リデザイン引き継ぎ

## なぜ作り直すのか

VJam FX LP（Chrome拡張のランディングページ）で根本的な作り直しを行い、大幅にクオリティが上がった。VJam本体LPにも同じアプローチを適用する。

### 核心: セクション別キャンバス方式

現行VJam LPは**ページ全体に1枚のcanvas**（グリッド線+パーティクル）を`position: fixed`で敷いている。これには構造的な問題がある:

- **スクロールしても同じ背景** — どこまでスクロールしても同じグリッド+パーティクルが見えるだけ。単調
- **フルページスクリーンショットで死ぬ** — `position: fixed`のcanvasはビューポート位置にしか描画されないため、スクショの90%が真っ黒になる（SNS共有で致命的）
- **セクションごとの演出ができない** — 背景が1枚なので、セクションの性格に合わせた雰囲気の切り替えが不可能

VJam FX LPでは**各セクションが独自のp5.jsキャンバスを持つ**方式に変更した:

```
セクション1: Neon Tunnel（派手、引き込む）
セクション2: Kaleidoscope（華やか、対称美）
セクション3: Matrix Rain（テック感）
セクション4: Aurora（荘厳、余韻）
```

これにより:
- **スクロールするたびに世界が変わる** — 飽きない、次を見たくなる
- **フルページスクショで全セクションにエフェクトが映る** — SNS映え
- **VJツールのLP自体がVJのような体験になる** — 製品の価値を体感で伝えられる
- **IntersectionObserverで非表示セクションはnoLoop()** — パフォーマンス問題なし

### 構造

```
.slide（position: relative, min-height: 100vh, isolation: isolate）
  ├── .slide-bg（position: absolute, inset: 0, z-index: 0, background: #000）
  │     └── <canvas>（p5.jsが各セクション固有のエフェクトを描画）
  └── .slide-fg（position: relative, z-index: 1, flexbox縦中央）
        └── コンテンツ（見出し、カード等）
```

**`position: fixed` の単一canvas → `position: absolute` のセクション別canvas。これが最大の変更点。**

---

## 実装上のハマりポイント（FX LPで実際にハマった）

### 1. canvasの透過問題（最重要）
trail描画（`background(0,0,0,10)` のような低alpha）を使うエフェクトは、canvasが完全に不透明にならない。`.slide-bg`に`background: #000`を必ず設定し、canvasの裏に黒の不透明背景を敷くこと。これがないと下のセクションのコンテンツが透けて、フルページスクショでテキストが二重に見えるバグが発生する。

### 2. isolation: isolate
各`.slide`に`isolation: isolate`を付けてstacking contextを分離。これがないとcanvasのz-indexが隣接セクションに影響する。

### 3. height: 100vh は使わない
`min-height: 100vh`にすること。`height: 100vh`固定だとコンテンツが多いセクション（features、FAQ等）で見切れる。`justify-content: center`との組み合わせで、少ないコンテンツは中央配置、多いコンテンツは自然に伸びる。

### 4. ギャラリー/動画の分離
横スクロールギャラリーやYouTube埋め込みは`.slide`ではなく通常の`<div>`で配置し、`background: #030303; z-index: 10; isolation: isolate`で完全分離する。canvasとの干渉を避けるため。

---

## デザインシステム

### カラー
```css
--text: #f0f0f0;
--dim: #888;
--accent: #00cc66;           /* CTAボタン */
--g1: #FF1493;               /* グラデーション始点（DeepPink） */
--g2: #8B5CF6;               /* グラデーション終点（Purple） */
背景: #030303
```

### グラデーションテキスト
```css
background: linear-gradient(135deg, #FF1493, #8B5CF6);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
```
タイトル・セクション見出しに共通適用。glow用に`filter: drop-shadow(0 0 80px rgba(255,20,147,.35))`。

### グラスモーフィズムカード
```css
background: rgba(0,0,0,.28);
backdrop-filter: blur(20px);
border: 1px solid rgba(255,255,255,.09);
border-radius: 18px;
```
ホバー: 紫ボーダー + glow + `translateY(-3px)`

### CTAボタン
```css
background: #00cc66;
color: #000;
border-radius: 50px;
box-shadow: 0 0 50px rgba(0,204,102,.3);
```

### スクロール演出
子要素が`opacity:0; translateY(24px)`から`.in`クラス付与で順番に出現。`transition-delay`を80msずつずらし。

### SVGアイコン
`<symbol>` + `<use href>`方式。ストロークにグラデーション`linearGradient`（#FF1493→#8B5CF6）。

---

## 全セクション エフェクト割り当て

| VJam LPセクション | エフェクト | 理由 |
|------------------|-----------|------|
| **Hero** | Neon Tunnel + Embers | ファーストビューに最大インパクト |
| **Demo Video** | Kaleidoscope | 万華鏡の対称性が映像と調和 |
| **Features** | Matrix Rain | テック感。グラスカードとの相性○ |
| **Multi-Device** | Aurora | 落ち着いた美しさ。デバイス画像が映える |
| **Getting Started** | Particle Flow（新規） | シンプルな浮遊パーティクルで読みやすさ確保 |
| **Pricing** | Aurora（色相違い） | 購買セクションは落ち着きつつ美しく |
| **FAQ** | Matrix Rain（低速） | speed係数を下げ、読みやすさ優先 |

同一エフェクトの差別化: hueオフセット / speed係数 / パーティクル密度で調整。

---

## シミュレート音声

LPには実音声入力がないため、`tickAudio(t)`で128BPM相当のbass/mid/treble/beat値をsin波で生成。全エフェクトがこの擬似音声に反応して動く。

```javascript
const au = { bass: 0, mid: 0, treble: 0, rms: 0, beat: 0 };
function tickAudio(t) {
  au.bass = .3 + .3 * Math.sin(t * 1.1) + .2 * Math.sin(t * .4);
  au.mid = .25 + .25 * Math.sin(t * 1.7 + 1) + .15 * Math.sin(t * .6);
  au.treble = .2 + .2 * Math.sin(t * 2.3 + 2) + .1 * Math.sin(t * .8);
  au.rms = (au.bass + au.mid + au.treble) / 3;
  if (t - lastBt > 60 / 128) { lastBt = t; au.beat = .6 + Math.random() * .4; }
  au.beat *= .92;
}
```

---

## VJam本体固有の要素（そのまま維持）

- YouTube動画埋め込み（facade pattern）
- 価格セクション（¥3,980） → カードをグラスモーフィズム化
- FAQアコーディオン → 開閉ロジック維持、スタイル変更
- Schema.org JSON-LD
- Service Worker / PWA
- EN/JA切替（同じ`data-lang`方式で統一可能）

---

## パフォーマンス考慮

セクション7つ = p5インスタンス7つ。FX LPの4つでは問題なかったが:
- **IntersectionObserverで非表示は必ずnoLoop()** — これで同時稼働は常に1-2個
- モバイルでメモリが厳しい場合、`window.matchMedia('(max-width: 768px)')`でエフェクト数を3-4個に絞る選択肢もあり

---

## ファイル参照
- **VJam FX LP全コード**: `vjam-fx/docs/index.html`（1ファイル完結、CSS/JSインライン）
- **エフェクト関数**: 同ファイル内の `heroEffect`, `featEffect`, `catEffect`, `ctaEffect` をそのままコピー可能
- **p5.js**: `vjam-fx/docs/p5.min.js`（v1.11.1）
