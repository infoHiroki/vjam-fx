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

  describe('command handler (Phase 5)', () => {
    it('should handle command message and update state', async () => {
      const sendResponse = vi.fn();
      const result = messageListeners[0](
        { type: 'command', tabId: 10, actions: [{ action: 'start', preset: 'rain', blendMode: 'screen' }] },
        {},
        sendResponse,
      );
      expect(result).toBe(true); // async
      await new Promise(r => setTimeout(r, 100));
      expect(sendResponse).toHaveBeenCalled();
      const resp = sendResponse.mock.calls[0][0];
      expect(resp.ok).toBe(true);
      expect(resp.state.active).toBe(true);
      expect(resp.state.layers).toContain('rain');
    });

    it('should forward actions to content via executeScript', async () => {
      chrome.scripting.executeScript.mockClear();
      const sendResponse = vi.fn();
      messageListeners[0](
        { type: 'command', tabId: 10, actions: [{ action: 'setOpacity', opacity: 0.5 }] },
        {},
        sendResponse,
      );
      await new Promise(r => setTimeout(r, 100));
      // Should have called executeScript to forward to content
      const funcCalls = chrome.scripting.executeScript.mock.calls.filter(
        c => c[0].world === 'MAIN' && typeof c[0].func === 'function'
      );
      expect(funcCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should persist state after command', async () => {
      const sendResponse1 = vi.fn();
      messageListeners[0](
        { type: 'command', tabId: 20, actions: [
          { action: 'start', preset: 'neon-tunnel', blendMode: 'difference' },
          { action: 'addLayer', preset: 'rain' },
        ]},
        {},
        sendResponse1,
      );
      await new Promise(r => setTimeout(r, 100));

      // Verify state was persisted via getState
      const sendResponse2 = vi.fn();
      messageListeners[0](
        { type: 'getState', tabId: 20 },
        {},
        sendResponse2,
      );
      await new Promise(r => setTimeout(r, 50));
      const state = sendResponse2.mock.calls[0][0].state;
      expect(state.active).toBe(true);
      expect(state.layers).toEqual(['neon-tunnel', 'rain']);
      expect(state.blendMode).toBe('difference');
    });

    it('should apply multiple actions sequentially', async () => {
      const sendResponse = vi.fn();
      messageListeners[0](
        { type: 'command', tabId: 30, actions: [
          { action: 'start', preset: 'mandala', blendMode: 'screen' },
          { action: 'setFilter', filter: 'invert', enabled: true },
          { action: 'setFilter', filter: 'blur', enabled: true },
          { action: 'setOpacity', opacity: 0.7 },
        ]},
        {},
        sendResponse,
      );
      await new Promise(r => setTimeout(r, 100));
      const state = sendResponse.mock.calls[0][0].state;
      expect(state.layers).toEqual(['mandala']);
      expect(state.filters).toEqual(['invert', 'blur']);
      expect(state.opacity).toBe(0.7);
    });

    it('should reject command without tabId', () => {
      const sendResponse = vi.fn();
      const result = messageListeners[0](
        { type: 'command', actions: [{ action: 'stop' }] },
        {},
        sendResponse,
      );
      expect(result).toBe(false);
      expect(sendResponse).toHaveBeenCalledWith({ ok: false });
    });

    it('should handle stop action', async () => {
      // First start
      const sr1 = vi.fn();
      messageListeners[0](
        { type: 'command', tabId: 40, actions: [{ action: 'start', preset: 'rain', blendMode: 'screen' }] },
        {},
        sr1,
      );
      await new Promise(r => setTimeout(r, 50));
      expect(sr1.mock.calls[0][0].state.active).toBe(true);

      // Then stop
      const sr2 = vi.fn();
      messageListeners[0](
        { type: 'command', tabId: 40, actions: [{ action: 'stop' }] },
        {},
        sr2,
      );
      await new Promise(r => setTimeout(r, 50));
      expect(sr2.mock.calls[0][0].state.active).toBe(false);
    });

    it('should handle kill action', async () => {
      const sr1 = vi.fn();
      messageListeners[0](
        { type: 'command', tabId: 50, actions: [
          { action: 'start', preset: 'rain', blendMode: 'screen' },
          { action: 'setFilter', filter: 'invert', enabled: true },
        ]},
        {},
        sr1,
      );
      await new Promise(r => setTimeout(r, 50));

      const sr2 = vi.fn();
      messageListeners[0](
        { type: 'command', tabId: 50, actions: [{ action: 'kill' }] },
        {},
        sr2,
      );
      await new Promise(r => setTimeout(r, 50));
      const state = sr2.mock.calls[0][0].state;
      expect(state.layers).toEqual([]);
      expect(state.filters).toEqual([]);
    });

    it('should handle autoCycle actions', async () => {
      const sr = vi.fn();
      messageListeners[0](
        { type: 'command', tabId: 60, actions: [
          { action: 'startAutoCycle', presets: ['a', 'b', 'c'], autoBlend: true, autoFilters: false },
        ]},
        {},
        sr,
      );
      await new Promise(r => setTimeout(r, 50));
      const state = sr.mock.calls[0][0].state;
      expect(state.autoCyclePresets).toEqual(['a', 'b', 'c']);
      expect(state.autoBlend).toBe(true);
      expect(state.autoFilters).toBe(false);
    });

    it('should handle text actions', async () => {
      const sr = vi.fn();
      messageListeners[0](
        { type: 'command', tabId: 70, actions: [
          { action: 'textAutoStart', text: 'Hello' },
        ]},
        {},
        sr,
      );
      await new Promise(r => setTimeout(r, 50));
      expect(sr.mock.calls[0][0].state.textState).toEqual({ text: 'Hello', autoText: true });

      const sr2 = vi.fn();
      messageListeners[0](
        { type: 'command', tabId: 70, actions: [{ action: 'textClear' }] },
        {},
        sr2,
      );
      await new Promise(r => setTimeout(r, 50));
      expect(sr2.mock.calls[0][0].state.textState).toBeNull();
    });

    it('should handle toggleFilter action', async () => {
      const sr = vi.fn();
      messageListeners[0](
        { type: 'command', tabId: 80, actions: [
          { action: 'toggleFilter', filter: 'blur' },
          { action: 'toggleFilter', filter: 'invert' },
        ]},
        {},
        sr,
      );
      await new Promise(r => setTimeout(r, 50));
      expect(sr.mock.calls[0][0].state.filters).toEqual(['blur', 'invert']);

      // Toggle blur off
      const sr2 = vi.fn();
      messageListeners[0](
        { type: 'command', tabId: 80, actions: [{ action: 'toggleFilter', filter: 'blur' }] },
        {},
        sr2,
      );
      await new Promise(r => setTimeout(r, 50));
      expect(sr2.mock.calls[0][0].state.filters).toEqual(['invert']);
    });
  });
});
