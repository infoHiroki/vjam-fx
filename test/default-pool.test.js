import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

// デフォルトプール(Next / Auto / Rnd の抽選対象。形式は #1、中身は #4 の選択画面で選んだ決定版 tools/curate/selected-pool.json)
const pool = JSON.parse(readFileSync(resolve(__dirname, '../content/default-pool.json'), 'utf-8'));
const selected = JSON.parse(readFileSync(resolve(__dirname, '../tools/curate/selected-pool.json'), 'utf-8'));
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

  it('is the curated pool (tools/curate/selected-pool.json)', () => {
    expect(pool).toEqual(selected);
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
