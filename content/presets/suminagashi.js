(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SuminagashiPreset extends BasePreset {
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

        preset._time += 0.008 + preset.audio.rms * 0.016 + preset.audio.treble * 0.022;
        preset.beatPulse *= 0.89;

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

      vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        rgb = rgb * rgb * (3.0 - 2.0 * rgb);
        return c.z * mix(vec3(1.0), rgb, c.y);
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
        float flowRate = 0.25 + u_rms * 0.8;
        float swirlRate = 0.45 + u_treble * 3.0 + u_beat * 0.7;
        float expansion = 0.2 + u_bass * 0.95;

        vec2 p = uv + audioDrift;
        for (int i = 0; i < 5; i++) {
          float fi = float(i);
          float t = u_time * (0.3 + fi * 0.08);
          vec2 c = (vec2(
            hash(vec2(floor(t * (0.9 + u_beat * 1.8)) + fi, 1.3 + fi)),
            hash(vec2(4.7 + fi, floor(t * (1.1 + u_beat * 2.2)) + fi))
          ) - 0.5) * 1.6;
          vec2 d = p - c;
          float rr = dot(d, d) + 0.02;
          float vortex = swirlRate * (0.03 + 0.018 * fi) / rr;
          p += vec2(-d.y, d.x) * vortex;
          p += d * (-expansion * 0.028 / rr);
          p += vec2(
            sin(p.y * (2.0 + fi) + u_time * (0.7 + u_rms * 2.0)),
            cos(p.x * (1.5 + fi) - u_time * (0.6 + u_mid * 1.5))
          ) * flowRate * 0.03;
        }

        float marble = 0.0;
        marble += sin(p.x * (9.0 + u_mid * 16.0));
        marble += sin((p.x + p.y) * (7.0 + u_treble * 10.0));
        marble += sin(length(p) * (16.0 + u_bass * 18.0) - u_time * (0.8 + u_treble * 2.0));
        marble /= 3.0;
        float contour = smoothstep(-0.1 - u_rms * 0.08, 0.55 + u_rms * 0.12, marble);

        float dropletMask = 0.0;
        float pigment = 0.0;
        for (int i = 0; i < 4; i++) {
          float fi = float(i);
          float beatClock = floor(u_time * (0.25 + u_beat * 1.4) + fi * 7.0);
          vec2 c = (vec2(hash(vec2(beatClock, fi + 8.0)), hash(vec2(fi + 13.0, beatClock))) - 0.5) * 1.5;
          float d = length(uv - c);
          float radius = 0.08 + hash(c + fi) * 0.18 + expansion * 0.18;
          float ring = smoothstep(radius + 0.03 + u_rms * 0.03, radius - 0.02, d);
          dropletMask += ring;
          pigment += ring * (0.5 + fi * 0.12);
        }

        float hue = fract(0.02 + u_mid * 0.3 + contour * 0.12 + noise(p * 2.5) * 0.1);
        vec3 paper = vec3(0.97, 0.95, 0.9);
        vec3 inkA = hsv2rgb(vec3(hue, 0.18 + u_mid * 0.45, 0.08));
        vec3 inkB = hsv2rgb(vec3(fract(hue + 0.12 + u_mid * 0.08), 0.35 + u_mid * 0.5, 0.16 + u_rms * 0.1));
        vec3 ink = mix(inkA, inkB, contour + dropletMask * 0.25);

        float water = noise(p * (14.0 + u_rms * 26.0) + u_time * (1.2 + swirlRate)) * (0.04 + u_rms * 0.16);
        float sheen = pow(max(0.0, noise(p * (26.0 + u_treble * 24.0) - u_time * (4.0 + u_treble * 10.0)) - (0.76 - u_treble * 0.22)), 3.0);

        vec3 col = mix(paper, ink, clamp(contour * 0.95 + dropletMask * 0.55, 0.0, 1.0));
        col -= pigment * vec3(0.025, 0.022, 0.02);
        col += water;
        col += sheen * vec3(0.25, 0.35, 0.45) * (0.2 + u_treble * 0.9);
        col *= 1.0 - dot(suv, suv) * 0.15;
        col += vec3(0.03, 0.04, 0.05) * u_beat;

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
window.VJamFX.presets['suminagashi'] = SuminagashiPreset;
})();
