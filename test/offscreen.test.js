import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Offscreen Document', () => {
  let messageListeners;

  beforeEach(() => {
    messageListeners = [];
    chrome.runtime.onMessage = {
      addListener: vi.fn((cb) => messageListeners.push(cb)),
      removeListener: vi.fn(),
    };
    chrome.runtime.sendMessage = vi.fn();

    // Load offscreen.js
    const code = readFileSync(resolve(__dirname, '../offscreen/offscreen.js'), 'utf-8');
    eval(code);
  });

  it('should register onMessage listener', () => {
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(messageListeners.length).toBe(1);
  });

  it('should handle startCapture message (returns async)', () => {
    const sendResponse = vi.fn();
    const result = messageListeners[0](
      { type: 'startCapture', streamId: 'fake-stream-id' },
      {},
      sendResponse,
    );
    expect(result).toBe(true); // async
  });

  it('should handle stopCapture message', () => {
    const sendResponse = vi.fn();
    messageListeners[0](
      { type: 'stopCapture' },
      {},
      sendResponse,
    );
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it('should ignore unknown message types', () => {
    const sendResponse = vi.fn();
    const result = messageListeners[0](
      { type: 'unknown' },
      {},
      sendResponse,
    );
    expect(result).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
