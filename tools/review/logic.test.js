import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  FIXED_PRESETS, presetItems, comboItems, poolSets, verdictOf, isManual, matchesView, counts,
  stepKey, nextAfterJudge, buildPool, metricsFor, parseListing,
} from './logic.js';
import { filterList } from '../curate/logic.js';

const root = resolve(__dirname, '../..');
const defs = JSON.parse(readFileSync(resolve(root, 'tools/bench/filters.json'), 'utf8'));
const pool = { version: 1, presets: ['a', 'c'], filters: ['none', 'invert(1)'], blends: ['screen'] };

describe('一覧', () => {
  it('プリセットは FX + 未取り込みの候補(同じ名前が FX にあれば FX だけ)、名前順', () => {
    const items = presetItems(['b', 'a', 'shared'], ['shared', 'cand']);
    expect(items.map(i => [i.key, i.source])).toEqual([
      ['a', 'fx'], ['b', 'fx'], ['cand', 'candidates'], ['shared', 'fx'],
    ]);
    expect(items.every(i => i.kind === 'presets')).toBe(true);
  });

  it('Filter・Blend は filter 24 種(bench の combos と同じ並び)→ blend 5 種', () => {
    const items = comboItems(filterList(defs), defs.blends);
    expect(items).toHaveLength(24 + 5);
    expect(items[0]).toEqual({ kind: 'filters', key: 'none' });
    expect(items.slice(24).map(i => i.key)).toEqual(['screen', 'lighten', 'difference', 'exclusion', 'color-dodge']);
  });

  it('Filter・Blend で掛ける 3 本は content/presets にある', () => {
    expect(FIXED_PRESETS).toHaveLength(3);
    for (const name of FIXED_PRESETS) expect(existsSync(resolve(root, `content/presets/${name}.js`))).toBe(true);
  });
});

describe('判定', () => {
  const sets = poolSets(pool);
  const p = key => ({ kind: 'presets', key });

  it('初期状態はプールに入っていれば採用、それ以外は未判定', () => {
    expect(verdictOf({ presets: {} }, sets, p('a'))).toBe('yes');
    expect(verdictOf({ presets: {} }, sets, p('b'))).toBe(null);
    expect(verdictOf({ filters: {} }, sets, { kind: 'filters', key: 'invert(1)' })).toBe('yes');
  });

  it('手で付けたものが先', () => {
    const saved = { presets: { a: 'no', b: 'yes' } };
    expect(verdictOf(saved, sets, p('a'))).toBe('no');
    expect(verdictOf(saved, sets, p('b'))).toBe('yes');
    expect(isManual(saved, p('a'))).toBe(true);
    expect(isManual(saved, p('c'))).toBe(false);
  });

  it('プールが読めなければ全部未判定', () => {
    expect(verdictOf({ presets: {} }, poolSets(null), p('a'))).toBe(null);
  });

  it('絞り込みと数', () => {
    expect(matchesView(null, 'undecided')).toBe(true);
    expect(matchesView('yes', 'undecided')).toBe(false);
    expect(matchesView('no', 'no')).toBe(true);
    expect(matchesView('no', 'all')).toBe(true);
    const v = { a: 'yes', b: 'no', c: null, d: null };
    expect(counts(['a', 'b', 'c', 'd'].map(p), i => v[i.key])).toEqual({ total: 4, yes: 1, no: 1, undecided: 2 });
  });
});

describe('進む', () => {
  it('前後は端で反対側へ回る。今のものが無ければ先頭', () => {
    expect(stepKey(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(stepKey(['a', 'b', 'c'], 'a', -1)).toBe('c');
    expect(stepKey(['a', 'b', 'c'], 'x', 1)).toBe('a');
    expect(stepKey([], 'a', 1)).toBe(null);
  });

  it('判定の後は、判定前の一覧で後ろにあって今も残っているものへ', () => {
    // 全部: 次へ
    expect(nextAfterJudge(['a', 'b', 'c'], 'b', ['a', 'b', 'c'])).toBe('c');
    // 未判定だけ: 判定したものは消えるので、その後ろへ
    expect(nextAfterJudge(['a', 'b', 'c'], 'b', ['a', 'c'])).toBe('c');
    // 最後なら頭へ
    expect(nextAfterJudge(['a', 'b', 'c'], 'c', ['a', 'b'])).toBe('a');
    expect(nextAfterJudge(['a', 'b', 'c'], 'c', ['a', 'b', 'c'])).toBe('a');
    // 1 本だけ残っていたらそれ、何も無ければ null
    expect(nextAfterJudge(['a'], 'a', ['a'])).toBe('a');
    expect(nextAfterJudge(['a'], 'a', [])).toBe(null);
  });
});

describe('書き出し', () => {
  it('content/default-pool.json の形。presets は名前順、filter / blend は一覧の並び。候補も入る', () => {
    const items = presetItems(['b', 'a'], ['z-cand']);
    const v = { 'presets:a': 'yes', 'presets:b': 'no', 'presets:z-cand': 'yes',
      'filters:none': 'yes', 'filters:invert(1)': 'yes', 'blends:screen': 'yes', 'blends:difference': 'yes' };
    const out = buildPool(items, ['invert(1)', 'none', 'blur(3px)'], ['screen', 'difference', 'lighten'], i => v[i.kind + ':' + i.key] || null);
    expect(out).toEqual({ version: 1, presets: ['a', 'z-cand'], filters: ['invert(1)', 'none'], blends: ['screen', 'difference'] });
  });

  it('何も変えなければ今の default-pool.json と同じになる', () => {
    const current = JSON.parse(readFileSync(resolve(root, 'content/default-pool.json'), 'utf8'));
    const sets = poolSets(current);
    const items = presetItems(current.presets, []);
    const out = buildPool(items, filterList(defs), defs.blends, i => verdictOf({}, sets, i));
    expect(out).toEqual(current);
  });
});

describe('参考情報', () => {
  it('計測は FX → 候補の順で探す(候補は候補だけ)', () => {
    const results = { fx: { a: { fps: 1 } }, candidates: { a: { fps: 2 }, b: { fps: 3 } } };
    expect(metricsFor({ key: 'a', source: 'fx' }, results)).toEqual({ fps: 1 });
    expect(metricsFor({ key: 'b', source: 'fx' }, results)).toEqual({ fps: 3 });
    expect(metricsFor({ key: 'a', source: 'candidates' }, results)).toEqual({ fps: 2 });
    expect(metricsFor({ key: 'x', source: 'fx' }, { fx: null, candidates: null })).toBe(null);
  });

  it('http.server のディレクトリ一覧から拡張子で拾う', () => {
    const html = `<ul>
<li><a href="aurora.js">aurora.js</a></li>
<li><a href="neon%20sign.js">neon sign.js</a></li>
<li><a href="sub/">sub/</a></li>
<li><a href="readme.md">readme.md</a></li>
<li><a href=".hidden.js">.hidden.js</a></li>
<li><a href="aurora.js">dup</a></li>
</ul>`;
    expect(parseListing(html, '.js')).toEqual(['aurora', 'neon sign']);
    expect(parseListing('', '.json')).toEqual([]);
  });
});
