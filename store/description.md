# Chrome ウェブストア — ストアの掲載情報

デベロッパー ダッシュボードの「ストアの掲載情報」に入れるもの。v1.1.0 の機能に合わせてある。
文面は App Store(`appstore/en.md` / `ja.md`)とそろえて、Chrome の使い方とタブの音声キャプチャのことを足した。
他社の名前(動画サイトなど)は書かない(App Store と同じ方針)。

## 名前

manifest の `name` がそのまま出る。

```text
VJam FX — VJ Effects for Any Website
```

## 概要(Summary)— 125 / 132

manifest の `description` がそのまま出る(ダッシュボードでは変えられない。`_locales` が無いので日本語のページも英語のまま)。

```text
Overlay 370 music-reactive VJ visuals on any webpage. Auto mode, beat detection, layers, blend modes, filters, scenes & text.
```

## 説明(Description)— 上限 16,000

| 言語 | ファイル | 字数 |
|---|---|---|
| English(既定) | `description.txt` | 2,015 |
| 日本語 | `description-ja.txt`(ダッシュボードで言語に日本語を足して貼る) | 1,013 |

## 画像

| 項目 | ファイル | 大きさ |
|---|---|---|
| ストアのアイコン | `../icons/icon-128.png` | 128 × 128 |
| スクリーンショット | `screenshots/01-effects.png` 〜 `05-settings.png`(この順で) | 1280 × 800 |
| プロモーション タイル(小) | `promo-small.png` | 440 × 280 |
| マーキー プロモーション タイル | `promo-marquee.png` | 1400 × 560 |

スクショ 5 枚の中身:

1. `01-effects.png` — エフェクトだけ(暗いページ)
2. `02-popup-auto.png` — popup(Auto 中:AUTO・BPM・レイヤー名)
3. `03-light-page.png` — 明るいページ(ブレンドが自動で変わる)
4. `04-manual.png` — Manual を開いたところ(Effect・Filters・Blend・Scenes)
5. `05-settings.png` — 設定(Auto start・All tabs・Fade・Cycle・Sensitivity・Too heavy)

撮り直し・作り直しは `README.md`。

## カテゴリ・言語

- カテゴリ:今の設定のまま(v1.0.2 で選んだもの)
- 言語:English

## URL

| 項目 | URL |
|---|---|
| ホームページ URL | https://infohiroki.github.io/vjam-fx/ |
| サポート URL | https://infohiroki.github.io/vjam-fx/support.html |
| プライバシー ポリシー(「プライバシーへの取り組み」タブ) | https://infohiroki.github.io/vjam-fx/privacy-policy.html |

権限の説明・単一用途・データの使用は `permissions.md`。
