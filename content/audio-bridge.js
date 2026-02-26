/**
 * VJam FX — Audio Bridge (ISOLATED world content script)
 * Relays audioData from Service Worker to MAIN world via window.postMessage.
 * Registered in manifest.json content_scripts (runs on all URLs).
 */
(function() {
  'use strict';

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'audioData') {
      window.postMessage({
        source: 'vjam-fx-bridge',
        type: 'audioData',
        data: msg.data,
      }, '*');
    }
  });
})();
