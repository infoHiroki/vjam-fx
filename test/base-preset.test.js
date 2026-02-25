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
});
