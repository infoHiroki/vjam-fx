(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Vinyl Waveform — Merged from vinyl-waveform + vinyl-groove-gpu (#93).
 * Rotating vinyl record with detailed groove waveform modulation,
 * realistic reflections, label, needle drop, and scratch effects.
 */
class VinylWaveformPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
  }

  setup(container) {
    this.destroy();
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
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

        preset._time += 0.013 + preset.audio.mid * 0.012 + preset.audio.treble * 0.004;
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
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(117.2, 53.9))) * 43758.5453);
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
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

        // Spinning record
        float spin = t * (0.7 + u_mid * 2.5) + u_mid * 2.0;
        mat2 rmat = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
        vec2 puv = rmat * uv;
        float r = length(puv);
        float a = atan(puv.y, puv.x);
        float beatGate = smoothstep(0.15, 0.8, u_beat);

        // Disc edge
        float disc = smoothstep(0.99, 0.08, r);
        float outerRim = smoothstep(0.98, 0.88, r) - smoothstep(0.88, 0.80, r);

        // Groove density and waveform modulation (from vinyl-waveform)
        float grooveFreq = 210.0 + u_treble * 400.0 + beatGate * 80.0;
        float wave = sin(r * grooveFreq - t * (3.5 + u_mid * 6.0));
        // Angular waveform detail (from vinyl-waveform)
        wave += sin(a * (20.0 + u_treble * 75.0) + t * (6.0 + u_treble * 8.0)) * (0.25 + u_treble * 0.35);
        // Secondary harmonic (from vinyl-groove-gpu)
        wave += 0.35 * sin(r * grooveFreq * 0.35 + a * 18.0 + t * (6.0 + u_treble * 14.0));
        // Noise texture in grooves
        wave += noise(vec2(a * 15.0, r * 160.0 - t * 0.8)) * (0.2 + u_rms * 0.25);

        // V-cut groove profile
        float grooveDepth = 0.012 + u_bass * 0.09 + u_bass * u_bass * 0.05;
        float vCut = abs(fract(r * grooveFreq + wave * grooveDepth) - 0.5);
        float groove = smoothstep(0.23 - grooveDepth, 0.01, vCut);

        // High-frequency detail shimmer
        float hfPattern = sin(a * (28.0 + u_treble * 100.0) + r * 115.0 - t * (10.0 + u_treble * 14.0));
        hfPattern *= 0.5 + u_treble * 0.9;

        // Scratches (from vinyl-groove-gpu)
        float scratch = smoothstep(0.92, 0.995, noise(vec2(a * 12.0, r * 220.0 + t * 0.2)));

        // Label area
        float label = smoothstep(0.21 + beatGate * 0.03, 0.0, r);
        float spindle = smoothstep(0.02 + u_bass * 0.01, 0.0, r);

        // Reflections — dual specular highlights (both presets' approach combined)
        float specA = pow(max(cos(a - t * (0.45 + u_mid * 0.55)), 0.0), 16.0 - u_rms * 7.0);
        float specB = pow(max(cos(a + r * 4.5 + t * (0.3 + u_mid * 0.4)), 0.0), 32.0);

        // Needle arm and scratch effects (from vinyl-waveform)
        float needleArc = exp(-abs(a - (1.0 + beatGate * 1.8)) * (7.0 - beatGate * 3.0));
        float scratchRing = exp(-abs(r - (0.24 + beatGate * 0.38)) * (40.0 - beatGate * 12.0)) * beatGate;
        float scratchLine = smoothstep(0.03 + beatGate * 0.04, 0.0, abs(a - (1.3 - beatGate * 0.5))) * smoothstep(0.75, 0.18, r);

        // Needle drop impact (from vinyl-groove-gpu)
        float needleDrop = smoothstep(0.1, 0.75, u_beat);
        float impactRing = exp(-abs(r - (0.28 + u_beat * 0.35)) * (45.0 - u_beat * 12.0)) * needleDrop;

        // === Compose colors ===

        // Base vinyl surface
        vec3 col = vec3(0.013, 0.013, 0.018);

        // Groove pattern
        vec3 grooveCol = vec3(0.05, 0.06, 0.07) + vec3(0.12, 0.13, 0.14) * groove;
        grooveCol += vec3(0.1, 0.08, 0.06) * abs(hfPattern) * u_treble * 0.4;
        grooveCol += vec3(0.16, 0.14, 0.12) * scratch * u_rms;
        col = mix(col, grooveCol, groove * disc);

        // Rim
        col += vec3(0.03, 0.035, 0.04) * outerRim * (0.4 + u_rms * 0.6);

        // Reflections
        col += vec3(0.85, 0.9, 0.98) * specA * (0.09 + u_rms * 0.7) * disc;
        col += vec3(1.0, 0.75, 0.4) * specB * (0.05 + u_rms * 0.55) * disc;
        col += vec3(0.3, 0.45, 0.85) * groove * hfPattern * 0.05 * disc;

        // Label
        vec3 labelCol = mix(vec3(0.35, 0.05, 0.08), vec3(0.85, 0.22, 0.13), u_rms);
        labelCol += vec3(0.2, 0.12, 0.04) * u_bass;
        labelCol += vec3(0.3, 0.1, 0.03) * beatGate;
        col = mix(col, labelCol, label);
        col += vec3(0.9, 0.95, 1.0) * spindle;

        // Scratch / needle effects
        col += vec3(1.0, 0.85, 0.6) * scratchRing * (0.1 + u_beat * 0.9 + u_rms * 0.2);
        col += vec3(1.0, 0.85, 0.6) * impactRing * (0.3 + u_beat * 0.8);
        col += vec3(0.95, 0.95, 1.0) * scratchLine * (0.06 + u_beat * 0.6);
        col += vec3(0.9, 0.9, 0.95) * needleArc * beatGate * smoothstep(0.76, 0.2, r) * 0.35;

        col *= disc;
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

  onBeat(strength) {
    this.beatPulse = Math.min(1, strength);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['vinyl-waveform'] = VinylWaveformPreset;
})();
