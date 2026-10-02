(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class QuantumTunnelPreset extends BasePreset {
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

        preset._time += 0.009 + preset.audio.treble * 0.005 + preset.audio.mid * 0.003;
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
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}

      vec3 palette(float t) {
        vec3 a = vec3(0.2, 0.2, 0.22);
        vec3 b = vec3(0.42, 0.4, 0.4) + vec3(0.05, 0.08, 0.12) * u_rms;
        vec3 c = vec3(1.0, 1.0, 1.0) + vec3(0.08, 0.12, 0.16) * u_rms;
        vec3 d = vec3(t + u_time * 0.06 + u_treble * 0.4, t + 0.33 + u_mid * 0.14, t + 0.67 + u_bass * 0.16);
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float audioHue = u_time * 0.06 + u_treble * 0.4;
        vec2 audioDrift = vec2(sin(u_time * 0.3) * 1.5 + 1.5, sin(u_time * 0.23) * 1.5 + 1.5);
        // No UV drift - keep center fixed
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactFlow = fract(vec2(
          u_time * (0.06 + u_treble * 0.03) + reactScatter * 0.72,
          u_time * (0.044 + u_mid * 0.025) + noise(reactSeed.yx + 4.0) * 0.88
        ));
        vec2 reactCenter = (reactFlow - 0.5) * (0.74 + 0.2 * u_rms) + (reactScatter - 0.5) * 0.16;
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float x = uv.x * 3.1;
        float y = uv.y * 2.8;
        vec3 hueCycleV = 0.5 + 0.5 * cos(6.2831853 * (audioHue + vec3(0.0, 0.33, 0.67)));

        // Breathing bar width: oscillates with sin(u_time) and responds to bass
        float breathe = 0.7 + 0.3 * sin(u_time * 0.8);
        float bassBreath = 1.0 + u_bass * 0.6 + u_beat * 0.4;
        float sigmaBase = 0.24 + 0.12 * u_mid + 0.06 * u_rms;
        float sigma = sigmaBase * breathe * bassBreath;
        float k = 7.0 + 20.0 * u_treble + 5.0 * u_rms;
        float omega = 1.4 + 0.7 * u_treble + 0.5 * u_mid;
        float beatSplit = (fract(u_time * (0.11 + u_bass * 0.05) + u_beat * 0.4) - 0.5) * 0.28;
        float barrierHalf = (0.24 + 0.12 * fract(u_time * (0.075 + u_mid * 0.035) + u_beat * 0.18)) * breathe * bassBreath;
        float barrierHeight = 2.4 + 5.5 * u_bass + 1.8 * u_beat + 0.9 * u_rms;
        float E = 1.5 + 2.2 * u_mid + 0.4 * u_treble;
        float x0 = -1.55 + fract(u_time * (0.19 + u_mid * 0.08)) * 0.55 - 0.25 * u_beat;
        float groupVelocity = 0.8 + 0.55 * u_mid + 0.18 * u_treble;
        float travel = fract(u_time * groupVelocity * 0.22);
        float xc = x0 + travel * 3.6;

        float barrierMaskA = smoothstep(barrierHalf + 0.05, barrierHalf - 0.05, abs(x - beatSplit));
        float barrierMaskB = smoothstep(barrierHalf + 0.05, barrierHalf - 0.05, abs(x + beatSplit));
        float barrierMask = max(barrierMaskA, barrierMaskB);
        float kappa = sqrt(max(barrierHeight - E, 0.05));
        float tunnel = exp(-2.0 * kappa * (barrierHalf * 2.0)) * (0.45 + 0.55 * u_mid);
        tunnel += 0.18 * u_beat + 0.08 * u_rms;

        float gaussian = exp(-pow((x - xc) / sigma, 2.0) - y * y * (1.6 + u_rms));
        float incidentRe = gaussian * cos(k * (x - xc) - omega * u_time);
        float incidentIm = gaussian * sin(k * (x - xc) - omega * u_time);

        float reflectedAmp = barrierMask * (0.45 + 0.35 * u_bass - 0.2 * u_mid);
        reflectedAmp += barrierMask * 0.2 * sin(u_time * 0.8 + u_beat * 8.0);
        float reflectedRe = reflectedAmp * gaussian * cos(-k * (x + xc + barrierHalf) - omega * u_time + 0.4 * u_bass);
        float reflectedIm = reflectedAmp * gaussian * sin(-k * (x + xc + barrierHalf) - omega * u_time + 0.4 * u_bass);

        float transmittedEnv = exp(-pow((x - barrierHalf - tunnel * 0.9 - 0.7 * u_beat) / (sigma * (1.0 + 0.4 * u_mid)), 2.0) - y * y * (1.3 + 0.8 * u_rms));
        float transmittedRe = tunnel * transmittedEnv * cos(k * (x - barrierHalf) - omega * u_time + 0.5 * u_mid + u_beat * 2.0);
        float transmittedIm = tunnel * transmittedEnv * sin(k * (x - barrierHalf) - omega * u_time + 0.5 * u_mid + u_beat * 2.0);

        float evanescentEnv = exp(-kappa * max(abs(x) - barrierHalf, 0.0) * (1.0 + 0.3 * u_bass));
        float barrierPhase = cos(u_time * (0.8 + 0.5 * u_treble) + y * (6.0 + 10.0 * u_treble));
        float barrierRe = barrierMask * evanescentEnv * barrierPhase * (0.35 + 0.2 * u_mid + 0.25 * u_beat);
        float barrierIm = barrierMask * evanescentEnv * sin(u_time * (0.8 + 0.5 * u_treble) + y * (6.0 + 10.0 * u_treble)) * (0.35 + 0.2 * u_mid + 0.25 * u_beat);
        float collision = exp(-pow(x - beatSplit * 1.5, 2.0) / (sigma * sigma * (1.2 + u_beat)) - y * y * (5.0 + 10.0 * u_beat));
        collision *= 0.4 + 1.2 * u_beat;

        float re = incidentRe + reflectedRe + transmittedRe + barrierRe;
        float im = incidentIm + reflectedIm + transmittedIm + barrierIm;
        float density = re * re + im * im;

        float phase = atan(im, re);
        float current = re * (k * incidentIm) - im * (k * incidentRe);
        float phaseGrid = 0.5 + 0.5 * cos(phase * (2.0 + 1.5 * u_rms) + y * (8.0 + 8.0 * u_rms));

        vec3 col = palette(0.18 + density * (0.8 + u_treble) + travel);
        col = mix(col, palette(phase / 6.28318 + travel + 0.35), 0.4 + 0.35 * u_rms);
        col += hueCycleV.yzx * phaseGrid * (0.15 + 0.22 * u_rms);
        col += hueCycleV.zxy * barrierMask * (0.22 + 0.5 * u_bass + 0.35 * u_beat);
        col += (hueCycleV + vec3(0.22)) * smoothstep(0.2, 1.6, density) * (0.15 + 0.18 * u_treble);
        col += hueCycleV.yzx * transmittedEnv * (0.15 + 0.45 * u_mid);
        col += hueCycleV.zxy * collision * 1.1;
        col += hueCycleV * abs(current) * (0.08 + 0.14 * u_rms);
        col += hueCycleV.yzx * barrierMask * sin(y * (14.0 + u_treble * 18.0) + u_time * 3.0) * (0.08 + 0.12 * u_bass);

        float vignette = 1.0 - dot(uv, uv) * (0.46 + 0.14 * u_rms);
        col *= max(vignette, 0.0);
        col = max(col, vec3(0.03));
        gl_FragColor = vec4(audioReactiveFinalize(clamp(col, 0.0, 1.0), uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
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
window.VJamFX.presets['quantum-tunnel'] = QuantumTunnelPreset;
})();
