/**
 * VJam FX — Service Worker (Background Script)
 * Persists effect state across page navigations.
 * Supports multi-layer presets and CSS filters.
 */

// Per-tab state: { tabId: { active, layers[], blendMode, audioEnabled, filters[] } }
// In-memory cache (fast access) + chrome.storage.session (survives SW termination)
const tabState = new Map();

function storageKey(tabId) {
  return 'tab_' + tabId;
}

function setState(tabId, state) {
  const copy = { ...state };
  tabState.set(tabId, copy);
  chrome.storage.session.set({ [storageKey(tabId)]: copy }).catch(() => {});
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
  } catch (e) { /* ignore */ }
  return null;
}

function clearState(tabId) {
  tabState.delete(tabId);
  chrome.storage.session.remove(storageKey(tabId)).catch(() => {});
}

// Restore in-memory cache from storage.session on SW startup
chrome.storage.session.get(null).then((all) => {
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('tab_')) {
      const tabId = parseInt(key.slice(4), 10);
      if (!isNaN(tabId)) tabState.set(tabId, value);
    }
  }
}).catch(() => {});

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

    // Engine last
    const allScripts = [...coreScripts, ...presetFiles, 'content/content.js'];

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

    // Inject remaining scripts (base-preset, presets, engine)
    const remainingScripts = [...coreScripts.slice(1), ...presetFiles, 'content/content.js'];
    for (const file of remainingScripts) {
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
      func: (layers, blendMode, filters, autoCyclePresets, opacity, autoBlend, autoFilters) => {
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
          engine.handleMessage({ action: 'startAutoCycle', presets: autoCyclePresets, interval: 8000, autoBlend: autoBlend, autoFilters: autoFilters });
        }
      },
      args: [layers, state.blendMode || 'screen', state.filters || [], state.autoCyclePresets || null, state.opacity, !!state.autoBlend, !!state.autoFilters],
    });

    return true;
  } catch (e) {
    return false;
  }
}

// --- Tab Audio Capture ---

// Track which tab is using tab audio capture
let activeTabAudioTabId = null;

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
      await stopTabAudio(activeTabAudioTabId).catch(() => {});
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
    startTabAudio(msg.tabId).then(ok => sendResponse({ ok }));
    return true; // async response
  } else if (msg.type === 'stopTabAudio') {
    stopTabAudio(msg.tabId).then(ok => sendResponse({ ok }));
    return true; // async response
  } else if (msg.type === 'audioData' && activeTabAudioTabId) {
    // Relay audio data from offscreen to the target tab's bridge
    chrome.tabs.sendMessage(activeTabAudioTabId, {
      type: 'audioData',
      data: msg.data,
    }).catch(() => {}); // ignore if tab is gone
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

  await injectAndStart(details.tabId, state);

  // Restart tab audio capture if it was enabled
  if (state.audioEnabled !== false) {
    await startTabAudio(details.tabId);
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  clearState(tabId);
  if (activeTabAudioTabId === tabId) {
    stopTabAudio(tabId).catch(() => {});
  }
});
