#!/bin/bash
# Safari(iPad)版の拡張を build/safari-ext/ に組み立てる
# Xcode プロジェクト(safari/)はここを相対パスで参照する
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=build/safari-ext

rm -rf "$OUT" && mkdir -p "$OUT"
# build/ は丸ごと git に載せない
echo '*' > build/.gitignore

# offscreen/ は入れない(Safari は offscreen / tabCapture 非対応)
cp -R manifest.json background content popup lib icons "$OUT/"

# manifest を safari/manifest.patch.json で上書き
#   permissions_remove : permissions から外す
#   content_scripts_add: js が全部そろっているものだけ content_scripts に足す
#   それ以外のキー      : そのまま上書き
node - "$OUT" safari/manifest.patch.json <<'EOF'
const fs = require('fs');
const path = require('path');
const [out, patchFile] = process.argv.slice(2);
const manifestFile = path.join(out, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const patch = JSON.parse(fs.readFileSync(patchFile, 'utf8'));

for (const [key, value] of Object.entries(patch)) {
  if (key === 'permissions_remove') {
    manifest.permissions = manifest.permissions.filter((p) => !value.includes(p));
  } else if (key === 'content_scripts_add') {
    for (const cs of value) {
      const missing = cs.js.filter((js) => !fs.existsSync(path.join(out, js)));
      if (missing.length) {
        console.log(`skip content_scripts (not found): ${missing.join(', ')}`);
        continue;
      }
      manifest.content_scripts.push(cs);
    }
  } else {
    manifest[key] = value;
  }
}

// App Store の検査:Safari の manifest の description は 112 文字まで(超えるとアップロードで ITMS-90849)
if (typeof manifest.description !== 'string' || manifest.description.length > 112) {
  console.error(`description must be a string of 112 or fewer characters (now ${manifest.description && manifest.description.length})`);
  process.exit(1);
}

fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
EOF

echo "Built $OUT"
