(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PetroglyphPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
  }

  setup(container) {
    this.destroy();
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

        preset._time += 0.011 + preset.audio.mid * 0.006 + preset.audio.treble * 0.004;
        preset.beatPulse *= 0.9;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
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

      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }
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
        float a = 0.5;
        mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = m * p;
          a *= 0.5;
        }
        return v;
      }

      float segment(vec2 p, vec2 a, vec2 b, float w) {
        vec2 pa = p - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return smoothstep(w, w * 0.35, length(pa - ba * h));
      }

      float circle(vec2 p, vec2 c, float r, float w) {
        float d = abs(length(p - c) - r);
        return smoothstep(w, w * 0.35, d);
      }

      float glyphSet(vec2 p, float id, float t) {
        float g = 0.0;
        float wobble = sin(t + id * 4.7) * 0.12;
        if (id < 0.5) {
          g += circle(p, vec2(0.0, -0.05), 0.2 + wobble * 0.2, 0.035);
          g += segment(p, vec2(-0.24, -0.26), vec2(0.0, -0.05), 0.035);
          g += segment(p, vec2(0.24, -0.26), vec2(0.0, -0.05), 0.035);
          g += segment(p, vec2(0.0, 0.13), vec2(0.0, 0.36), 0.04);
        } else if (id < 1.5) {
          g += segment(p, vec2(-0.25, -0.25), vec2(0.0, 0.28), 0.04);
          g += segment(p, vec2(0.25, -0.25), vec2(0.0, 0.28), 0.04);
          g += segment(p, vec2(-0.14, 0.0), vec2(0.14, 0.0), 0.035);
          g += circle(p, vec2(0.0, -0.18), 0.1, 0.03);
        } else if (id < 2.5) {
          g += circle(p, vec2(0.0, 0.04), 0.22, 0.03);
          g += segment(p, vec2(-0.32, 0.0), vec2(0.32, 0.0), 0.035);
          g += segment(p, vec2(0.0, -0.32), vec2(0.0, 0.32), 0.035);
        } else {
          g += segment(p, vec2(-0.28, -0.24), vec2(0.28, 0.24), 0.04);
          g += segment(p, vec2(-0.28, 0.24), vec2(0.28, -0.24), 0.04);
          g += circle(p, vec2(0.0, 0.0), 0.12 + wobble * 0.12, 0.03);
        }
        return clamp(g, 0.0, 1.0);
      }

      float carving(vec2 uv, float t) {
        float beatMode = mod(floor(t * (0.18 + u_beat * 2.8) + u_beat * 6.0), 4.0);
        float wall = 0.0;
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          vec2 seed = vec2(hash(fi * 13.7 + beatMode * 17.0), hash(fi * 23.1 + 8.0 + beatMode * 29.0));
          vec2 pos = (seed - 0.5) * vec2(1.65 + u_mid * 0.6, 1.15 + u_mid * 0.4);
          vec2 p = uv - pos;
          float ang = fi * 0.9 + hash(fi + beatMode) * 6.2831 + u_time * 0.03;
          float c = cos(ang);
          float s = sin(ang);
          p = mat2(c, -s, s, c) * p;
          p.x *= 1.0 + sin(u_time * 0.4 + fi + u_mid * 4.0) * 0.18 * u_mid;
          p.y *= 1.0 + cos(u_time * 0.28 + fi) * 0.12 * u_mid;
          wall += glyphSet(p, mod(fi + beatMode, 4.0), t + fi);
        }
        return clamp(wall, 0.0, 1.0);
      }
      vec3 audioReactiveFinalize(vec3 inCol, vec2 uv, float hue, vec2 reactCenter, float reactScatter, float reactPulse) {
        vec3 hueCycle = 0.5 + 0.5 * cos(6.2831853 * (hue + vec3(0.0, 0.33, 0.67)));
        vec3 baseGlow = hueCycle * (0.16 + 0.14 * reactScatter);
        baseGlow += hueCycle * reactPulse * (0.18 + u_rms * 0.4 + u_beat * 0.25);
        baseGlow += vec3(0.06, 0.07, 0.09) * (0.6 + reactScatter * 0.8);
        baseGlow *= 0.75 + 0.25 * exp(-length(uv - reactCenter) * 2.8);
        inCol = mix(inCol, inCol * hueCycle, 0.2 + 0.15 * reactScatter);
        inCol += baseGlow;
        return max(inCol, vec3(0.02, 0.02, 0.03));
      }
void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        float audioHue = u_time * 0.1 + u_treble * 0.5;
        vec2 audioDrift = vec2(fract(u_time * 0.1) * 3.0, fract(u_time * 0.08) * 3.0);
        uv += (audioDrift - 1.5) * 0.12;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float t = u_time;

        vec2 parallax = uv;
        parallax.x += (fbm(uv * 2.6 + vec2(t * 0.08, 0.0)) - 0.5) * (0.18 + u_mid * 0.35);
        parallax.y += (fbm(uv * 2.2 - vec2(0.0, t * 0.06)) - 0.5) * (0.09 + u_mid * 0.22);
        vec2 rockUv = parallax * (3.4 + u_mid * 1.8);

        float strata = fbm(rockUv + vec2(0.0, t * 0.03));
        float cracks = fbm(rockUv * 2.3 - vec2(t * 0.04, t * 0.02));
        float grit = fbm(rockUv * 6.0 + u_treble * 3.0);
        float height = strata * 0.6 + cracks * 0.3 + grit * 0.1;

        vec2 eps = vec2(0.01, 0.0);
        float hx = fbm((rockUv + eps.xy) * 1.1) - fbm((rockUv - eps.xy) * 1.1);
        float hy = fbm((rockUv + eps.yx) * 1.1) - fbm((rockUv - eps.yx) * 1.1);
        vec3 n = normalize(vec3(hx * (1.2 + u_mid * 1.5), hy * (1.2 + u_mid * 1.5), 1.0));

        vec3 torchA = normalize(vec3(0.45 + sin(t * (1.2 + u_treble * 3.0)) * 0.3, 0.65, 0.75));
        vec3 torchB = normalize(vec3(-0.65 + cos(t * (1.5 + u_treble * 4.0)) * 0.22, 0.45, 0.6));
        float lightA = max(0.0, dot(n, torchA));
        float lightB = max(0.0, dot(n, torchB));

        vec3 rock = mix(vec3(0.12, 0.09, 0.06), vec3(0.3, 0.22, 0.15), height);
        rock *= 0.35 + u_rms * 0.95;
        rock += vec3(0.22, 0.13, 0.05) * lightA * (0.45 + u_treble * 0.7);
        rock += vec3(0.18, 0.1, 0.04) * lightB * (0.25 + u_treble * 0.6);

        float glyph = carving(uv * (1.1 + u_bass * 0.18), t);
        float etched = carving(uv * (1.14 + u_bass * 0.22) + vec2(0.01, -0.01), t) * 0.5;
        float glow = glyph * (0.3 + u_bass * 1.35 + lightA * 0.35 + u_beat * 0.8);
        vec3 pigment = mix(vec3(0.45, 0.24, 0.08), vec3(1.0, 0.72, 0.28), glow);
        pigment *= 0.3 + u_bass * 1.2;
        pigment += vec3(1.0, 0.78, 0.42) * u_beat * glyph;

        vec3 col = rock;
        col = mix(col, pigment, clamp(glyph + etched * 0.6, 0.0, 1.0));
        col -= vec3(0.08, 0.06, 0.05) * (1.0 - u_rms) * (0.8 + strata);
        col += vec3(0.08, 0.05, 0.02) * u_bass * (0.4 + cracks);
        col *= 1.0 - smoothstep(0.75, 1.35, length(uv)) * (0.35 + (1.0 - u_rms) * 0.45);
        col = pow(max(col, 0.0), vec3(0.95 + (1.0 - u_rms) * 0.18));

        gl_FragColor = vec4(audioReactiveFinalize(clamp(col, 0.0, 1.0), uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }
    `;

    try {
      return p.createShader(vert, frag);
    } catch (_) {
      return null;
    }
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
  }

  onBeat(s) {
    this.beatPulse = Math.min(1, s);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['petroglyph'] = PetroglyphPreset;
})();
