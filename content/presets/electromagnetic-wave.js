(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ElectromagneticWavePreset extends BasePreset {
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

        preset._time += 0.012 + preset.audio.treble * 0.008 + preset.audio.mid * 0.006;
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
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      mat2 rot(float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c);
      }

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(118.2, 326.1))) * 43758.5453);
      }

      float fieldLine(vec2 uv, vec2 start, vec2 dir, float width) {
        vec2 pa = uv - start;
        float proj = clamp(dot(pa, dir), 0.0, 2.0);
        vec2 closest = start + dir * proj;
        return exp(-length(uv - closest) * width);
      }

      vec3 phaseColor(float ph) {
        return 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + ph + vec3(u_rms * 2.0, u_rms * 3.0, u_rms * 4.0));
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
        float t = u_time;
        float beatGate = smoothstep(0.18, 0.8, u_beat);

        float amp = 0.12 + u_bass * 0.48 + u_bass * u_bass * 0.18 + beatGate * 0.12;
        float freq = 6.0 + u_treble * 18.0 + u_treble * 12.0 * beatGate;
        float polar = u_mid * 3.14159265 + sin(t * 0.25) * 0.25;
        vec2 prop = normalize(vec2(1.0, 0.15 * sin(t * 0.2 + u_mid * 2.0)));
        vec2 eAxis = rot(polar) * vec2(0.0, 1.0);
        vec2 bAxis = vec2(-eAxis.y, eAxis.x);

        float carrier = uv.x * freq - t * (3.0 + u_treble * 10.0);
        float packet = exp(-pow(uv.x + 0.4 - fract(t * (0.08 + beatGate * 0.12)) * 1.4, 2.0) * (9.0 - beatGate * 4.0));
        packet += exp(-pow(uv.x - 0.2 + sin(t * 0.3) * 0.2, 2.0) * 11.0) * beatGate;
        packet += exp(-pow(uv.y, 2.0) * 26.0) * u_beat * 0.18;
        float wave = sin(carrier) * amp;
        float eWave = dot(uv, eAxis) - wave * (0.65 + packet * (1.0 + u_bass * 0.8));
        float bWave = dot(uv, bAxis) - wave * (0.38 + packet * (0.7 + u_bass * 0.55));

        float eField = smoothstep(0.03 + u_rms * 0.02, 0.0, abs(eWave));
        float bField = smoothstep(0.03 + u_rms * 0.02, 0.0, abs(bWave));

        vec3 col = vec3(0.01, 0.015, 0.03);
        col += vec3(0.02, 0.04, 0.08) * (0.3 + u_rms * 0.7) * exp(-length(uv) * 1.8);

        float vectors = 0.0;
        for (int i = -5; i <= 5; i++) {
          float fi = float(i) / 5.0;
          vec2 origin = vec2(fi * 0.16, 0.0);
          float phase = sin(fi * 3.0 + carrier);
          vec2 eTip = origin + eAxis * phase * amp * (0.5 + packet * 0.6);
          vec2 bTip = origin + bAxis * phase * amp * (0.32 + packet * 0.45);
          vectors += fieldLine(uv, origin, normalize(eTip - origin + 0.0001), 45.0) * smoothstep(0.02, 0.0, length(uv - eTip));
          vectors += fieldLine(uv, origin, normalize(bTip - origin + 0.0001), 45.0) * smoothstep(0.02, 0.0, length(uv - bTip));
        }

        float radiation = 0.0;
        for (int i = 0; i < 4; i++) {
          float fi = float(i) / 3.0;
          float center = -0.7 + fi * 0.5 + beatGate * 0.15;
          float shell = exp(-abs(length(uv - vec2(center, 0.0)) - (0.18 + beatGate * 0.45 + fi * 0.08)) * (18.0 - beatGate * 7.0));
          radiation += shell;
        }

        vec3 eCol = phaseColor(carrier + u_rms * 3.0) * vec3(0.5, 0.85, 1.0);
        vec3 bCol = phaseColor(carrier + 1.57 + u_rms * 2.0) * vec3(1.0, 0.45, 0.32);
        col += eCol * eField * (0.5 + u_bass * 0.8 + packet * 0.9);
        col += bCol * bField * (0.45 + u_bass * 0.45 + packet * 0.7);
        col += mix(eCol, bCol, 0.5) * radiation * beatGate * (0.05 + u_beat * 0.7 + u_treble * 0.2);
        col += vec3(0.9, 0.95, 1.0) * vectors * (0.03 + u_mid * 0.1 + u_rms * 0.08);

        float grid = abs(fract((uv.y + dot(uv, prop) * 0.2) * (10.0 + u_treble * 8.0)) - 0.5);
        col += vec3(0.05, 0.07, 0.12) * smoothstep(0.48, 0.42, grid) * (0.2 + u_rms * 0.4);

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
window.VJamFX.presets['electromagnetic-wave'] = ElectromagneticWavePreset;
})();
