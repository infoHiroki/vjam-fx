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
});
