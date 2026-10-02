(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FibonacciSpiralGpuPreset extends BasePreset {
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

        preset._time += 0.01 + preset.audio.mid * 0.01 + preset.audio.bass * 0.004;
        preset.beatPulse *= 0.91;

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

      #define SEEDS 80

      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(dot(i,vec2(127.1,311.7))),hash(dot(i+vec2(1,0),vec2(127.1,311.7))),f.x),mix(hash(dot(i+vec2(0,1),vec2(127.1,311.7))),hash(dot(i+vec2(1,1),vec2(127.1,311.7))),f.x),f.y);
      }

      vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      float seedDisc(vec2 uv, vec2 p, float r) {
        float d = length(uv - p);
        return smoothstep(r, r * 0.3, d);
      }

      float ring(vec2 uv, vec2 p, float r, float w) {
        return smoothstep(w, w * 0.25, abs(length(uv - p) - r));
      }

      vec3 palette(float x, float hueShift) {
        vec3 a = hsv2rgb(vec3(fract(0.08 + hueShift), 0.7, 0.25));
        vec3 b = hsv2rgb(vec3(fract(0.12 + hueShift), 0.65, 0.7));
        vec3 c = hsv2rgb(vec3(fract(0.16 + hueShift), 0.5, 0.95));
        return mix(mix(a, b, smoothstep(0.1, 0.7, x)), c, smoothstep(0.65, 1.0, x));
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
        float golden = 2.39996323;
        float spread = 0.06 + u_bass * 0.07;
        float spin = t * (0.18 + u_mid * 1.7) + u_beat * 0.5;
        float burst = smoothstep(0.02, 0.95, u_beat);
        float hueShift = t * 0.05 + u_bass * 0.3;
        float breathe = 1.0 + sin(t * 1.5 + u_bass * 6.2831) * 0.15 * (0.5 + u_beat);

        vec3 col = mix(vec3(0.04, 0.06, 0.08), vec3(0.15, 0.12, 0.2), u_rms * 0.9);
        col += hsv2rgb(vec3(fract(hueShift + 0.6), 0.3, 0.12)) * exp(-length(uv) * 1.8) * (0.35 + u_rms * 0.65);

        float accum = 0.0;
        float lineGlow = 0.0;
        for (int i = 0; i < SEEDS; i++) {
          float fi = float(i);
          float rNorm = sqrt((fi + 0.5) / float(SEEDS));
          float ang = fi * golden + spin;
          float radius = rNorm * (0.15 + spread * 8.5 + u_bass * 0.5) * breathe;
          vec2 base = vec2(cos(ang), sin(ang)) * radius;

          float explodeAmp = burst * (0.1 + 0.7 * hash(fi + 3.1));
          vec2 explodeDir = normalize(vec2(cos(ang * 1.3 + fi), sin(ang * 0.9 - fi * 0.4)) + 0.001);
          vec2 p = base + explodeDir * explodeAmp;
          p += vec2(sin(fi * 1.7 + t * (0.4 + u_mid)), cos(fi * 1.2 - t * (0.5 + u_mid))) * 0.012 * burst;

          float size = 0.012 + u_treble * 0.022 + (1.0 - rNorm) * 0.018;
          size *= 0.7 + 0.3 * sin(t * (3.0 + u_treble * 10.0) + fi * 1.91);
          size += u_beat * 0.02 * (0.3 + hash(fi + 5.6));
          size *= breathe;

          float seed = seedDisc(uv, p, size);
          float halo = ring(uv, p, size * (2.2 + u_treble * 2.0 + u_beat * 1.0), size * 0.55);
          float phyllotaxisLine = ring(uv, p * 0.5, length(p) * 0.5, 0.008 + u_bass * 0.006) * 0.25;

          float seedHue = fract(hueShift + rNorm * 0.4 + fi * 0.013);
          vec3 seedCol = palette(rNorm, seedHue);
          seedCol *= 0.75 + u_rms * 0.8;
          seedCol += hsv2rgb(vec3(fract(seedHue + 0.15), 0.6, 0.4)) * u_bass * (1.0 - rNorm);
          seedCol += hsv2rgb(vec3(fract(seedHue + 0.3), 0.4, 1.0)) * halo * (0.5 + u_treble * 1.2);
          seedCol += vec3(1.0, 0.95, 0.85) * u_beat * seed * 1.5;

          col += seedCol * seed;
          col += seedCol * halo * 0.45;
          accum += seed;
          lineGlow += phyllotaxisLine;
        }

        float spiralA = abs(atan(uv.y, uv.x) - log(length(uv) + 1.2) * (3.0 + u_bass * 2.0) - spin);
        spiralA = exp(-abs(sin(spiralA)) * (6.0 - u_bass * 2.0));
        float spiralB = exp(-abs(sin(atan(uv.y, uv.x) + length(uv) * (16.0 + u_bass * 8.0) - spin * 1.2)) * (7.0 + u_treble * 6.0));

        col += hsv2rgb(vec3(fract(hueShift + 0.3), 0.5, 0.35)) * spiralA * (0.3 + u_bass * 0.7);
        col += hsv2rgb(vec3(fract(hueShift + 0.5), 0.4, 0.9)) * spiralB * lineGlow * (0.12 + u_treble * 0.18);
        col += vec3(0.18, 0.15, 0.07) * accum * 0.004;

        float centerGlow = exp(-length(uv) * (3.0 - u_beat * 1.5)) * (0.15 + u_beat * 0.6 + u_rms * 0.3);
        col += hsv2rgb(vec3(fract(hueShift), 0.3, 1.0)) * centerGlow;

        col *= 1.0 - smoothstep(0.92, 1.48, length(uv)) * 0.45;
        col = 1.0 - exp(-col * (1.1 + u_rms * 0.7 + u_bass * 0.25));

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
window.VJamFX.presets['fibonacci-spiral-gpu'] = FibonacciSpiralGpuPreset;
})();
