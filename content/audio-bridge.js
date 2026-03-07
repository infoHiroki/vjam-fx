/**
 * VJam FX — Audio Bridge (ISOLATED world content script)
 * Relays audioData from Service Worker to MAIN world via window.postMessage.
 * Handles tabCapture fallback requests from MAIN world engine.
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
  });
})();
