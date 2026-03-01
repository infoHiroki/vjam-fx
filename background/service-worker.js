/**
 * VJam FX — Service Worker (Background Script)
 * Persists effect state across page navigations.
 * Supports multi-layer presets and CSS filters.
 */

function logWarn(context, e) {
  console.warn('VJam FX [' + context + ']:', e && e.message ? e.message : e);
}

// Canonical tab state shape — single source of truth
const DEFAULT_TAB_STATE = {
  active: false,
  layers: [],
  blendMode: 'screen',
  opacity: 1,
  audioEnabled: true,
  filters: [],
  autoCyclePresets: null,
  autoBlend: false,
  autoFilters: false,
  locks: { effect: false, blend: false, filter: false },
  textState: null,
};

/**
 * Pure function: apply an action to state, return new state.
 * Does NOT mutate input — always returns a fresh object.
 */
function applyAction(state, action) {
  const s = { ...state, layers: [...(state.layers || [])], filters: [...(state.filters || [])], locks: { ...(state.locks || DEFAULT_TAB_STATE.locks) } };
  switch (action.action) {
    case 'start':
      s.active = true;
      if (action.preset && !s.layers.includes(action.preset)) {
        s.layers = [action.preset];
      }
      if (action.blendMode) s.blendMode = action.blendMode;
      break;
    case 'stop':
      s.active = false;
      break;
    case 'kill':
      s.layers = [];
      if (!action.locks || !action.locks.filter) s.filters = [];
      break;
    case 'addLayer':
      if (action.preset && !s.layers.includes(action.preset)) {
        s.layers.push(action.preset);
      }
      break;
    case 'removeLayer':
      s.layers = s.layers.filter(id => id !== action.preset);
      break;
    case 'toggleLayer':
      if (s.layers.includes(action.preset)) {
        s.layers = s.layers.filter(id => id !== action.preset);
      } else if (action.preset) {
        s.layers.push(action.preset);
      }
      break;
    case 'setBlendMode':
      if (action.blendMode) s.blendMode = action.blendMode;
      break;
    case 'setFilter':
      if (action.filter) {
        if (action.enabled && !s.filters.includes(action.filter)) {
          s.filters.push(action.filter);
        } else if (!action.enabled) {
          s.filters = s.filters.filter(f => f !== action.filter);
        }
      }
      break;
    case 'toggleFilter':
      if (action.filter) {
        if (s.filters.includes(action.filter)) {
          s.filters = s.filters.filter(f => f !== action.filter);
        } else {
          s.filters.push(action.filter);
        }
      }
      break;
    case 'setOpacity':
      if (action.opacity !== undefined) s.opacity = action.opacity;
      break;
    case 'startVideoAudio':
    case 'setAudioEnabled':
      if (action.enabled !== undefined) s.audioEnabled = action.enabled;
      break;
    case 'stopVideoAudio':
      // audioEnabled state unchanged — user toggles separately
      break;
    case 'startAutoCycle':
      s.autoCyclePresets = action.presets || null;
      if (action.autoBlend !== undefined) s.autoBlend = action.autoBlend;
      if (action.autoFilters !== undefined) s.autoFilters = action.autoFilters;
      if (action.locks) s.locks = { ...s.locks, ...action.locks };
      break;
    case 'stopAutoCycle':
      s.autoCyclePresets = null;
      break;
    case 'updateAutoCycleOptions':
      if (action.autoBlend !== undefined) s.autoBlend = action.autoBlend;
      if (action.autoFilters !== undefined) s.autoFilters = action.autoFilters;
      if (action.locks) s.locks = { ...s.locks, ...action.locks };
      break;
    case 'startAutoFX':
      if (action.autoBlend !== undefined) s.autoBlend = action.autoBlend;
      if (action.autoFilters !== undefined) s.autoFilters = action.autoFilters;
      break;
    case 'stopAutoFX':
      s.autoBlend = false;
      s.autoFilters = false;
      break;
    case 'textAutoStart':
      s.textState = { text: action.text || '', autoText: true };
      break;
    case 'textAutoStop':
      if (s.textState) s.textState = { ...s.textState, autoText: false };
      break;
    case 'textClear':
      s.textState = null;
      break;
    case 'textDisplay':
      s.textState = { text: action.text || '', autoText: false };
      break;
    // Actions that don't change persisted state:
    // setFadeDuration, setAudioSensitivity, setZoom, setOsdEnabled
    default:
      break;
  }
  return s;
}

// Per-tab state: { tabId: { active, layers[], blendMode, audioEnabled, filters[] } }
// In-memory cache (fast access) + chrome.storage.session (survives SW termination)
const tabState = new Map();

function storageKey(tabId) {
  return 'tab_' + tabId;
}

function setState(tabId, state) {
  const copy = { ...state };
  tabState.set(tabId, copy);
  chrome.storage.session.set({ [storageKey(tabId)]: copy }).catch(e => logWarn('setState/storage', e));
}

async function getState(tabId) {
  const cached = tabState.get(tabId);
  if (cached) return cached;
  // Fallback: restore from storage.session (SW was restarted)
  try {
    const key = storageKey(tabId);
    const result = await chrome.storage.session.get(key);
    if (result[key]) {
      tabState.set(tabId, result[key]);
      return result[key];
    }
  } catch (e) { logWarn('getState/storage', e); }
  return null;
}

function clearState(tabId) {
  tabState.delete(tabId);
  chrome.storage.session.remove(storageKey(tabId)).catch(e => logWarn('clearState/storage', e));
}

// Restore in-memory cache from storage.session on SW startup
chrome.storage.session.get(null).then((all) => {
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('tab_')) {
      const tabId = parseInt(key.slice(4), 10);
      if (!isNaN(tabId)) tabState.set(tabId, value);
    }
  }
}).catch(e => logWarn('restoreCache', e));

function isInjectableUrl(url) {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Inject all scripts and start all layers on a tab
 */
async function injectAndStart(tabId, state) {
  if (!state || !state.active) return false;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isInjectableUrl(tab.url)) return false;

    const layers = state.layers || (state.preset ? [state.preset] : []);
    if (layers.length === 0) return false;

    // Core scripts
    const coreScripts = [
      'lib/p5.min.js',
      'content/base-preset.js',
    ];

    // Preset files for all layers + auto-cycle presets
    const presetSet = new Set(layers);
    if (state.autoCyclePresets) {
      for (const id of state.autoCyclePresets) presetSet.add(id);
    }
    const presetFiles = [...presetSet].map(id => `content/presets/${id}.js`);

    // Inject p5.js first and verify it loaded
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: ['lib/p5.min.js'],
    });

    // Verify p5 is available (retry once if not)
    let [{ result: p5Ready }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => typeof window.p5 === 'function',
    });

    if (!p5Ready) {
      await new Promise(r => setTimeout(r, 200));
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        files: ['lib/p5.min.js'],
      });
      [{ result: p5Ready }] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => typeof window.p5 === 'function',
      });
      if (!p5Ready) return false;
    }

    // Inject base-preset
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: ['content/base-preset.js'],
    });

    // Inject presets in parallel batches of 20
    const BATCH = 20;
    for (let i = 0; i < presetFiles.length; i += BATCH) {
      await Promise.all(presetFiles.slice(i, i + BATCH).map(file =>
        chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          files: [file],
        }).catch(e => console.warn('VJam FX: re-inject failed:', file, e))
      ));
    }

    // Inject text-overlay, engine
    for (const file of ['content/text-overlay.js', 'content/content.js']) {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        files: [file],
      });
    }

    // Start first layer with config
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (layers, blendMode, filters, autoCyclePresets, opacity, autoBlend, autoFilters, locks, textState) => {
        if (!window._vjamFxEngine) return;
        const engine = window._vjamFxEngine;

        // Start first layer
        engine.handleMessage({
          action: 'start',
          preset: layers[0],
          blendMode: blendMode,
        });

        // Add remaining layers
        for (let i = 1; i < layers.length; i++) {
          engine.handleMessage({ action: 'addLayer', preset: layers[i] });
        }

        // Restore filters
        if (filters) {
          for (const f of filters) {
            engine.handleMessage({ action: 'setFilter', filter: f, enabled: true });
          }
        }

        // Restore opacity
        if (opacity !== undefined && opacity !== 1) {
          engine.handleMessage({ action: 'setOpacity', opacity: opacity });
        }

        // Restart auto-cycle if it was active
        if (autoCyclePresets && autoCyclePresets.length > 0) {
          engine.handleMessage({ action: 'startAutoCycle', presets: autoCyclePresets, interval: 8000, autoBlend: autoBlend, autoFilters: autoFilters, locks: locks || {} });
        }

        // Restore text state
        if (textState && textState.text) {
          engine.handleMessage({ action: 'textSetParams', params: { effect: textState.effect, font: textState.font } });
          engine.handleMessage({ action: 'textDisplay', text: textState.text });
          if (textState.autoText) {
            engine.handleMessage({ action: 'textAutoStart', text: textState.text });
          }
        }
      },
      args: [layers, state.blendMode || 'screen', state.filters || [], state.autoCyclePresets || null, state.opacity, !!state.autoBlend, !!state.autoFilters, state.locks || {}, state.textState || null],
    });

    return true;
  } catch (e) {
    logWarn('injectAndStart', e);
    return false;
  }
}

// --- Tab Audio Capture ---

// Track which tab is using tab audio capture
let activeTabAudioTabId = null;
let pausedTabAudioTabId = null; // Saved during fullscreen pause

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Tab audio capture for beat detection',
  });
}

async function removeOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  if (contexts.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}

async function startTabAudio(tabId) {
  try {
    // Stop existing capture first (idempotent)
    if (activeTabAudioTabId !== null) {
      await stopTabAudio(activeTabAudioTabId).catch(e => logWarn('startTabAudio/stopPrev', e));
    }
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ type: 'startCapture', streamId });
    activeTabAudioTabId = tabId;
    return true;
  } catch (e) {
    console.warn('VJam FX: startTabAudio failed', e);
    return false;
  }
}

async function stopTabAudio(tabId) {
  try {
    await chrome.runtime.sendMessage({ type: 'stopCapture' });
    await removeOffscreen();
    activeTabAudioTabId = null;
    return true;
  } catch (e) {
    console.warn('VJam FX: stopTabAudio failed', e);
    return false;
  }
}

// --- Event Listeners ---

async function updateBadge(tabId) {
  const state = await getState(tabId);
  const isOn = state && state.active;
  try {
    chrome.action.setBadgeText({ text: isOn ? 'ON' : '', tabId });
    if (isOn) {
      chrome.action.setBadgeBackgroundColor({ color: '#00cc66', tabId });
    }
  } catch (e) { /* badge API may not be available in tests */ }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'setState') {
    setState(msg.tabId, msg.state);
    updateBadge(msg.tabId);
    sendResponse({ ok: true });
  } else if (msg.type === 'getState') {
    getState(msg.tabId).then(state => sendResponse({ state }));
    return true; // async response
  } else if (msg.type === 'clearState') {
    clearState(msg.tabId);
    updateBadge(msg.tabId);
    sendResponse({ ok: true });
  } else if (msg.type === 'startTabAudio') {
    // tabId from popup (explicit) or from content script bridge (sender.tab)
    const tabId = msg.tabId || (sender && sender.tab && sender.tab.id);
    if (tabId) {
      startTabAudio(tabId).then(ok => sendResponse({ ok }));
      return true;
    }
    sendResponse({ ok: false });
  } else if (msg.type === 'stopTabAudio') {
    const stopTabId = msg.tabId || (sender && sender.tab && sender.tab.id);
    if (stopTabId) {
      stopTabAudio(stopTabId).then(ok => sendResponse({ ok }));
      return true;
    }
    sendResponse({ ok: false });
  } else if (msg.type === 'pauseTabAudio') {
    // Pause capture during fullscreen (Chrome keeps browser chrome visible while capturing)
    if (activeTabAudioTabId !== null) {
      pausedTabAudioTabId = activeTabAudioTabId;
      stopTabAudio(activeTabAudioTabId).then(ok => sendResponse({ ok }));
      return true;
    }
    sendResponse({ ok: false });
  } else if (msg.type === 'resumeTabAudio') {
    // Resume capture after fullscreen exit
    if (pausedTabAudioTabId !== null) {
      const tabId = pausedTabAudioTabId;
      pausedTabAudioTabId = null;
      startTabAudio(tabId).then(ok => sendResponse({ ok }));
      return true;
    }
    sendResponse({ ok: false });
  } else if (msg.type === 'command') {
    // Popup → SW → Content one-way flow
    const tabId = msg.tabId;
    if (!tabId) { sendResponse({ ok: false }); return false; }
    getState(tabId).then(async (current) => {
      let state = current || { ...DEFAULT_TAB_STATE };
      const actions = msg.actions || [];
      for (const action of actions) {
        state = applyAction(state, action);
      }
      setState(tabId, state);
      updateBadge(tabId);
      // Forward actions to content via executeScript
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: (messages) => {
            if (window._vjamFxEngine) {
              window._vjamFxEngine.handleBatch(messages);
            }
          },
          args: [actions],
        });
      } catch (e) { logWarn('command/forward', e); }
      sendResponse({ ok: true, state });
    });
    return true; // async response
  } else if (msg.type === 'audioData' && activeTabAudioTabId) {
    // Relay audio data from offscreen to the target tab's bridge
    chrome.tabs.sendMessage(activeTabAudioTabId, {
      type: 'audioData',
      data: msg.data,
    }).catch(e => logWarn('audioRelay', e));
    sendResponse({ ok: true });
  }
  return false;
});

// Re-inject on navigation complete
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;

  const state = await getState(details.tabId);
  if (!state || !state.active) return;

  // Small delay to ensure page is ready
  await new Promise(r => setTimeout(r, 300));

  const injected = await injectAndStart(details.tabId, state);

  // Restart video audio capture + tabCapture fallback if audio was enabled
  if (injected && state.audioEnabled !== false) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        world: 'MAIN',
        func: () => {
          if (window._vjamFxEngine) {
            window._vjamFxEngine.handleMessage({ action: 'startVideoAudio' });
          }
        },
      });
    } catch (e) { logWarn('navRestore/videoAudio', e); }
    // Start tabCapture as fallback (content will stop it if media element found)
    startTabAudio(details.tabId).catch(e => logWarn('navRestore/tabAudio', e));
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  clearState(tabId);
  if (activeTabAudioTabId === tabId) {
    stopTabAudio(tabId).catch(e => logWarn('tabRemoved/stopAudio', e));
  }
});
