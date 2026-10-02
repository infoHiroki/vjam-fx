(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class LiquidNitrogenPreset extends BasePreset {
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

        preset.beatPulse *= 0.91;
        preset._time += 0.009 + preset.audio.mid * 0.008 + preset.audio.rms * 0.005;

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
          p *= 2.02;
          a *= 0.5;
        }
        return v;
      }

      vec2 swirl(vec2 p, float amt) {
        float r = length(p);
        float a = atan(p.y, p.x) + amt * exp(-r * 2.4);
        return vec2(cos(a), sin(a)) * r;
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
        float beatMorph = smoothstep(0.06, 0.82, u_beat);

        vec2 q = uv;
        q.x += sin(uv.y * (5.0 + u_mid * 10.0) + u_time * (0.7 + u_mid * 1.8)) * (0.03 + u_mid * 0.09);
        q = swirl(q, sin(u_time * 0.5) * 0.18 + u_mid * 0.25 + beatMorph * 0.45);

        float liquidLine = -0.08 + sin(q.x * (3.0 + u_mid * 5.0) + u_time * (1.4 + u_mid * 2.0)) * (0.04 + u_mid * 0.12);
        float vessel = smoothstep(0.92, 0.2, length(vec2(uv.x * 0.9, uv.y + 0.05)));
        float liquidMask = smoothstep(q.y, q.y - 0.015, liquidLine) * vessel;

        vec2 boilUv = q * (2.4 + u_treble * 3.8);
        float macroBoil = fbm(boilUv + vec2(0.0, -u_time * (0.5 + u_bass * 1.8)));
        float microBoil = fbm(boilUv * (2.0 + u_treble * 2.8) + vec2(u_time * (1.8 + u_treble * 4.0), -u_time * 0.8));
        float bubble = smoothstep(0.68 - u_bass * 0.22, 0.98, macroBoil + microBoil * (0.45 + u_treble * 0.8));
        bubble *= liquidMask;

        float vapor = fbm(vec2(uv.x * (3.5 + u_treble * 5.5), uv.y * 2.2 - u_time * (0.7 + u_rms * 1.8)));
        vapor += fbm(vec2(uv.x * (8.0 + u_treble * 10.0), uv.y * 5.0 - u_time * (1.5 + u_treble * 2.5))) * 0.45;
        float vaporMask = smoothstep(liquidLine + 0.02, liquidLine - 0.4 - u_rms * 0.25, q.y);
        vapor *= vaporMask * (0.3 + u_rms * 1.2);

        float crystal = fbm(swirl(uv * (6.0 + beatMorph * 8.0), beatMorph * 1.1) + u_time * 0.03);
        crystal += abs(sin((uv.x - uv.y) * (20.0 + beatMorph * 20.0))) * 0.35;
        crystal = smoothstep(0.72 - beatMorph * 0.28, 0.98, crystal) * beatMorph;

        float frostEdge = smoothstep(0.22 + u_beat * 0.18, 0.0, abs(q.y - liquidLine));
        float shimmer = sin(length(q + vec2(0.0, 0.2)) * (14.0 + u_treble * 18.0) - u_time * (2.0 + u_treble * 8.0));

        vec3 bg = mix(vec3(0.0, 0.02, 0.05), vec3(0.01, 0.06, 0.1), exp(-length(uv) * 2.0));
        vec3 liquid = vec3(0.08, 0.46, 0.7) * liquidMask;
        liquid += vec3(0.12, 0.82, 0.95) * bubble * (0.4 + u_bass * 1.3);
        liquid += vec3(0.25, 0.95, 1.0) * frostEdge * (0.1 + u_mid * 0.4);

        vec3 steam = vec3(0.7, 0.88, 1.0) * vapor * (0.35 + u_rms * 0.9);
        vec3 freeze = vec3(0.8, 0.95, 1.0) * crystal * (0.6 + u_beat * 1.4);
        vec3 sparkles = vec3(0.4, 0.95, 1.0) * max(shimmer, 0.0) * frostEdge * (0.1 + u_treble * 0.25);

        vec3 col = bg + liquid + steam + freeze + sparkles;
        col += vec3(0.1, 0.25, 0.4) * u_bass * exp(-abs(q.y - liquidLine) * 8.0);
        col *= 1.0 - smoothstep(1.0, 1.4, length(uv));
        col = pow(max(col, 0.0), vec3(0.94));

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
    this.beatPulse = Math.min(1, strength);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['liquid-nitrogen'] = LiquidNitrogenPreset;
})();
