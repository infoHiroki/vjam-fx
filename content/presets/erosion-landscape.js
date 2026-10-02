(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Erosion Landscape
 * Heightfield raymarch approximating hydraulic erosion, sediment channels, and beat-triggered landslides.
 */
class ErosionLandscapePreset extends BasePreset {
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

        preset.beatPulse *= 0.9;
        preset._time += 0.009 + preset.audio.bass * 0.005 + preset.audio.rms * 0.003;

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
        for (int i = 0; i < 6; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      mat2 rot(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }

      float terrain(vec2 p) {
        vec2 wp = p;
        wp *= rot(u_mid * 2.4 + 0.25 * sin(u_time * 0.2));
        float macro = fbm(wp * (0.45 + u_treble * 0.35));
        float ridged = abs(fbm(wp * (0.95 + u_treble * 1.6) + 5.0) * 2.0 - 1.0);
        float rain = 0.14 + u_bass * 0.55 + u_rms * 0.08;
        float hardness = 0.28 + u_treble * 0.6;
        float flow = fbm((wp + vec2(u_time * (0.14 + u_mid * 0.3), -u_time * (0.05 + u_mid * 0.24))) * (1.3 + u_bass * 1.5));
        float channels = smoothstep(0.46 - rain * 0.18, 0.88 - hardness * 0.22, flow);
        float valleys = (1.0 - channels) * (0.3 + rain * 1.1);
        float landslide = exp(-abs(wp.x + 0.35 * sin(u_time * 0.6) - wp.y * 0.7) * (8.0 - u_beat * 2.0)) * u_beat * 0.4;
        float h = macro * (1.3 - rain * 0.4) + ridged * (0.8 + hardness * 0.9) - valleys - landslide;
        h += 0.12 * sin(wp.x * 0.8 + u_time * 0.3) * (0.4 + u_mid * 0.6);
        return h;
      }

      vec3 normalAt(vec3 p) {
        vec2 e = vec2(0.01, 0.0);
        float h = terrain(p.xz);
        float hx = terrain(p.xz + e.xy);
        float hz = terrain(p.xz + e.yx);
        return normalize(vec3(h - hx, e.x, h - hz));
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
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
        float fly = u_time * (0.45 + u_mid * 1.2);
        vec3 ro = vec3(0.0, 1.7 + u_bass * 0.8 + u_beat * 0.2, fly);
        vec3 rd = normalize(vec3(uv.x, uv.y - 0.18 - u_bass * 0.08, -1.25));
        rd.xz *= rot(0.08 * sin(u_time * 0.2) + u_mid * 0.18);

        float t = 0.0;
        bool hit = false;
        vec3 pos = ro;
        for (int i = 0; i < 96; i++) {
          pos = ro + rd * t;
          float h = pos.y - terrain(pos.xz);
          if (h < 0.002) {
            hit = true;
            break;
          }
          t += max(0.02, h * 0.5);
          if (t > 10.0) break;
        }

        vec3 sky = mix(vec3(0.08, 0.12, 0.18), vec3(0.35, 0.28, 0.2), 0.5 + 0.5 * rd.y);
        sky += vec3(0.18, 0.15, 0.1) * exp(-abs(uv.y + 0.15) * 6.0) * (0.3 + u_bass * 0.5);
        sky += vec3(0.06, 0.09, 0.14) * u_rms;
        vec3 col = sky;

        if (hit) {
          vec3 nor = normalAt(pos);
          vec3 light = normalize(vec3(-0.4 + u_mid * 0.6, 0.9, 0.2));
          float diff = max(dot(nor, light), 0.0);
          float spec = pow(max(dot(reflect(-light, nor), -rd), 0.0), 22.0 + u_rms * 45.0);
          float slope = 1.0 - nor.y;
          float wet = smoothstep(0.45, 0.85, fbm(pos.xz * (1.8 + u_bass * 2.0) - vec2(0.0, u_time * (0.7 + u_bass * 1.2))));
          float river = wet * (0.25 + u_rms * 1.25) * (0.55 + u_bass * 0.75);
          float debris = exp(-abs(pos.x + pos.z * 0.32 - sin(u_time) * 0.4) * (10.0 - u_beat * 5.0)) * u_beat;

          vec3 rock = mix(vec3(0.38, 0.28, 0.2), vec3(0.85, 0.62, 0.4), diff);
          rock = mix(rock, vec3(0.7, 0.65, 0.58), slope * (0.35 + u_treble * 0.4));
          vec3 water = vec3(0.18, 0.35, 0.4) + vec3(0.06, 0.12, 0.16) * u_rms;

          col = rock * (0.4 + diff * 1.2);
          col = mix(col, water, river);
          col += vec3(1.1, 1.05, 0.9) * spec * (0.2 + river * 0.8 + u_rms * 0.5);
          col += vec3(0.5, 0.32, 0.22) * debris;
          col += vec3(0.08, 0.12, 0.16) * wet * (0.4 + u_bass * 0.4);
        }

        float fog = 1.0 - exp(-t * (0.07 + u_rms * 0.09));
        col = mix(col, sky + vec3(0.08, 0.07, 0.06) * u_beat, fog);

        // Boost saturation and contrast
        col *= 1.8;
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(luma), col, 1.4);

        col *= 1.0 - dot(uv, uv) * (0.16 - u_rms * 0.04);
        col = pow(max(col, 0.0), vec3(0.88));
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
window.VJamFX.presets['erosion-landscape'] = ErosionLandscapePreset;
})();
