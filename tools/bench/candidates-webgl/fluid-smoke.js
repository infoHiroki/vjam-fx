(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FluidSmokePreset extends BasePreset {
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
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        p.createCanvas(w, h, p.WEBGL);
        p.pixelDensity(1);
      };

      p.draw = () => {
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }
        preset._time += 0.02 + preset.audio.bass * 0.04 + preset.beatPulse * 0.15;
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
        } catch (e) {
          // noop
        } finally {
          p.resetShader();
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
      };
    }, container);
  }

  _initShader(p) {
    const vert = `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vUv;
      void main() {
        vUv = aTexCoord;
        vec4 pos = vec4(aPosition, 1.0);
        pos.xy = pos.xy * 2.0 - 1.0;
        gl_Position = pos;
      }
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

      // Hash for pseudo-random
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Value noise
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

      // FBM (fractal Brownian motion)
      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        for (int i = 0; i < 6; i++) {
          val += amp * noise(p * freq);
          freq *= 2.0;
          amp *= 0.5;
          p += vec2(1.7, 9.2);
        }
        return val;
      }

      // Domain warping for fluid effect
      float warpedFbm(vec2 p) {
        float t = u_time;
        float bassF = u_bass;

        // First warp
        vec2 q = vec2(
          fbm(p + vec2(0.0, 0.0) + t * 0.3),
          fbm(p + vec2(5.2, 1.3) + t * 0.2)
        );

        // Second warp (deeper turbulence)
        vec2 r = vec2(
          fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.15 + bassF * 2.0),
          fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.12 + u_mid * 1.5)
        );

        return fbm(p + 4.0 * r);
      }

      void main() {
        float aspect = u_resolution.x / u_resolution.y;
        vec2 uv = vUv;
        uv.x *= aspect;

        // Scale and animate
        vec2 p = uv * 3.0;

        // Bass pushes outward from center
        vec2 center = vec2(aspect * 0.5, 0.5) * 3.0;
        vec2 dir = p - center;
        p += dir * u_bass * 0.15;

        // Beat distortion
        p += vec2(sin(p.y * 5.0 + u_time), cos(p.x * 5.0 + u_time)) * u_beat * 0.3;

        float f = warpedFbm(p);

        // Color mapping — deep warm/cool smoke
        vec3 col1 = vec3(0.1, 0.0, 0.15);  // dark purple
        vec3 col2 = vec3(0.8, 0.2, 0.05);   // fire orange
        vec3 col3 = vec3(0.0, 0.5, 0.9);    // cool blue
        vec3 col4 = vec3(1.0, 0.9, 0.3);    // bright yellow

        // Mix colors based on fbm value and audio
        float hueShift = u_time * 0.1 + u_treble * 0.5;
        vec3 col = mix(col1, col2, smoothstep(0.0, 0.5, f + sin(hueShift) * 0.2));
        col = mix(col, col3, smoothstep(0.4, 0.8, f + cos(hueShift * 1.3) * 0.2));
        col = mix(col, col4, smoothstep(0.7, 1.0, f) * (0.3 + u_treble * 0.7));

        // Brightness from audio
        col *= 1.0 + u_bass * 0.5 + f * 0.3;

        // Beat white flash
        col = mix(col, vec3(1.0), u_beat * 0.4);

        // Vignette
        vec2 vuv = vUv * 2.0 - 1.0;
        float vig = 1.0 - dot(vuv, vuv) * 0.3;
        col *= vig;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try {
      return p.createShader(vert, frag);
    } catch (_) {
      return null;
    }
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
    this.audio.strength = audioData.strength || 0;
  }

  onBeat(strength) {
    this.beatPulse = strength;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['fluid-smoke'] = FluidSmokePreset;
})();
