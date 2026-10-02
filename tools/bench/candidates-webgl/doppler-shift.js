(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DopplerShiftPreset extends BasePreset {
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

        preset._time += 0.008 + preset.audio.mid * 0.004 + preset.audio.treble * 0.005;
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

      vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        rgb = rgb * rgb * (3.0 - 2.0 * rgb);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      vec3 spectralColor(float shift) {
        float t = clamp(shift * 0.5 + 0.5, 0.0, 1.0);
        float hueBase = fract(u_time * 0.06 + u_treble * 0.4 + shift * 0.18);
        vec3 cool = hsv2rgb(vec3(fract(hueBase - 0.12), 0.72, 1.0));
        vec3 warm = hsv2rgb(vec3(fract(hueBase + 0.1), 0.85, 1.0));
        vec3 c = mix(cool, warm, smoothstep(0.15, 0.85, t));
        c += vec3(0.08, 0.05, 0.02) * u_bass;
        c += vec3(0.05, 0.08, 0.12) * u_rms;
        return c;
      }
      vec3 audioReactiveFinalize(vec3 inCol, vec2 uv, float hue, vec2 reactCenter, float reactScatter, float reactPulse) {
        vec3 hueCycle = 0.5 + 0.5 * cos(6.2831853 * (hue + vec3(0.0, 0.33, 0.67)));
        vec3 baseGlow = hueCycle * (0.16 + 0.14 * reactScatter);
        baseGlow += hueCycle * reactPulse * (0.18 + u_rms * 0.4 + u_beat * 0.25);
        baseGlow += vec3(0.06, 0.07, 0.09) * (0.6 + reactScatter * 0.8);
        baseGlow *= 0.75 + 0.25 * exp(-length(uv - reactCenter) * 2.8);
        inCol = mix(inCol, inCol * hueCycle, 0.2 + 0.15 * reactScatter);
        inCol += baseGlow;
        return max(inCol, vec3(0.03));
      }
void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float audioHue = u_time * 0.06 + u_treble * 0.4;
        vec2 audioDrift = vec2(fract(u_time * 0.1) * 3.0, fract(u_time * 0.08) * 3.0);
        uv += (audioDrift - 1.5) * 0.12;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactTravel = vec2(
          fract(u_time * (0.045 + 0.015 * u_mid) + noise(vec2(u_bass * 4.0, 1.7))),
          fract(u_time * (0.072 + 0.02 * u_treble) + noise(vec2(u_mid * 3.0, 5.2)))
        );
        vec2 reactCenter = (reactTravel * 2.0 - 1.0) * vec2(0.52, 0.34);
        reactCenter += (vec2(noise(reactSeed + 7.1), noise(reactSeed.yx + 12.4)) - 0.5) * (0.18 + 0.16 * u_rms);
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));

        float c = 0.7 + 0.9 * u_mid + 0.18 * sin(u_time * 0.6 + u_mid * 5.0);
        float sourceSpeed = (0.22 + 1.25 * u_treble + 0.35 * u_beat) * c * 0.65;
        float laneProgress = fract(u_time * (0.08 + 0.12 * u_mid + 0.06 * u_treble));
        float trailWrap = fract(laneProgress + 0.08);
        float pathAmp = 0.24 + 0.2 * u_bass + 0.08 * u_beat;
        float laneNoise = noise(vec2(laneProgress * 4.0 + u_treble * 2.0, 2.3 + u_mid * 3.0));
        float aheadNoise = noise(vec2(trailWrap * 4.0 + u_treble * 2.0, 2.3 + u_mid * 3.0));
        vec2 source = vec2(
          mix(-1.25, 1.25, laneProgress),
          (laneNoise * 2.0 - 1.0) * pathAmp + (u_beat - 0.5) * 0.12
        );
        vec2 aheadSource = vec2(
          mix(-1.25, 1.25, trailWrap),
          (aheadNoise * 2.0 - 1.0) * pathAmp + (u_beat - 0.5) * 0.12
        );
        vec2 velocity = normalize(aheadSource - source + vec2(1e-4, 0.0)) * sourceSpeed;

        vec2 d = uv - source;
        float r = length(d) + 1e-4;
        vec2 n = d / r;
        float radialVel = dot(velocity, n);
        float doppler = c / max(c - radialVel, 0.08);

        float baseFreq = 8.0 + 16.0 * u_mid + 5.0 * u_treble;
        float observedFreq = baseFreq * doppler;
        float phase = r * observedFreq - u_time * (2.0 + 6.0 * u_mid + 4.0 * u_treble);
        phase += 0.6 * sin(r * (10.0 + 12.0 * u_rms) - u_time * (1.5 + u_bass));
        phase += 0.7 * u_beat * sin(atan(d.y, d.x) * 6.0 + u_time * 4.0);

        float wave = 0.5 + 0.5 * cos(phase);
        float envelope = exp(-r * (1.1 - 0.45 * u_bass + 0.1 * u_rms));
        float shock = exp(-pow(r * observedFreq - mod(u_time * (2.2 + u_mid), 6.28318), 2.0) * (0.4 + 0.2 * u_bass));
        float medium = 0.2 + 0.25 * sin((uv.x + uv.y) * (6.0 + 8.0 * u_rms) + u_time * (0.7 + u_rms));
        medium += 0.18 * cos((uv.x - uv.y) * (10.0 + 14.0 * u_rms) - u_time * (1.0 + u_mid));

        float shift = clamp((doppler - 1.0) * 1.7, -1.0, 1.0);
        float machCone = smoothstep(
          0.06 + 0.03 * u_rms,
          0.0,
          abs(dot(normalize(velocity + vec2(1e-4)), n) - (1.0 - min(sourceSpeed / max(c, 0.1), 1.0)))
        ) * u_beat;
        vec3 col = spectralColor(shift);
        col *= wave * envelope * (0.55 + 0.7 * u_bass);
        col += spectralColor(shift * 0.6) * shock * (0.22 + 0.48 * u_beat);
        col += mix(vec3(0.2, 0.55, 1.0), vec3(1.0, 0.35, 0.12), step(0.0, shift)) * machCone;
        col += hsv2rgb(vec3(fract(audioHue + 0.08), 0.35, 0.24)) * medium * (0.7 + 0.8 * u_rms);
        col += vec3(0.9, 0.95, 1.0) * exp(-r * 12.0) * (0.25 + 0.5 * u_bass + 0.25 * u_beat);
        col += hsv2rgb(vec3(fract(audioHue + 0.16), 0.45, 0.32)) * pow(abs(radialVel) / max(c, 0.1), 1.3) * (0.25 + 0.35 * u_treble);
        col += vec3(0.12, 0.06, 0.02) * sin(phase * 0.5 + u_time * 2.0) * (0.08 + 0.12 * u_mid);

        float vignette = 1.0 - dot(uv, uv) * (0.48 + 0.16 * u_rms);
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
window.VJamFX.presets['doppler-shift'] = DopplerShiftPreset;
})();
