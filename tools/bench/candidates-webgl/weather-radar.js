(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class WeatherRadarPreset extends BasePreset {
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

        preset._time += 0.008 + preset.audio.treble * 0.032 + preset.audio.rms * 0.01;
        preset.beatPulse *= 0.88;

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

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += noise(p) * a;
          p = p * 2.03 + vec2(17.0, 11.0);
          a *= 0.5;
        }
        return v;
      }

      vec3 rainPalette(float x) {
        vec3 green = vec3(0.05, 0.95, 0.3);
        vec3 yellow = vec3(1.0, 0.82, 0.15);
        vec3 red = vec3(1.0, 0.15, 0.05);
        vec3 magenta = vec3(1.0, 0.4, 0.95);
        if (x < 0.45) return mix(vec3(0.02, 0.18, 0.04), green, x / 0.45);
        if (x < 0.75) return mix(green, yellow, (x - 0.45) / 0.3);
        if (x < 0.95) return mix(yellow, red, (x - 0.75) / 0.2);
        return mix(red, magenta, (x - 0.95) / 0.05);
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
        float r = length(uv);
        float ang = atan(uv.y, uv.x);

        float scanSpeed = 0.45 + u_treble * 3.0 + u_beat * 0.7;
        float sweep = fract(u_time * scanSpeed / 6.2831853);
        float sweepAngle = sweep * 6.2831853;
        float delta = abs(mod(ang - sweepAngle + 3.1415926, 6.2831853) - 3.1415926);
        float sweepLine = smoothstep(0.24, 0.0, delta) * smoothstep(1.02, 0.08, r);
        float sweepGlow = smoothstep(0.65, 0.02, delta) * (0.35 + u_treble * 0.8);

        float cellCount = 4.0 + floor(u_mid * 10.0) + floor(u_beat * 4.0);
        vec2 stormUv = uv * (2.2 + u_mid * 1.8);
        float storm = 0.0;
        for (int i = 0; i < 8; i++) {
          float fi = float(i);
          if (fi >= cellCount) break;
          float t = floor(u_time * 0.3 + fi * 9.13 + u_beat * 5.0);
          vec2 center = (vec2(hash(vec2(t, 1.2 + fi)), hash(vec2(7.7 + fi, t))) - 0.5) * vec2(1.6, 1.6);
          center += vec2(
            sin(u_time * (0.15 + 0.04 * fi) + fi) * 0.12 * (0.4 + u_mid),
            cos(u_time * (0.19 + 0.03 * fi) - fi) * 0.1 * (0.4 + u_treble)
          );
          vec2 dv = uv - center;
          float stretch = 0.45 + hash(center + fi) * 0.7 + u_bass * 0.8;
          float core = exp(-dot(dv * vec2(1.2, stretch), dv * vec2(1.2, stretch)) * (6.0 - u_bass * 2.5));
          float band = fbm(dv * (5.0 + u_rms * 8.0) + fi * 13.0 + u_time * 0.4);
          storm += core * (0.6 + band * 0.9);
        }

        float radialBands = smoothstep(0.08, 0.0, abs(fract(r * (8.0 + u_mid * 10.0) - u_time * 0.25) - 0.5));
        float precip = clamp(storm * (0.65 + u_bass * 1.7) + radialBands * sweepLine * 0.18, 0.0, 1.2);
        float intensity = clamp(precip * (0.7 + u_bass * 1.6 + u_beat * 0.5), 0.0, 1.0);

        vec3 radarBase = vec3(0.01, 0.04, 0.03);
        vec3 grid = vec3(0.08, 0.35, 0.22) * (0.12 + sweepGlow * 0.45);
        float rings = smoothstep(0.018, 0.0, abs(fract(r * 6.0) - 0.5));
        float spokes = smoothstep(0.06, 0.0, abs(sin(ang * 6.0)));
        radarBase += (rings * 0.25 + spokes * 0.08) * vec3(0.0, 0.7, 0.35);

        vec3 precipCol = rainPalette(intensity);
        precipCol *= 0.5 + sweepLine * 1.3 + sweepGlow * 0.6;

        float noiseBurst = fbm(uv * (40.0 + u_rms * 80.0) + u_time * (5.0 + u_treble * 12.0));
        float radarNoise = (noiseBurst - 0.5) * (0.08 + u_rms * 0.4 + u_beat * 0.12);
        float flash = exp(-r * 2.4) * u_beat * (0.8 + 0.4 * sin(ang * 18.0 + u_time * 18.0));

        vec3 col = radarBase;
        col += precipCol * (0.8 + u_rms * 0.4);
        col += sweepLine * vec3(0.35, 1.0, 0.55) * (0.6 + u_treble * 1.4 + u_beat * 0.3);
        col += sweepGlow * vec3(0.1, 0.6, 0.35);
        col += vec3(radarNoise);
        col += flash * vec3(0.9, 0.95, 1.0);

        float vignette = smoothstep(1.05, 0.08, r);
        col *= vignette;
        col += vec3(0.02, 0.08, 0.04) * (u_bass * 0.3 + u_rms * 0.2);

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
window.VJamFX.presets['weather-radar'] = WeatherRadarPreset;
})();
