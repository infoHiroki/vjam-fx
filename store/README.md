# store

ストアに出すものの置き場。Chrome ウェブストア用はここ、App Store(Safari 版)用は `appstore/`(`appstore/README.md`)。

| ファイル | 中身 |
|---|---|
| `description.md` | ストアの掲載情報(名前・概要・説明のファイル・画像・URL) |
| `description.txt` / `description-ja.txt` | 説明(英 / 日)。そのまま貼る |
| `permissions.md` | プライバシーへの取り組み(単一用途・権限の説明・リモートコード・データの使用) |
| `screenshots/` | スクショ 5 枚(1280 × 800) |
| `promo-small.png` / `promo-marquee.png` | プロモーション タイル(440 × 280 / 1400 × 560)。元は `promo.html` |
| `privacy-policy.md` | プライバシー ポリシー(公開しているのは `docs/privacy-policy.html`) |

## Chrome ウェブストアに出す手順

アップロード・ストアの操作は人がやる。

1. **バージョン**:`manifest.json` の `version` を上げる(Safari 版の `MARKETING_VERSION` とそろえる)
2. **テスト**

   ```bash
   npm test
   npm run test:e2e
   ```

3. **zip を作る**

   ```bash
   ./scripts/package-chrome.sh
   ```

   - `dist/vjam-fx-v<version>.zip` ができる(`dist/` は git に入れない)
   - 入れるのは `manifest.json`・`background/`・`content/`・`icons/`・`lib/`・`offscreen/`・`popup/` だけ
   - 中身の一覧が出る。`.DS_Store` などの隠しファイル・入れないディレクトリが入っていたら、manifest が読めない・書いてあるファイルが無いときは止まる

4. **(機能や見た目が変わったとき)スクショとプロモーション画像を撮り直す**

   ```bash
   npx playwright test -c tests/e2e/store-screenshots.config.js
   ```

   - `screenshots/` を消して 5 枚を撮り直し、`promo-small.png` / `promo-marquee.png` も作り直す(1 分くらい)
   - 撮るのは自前の撮影ページ(`appstore/demo/`)だけ。他社のサイトは写さない
   - Auto が引くもの・プロモーション画像のエフェクトは `tests/e2e/store-screenshots.shots.js` の `PRESETS` / `PROMO_PRESETS`
   - Auto が引くものは毎回変わる。気に入らなければもう一度回す

5. **デベロッパー ダッシュボード**(https://chrome.google.com/webstore/devconsole)→ VJam FX
   1. **パッケージ** → **新しいパッケージをアップロード** → 3 の zip
   2. **ストアの掲載情報**(`description.md`)
      - 説明を `description.txt` に差し替え。言語で日本語を選んで `description-ja.txt` に差し替え
      - スクリーンショットを古いものを全部消してから `screenshots/` の 5 枚を番号順に
      - プロモーション タイル(小)・マーキー プロモーション タイルを差し替え
   3. **プライバシーへの取り組み**(`permissions.md`)
      - 単一用途・権限ごとの理由・ホスト権限の理由・リモートコード・データの使用を `permissions.md` の文面にする
      - v1.1.0 は `optional_host_permissions`(All tabs)が増えたので、ホスト権限の理由は必ず差し替える
   4. **審査のため送信**
6. 公開されたら、そのコミットに `v<version>` のタグを付ける(`git tag v1.1.0 && git push origin v1.1.0`)
