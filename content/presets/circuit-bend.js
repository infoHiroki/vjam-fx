(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CircuitBendPreset extends BasePreset {
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

        preset._time += 0.013 + preset.audio.treble * 0.012 + preset.audio.bass * 0.008;
        preset.beatPulse *= 0.88;

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

      vec2 rotate(vec2 p, float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c) * p;
      }

      float trace(vec2 p, vec2 a, vec2 b, float w) {
        vec2 pa = p - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return smoothstep(w, w * 0.25, length(pa - ba * h));
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
        float bendMode = step(0.14, u_beat);

        vec2 scanUv = uv;
        scanUv.x += sin(uv.y * (25.0 + u_treble * 60.0) + t * (4.0 + u_treble * 10.0)) * (0.01 + u_mid * 0.02);
        scanUv.y += sin(uv.x * (18.0 + u_bass * 28.0) - t * (3.0 + u_bass * 9.0)) * (0.008 + u_beat * 0.03);

        float gridScale = 7.0 + u_bass * 14.0 + bendMode * 5.0;
        vec2 gridUv = scanUv * gridScale;
        vec2 gv = fract(gridUv) - 0.5;
        vec2 id = floor(gridUv);

        float trunk = trace(gv, vec2(-0.5, 0.0), vec2(0.5, 0.0), 0.08 - u_bass * 0.015);
        float branchA = trace(gv, vec2(0.0, 0.0), vec2(0.35, 0.28 + u_mid * 0.25), 0.07);
        float branchB = trace(gv, vec2(0.0, 0.0), vec2(-0.36, -0.24 - u_mid * 0.22), 0.07);
        float circuit = max(trunk, max(branchA, branchB));

        float via = smoothstep(0.16, 0.04, length(gv - vec2(sin(id.y + t), cos(id.x - t)) * 0.12));
        float chatter = noise(id + vec2(floor(t * (4.0 + u_treble * 12.0)), floor(t * (3.0 + u_treble * 9.0))));
        chatter = smoothstep(0.65 - u_treble * 0.18, 1.0, chatter);

        float voltage = sin((scanUv.x + scanUv.y) * (18.0 + u_bass * 30.0) - t * (8.0 + u_bass * 18.0));
        voltage = 0.5 + 0.5 * voltage;

        float sparkPath = trace(rotate(scanUv, 0.8 + u_mid * 0.6), vec2(-0.8, -0.2), vec2(0.9, 0.3), 0.035 + u_beat * 0.025);
        sparkPath += trace(rotate(scanUv, -0.5 - u_mid * 0.4), vec2(-0.3, -0.7), vec2(0.4, 0.8), 0.03 + u_beat * 0.02);
        sparkPath *= chatter * (u_beat * 1.4 + u_treble * 0.5);

        float shortBurst = exp(-length(scanUv - vec2(sin(t * 2.1), cos(t * 2.7)) * (0.18 + u_mid * 0.15)) * (18.0 - u_beat * 8.0));
        shortBurst *= u_beat * (0.8 + u_bass * 0.5);

        float scanline = 0.55 + 0.45 * sin(gl_FragCoord.y * (2.4 + u_rms * 7.0));
        scanline *= 0.65 + u_rms * 0.7;

        float rShift = noise(scanUv * (20.0 + u_treble * 30.0) + vec2(t * 1.3, 0.0)) * (0.01 + u_mid * 0.03);
        float bShift = noise(scanUv.yx * (18.0 + u_treble * 34.0) - vec2(t * 1.5, 0.0)) * (0.012 + u_mid * 0.035);

        vec3 phosphor = vec3(0.04, 0.08, 0.06);
        phosphor += vec3(0.12, 0.35, 0.15) * circuit * (0.5 + voltage + u_bass * 0.6);
        phosphor += vec3(0.2, 0.6, 0.35) * via * (0.3 + u_mid * 0.6);

        vec3 glitch = vec3(
          trace(scanUv + vec2(rShift, 0.0), vec2(-0.9, 0.0), vec2(0.9, 0.0), 0.03),
          circuit,
          trace(scanUv - vec2(bShift, 0.0), vec2(-0.8, 0.2), vec2(0.8, -0.2), 0.03)
        );
        glitch *= 0.15 + u_mid * 1.1 + bendMode * 0.5;

        vec3 col = phosphor;
        col += glitch * (0.3 + chatter * 0.8 + u_treble * 0.4);
        col += vec3(1.0, 0.85, 0.45) * sparkPath;
        col += vec3(1.0, 0.6, 0.25) * shortBurst;
        col *= scanline;
        col += vec3(0.08, 0.12, 0.2) * u_rms;

        col = mix(col, col.gbr * vec3(1.2, 0.85, 1.1), bendMode * (0.2 + chatter * 0.25));
        col = 1.0 - exp(-col * (1.3 + u_bass * 0.4 + u_rms * 0.5));

        float vignette = 1.0 - smoothstep(0.75, 1.4, length(uv * vec2(0.95, 1.04)));
        col *= vignette;

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
window.VJamFX.presets['circuit-bend'] = CircuitBendPreset;
})();
