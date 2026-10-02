#!/usr/bin/env node
// VJam 本体(リポの外)の WebGL の p5 プリセットを FX 形式(IIFE)にして tools/bench/candidates-webgl/ に置く(#42)
//   node tools/bench/convert-webgl.mjs [VJam のリポ(既定 ~/Dev/vjam)]
// - 対象: src/presets/p5/ のうち WEBGL を使うプリセット
// - 外すもの: 画像・動画が要るもの、three.js が要るもの、learn-* / promo-* / tv-emergency / cctv-*、FX の content/presets に同じ名前があるもの
// - 変え方は bench/candidates(2D の 28 本)と同じ: import を window.VJamFX.BasePreset に、export default を外し、末尾で登録する
// - 3d-textures.js のうち画像を使わない形のヘルパー(buildSphereVerts / drawSphere)だけはファイルの中に写す
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PRESET_DIR = 'src/presets/p5';
const BASE_IMPORT = '../base-preset.js';
const TEXTURES = './3d-textures.js';
// 3d-textures.js の中で画像を使わないもの(写すときに一緒に要る関数)
const GEOMETRY = { buildSphereVerts: ['_sphPt', 'buildSphereVerts'], drawSphere: ['drawSphere'] };
const MEDIA = /\b(loadImage|createVideo|createCapture|createImg|createAudio|loadModel|loadSound)\s*\(|new Image\s*\(|createElement\(\s*['"](video|img|audio)['"]/;
const SKIP_NAME = /^(learn-|promo-|cctv-)|^tv-emergency$/;

/** VJam のプリセット(export default class … を持つ)で WEBGL を使うか */
export function isWebglPreset(src) {
  return /\bexport default class\b/.test(src) && /\bWEBGL\b/.test(src);
}

/** import 文 → [{ names, from }]。default import は names に 'default' */
export function parseImports(src) {
  const list = [];
  for (const m of src.matchAll(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm)) {
    const names = m[1].startsWith('{') ? m[1].replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(Boolean) : ['default'];
    list.push({ names, from: m[2], line: m[0] });
  }
  return list;
}

/** 外す理由('image' | 'three' | 'name' | 'in-fx' | 'import')。外さないなら null */
export function skipReason(name, src, fxNames = new Set()) {
  if (SKIP_NAME.test(name)) return 'name';
  if (fxNames.has(name)) return 'in-fx';
  const imports = parseImports(src);
  if (imports.some(i => /three/i.test(i.from))) return 'three';
  if (MEDIA.test(src)) return 'image';
  for (const i of imports) {
    if (i.from === BASE_IMPORT) continue;
    if (i.from === TEXTURES && i.names.every(n => GEOMETRY[n])) continue;
    // 3d-textures の画像・image-cache / collage / fluid-warp-core(画像を流す)など
    return /textures|image|collage|fluid-warp|sketch-core/.test(i.from) ? 'image' : 'import';
  }
  return null;
}

/** ソース(トップレベルの function 宣言だけを並べたもの)から name の関数を抜き出す */
export function extractFunction(src, name) {
  const m = src.match(new RegExp(`^(?:export\\s+)?function\\s+${name}\\s*\\([\\s\\S]*?^}`, 'm'));
  if (!m) throw new Error(`関数 ${name} が無い`);
  return m[0].replace(/^export\s+/, '');
}

/** FX 形式(IIFE)にする。texturesSrc は 3d-textures.js の中身(ヘルパーを写すときだけ要る) */
export function convert(name, src, texturesSrc = '') {
  const cls = src.match(/^export default class\s+([A-Za-z_$][\w$]*)/m);
  if (!cls) throw new Error(`${name}: export default class が無い`);
  const helpers = [];
  let body = src;
  for (const i of parseImports(src)) {
    if (i.from === BASE_IMPORT) {
      body = body.replace(i.line, "(function() {\n'use strict';\nconst BasePreset = window.VJamFX.BasePreset;");
    } else if (i.from === TEXTURES) {
      for (const n of i.names) for (const f of GEOMETRY[n]) if (!helpers.includes(f)) helpers.push(f);
      body = body.replace(i.line + '\n', '');
    } else {
      throw new Error(`${name}: 写せない import(${i.from})`);
    }
  }
  if (!body.startsWith('(function() {')) throw new Error(`${name}: BasePreset の import が先頭に無い`);
  if (helpers.length) {
    const code = helpers.sort((a, b) => GEOMETRY_ORDER.indexOf(a) - GEOMETRY_ORDER.indexOf(b))
      .map(f => extractFunction(texturesSrc, f)).join('\n\n');
    body = body.replace('const BasePreset = window.VJamFX.BasePreset;',
      `const BasePreset = window.VJamFX.BasePreset;\n\n// VJam の 3d-textures.js から(画像を使わない形のヘルパー)\n${code}`);
  }
  body = body.replace(/^export default class /m, 'class ').replace(/\s*$/, '\n');
  return `${body}\nwindow.VJamFX = window.VJamFX || { presets: {} };\nwindow.VJamFX.presets[${quote(name)}] = ${cls[1]};\n})();\n`;
}

const GEOMETRY_ORDER = ['_sphPt', 'buildSphereVerts', 'drawSphere'];
const quote = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function main() {
  const vjam = resolve(process.argv[2] || join(homedir(), 'Dev/vjam'));
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, 'candidates-webgl');
  const repo = resolve(here, '../..');
  const fxNames = new Set(readdirSync(join(repo, 'content/presets')).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)));
  const dir = join(vjam, PRESET_DIR);
  const texturesSrc = readFileSync(join(dir, '3d-textures.js'), 'utf8');
  const done = [], skipped = {};
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const file of readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
    const name = file.slice(0, -3);
    const src = readFileSync(join(dir, file), 'utf8');
    if (!isWebglPreset(src)) continue;
    const why = skipReason(name, src, fxNames);
    if (why) {
      (skipped[why] = skipped[why] || []).push(name);
      continue;
    }
    writeFileSync(join(out, file), convert(name, src, texturesSrc));
    done.push(name);
  }
  const total = done.length + Object.values(skipped).reduce((n, l) => n + l.length, 0);
  console.log(`WebGL ${total} 本 → 候補 ${done.length} 本(tools/bench/candidates-webgl/)`);
  for (const [why, names] of Object.entries(skipped)) console.log(`  外した ${why} ${names.length}: ${names.join(', ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
