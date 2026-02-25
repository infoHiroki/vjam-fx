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

    // Reset chrome mocks for service worker
    chrome.runtime.onMessage = {
      addListener: vi.fn((cb) => messageListeners.push(cb)),
      removeListener: vi.fn(),
    };
    chrome.webNavigation = {
      onCompleted: {
        addListener: vi.fn((cb) => navigationListeners.push(cb)),
      },
    };
    chrome.tabs.onRemoved = {
      addListener: vi.fn((cb) => tabRemoveListeners.push(cb)),
    };
    chrome.tabs.get = vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com' });
    chrome.scripting.executeScript.mockClear();
    chrome.scripting.executeScript.mockResolvedValue([]);

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

    it('should handle getState message after setState', () => {
      const sendResponse1 = vi.fn();
      const sendResponse2 = vi.fn();

      // Set state
      messageListeners[0](
        { type: 'setState', tabId: 42, state: { active: true, preset: 'mandala', blendMode: 'difference', micEnabled: false } },
        {},
        sendResponse1,
      );

      // Get state
      messageListeners[0](
        { type: 'getState', tabId: 42 },
        {},
        sendResponse2,
      );

      expect(sendResponse2).toHaveBeenCalledWith({
        state: { active: true, preset: 'mandala', blendMode: 'difference', micEnabled: false },
      });
    });

    it('should return null for unknown tab', () => {
      const sendResponse = vi.fn();
      messageListeners[0](
        { type: 'getState', tabId: 999 },
        {},
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith({ state: null });
    });

    it('should handle clearState message', () => {
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

      // Get state should be null
      messageListeners[0](
        { type: 'getState', tabId: 1 },
        {},
        sendResponse3,
      );

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

      // Should have injected 5 script files + 1 start command = 6 executeScript calls
      expect(chrome.scripting.executeScript).toHaveBeenCalled();
      const calls = chrome.scripting.executeScript.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(6);

      // First call should be p5.min.js
      expect(calls[0][0].files).toEqual(['lib/p5.min.js']);
      expect(calls[0][0].world).toBe('MAIN');
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

    it('should clean up state when tab is closed', () => {
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

      // State should be gone
      messageListeners[0](
        { type: 'getState', tabId: 5 },
        {},
        sendResponse2,
      );
      expect(sendResponse2).toHaveBeenCalledWith({ state: null });
    });
  });
});
