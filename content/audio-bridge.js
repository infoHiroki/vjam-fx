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

  // Chrome won't hide browser chrome while tabCapture is active.
  // Strategy: on fullscreen enter → pause capture → exit → re-enter without capture.
  // Capture stays paused during fullscreen, resumes on real exit.
  // State machine: idle → exiting → retrying → active → idle
  // Key: re-enter logic lives in the EXIT handler to avoid promise/event race.
  var _fsPhase = 'idle';
  var _fsElement = null;
  document.addEventListener('fullscreenchange', function() {
    if (document.fullscreenElement) {
      // --- ENTERING fullscreen ---
      if (_fsPhase === 'retrying') {
        _fsPhase = 'active';
        return;
      }
      if (_fsPhase !== 'idle') return;
      _fsPhase = 'exiting';
      _fsElement = document.fullscreenElement;
      // Pause capture then exit; re-enter is driven by exit handler below
      chrome.runtime.sendMessage({ type: 'pauseTabAudio' })
        .then(function(resp) {
          if (!resp || !resp.ok) {
            // No active capture — skip the exit-re-enter dance
            _fsPhase = 'idle';
            _fsElement = null;
            return;
          }
          return document.exitFullscreen();
        })
        .catch(function() {
          _fsPhase = 'idle';
          _fsElement = null;
        });
    } else {
      // --- EXITING fullscreen ---
      if (_fsPhase === 'exiting') {
        // Our programmatic exit — re-enter after short delay
        _fsPhase = 'retrying';
        var el = _fsElement;
        setTimeout(function() {
          if (el) {
            el.requestFullscreen().catch(function() {
              _fsPhase = 'idle';
              _fsElement = null;
              chrome.runtime.sendMessage({ type: 'resumeTabAudio' }).catch(function() {});
            });
          }
        }, 150);
        return;
      }
      if (_fsPhase === 'retrying') return; // waiting for re-enter
      // Real user exit (from 'active' or 'idle')
      _fsPhase = 'idle';
      _fsElement = null;
      chrome.runtime.sendMessage({ type: 'resumeTabAudio' }).catch(function() {});
    }
  });
})();
