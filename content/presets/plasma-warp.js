(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PlasmaWarpPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._time = 0;
  }

  setup(container) {
    this.destroy();
    const preset = this;
    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight, p.WEBGL);
        p.pixelDensity(1);
      };
      p.draw = () => {
        if (!preset._shader) { preset._shader = preset._initShader(p); if (!preset._shader) return; }
        preset._time += 0.02 + preset.audio.bass * 0.03;
        preset.beatPulse *= 0.9;
        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          p.noStroke();
          p.quad(-1, -1, 1, -1, 1, 1, -1, 1);
        } catch (e) {} finally { p.resetShader(); }
      };
      p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
    }, container);
  }

  _initShader(p) {
    const vert = `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vUv;
      void main() { vUv = aTexCoord; vec4 pos = vec4(aPosition, 1.0); pos.xy = pos.xy * 2.0 - 1.0; gl_Position = pos; }
    `;
    const frag = `
      precision highp float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float t = u_time;

        // Base wave amplitudes modulated by bass (breathing effect)
        float amp = 1.0 + u_bass * 0.8;

        // Wave frequency modulated by mid
        float freq = 1.0 + u_mid * 0.5;

        // Layer 1: slow diagonal wave
        float w1 = sin(uv.x * 3.0 * freq + t * 0.7) * amp;
        w1 += cos(uv.y * 2.5 * freq + t * 0.6) * amp;

        // Layer 2: circular wave from center
        float r = length(uv);
        float w2 = sin(r * 6.0 * freq - t * 0.9) * amp * 0.8;

        // Layer 3: rotating wave
        float angle = atan(uv.y, uv.x);
        float w3 = sin(angle * 3.0 + r * 4.0 * freq + t * 0.5) * amp * 0.7;

        // Layer 4: cross-interference pattern
        float w4 = cos(uv.x * 5.0 * freq + sin(uv.y * 3.0 + t * 0.4)) * amp * 0.6;
        w4 += sin(uv.y * 4.0 * freq + cos(uv.x * 2.0 + t * 0.3)) * amp * 0.5;

        // Layer 5: treble fine detail ripples
        float w5 = sin(uv.x * 12.0 + uv.y * 8.0 + t * 1.5) * u_treble * 0.6;
        w5 += cos(uv.x * 9.0 - uv.y * 11.0 + t * 1.2) * u_treble * 0.5;

        // Combine all waves
        float plasma = (w1 + w2 + w3 + w4 + w5) * 0.25;

        // Cosine palette color cycling
        vec3 col = 0.5 + 0.5 * cos(plasma + t * 0.3 + uv.xyx + vec3(0.0, 2.0, 4.0));

        // Beat: brief color inversion and brightness flash
        col = mix(col, 1.0 - col, u_beat * 0.6);
        col += vec3(u_beat * 0.3);

        // Ensure full brightness, no dark areas
        col = clamp(col, 0.0, 1.0);

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['plasma-warp'] = PlasmaWarpPreset;
})();
