(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NebulaGpuPreset extends BasePreset {
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

        preset._time += 0.013 + preset.audio.bass * 0.007 + preset.audio.rms * 0.004;
        preset.beatPulse *= 0.92;

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

      #define STEPS 44

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

      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        mat3 m = mat3(
          1.6, 1.2, 0.0,
          -1.2, 1.6, 0.0,
          0.2, -0.1, 1.7
        );
        for (int i = 0; i < 5; i++) {
          v += a * noise(p.xy + p.z * 0.17);
          p = m * p;
          a *= 0.5;
        }
        return v;
      }

      float densityField(vec3 p, float t) {
        vec3 q = p;
        q.xy *= 1.2 + u_bass * 0.7;
        q.z += t * (0.08 + u_bass * 0.12);
        q.xy += vec2(
          fbm(q * 0.9 + vec3(3.2, 1.1, t * 0.05)),
          fbm(q.yzx * 0.8 + vec3(-1.4, 2.2, -t * 0.04))
        ) * (0.55 + u_bass * 0.45);

        float base = fbm(q * 1.0);
        float detail = fbm(q * (2.2 + u_bass * 1.8) + vec3(2.0, -4.0, t * 0.1));
        float wisps = fbm(q * (4.4 + u_treble * 2.0) - vec3(0.0, 0.0, t * 0.18));
        float core = exp(-length(p.xy * vec2(1.0, 0.75)) * (1.8 + u_rms * 1.2));
        float shell = smoothstep(1.2 + u_bass * 0.5, 0.15, abs(base - detail));
        float d = base * 0.7 + detail * 0.45 + wisps * 0.2 + core * (0.35 + u_rms * 0.7) + shell * 0.25;
        d *= 0.55 + u_bass * 1.5;
        d += exp(-length(p - vec3(0.0, 0.0, 0.15 + u_beat * 0.18)) * (8.0 - u_bass * 2.0)) * u_beat * 1.8;
        return max(0.0, d - 0.45);
      }

      vec3 palette(float x) {
        vec3 warm = vec3(0.95, 0.3, 0.18);
        vec3 blue = vec3(0.2, 0.4, 1.0);
        vec3 violet = vec3(0.62, 0.28, 0.95);
        vec3 p = mix(warm, blue, clamp(u_mid * 1.2, 0.0, 1.0));
        p = mix(p, violet, 0.5 + 0.5 * sin(x * 2.5 + u_mid * 4.0));
        p += vec3(0.15, 0.05, 0.2) * u_mid;
        return p;
      }

      float starField(vec2 p, float t) {
        vec2 grid = floor(p * (120.0 + u_treble * 120.0));
        float rnd = hash(grid);
        float mask = step(0.995 - u_treble * 0.01, rnd);
        float twinkle = 0.5 + 0.5 * sin(t * (4.0 + u_treble * 10.0) + rnd * 70.0);
        float radial = exp(-length(fract(p * (120.0 + u_treble * 120.0)) - 0.5) * (10.0 + u_treble * 15.0));
        return mask * twinkle * radial;
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
        vec2 audioDrift = vec2(sin(u_time * 0.3) * 1.5 + 1.5, sin(u_time * 0.23) * 1.5 + 1.5);
        uv += vec2(sin(u_time * 0.15), cos(u_time * 0.12)) * 0.06;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float t = u_time;
        vec3 ro = vec3(0.0, 0.0, -2.6);
        vec3 rd = normalize(vec3(uv * (1.0 + u_mid * 0.1), 1.8));

        // Minimal background - just stars, no haze
        vec3 bg = vec3(0.005, 0.0, 0.01);
        bg += vec3(starField(gl_FragCoord.xy / u_resolution.xy, t)) * (0.5 + u_treble * 1.4);

        vec3 col = bg;
        float trans = 1.0;

        for (int i = 0; i < STEPS; i++) {
          float fi = float(i) / float(STEPS - 1);
          float dist = 0.2 + fi * 4.4;
          vec3 pos = ro + rd * dist;
          pos.xy += vec2(sin(pos.z * 0.8 + t * 0.1), cos(pos.z * 0.6 - t * 0.08)) * 0.18;

          float d = densityField(pos, t);
          vec3 pal = palette(fi + pos.z * 0.15);

          // Emphasized depth particles with stronger emission
          float emission = d * (0.08 + u_rms * 0.18 + u_bass * 0.04);
          float glow = exp(-length(pos.xy) * (1.8 + u_rms * 0.8)) * (0.06 + u_rms * 0.12);
          // More sparkles for depth particle effect
          float sparkle = step(0.994 - u_treble * 0.015, hash(floor((pos.xy + fi) * (40.0 + u_treble * 80.0)))) * (0.6 + u_treble * 2.0);
          // Depth-based brightness: particles further away are dimmer, creating depth
          float depthFade = 1.0 - fi * 0.3;
          col += (pal * emission * 1.5 + vec3(glow) + vec3(sparkle) * 0.15) * trans * depthFade;
          trans *= exp(-d * (0.12 + u_bass * 0.12 + u_beat * 0.1));
        }

        // Supernova/blast kept but no aurora overlay
        float supernova = exp(-length(uv - vec2(0.18 * sin(t * 0.14), 0.14 * cos(t * 0.11))) * (18.0 - u_bass * 4.0)) * u_beat;
        vec3 blastColor = mix(vec3(1.0, 0.5, 0.25), vec3(0.8, 0.95, 1.0), u_mid);
        col += blastColor * supernova * (0.8 + u_rms * 0.8);
        col += blastColor * u_beat * exp(-length(uv) * 2.5) * 0.25;
        col *= 1.0 - smoothstep(0.9, 1.5, length(uv * vec2(1.0, 1.15))) * 0.32;
        col = 1.0 - exp(-col * (1.15 + u_rms * 0.55));
        col = pow(col, vec3(0.92));

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
window.VJamFX.presets['nebula-gpu'] = NebulaGpuPreset;
})();
