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

  // VJam 本体と同じ: WebGL のコンテキストを remove の前に WEBGL_lose_context で手放す(#42)
  describe('WebGL context', () => {
    function canvasWith(contexts) {
      return { getContext: vi.fn(type => contexts[type] || null) };
    }
    function glWithLoseContext() {
      const ext = { loseContext: vi.fn() };
      return { ext, gl: { getExtension: vi.fn(name => name === 'WEBGL_lose_context' ? ext : null) } };
    }

    it('loses the WebGL2 context before p5.remove()', () => {
      const { ext, gl } = glWithLoseContext();
      const order = [];
      ext.loseContext.mockImplementation(() => order.push('lose'));
      const p5 = { canvas: canvasWith({ webgl2: gl }), remove: vi.fn(() => order.push('remove')) };
      preset.p5 = p5;
      preset.destroy();
      expect(gl.getExtension).toHaveBeenCalledWith('WEBGL_lose_context');
      expect(order).toEqual(['lose', 'remove']);
      expect(preset.p5).toBeNull();
    });

    it('loses a WebGL1 context too', () => {
      const { ext, gl } = glWithLoseContext();
      preset.p5 = { canvas: canvasWith({ webgl: gl }), remove: vi.fn() };
      preset.destroy();
      expect(ext.loseContext).toHaveBeenCalledTimes(1);
    });

    it('does nothing extra for a 2D canvas (getContext returns null for WebGL)', () => {
      const remove = vi.fn();
      const canvas = canvasWith({});
      preset.p5 = { canvas, remove };
      preset.destroy();
      expect(remove).toHaveBeenCalledTimes(1);
      expect(preset.p5).toBeNull();
    });

    it('still removes p5 when getContext throws or the extension is missing', () => {
      const remove = vi.fn();
      preset.p5 = { canvas: { getContext: () => { throw new Error('lost'); } }, remove };
      expect(() => preset.destroy()).not.toThrow();
      expect(remove).toHaveBeenCalledTimes(1);

      const remove2 = vi.fn();
      preset.p5 = { canvas: canvasWith({ webgl2: { getExtension: () => null } }), remove: remove2 };
      expect(() => preset.destroy()).not.toThrow();
      expect(remove2).toHaveBeenCalledTimes(1);
    });

    it('drops the shader (it belongs to the lost context)', () => {
      preset._shader = { program: 1 };
      preset.p5 = { canvas: canvasWith({}), remove: vi.fn() };
      preset.destroy();
      expect(preset._shader).toBeNull();
    });
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
