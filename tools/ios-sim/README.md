# iPhone シミュレータで確かめる道具

iPhone の実機が無いので、Mac の iPhone シミュレータの Safari に、外からエンジンを入れて確かめる(拡張は入れない)。
重さ(fps)は実機と違うので見ない。見るのは「音が取れるか・重なるか・崩れないか」。

## 準備(1 回)
```bash
xcrun simctl create "VJam iPhone" com.apple.CoreSimulator.SimDeviceType.iPhone-17 com.apple.CoreSimulator.SimRuntime.iOS-26-4
xcrun simctl boot "VJam iPhone"
# シミュレータの Web Inspector の口(launchd_sim が持っている webinspectord_sim.socket)
SOCK=$(lsof -U 2>/dev/null | grep -o '/private/var/tmp/com.apple.launchd[^ ]*webinspectord_sim.socket' | head -1)
ios_webkit_debug_proxy -s unix:$SOCK -c null:9421,:9422-9522 --no-frontend &
(cd tools/ios-sim/www && python3 -m http.server 8823 --bind 0.0.0.0 &)
xcrun simctl openurl "VJam iPhone" http://localhost:8823/native.html
```

## 使う
```bash
bash scripts/build-safari-ext.sh
node tools/ios-sim/run.mjs http://localhost:8823/native.html 12      # 標準の HLS(タップが区切りを取り直す)
node tools/ios-sim/run.mjs "http://localhost:8823/mms.html?wait" 12  # ManagedMediaSource(hls.js)
node tools/ios-sim/fill.mjs                                           # 画面いっぱい表示(#51)。スクショは build/ios-sim/
node tools/ios-sim/fill.mjs http://localhost:8823/trap.html          # 祖先に transform・低い z-index、上に固定ヘッダーが被るページで
node tools/ios-sim/ev.mjs 'document.title'                           # 表示中のタブで JS を 1 つ評価
xcrun simctl io "VJam iPhone" screenshot --type=png "$PWD/shot.png"  # 画面
```
- 動画はいつもミュート(`sim.mjs` が play を差し替える)
- 試験の動画は Apple の HLS の見本(bipbop)。他社のサイトは試さない
- `run.mjs` / `fill.mjs` の共通(つなぐ・ページを開く・タップとエンジンを入れる)は `sim.mjs`
- シミュレータは外付けのボリュームに直接スクショを書けないことがある(権限)。`fill.mjs` は一時フォルダに撮ってからコピーする

## 分かっていること(2026-10-03、iOS 26.4)
- iPhone の Safari:`MediaSource` 無し・`ManagedMediaSource` あり・要素のフルスクリーン(`requestFullscreen`)無し・`video.webkitEnterFullscreen` だけ
- タップ:標準の HLS も ManagedMediaSource も、音声をデコードできた(bipbop の 1 秒ごとの音で BPM 60)
- ふつうの表示ではエフェクトが重なる
- `webkitEnterFullscreen` は iPhone 専用のプレーヤーに切り替わり、ページの上のものは何も見えない(エフェクトも消える)。抜けると動画が止まる

## 画面いっぱい表示(#51、2026-10-03、iOS 26.4)
iPhone ではフルスクリーンの代わりに、video を画面いっぱい(`position: fixed`・`100vw` × `100dvh`)にしてエフェクトを重ねたままにする。`fill.mjs` で確かめたこと:
- ページの JS の `video.webkitEnterFullscreen()` → 本物のフルスクリーンにならず(`webkitDisplayingFullscreen` は false)画面いっぱい・再生が続く
- 元のメソッドで本物のフルスクリーンに入れても(標準の全画面ボタンの代わり)、抜けて画面いっぱいに戻ってくる・再生が続く
  - `webkitbeginfullscreen` は泡立たない(document の capture で拾える)。入る遷移(約 0.5 秒)の間は `webkitExitFullscreen()` が効かないので呼び直す
  - 抜けると約 0.45 秒後に `pause` が来る。そこで `play()` すれば続く
- 「×」(当たり判定も見る)・エンジンを OFF で、全部の要素の inline の style と `webkitEnterFullscreen` が元に戻る
- 画面いっぱいの間にページが width を書き直しても画面いっぱいのまま。× でページの値に戻る
- `trap.html`(祖先に transform / will-change と低い z-index、上に固定ヘッダーと帯)でも画面いっぱい・一番上が video
- WebKit は CSSOM で変えた style を属性へ遅れて書き戻す。書き戻す前に `removeAttribute('style')` すると後から `style=""` が残る(先に `getAttribute('style')`)
- PiP(`webkitSetPresentationMode('picture-in-picture')`)では `webkitbeginfullscreen` は来ない
- 白いページ(`native.html`)では既定の blend が difference のまま。黒い帯の上は screen と同じ見た目、明るい動画の上もエフェクトが見える(screen だと白に溶ける)
