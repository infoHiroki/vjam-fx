# App Store(Safari 版)

App Store Connect に入れるものの置き場。出す手順は `safari/README.md`。

- `en.md` / `ja.md` — 名前・サブタイトル・プロモーションテキスト・説明・キーワード・URL(字数つき)。審査メモは `en.md`
- サポート URL のページは `docs/support.html`、プライバシーポリシーは `docs/privacy-policy.html`(GitHub Pages)
- `app-screen-en.png` / `app-screen-ja.png` — アプリを開いたときの画面(シミュレータの iPad で撮ったもの。App Store 用の大きさではない)
- `demo/` — スクショ撮影用のページ(架空の Web マガジン + 自作のドラムループ)。同じものを `docs/demo/` に置いて公開している(https://infohiroki.github.io/vjam-fx/demo/。審査担当と、実機の録画で使う)。直したら両方に写す
  - `index.html` — ページ本体。言語は端末に合わせる(`#en` / `#ja` で固定)、`#light` で明るいページ
  - `audio/` — `make_loop.py` で作った音(120 BPM・16 秒のループ)。HLS(`loop.m3u8` + `loop*.ts`)と `loop.m4a`
  - `make_loop.py` — 音を合成して `audio/` を作り直す(要 ffmpeg)。種を固定しているので毎回同じ音
  - `serve.py` — 同じ Wi-Fi の iPad から開くためのサーバー(Range 対応)

Safari 版は MediaSource と標準 HLS の音しか読まない(`content/mse-tap.js`)。
ふつうの音声ファイル(`<audio src="x.m4a">`)ではビートが取れないので、撮影ページは HLS で流している。

## スクショの撮り方

他社の映像・音・画像は写さない。撮影ページだけで撮る。

1. Mac で撮影ページを配る(iPad と同じ Wi-Fi に)

   ```bash
   python3 store/appstore/demo/serve.py
   ```

   `iPad で開く: http://192.168.x.x:8000/` が出る。

2. iPad の Safari でその URL を開く(VJam FX は先にオンにしておく。手順はアプリの画面と同じ)
   - 日本語のページ:URL の最後に `#ja`、英語:`#en`
   - 明るいページ:`#light`(`#ja-light` のようにつなげてよい)
3. 再生カードの **Play**(再生)をタップ
4. アドレスバーの「ぁあ」→ VJam FX → スイッチを ON
   - Auto で始まる。パネルのステージに `120 BPM` が出れば音が取れている
   - パネルを閉じる(ページをタップ)とエフェクトだけの画面になる
5. 本体のボタン(トップボタン + 音量を上げるボタンを同時に押す)でスクショ
6. AirDrop などで Mac に送る

### 撮るもの(例)

1. 暗いページ + エフェクト(パネルは閉じる)
2. パネルを開いたところ(`AUTO`・BPM・レイヤー名が見える)
3. 明るいページ(`#light`)+ エフェクト
4. Manual を開いたところ(エフェクトの一覧・Blend・Scenes)
5. アプリの案内画面(VJam FX のアプリを開いたところ)

日本語のストア用は `#ja` で同じものを撮る。

### 大きさ

App Store Connect が受け付ける大きさで撮る(違うと上げられない)。

- iPad 13 インチ:2064 × 2752 / 2048 × 2732(横向きはその逆)。13 インチの iPad で撮るのがいちばん楽
- 手元に 13 インチが無いとき:Xcode のシミュレータ(iPad Pro 13-inch)に入れて、`xcrun simctl io booted screenshot <ファイル>.png` で撮ると、ちょうどの大きさになる(保存先は内蔵ディスクの絶対パスに。外付けのディスクには書けないことがある)
- 今は iPad だけ(`TARGETED_DEVICE_FAMILY` = 2)なので iPad のスクショだけでよい。iPhone を足したら 6.9 インチ:1320 × 2868 / 1290 × 2796 も要る

## 音を作り直す

```bash
python3 store/appstore/demo/make_loop.py   # brew install ffmpeg が要る
```

## 出したもの(1.1.0・2026-10-03)

- `screenshots-ipad13/`:App Store に上げた iPad 13 インチのスクショ 5 枚(2064 × 2752、この順)
  - iPad Pro 13 インチのシミュレータ(英語)で撮影ページを開き、`tools/ios-sim/` と同じやり方でエンジンを入れて撮った(拡張の popup は写っていない)
  - 01 エフェクト(neon-tunnel / fireflies / neon-frame)・02 kaleidoscope / pulse-ring・03 明るいページ(synth-wave / radial-burst)・04 WebGL(tunnel-shader / neon-frame)・05 アプリの案内画面
- App Store Connect の設定:価格 無料・配信 147 の国と地域(EU 27 か国と中国本土は外した。EU はデジタルサービス法の申告、中国は ICP 届出が要るため)・Mac / Vision Pro での配信オフ・データの収集なし・他社のコンテンツなし・年齢 4+・審査に通ったら自動で公開
