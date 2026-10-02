(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class AuroraShaderPreset extends BasePreset {
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
        preset.beatPulse *= 0.92;
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

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float t = u_time;

        // Curtain shape: vertical waves
        float curtain = 0.0;
        for (float i = 0.0; i < 5.0; i++) {
          float freq = 1.5 + i * 0.7;
          float speed = 0.3 + i * 0.1;
          float amp = 0.15 / (i + 1.0);
          curtain += sin(uv.x * freq + t * speed + u_bass * 2.0 + i) * amp;
        }

        // Aurora band position (centered upper half)
        float band = uv.y - 0.1 - curtain;
        float aurora = exp(-band * band * (8.0 + u_treble * 4.0));

        // Noise detail within aurora
        float detail = fbm(vec2(uv.x * 3.0 + t * 0.2, band * 5.0 + t * 0.1));
        aurora *= 0.6 + detail * 0.6;

        // Multiple color layers
        vec3 green = vec3(0.1, 0.9, 0.3) * aurora;
        float band2 = uv.y - 0.25 - curtain * 0.8;
        float aurora2 = exp(-band2 * band2 * 12.0) * 0.6;
        vec3 purple = vec3(0.6, 0.1, 0.8) * aurora2;

        float band3 = uv.y + 0.05 - curtain * 1.2;
        float aurora3 = exp(-band3 * band3 * 15.0) * 0.4;
        vec3 cyan = vec3(0.1, 0.7, 0.9) * aurora3;

        vec3 col = green + purple + cyan;

        // Bass makes aurora brighter and wider
        col *= 1.0 + u_bass * 0.5;

        // Beat: flash of white in the aurora
        col += vec3(1.0) * aurora * u_beat * 0.4;

        // Stars in dark areas
        float star = step(0.998, hash(floor(gl_FragCoord.xy * 0.5)));
        float twinkle = sin(t * 3.0 + hash(floor(gl_FragCoord.xy * 0.5) + 1.0) * 20.0) * 0.5 + 0.5;
        col += vec3(star * twinkle * 0.7 * (1.0 - aurora));

        // Dark sky gradient
        vec3 sky = mix(vec3(0.0, 0.02, 0.05), vec3(0.02, 0.0, 0.04), uv.y + 0.5);
        col += sky;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['aurora-shader'] = AuroraShaderPreset;
})();
