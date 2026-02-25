/**
 * VJam FX — Service Worker (Background Script)
 * Persists effect state across page navigations.
 * Supports multi-layer presets and CSS filters.
 */

// Per-tab state: { tabId: { active, layers[], blendMode, micEnabled, filters[] } }
const tabState = new Map();

function setState(tabId, state) {
  tabState.set(tabId, { ...state });
}

function getState(tabId) {
  return tabState.get(tabId) || null;
}

function clearState(tabId) {
  tabState.delete(tabId);
}

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
      'content/audio-analyzer.js',
    ];

    // Preset files for all layers + auto-cycle presets
    const presetSet = new Set(layers);
    if (state.autoCyclePresets) {
      for (const id of state.autoCyclePresets) presetSet.add(id);
    }
    const presetFiles = [...presetSet].map(id => `content/presets/${id}.js`);

    // Engine last
    const allScripts = [...coreScripts, ...presetFiles, 'content/content.js'];

    for (const file of allScripts) {
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
      func: (layers, blendMode, micEnabled, filters, autoCyclePresets) => {
        if (!window._vjamFxEngine) return;
        const engine = window._vjamFxEngine;

        // Start first layer
        engine.handleMessage({
          action: 'start',
          preset: layers[0],
          blendMode: blendMode,
          mic: micEnabled,
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

        // Restart auto-cycle if it was active
        if (autoCyclePresets && autoCyclePresets.length > 0) {
          engine.handleMessage({ action: 'startAutoCycle', presets: autoCyclePresets, interval: 8000 });
        }
      },
      args: [layers, state.blendMode || 'screen', state.micEnabled !== false, state.filters || [], state.autoCyclePresets || null],
    });

    return true;
  } catch (e) {
    return false;
  }
}

// --- Event Listeners ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'setState') {
    setState(msg.tabId, msg.state);
    sendResponse({ ok: true });
  } else if (msg.type === 'getState') {
    const state = getState(msg.tabId);
    sendResponse({ state });
  } else if (msg.type === 'clearState') {
    clearState(msg.tabId);
    sendResponse({ ok: true });
  }
  return false;
});

// Re-inject on navigation complete
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;

  const state = getState(details.tabId);
  if (!state || !state.active) return;

  // Small delay to ensure page is ready
  await new Promise(r => setTimeout(r, 300));

  await injectAndStart(details.tabId, state);
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  clearState(tabId);
});
