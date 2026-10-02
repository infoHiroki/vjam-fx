#!/usr/bin/env node
// VJam 本体(リポの外)の資料を、選び直し画面が読む JSON にする
//   node tools/review/vjam-json.mjs [VJam のリポ(既定 ~/Dev/vjam)]
// - docs/preset-audio-reactivity.md の表 → tools/review/vjam-reactivity.json(低音 / 中音 / 高音 / 音量 / ビートを使っている回数)
// - tmp-presets/seed-review.md の「採用」 → tools/review/vjam-review.json
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REACTIVITY_MD = 'docs/preset-audio-reactivity.md';
const REVIEW_MD = 'tmp-presets/seed-review.md';
const NUM_COLS = ['bass', 'mid', 'treble', 'rms', 'strength', 'beat', 'isBeat'];

const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());

/** preset-audio-reactivity.md の「詳細表」→ { generated, presets: { name: { bass, mid, treble, rms, strength, beat, isBeat, onBeat, category } } } */
export function parseReactivity(md) {
  const lines = md.split('\n');
  const head = lines.findIndex(l => /^\|\s*#\s*\|\s*preset\s*\|/.test(l));
  if (head < 0) throw new Error('表の見出し(| # | preset | ...)が無い');
  const cols = cells(lines[head]);
  const at = name => cols.indexOf(name);
  for (const c of ['preset', ...NUM_COLS, 'onBeat']) if (at(c) < 0) throw new Error(`表に ${c} の列が無い`);
  const presets = {};
  for (const line of lines.slice(head + 2)) {
    if (!line.startsWith('|')) break;
    const row = cells(line);
    const name = row[at('preset')].replace(/`/g, '');
    if (!name) continue;
    const entry = {};
    for (const c of NUM_COLS) entry[c] = Number(row[at(c)]) || 0;
    entry.onBeat = row[at('onBeat')] === '✓';
    entry.category = at('カテゴリ') >= 0 ? row[at('カテゴリ')] : '';
    presets[name] = entry;
  }
  const date = md.match(/\*\*生成日\*\*:\s*(\S+)/);
  const sorted = Object.fromEntries(Object.keys(presets).sort().map(k => [k, presets[k]]));
  return { generated: date ? date[1] : '', presets: sorted };
}

/** seed-review.md の「### 採用 (N 件)」の名前。N と数が合わなければ throw */
export function parseSeedReview(md) {
  const lines = md.split('\n');
  const head = lines.findIndex(l => /^###\s*採用/.test(l));
  if (head < 0) throw new Error('「### 採用」の節が無い');
  const names = [];
  for (const line of lines.slice(head + 1)) {
    if (/^#/.test(line)) break;
    const m = line.match(/^\s*-\s+(.*)$/);
    if (m) names.push(...m[1].split(',').map(s => s.trim()).filter(Boolean));
  }
  const n = lines[head].match(/(\d+)\s*件/);
  if (n && Number(n[1]) !== names.length) throw new Error(`採用 ${n[1]} 件のはずが ${names.length} 件`);
  return names;
}

function main() {
  const vjam = resolve(process.argv[2] || join(homedir(), 'Dev/vjam'));
  const out = dirname(fileURLToPath(import.meta.url));
  const reactivity = parseReactivity(readFileSync(join(vjam, REACTIVITY_MD), 'utf8'));
  const adopted = parseSeedReview(readFileSync(join(vjam, REVIEW_MD), 'utf8'));
  const write = (file, data) => writeFileSync(join(out, file), JSON.stringify(data, null, 2) + '\n');
  // 1 本 1 行
  const rows = Object.entries(reactivity.presets).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  writeFileSync(join(out, 'vjam-reactivity.json'), `{\n  "source": ${JSON.stringify(`~/Dev/vjam/${REACTIVITY_MD}`)},\n` +
    `  "generated": ${JSON.stringify(reactivity.generated)},\n  "presets": {\n${rows.join(',\n')}\n  }\n}\n`);
  write('vjam-review.json', { source: `~/Dev/vjam/${REVIEW_MD}`, adopted });
  console.log(`vjam-reactivity.json: ${Object.keys(reactivity.presets).length} 本 / vjam-review.json: 採用 ${adopted.length} 件`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
