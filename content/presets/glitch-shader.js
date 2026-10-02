(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GlitchShaderPreset extends BasePreset {
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
        preset._time += 0.03 + preset.audio.bass * 0.05;
        preset.beatPulse *= 0.85;

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
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      float hash(float n) {
        return fract(sin(n) * 43758.5453);
      }

      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash2(i);
        float b = hash2(i + vec2(1.0, 0.0));
        float c = hash2(i + vec2(0.0, 1.0));
        float d = hash2(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec2 uv = vUv;
        float t = u_time;
        float glitchAmount = u_bass * 0.5 + u_beat * 1.5;

        // Block glitch: quantize Y into strips, offset X per strip
        float blockSize = 0.03 + u_treble * 0.05;
        float blockY = floor(uv.y / blockSize) * blockSize;
        float blockRand = hash(blockY * 100.0 + floor(t * 8.0));

        // Only glitch some blocks (probability increases with audio)
        float glitchProb = 0.1 + glitchAmount * 0.4;
        vec2 glitchUv = uv;
        if (blockRand < glitchProb) {
          float offset = (hash(blockY * 200.0 + floor(t * 12.0)) - 0.5) * glitchAmount * 0.3;
          glitchUv.x += offset;
        }

        // RGB channel separation
        float chromaShift = (0.005 + u_bass * 0.02 + u_beat * 0.04);

        // Underlying pattern: diagonal scan bars + noise field
        vec2 p = glitchUv;

        // Scanlines
        float scanline = sin(p.y * u_resolution.y * 1.5) * 0.5 + 0.5;
        scanline = pow(scanline, 0.5);

        // Base pattern: geometric + noise
        float n1 = noise(p * 8.0 + t * 0.5);
        float n2 = noise(p * 16.0 - t * 0.3);
        float n3 = noise(p * 32.0 + t * 0.8);

        // Data bars
        float barY = floor(p.y * 30.0 + t * 2.0);
        float bar = step(0.7, hash(barY + floor(t * 4.0)));
        float barX = step(hash(barY * 3.0 + floor(t * 6.0)), p.x);

        // Diagonal interference
        float diag = sin((p.x + p.y) * 50.0 + t * 10.0) * 0.5 + 0.5;
        diag *= sin((p.x - p.y) * 30.0 - t * 5.0) * 0.5 + 0.5;

        // Combine base pattern
        float pattern = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
        pattern = mix(pattern, bar * barX, 0.3 + u_mid * 0.3);
        pattern = mix(pattern, diag, 0.2 * u_treble);

        // RGB channels with offset
        float r = noise((glitchUv + vec2(chromaShift, 0.0)) * 8.0 + t * 0.5) * 0.5
            + noise((glitchUv + vec2(chromaShift, 0.0)) * 16.0 - t * 0.3) * 0.3;
        float g = pattern;
        float b = noise((glitchUv - vec2(chromaShift, 0.0)) * 8.0 + t * 0.5) * 0.5
            + noise((glitchUv - vec2(chromaShift, 0.0)) * 16.0 - t * 0.3) * 0.3;

        // Add bar contribution to all channels differently
        r += bar * barX * 0.4;
        b += bar * (1.0 - barX) * 0.3;

        vec3 col = vec3(r, g, b);

        // Scanline overlay
        col *= 0.8 + scanline * 0.2;

        // Random white noise flashes
        float whiteNoise = hash2(uv * u_resolution + vec2(floor(t * 30.0)));
        col += whiteNoise * u_beat * 0.3;

        // Color tint cycling
        vec3 tint = 0.5 + 0.5 * cos(t * 0.3 + vec3(0.0, 2.0, 4.0));
        col *= mix(vec3(1.0), tint, 0.3);

        // Brightness
        col *= 1.0 + u_bass * 0.5;

        // Beat: full white flash in glitched blocks
        if (blockRand < glitchProb * 0.3) {
          col = mix(col, vec3(1.0), u_beat * 0.7);
        }

        // Vignette
        vec2 vig = vUv * 2.0 - 1.0;
        col *= 1.0 - dot(vig, vig) * 0.2;

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
window.VJamFX.presets['glitch-shader'] = GlitchShaderPreset;
})();
