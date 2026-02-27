import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Audio Bridge', () => {
  let messageListeners;

  beforeEach(() => {
    messageListeners = [];
    chrome.runtime.onMessage = {
      addListener: vi.fn((cb) => messageListeners.push(cb)),
      removeListener: vi.fn(),
    };

    // Load audio-bridge.js
    const code = readFileSync(resolve(__dirname, '../content/audio-bridge.js'), 'utf-8');
    eval(code);
  });

  it('should register onMessage listener', () => {
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(messageListeners.length).toBe(1);
  });

  it('should relay audioData to window.postMessage', () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    const audioData = { beat: true, bpm: 120, strength: 0.8 };

    messageListeners[0]({ type: 'audioData', data: audioData });

    expect(postMessageSpy).toHaveBeenCalledWith({
      source: 'vjam-fx-bridge',
      type: 'audioData',
      data: audioData,
    }, '*');

    postMessageSpy.mockRestore();
  });

  it('should not relay non-audioData messages', () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');

    messageListeners[0]({ type: 'other', data: {} });

    expect(postMessageSpy).not.toHaveBeenCalled();
    postMessageSpy.mockRestore();
  });

  describe('fullscreen capture pause/resume', () => {
    let fsHandlers;

    beforeEach(() => {
      fsHandlers = [];
      vi.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
        if (event === 'fullscreenchange') fsHandlers.push(handler);
      });
      chrome.runtime.sendMessage = vi.fn().mockResolvedValue({ ok: true });

      // Re-load to pick up the fullscreenchange listener
      messageListeners = [];
      const code = readFileSync(resolve(__dirname, '../content/audio-bridge.js'), 'utf-8');
      eval(code);
    });

    it('should register fullscreenchange listener', () => {
      expect(fsHandlers.length).toBeGreaterThan(0);
    });

    it('should send pauseTabAudio when entering fullscreen', () => {
      Object.defineProperty(document, 'fullscreenElement', { value: document.createElement('div'), configurable: true });
      fsHandlers[0]();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'pauseTabAudio' });
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    });

    it('should send resumeTabAudio when exiting fullscreen', () => {
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      fsHandlers[0]();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'resumeTabAudio' });
    });
  });
});
