import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { Script } from 'vm';

// tools/bench/candidates-webgl(VJam 本体の WebGL のプリセットを FX 形式にした候補。#42)
// 出荷はしない。選び直し画面と計測で読むので、構文と登録の形を見る
const dir = resolve(__dirname, '../tools/bench/candidates-webgl');
const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const baseCode = readFileSync(resolve(__dirname, '../content/base-preset.js'), 'utf-8');

describe('WebGL candidates', () => {
  beforeAll(() => {
    window.VJamFX = { presets: {} };
    eval(baseCode);
  });

  it('has the converted presets', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  describe.each(files)('%s', (file) => {
    const name = file.slice(0, -3);
    const code = readFileSync(resolve(dir, file), 'utf-8');

    it('parses as a classic script (IIFE, no import / export)', () => {
      expect(() => new Script(code, { filename: file })).not.toThrow();
      expect(code.startsWith("(function() {\n'use strict';\nconst BasePreset = window.VJamFX.BasePreset;")).toBe(true);
      expect(code.trimEnd().endsWith('})();')).toBe(true);
      expect(code).not.toMatch(/^\s*(import|export)\b/m);
    });

    it('registers itself under the file name as a BasePreset with a WEBGL canvas', () => {
      eval(code);
      const Cls = window.VJamFX.presets[name];
      expect(typeof Cls).toBe('function');
      expect(Cls.prototype instanceof window.VJamFX.BasePreset).toBe(true);
      expect(typeof Cls.prototype.setup).toBe('function');
      expect(code).toMatch(/createCanvas\([^;]*WEBGL/);
    });
  });
});
