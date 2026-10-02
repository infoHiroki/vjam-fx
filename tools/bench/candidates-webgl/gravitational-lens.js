(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GravitationalLensPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._time = 0;
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

        preset._time += 0.012 + preset.audio.mid * 0.009 + preset.audio.treble * 0.006;
        preset.beatPulse *= 0.9;

        try {
          p.background(0);
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

      vec3 starField(vec2 uv, float density, float twinkle) {
        vec2 grid = uv * density;
        vec2 cell = floor(grid);
        vec2 fracUv = fract(grid) - 0.5;
        float id = hash21(cell);
        vec2 offset = vec2(hash21(cell + 3.1), hash21(cell + 8.7)) - 0.5;
        float star = smoothstep(0.12, 0.0, length(fracUv - offset * 0.7));
        float pulse = 0.6 + 0.4 * sin(twinkle + id * 25.0 + u_treble * 9.0);
        vec3 col = mix(vec3(0.5, 0.65, 1.0), vec3(1.0, 0.92, 0.82), id);
        return col * star * pulse;
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
        float t = u_time;

        vec2 lensCenter = vec2(
          sin(t * (0.25 + u_mid * 0.7) + u_mid * 3.0),
          cos(t * (0.18 + u_mid * 0.5) + u_bass * 2.5)
        ) * (0.08 + u_mid * 0.28);

        vec2 rel = uv - lensCenter;
        float r = length(rel) + 0.0008;
        float mass = 0.04 + u_bass * 0.18 + u_bass * u_bass * 0.06;
        float bend = mass / r;
        bend *= 0.8 + u_rms * 0.45;
        bend += u_bass * 0.03 / (r * r + 0.07);

        float beatShock = smoothstep(0.08, 0.8, u_beat);
        float shockRing = exp(-abs(r - (0.18 + u_beat * 0.35)) * (25.0 - u_beat * 10.0)) * beatShock;

        vec2 deflect = normalize(rel) * bend;
        deflect += normalize(rel.yx * vec2(1.0, -1.0)) * shockRing * 0.08;
        vec2 src = uv + deflect;

        float densityA = mix(20.0, 54.0, u_treble);
        float densityB = mix(35.0, 90.0, u_treble);
        vec3 stars = starField(src * 1.2, densityA, t * (1.4 + u_treble * 6.0));
        stars += starField(src * 2.1 + 11.0, densityB, -t * (1.1 + u_treble * 5.0));
        stars += vec3(0.03, 0.05, 0.08) * noise(src * 6.0 - t * 0.05);

        float ring = exp(-abs(r - (0.22 + mass * 0.9)) * (22.0 + u_rms * 18.0));
        ring *= 0.25 + u_rms * 1.2;
        ring *= 1.0 + u_bass * 0.8;

        float photonSphere = exp(-r * (13.0 - u_bass * 5.0));
        vec3 ringCol = mix(vec3(0.25, 0.45, 1.0), vec3(1.0, 0.95, 0.8), u_rms);
        ringCol += vec3(0.3, 0.15, 0.6) * u_beat;
        ringCol *= 0.5 + u_rms * 0.8;

        vec3 col = stars;
        col += ringCol * ring;
        col += vec3(0.08, 0.14, 0.28) * photonSphere * (0.4 + u_bass + u_rms);

        float core = smoothstep(0.08 + u_bass * 0.05, 0.0, r);
        col *= 1.0 - core;

        float pulsar = exp(-abs(atan(rel.y, rel.x) - t * (2.0 + u_treble * 4.0)) * 3.0);
        pulsar += exp(-abs(atan(rel.y, rel.x) - t * (2.0 + u_treble * 4.0) - 3.14159) * 3.0);
        col += vec3(0.7, 0.85, 1.0) * pulsar * beatShock * (0.3 + u_beat * 1.2);

        col += vec3(1.0, 0.9, 0.8) * shockRing * (0.3 + u_rms * 0.7);
        col *= 0.92 + u_rms * 0.22;

        gl_FragColor = vec4(audioReactiveFinalize(max(col, 0.0), uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }
    `;

    try {
      return p.createShader(vert, frag);
    } catch (_) {
      return null;
    }
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    this.beatPulse = Math.min(1, strength);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['gravitational-lens'] = GravitationalLensPreset;
})();
