/**
 * VJam FX — Service Worker (Background Script)
 * Persists effect state across page navigations.
 * On navigation complete, re-injects scripts and restarts the effect.
 */

// Per-tab state: { tabId: { active, preset, blendMode, micEnabled } }
const tabState = new Map();

/**
 * Save state for a tab
 */
function setState(tabId, state) {
  tabState.set(tabId, { ...state });
}

/**
 * Get state for a tab
 */
function getState(tabId) {
  return tabState.get(tabId) || null;
}

/**
 * Clear state for a tab
 */
function clearState(tabId) {
  tabState.delete(tabId);
}

/**
 * Check if a URL is injectable (not restricted)
 */
function isInjectableUrl(url) {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Inject all scripts and start the effect on a tab
 */
async function injectAndStart(tabId, state) {
  if (!state || !state.active) return false;

  try {
    // Check tab URL
    const tab = await chrome.tabs.get(tabId);
    if (!isInjectableUrl(tab.url)) return false;

    // Inject scripts in order: p5 → base-preset → audio-analyzer → preset → engine
    const presetFile = `content/presets/${state.preset}.js`;
    const scripts = [
      'lib/p5.min.js',
      'content/base-preset.js',
      'content/audio-analyzer.js',
      presetFile,
      'content/content.js',
    ];

    for (const file of scripts) {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        files: [file],
      });
    }

    // Send start command
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (preset, blendMode, micEnabled) => {
        if (window._vjamFxEngine) {
          window._vjamFxEngine.handleMessage({
            action: 'start',
            preset: preset,
            blendMode: blendMode,
            mic: micEnabled,
          });
        }
      },
      args: [state.preset, state.blendMode, state.micEnabled],
    });

    return true;
  } catch (e) {
    // Tab may have been closed or URL restricted
    return false;
  }
}

// --- Event Listeners ---

// Listen for messages from popup
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
  return false; // Synchronous response
});

// Re-inject on navigation complete (same tab, new page)
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only main frame (not iframes)
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
