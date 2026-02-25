import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load base-preset first (presets depend on it)
const baseCode = readFileSync(resolve(__dirname, '../content/base-preset.js'), 'utf-8');
window.VJamFX = { presets: {} };
eval(baseCode);

const BasePreset = window.VJamFX.BasePreset;

// Load all 10 presets
const PRESET_FILES = [
  { file: 'neon-tunnel.js', id: 'neon-tunnel', name: 'NeonTunnel' },
  { file: 'kaleidoscope.js', id: 'kaleidoscope', name: 'Kaleidoscope' },
  { file: 'mandala.js', id: 'mandala', name: 'Mandala' },
  { file: 'sine-waves.js', id: 'sine-waves', name: 'SineWaves' },
  { file: 'gradient-sweep.js', id: 'gradient-sweep', name: 'GradientSweep' },
  { file: 'moire.js', id: 'moire', name: 'Moire' },
  { file: 'hypnotic.js', id: 'hypnotic', name: 'Hypnotic' },
  { file: 'starfield.js', id: 'starfield', name: 'Starfield' },
  { file: 'rain.js', id: 'rain', name: 'Rain' },
  { file: 'barcode.js', id: 'barcode', name: 'Barcode' },
];

for (const { file } of PRESET_FILES) {
  const code = readFileSync(resolve(__dirname, `../content/presets/${file}`), 'utf-8');
  eval(code);
}

describe('Presets', () => {
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

      it('should have audio property', () => {
        expect(preset.audio).toBeDefined();
        expect(preset.audio).toHaveProperty('bass');
        expect(preset.audio).toHaveProperty('mid');
        expect(preset.audio).toHaveProperty('treble');
        expect(preset.audio).toHaveProperty('rms');
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
