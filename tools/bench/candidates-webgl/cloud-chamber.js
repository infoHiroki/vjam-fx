(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CloudChamberPreset extends BasePreset {
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

        preset._time += 0.01 + preset.audio.mid * 0.013 + preset.audio.treble * 0.008;
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
          p = p * 2.04 + vec2(0.9, -0.6);
          a *= 0.5;
        }
        return v;
      }

      float segmentGlow(vec2 uv, vec2 a, vec2 b, float width) {
        vec2 pa = uv - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return exp(-length(pa - ba * h) * width);
      }

      vec2 alphaPath(float fi, float t) {
        float x = sin(fi * 16.0 + t * (0.7 + u_treble * 1.1)) * 0.55;
        float y = fi * 2.2 - 1.1 + sin(fi * 13.0 + t * 0.9) * 0.05;
        return vec2(x, y);
      }

      vec2 betaPath(float fi, float seed, float t) {
        float bend = sin(fi * (9.0 + seed * 4.0) + t * (1.4 + u_mid * 3.0)) * (0.14 + u_mid * 0.28);
        float curl = cos(fi * (14.0 + seed * 5.0) - t * (1.0 + u_mid * 2.0)) * (0.08 + u_mid * 0.18);
        float x = mix(-0.8 + seed * 1.4, 0.7 - seed * 1.0, fi) + bend + curl;
        float y = -1.05 + fi * 2.1;
        return vec2(x, y);
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
        float beatMorph = smoothstep(0.18, 0.82, u_beat);

        float fog = fbm(uv * (2.3 + u_rms * 1.4) + vec2(t * 0.04, -t * 0.03));
        float supersat = 0.12 + u_bass * 0.45;
        vec3 col = vec3(0.02, 0.025, 0.03) + vec3(0.16, 0.18, 0.2) * fog * (0.4 + u_rms * 1.2 + supersat);

        float alphaTrack = 0.0;
        for (int i = 0; i < 8; i++) {
          float fi = float(i) / 7.0;
          vec2 a = alphaPath(fi, t);
          vec2 b = alphaPath(min(fi + 0.13, 1.0), t);
          alphaTrack += segmentGlow(uv, a, b, 75.0 - u_treble * 20.0);
        }
        alphaTrack *= 0.4 + u_treble * 1.5;

        float betaTrack = 0.0;
        for (int j = 0; j < 4; j++) {
          float seed = float(j) * 0.23 + 0.11;
          for (int i = 0; i < 7; i++) {
            float fi = float(i) / 6.0;
            vec2 a = betaPath(fi, seed, t + seed * 2.0);
            vec2 b = betaPath(min(fi + 0.16, 1.0), seed, t + seed * 2.0);
            betaTrack += segmentGlow(uv, a, b, 120.0 - u_mid * 30.0);
          }
        }
        betaTrack *= 0.18 + u_mid * 1.1;

        float shower = 0.0;
        for (int i = 0; i < 7; i++) {
          float fi = float(i) / 6.0;
          float ang = -1.2 + fi * 2.4 + sin(t * 0.8 + fi * 7.0) * 0.15;
          vec2 dir = vec2(cos(ang), sin(ang));
          vec2 origin = vec2(sin(fi * 8.0 + t) * 0.12, 0.9);
          shower += segmentGlow(uv, origin, origin - dir * (1.1 + u_beat * 0.8), 155.0);
        }
        shower *= beatMorph * (0.3 + u_beat * 1.5);

        float droplets = hash21(floor((uv + 1.4) * (40.0 + u_rms * 50.0)));
        float condensation = smoothstep(0.72 - u_bass * 0.22, 1.0, droplets) * (0.05 + u_rms * 0.25);

        col += vec3(0.96, 0.96, 0.92) * alphaTrack * (0.3 + u_bass * 0.6);
        col += vec3(0.72, 0.86, 1.0) * betaTrack * (0.28 + u_mid * 0.45);
        col += vec3(1.0, 0.98, 0.88) * shower;
        col += vec3(0.8, 0.84, 0.88) * condensation;

        float chamber = 1.0 - smoothstep(0.78, 1.18, length(uv * vec2(0.88, 1.06)));
        float frost = fbm(vec2(uv.x * (8.0 + u_treble * 5.0), uv.y * 5.0 + t * 0.05));
        col += vec3(0.06, 0.07, 0.09) * frost * (0.18 + u_treble * 0.18);
        col *= chamber;
        col = 1.0 - exp(-col * (1.25 + u_rms * 0.9 + u_bass * 0.25));
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
window.VJamFX.presets['cloud-chamber'] = CloudChamberPreset;
})();
