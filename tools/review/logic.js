// 選び直し画面(review.html)の判定・並び・書き出し(DOM を触らない部分)
import { DEFAULT_THRESHOLDS } from '../curate/logic.js';

// Filter・Blend タブで掛ける 3 本(bench の combos の代表の先頭 3 本)。製品の Auto と同じく重ねて見せる
export const FIXED_PRESETS = ['retro-wave', 'bird-murmuration', 'pixel-cascade'];

// 点滅がこれを超えるものは目立たせる(選択画面の点滅系と同じしきい値)
export const FLASH_WARN = DEFAULT_THRESHOLDS.flash;

export const VIEWS = { all: '全部', undecided: '未判定', yes: '採用', no: 'ボツ' };

// 出どころの表示名(fx = content/presets、candidates = bench/candidates、webgl = bench/candidates-webgl)
export const SOURCES = { fx: 'FX', candidates: '候補', webgl: 'WebGL 候補' };

// プリセット: content/presets 全部 + 候補・WebGL 候補のうち未取り込み(同じ名前が content/presets に無いもの)。名前順
export function presetItems(fxNames, candNames, webglNames = []) {
  const items = fxNames.map(name => ({ kind: 'presets', key: name, source: 'fx' }));
  const seen = new Set(fxNames);
  for (const [names, source] of [[candNames, 'candidates'], [webglNames, 'webgl']]) {
    for (const name of names) {
      if (seen.has(name)) continue;
      seen.add(name);
      items.push({ kind: 'presets', key: name, source });
    }
  }
  return items.sort((a, b) => a.key.localeCompare(b.key));
}

/** ?source=webgl などで絞る(出どころのキーをカンマ区切り)。無い・知らないキーだけなら null(絞らない) */
export function parseSources(q) {
  const keys = String(q || '').split(',').map(s => s.trim()).filter(k => SOURCES[k]);
  return keys.length ? keys : null;
}

// Filter・Blend: filter(filterList の並び)→ blend
export function comboItems(filters, blends) {
  return [
    ...filters.map(key => ({ kind: 'filters', key })),
    ...blends.map(key => ({ kind: 'blends', key })),
  ];
}

// 今のデフォルトプール(content/default-pool.json)に入っているものの集合
export function poolSets(pool) {
  const set = k => new Set(pool && Array.isArray(pool[k]) ? pool[k] : []);
  return { presets: set('presets'), filters: set('filters'), blends: set('blends') };
}

/** 判定: 'yes' | 'no' | null(未判定)。手で付けたもの(saved)が先、無ければプールに入っていれば採用 */
export function verdictOf(saved, pool, item) {
  const v = saved[item.kind] && saved[item.kind][item.key];
  if (v === 'yes' || v === 'no') return v;
  return pool[item.kind].has(item.key) ? 'yes' : null;
}

export function isManual(saved, item) {
  return !!(saved[item.kind] && Object.prototype.hasOwnProperty.call(saved[item.kind], item.key));
}

export function matchesView(verdict, view) {
  if (view === 'undecided') return verdict == null;
  if (view === 'yes' || view === 'no') return verdict === view;
  return true;
}

export function counts(items, verdictFn) {
  const c = { total: items.length, yes: 0, no: 0, undecided: 0 };
  for (const item of items) {
    const v = verdictFn(item);
    if (v === 'yes') c.yes++;
    else if (v === 'no') c.no++;
    else c.undecided++;
  }
  return c;
}

/** 前後へ(端は反対側へ回る)。今のものが一覧に無ければ先頭 */
export function stepKey(keys, current, d) {
  if (!keys.length) return null;
  const i = keys.indexOf(current);
  if (i < 0) return keys[0];
  return keys[(i + d + keys.length) % keys.length];
}

/**
 * 判定を付けた後に進む先。判定前の一覧(before)で今のものより後ろにあり、判定後の一覧(after)にも残っているもの。
 * 後ろに無ければ after の先頭(全部回ったら頭へ)、after が空なら null
 */
export function nextAfterJudge(before, current, after) {
  if (!after.length) return null;
  const rest = new Set(after);
  const i = before.indexOf(current);
  for (let j = i + 1; j < before.length; j++) {
    if (before[j] !== current && rest.has(before[j])) return before[j];
  }
  const first = after.find(k => k !== current);
  return first !== undefined ? first : after[0];
}

/** content/default-pool.json の形(#1)。presets は名前順、filters / blends は一覧の並び */
export function buildPool(presetItemsList, filterKeys, blendKeys, verdictFn) {
  const yes = (kind, key) => verdictFn({ kind, key }) === 'yes';
  return {
    version: 1,
    presets: presetItemsList.filter(item => yes('presets', item.key)).map(item => item.key).sort(),
    filters: filterKeys.filter(key => yes('filters', key)),
    blends: blendKeys.filter(key => yes('blends', key)),
  };
}

// 計測の数字。候補は候補の計測。FX に無いもの(候補から取り込んだもの)は候補・WebGL 候補の計測を使う
export function metricsFor(item, results) {
  const fx = results.fx || {}, cand = results.candidates || {}, webgl = results.webgl || {};
  if (item.source === 'candidates') return cand[item.key] || null;
  if (item.source === 'webgl') return webgl[item.key] || null;
  return fx[item.key] || cand[item.key] || webgl[item.key] || null;
}

// http.server のディレクトリ一覧から、拡張子 ext のファイル名(拡張子なし)を拾う
export function parseListing(html, ext) {
  const names = [];
  for (const m of String(html).matchAll(/href="([^"?#]+)"/g)) {
    let file;
    try { file = decodeURIComponent(m[1]); } catch (e) { continue; }
    if (file.includes('/') || !file.endsWith(ext) || file.startsWith('.')) continue;
    const name = file.slice(0, -ext.length);
    if (name && !names.includes(name)) names.push(name);
  }
  return names.sort();
}
