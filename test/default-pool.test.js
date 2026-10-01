import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

// デフォルトプール(Next / Auto / Rnd の抽選対象。形式は #1、中身はあとで #4 の選択画面の書き出しで置き換える)
const pool = JSON.parse(readFileSync(resolve(__dirname, '../content/default-pool.json'), 'utf-8'));
const presetFiles = readdirSync(resolve(__dirname, '../content/presets'))
  .filter(f => f.endsWith('.js'))
  .map(f => f.slice(0, -3));

describe('content/default-pool.json', () => {
  it('has the format of #1', () => {
    expect(pool.version).toBe(1);
    expect(Array.isArray(pool.presets)).toBe(true);
    expect(Array.isArray(pool.filters)).toBe(true);
    expect(Array.isArray(pool.blends)).toBe(true);
  });

  it('lists only existing presets, without duplicates', () => {
    for (const id of pool.presets) expect(presetFiles).toContain(id);
    expect(new Set(pool.presets).size).toBe(pool.presets.length);
  });

  it('starts with all presets', () => {
    expect(pool.presets.slice().sort()).toEqual(presetFiles.slice().sort());
  });

  it('uses the VJam compound filters without invert (and nothing heavy)', () => {
    expect(pool.filters.length).toBe(14);
    for (const f of pool.filters) {
      expect(f).not.toMatch(/invert|blur/);
      expect(f).toMatch(/^([a-z-]+\([^)]*\)\s*)+$/);
    }
  });

  it('uses screen / lighten / difference / exclusion', () => {
    expect(pool.blends).toEqual(['screen', 'lighten', 'difference', 'exclusion']);
  });
});
