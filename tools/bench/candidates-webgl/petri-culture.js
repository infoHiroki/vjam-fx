(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PetriCulturePreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
  }

  setup(container) {
    this.destroy();
    this._time = 0;
    this.beatPulse = 0;
    this._shader = null;
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

        preset._time += 0.008 + preset.audio.bass * 0.02 + preset.audio.mid * 0.004;
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
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = p * 2.03 + vec2(0.7, -0.5);
          a *= 0.5;
        }
        return v;
      }

      vec3 palette(float t) {
        vec3 a = vec3(0.15, 0.35, 0.12);
        vec3 b = vec3(0.48, 0.55, 0.22);
        vec3 c = vec3(0.82, 0.4, 0.18);
        vec3 d = vec3(0.22, 0.78, 0.6);
        if (t < 0.33) return mix(a, b, t / 0.33);
        if (t < 0.66) return mix(b, c, (t - 0.33) / 0.33);
        return mix(c, d, (t - 0.66) / 0.34);
      }

      float colony(vec2 uv, vec2 center, float radius, float seed, float growth) {
        vec2 p = uv - center;
        float ang = atan(p.y, p.x);
        float n = fbm(p * (5.0 + seed * 2.0) + vec2(seed * 4.0, u_time * (0.2 + u_bass * 0.5)));
        float lobes = sin(ang * (5.0 + seed * 8.0) + u_time * (0.4 + u_treble * 2.0) + seed * 6.2831);
        float edge = radius * (0.7 + growth * 0.85 + n * 0.35 + lobes * 0.12 + u_mid * 0.18);
        return smoothstep(edge + 0.02 + u_rms * 0.06, edge - 0.01 - u_bass * 0.02, length(p));
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
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
        float beatGate = smoothstep(0.15, 0.7, u_beat);

        vec2 drift = vec2(
          sin(t * (0.12 + u_mid * 0.6)) * (0.08 + u_mid * 0.2),
          cos(t * (0.1 + u_mid * 0.5)) * (0.05 + u_mid * 0.18)
        );
        float agar = fbm((uv + drift) * (2.4 + u_mid * 2.0 + u_rms * 0.8));
        float nutrients = fbm((uv - drift * 1.6) * (5.0 + u_mid * 4.0) - t * (0.08 + u_mid * 0.16));
        float halos = fbm((uv + vec2(t * 0.03, -t * 0.02)) * (8.0 + u_treble * 5.0));

        vec3 col = mix(vec3(0.03, 0.02, 0.01), vec3(0.28, 0.19, 0.1), 0.45 + agar * 0.55);
        col += vec3(0.18, 0.16, 0.08) * nutrients * (0.2 + u_mid * 0.9);
        col += vec3(0.3, 0.27, 0.18) * u_rms * 0.5;

        float growth = 0.25 + u_bass * 0.9 + u_bass * u_bass * 0.4 + beatGate * 0.35;
        float inoculation = 0.0;
        float mass = 0.0;
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          float seed = 0.17 + fi * 0.13;
          vec2 center = vec2(
            sin(seed * 20.0 + t * 0.08 + u_mid * (2.0 + fi)) * (0.18 + fi * 0.06),
            cos(seed * 13.0 - t * 0.06 + u_mid * 1.6) * (0.16 + fi * 0.05)
          );
          center += drift * (0.4 + seed);
          center += vec2(sin(fi * 3.2), cos(fi * 4.1)) * beatGate * 0.08;
          float c = colony(uv, center, 0.08 + fi * 0.012 + beatGate * 0.01, seed, growth);
          float rim = colony(uv, center, 0.095 + fi * 0.012 + beatGate * 0.02, seed + 0.2, growth) - c;
          vec3 cCol = palette(fract(seed + halos * 0.25 + u_treble * 0.45 + fi * 0.07));
          cCol *= 0.55 + nutrients * 0.4 + u_rms * 0.3;
          cCol += vec3(0.25, 0.35, 0.18) * u_mid * 0.25;
          cCol += vec3(0.5, 0.18, 0.22) * u_treble * 0.22;
          col = mix(col, cCol, c * 0.88);
          col += vec3(0.95, 0.92, 0.8) * rim * (0.1 + u_rms * 0.5 + u_treble * 0.35);
          mass += c;
          inoculation += rim;
        }

        float beatSeed = colony(uv, vec2(sin(t * 0.7), cos(t * 0.9)) * 0.08, 0.12 + u_beat * 0.18, 0.91, 0.5 + u_bass + u_beat);
        col += vec3(0.85, 0.95, 0.7) * beatSeed * beatGate * (0.4 + u_beat * 1.8 + u_bass * 0.4);
        col += vec3(0.3, 0.5, 0.22) * mass * (0.04 + u_bass * 0.05);

        float lighting = exp(-dot(uv - vec2(-0.18, -0.14), uv - vec2(-0.18, -0.14)) * (2.8 - u_rms * 1.2));
        lighting += exp(-dot(uv + vec2(0.24, 0.18), uv + vec2(0.24, 0.18)) * (4.5 - u_rms * 2.0)) * 0.5;
        col *= 0.6 + lighting * (0.8 + u_rms * 1.4);
        col += vec3(0.85, 0.9, 1.0) * inoculation * beatGate * 0.18;

        float dish = smoothstep(0.98 + u_rms * 0.08, 0.85, length(uv));
        float rim = smoothstep(0.82, 0.96, length(uv));
        col *= dish;
        col += vec3(0.7, 0.76, 0.8) * rim * (0.08 + u_rms * 0.24 + u_treble * 0.12);

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

  onBeat(strength) {
    this.beatPulse = Math.min(1, strength);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['petri-culture'] = PetriCulturePreset;
})();
