(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SandTimerPreset extends BasePreset {
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

        preset._time += 0.01 + preset.audio.bass * 0.017 + preset.audio.mid * 0.004;
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
          p *= 2.06;
          a *= 0.5;
        }
        return v;
      }

      vec2 rotate(vec2 p, float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c) * p;
      }

      float glassShell(vec2 p, float w) {
        float outer = smoothstep(w, w - 0.015, abs(p.x) - (0.46 - abs(p.y) * 0.56));
        float neck = smoothstep(0.045, 0.018, abs(p.x)) * smoothstep(0.18, 0.03, abs(p.y));
        return max(outer, neck);
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
        float tilt = (u_mid - 0.5) * 0.65 + sin(t * 0.15) * 0.08;
        float beatFlip = step(0.16, u_beat) * 3.14159265;
        vec2 p = rotate(uv, tilt + beatFlip);

        float flowSpeed = 0.22 + u_bass * 1.45 + u_beat * 0.4;
        float streamWidth = 0.04 - u_treble * 0.02 + u_beat * 0.006;
        float grainScale = 42.0 + u_treble * 150.0;
        float glassAlpha = 0.12 + u_rms * 0.4 + u_beat * 0.08;

        float cycle = fract(t * (0.045 + u_bass * 0.03) + u_beat * 0.42);
        float upperFill = 1.0 - cycle;
        float lowerFill = cycle;

        float topChamber = smoothstep(0.48, 0.18, p.y);
        float bottomChamber = smoothstep(-0.48, -0.18, p.y);

        float upperSurface = 0.32 - upperFill * 0.46 + sin(p.x * 13.0 + t * 0.5) * (0.01 + u_treble * 0.01);
        float lowerSurface = -0.32 + lowerFill * 0.46 + sin(p.x * 10.0 - t * 0.35) * (0.01 + u_treble * 0.012);

        float upperSand = smoothstep(0.025, -0.02, p.y - upperSurface) * topChamber;
        float lowerSand = smoothstep(0.025, -0.02, lowerSurface - p.y) * bottomChamber;

        float stream = smoothstep(streamWidth, streamWidth * 0.25, abs(p.x));
        stream *= smoothstep(0.18, 0.03, p.y) * smoothstep(-0.18, -0.03, p.y);
        stream *= 0.6 + flowSpeed;

        float grainsA = hash(floor((p + vec2(0.0, t * flowSpeed)) * grainScale));
        float grainsB = hash(floor((rotate(p, 0.6) + vec2(t * 0.3, -t * flowSpeed * 1.3)) * (grainScale * 0.65)));
        float grains = mix(grainsA, grainsB, 0.45 + u_treble * 0.3);
        grains = smoothstep(0.48 - u_treble * 0.12, 1.0, grains);

        float drift = fbm(p * (4.0 + u_mid * 3.0) + vec2(t * 0.1, -t * flowSpeed * 0.4));
        float dune = smoothstep(0.42, 0.82, drift + lowerSand * 0.4);
        lowerSand *= 0.8 + dune * 0.5;

        float neckFlash = exp(-length(vec2(p.x * 6.0, p.y * 18.0)) * (2.2 - u_bass * 0.5));
        neckFlash *= u_beat * (0.6 + u_rms * 0.5);

        float glass = glassShell(p, 0.026 + u_rms * 0.006);
        float glassNoise = fbm(rotate(p, 0.8) * (10.0 + u_rms * 4.0) + t * 0.03);

        vec3 bg = mix(vec3(0.015, 0.02, 0.03), vec3(0.05, 0.035, 0.02), 0.5 + 0.5 * uv.y);
        vec3 sandCol = mix(vec3(0.44, 0.31, 0.16), vec3(0.93, 0.78, 0.48), grains * 0.8 + u_rms * 0.25);
        sandCol += vec3(0.1, 0.05, 0.01) * u_bass;

        vec3 glassCol = mix(vec3(0.15, 0.2, 0.24), vec3(0.72, 0.82, 0.9), glassNoise * 0.7 + u_rms * 0.25);
        glassCol *= glassAlpha;

        vec3 col = bg;
        col += sandCol * upperSand * (0.7 + grains * 0.6 + u_bass * 0.2);
        col += sandCol * lowerSand * (0.8 + dune * 0.6 + u_mid * 0.2);
        col += sandCol * stream * grains * (0.5 + u_treble * 0.9 + u_bass * 0.2);
        col += vec3(1.0, 0.88, 0.64) * neckFlash;
        col = mix(col, glassCol + col, glass);
        col += vec3(0.75, 0.85, 0.95) * glass * (0.12 + u_rms * 0.25 + u_beat * 0.15);

        float beatStructure = step(0.16, u_beat);
        col = mix(col, col.bgr * vec3(0.9, 0.85, 0.7), beatStructure * 0.18);

        float vignette = 1.0 - smoothstep(0.72, 1.3, length(uv * vec2(0.9, 1.08)));
        col *= vignette;
        col = 1.0 - exp(-col * (1.1 + u_rms * 0.5));

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
window.VJamFX.presets['sand-timer'] = SandTimerPreset;
})();
