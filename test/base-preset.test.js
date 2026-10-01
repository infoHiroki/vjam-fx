import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load IIFE script — it registers on window.VJamFX
const code = readFileSync(resolve(__dirname, '../content/base-preset.js'), 'utf-8');
eval(code);
const BasePreset = window.VJamFX.BasePreset;

describe('BasePreset', () => {
  let preset;

  beforeEach(() => {
    preset = new BasePreset();
  });

  it('should initialize with null p5 and empty params', () => {
    expect(preset.p5).toBeNull();
    expect(preset.params).toEqual({});
  });

  it('should set params via setParam', () => {
    preset.setParam('speed', 2);
    expect(preset.params.speed).toBe(2);
  });

  it('should have setup/updateAudio/onBeat as no-op methods', () => {
    expect(() => preset.setup(document.createElement('div'))).not.toThrow();
    expect(() => preset.updateAudio({ bass: 0.5 })).not.toThrow();
    expect(() => preset.onBeat(0.8)).not.toThrow();
  });

  it('should destroy p5 instance and null reference', () => {
    preset.p5 = { remove: vi.fn() };
    preset.destroy();
    expect(preset.p5).toBeNull();
  });

  it('should handle destroy when p5 is already null', () => {
    expect(() => preset.destroy()).not.toThrow();
  });

  // VJam 本体の BasePreset と同じ: static paramDefs の default を params に入れる
  describe('paramDefs', () => {
    it('hydrates params from paramDefs defaults', () => {
      class P extends BasePreset {
        static paramDefs = [
          { key: 'speed', default: 1.5 },
          { key: 'count', default: 0 },
        ];
      }
      expect(new P().params).toEqual({ speed: 1.5, count: 0 });
    });

    it('skips defs without key or default', () => {
      class P extends BasePreset {
        static paramDefs = [null, { default: 3 }, { key: 'noDefault' }, { key: 'size', default: 2 }];
      }
      expect(new P().params).toEqual({ size: 2 });
    });

    it('lets the subclass constructor override the defaults', () => {
      class P extends BasePreset {
        static paramDefs = [{ key: 'speed', default: 1 }, { key: 'size', default: 2 }];
        constructor() {
          super();
          this.params.speed = 3;
        }
      }
      expect(new P().params).toEqual({ speed: 3, size: 2 });
    });

    it('does nothing for presets without paramDefs', () => {
      class P extends BasePreset {
        constructor() {
          super();
          this.params = { layers: 5 };
        }
      }
      expect(new P().params).toEqual({ layers: 5 });
      expect(new (class extends BasePreset {})().params).toEqual({});
    });
  });
});
