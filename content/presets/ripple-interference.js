(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class RippleInterferencePreset extends BasePreset {
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
        preset._time += 0.025 + preset.audio.bass * 0.04;
        preset.beatPulse *= 0.88;
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
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        float freq = 12.0 + u_mid * 18.0;
        float amp = 0.6 + u_bass * 0.8;
        float t = u_time;

        // 4 wave sources orbiting at different radii and speeds
        vec2 src0 = vec2(cos(t * 0.7) * 0.35, sin(t * 0.9) * 0.35);
        vec2 src1 = vec2(cos(t * 0.5 + 2.094) * 0.4, sin(t * 0.6 + 2.094) * 0.4);
        vec2 src2 = vec2(cos(t * 0.8 + 4.189) * 0.3, sin(t * 0.7 + 4.189) * 0.3);
        vec2 src3 = vec2(cos(t * 0.3 + 1.0) * 0.25, sin(t * 1.1 + 1.0) * 0.25);

        // Compute wave from each source
        float d0 = length(uv - src0);
        float d1 = length(uv - src1);
        float d2 = length(uv - src2);
        float d3 = length(uv - src3);

        float wave = 0.0;
        wave += sin(d0 * freq - t * 3.0) * amp / (1.0 + d0 * 4.0);
        wave += sin(d1 * freq - t * 2.8) * amp / (1.0 + d1 * 4.0);
        wave += sin(d2 * freq - t * 3.2) * amp / (1.0 + d2 * 4.0);
        wave += sin(d3 * freq - t * 2.5) * amp / (1.0 + d3 * 4.0);

        // Beat burst from center
        float dc = length(uv);
        wave += sin(dc * (freq * 1.5) - t * 5.0) * u_beat * 1.2 / (1.0 + dc * 3.0);

        // Normalize to -1..1 range approximately
        wave *= 0.35;

        // Interference intensity for color mapping
        float intensity = wave * 0.5 + 0.5;
        float sharp = abs(wave);

        // Color palette: cool blues, greens, whites
        float saturation = 0.5 + u_treble * 0.5;
        vec3 col;
        col.r = intensity * 0.3 + sharp * 0.2;
        col.g = intensity * 0.6 + sharp * 0.5 * saturation;
        col.b = intensity * 0.9 + sharp * 0.4;

        // Bright interference fringes
        float fringe = pow(sharp, 1.5) * 1.8;
        col += vec3(fringe * 0.4, fringe * 0.7, fringe) * saturation;

        // White highlights at constructive peaks
        float peak = smoothstep(0.7, 1.0, intensity);
        col += vec3(peak * 0.6);

        // Subtle dark at destructive interference
        col *= 0.7 + intensity * 0.5;

        // Clamp
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
window.VJamFX.presets['ripple-interference'] = RippleInterferencePreset;
})();
