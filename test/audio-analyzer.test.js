import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load IIFE script
const code = readFileSync(resolve(__dirname, '../content/audio-analyzer.js'), 'utf-8');
eval(code);
const AudioAnalyzer = window.VJamFX.AudioAnalyzer;

describe('AudioAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new AudioAnalyzer();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize as not started', () => {
      expect(analyzer.started).toBe(false);
    });

    it('should have default tempo of 120', () => {
      const data = analyzer.getAudioData();
      expect(data.bpm).toBe(120);
    });
  });

  describe('getAudioData (not started)', () => {
    it('should return zeroed data when not started', () => {
      const data = analyzer.getAudioData();
      expect(data.beat).toBe(false);
      expect(data.strength).toBe(0);
      expect(data.rms).toBe(0);
      expect(data.bass).toBe(0);
      expect(data.mid).toBe(0);
      expect(data.treble).toBe(0);
    });
  });

  describe('start', () => {
    it('should request microphone access and set started=true', async () => {
      const result = await analyzer.start();
      expect(result).toBe(true);
      expect(analyzer.started).toBe(true);
    });

    it('should not start twice', async () => {
      await analyzer.start();
      const result = await analyzer.start();
      expect(result).toBe(true);
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    });

    it('should handle microphone denial gracefully', async () => {
      navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('denied'));
      const result = await analyzer.start();
      expect(result).toBe(false);
      expect(analyzer.started).toBe(false);
    });
  });

  describe('getAudioData (started)', () => {
    beforeEach(async () => {
      await analyzer.start();
    });

    it('should return audio data object with correct shape', () => {
      const data = analyzer.getAudioData();
      expect(data).toHaveProperty('beat');
      expect(data).toHaveProperty('bpm');
      expect(data).toHaveProperty('strength');
      expect(data).toHaveProperty('rms');
      expect(data).toHaveProperty('bass');
      expect(data).toHaveProperty('mid');
      expect(data).toHaveProperty('treble');
    });

    it('should return normalized values (0-1 range) for bands', () => {
      const data = analyzer.getAudioData();
      expect(data.bass).toBeGreaterThanOrEqual(0);
      expect(data.bass).toBeLessThanOrEqual(1);
      expect(data.mid).toBeGreaterThanOrEqual(0);
      expect(data.mid).toBeLessThanOrEqual(1);
      expect(data.treble).toBeGreaterThanOrEqual(0);
      expect(data.treble).toBeLessThanOrEqual(1);
    });
  });

  describe('resume', () => {
    it('should not throw when context is null', () => {
      expect(() => analyzer.resume()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      await analyzer.start();
      analyzer.destroy();
      expect(analyzer.started).toBe(false);
    });

    it('should handle destroy when not started', () => {
      expect(() => analyzer.destroy()).not.toThrow();
    });
  });
});
