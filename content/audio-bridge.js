/**
 * VJam FX — Audio Bridge (ISOLATED world content script)
 * Relays audioData from Service Worker to MAIN world via window.postMessage.
 * Handles tabCapture fallback requests from MAIN world engine.
 * 重いプリセットの知らせと、入れ替え先の読み込みも SW へ中継する(#40)。
 * Registered in manifest.json content_scripts (runs on all URLs).
 */
(function() {
  'use strict';

  // Relay audio data from SW → MAIN world
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'audioData') {
      window.postMessage({
        source: 'vjam-fx-bridge',
        type: 'audioData',
        data: msg.data,
      }, '*');
      sendResponse({ ok: true });
    }
  });

  // Listen for tabCapture fallback requests from MAIN world engine
  // (when no <video>/<audio> element is found on the page)
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.source === 'vjam-fx-engine' && event.data.type === 'requestTabCapture') {
      chrome.runtime.sendMessage({ type: 'startTabAudio' }).catch(function() {});
    }
    if (event.data && event.data.source === 'vjam-fx-engine' && event.data.type === 'stopTabCapture') {
      chrome.runtime.sendMessage({ type: 'stopTabAudio' }).catch(function() {});
    }
    if (event.data && event.data.source === 'vjam-fx-engine' && event.data.type === 'pauseTabCapture') {
      chrome.runtime.sendMessage({ type: 'pauseTabAudio' }).catch(function() {});
    }
    if (event.data && event.data.source === 'vjam-fx-engine' && event.data.type === 'resumeTabCapture') {
      chrome.runtime.sendMessage({ type: 'resumeTabAudio' }).catch(function() {});
    }
    // 重いプリセット(#40): エンジンが見つけたものを SW に知らせる(SW が端末に覚える)
    if (event.data && event.data.source === 'vjam-fx-engine' && event.data.type === 'heavyPreset') {
      chrome.runtime.sendMessage({
        type: 'heavyPreset', name: event.data.name, fps: event.data.fps, replacement: event.data.replacement,
      }).catch(function() {});
    }
    // 入れ替え先のプリセットを SW に読み込んでもらい、読み込めたらエンジンに返す
    if (event.data && event.data.source === 'vjam-fx-engine' && event.data.type === 'injectPreset') {
      var name = event.data.name;
      chrome.runtime.sendMessage({ type: 'injectPreset', name: name }).then(function(res) {
        if (res && res.ok) {
          window.postMessage({ source: 'vjam-fx-bridge', type: 'presetInjected', name: name }, '*');
        }
      }).catch(function() {});
    }
  });
})();
