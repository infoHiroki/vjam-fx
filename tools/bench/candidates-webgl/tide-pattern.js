(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class TidePatternPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
    this._flowDir = { x: 0.88, y: -0.34 };
    this._targetDir = { x: 0.88, y: -0.34 };
  }

  setup(container) {
    this.destroy();
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
    this._flowDir.x = 0.88;
    this._flowDir.y = -0.34;
    this._targetDir.x = 0.88;
    this._targetDir.y = -0.34;
    const preset = this;

    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL);
        p.pixelDensity(1);
      };

      p.draw = () => {
        p.background(0);
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }

        preset.beatPulse *= 0.91;
        preset._time += 0.012 + preset.audio.rms * 0.01 + preset.audio.mid * 0.006;
        preset._advanceFlowDirection();

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_flowDir', [preset._flowDir.x, preset._flowDir.y]);
          p.noStroke();
          p.quad(-1, -1, 1, -1, 1, 1, -1, 1);
        } catch (_) {
        } finally {
          p.resetShader();
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
      };
    }, container);
  }

  _advanceFlowDirection() {
    const tx = this._targetDir.x;
    const ty = this._targetDir.y;
    this._flowDir.x += (tx - this._flowDir.x) * 0.045;
    this._flowDir.y += (ty - this._flowDir.y) * 0.045;
    const len = Math.hypot(this._flowDir.x, this._flowDir.y) || 1;
    this._flowDir.x /= len;
    this._flowDir.y /= len;
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
      uniform float u_rms;
      uniform float u_beat;
      uniform vec2 u_resolution;
      uniform vec2 u_flowDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

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

      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 5; i++) {
          v += noise(p) * amp;
          p *= 2.02;
          amp *= 0.5;
        }
        return v;
      }

      mat2 rot(float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c);
      }

      // RGB hue rotation via Rodrigues' rotation around (1,1,1)
      vec3 hueRotate(vec3 col, float angle) {
        float cosA = cos(angle);
        float sinA = sin(angle);
        vec3 k = vec3(0.57735); // normalize(1,1,1)
        return col * cosA + cross(k, col) * sinA + k * dot(k, col) * (1.0 - cosA);
      }

      float ridgeBand(float x, float width, float sharpness) {
        float s = sin(x);
        float band = 1.0 - smoothstep(width, width + sharpness, abs(s));
        return band;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 centered = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        vec2 dir = normalize(u_flowDir);
        vec2 side = vec2(-dir.y, dir.x);

        float spacing = 8.0 + u_bass * 50.0 + u_rms * 15.0;
        float drainage = fbm(centered * 1.8 + dir * u_time * (0.08 + u_mid * 0.18));
        float slip = fbm(centered * 5.5 - side * u_time * 0.09);

        vec2 warped = centered;
        warped += dir * (drainage - 0.5) * (0.2 + u_mid * 0.5 + u_rms * 0.2);
        warped += side * (slip - 0.5) * (0.25 + u_beat * 0.5 + u_bass * 0.2);

        float lane = dot(warped, side) * spacing;
        float contour = ridgeBand(lane + drainage * 4.6 + sin(dot(warped, dir) * 8.0), 0.18, 0.22);
        float fineContour = ridgeBand(lane * 2.25 - drainage * 2.8 + u_time * (0.08 + u_mid * 0.2), 0.26, 0.20);
        float rib = contour * 0.72 + fineContour * 0.28;

        float backwash = smoothstep(-0.45, 0.65, dot(warped, dir) + drainage * 0.45);
        float trough = 1.0 - smoothstep(0.05, 0.55, contour + fineContour * 0.4);
        float channel = smoothstep(0.64, 0.9, fbm(warped * 3.2 + dir * 2.0));
        channel *= smoothstep(0.2, 0.8, backwash);

        float grainScale = 120.0 + u_treble * 340.0;
        float grain = noise(gl_FragCoord.xy / grainScale + rib * 0.8 + u_time * 0.1);
        float sparkle = noise(gl_FragCoord.xy * (0.018 + u_treble * 0.05) + vec2(u_time * 2.1, -u_time * 1.3));
        float sand = grain * (0.18 + u_treble * 0.42) + pow(sparkle, 8.0) * (0.08 + u_treble * 0.25);

        vec3 drySand = vec3(0.17, 0.13, 0.09);
        vec3 wetSand = vec3(0.33, 0.27, 0.19);
        vec3 shellTint = vec3(0.61, 0.54, 0.43);
        vec3 waterSheen = vec3(0.22, 0.31, 0.30);

        float damp = smoothstep(0.15, 0.95, backwash + drainage * 0.3);
        vec3 col = mix(drySand, wetSand, damp);
        col = mix(col, shellTint, rib * 0.34 + sand * 0.15);
        col += waterSheen * channel * (0.35 + u_mid * 0.45 + u_beat * 0.35);
        col += vec3(sand * 0.42);
        col -= trough * 0.08;

        float vignette = smoothstep(1.14, 0.08, length(centered * vec2(1.0, 1.18)));
        col *= vignette;
        col += rib * vec3(0.2, 0.16, 0.11) * (0.8 + u_bass * 1.8);
        col += channel * vec3(0.12, 0.15, 0.16) * (0.5 + u_beat * 1.2 + u_rms * 0.6);
        col = pow(max(col, 0.0), vec3(0.95));

        // Slow hue cycling over time for color variety
        col = hueRotate(col, u_time * 0.35);

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    try {
      return p.createShader(vert, frag);
    } catch (_) {
      return null;
    }
  }

  updateAudio(data) {
    this.audio.bass = data.bass || 0;
    this.audio.mid = data.mid || 0;
    this.audio.treble = data.treble || 0;
    this.audio.rms = data.rms || 0;
  }

  onBeat(strength) {
    this.beatPulse = Math.max(this.beatPulse, strength);
    const angle = (Math.random() - 0.5) * 1.3 + this.audio.mid * 1.4;
    this._targetDir.x = Math.cos(angle);
    this._targetDir.y = Math.sin(angle);
    this._time += 0.04 + strength * 0.08;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['tide-pattern'] = TidePatternPreset;
})();
