(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SoundWavePropagationPreset extends BasePreset {
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

        preset._time += 0.012 + preset.audio.mid * 0.009 + preset.audio.treble * 0.003;
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

      #define BOUNCES 4

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }

      float wavePulse(vec2 uv, vec2 src, float t0, float speed, float amp, float freq, float decay) {
        float d = length(uv - src);
        float front = speed * t0;
        float shell = abs(d - front);
        float envelope = exp(-shell * (18.0 + freq * 4.0));
        float active = smoothstep(0.0, 0.03, t0 - d / speed);
        return sin(d * (12.0 + freq * 20.0) - t0 * (8.0 + freq * 10.0)) * envelope * active * amp * exp(-t0 * decay);
      }

      vec2 reflectRoom(vec2 p) {
        vec2 room = vec2(1.45, 0.85);
        vec2 q = mod(p + room, room * 2.0) - room;
        return abs(q - room) - room;
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
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

        vec2 sourceA = vec2(sin(t * (0.5 + u_mid * 1.8)) * (0.45 + u_mid * 0.25), cos(t * (0.37 + u_mid * 1.2)) * 0.25);
        vec2 sourceB = vec2(cos(t * (0.71 + u_mid * 1.5) + 1.3) * 0.6, sin(t * (0.58 + u_mid * 1.1)) * 0.35);
        vec2 beatSource = vec2(sin(t * 1.7 + 2.4), cos(t * 1.2 - 1.7)) * (0.12 + u_beat * 0.65);

        float amp = 0.35 + u_bass * 1.3;
        float freq = 0.3 + u_treble * 1.6;
        float decay = mix(1.9, 0.35, u_rms);
        float speed = 0.55 + u_mid * 0.55;

        float wave = 0.0;
        vec2 srcs[3];
        srcs[0] = sourceA;
        srcs[1] = sourceB;
        srcs[2] = beatSource;

        for (int s = 0; s < 3; s++) {
          vec2 src = srcs[s];
          float launch = t + float(s) * 0.8;
          if (s == 2) {
            launch = u_beat * 1.4 + mod(t, 2.4);
          }
          for (int bx = -1; bx <= 1; bx++) {
            for (int by = -1; by <= 1; by++) {
              vec2 roomSrc = src + vec2(float(bx), float(by)) * vec2(2.9, 1.7);
              float bounceAmp = 1.0 / (1.0 + abs(float(bx)) + abs(float(by)));
              wave += wavePulse(uv, roomSrc, launch, speed, amp * bounceAmp, freq, decay);
            }
          }
        }

        vec2 roomDf = reflectRoom(uv);
        float walls = smoothstep(0.05, 0.0, abs(max(roomDf.x, roomDf.y)));
        float pressure = 0.5 + 0.5 * sin(wave * (2.0 + u_bass * 1.8));
        float interference = sin((uv.x + uv.y) * (18.0 + u_treble * 24.0) + wave * 4.0 - t * 3.0) * 0.5 + 0.5;

        vec3 col = mix(vec3(0.03, 0.05, 0.08), vec3(0.08, 0.13, 0.18), u_rms);
        col += vec3(0.1, 0.18, 0.24) * pressure * (0.2 + u_rms * 0.6);
        col += vec3(0.1, 0.4, 0.85) * max(wave, 0.0) * (0.22 + u_bass * 0.5);
        col += vec3(0.85, 0.95, 1.0) * max(wave, 0.0) * interference * (0.08 + u_treble * 0.25);
        col += vec3(1.0, 0.82, 0.55) * max(-wave, 0.0) * 0.16;
        col += vec3(0.45, 0.65, 0.95) * walls * (0.45 + u_treble * 0.7 + u_beat * 0.5);

        float sourceGlow = 0.0;
        sourceGlow += exp(-length(uv - sourceA) * (8.0 - u_bass * 2.0));
        sourceGlow += exp(-length(uv - sourceB) * (8.0 - u_bass * 2.0));
        sourceGlow += exp(-length(uv - beatSource) * (10.0 + u_beat * 14.0)) * (0.2 + u_beat * 1.8);
        col += vec3(0.95, 0.97, 1.0) * sourceGlow * (0.12 + u_bass * 0.25);

        float vignette = 1.0 - smoothstep(1.0, 1.6, length(uv));
        col *= vignette * (0.8 + u_rms * 0.4);
        col = 1.0 - exp(-col * (1.3 + u_bass * 0.4 + u_rms * 0.5));

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
window.VJamFX.presets['sound-wave-propagation'] = SoundWavePropagationPreset;
})();
