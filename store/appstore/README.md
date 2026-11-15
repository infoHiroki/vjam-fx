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
- iPhone 6.9 インチ:1320 × 2868 / 1290 × 2796。iPhone 17 Pro Max のシミュレータで撮るとちょうど 1320 × 2868(1.2.0 から iPhone も出すので要る)

### シミュレータで撮る(iPhone 6.9 インチ・1.2.0 のやり方)

撮影ページを開いて Play を押し(ミュート)、選んだエフェクトを入れてから撮る(`tools/ios-sim/shot.mjs`。拡張は使わないので popup は写らない)。

```bash
xcrun simctl create "VJam iPhone 69" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max com.apple.CoreSimulator.SimRuntime.iOS-26-4
xcrun simctl boot "VJam iPhone 69"
xcrun simctl spawn "VJam iPhone 69" defaults write -g AppleLanguages -array en   # 英語(やり直すときは shutdown → boot)
xcrun simctl status_bar "VJam iPhone 69" override --time 9:41 --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4
python3 store/appstore/demo/serve.py 8000 &
xcrun simctl openurl "VJam iPhone 69" "http://localhost:8000/#en"
# Web Inspector の口(tools/ios-sim/README.md の準備と同じ)
SOCK=$(lsof -U 2>/dev/null | grep -o '/private/var/tmp/com.apple.launchd[^ ]*webinspectord_sim.socket' | head -1)
ios_webkit_debug_proxy -s unix:$SOCK -c null:9530,:9531-9600 --no-frontend &
bash scripts/build-safari-ext.sh
SIMPORT=9531 node tools/ios-sim/shot.mjs "http://localhost:8000/#en" build/shots/01-effects.png neon-tunnel,fireflies,neon-frame
```

- 初めて Safari を開くと、下に「View Bookmarks, Share Menu…」の吹き出しが出る。× で閉じてから撮る
- WebGL(`tunnel-shader`)は光が強い瞬間だと白く飛ぶ。何回か撮って選ぶ
- アプリの案内画面は `xcrun simctl launch "VJam iPhone 69" com.vjam.fx` → `xcrun simctl io "VJam iPhone 69" screenshot`
- App Store には JPEG(`sips -s format jpeg -s formatOptions 90 x.png --out x.jpg`)で上げた

## 音を作り直す

```bash
python3 store/appstore/demo/make_loop.py   # brew install ffmpeg が要る
```

## 出したもの(1.1.0・2026-10-03)

- **公開**:2026-10-21 に 1.1.0 (2) が審査を通り、自動で公開(https://apps.apple.com/app/vjam-fx-music-visualizer/id6818703407)。初回の 2.1 への返信は `review-reply-2026-10.md`
- `screenshots-ipad13/`:App Store に上げた iPad 13 インチのスクショ 5 枚(2064 × 2752、この順)
  - iPad Pro 13 インチのシミュレータ(英語)で撮影ページを開き、`tools/ios-sim/` と同じやり方でエンジンを入れて撮った(拡張の popup は写っていない)
  - 01 エフェクト(neon-tunnel / fireflies / neon-frame)・02 kaleidoscope / pulse-ring・03 明るいページ(synth-wave / radial-burst)・04 WebGL(tunnel-shader / neon-frame)・05 アプリの案内画面
- App Store Connect の設定:価格 無料・配信 147 の国と地域(EU 27 か国と中国本土は外した。EU はデジタルサービス法の申告、中国は ICP 届出が要るため)・Mac / Vision Pro での配信オフ・データの収集なし・他社のコンテンツなし・年齢 4+・審査に通ったら自動で公開

## iPhone を足す(1.2.0・2026-11-16〜)

- iPhone の実機では試さずに出す(user が決めた。出してから友達に触ってもらう。一度出した端末は外せない)
- `TARGETED_DEVICE_FAMILY` = `1,2`、`MARKETING_VERSION` 1.2.0、`CURRENT_PROJECT_VERSION` 1
- `screenshots-iphone69/`:iPhone 6.9 インチのスクショ 5 枚(1320 × 2868、この順)。iPad と同じ組み合わせ
  - 01 neon-tunnel / fireflies / neon-frame・02 kaleidoscope / pulse-ring・03 明るいページ(synth-wave / radial-burst)・04 WebGL(tunnel-shader / neon-frame)・05 アプリの案内画面
- iPad のスクショは 1.1.0 のまま(App Store Connect で前のバージョンから引き継がれる)
- 新機能の欄は `en.md` / `ja.md` の What's New(このバージョンの新機能)
