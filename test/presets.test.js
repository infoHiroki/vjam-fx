import { describe, it, expect, beforeEach } from 'vitest';
import { BasePreset } from '../content/base-preset.js';

// Import all presets
import { NeonTunnelPreset } from '../content/presets/neon-tunnel.js';
import { KaleidoscopePreset } from '../content/presets/kaleidoscope.js';
import { MandalaPreset } from '../content/presets/mandala.js';
import { SineWavesPreset } from '../content/presets/sine-waves.js';
import { GradientSweepPreset } from '../content/presets/gradient-sweep.js';
import { MoirePreset } from '../content/presets/moire.js';
import { HypnoticPreset } from '../content/presets/hypnotic.js';
import { StarfieldPreset } from '../content/presets/starfield.js';
import { RainPreset } from '../content/presets/rain.js';
import { BarcodePreset } from '../content/presets/barcode.js';

const PRESETS = [
  { name: 'NeonTunnel', Cls: NeonTunnelPreset },
  { name: 'Kaleidoscope', Cls: KaleidoscopePreset },
  { name: 'Mandala', Cls: MandalaPreset },
  { name: 'SineWaves', Cls: SineWavesPreset },
  { name: 'GradientSweep', Cls: GradientSweepPreset },
  { name: 'Moire', Cls: MoirePreset },
  { name: 'Hypnotic', Cls: HypnoticPreset },
  { name: 'Starfield', Cls: StarfieldPreset },
  { name: 'Rain', Cls: RainPreset },
  { name: 'Barcode', Cls: BarcodePreset },
];

describe('Presets', () => {
  for (const { name, Cls } of PRESETS) {
    describe(name, () => {
      let preset;
      let container;

      beforeEach(() => {
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
