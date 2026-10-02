# VJam FX — Safari(iPad)版

Chrome 版と同じソースから Safari 用の拡張を組み立て、Xcode で iOS アプリとしてビルドする。

- `manifest.patch.json` — Safari 用の manifest の差分
  - `permissions_remove`: permissions から外す(`tabCapture` `offscreen` は Safari 非対応)
  - `content_scripts_add`: js が全部そろっているときだけ content_scripts に足す
  - それ以外のキー: そのまま上書き
- `VJam FX/VJam FX.xcodeproj` — `safari-web-extension-converter` で生成(iOS のみ・Swift)
  - アプリ `com.vjam.fx` / 拡張 `com.vjam.fx.Extension`
  - 拡張のリソースは `build/safari-ext/` を相対パスで参照する

## ビルド手順

### 1. 組み立て

```bash
bash scripts/build-safari-ext.sh
```

`build/safari-ext/` ができる(`offscreen/` は入らない)。
共有のソースを変えたら毎回やり直す。

### 2. Xcode(シミュレータ)

```bash
xcodebuild -project "safari/VJam FX/VJam FX.xcodeproj" -scheme "VJam FX" \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

### 3. 実機(iPad)

署名のチームはプロジェクトに書かない。ビルドするときに渡す。

```bash
xcodebuild -project "safari/VJam FX/VJam FX.xcodeproj" -scheme "VJam FX" \
  -destination 'generic/platform=iOS' -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=<チーム ID> build
xcrun devicectl device install app --device <UDID> <ビルドされた VJam FX.app>
```

Xcode の画面で Team を選んだ場合は、`project.pbxproj` に入った `DEVELOPMENT_TEAM` を commit しない。

iPad 側:設定 → アプリ → Safari → 機能拡張 → VJam FX をオンにし、Web サイトへのアクセスを許可する。

## アプリの画面

アプリを開くと出る案内(オンにする手順・使い方)は `VJam FX/VJam FX/Resources/`。

- `Base.lproj/Main.html` — 英語と日本語を両方持つ。`Script.js` が `navigator.language` を見て html の `lang` を決め、`Style.css` が出し分ける
- CSP が `default-src 'self'` なので、外部の読み込みとインラインのスクリプトは使えない(スクリプトはファイルで読む)
- 色は popup と同じ(`tools/design/mockup/index.html` の `:root`)。ロゴ `Lockup.png` は `popup/lockup.png` と同じもの
- アプリ側で WKWebView のスクロールを切っているので、はみ出すとき(iPhone など)はページの中の `.page` がスクロールする

## App Store に出す

アップロードと App Store Connect の操作は人(か lead)がやる。
文面・URL・審査メモは `store/appstore/en.md`・`ja.md`、スクショの撮り方は `store/appstore/README.md`。

- バージョン:`MARKETING_VERSION`(1.1.0)・`CURRENT_PROJECT_VERSION`(1)。アプリと拡張は同じ値にそろえる
  - 同じバージョンを上げ直すときは `CURRENT_PROJECT_VERSION` を 1 つ増やす(同じ番号は二度と上げられない)
- 暗号:`Info.plist`(アプリ)の `ITSAppUsesNonExemptEncryption` = NO。輸出コンプライアンスの質問は出ない
- iOS の下限:`IPHONEOS_DEPLOYMENT_TARGET` = 17.0(プロジェクト・アプリ・拡張とも)。Manifest V3 と content_scripts の `world: "MAIN"`(`content/mse-tap.js`)を確実に動かすため
- 対応端末:`TARGETED_DEVICE_FAMILY`(今は iPhone + iPad の `1,2`。iPad だけにするかは lead が決める)

### 1. archive

```bash
bash scripts/build-safari-ext.sh
xcodebuild -project "safari/VJam FX/VJam FX.xcodeproj" -scheme "VJam FX" \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/VJamFX.xcarchive -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=<チーム ID> archive
```

### 2. 書き出し(App Store Connect 向け)

書き出しの設定はチーム ID が入るので `build/` に作る(commit しない)。

```bash
cat > build/ExportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>export</string>
  <key>signingStyle</key><string>automatic</string>
  <key>teamID</key><string><チーム ID></string>
</dict>
</plist>
PLIST
xcodebuild -exportArchive -archivePath build/VJamFX.xcarchive \
  -exportPath build/export -exportOptionsPlist build/ExportOptions.plist \
  -allowProvisioningUpdates
```

`build/export/VJam FX.ipa` ができる。

### 3. アップロード

どれか 1 つ。

- Transporter(Mac App Store の Apple のアプリ)に `build/export/VJam FX.ipa` を入れて「配信」
- Xcode の Organizer(Window → Organizer)で archive を選んで Distribute App → App Store Connect
- 書き出しの `destination` を `upload` にして 2 をやり直す(書き出しと同時に上がる)

上げたビルドは、処理が終わると App Store Connect の TestFlight に出る(数分〜数十分)。

### 4. App Store Connect でやること

1. **アプリの登録**(マイ App → +)
   - プラットフォーム iOS・名前(`en.md` の Name)・プライマリ言語・バンドル ID `com.vjam.fx`・SKU(例 `vjam-fx-ios`)
2. **App 情報**
   - ローカライズ:English (U.S.) と 日本語 を足して、名前・サブタイトルを入れる
   - カテゴリ:案は プライマリ「エンターテインメント」・セカンダリ「ミュージック」
   - 年齢制限:質問はすべて「なし / いいえ」で 4+。「制限されていない Web アクセス」も いいえ(アプリ自体は Web を開かない。拡張は Safari の中で動く)
   - コンテンツ配信権:他社のコンテンツは含まない
3. **価格と配信状況**:無料。配信する国・地域を選ぶ
4. **App のプライバシー**
   - プライバシーポリシー URL:`https://infohiroki.github.io/vjam-fx/privacy-policy.html`
   - データの収集:「データを収集しない」
5. **バージョン 1.1.0**(言語ごと)
   - スクショ(iPad 13 インチ。iPhone も出すなら 6.9 インチも)
   - プロモーションテキスト・説明・キーワード・サポート URL(`docs/support.html`)・マーケティング URL(`en.md` / `ja.md`)
   - 著作権(例 `2026 VJam`)
   - ビルド:3 で上げたものを選ぶ
   - App Review に関する情報:連絡先(人が入れる)・サインイン不要・メモは `en.md` の App Review Information
   - リリース:手動 / 承認後に自動 を選ぶ
6. **審査へ提出**
