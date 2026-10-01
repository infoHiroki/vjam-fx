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
