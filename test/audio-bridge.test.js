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
    const sendResponse = vi.fn();

    messageListeners[0]({ type: 'audioData', data: audioData }, {}, sendResponse);

    expect(postMessageSpy).toHaveBeenCalledWith({
      source: 'vjam-fx-bridge',
      type: 'audioData',
      data: audioData,
    }, '*');
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });

    postMessageSpy.mockRestore();
  });

  it('should not relay non-audioData messages', () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    const sendResponse = vi.fn();

    messageListeners[0]({ type: 'other', data: {} }, {}, sendResponse);

    expect(postMessageSpy).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
    postMessageSpy.mockRestore();
  });

  // 重いプリセット(#40): エンジン → bridge → SW
  describe('heavy presets', () => {
    let windowListeners;

    beforeEach(() => {
      // eval した bridge の window の message リスナーだけを拾い直す
      windowListeners = [];
      const add = vi.spyOn(window, 'addEventListener').mockImplementation((type, cb) => {
        if (type === 'message') windowListeners.push(cb);
      });
      eval(readFileSync(resolve(__dirname, '../content/audio-bridge.js'), 'utf-8'));
      add.mockRestore();
      chrome.runtime.sendMessage = vi.fn().mockResolvedValue({ ok: true });
    });

    const fromEngine = (data) => windowListeners[0]({ source: window, data: { source: 'vjam-fx-engine', ...data } });

    it('relays a heavy preset to the SW', () => {
      fromEngine({ type: 'heavyPreset', name: 'film-grain', fps: 5.6, replacement: 'aurora' });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'heavyPreset', name: 'film-grain', fps: 5.6, replacement: 'aurora' });
    });

    it('ignores messages that are not from this window', () => {
      windowListeners[0]({ source: {}, data: { source: 'vjam-fx-engine', type: 'heavyPreset', name: 'x', fps: 1 } });
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('asks the SW to load a preset and tells the engine when it is loaded', async () => {
      const postMessageSpy = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
      fromEngine({ type: 'injectPreset', name: 'aurora' });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'injectPreset', name: 'aurora' });
      await vi.waitFor(() => expect(postMessageSpy).toHaveBeenCalledWith(
        { source: 'vjam-fx-bridge', type: 'presetInjected', name: 'aurora' }, '*'));
      postMessageSpy.mockRestore();
    });

    it('does not tell the engine when the SW could not load it', async () => {
      chrome.runtime.sendMessage = vi.fn().mockResolvedValue({ ok: false });
      const postMessageSpy = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
      fromEngine({ type: 'injectPreset', name: 'aurora' });
      await new Promise(r => setTimeout(r, 0));
      expect(postMessageSpy).not.toHaveBeenCalled();
      postMessageSpy.mockRestore();
    });
  });
});
