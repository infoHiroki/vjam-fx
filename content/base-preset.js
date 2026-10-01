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
      // VJam 本体と同じ: サブクラスの static paramDefs の default を params に入れる(paramDefs の無いプリセットには何もしない)
      const defs = this.constructor && this.constructor.paramDefs;
      if (Array.isArray(defs)) {
        for (const d of defs) {
          if (!d || !d.key) continue;
          if (d.default === undefined) continue;
          if (this.params[d.key] !== undefined) continue;
          this.params[d.key] = d.default;
        }
      }
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
