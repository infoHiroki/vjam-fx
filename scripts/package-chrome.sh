#!/bin/bash
# Chrome ウェブストアに上げる zip を dist/vjam-fx-v<manifest の version>.zip に作る
# 入れるのは拡張が読むものだけ(テスト・tools・safari・store・docs・node_modules・build は入れない)
set -euo pipefail
cd "$(dirname "$0")/.."

ENTRIES=(manifest.json background content icons lib offscreen popup)
VERSION=$(node -p "require('./manifest.json').version")
OUT="dist/vjam-fx-v${VERSION}.zip"

mkdir -p dist
rm -f "$OUT" && zip -qr -X "$OUT" "${ENTRIES[@]}" -x '*.DS_Store' -x '*/._*' -x '*/.*'

# 中身を確かめる
LIST=$(unzip -Z1 "$OUT")
echo "$LIST"

# 要らないもの(隠しファイル・Mac のゴミ・入れないディレクトリ)が入っていない
BAD=$(echo "$LIST" | grep -E '(^|/)\.|__MACOSX|(^|/)(test|tests|tools|safari|store|docs|node_modules|build|dist)/' || true)
if [ -n "$BAD" ]; then
  echo "NG: 入れてはいけないものが入っている:" >&2
  echo "$BAD" >&2
  exit 1
fi

# 入れるものは全部ある(ENTRIES のどれでもない一番上のものは無い)
TOP=$(echo "$LIST" | cut -d/ -f1 | sort -u)
for entry in "${ENTRIES[@]}"; do
  echo "$TOP" | grep -qx "$entry" || { echo "NG: $entry が入っていない" >&2; exit 1; }
done
EXTRA=$(echo "$TOP" | grep -vxF "$(printf '%s\n' "${ENTRIES[@]}")" || true)
if [ -n "$EXTRA" ]; then
  echo "NG: 知らないものが入っている: $EXTRA" >&2
  exit 1
fi

# zip の中の manifest が読めて、version が合っていて、書いてあるファイルが zip にある
unzip -p "$OUT" manifest.json | node -e '
const list = new Set(process.argv[1].split("\n"));
const m = JSON.parse(require("fs").readFileSync(0, "utf8"));
if (m.version !== process.argv[2]) throw new Error(`version ${m.version} != ${process.argv[2]}`);
const files = [
  m.background.service_worker,
  m.action.default_popup,
  ...Object.values(m.action.default_icon),
  ...Object.values(m.icons),
  ...m.content_scripts.flatMap((c) => c.js),
  ...m.web_accessible_resources.flatMap((w) => w.resources),
];
for (const f of files) {
  const ok = f.includes("*")
    ? [...list].some((p) => new RegExp("^" + f.replace(/[.]/g, "\\.").replace(/\*/g, "[^/]+") + "$").test(p))
    : list.has(f);
  if (!ok) throw new Error(`manifest に書いてあるのに zip に無い: ${f}`);
}
console.log(`manifest OK: ${m.name} ${m.version}`);
' "$LIST" "$VERSION"

echo "$(echo "$LIST" | grep -cv '/$') files, $(du -h "$OUT" | cut -f1 | tr -d ' ') → $OUT"
