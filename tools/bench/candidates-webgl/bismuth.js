(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class BismuthPreset extends BasePreset {
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
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }

        preset._time += 0.01 + preset.audio.treble * 0.03 + preset.audio.rms * 0.015;
        preset.beatPulse *= 0.9;

        try {
          p.background(0);
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
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

      vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        rgb = rgb * rgb * (3.0 - 2.0 * rgb);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      float stairs(vec2 p, float steps, float seed) {
        p *= 1.0 + u_bass * 0.7;
        vec2 gid = floor(p);
        vec2 f = fract(p) - 0.5;
        float idx = hash(gid + seed);
        float a = floor((atan(f.y, f.x) / 6.2831853 + 0.5) * steps + idx * steps * 0.3);
        float radius = max(abs(f.x), abs(f.y));
        float terrace = floor((1.0 - radius + idx * 0.25) * steps + a * 0.35) / steps;
        return terrace;
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
        vec2 suv = uv;
        suv += (audioDrift - 1.5) * 0.06;

        float beatWarp = 1.0 + u_beat * 0.18;
        uv *= beatWarp;
        uv.x += sin(uv.y * 5.0 + u_time * (0.4 + u_treble * 1.6)) * 0.04 * (0.2 + u_rms);
        uv.y += cos(uv.x * 4.0 - u_time * (0.25 + u_mid)) * 0.025 * (0.4 + u_treble);

        float layers = 6.0 + floor(u_mid * 14.0) + floor(u_beat * 5.0);
        vec2 crystalUv = uv * (2.7 + u_bass * 4.8);
        vec2 id = floor(crystalUv);
        vec2 gv = fract(crystalUv) - 0.5;
        float seedA = floor(u_time * (0.45 + u_beat * 1.7));
        float seedB = floor(u_time * (0.18 + u_bass * 0.8));
        float nucleusA = hash(seedA + 17.0);
        float nucleusB = hash(seedB + 83.0);

        float stageA = stairs(crystalUv + vec2(nucleusA, nucleusB) * 0.8, layers, seedA + 3.0);
        float stageB = stairs(crystalUv * 1.35 - vec2(nucleusB, nucleusA) * 0.6, layers + 3.0, seedB + 7.0);
        float terrace = max(stageA, stageB * (0.8 + u_mid * 0.5));

        float cellMask = smoothstep(0.9, 0.15, length(gv) + noise(id + seedA) * 0.08);
        float height = terrace * cellMask;

        float oxideShift = u_time * (0.18 + u_treble * 1.8) + terrace * (5.0 + u_mid * 8.0);
        float hue = fract(0.08 + stageA * 0.17 + stageB * 0.11 + oxideShift * 0.08 + noise(uv * 6.0) * 0.07);
        float sat = 0.45 + u_treble * 0.45 + u_beat * 0.25 + noise(id + 4.0) * 0.15;
        float val = 0.18 + height * (0.9 + u_bass * 0.6) + u_rms * 0.5;
        vec3 oxide = hsv2rgb(vec3(hue, sat, val));

        float ridge = abs(fract(terrace * layers * 0.7 + noise(id + 9.0) * 0.2) - 0.5);
        float edge = smoothstep(0.19 - u_mid * 0.04, 0.01, ridge);
        vec3 metal = mix(vec3(0.04, 0.035, 0.05), vec3(0.28, 0.25, 0.22), terrace);
        vec3 col = mix(metal, oxide, 0.6 + u_treble * 0.3);

        float nucleusGlow = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float t = floor(u_time * (0.3 + fi * 0.17 + u_beat * 1.2));
          vec2 center = (vec2(hash(t + 11.0 + fi), hash(t + 53.0 + fi)) - 0.5) * 1.4;
          float d = length(suv - center);
          nucleusGlow += exp(-d * (10.0 - u_bass * 4.0 - fi)) * (0.2 + 0.55 * u_beat);
        }

        float shimmer = noise(uv * (18.0 + u_treble * 30.0) + u_time * (1.5 + u_treble * 6.0));
        float glint = pow(max(0.0, shimmer - (0.72 - u_treble * 0.22)), 3.0) * (0.4 + u_rms * 1.2);
        col += edge * vec3(0.9, 0.95, 1.0) * (0.15 + u_mid * 0.45 + u_rms * 0.25);
        col += nucleusGlow * vec3(0.7, 0.85, 1.0);
        col += glint * hsv2rgb(vec3(fract(hue + 0.17), 0.7 + u_treble * 0.2, 1.0));

        float bloom = 0.75 + u_rms * 0.8 + u_bass * 0.3;
        col *= bloom;
        col *= 1.0 - dot(suv, suv) * (0.32 - u_rms * 0.08);
        col += vec3(0.08, 0.06, 0.12) * u_beat;

        gl_FragColor = vec4(audioReactiveFinalize(max(col, 0.0), uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
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
    this.beatPulse = Math.min(1, Math.max(this.beatPulse, strength || 0));
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['bismuth'] = BismuthPreset;
})();
