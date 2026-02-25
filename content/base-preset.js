/**
 * VJam FX — Base Preset
 * Loaded as classic script via chrome.scripting.executeScript
 */
(function() {
  'use strict';

  class BasePreset {
    constructor() {
      this.p5 = null;
      this.params = {};
    }

    setup(container) {}

    updateAudio(audioData) {}

    onBeat(strength) {}

    setParam(key, value) {
      this.params[key] = value;
    }

    destroy() {
      if (this.p5) {
        this.p5.remove();
        this.p5 = null;
      }
    }
  }

  window.VJamFX = window.VJamFX || { presets: {} };
  window.VJamFX.BasePreset = BasePreset;
})();
