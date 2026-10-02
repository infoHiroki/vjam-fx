(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MoireGpuPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._time = 0;
  }

  setup(container) {
    this.destroy();
    const preset = this;
    this.p5 = new p5((p) => {
      p.setup = () => {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        p.createCanvas(w, h, p.WEBGL);
        p.pixelDensity(1);
      };

      p.draw = () => {
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }
        preset._time += 0.015 + preset.audio.bass * 0.02;
        preset.beatPulse *= 0.92;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          p.noStroke();
          p.quad(-1, -1, 1, -1, 1, 1, -1, 1);
        } catch (e) {
          // noop
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
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      // Cosine palette
      vec3 palette(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.00, 0.10, 0.20);
        return a + b * cos(6.28318 * (c * t + d));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Ring frequency — bass widens/narrows spacing
        float freq = 30.0 + u_bass * 20.0;

        // Center offset — mid pushes centers further apart
        float spread = 0.3 + u_mid * 0.25;

        // Beat shifts centers for visual pop
        float beatShift = u_beat * 0.15;

        // Pattern 1: orbit upper-left
        vec2 c1 = vec2(
          cos(u_time * 0.7) * spread + beatShift,
          sin(u_time * 0.5) * spread
        );
        float d1 = length(uv - c1);
        float ring1 = sin(d1 * freq);

        // Pattern 2: orbit lower-right
        vec2 c2 = vec2(
          sin(u_time * 0.6) * spread,
          cos(u_time * 0.8) * spread - beatShift
        );
        float d2 = length(uv - c2);
        float ring2 = sin(d2 * freq * 1.05);

        // Pattern 3: orbit center-top
        vec2 c3 = vec2(
          sin(u_time * 0.4 + 2.0) * spread * 0.8 - beatShift,
          cos(u_time * 0.9 + 1.0) * spread * 0.6
        );
        float d3 = length(uv - c3);
        float ring3 = sin(d3 * freq * 0.95);

        // Pattern 4: slow wide orbit
        vec2 c4 = vec2(
          cos(u_time * 0.3 + 4.0) * spread * 1.2,
          sin(u_time * 0.35 + 3.0) * spread * 1.0 + beatShift
        );
        float d4 = length(uv - c4);
        float ring4 = sin(d4 * freq * 1.1);

        // Combine ring patterns — interference via multiplication/addition
        float moire = (ring1 + ring2 + ring3 + ring4) * 0.25;

        // Treble: fine grid overlay for additional interference
        float gridFreq = 60.0 + u_treble * 40.0;
        float grid = sin(uv.x * gridFreq) * sin(uv.y * gridFreq);
        moire = moire * 0.8 + grid * 0.2 * u_treble;

        // High contrast: sharpen the interference
        float sharp = smoothstep(-0.1, 0.1, moire);

        // Map through cosine palette for color
        float colorIdx = moire * 0.5 + 0.5 + u_time * 0.05;
        vec3 col = palette(colorIdx);

        // Mix between black/white base and color tinting
        float bw = sharp;
        col = mix(vec3(bw), col * bw, 0.6 + u_mid * 0.3);

        // Boost brightness on beat
        col += vec3(1.0) * u_beat * 0.3 * sharp;

        // Overall brightness with bass
        col *= 1.0 + u_bass * 0.2;

        gl_FragColor = vec4(col, 1.0);
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
    this.audio.strength = audioData.strength || 0;
  }

  onBeat(strength) {
    this.beatPulse = strength;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['moire-gpu'] = MoireGpuPreset;
})();
