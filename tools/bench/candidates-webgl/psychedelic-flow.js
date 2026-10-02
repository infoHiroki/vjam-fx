(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PsychedelicFlowPreset extends BasePreset {
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
        preset._time += 0.008 + preset.audio.mid * 0.02;
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
      precision mediump float;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      vec3 hsv2rgb(float h, float s, float v) {
        vec3 c = vec3(h, s, v);
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      // Hash for pseudo-random gradient
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Smooth noise
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // Fractal Brownian Motion
      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        for (int i = 0; i < 5; i++) {
          val += amp * noise(p * freq);
          freq *= 2.0;
          amp *= 0.5;
          p += vec2(1.7, 9.2);
        }
        return val;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

        float t = u_time;
        float bassAmt = u_bass;
        float midAmt = u_mid;
        float trebleAmt = u_treble;
        float beat = u_beat;

        // --- Domain warping: warp UV through multiple FBM layers ---

        // First warp layer
        vec2 q = vec2(
          fbm(p * 2.0 + vec2(t * 0.3, t * 0.2)),
          fbm(p * 2.0 + vec2(t * 0.2 + 5.2, t * 0.3 + 1.3))
        );

        // Second warp layer - bass drives distortion intensity
        float distortion = 1.5 + bassAmt * 2.0;
        vec2 r = vec2(
          fbm(p * 2.0 + q * distortion + vec2(1.7, 9.2) + vec2(t * 0.15)),
          fbm(p * 2.0 + q * distortion + vec2(8.3, 2.8) + vec2(0.0, t * 0.15))
        );

        // Third warp layer for extra depth
        vec2 s = vec2(
          fbm(p * 1.5 + r * 1.8 + vec2(3.1, 7.4) + vec2(t * 0.1)),
          fbm(p * 1.5 + r * 1.8 + vec2(6.5, 0.9) + vec2(t * 0.12))
        );

        // Final warped FBM value
        float f = fbm(p * 2.0 + s * 2.0);

        // --- Color ---

        // Rainbow hue cycling based on warped coordinates
        float hue = fract(
          f * 0.6
          + q.x * 0.3
          + r.y * 0.2
          + t * 0.05
        );

        // High saturation, boosted by treble
        float sat = 0.8 + trebleAmt * 0.2;

        // Brightness from warped field
        float val = 0.7 + 0.3 * f;

        vec3 col = hsv2rgb(hue, sat, val);

        // --- Second color layer for depth ---
        float hue2 = fract(hue + 0.33 + r.x * 0.15);
        float f2 = fbm(p * 3.0 + q * 1.5 + vec2(t * 0.08));
        vec3 col2 = hsv2rgb(hue2, sat * 0.9, 0.6 + 0.4 * f2);

        // Blend layers using warp pattern
        float blend = smoothstep(0.3, 0.7, f);
        col = mix(col, col2, blend * 0.5);

        // --- Beat ripple ---
        float dist = length(p);
        float ripple = sin(dist * 12.0 - t * 4.0) * 0.5 + 0.5;
        ripple = smoothstep(0.3, 0.7, ripple);
        col += beat * ripple * 0.4 * hsv2rgb(fract(hue + 0.5), 1.0, 1.0);

        // --- Edge flow glow ---
        float edgePattern = smoothstep(0.2, 0.8, fbm(p * 4.0 + s * 3.0 + t * 0.2));
        col += edgePattern * 0.12 * (1.0 + bassAmt * 0.5);

        // Soft vignette
        float vig = 1.0 - 0.3 * dot(p * 0.8, p * 0.8);
        col *= max(vig, 0.0);

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
window.VJamFX.presets['psychedelic-flow'] = PsychedelicFlowPreset;
})();
