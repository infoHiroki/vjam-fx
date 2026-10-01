import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  DEFAULT_THRESHOLDS, filterList, filterLabel, reactScore, presetChecks, summarizeCombos, cellKey,
  comboChecks, isSelected, buildPool, sortRows, matchesView,
} from './logic.js';

const root = resolve(__dirname, '../..');
const defs = JSON.parse(readFileSync(resolve(root, 'tools/bench/filters.json'), 'utf8'));
const engineSrc = readFileSync(resolve(root, 'content/content.js'), 'utf8');

const good = { recLight: 0.8, recDark: 0.7, fps: 50, msPerFrame: 3, cov: 0.2,
  energyGain: 0.1, motionGain: 0.4, beatLum: 0.1, beatMotion: 0.2, flash: 0, errors: [] };

describe('filters.json', () => {
  it('単体フィルタがエンジンの FILTER_VALUES と同じ', () => {
    const body = engineSrc.match(/const FILTER_VALUES = (\{[\s\S]*?\});/)[1];
    expect(defs.single).toEqual(new Function(`return ${body}`)());
  });

  it('blend がエンジンの VALID_BLEND_MODES / LIGHT_PAGE_BLEND_MODES と同じ', () => {
    const arr = name => new Function(`return ${engineSrc.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))[1]}`)();
    expect(defs.blends).toEqual(arr('VALID_BLEND_MODES'));
    expect(defs.lightPageBlends).toEqual(arr('LIGHT_PAGE_BLEND_MODES'));
  });

  it('filterList は none + 単体 8 + 複合(重複除く)', () => {
    const list = filterList(defs);
    expect(list[0]).toBe('none');
    expect(list.slice(1, 9)).toEqual(Object.values(defs.single));
    expect(new Set(list).size).toBe(list.length);
    expect(list).toHaveLength(1 + 8 + 15); // saturate(2.5) が単体と複合で重なる
  });

  it('filterLabel', () => {
    expect(filterLabel('none', defs)).toBe('なし');
    expect(filterLabel('invert(1)', defs)).toBe('invert — invert(1)');
    expect(filterLabel('saturate(2) contrast(1.3)', defs)).toBe('saturate(2) contrast(1.3)');
  });
});

describe('presetChecks', () => {
  it('しきい値の初期値が bench_fx.py と同じ', () => {
    const py = readFileSync(resolve(root, 'tools/bench/bench_fx.py'), 'utf8');
    expect(JSON.parse(py.match(/^DEFAULT_THRESHOLDS = (\{.*\})$/m)[1])).toEqual(DEFAULT_THRESHOLDS);
  });

  it('全部満たせば ok', () => {
    expect(presetChecks(good, DEFAULT_THRESHOLDS))
      .toEqual({ recLight: true, recDark: true, fps: true, ms: true, react: true, flash: true, ok: true });
  });

  it('1 つでも欠けたら ok でない', () => {
    expect(presetChecks({ ...good, recDark: 0.1 }, DEFAULT_THRESHOLDS)).toMatchObject({ recDark: false, ok: false });
    expect(presetChecks({ ...good, fps: 10 }, DEFAULT_THRESHOLDS)).toMatchObject({ fps: false, ok: false });
    expect(presetChecks({ ...good, msPerFrame: 12 }, DEFAULT_THRESHOLDS)).toMatchObject({ ms: false, ok: false });
  });

  it('反応は増えた分(減ったら 0)+ ビート同期の合計', () => {
    expect(reactScore(good)).toBeCloseTo(0.8);
    const deaf = { ...good, energyGain: -0.2, motionGain: -0.3, beatLum: 0.05, beatMotion: 0.2 };
    expect(reactScore(deaf)).toBeCloseTo(0.25);
    expect(presetChecks(deaf, DEFAULT_THRESHOLDS)).toMatchObject({ react: false, ok: false });
  });

  it('点滅系は数字が良くても提案しない(flash の無い古い結果は見ない)', () => {
    expect(presetChecks({ ...good, flash: 2 }, DEFAULT_THRESHOLDS)).toMatchObject({ flash: false, ok: false });
    const { flash, ...old } = good;
    expect(presetChecks(old, DEFAULT_THRESHOLDS)).toMatchObject({ flash: true, ok: true });
  });

  it('エラーのプリセットは提案しない', () => {
    expect(presetChecks({ error: 'boom' }, DEFAULT_THRESHOLDS).ok).toBe(false);
    expect(presetChecks({ ...good, errors: ['TypeError'] }, DEFAULT_THRESHOLDS).ok).toBe(false);
  });
});

describe('summarizeCombos', () => {
  const blends = ['screen', 'difference'];
  const filters = ['none', 'invert(1)'];
  const rows = [];
  for (const preset of ['a', 'b']) for (const page of ['light', 'dark']) for (const blend of blends) for (const filter of filters) {
    const rec = (preset === 'a' ? 0.8 : 0.4) - (filter === 'none' ? 0 : 0.2) - (blend === 'screen' ? 0 : 0.1) - (page === 'light' ? 0.05 : 0);
    rows.push({ preset, page, blend, filter, rec, fps: preset === 'a' ? 60 : 20, img: 'x.jpg' });
  }
  const data = { blends, filters, reps: ['a', 'b'], rows };
  const light = ['difference'];

  it('セルは代表の平均', () => {
    const s = summarizeCombos(data, light);
    expect(s.cells[cellKey('dark', 'screen', 'none')].rec).toBeCloseTo(0.6);
    expect(s.cells[cellKey('dark', 'screen', 'none')].rows).toHaveLength(2);
    expect(s.cells[cellKey('dark', 'screen', 'none')].fps).toBe(40);
  });

  it('rep を渡すとその 1 本', () => {
    const s = summarizeCombos(data, light, 'a');
    expect(s.cells[cellKey('dark', 'screen', 'none')].rec).toBeCloseTo(0.8);
  });

  it('filter の白は白で使う blend だけ、暗は全部', () => {
    const f = summarizeCombos(data, light).filters['none'];
    expect(f.recLight).toBeCloseTo(0.6 - 0.1 - 0.05);
    expect(f.recDark).toBeCloseTo(0.6 - 0.05);
  });

  it('blend はフィルタなしの行。白で使わない blend の白は null', () => {
    const s = summarizeCombos(data, light);
    expect(s.blends.screen.recLight).toBeNull();
    expect(s.blends.screen.recDark).toBeCloseTo(0.6);
    expect(s.blends.difference.recLight).toBeCloseTo(0.6 - 0.1 - 0.05);
  });

  it('comboChecks: 白が null なら白は見ない', () => {
    expect(comboChecks({ recLight: null, recDark: 0.7, fps: 45 }, DEFAULT_THRESHOLDS).ok).toBe(true);
    expect(comboChecks({ recLight: 0.1, recDark: 0.7, fps: 45 }, DEFAULT_THRESHOLDS).ok).toBe(false);
    expect(comboChecks({ recLight: 0.7, recDark: 0.7, fps: 20 }, DEFAULT_THRESHOLDS).ok).toBe(false);
    expect(comboChecks(undefined, DEFAULT_THRESHOLDS).ok).toBe(false);
  });
});

describe('選択と書き出し', () => {
  it('手で切り替えたものが提案より優先', () => {
    expect(isSelected({}, 'a', true)).toBe(true);
    expect(isSelected({ a: false }, 'a', true)).toBe(false);
    expect(isSelected({ a: true }, 'a', false)).toBe(true);
  });

  it('default-pool.json の形', () => {
    const pool = buildPool({ presets: ['b', 'a'], filters: ['saturate(2.5)', 'none'], blends: ['screen', 'difference'] });
    expect(pool).toEqual({ version: 1, presets: ['a', 'b'], filters: ['saturate(2.5)', 'none'], blends: ['screen', 'difference'] });
  });
});

describe('一覧', () => {
  const rows = [
    { name: 'b', source: 'fx', r: { ...good, fps: 30 } },
    { name: 'a', source: 'candidates', r: { ...good, fps: 50 } },
    { name: 'c', source: 'fx', r: { error: 'x' } },
  ];

  it('並び替え(エラーは最後)', () => {
    expect(sortRows(rows, 'fps', true).map(r => r.name)).toEqual(['a', 'b', 'c']);
    expect(sortRows(rows, 'fps', false).map(r => r.name)).toEqual(['b', 'a', 'c']);
    expect(sortRows(rows, 'name', false).map(r => r.name)).toEqual(['a', 'b', 'c']);
    expect(sortRows(rows, 'react', true).map(r => r.name)).toEqual(['a', 'b', 'c']);
  });

  it('絞り込み', () => {
    const view = { source: 'all', onlyPass: false, onlySelected: false, query: '' };
    const ok = { ok: true }, ng = { ok: false };
    expect(matchesView(rows[0], view, ng, false)).toBe(true);
    expect(matchesView(rows[0], { ...view, source: 'candidates' }, ok, true)).toBe(false);
    expect(matchesView(rows[0], { ...view, onlyPass: true }, ng, true)).toBe(false);
    expect(matchesView(rows[0], { ...view, onlySelected: true }, ok, false)).toBe(false);
    expect(matchesView(rows[0], { ...view, query: ' B ' }, ok, true)).toBe(true);
    expect(matchesView(rows[0], { ...view, query: 'zz' }, ok, true)).toBe(false);
  });
});
