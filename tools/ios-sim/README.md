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
node tools/ios-sim/ev.mjs 'document.title'                           # 表示中のタブで JS を 1 つ評価
xcrun simctl io "VJam iPhone" screenshot --type=png "$PWD/shot.png"  # 画面
```
- 動画はいつもミュート(`run.mjs` が play を差し替える)
- 試験の動画は Apple の HLS の見本(bipbop)。他社のサイトは試さない

## 分かっていること(2026-10-03、iOS 26.4)
- iPhone の Safari:`MediaSource` 無し・`ManagedMediaSource` あり・要素のフルスクリーン(`requestFullscreen`)無し・`video.webkitEnterFullscreen` だけ
- タップ:標準の HLS も ManagedMediaSource も、音声をデコードできた(bipbop の 1 秒ごとの音で BPM 60)
- ふつうの表示ではエフェクトが重なる
- `webkitEnterFullscreen` は iPhone 専用のプレーヤーに切り替わり、ページの上のものは何も見えない(エフェクトも消える)。抜けると動画が止まる
