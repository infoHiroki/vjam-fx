(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class OceanCausticsGpuPreset extends BasePreset {
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

        preset._time += 0.014 + preset.audio.treble * 0.01 + preset.audio.rms * 0.006;
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
          a *= 0.52;
        }
        return v;
      }

      float waveHeight(vec2 p, float t) {
        float swell = sin(p.x * (1.8 + u_bass * 2.8) + t * (0.6 + u_treble * 0.4));
        float cross = sin(p.y * (2.1 + u_bass * 1.8) - t * (0.45 + u_treble * 0.2));
        float chop = fbm(p * (2.6 + u_bass * 3.0) + vec2(t * (0.35 + u_treble), -t * (0.22 + u_treble * 0.8)));
        float ripples = fbm(p * (6.0 + u_treble * 10.0) + vec2(-t * (1.2 + u_treble * 2.8), t * 0.9));
        float h = swell * 0.09 + cross * 0.06 + chop * (0.12 + u_bass * 0.18) + ripples * (0.03 + u_treble * 0.04);
        h += sin((p.x + p.y) * (7.0 + u_treble * 12.0) + t * (2.4 + u_treble * 6.0)) * 0.015;
        return h;
      }

      float focusField(vec2 p, float t) {
        float e = 0.01;
        float h = waveHeight(p, t);
        float hx1 = waveHeight(p + vec2(e, 0.0), t);
        float hx2 = waveHeight(p - vec2(e, 0.0), t);
        float hy1 = waveHeight(p + vec2(0.0, e), t);
        float hy2 = waveHeight(p - vec2(0.0, e), t);
        vec2 grad = vec2(hx1 - hx2, hy1 - hy2) / (2.0 * e);
        float lap = (hx1 + hx2 + hy1 + hy2 - 4.0 * h) / (e * e);
        float jacobian = 1.0 - dot(grad, grad) * (1.6 + u_bass * 2.4) - lap * (0.12 + u_mid * 0.08);
        float focus = 1.0 / (0.28 + abs(jacobian));
        focus *= 0.6 + u_rms * 1.5;
        focus += max(0.0, -lap) * (0.08 + u_bass * 0.12);
        return focus;
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

        float depth = clamp(0.52 - uv.y * (0.75 + u_mid * 0.55), 0.0, 1.0);
        vec3 water = mix(vec3(0.01, 0.07, 0.12), vec3(0.0, 0.16, 0.24), 1.0 - depth);
        water = mix(water, vec3(0.0, 0.05, 0.08), depth * depth);

        vec2 refractUv = uv * (1.6 + depth * 1.5 + u_mid * 0.6);
        refractUv += vec2(0.0, t * 0.05);
        refractUv += vec2(sin(uv.y * 3.5 + t * 0.25), cos(uv.x * 2.8 - t * 0.18)) * (0.05 + u_bass * 0.08);

        float focusA = focusField(refractUv, t * (0.8 + u_treble * 1.8));
        float focusB = focusField(refractUv * 1.8 + vec2(3.1, -2.4), t * (1.3 + u_treble * 2.6));
        float focusC = focusField(refractUv * 3.2 - vec2(1.7, 2.1), t * (2.1 + u_treble * 3.4));
        float caustics = focusA * 0.5 + focusB * 0.33 + focusC * 0.17;
        caustics *= smoothstep(1.15, 0.05, depth + u_mid * 0.12);
        caustics *= 1.0 + u_beat * 0.18;
        caustics = pow(max(caustics, 0.0), 1.2);

        float sand = fbm(uv * 7.0 + vec2(0.0, t * 0.02));
        float dunes = sin(uv.x * 12.0 + sand * 5.0 + t * 0.04) * 0.5 + 0.5;
        vec3 floorCol = mix(vec3(0.08, 0.12, 0.09), vec3(0.22, 0.2, 0.12), dunes);
        floorCol *= 0.4 + 0.6 * depth;

        float sun = 0.7 + u_rms * 1.6 + u_bass * 0.25;
        vec3 lightCol = mix(vec3(0.15, 0.45, 0.5), vec3(1.0, 0.95, 0.7), smoothstep(0.35, 1.6, caustics));
        lightCol += vec3(0.1, 0.15, 0.2) * u_treble;
        lightCol += vec3(0.25, 0.25, 0.18) * u_beat;

        float shafts = exp(-abs(uv.x + sin(t * 0.2 + uv.y * 1.3) * (0.18 + u_mid * 0.1)) * (5.0 + u_rms * 3.0));
        shafts += exp(-abs(uv.x - 0.28 + cos(t * 0.15 + uv.y * 1.7) * (0.1 + u_mid * 0.08)) * (7.0 + u_rms * 4.0));
        shafts *= (1.0 - depth) * (0.15 + u_rms * 0.35);

        float crest = smoothstep(1.1, 1.85 + u_bass * 0.9, caustics) * (0.2 + u_beat * 1.8);
        float flicker = sin(t * (6.0 + u_treble * 20.0) + uv.x * 30.0 + uv.y * 25.0) * 0.5 + 0.5;
        crest *= 0.5 + 0.5 * flicker;

        vec3 col = mix(water, floorCol, depth);
        col += lightCol * caustics * sun * (0.22 + depth * 0.9);
        col += vec3(0.45, 0.7, 0.85) * shafts;
        col += vec3(1.0, 1.0, 0.95) * crest;
        col += vec3(0.6, 0.85, 1.0) * u_beat * caustics * 0.22;
        col *= 1.0 - smoothstep(0.95, 1.45, length(uv * vec2(0.95, 1.08))) * 0.3;
        col = 1.0 - exp(-col * (1.05 + u_rms * 0.5));
        col = pow(col, vec3(0.9));

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
window.VJamFX.presets['ocean-caustics-gpu'] = OceanCausticsGpuPreset;
})();
