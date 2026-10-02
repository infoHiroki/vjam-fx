import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

// デフォルトプール(Next / Auto / Rnd の抽選対象。形式は #1、中身は #4 の選択画面で選んだ決定版 tools/curate/selected-pool.json)
const pool = JSON.parse(readFileSync(resolve(__dirname, '../content/default-pool.json'), 'utf-8'));
const selected = JSON.parse(readFileSync(resolve(__dirname, '../tools/curate/selected-pool.json'), 'utf-8'));
// 人が選び直し画面(tools/review.html)で選んだ結果(#35 の 173 本に WebGL 158 本を足したもの。#44)
const userPool = JSON.parse(readFileSync(resolve(__dirname, '../tools/curate/user-pool-2026-10-02-webgl.json'), 'utf-8'));
// VJam 本体(~/Dev/vjam/src/main.js)の COMPOUND_FILTERS から invert を含む 2 種を除いたもの(並びも VJam と同じ)。
// invert はオーバーレイの黒を白にしてページを潰すので外す
const VJAM_FILTERS_WITHOUT_INVERT = [
  'saturate(2.5)',
  'saturate(2)',
  'saturate(3)',
  'hue-rotate(180deg) saturate(2)',
  'hue-rotate(120deg) saturate(2)',
  'hue-rotate(90deg) saturate(2)',
  'hue-rotate(60deg) saturate(2.5)',
  'hue-rotate(30deg) saturate(2)',
  'hue-rotate(240deg) saturate(2)',
  'hue-rotate(270deg) saturate(2)',
  'saturate(2.5) contrast(1.3)',
  'saturate(2) contrast(1.3)',
  'saturate(3) contrast(1.5)',
  'hue-rotate(180deg) contrast(1.5)',
];
const presetFiles = readdirSync(resolve(__dirname, '../content/presets'))
  .filter(f => f.endsWith('.js'))
  .map(f => f.slice(0, -3));
const usesWebgl = (id) => /createCanvas\([^;]*WEBGL/.test(readFileSync(resolve(__dirname, `../content/presets/${id}.js`), 'utf-8'));

describe('content/default-pool.json', () => {
  it('has the format of #1', () => {
    expect(pool.version).toBe(1);
    expect(Array.isArray(pool.presets)).toBe(true);
    expect(Array.isArray(pool.filters)).toBe(true);
    expect(Array.isArray(pool.blends)).toBe(true);
  });

  it('is the curated pool (tools/curate/selected-pool.json)', () => {
    expect(pool).toEqual(selected);
  });

  // 選び直し画面で選んだ 331 本。neon-sign は入れない(看板の単語に成人向け・罵倒語・薬物が多いので、#35 で取り込まないことにした)
  it('has the 331 presets that were picked in the review screen (without neon-sign)', () => {
    expect(pool.presets.length).toBe(331);
    expect(pool.presets).not.toContain('neon-sign');
    expect(pool.presets).toEqual(userPool.presets);
  });

  // 2D の 173 本(#35)+ VJam 本体の WebGL 158 本(#44)
  it('has the 173 2D presets and 158 WebGL ones', () => {
    const webgl = pool.presets.filter(usesWebgl);
    expect(webgl.length).toBe(158);
    expect(pool.presets.length - webgl.length).toBe(173);
  });

  it('uses the VJam compound filters without invert, in the VJam order (all pool files agree)', () => {
    expect(pool.filters).toEqual(VJAM_FILTERS_WITHOUT_INVERT);
    expect(selected.filters).toEqual(VJAM_FILTERS_WITHOUT_INVERT);
    expect(userPool.filters).toEqual(VJAM_FILTERS_WITHOUT_INVERT);
  });

  it('lists only existing presets, without duplicates', () => {
    for (const id of pool.presets) expect(presetFiles).toContain(id);
    expect(new Set(pool.presets).size).toBe(pool.presets.length);
  });

  it('uses CSS filters without invert / blur (none = no filter)', () => {
    expect(new Set(pool.filters).size).toBe(pool.filters.length);
    for (const f of pool.filters) {
      expect(f).not.toMatch(/invert|blur/);
      expect(f).toMatch(/^(none|([a-z-]+\([^)]*\)\s*)+)$/);
    }
  });

  it('uses only blends that FX supports, without duplicates', () => {
    expect(new Set(pool.blends).size).toBe(pool.blends.length);
    for (const b of pool.blends) expect(['screen', 'lighten', 'difference', 'exclusion', 'color-dodge']).toContain(b);
  });
});
