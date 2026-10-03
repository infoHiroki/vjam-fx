import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// We test the service worker logic by evaluating it in a simulated environment
// Service worker uses chrome.webNavigation, chrome.tabs, chrome.runtime, chrome.scripting

describe('Service Worker', () => {
  let messageListeners;
  let navigationListeners;
  let tabRemoveListeners;
  let activatedListeners;

  beforeEach(() => {
    messageListeners = [];
    navigationListeners = [];
    tabRemoveListeners = [];
    activatedListeners = [];

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
    chrome.tabs.onActivated = {
      addListener: vi.fn((cb) => activatedListeners.push(cb)),
    };
    chrome.tabs.query = vi.fn().mockResolvedValue([]);
    chrome.storage.local.get = vi.fn().mockResolvedValue({}); // 全タブで ON は既定 OFF
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
    // 遷移後の再注入で、最後に送る起動 func をフェイクのエンジンで実行し、エンジンに届いたメッセージを返す
    async function messagesAfterNavigation(state) {
      messageListeners[0]({ type: 'setState', tabId: 1, state }, {}, vi.fn());
      await navigationListeners[0]({ tabId: 1, frameId: 0 });
      await new Promise(r => setTimeout(r, 400));

      const startCall = chrome.scripting.executeScript.mock.calls
        .map(c => c[0])
        .find(c => c.func && c.args && c.args.length > 0);
      const messages = [];
      window._vjamFxEngine = { handleMessage: (msg) => messages.push(msg) };
      try {
        startCall.func(...startCall.args);
      } finally {
        delete window._vjamFxEngine;
      }
      return messages;
    }

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

    // 遷移後に Auto / Rnd を再開するとき、popup が保存したデフォルトプールをエンジンに渡す
    describe('default pool on re-inject', () => {
      const POOL = {
        filters: ['saturate(2)', 'hue-rotate(90deg) saturate(2)'],
        blends: ['screen', 'difference'],
      };

      it('passes the saved pool to startAutoCycle', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen',
          autoCyclePresets: ['rain', 'neon-tunnel'], autoBlend: true, autoFilters: true, pool: POOL,
        });
        const cmd = messages.find(m => m.action === 'startAutoCycle');
        expect(cmd.presets).toEqual(['rain', 'neon-tunnel']);
        expect(cmd.pool).toEqual(POOL);
        expect(cmd.autoBlend).toBe(true);
        expect(cmd.autoFilters).toBe(true);
      });

      it('re-injects the pool presets', async () => {
        await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen',
          autoCyclePresets: ['rain', 'neon-tunnel'], autoBlend: true, autoFilters: true, pool: POOL,
        });
        const files = chrome.scripting.executeScript.mock.calls.flatMap(c => c[0].files || []);
        expect(files).toContain('content/presets/rain.js');
        expect(files).toContain('content/presets/neon-tunnel.js');
      });

      it('passes null when no pool was saved (engine falls back)', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen',
          autoCyclePresets: ['rain'], autoBlend: true, autoFilters: true,
        });
        const cmd = messages.find(m => m.action === 'startAutoCycle');
        expect(cmd.pool).toBeNull();
      });

      it('does not start auto-cycle when Auto was off', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen',
          autoCyclePresets: null, pool: POOL,
        });
        expect(messages.some(m => m.action === 'startAutoCycle')).toBe(false);
      });
    });

    // 遷移後も popup と同じように回す: Auto が OFF でも Rnd だけ ON なら Rnd を再開、Cycle の秒数も引き継ぐ
    describe('Rnd / cycleSeconds on re-inject', () => {
      const POOL = { filters: ['saturate(2)'], blends: ['screen', 'difference'] };

      it('restarts Rnd (startAutoFX) when only Rnd was on', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen',
          autoCyclePresets: null, autoBlend: false, autoFilters: true, pool: POOL,
        });
        const cmd = messages.find(m => m.action === 'startAutoFX');
        expect(cmd).toMatchObject({ autoBlend: false, autoFilters: true, pool: POOL });
        expect(messages.some(m => m.action === 'startAutoCycle')).toBe(false);
      });

      it('restarts Blend Rnd alone too', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen',
          autoCyclePresets: null, autoBlend: true, autoFilters: false, pool: POOL,
        });
        const cmd = messages.find(m => m.action === 'startAutoFX');
        expect(cmd).toMatchObject({ autoBlend: true, autoFilters: false, pool: POOL });
      });

      it('starts neither Auto nor Rnd when both were off', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen',
          autoCyclePresets: null, autoBlend: false, autoFilters: false, pool: POOL,
        });
        expect(messages.some(m => m.action === 'startAutoFX' || m.action === 'startAutoCycle')).toBe(false);
      });

      it('does not start Rnd separately when Auto is on (auto-cycle handles blend / filter)', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen',
          autoCyclePresets: ['rain'], autoBlend: true, autoFilters: true, pool: POOL,
        });
        expect(messages.some(m => m.action === 'startAutoCycle')).toBe(true);
        expect(messages.some(m => m.action === 'startAutoFX')).toBe(false);
      });

      it('passes the saved Cycle seconds to startAutoCycle as the interval', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen',
          autoCyclePresets: ['rain'], autoBlend: true, autoFilters: true, pool: POOL, cycleSeconds: 30,
        });
        const cmd = messages.find(m => m.action === 'startAutoCycle');
        expect(cmd.interval).toBe(30000);
        expect(cmd).not.toHaveProperty('barsPerCycle');
      });

      it('passes the saved Cycle seconds to startAutoFX as the interval', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen',
          autoCyclePresets: null, autoBlend: true, autoFilters: true, pool: POOL, cycleSeconds: 8,
        });
        expect(messages.find(m => m.action === 'startAutoFX').interval).toBe(8000);
      });

      it('passes null when no Cycle was saved (old state: engine uses its default 15 s, ignores the old beats)', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen',
          autoCyclePresets: ['rain'], autoBlend: true, autoFilters: true, pool: POOL, barsPerCycle: 16,
        });
        expect(messages.find(m => m.action === 'startAutoCycle').interval).toBeNull();
      });
    });

    // popup で変えたフェード時間・音の感度を、遷移後もエンジンに戻す
    describe('fadeDuration / audioSensitivity on re-inject', () => {
      it('sends the saved fadeDuration and audioSensitivity to the engine', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen', fadeDuration: 3, audioSensitivity: 2.0,
        });
        expect(messages.find(m => m.action === 'setFadeDuration').duration).toBe(3);
        expect(messages.find(m => m.action === 'setAudioSensitivity').sensitivity).toBe(2.0);
      });

      it('sends them before start (the first fade-in uses the saved duration)', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen', fadeDuration: 3, audioSensitivity: 0.5,
        });
        const startIdx = messages.findIndex(m => m.action === 'start');
        expect(messages.findIndex(m => m.action === 'setFadeDuration')).toBeLessThan(startIdx);
        expect(messages.findIndex(m => m.action === 'setAudioSensitivity')).toBeLessThan(startIdx);
      });

      it('keeps fadeDuration 0 (no fade)', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen', fadeDuration: 0, audioSensitivity: 1.0,
        });
        expect(messages.find(m => m.action === 'setFadeDuration').duration).toBe(0);
      });

      it('sends neither when they were not saved (engine uses its defaults)', async () => {
        const messages = await messagesAfterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen',
        });
        expect(messages.some(m => m.action === 'setFadeDuration' || m.action === 'setAudioSensitivity')).toBe(false);
      });
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
  // 全タブで ON(#30): 設定が ON の間、前に出たタブに popup で最後に ON にしていた状態で入れ、裏に回ったタブは止める
  describe('all tabs', () => {
    const STATE = {
      active: true, layers: ['rain', 'radar'], blendMode: 'difference', filters: ['sepia'], opacity: 0.6, audioEnabled: true,
      autoCyclePresets: ['rain', 'radar'], autoBlend: true, autoFilters: true,
      pool: { filters: ['saturate(2)'], blends: ['screen', 'difference'] },
      cycleSeconds: 30, fadeDuration: 3, audioSensitivity: 2.0, locks: { effect: false, blend: false, filter: false }, textState: null,
    };
    let tabs; // id → { id, windowId, url, active, status }

    const setTabs = (list) => {
      tabs = new Map(list.map(t => [t.id, { windowId: 1, active: false, status: 'complete', url: `https://example.com/${t.id}`, ...t }]));
    };
    // タブを切り替える(同じウィンドウの前のタブは裏に回る)
    const activate = (tabId) => {
      const tab = tabs.get(tabId);
      for (const t of tabs.values()) if (t.windowId === tab.windowId) t.active = t.id === tabId;
      return activatedListeners[0]({ tabId, windowId: tab.windowId });
    };
    const setAllTabs = (on) => chrome.storage.local.get.mockResolvedValue(on ? { vjamfx_settings: { allTabs: true } } : {});
    const popupSetState = (tabId, state = STATE) => messageListeners[0]({ type: 'setState', tabId, state }, {}, vi.fn());
    const popupClearState = (tabId) => messageListeners[0]({ type: 'clearState', tabId }, {}, vi.fn());
    const callsTo = (tabId) => chrome.scripting.executeScript.mock.calls.map(c => c[0]).filter(c => c.target.tabId === tabId);
    const injected = (tabId) => callsTo(tabId).some(c => (c.files || []).includes('content/content.js'));
    // そのタブに送った func を順にフェイクのエンジンで実行し、エンジンに届いたメッセージを返す
    const engineMessages = (tabId) => {
      const messages = [];
      window._vjamFxEngine = { handleMessage: (msg) => messages.push(msg), _textOverlay: null };
      try {
        for (const c of callsTo(tabId)) if (c.func) c.func(...(c.args || []));
      } finally {
        delete window._vjamFxEngine;
      }
      return messages;
    };
    const actionsTo = (tabId) => engineMessages(tabId).map(m => m.action);
    const savedState = async (tabId) => {
      const sendResponse = vi.fn();
      messageListeners[0]({ type: 'getState', tabId }, {}, sendResponse);
      await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
      return sendResponse.mock.calls[0][0].state;
    };
    const flush = () => new Promise(r => setTimeout(r, 20));

    beforeEach(() => {
      // ウィンドウ 1: タブ 1(前)・タブ 2 / ウィンドウ 2: タブ 3(前)
      setTabs([{ id: 1, active: true }, { id: 2 }, { id: 3, windowId: 2, active: true }]);
      chrome.tabs.get = vi.fn((id) => (tabs.has(id) ? Promise.resolve({ ...tabs.get(id) }) : Promise.reject(new Error('No tab'))));
      chrome.tabs.query = vi.fn((q) => Promise.resolve([...tabs.values()]
        .filter(t => q.windowId === undefined || t.windowId === q.windowId)
        .map(t => ({ ...t }))));
      setAllTabs(true);
    });

    it('registers a tabs.onActivated listener', () => {
      expect(activatedListeners.length).toBe(1);
    });

    it('switching to a tab injects the last ON state (layers / pool / Auto / Rnd / blend / filter / opacity / settings)', async () => {
      popupSetState(1);
      await activate(2);

      expect(injected(2)).toBe(true);
      const messages = engineMessages(2);
      expect(messages.find(m => m.action === 'start')).toMatchObject({ preset: 'rain', blendMode: 'difference' });
      expect(messages.find(m => m.action === 'addLayer')).toMatchObject({ preset: 'radar' });
      expect(messages.find(m => m.action === 'setFilter')).toMatchObject({ filter: 'sepia', enabled: true });
      expect(messages.find(m => m.action === 'setOpacity').opacity).toBe(0.6);
      expect(messages.find(m => m.action === 'startAutoCycle')).toMatchObject({
        presets: ['rain', 'radar'], pool: STATE.pool, autoBlend: true, autoFilters: true, interval: 30000,
      });
      expect(messages.find(m => m.action === 'setFadeDuration').duration).toBe(3);
      expect(messages.find(m => m.action === 'setAudioSensitivity').sensitivity).toBe(2.0);
      // 入ったタブの状態も残す(そのタブのページ遷移で戻す・バッジ)
      expect(await savedState(2)).toEqual({ ...STATE, autoInjected: true });
    });

    it('uses only startVideoAudio for the sound (no tabCapture: it needs a user action)', async () => {
      popupSetState(1);
      await activate(2);
      expect(actionsTo(2)).toContain('startVideoAudio');
      expect(chrome.tabCapture.getMediaStreamId).not.toHaveBeenCalled();
    });

    it('stops the tab that went to the background (analyser only, the page keeps playing)', async () => {
      popupSetState(1);
      await activate(2);
      expect(actionsTo(1)).toEqual(['stopVideoAudio', 'stop']);
      expect(injected(1)).toBe(false);
      expect(await savedState(1)).toBeNull();
    });

    it('drops the text overlay of the stopped tab (it is recreated from textState when injected again)', async () => {
      popupSetState(1);
      await activate(2);
      const stopCall = callsTo(1).find(c => c.func);
      const textOverlay = { destroy: vi.fn() };
      window._vjamFxEngine = { handleMessage: vi.fn(), _textOverlay: textOverlay };
      try {
        stopCall.func();
        expect(textOverlay.destroy).toHaveBeenCalled();
        expect(window._vjamFxEngine._textOverlay).toBeNull();
      } finally {
        delete window._vjamFxEngine;
      }
    });

    it('switching back injects again and stops the other tab', async () => {
      popupSetState(1);
      await activate(2);
      chrome.scripting.executeScript.mockClear();
      await activate(1);

      expect(injected(1)).toBe(true);
      expect(actionsTo(2)).toEqual(['stopVideoAudio', 'stop']);
      expect((await savedState(1)).autoInjected).toBe(true);
      expect(await savedState(2)).toBeNull();
    });

    it('stops the background tab that was running from the popup too (also its tabCapture)', async () => {
      popupSetState(1);
      messageListeners[0]({ type: 'startTabAudio', tabId: 1 }, {}, vi.fn());
      await flush();
      chrome.runtime.getContexts = vi.fn().mockResolvedValue([{ contextType: 'OFFSCREEN_DOCUMENT' }]);
      await activate(2);
      await flush();
      expect(chrome.offscreen.closeDocument).toHaveBeenCalled();
    });

    it('does not stop the front tab of another window', async () => {
      popupSetState(3);
      popupSetState(1);
      await activate(2);
      expect(callsTo(3)).toEqual([]);
      expect((await savedState(3)).active).toBe(true);
    });

    it('does not inject into a tab that is already running', async () => {
      popupSetState(1);
      popupSetState(2);
      await activate(2);
      expect(callsTo(2)).toEqual([]);
    });

    it('does nothing while the setting is OFF', async () => {
      setAllTabs(false);
      popupSetState(1);
      await activate(2);
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
      expect((await savedState(1)).active).toBe(true);
    });

    it('does nothing before the first ON (no state to carry)', async () => {
      await activate(2);
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    it('does not inject into non-http(s) pages (the background tab is still stopped)', async () => {
      tabs.get(2).url = 'chrome://newtab/';
      popupSetState(1);
      await activate(2);
      expect(injected(2)).toBe(false);
      expect(await savedState(2)).toBeNull();
      expect(actionsTo(1)).toContain('stop');
    });

    it('waits for webNavigation.onCompleted when the tab is still loading', async () => {
      tabs.get(2).status = 'loading';
      popupSetState(1);
      await activate(2);
      expect(injected(2)).toBe(false);

      tabs.get(2).status = 'complete';
      await navigationListeners[0]({ tabId: 2, frameId: 0 });
      expect(injected(2)).toBe(true);
      expect((await savedState(2)).autoInjected).toBe(true);
    });

    it('injects when the front tab finishes loading a new page (frameId 0 only)', async () => {
      popupSetState(1);
      tabs.get(1).active = false;
      tabs.get(2).active = true;
      await navigationListeners[0]({ tabId: 2, frameId: 3 });
      expect(injected(2)).toBe(false);
      await navigationListeners[0]({ tabId: 2, frameId: 0 });
      expect(injected(2)).toBe(true);
      expect(chrome.tabCapture.getMediaStreamId).not.toHaveBeenCalled();
    });

    it('does not inject into a background tab that finished loading (and forgets its state)', async () => {
      popupSetState(2); // 前に ON にしていた裏のタブ
      await navigationListeners[0]({ tabId: 2, frameId: 0 });
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
      expect(await savedState(2)).toBeNull();
    });

    it('does not inject a non-http(s) page that finished loading in the front tab', async () => {
      tabs.get(1).url = 'chrome://extensions/';
      popupSetState(3);
      await navigationListeners[0]({ tabId: 1, frameId: 0 });
      expect(injected(1)).toBe(false);
      expect(await savedState(1)).toBeNull();
    });

    it('stops a tab that went to the background while it was being injected', async () => {
      popupSetState(1);
      chrome.scripting.executeScript.mockImplementation((opts) => {
        // エンジンを入れている間に、ユーザーがタブ 1 に戻った
        if (opts.target.tabId === 2 && (opts.files || []).includes('content/content.js')) {
          tabs.get(2).active = false;
          tabs.get(1).active = true;
        }
        return Promise.resolve([{ result: true }]);
      });
      await activate(2);
      const actions = actionsTo(2);
      expect(actions.lastIndexOf('stop')).toBeGreaterThan(actions.indexOf('start'));
      expect(await savedState(2)).toBeNull();
    });

    it('turning OFF a running tab in the popup stops everything until the next ON', async () => {
      popupSetState(3); // 別のウィンドウでも動いている
      popupSetState(1);
      popupClearState(1);
      await flush();
      expect(actionsTo(3)).toEqual(['stopVideoAudio', 'stop']);
      expect(await savedState(3)).toBeNull();

      chrome.scripting.executeScript.mockClear();
      await activate(2);
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();

      // 次に ON にしたら、また入る
      popupSetState(2);
      await activate(1);
      expect(injected(1)).toBe(true);
    });

    it('clearState from the popup on a tab that was not running changes nothing', async () => {
      popupSetState(3);
      popupClearState(2); // OFF のタブで popup を触った(Lock など)
      await flush();
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
      await activate(2);
      expect(injected(2)).toBe(true);
    });

    it('carries the latest popup state (changes after ON follow too)', async () => {
      popupSetState(1);
      popupSetState(1, { ...STATE, layers: ['mandala'], autoCyclePresets: null, blendMode: 'exclusion' });
      await activate(2);
      const messages = engineMessages(2);
      expect(messages.find(m => m.action === 'start')).toMatchObject({ preset: 'mandala', blendMode: 'exclusion' });
      expect(messages.some(m => m.action === 'startAutoCycle')).toBe(false);
      expect(messages.find(m => m.action === 'startAutoFX')).toMatchObject({ autoBlend: true, autoFilters: true });
    });

    it('page navigation in an auto-injected tab restores without tabCapture', async () => {
      popupSetState(1);
      await activate(2);
      chrome.scripting.executeScript.mockClear();
      await navigationListeners[0]({ tabId: 2, frameId: 0 });
      expect(injected(2)).toBe(true);
      expect(actionsTo(2)).toContain('startVideoAudio');
      expect(chrome.tabCapture.getMediaStreamId).not.toHaveBeenCalled();
    });

    it('page navigation in the tab turned ON from the popup still uses tabCapture as before', async () => {
      popupSetState(1);
      await navigationListeners[0]({ tabId: 1, frameId: 0 });
      expect(injected(1)).toBe(true);
      await vi.waitFor(() => expect(chrome.tabCapture.getMediaStreamId).toHaveBeenCalledWith({ targetTabId: 1 }));
    });

    it('turning the setting OFF: no more injections, the front tab keeps running', async () => {
      popupSetState(1);
      setAllTabs(false);
      await activate(2);
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
      expect((await savedState(1)).active).toBe(true);
    });
  });

  // 重いプリセット(#40): エンジン → bridge → SW が storage.local に覚える。遷移後の再注入・全タブで ON でも除く
  describe('heavy presets (#40)', () => {
    let localStore;

    beforeEach(() => {
      localStore = {};
      chrome.storage.local.get = vi.fn((key) => Promise.resolve(
        typeof key === 'string' && localStore[key] !== undefined ? { [key]: JSON.parse(JSON.stringify(localStore[key])) } : {}));
      chrome.storage.local.set = vi.fn((obj) => {
        Object.assign(localStore, JSON.parse(JSON.stringify(obj)));
        return Promise.resolve();
      });
    });

    const send = (msg, sender = { tab: { id: 1 } }) => {
      const sendResponse = vi.fn();
      const async = messageListeners[0](msg, sender, sendResponse);
      return { async, sendResponse };
    };
    const getState = async (tabId) => {
      const sendResponse = vi.fn();
      messageListeners[0]({ type: 'getState', tabId }, {}, sendResponse);
      await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
      return sendResponse.mock.calls[0][0].state;
    };
    const allTabsState = async () => (await chrome.storage.session.get('allTabsState')).allTabsState;

    describe('remembering', () => {
      it('saves the preset with the measured fps and the time', async () => {
        const { sendResponse } = send({ type: 'heavyPreset', name: 'film-grain', fps: 5.6, replacement: 'aurora' });
        expect(sendResponse).toHaveBeenCalledWith({ ok: true });
        await vi.waitFor(() => expect(localStore.heavyPresets).toBeDefined());
        expect(localStore.heavyPresets['film-grain'].fps).toBe(5.6);
        expect(new Date(localStore.heavyPresets['film-grain'].at).toISOString()).toBe(localStore.heavyPresets['film-grain'].at);
      });

      it('keeps every one when several come at once', async () => {
        send({ type: 'heavyPreset', name: 'film-grain', fps: 5.6 });
        send({ type: 'heavyPreset', name: 'ascii-art', fps: 7.1 });
        send({ type: 'heavyPreset', name: 'liquid', fps: 10.2 });
        await vi.waitFor(() => expect(Object.keys(localStore.heavyPresets || {}).sort()).toEqual(['ascii-art', 'film-grain', 'liquid']));
      });

      it('keeps what was saved before', async () => {
        localStore.heavyPresets = { voronoi: { fps: 21.9, at: '2026-10-01T00:00:00.000Z' } };
        send({ type: 'heavyPreset', name: 'film-grain', fps: 5.6 });
        await vi.waitFor(() => expect(localStore.heavyPresets['film-grain']).toBeDefined());
        expect(localStore.heavyPresets.voronoi).toEqual({ fps: 21.9, at: '2026-10-01T00:00:00.000Z' });
      });

      it('ignores names that are not preset names', async () => {
        send({ type: 'heavyPreset', name: '../manifest', fps: 1 });
        send({ type: 'heavyPreset', name: 'Film Grain', fps: 1 });
        send({ type: 'heavyPreset', fps: 1 });
        await new Promise(r => setTimeout(r, 20));
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
      });

      it('swaps the layer in the tab state and the all-tabs state (no heavy layer after navigation)', async () => {
        send({ type: 'setState', tabId: 1, state: { active: true, layers: ['film-grain', 'rain'], blendMode: 'screen' } });
        send({ type: 'heavyPreset', name: 'film-grain', fps: 5.6, replacement: 'aurora' });
        await vi.waitFor(async () => expect((await getState(1)).layers).toEqual(['aurora', 'rain']));
        expect((await allTabsState()).layers).toEqual(['aurora', 'rain']);
      });

      it('drops the layer when there was no replacement, but never leaves no layer', async () => {
        send({ type: 'setState', tabId: 1, state: { active: true, layers: ['film-grain', 'rain'] } });
        send({ type: 'heavyPreset', name: 'film-grain', fps: 5.6, replacement: null });
        await vi.waitFor(async () => expect((await getState(1)).layers).toEqual(['rain']));

        send({ type: 'setState', tabId: 2, state: { active: true, layers: ['liquid'] } });
        send({ type: 'heavyPreset', name: 'liquid', fps: 10.2, replacement: null }, { tab: { id: 2 } });
        await vi.waitFor(() => expect(localStore.heavyPresets && localStore.heavyPresets.liquid).toBeDefined());
        expect((await getState(2)).layers).toEqual(['liquid']);
      });
    });

    describe('loading a replacement', () => {
      it('injects the preset file into the tab that asked and answers ok', async () => {
        const { async, sendResponse } = send({ type: 'injectPreset', name: 'aurora' }, { tab: { id: 7 } });
        expect(async).toBe(true);
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }));
        expect(chrome.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, world: 'MAIN', files: ['content/presets/aurora.js'] });
      });

      it('answers not ok when the injection fails', async () => {
        chrome.scripting.executeScript.mockRejectedValueOnce(new Error('Cannot access contents of the page'));
        const { sendResponse } = send({ type: 'injectPreset', name: 'aurora' });
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: false }));
      });

      it('does not inject anything but a preset file, and only into the tab that asked', () => {
        for (const [name, sender] of [['../background/service-worker', { tab: { id: 1 } }], ['aurora', {}], [undefined, { tab: { id: 1 } }]]) {
          const { sendResponse } = send({ type: 'injectPreset', name }, sender);
          expect(sendResponse).toHaveBeenCalledWith({ ok: false });
        }
        expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
      });
    });

    describe('re-inject after navigation', () => {
      // 遷移後に最後に送る起動 func をフェイクのエンジンで実行し、エンジンに届いたメッセージを返す
      async function afterNavigation(state) {
        send({ type: 'setState', tabId: 1, state });
        await navigationListeners[0]({ tabId: 1, frameId: 0 });
        await new Promise(r => setTimeout(r, 400));
        const startCall = chrome.scripting.executeScript.mock.calls.map(c => c[0]).find(c => c.func && c.args && c.args.length > 0);
        const messages = [];
        window._vjamFxEngine = { handleMessage: (msg) => messages.push(msg) };
        try {
          startCall.func(...startCall.args);
        } finally {
          delete window._vjamFxEngine;
        }
        return messages;
      }
      const injectedPresets = () => chrome.scripting.executeScript.mock.calls
        .flatMap(c => c[0].files || []).filter(f => f.startsWith('content/presets/')).sort();

      it('leaves heavy presets out of the Auto pool and the layers (Auto replaces them anyway)', async () => {
        localStore.heavyPresets = { 'film-grain': { fps: 5.6, at: '2026-10-02T00:00:00.000Z' } };
        const messages = await afterNavigation({
          active: true, layers: ['film-grain', 'rain'], blendMode: 'screen',
          autoCyclePresets: ['film-grain', 'rain', 'radar'], autoBlend: true, autoFilters: true,
        });
        expect(messages.find(m => m.action === 'startAutoCycle').presets).toEqual(['rain', 'radar']);
        expect(messages.find(m => m.action === 'start').preset).toBe('rain');
        expect(messages.some(m => m.preset === 'film-grain')).toBe(false);
        expect(injectedPresets()).toEqual(['content/presets/radar.js', 'content/presets/rain.js']);
      });

      it('starts from the pool when every layer was heavy', async () => {
        localStore.heavyPresets = { 'film-grain': { fps: 5.6, at: '' } };
        const messages = await afterNavigation({
          active: true, layers: ['film-grain'], blendMode: 'screen', autoCyclePresets: ['film-grain', 'rain'],
        });
        expect(messages.find(m => m.action === 'start').preset).toBe('rain');
        expect(injectedPresets()).toEqual(['content/presets/rain.js']);
      });

      it('keeps the pool when all of it is heavy', async () => {
        localStore.heavyPresets = { 'film-grain': { fps: 5.6, at: '' }, rain: { fps: 20, at: '' } };
        const messages = await afterNavigation({
          active: true, layers: ['rain'], blendMode: 'screen', autoCyclePresets: ['film-grain', 'rain'],
        });
        expect(messages.find(m => m.action === 'startAutoCycle').presets).toEqual(['film-grain', 'rain']);
      });

      it('keeps the layers as they were when Auto is off (chosen by hand)', async () => {
        localStore.heavyPresets = { 'film-grain': { fps: 5.6, at: '' } };
        const messages = await afterNavigation({ active: true, layers: ['film-grain'], blendMode: 'screen', autoCyclePresets: null });
        expect(messages.find(m => m.action === 'start').preset).toBe('film-grain');
      });

      it('all tabs: the tab switched to also gets no heavy preset', async () => {
        chrome.storage.local.get = vi.fn((key) => Promise.resolve(key === 'vjamfx_settings'
          ? { vjamfx_settings: { allTabs: true } }
          : { heavyPresets: { 'film-grain': { fps: 5.6, at: '' } } }));
        chrome.tabs.get = vi.fn((id) => Promise.resolve({ id, windowId: 1, active: true, status: 'complete', url: `https://example.com/${id}` }));
        chrome.tabs.query = vi.fn().mockResolvedValue([]);
        send({ type: 'setState', tabId: 1, state: {
          active: true, layers: ['film-grain'], blendMode: 'screen', autoCyclePresets: ['film-grain', 'rain'], autoBlend: true, autoFilters: true,
        } });
        await activatedListeners[0]({ tabId: 2, windowId: 1 });
        const calls = chrome.scripting.executeScript.mock.calls.map(c => c[0]).filter(c => c.target.tabId === 2);
        const files = calls.flatMap(c => c.files || []);
        expect(files).toContain('content/content.js');
        expect(files).not.toContain('content/presets/film-grain.js');
        const startCall = calls.find(c => c.func && c.args && c.args.length > 0);
        expect(startCall.args[0]).toEqual(['rain']);
        expect(startCall.args[3]).toEqual(['rain']);
      });
    });
  });
});
