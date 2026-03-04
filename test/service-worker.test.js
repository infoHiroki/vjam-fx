import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// We test the service worker logic by evaluating it in a simulated environment
// Service worker uses chrome.webNavigation, chrome.tabs, chrome.runtime, chrome.scripting

describe('Service Worker', () => {
  let messageListeners;
  let navigationListeners;
  let tabRemoveListeners;

  beforeEach(() => {
    messageListeners = [];
    navigationListeners = [];
    tabRemoveListeners = [];

    // In-memory store for chrome.storage.session mock
    const sessionStore = {};
    chrome.storage.session = {
      get: vi.fn((key) => {
        if (key === null) return Promise.resolve({ ...sessionStore });
        if (typeof key === 'string') {
          const result = {};
          if (sessionStore[key] !== undefined) result[key] = sessionStore[key];
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      }),
      set: vi.fn((obj) => {
        Object.assign(sessionStore, obj);
        return Promise.resolve();
      }),
      remove: vi.fn((key) => {
        delete sessionStore[key];
        return Promise.resolve();
      }),
    };

    // Reset chrome mocks for service worker
    chrome.runtime.onMessage = {
      addListener: vi.fn((cb) => messageListeners.push(cb)),
      removeListener: vi.fn(),
    };
    chrome.runtime.getContexts = vi.fn().mockResolvedValue([]);
    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({ ok: true });
    chrome.webNavigation = {
      onCompleted: {
        addListener: vi.fn((cb) => navigationListeners.push(cb)),
      },
    };
    chrome.tabs.onRemoved = {
      addListener: vi.fn((cb) => tabRemoveListeners.push(cb)),
    };
    chrome.tabs.get = vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com' });
    chrome.tabs.sendMessage = vi.fn().mockResolvedValue(undefined);
    chrome.scripting.executeScript.mockClear();
    chrome.scripting.executeScript.mockResolvedValue([{ result: true }]);
    chrome.tabCapture = {
      getMediaStreamId: vi.fn().mockResolvedValue('fake-stream-id'),
    };
    chrome.offscreen = {
      createDocument: vi.fn().mockResolvedValue(undefined),
      closeDocument: vi.fn().mockResolvedValue(undefined),
    };

    // Load service worker (evaluates and registers listeners)
    const code = readFileSync(resolve(__dirname, '../background/service-worker.js'), 'utf-8');
    eval(code);
  });

  describe('message handling', () => {
    it('should register onMessage listener', () => {
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(messageListeners.length).toBe(1);
    });

    it('should handle setState message', () => {
      const sendResponse = vi.fn();
      messageListeners[0](
        { type: 'setState', tabId: 1, state: { active: true, preset: 'rain', blendMode: 'screen', micEnabled: true } },
        {},
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    });

    it('should handle getState message after setState', async () => {
      const sendResponse1 = vi.fn();
      const sendResponse2 = vi.fn();

      // Set state
      messageListeners[0](
        { type: 'setState', tabId: 42, state: { active: true, preset: 'mandala', blendMode: 'difference', micEnabled: false } },
        {},
        sendResponse1,
      );

      // Get state (now async)
      const result = messageListeners[0](
        { type: 'getState', tabId: 42 },
        {},
        sendResponse2,
      );
      expect(result).toBe(true); // async response

      await new Promise(r => setTimeout(r, 50));

      expect(sendResponse2).toHaveBeenCalledWith({
        state: { active: true, preset: 'mandala', blendMode: 'difference', micEnabled: false },
      });
    });

    it('should return null for unknown tab', async () => {
      const sendResponse = vi.fn();
      messageListeners[0](
        { type: 'getState', tabId: 999 },
        {},
        sendResponse,
      );
      await new Promise(r => setTimeout(r, 50));
      expect(sendResponse).toHaveBeenCalledWith({ state: null });
    });

    it('should handle clearState message', async () => {
      const sendResponse1 = vi.fn();
      const sendResponse2 = vi.fn();
      const sendResponse3 = vi.fn();

      // Set state
      messageListeners[0](
        { type: 'setState', tabId: 1, state: { active: true, preset: 'rain', blendMode: 'screen', micEnabled: true } },
        {},
        sendResponse1,
      );

      // Clear state
      messageListeners[0](
        { type: 'clearState', tabId: 1 },
        {},
        sendResponse2,
      );

      // Get state should be null (async)
      messageListeners[0](
        { type: 'getState', tabId: 1 },
        {},
        sendResponse3,
      );

      await new Promise(r => setTimeout(r, 50));
      expect(sendResponse3).toHaveBeenCalledWith({ state: null });
    });
  });

  describe('webNavigation.onCompleted', () => {
    it('should register navigation listener', () => {
      expect(chrome.webNavigation.onCompleted.addListener).toHaveBeenCalled();
      expect(navigationListeners.length).toBe(1);
    });

    it('should re-inject scripts on navigation when state is active', async () => {
      // Set active state for tab 1
      const sendResponse = vi.fn();
      messageListeners[0](
        { type: 'setState', tabId: 1, state: { active: true, preset: 'neon-tunnel', blendMode: 'screen', micEnabled: true } },
        {},
        sendResponse,
      );

      // Simulate navigation complete
      await navigationListeners[0]({ tabId: 1, frameId: 0 });

      // Wait for setTimeout(300ms) in the handler
      await new Promise(r => setTimeout(r, 400));

      // Should have injected: p5 + verify + base-preset + preset + engine + start command = 6+ calls
      expect(chrome.scripting.executeScript).toHaveBeenCalled();
      const calls = chrome.scripting.executeScript.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(6);

      // First call should be p5.min.js
      expect(calls[0][0].files).toEqual(['lib/p5.min.js']);
      expect(calls[0][0].world).toBe('MAIN');

      // Second call should be p5 verify (func, not files)
      expect(calls[1][0].func).toBeDefined();
    });

    it('should not re-inject for iframe navigations (frameId !== 0)', async () => {
      const sendResponse = vi.fn();
      messageListeners[0](
        { type: 'setState', tabId: 1, state: { active: true, preset: 'rain', blendMode: 'screen', micEnabled: true } },
        {},
        sendResponse,
      );

      chrome.scripting.executeScript.mockClear();
      await navigationListeners[0]({ tabId: 1, frameId: 5 });
      await new Promise(r => setTimeout(r, 400));

      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    it('should not re-inject when no state exists for tab', async () => {
      chrome.scripting.executeScript.mockClear();
      await navigationListeners[0]({ tabId: 99, frameId: 0 });
      await new Promise(r => setTimeout(r, 400));

      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    it('should not re-inject on restricted URLs', async () => {
      const sendResponse = vi.fn();
      messageListeners[0](
        { type: 'setState', tabId: 1, state: { active: true, preset: 'rain', blendMode: 'screen', micEnabled: true } },
        {},
        sendResponse,
      );

      chrome.tabs.get.mockResolvedValue({ id: 1, url: 'chrome://extensions/' });
      chrome.scripting.executeScript.mockClear();

      await navigationListeners[0]({ tabId: 1, frameId: 0 });
      await new Promise(r => setTimeout(r, 400));

      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });
  });

  describe('tab removal', () => {
    it('should register onRemoved listener', () => {
      expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
      expect(tabRemoveListeners.length).toBe(1);
    });

    it('should clean up state when tab is closed', async () => {
      const sendResponse1 = vi.fn();
      const sendResponse2 = vi.fn();

      // Set state
      messageListeners[0](
        { type: 'setState', tabId: 5, state: { active: true, preset: 'rain', blendMode: 'screen', micEnabled: true } },
        {},
        sendResponse1,
      );

      // Close tab
      tabRemoveListeners[0](5);

      // State should be gone (async)
      messageListeners[0](
        { type: 'getState', tabId: 5 },
        {},
        sendResponse2,
      );
      await new Promise(r => setTimeout(r, 50));
      expect(sendResponse2).toHaveBeenCalledWith({ state: null });
    });
  });

  describe('tab audio capture', () => {
    it('should handle startTabAudio message', async () => {
      const sendResponse = vi.fn();
      const result = messageListeners[0](
        { type: 'startTabAudio', tabId: 1 },
        {},
        sendResponse,
      );
      expect(result).toBe(true); // async response

      // Wait for async processing
      await new Promise(r => setTimeout(r, 100));
      expect(sendResponse).toHaveBeenCalledWith({ ok: true });
      expect(chrome.tabCapture.getMediaStreamId).toHaveBeenCalledWith({ targetTabId: 1 });
      expect(chrome.offscreen.createDocument).toHaveBeenCalled();
    });

    it('should handle stopTabAudio message', async () => {
      // First start tab audio
      const sendResponse1 = vi.fn();
      messageListeners[0](
        { type: 'startTabAudio', tabId: 1 },
        {},
        sendResponse1,
      );
      await new Promise(r => setTimeout(r, 100));

      // Then stop
      const sendResponse2 = vi.fn();
      chrome.runtime.getContexts = vi.fn().mockResolvedValue([{ contextType: 'OFFSCREEN_DOCUMENT' }]);
      messageListeners[0](
        { type: 'stopTabAudio', tabId: 1 },
        {},
        sendResponse2,
      );
      await new Promise(r => setTimeout(r, 100));
      expect(sendResponse2).toHaveBeenCalledWith({ ok: true });
      expect(chrome.offscreen.closeDocument).toHaveBeenCalled();
    });

    it('should relay audioData to target tab', () => {
      // First start tab audio to set activeTabAudioTabId
      const sendResponse1 = vi.fn();
      messageListeners[0](
        { type: 'startTabAudio', tabId: 42 },
        {},
        sendResponse1,
      );

      // Wait for async, then send audioData
      return new Promise(r => setTimeout(r, 100)).then(() => {
        const sendResponse2 = vi.fn();
        messageListeners[0](
          { type: 'audioData', data: { beat: true, bpm: 120 } },
          {},
          sendResponse2,
        );
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
          type: 'audioData',
          data: { beat: true, bpm: 120 },
        });
      });
    });
  });

  describe('stopTabAudio validates tabId', () => {
    it('should only stop if tabId matches activeTabAudioTabId', async () => {
      // Start tab audio on tab 1
      const sendResponse1 = vi.fn();
      messageListeners[0](
        { type: 'startTabAudio', tabId: 1 },
        {},
        sendResponse1,
      );
      await new Promise(r => setTimeout(r, 100));

      // Try to stop with a different tabId (tab 99)
      const sendResponse2 = vi.fn();
      chrome.runtime.getContexts = vi.fn().mockResolvedValue([{ contextType: 'OFFSCREEN_DOCUMENT' }]);
      messageListeners[0](
        { type: 'stopTabAudio', tabId: 99 },
        {},
        sendResponse2,
      );
      await new Promise(r => setTimeout(r, 100));

      // Should return false (not stopped) because tabId doesn't match
      expect(sendResponse2).toHaveBeenCalledWith({ ok: false });
      // offscreen document should NOT have been closed
      expect(chrome.offscreen.closeDocument).not.toHaveBeenCalled();
    });

    it('should stop when tabId matches activeTabAudioTabId', async () => {
      // Start tab audio on tab 1
      const sendResponse1 = vi.fn();
      messageListeners[0](
        { type: 'startTabAudio', tabId: 1 },
        {},
        sendResponse1,
      );
      await new Promise(r => setTimeout(r, 100));

      // Stop with matching tabId
      const sendResponse2 = vi.fn();
      chrome.runtime.getContexts = vi.fn().mockResolvedValue([{ contextType: 'OFFSCREEN_DOCUMENT' }]);
      messageListeners[0](
        { type: 'stopTabAudio', tabId: 1 },
        {},
        sendResponse2,
      );
      await new Promise(r => setTimeout(r, 100));

      // Should succeed
      expect(sendResponse2).toHaveBeenCalledWith({ ok: true });
      expect(chrome.offscreen.closeDocument).toHaveBeenCalled();
    });
  });

  describe('pausedTabAudioTabId cleanup on tab close', () => {
    it('should clear pausedTabAudioTabId when paused tab is closed', async () => {
      // Start tab audio on tab 10
      const sendResponse1 = vi.fn();
      messageListeners[0](
        { type: 'startTabAudio', tabId: 10 },
        {},
        sendResponse1,
      );
      await new Promise(r => setTimeout(r, 100));

      // Pause tab audio (fullscreen pause sets pausedTabAudioTabId)
      const sendResponse2 = vi.fn();
      chrome.runtime.getContexts = vi.fn().mockResolvedValue([{ contextType: 'OFFSCREEN_DOCUMENT' }]);
      messageListeners[0](
        { type: 'pauseTabAudio' },
        {},
        sendResponse2,
      );
      await new Promise(r => setTimeout(r, 100));

      // Close the tab that had paused audio
      tabRemoveListeners[0](10);
      await new Promise(r => setTimeout(r, 50));

      // Now resume should NOT restart audio (pausedTabAudioTabId was cleared)
      const sendResponse3 = vi.fn();
      chrome.tabCapture.getMediaStreamId.mockClear();
      messageListeners[0](
        { type: 'resumeTabAudio' },
        {},
        sendResponse3,
      );
      await new Promise(r => setTimeout(r, 100));

      // tabCapture should NOT be called since pausedTabAudioTabId was cleared
      expect(chrome.tabCapture.getMediaStreamId).not.toHaveBeenCalled();
    });
  });

  describe('stopTabAudio clears state even on failure', () => {
    it('should clear activeTabAudioTabId even when sendMessage fails', async () => {
      // Start tab audio on tab 5
      const sendResponse1 = vi.fn();
      messageListeners[0](
        { type: 'startTabAudio', tabId: 5 },
        {},
        sendResponse1,
      );
      await new Promise(r => setTimeout(r, 100));

      // Make runtime.sendMessage reject (simulating offscreen stop failure)
      chrome.runtime.sendMessage = vi.fn().mockRejectedValue(new Error('send failed'));
      chrome.runtime.getContexts = vi.fn().mockResolvedValue([{ contextType: 'OFFSCREEN_DOCUMENT' }]);
      chrome.offscreen.closeDocument = vi.fn().mockRejectedValue(new Error('close failed'));

      // Stop tab audio (should fail internally but still clear state)
      const sendResponse2 = vi.fn();
      messageListeners[0](
        { type: 'stopTabAudio', tabId: 5 },
        {},
        sendResponse2,
      );
      await new Promise(r => setTimeout(r, 100));

      // After failure, audioData should NOT be relayed (activeTabAudioTabId cleared)
      chrome.tabs.sendMessage.mockClear();
      const sendResponse3 = vi.fn();
      messageListeners[0](
        { type: 'audioData', data: { beat: true, bpm: 140 } },
        {},
        sendResponse3,
      );

      // tabs.sendMessage should NOT be called because activeTabAudioTabId was cleared
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });
});
