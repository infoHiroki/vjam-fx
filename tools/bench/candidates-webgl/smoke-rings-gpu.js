(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SmokeRingsGpuPreset extends BasePreset {
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

        preset.beatPulse *= 0.93;
        preset._time += 0.012 + preset.audio.mid * 0.01 + preset.audio.treble * 0.004;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beatPulse);
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
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash(i + vec3(0.0, 0.0, 0.0));
        float n100 = hash(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash(i + vec3(1.0, 1.0, 1.0));
        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        float nxy0 = mix(nx00, nx10, f.y);
        float nxy1 = mix(nx01, nx11, f.y);
        return mix(nxy0, nxy1, f.z);
      }

      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += noise(p) * a;
          p = p * 2.03 + vec3(1.7, 2.9, 3.4);
          a *= 0.5;
        }
        return v;
      }

      float torusSdf(vec3 p, vec2 t) {
        vec2 q = vec2(length(p.xy) - t.x, p.z);
        return length(q) - t.y;
      }

      mat2 rot(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }

      float ringDensity(vec3 p, float age, float seed) {
        float bassRadius = 0.36 + u_bass * 0.28 + 0.05 * sin(seed * 8.0);
        float core = 0.06 + u_rms * 0.05 + u_treble * 0.015;
        float advect = age * (0.65 + u_mid * 1.8 + 0.1 * sin(seed));
        p.z += advect;
        p.xy *= rot(seed * 2.7 + age * (0.2 + u_mid * 0.35));
        float swirl = atan(p.y, p.x) + age * (2.8 + u_treble * 5.0);
        float radial = length(p.xy) - bassRadius;
        p.z += sin(swirl * 3.0 + seed * 11.0) * (0.02 + u_treble * 0.05);
        p.xy += vec2(cos(swirl), sin(swirl)) * radial * (0.2 + u_treble * 0.45);
        float tube = torusSdf(p, vec2(bassRadius, core));
        float vortex = fbm(p * (3.0 + u_treble * 3.0) + vec3(0.0, 0.0, u_time * 0.5));
        float shell = exp(-abs(tube) * (24.0 - u_rms * 6.0));
        float wake = exp(-abs(radial) * (10.0 + u_bass * 8.0)) * exp(-max(p.z, 0.0) * (5.0 - u_mid * 2.0));
        float breakup = smoothstep(0.18, 0.75, vortex + u_treble * 0.25 + u_beat * 0.2);
        return shell * wake * breakup * (0.45 + u_rms * 1.2 + u_beat * 0.3);
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
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
        vec3 ro = vec3(0.0, 0.0, -2.5);
        vec3 rd = normalize(vec3(uv * vec2(1.0, 1.0), 1.8));
        rd.xy *= rot(0.2 * sin(u_time * 0.13 + u_mid * 3.0));

        float density = 0.0;
        vec3 accum = vec3(0.0);
        float trans = 1.0;
        float beatBurst = floor(u_time * 0.15 + u_beat * 2.2);

        for (int i = 0; i < 56; i++) {
          float fi = float(i);
          float t = fi * 0.07;
          vec3 pos = ro + rd * t;
          pos.y += 0.08 * sin(t * 1.6 + u_time * 0.4);

          float d = 0.0;
          for (int j = 0; j < 4; j++) {
            float fj = float(j);
            float age = fract(u_time * (0.16 + u_mid * 0.18) - fj * 0.21 - beatBurst * 0.07);
            float launch = smoothstep(0.0, 0.08 + u_beat * 0.12, age) * (1.0 - smoothstep(0.7, 1.0, age));
            d += ringDensity(pos + vec3(0.0, 0.0, age * 1.4), age, fj + 1.7) * launch;
          }

          float glow = d * (0.4 + u_bass * 0.7);
          vec3 smoke = mix(vec3(0.05, 0.06, 0.08), vec3(0.65, 0.7, 0.78), smoothstep(0.1, 0.8, d + u_rms * 0.25));
          smoke += vec3(0.08, 0.12, 0.18) * u_treble * sin(t * 7.0 + u_time * 4.0);
          smoke += vec3(0.2, 0.22, 0.25) * u_beat * exp(-t * 0.8);

          float alpha = clamp(d * 0.08, 0.0, 0.18);
          accum += smoke * alpha * trans + glow * vec3(0.18, 0.2, 0.24) * trans;
          trans *= 1.0 - alpha;
          density += d * trans;
        }

        vec3 bg = vec3(0.0);
        bg += vec3(0.02, 0.03, 0.05) * exp(-length(uv) * 2.8);
        bg += vec3(0.05, 0.08, 0.12) * u_beat * exp(-length(uv - vec2(0.0, 0.1)) * 3.0);

        vec3 col = bg + accum;
        col *= 0.9 + u_rms * 0.4;
        col += vec3(0.15, 0.17, 0.2) * density * (0.2 + u_bass * 0.4);
        col = pow(max(col, 0.0), vec3(0.9));
        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
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

  onBeat(strength) {
    this.beatPulse = Math.min(1, strength || 0);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['smoke-rings-gpu'] = SmokeRingsGpuPreset;
})();
