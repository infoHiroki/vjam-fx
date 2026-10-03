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
// (全タブで ON はタブの一覧を tabState から見るので、読み終わるまで待てるように持っておく)
const restored = chrome.storage.session.get(null).then((all) => {
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

// --- 全タブで ON(popup の設定 vjamfx_settings.allTabs) ---
// ON の間は、前に出ているタブに、popup で最後に ON にしていた状態で入れる。裏に回ったタブは止める。
// 持っていく状態は storage.session に置く(ブラウザを閉じたら忘れる。次はどこかで 1 回 ON にしてから)
const ALL_TABS_STATE_KEY = 'allTabsState';

async function isAllTabsOn() {
  try {
    const result = await chrome.storage.local.get('vjamfx_settings');
    return !!(result.vjamfx_settings && result.vjamfx_settings.allTabs);
  } catch (e) {
    return false;
  }
}

async function getAllTabsState() {
  try {
    const result = await chrome.storage.session.get(ALL_TABS_STATE_KEY);
    return result[ALL_TABS_STATE_KEY] || null;
  } catch (e) {
    return null;
  }
}

function setAllTabsState(state) {
  if (state) {
    chrome.storage.session.set({ [ALL_TABS_STATE_KEY]: { ...state } }).catch(() => {});
  } else {
    chrome.storage.session.remove(ALL_TABS_STATE_KEY).catch(() => {});
  }
}

// --- 重いプリセット(#40) ---
// エンジンがこの端末で重いと判断したもの。storage.local の heavyPresets = { プリセット名: { fps, at } }。
// popup は Next / Auto のプールから除く。SW もページ遷移の復帰・全タブで ON で除く
const HEAVY_KEY = 'heavyPresets';
const PRESET_NAME = /^[a-z0-9-]+$/;

async function getHeavyPresets() {
  try {
    const result = await chrome.storage.local.get(HEAVY_KEY);
    return result[HEAVY_KEY] || {};
  } catch (e) {
    return {};
  }
}

// 知らせが重なっても 1 つずつ書く(読んで足して書くので)
let heavyWrite = Promise.resolve();

function saveHeavyPreset(name, fps) {
  heavyWrite = heavyWrite.then(async () => {
    const heavy = await getHeavyPresets();
    heavy[name] = { fps: typeof fps === 'number' ? fps : null, at: new Date().toISOString() };
    await chrome.storage.local.set({ [HEAVY_KEY]: heavy });
  }).catch(() => {});
  return heavyWrite;
}

// プールから重いものを除く(全部重いならそのまま)
function withoutHeavy(ids, heavy) {
  const light = ids.filter(id => !heavy[id]);
  return light.length ? light : ids;
}

// エンジンが重いレイヤーを入れ替えた: 覚えて、タブの状態・全タブで ON の状態のレイヤーも入れ替える(遷移後に重いものを戻さない)
async function onHeavyPreset(tabId, { name, fps, replacement }) {
  saveHeavyPreset(name, fps);
  const swap = (state) => {
    if (!state || !Array.isArray(state.layers) || !state.layers.includes(name)) return null;
    const layers = [...new Set(state.layers.map(id => id === name ? replacement : id).filter(id => PRESET_NAME.test(id || '')))];
    return layers.length ? { ...state, layers } : null;
  };
  const tabNext = tabId ? swap(await getState(tabId)) : null;
  if (tabNext) setState(tabId, tabNext);
  const allNext = swap(await getAllTabsState());
  if (allNext) setAllTabsState(allNext);
}

/**
 * Inject all scripts and start all layers on a tab
 */
async function injectAndStart(tabId, state) {
  if (!state || !state.active) return false;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isInjectableUrl(tab.url)) return false;

    let layers = state.layers || (state.preset ? [state.preset] : []);
    // Auto のプールから重いものを除く。Auto が回るならレイヤーからも(最初の切り替えで入れ替わる。全部重ければプールの 1 本目)
    const heavy = await getHeavyPresets();
    const autoCyclePresets = state.autoCyclePresets && state.autoCyclePresets.length > 0
      ? withoutHeavy(state.autoCyclePresets, heavy) : null;
    if (autoCyclePresets) {
      const light = layers.filter(id => !heavy[id]);
      layers = light.length ? light : autoCyclePresets.slice(0, 1);
    }
    if (layers.length === 0) return false;

    // Core scripts
    const coreScripts = [
      'lib/p5.min.js',
      'content/base-preset.js',
    ];

    // Preset files for all layers + auto-cycle presets
    const presetSet = new Set(layers);
    if (autoCyclePresets) {
      for (const id of autoCyclePresets) presetSet.add(id);
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
      func: (layers, blendMode, filters, autoCyclePresets, opacity, autoBlend, autoFilters, locks, textState, pool, interval, fadeDuration, audioSensitivity) => {
        if (!window._vjamFxEngine) return;
        const engine = window._vjamFxEngine;

        // popup の設定(フェード時間・音の感度)を戻す。最初のレイヤーのフェードインから効かせるため start より前に送る
        // 保存が無いとき(古い状態)は送らない = エンジン既定
        if (fadeDuration != null) {
          engine.handleMessage({ action: 'setFadeDuration', duration: fadeDuration });
        }
        if (audioSensitivity != null) {
          engine.handleMessage({ action: 'setAudioSensitivity', sensitivity: audioSensitivity });
        }

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

        // Restart auto-cycle if it was active(Rnd の filter / blend は popup と同じデフォルトプールから)
        // Auto が OFF でも Rnd が ON なら、Rnd だけ再開する(popup と同じ)。interval は popup の Cycle(無ければエンジン既定の 15 秒)
        if (autoCyclePresets && autoCyclePresets.length > 0) {
          engine.handleMessage({ action: 'startAutoCycle', presets: autoCyclePresets, interval: interval, autoBlend: autoBlend, autoFilters: autoFilters, locks: locks || {}, pool: pool });
        } else if (autoBlend || autoFilters) {
          engine.handleMessage({ action: 'startAutoFX', autoBlend: autoBlend, autoFilters: autoFilters, interval: interval, pool: pool });
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
      args: [layers, state.blendMode || 'screen', state.filters || [], autoCyclePresets, state.opacity, !!state.autoBlend, !!state.autoFilters, state.locks || {}, state.textState || null, state.pool || null, state.cycleSeconds > 0 ? state.cycleSeconds * 1000 : null, state.fadeDuration ?? null, state.audioSensitivity ?? null],
    });

    return true;
  } catch (e) {
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
  // Only stop if the given tabId matches active capture (or no tabId specified)
  if (tabId && activeTabAudioTabId !== null && activeTabAudioTabId !== tabId) return false;
  try {
    await chrome.runtime.sendMessage({ type: 'stopCapture' });
    await removeOffscreen();
    activeTabAudioTabId = null;
    return true;
  } catch (e) {
    console.warn('VJam FX: stopTabAudio failed', e);
    activeTabAudioTabId = null; // Clear state even on failure
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
    // 全タブで ON が持っていく状態 = popup で最後に ON にしていた状態
    if (msg.state && msg.state.active) setAllTabsState(msg.state);
    sendResponse({ ok: true });
  } else if (msg.type === 'getState') {
    getState(msg.tabId).then(state => sendResponse({ state }));
    return true; // async response
  } else if (msg.type === 'clearState') {
    const wasOn = !!(tabState.get(msg.tabId) || {}).active;
    clearState(msg.tabId);
    updateBadge(msg.tabId);
    // 動いていたタブを popup で OFF にした = 全部止まる(全タブで ON でも、次に ON にするまでどこにも入れない)
    if (wasOn) {
      setAllTabsState(null);
      stopOtherTabs(msg.tabId).catch(() => {});
    }
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
  } else if (msg.type === 'heavyPreset') {
    // エンジン → bridge から: このタブで重いと分かったプリセット(#40)
    if (PRESET_NAME.test(msg.name || '')) onHeavyPreset(sender && sender.tab && sender.tab.id, msg).catch(() => {});
    sendResponse({ ok: true });
  } else if (msg.type === 'injectPreset') {
    // エンジン → bridge から: 入れ替え先のプリセットがまだ読み込まれていない(Next で選んだものしか入れていないとき)
    const injectTabId = sender && sender.tab && sender.tab.id;
    if (injectTabId && PRESET_NAME.test(msg.name || '')) {
      chrome.scripting.executeScript({
        target: { tabId: injectTabId },
        world: 'MAIN',
        files: [`content/presets/${msg.name}.js`],
      }).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
      return true;
    }
    sendResponse({ ok: false });
  } else if (msg.type === 'audioData' && activeTabAudioTabId) {
    // Relay audio data from offscreen to the target tab's bridge
    chrome.tabs.sendMessage(activeTabAudioTabId, {
      type: 'audioData',
      data: msg.data,
    }).catch(() => {}); // ignore if tab is gone
    sendResponse({ ok: true });
  } else {
    // Unknown message type — return false (no async response needed)
    return false;
  }
  return false;
});

// ページ遷移の復帰(全タブで ON で入れるときもこれを使う)。
// 音は <video> / <audio> から。tabCapture はユーザーの操作が要るので、自動で入ったタブ(autoInjected)では使わない
async function restoreTab(tabId, state) {
  const injected = await injectAndStart(tabId, state);

  if (injected && state.audioEnabled !== false) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          if (window._vjamFxEngine) {
            window._vjamFxEngine.handleMessage({ action: 'startVideoAudio' });
          }
        },
      });
    } catch (e) { /* ignore */ }
    // Start tabCapture as fallback (content will stop it if media element found)
    if (!state.autoInjected) startTabAudio(tabId).catch(() => {});
  }
  return injected;
}

// 全タブで ON: 前に出ているタブに入れる。入れている途中に onActivated と onCompleted が重なっても 1 回だけ
const followingTabs = new Set();

async function followTab(tabId, allTabsState) {
  if (followingTabs.has(tabId)) return;
  followingTabs.add(tabId);
  try {
    const state = { ...allTabsState, autoInjected: true };
    if (!(await restoreTab(tabId, state))) return;
    setState(tabId, state);
    updateBadge(tabId);
    // 入れている間に裏に回っていたら止める
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || !tab.active) await stopTab(tabId);
  } finally {
    followingTabs.delete(tabId);
  }
}

// 裏に回ったタブを止める(軽さのため。前に出たら入れ直す)。
// 音は analyser だけ外す(source→destination は残す=ページの音は鳴り続ける。AudioContext を閉じると要素の音が戻らない)
async function stopTab(tabId) {
  clearState(tabId);
  updateBadge(tabId);
  if (activeTabAudioTabId === tabId) stopTabAudio(tabId).catch(() => {});
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const e = window._vjamFxEngine;
        if (!e) return;
        e.handleMessage({ action: 'stopVideoAudio' });
        e.handleMessage({ action: 'stop' });
        // テキストは stop で外れたオーバーレイの中にあるので作り直させる(入れ直すときに textState から戻る)
        if (e._textOverlay) { e._textOverlay.destroy(); e._textOverlay = null; }
      },
    });
  } catch (e) { /* tab gone / not injectable */ }
}

// 全タブで ON の間に OFF にしたら、ほかで動いているタブも止める
async function stopOtherTabs(tabId) {
  if (!(await isAllTabsOn())) return;
  await restored;
  for (const [id, state] of [...tabState]) {
    if (id !== tabId && state && state.active) await stopTab(id);
  }
}

// Re-inject on navigation complete
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;

  const state = await getState(details.tabId);

  if (await isAllTabsOn()) {
    const tab = await chrome.tabs.get(details.tabId).catch(() => null);
    // 裏のタブには入れない(新しいページにはエンジンが無いので、状態も消して前に出たときに入れる)
    if (!tab || !tab.active) {
      if (state) {
        clearState(details.tabId);
        updateBadge(details.tabId);
      }
      return;
    }
    if (!state || !state.active) {
      const allTabsState = await getAllTabsState();
      if (!allTabsState) return;
      await new Promise(r => setTimeout(r, 300));
      await followTab(details.tabId, allTabsState);
      return;
    }
  }

  if (!state || !state.active) return;

  // Small delay to ensure page is ready
  await new Promise(r => setTimeout(r, 300));

  await restoreTab(details.tabId, state);
});

// 全タブで ON: タブを切り替えたら、同じウィンドウで裏に回ったタブを止めて、前に出たタブに入れる
// (別のウィンドウの前のタブは見えているので止めない)
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  if (!(await isAllTabsOn())) return;

  await restored;
  const tabs = await chrome.tabs.query({ windowId }).catch(() => []);
  for (const t of tabs) {
    const s = tabState.get(t.id);
    if (t.id !== tabId && s && s.active) await stopTab(t.id);
  }

  const allTabsState = await getAllTabsState();
  if (!allTabsState) return;
  const state = await getState(tabId);
  if (state && state.active) return; // もう動いている
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  // 読み込み中なら webNavigation.onCompleted で入れる
  if (!tab || tab.status !== 'complete') return;
  await followTab(tabId, allTabsState);
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  clearState(tabId);
  if (activeTabAudioTabId === tabId) {
    stopTabAudio(tabId).catch(() => {});
  }
  if (pausedTabAudioTabId === tabId) {
    pausedTabAudioTabId = null;
  }
});
