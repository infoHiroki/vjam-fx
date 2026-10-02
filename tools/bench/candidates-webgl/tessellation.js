(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class TessellationPreset extends BasePreset {
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
        p.createCanvas(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight, p.WEBGL);
        p.pixelDensity(1);
      };

      p.draw = () => {
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }

        preset._time += 0.012 + preset.audio.bass * 0.02 + preset.audio.mid * 0.008;
        preset.beatPulse *= 0.9;

        p.background(0);

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
        p.resizeCanvas(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
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

      const float PI = 3.14159265359;

      mat2 rot(float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c);
      }

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float sdBox(vec2 p, vec2 b) {
        vec2 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      }

      float sdDiamond(vec2 p, float r) {
        p = abs(p);
        return (p.x + p.y - r) * 0.70710678;
      }

      float sdTri(vec2 p, float r) {
        const float k = 1.7320508;
        p.x = abs(p.x) - r;
        p.y = p.y + r / k;
        if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) * 0.5;
        p.x -= clamp(p.x, -2.0 * r, 0.0);
        return -length(p) * sign(p.y);
      }

      vec3 palette(float t, float shift) {
        vec3 a = vec3(0.16, 0.20, 0.26);
        vec3 b = vec3(0.44, 0.32 + 0.25 * u_rms, 0.42 + 0.18 * u_rms);
        vec3 c = vec3(0.78 + 0.28 * u_treble, 0.92, 0.84 + 0.24 * u_bass);
        vec3 d = vec3(0.12, 0.31 + 0.18 * u_mid, 0.55 + shift + 0.15 * u_rms);
        return a + b * cos(6.28318 * (c * t + d));
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
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
        float bassScale = 4.0 + u_bass * 5.5 + u_beat * 1.2;
        vec2 suv = uv * bassScale;
        float angle = u_mid * 1.8 + sin(u_time * 0.3) * 0.25 + u_beat * 0.7;
        suv *= rot(angle);

        vec2 gid = floor(suv);
        vec2 gv = fract(suv) - 0.5;
        float checker = mod(gid.x + gid.y, 2.0);
        float pattern = mod(floor(u_time * 0.18 + u_beat * 6.0 + hash21(gid) * 2.0), 3.0);

        vec2 warp = vec2(
          sin((gid.y + gv.x) * 1.7 + u_time * 0.9 + u_mid * 2.4),
          cos((gid.x + gv.y) * 1.6 - u_time * 0.8 - u_mid * 1.7)
        );
        gv += warp * (0.08 + u_treble * 0.22 + u_beat * 0.1);
        gv *= rot((checker - 0.5) * (0.3 + u_mid * 1.4));

        float dBox = sdBox(gv, vec2(0.28 + u_treble * 0.1, 0.28 - u_treble * 0.05));
        float dTri = sdTri(gv * rot(PI * 0.5 * checker), 0.42 - u_treble * 0.08);
        float dDia = sdDiamond(gv * rot(0.785 + u_mid * 0.35), 0.48 + u_bass * 0.08);
        float d = mix(dBox, dTri, step(1.0, pattern));
        d = mix(d, dDia, step(2.0, pattern));

        float grout = smoothstep(0.05 + u_rms * 0.05, 0.01, abs(d));
        float fillMask = smoothstep(0.16 + u_treble * 0.04, -0.03 - u_bass * 0.03, d);
        float micro = noise(gv * (8.0 + u_treble * 14.0) + gid * 0.23 + u_time * 0.15);
        float emboss = smoothstep(0.05, -0.05, d + micro * 0.06 - 0.03);
        float seams = smoothstep(0.22, 0.02, abs(gv.x * gv.y)) * (0.2 + u_mid * 0.5);

        float colorT = checker * 0.17 + pattern * 0.11 + micro * 0.24 + u_rms * 0.2;
        vec3 tileCol = palette(colorT, checker * 0.13);
        tileCol *= 0.72 + emboss * 0.5 + u_rms * 0.35;
        tileCol += palette(colorT + 0.21 + u_treble * 0.1, 0.2) * seams * 0.28;

        vec3 groutCol = mix(vec3(0.03, 0.03, 0.04), vec3(0.12, 0.08, 0.16), u_rms + u_beat * 0.3);
        vec3 col = mix(groutCol, tileCol, fillMask);
        col += grout * vec3(0.25 + u_rms * 0.3, 0.18 + u_treble * 0.22, 0.14 + u_bass * 0.2);
        col += vec3(0.32, 0.18, 0.08) * u_beat * (0.4 + checker * 0.4) * smoothstep(0.18, 0.0, abs(d));

        float vignette = smoothstep(1.45 + u_bass * 0.08, 0.18, length(uv));
        col *= vignette;
        col += palette(length(uv) * 0.5 + u_time * 0.03 + u_mid * 0.1, 0.4) * 0.08 * u_rms;

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
window.VJamFX.presets['tessellation'] = TessellationPreset;
})();
