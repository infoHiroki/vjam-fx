import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

// Load base-preset first (presets depend on it)
const baseCode = readFileSync(resolve(__dirname, '../content/base-preset.js'), 'utf-8');
window.VJamFX = { presets: {} };
eval(baseCode);

const BasePreset = window.VJamFX.BasePreset;

// Auto-discover all preset files
const presetsDir = resolve(__dirname, '../content/presets');
const PRESET_FILES = readdirSync(presetsDir)
  .filter(f => f.endsWith('.js'))
  .map(f => ({
    file: f,
    id: f.replace('.js', ''),
    name: f.replace('.js', '').split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(''),
  }));

for (const { file } of PRESET_FILES) {
  const code = readFileSync(resolve(presetsDir, file), 'utf-8');
  eval(code);
}

describe('Presets', () => {
  it(`should have all ${PRESET_FILES.length} presets loaded`, () => {
    expect(Object.keys(window.VJamFX.presets).length).toBe(PRESET_FILES.length);
  });

  for (const { id, name } of PRESET_FILES) {
    describe(name, () => {
      let Cls;
      let preset;
      let container;

      beforeEach(() => {
        Cls = window.VJamFX.presets[id];
        preset = new Cls();
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        Object.defineProperty(container, 'clientWidth', { value: 800 });
        Object.defineProperty(container, 'clientHeight', { value: 600 });
        document.body.appendChild(container);
      });

      afterEach(() => {
        preset.destroy();
        container.remove();
      });

      it('should be registered in VJamFX.presets', () => {
        expect(Cls).toBeDefined();
      });

      it('should extend BasePreset', () => {
        expect(preset).toBeInstanceOf(BasePreset);
      });

      it('should have audio property with all 5 fields', () => {
        expect(preset.audio).toBeDefined();
        expect(preset.audio).toHaveProperty('bass');
        expect(preset.audio).toHaveProperty('mid');
        expect(preset.audio).toHaveProperty('treble');
        expect(preset.audio).toHaveProperty('rms');
        expect(preset.audio).toHaveProperty('strength');
      });

      it('should set up with a container', () => {
        expect(() => preset.setup(container)).not.toThrow();
        expect(preset.p5).not.toBeNull();
      });

      it('should accept audio data via updateAudio', () => {
        const audioData = { bass: 0.5, mid: 0.3, treble: 0.8, rms: 0.4, strength: 0.6 };
        preset.updateAudio(audioData);
        expect(preset.audio.bass).toBe(0.5);
        expect(preset.audio.mid).toBe(0.3);
        expect(preset.audio.treble).toBe(0.8);
        expect(preset.audio.rms).toBe(0.4);
        expect(preset.audio.strength).toBe(0.6);
      });

      it('should handle onBeat without errors', () => {
        preset.setup(container);
        expect(() => preset.onBeat(0.8)).not.toThrow();
      });

      it('should clean up on destroy', () => {
        preset.setup(container);
        preset.destroy();
        expect(preset.p5).toBeNull();
      });

      it('should handle updateAudio with missing fields', () => {
        preset.updateAudio({});
        expect(preset.audio.bass).toBe(0);
      });
    });
  }
});
