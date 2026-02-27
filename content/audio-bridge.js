/**
 * VJam FX — Audio Bridge (ISOLATED world content script)
 * Relays audioData from Service Worker to MAIN world via window.postMessage.
 * Pauses tab audio capture during fullscreen (Chrome keeps browser chrome
 * visible while tabCapture is active as a security measure).
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

  // Pause/resume tab audio capture around fullscreen transitions.
  // Chrome won't hide browser chrome while tabCapture is active.
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      chrome.runtime.sendMessage({ type: 'pauseTabAudio' }).catch(() => {});
    } else {
      chrome.runtime.sendMessage({ type: 'resumeTabAudio' }).catch(() => {});
    }
  });
})();
