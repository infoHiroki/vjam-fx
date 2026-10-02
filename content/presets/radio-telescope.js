(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Radio Telescope
 * Sky scan with pulsar traces, spectral hydrogen line bands, and beat-triggered FRB bursts.
 */
class RadioTelescopePreset extends BasePreset {
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

        preset.beatPulse *= 0.87;
        preset._time += 0.012 + preset.audio.mid * 0.006 + preset.audio.treble * 0.003;

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
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p *= 2.02;
          a *= 0.5;
        }
        return v;
      }

      vec3 spectralColor(float t) {
        vec3 a = vec3(0.08, 0.22, 0.28);
        vec3 b = vec3(0.1, 0.75, 0.68);
        vec3 c = vec3(0.8, 0.95, 0.45);
        vec3 d = vec3(0.98, 0.38, 0.12);
        t = clamp(t, 0.0, 1.0);
        return mix(mix(a, b, smoothstep(0.0, 0.35, t)), mix(c, d, smoothstep(0.45, 1.0, t)), smoothstep(0.3, 0.8, t));
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
        vec2 uv = gl_FragCoord.xy / u_resolution;
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
        vec2 suv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);

        float sweep = u_time * (0.16 + u_mid * 0.95) + u_mid * 2.4;
        vec2 scanUv = uv;
        scanUv.x += 0.02 * sin(uv.y * (12.0 + u_treble * 20.0) + sweep);
        scanUv.y += 0.01 * sin(uv.x * (7.0 + u_treble * 14.0) - sweep * 0.7);

        float spectralBins = 40.0 + u_treble * 170.0 + u_beat * 40.0;
        float bin = floor(scanUv.x * spectralBins) / spectralBins;
        float hydrogen = exp(-abs(bin - (0.61 + 0.03 * sin(u_time * 0.4))) * (160.0 + u_treble * 300.0));
        float continuum = fbm(vec2(bin * (10.0 + u_treble * 8.0), scanUv.y * 6.0 + u_time * 0.12));
        float lineBands = smoothstep(0.35, 0.8, continuum + hydrogen * (0.5 + u_bass * 1.2));

        // 7 pulsar lines with slowly shifting positions
        float pulsar = 0.0;
        for (int i = 0; i < 7; i++) {
          float fi = float(i);
          float phase = u_time * (2.0 + fi * 0.37 + u_bass * 2.5) + fi * 1.7;
          // Positions shift slowly with time
          float y = 0.08 + fi * 0.12 + 0.06 * sin(u_time * (0.15 + fi * 0.07) + fi * 2.3 + u_mid * 2.0);
          float pulse = pow(max(0.0, sin(phase)), 18.0 - u_bass * 8.0);
          float envelope = exp(-abs(scanUv.y - y) * (80.0 - u_rms * 25.0));
          pulsar += pulse * envelope * (0.35 + u_bass * 1.4);
        }

        float frbCenter = fract(0.12 + u_time * (0.03 + u_beat * 0.2));
        float dispersion = abs(scanUv.x - frbCenter) * (16.0 + u_treble * 45.0);
        float frbArc = exp(-abs(scanUv.y - (0.82 - dispersion * 0.28)) * (85.0 - u_rms * 18.0));
        float frb = frbArc * smoothstep(0.12, 0.75, u_beat) * (0.7 + u_beat * 1.8);

        float dish = 0.0;
        vec2 dishUv = suv * vec2(1.1, 1.0);
        float parab = exp(-abs(dishUv.y + 0.56 - dishUv.x * dishUv.x * (2.2 + u_bass * 1.5)) * 95.0);
        float feed = exp(-length(dishUv - vec2(0.0, -0.22)) * (45.0 - u_rms * 12.0));
        dish += parab * (0.2 + u_rms * 0.45) + feed * (0.25 + u_bass * 0.4);

        float noiseFloor = fbm(scanUv * (120.0 + u_treble * 220.0) + u_time * (4.0 + u_treble * 10.0));
        float receiverNoise = (noiseFloor - 0.5) * (0.08 + u_rms * 0.55 + u_beat * 0.1);

        float sweepLine = smoothstep(0.02, 0.0, abs(fract(scanUv.x - sweep * 0.08) - 0.5));
        float grid = smoothstep(0.04, 0.0, abs(fract(scanUv.y * 10.0) - 0.5)) * 0.08;
        grid += smoothstep(0.04, 0.0, abs(fract(scanUv.x * 8.0) - 0.5)) * 0.05;

        vec3 bg = vec3(0.01, 0.02, 0.03);
        bg += vec3(0.01, 0.04, 0.05) * exp(-length(suv) * 2.0);
        vec3 spectrumCol = spectralColor(lineBands + hydrogen * 0.4);
        vec3 col = bg;
        col += spectrumCol * (continuum * 0.3 + lineBands * (0.4 + u_treble * 0.6));
        col += vec3(0.85, 0.95, 1.0) * pulsar;
        col += vec3(0.35, 1.0, 0.85) * sweepLine * (0.3 + u_mid * 0.7);
        col += vec3(1.0, 0.85, 0.45) * hydrogen * (0.3 + u_bass * 0.8);
        col += vec3(1.0, 0.95, 0.9) * frb;
        col += vec3(0.14, 0.22, 0.28) * dish;
        col += vec3(receiverNoise);
        col += vec3(grid);

        float intensity = lineBands * (0.4 + u_bass * 1.0) + pulsar + frb * 1.4;
        col = mix(col, spectralColor(intensity), intensity * 0.18);
        col *= 1.0 - dot(suv, suv) * 0.18;
        col = pow(max(col, 0.0), vec3(0.92));
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
window.VJamFX.presets['radio-telescope'] = RadioTelescopePreset;
})();
