(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class VinylGrooveGpuPreset extends BasePreset {
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

        preset._time += 0.015 + preset.audio.mid * 0.012 + preset.audio.treble * 0.004;
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

        float spin = t * (0.8 + u_mid * 2.5) + u_mid * 2.0;
        mat2 rot = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
        vec2 puv = rot * uv;

        float r = length(puv);
        float a = atan(puv.y, puv.x);
        float disc = smoothstep(0.98, 0.12, r);

        float grooveDensity = 220.0 + u_treble * 420.0;
        float waveform = sin(r * grooveDensity - t * (3.0 + u_mid * 5.0));
        waveform += 0.4 * sin(r * grooveDensity * 0.35 + a * 18.0 + t * (6.0 + u_treble * 14.0));
        waveform += 0.25 * noise(vec2(r * 140.0, a * 14.0 + t * 0.8));

        float grooveDepth = 0.012 + u_bass * 0.09 + u_bass * u_bass * 0.04;
        float vCut = abs(fract(r * grooveDensity + waveform * grooveDepth) - 0.5);
        float groove = smoothstep(0.24 - grooveDepth, 0.01, vCut);

        float hfPattern = sin(a * (28.0 + u_treble * 80.0) + r * 120.0 - t * (8.0 + u_treble * 16.0));
        hfPattern *= 0.5 + u_treble * 0.9;
        float scratch = smoothstep(0.92, 0.995, noise(vec2(a * 12.0, r * 220.0 + t * 0.2)));

        float label = smoothstep(0.2 + u_beat * 0.03, 0.0, r);
        float outerRim = smoothstep(0.98, 0.86, r) - smoothstep(0.86, 0.78, r);

        float needleDrop = smoothstep(0.1, 0.75, u_beat);
        float dropArc = exp(-abs(a - (1.0 + u_beat * 1.6)) * (9.0 - u_beat * 4.0));
        float impactRing = exp(-abs(r - (0.28 + u_beat * 0.35)) * (45.0 - u_beat * 12.0)) * needleDrop;

        vec3 baseVinyl = vec3(0.015, 0.015, 0.02);
        baseVinyl += vec3(0.04, 0.045, 0.05) * groove * (0.3 + u_bass * 0.7);
        baseVinyl += vec3(0.03, 0.035, 0.05) * outerRim * (0.4 + u_rms * 0.6);

        vec3 reflection = vec3(0.0);
        float specA = pow(max(cos(a - t * (0.4 + u_mid * 0.6)), 0.0), 18.0 - u_rms * 8.0);
        float specB = pow(max(cos(a + r * 4.0 + t * (0.2 + u_mid * 0.4)), 0.0), 40.0);
        reflection += vec3(0.9, 0.95, 1.0) * specA * (0.1 + u_rms * 0.9);
        reflection += vec3(1.0, 0.75, 0.4) * specB * (0.06 + u_rms * 0.7);
        reflection += vec3(0.35, 0.5, 0.9) * groove * hfPattern * 0.06;

        vec3 grooveCol = vec3(0.06, 0.07, 0.08) + vec3(0.12, 0.13, 0.14) * groove;
        grooveCol += vec3(0.12, 0.1, 0.08) * abs(hfPattern) * u_treble * 0.5;
        grooveCol += vec3(0.18, 0.16, 0.14) * scratch * u_rms;

        vec3 labelCol = mix(vec3(0.35, 0.05, 0.08), vec3(0.82, 0.18, 0.14), u_rms);
        labelCol += vec3(0.6, 0.3, 0.1) * u_beat;

        vec3 col = baseVinyl;
        col = mix(col, grooveCol, groove * disc);
        col += reflection * disc;
        col = mix(col, labelCol, label);

        col += vec3(1.0, 0.85, 0.6) * impactRing * (0.35 + u_beat + u_rms);
        col += vec3(0.95, 0.95, 1.0) * dropArc * needleDrop * smoothstep(0.72, 0.2, r) * 0.5;
        col *= disc;

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
window.VJamFX.presets['vinyl-groove-gpu'] = VinylGrooveGpuPreset;
})();
