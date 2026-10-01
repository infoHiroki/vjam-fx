# tools

デフォルトプール(Next / Auto / Rnd の抽選対象)を選ぶための計測と選択画面。拡張には入れない。

- `bench/` — プリセット・Filter・Blend の計測(Python + Playwright)
- `curate.html` — 計測結果を見て選び、`content/default-pool.json` の形で書き出す画面

## 計測(bench/)

### 準備

```bash
pip3 install -r tools/bench/requirements.txt
python3 -m playwright install chromium
```

### 回す(リポのルートで)

```bash
python3 tools/bench/bench_fx.py fx aurora bokeh       # 数本だけ(動作確認)
python3 tools/bench/bench_fx.py all                   # FX 全部 → 候補全部 → Filter × Blend(1 時間くらい CPU を使い続ける)

python3 tools/bench/bench_fx.py fx                    # content/presets の全部
python3 tools/bench/bench_fx.py candidates            # tools/bench/candidates の全部
python3 tools/bench/bench_fx.py combos                # Filter × Blend(代表は fx の結果から自動で選ぶ)
python3 tools/bench/bench_fx.py combos --reps a,b,c   # 代表を指定
```

- 名前を省くと全部。`out/<set>/results.json` に入っているものは飛ばす(途中で止めても続きから)。やり直すときは `tools/bench/out/<set>/` を消す
- 名前を書いたものは毎回測り直す
- ページはテスト用の記事ページ(`bench/site/article.html`、`body.dark` で暗いページ)をその場で配信する(空いているポートを自動で使う)
- 候補(`bench/candidates/`)は VJam 由来の 28 本を FX 形式にしたもの。出荷はしない

### 出力(`tools/bench/out/`、git に入れない)

| ファイル | 中身 |
| --- | --- |
| `fx/results.json` `candidates/results.json` | プリセットごとの数字。落ちたものは `error` に理由 |
| `fx/<name>_light.jpg` `_dark.jpg` | 白・暗のページに重ねたスクショ(640×400) |
| `combos/results.json` | `{ filters, blends, reps, rows: [{ preset, page, blend, filter, rec, fps, img }] }` |
| `combos/<rep>/<page>-<blend>-<filter番号>.jpg` | 組み合わせごとのスクショ(480×300) |

### 数字

条件:1280×800、CPU 4 倍スロットル(iPad 第 9 世代くらい)、擬似音声(120 BPM、ビートで低音が跳ねる)。

| キー | 意味 |
| --- | --- |
| `recLight` / `recDark` | 元の画面とエフェクトを重ねた画面の SSIM(1 に近いほど元のページが分かる)。白ページは既定の screen を difference で描く(エンジンと同じ)、暗いページは screen |
| `fps` | p5 が実際に描けたフレームレート |
| `msPerFrame` | p5 の redraw 1 回の時間(Canvas の実描画は後回しになるので、重いものは fps の方に出る) |
| `energyGain` / `motionGain` | 無音 → 音楽で、明るさ / 動きがどれだけ増えたか |
| `beatLum` / `beatMotion` | 明るさ / 動きがビートの位相にどれだけ揃って揺れるか |
| `cov` / `cov90` | 塗り面積(音楽中の平均 / 90 パーセンタイル) |
| `flash` | 画面の 5% 以上がそろって急に明るくなった(輝度 +0.2 以上)フレームの数/秒。ビートごとに光るものは 2 前後 |
| `errors` | 計測中のページのエラー |

Filter × Blend:代表プリセット 4 本 × filter 24 種(なし + 単体 8 + VJam の複合 16、重複 1 つを除く)× blend 5 種 × 白・暗。
代表は、必須条件の初期値を満たす FX の中から塗り・重さ・反応がばらけるように選ぶ。
組み合わせごとに `rec`(上と同じ SSIM)と `fps` を出す。

- filter の文字列と blend は `bench/filters.json`(単体と blend はエンジンの定義と同じかをテストで見ている)
- CSS の filter / blend の重さは合成側に出るので、ヘッドレスの fps にはほとんど出ない。実機で確かめる

## 選択画面(curate.html)

```bash
python3 -m http.server 8813          # リポのルートで(lib/ と content/ も読むため)
open http://localhost:8813/tools/curate.html
```

iPad で見るときは `python3 -m http.server 8813 --bind 0.0.0.0` で立てて、`http://<Mac の IP>:8813/tools/curate.html` を開く。

- **必須条件**:上のしきい値を満たすものが「デフォルト」の初期値(自動提案)。しきい値を変えると提案も変わる
  - プリセット:rec 白・暗、fps、ms、反応(`max(energyGain,0) + max(motionGain,0) + beatLum + beatMotion`)、エラーなし
  - 点滅系(`flash` がしきい値を超えるもの)は、数字が良くても光過敏の安全のため初期値 OFF。手で ON にはできる
  - filter / blend:集計した rec 白・暗と fps
- **プリセット**タブ:カードに白・暗のスクショと数字。並び替え、ソース(FX / 候補)、条件を満たすものだけ、デフォルトだけ、名前で絞り込める
  - カードを押すとライブプレビュー。記事ページの上で実際のプリセットを擬似音声で動かす。白・暗、blend、filter、音あり / 無音をその場で切り替え。‹ › で前後へ
- **Filter・Blend**タブ:代表プリセットの平均(または 1 本ずつ)の rec を、白・暗 × blend の表で出す。セルを押すとスクショ、そこからライブで見られる
  - filter の集計:白 = difference / exclusion、暗 = blend 全部の平均。blend の集計:フィルタなしの行
  - 白ページで Rnd が使う blend は difference / exclusion だけなので、白のほかの列は薄く出す
- 手で切り替えたものには「手動」が付き、しきい値を変えてもそのまま。「選択を提案に戻す」で全部提案に戻る
- 選んだ状態はブラウザ(localStorage)に保存する。ブラウザごとに別
- **書き出し**で `default-pool.json` をダウンロードする。`content/default-pool.json` に置く

```json
{ "version": 1,
  "presets": ["aurora", "..."],
  "filters": ["none", "hue-rotate(180deg) saturate(2)", "..."],
  "blends": ["screen", "difference", "exclusion"] }
```

- `presets` は名前順。候補(まだ `content/presets` に無いもの)を選ぶとそれも入る
- `filters` は CSS の filter 文字列。`none`(フィルタなし)も選べる

## テスト

`tools/curate/logic.test.js`(判定・集計・書き出し・filters.json とエンジンの定義が揃っているか)は `npm test` で一緒に回る。
