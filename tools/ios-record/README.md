# iPad の実機録画(App Review 用)

App Review に「実機の画面録画」を求められたときに使う(2026-10、Guideline 2.1)。
iPad を USB でつないで、Xcode の UI テストで iPad を自動で操作しながら、Mac で iPad の画面を録画する。音は録らない。

- `project.yml`:xcodegen の設定(`brew install xcodegen`)。ホストの空アプリ + UI テスト
- `UITests/RecorderTests.swift`
  - `testPrep`:Safari で撮影ページ(https://infohiroki.github.io/vjam-fx/demo/)を開き、VJam FX を OFF・Manual を畳んでホームへ
  - `testRecord`:VJam FX アプリを開く → Safari で Play → パネルで ON → Auto → Next → Manual で 1 つ選ぶ → OFF(約 2 分)
- `screenrec.swift`:CoreMediaIO で画面キャプチャのデバイスを許可して、USB の iPad の画面を mov に録る

## 手順
```bash
cd tools/ios-record
xcodegen generate
xcodebuild build-for-testing -project VJamRecorder.xcodeproj -scheme Recorder \
  -destination 'platform=iOS,id=<iPad の UDID>' -allowProvisioningUpdates -derivedDataPath dd
swiftc -O screenrec.swift -o screenrec
XTR=$(ls dd/Build/Products/*.xctestrun)
xcodebuild test-without-building -xctestrun "$XTR" -destination 'platform=iOS,id=<UDID>' -only-testing:RecorderUITests/RecorderTests/testPrep
./screenrec "$PWD/final.mov" 175 &   # 録画を始めてから
xcodebuild test-without-building -xctestrun "$XTR" -destination 'platform=iOS,id=<UDID>' -only-testing:RecorderUITests/RecorderTests/testRecord
# 頭(ホーム画面・起動の白)と上のステータスバーを切って、音なしで書き出す(10MB 未満に)
ffmpeg -ss 11.9 -to 147 -i final.mov -an -vf "fps=30,crop=1600:1154:0:46,scale=1280:-2,format=yuv420p,fade=t=in:st=0:d=0.4" -c:v libx264 -crf 30 -movflags +faststart review.mp4
```

## 気をつけること
- iPad の Safari のタブは撮影ページ 1 つだけにする(タブの列にほかのタブのタイトルが映る)
- iPad は自動ロックなし・ミュート
- 設定アプリは録らない(Wi-Fi の名前などが映る)。オンにする手順はアプリの案内画面で見せる
- ホーム画面は映さない(アプリの一覧が映る)。録画の頭を切る
- iPad の言語が日本語なので、Safari のボタンのラベルは日本語(拡張のボタンは `VJam FX — VJ Effects for Any Website`)
