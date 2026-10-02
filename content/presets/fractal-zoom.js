(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FractalZoomPreset extends BasePreset {
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
        preset._time += 0.015 + preset.audio.bass * 0.03;
        preset.beatPulse *= 0.9;

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

      vec3 palette(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.0, 0.33, 0.67);
        return a + b * cos(6.28318 * (c * t + d));
      }

      void main() {
        // gl_FragCoord based UV (bypasses p5.js tex coord issues)
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Zoom: slow cycle, gentle bass breathing
        float zoomPhase = u_time * 0.035;
        float zoom = 1.5 + sin(zoomPhase) * 0.4 + u_bass * 0.1;
        uv /= zoom;

        // Julia set c parameter — slow morph, subtle audio influence
        float cAngle = u_time * 0.12 + u_treble * 0.4;
        float cRadius = 0.7885 + sin(u_time * 0.06) * 0.04 + u_bass * 0.015;
        vec2 c = vec2(cos(cAngle), sin(cAngle)) * cRadius;

        // Mostly Julia (fills screen with color), occasionally Mandelbrot boundary
        float mode = smoothstep(0.85, 0.95, fract(u_time * 0.03));
        vec2 z = uv;

        // Mandelbrot mode: zoom into boundary, not the whole set
        vec2 mCenter = vec2(-0.745 + sin(u_time * 0.05) * 0.01, 0.186);
        vec2 mUv = uv * 0.3 + mCenter; // tighter zoom on boundary
        vec2 mc = mix(c, mUv, mode); // Julia: c=c, Mandelbrot: c=mUv
        z = mix(uv, mUv, mode);       // Julia: z=uv, Mandelbrot: z=mUv

        float iter = 0.0;
        const float MAX_ITER = 80.0;
        for (float i = 0.0; i < MAX_ITER; i++) {
          z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + mc;
          if (dot(z, z) > 4.0) break;
          iter = i;
        }

        // Smooth iteration count
        float sl = iter - log2(log2(dot(z, z))) + 4.0;
        float t = sl / MAX_ITER;

        // Color: palette cycling (darker base, preserves boundary contrast)
        vec3 col = palette(t + u_time * 0.08 + u_mid * 0.15);
        // Darken interior (trapped points)
        col *= smoothstep(MAX_ITER - 1.0, MAX_ITER - 5.0, iter);
        // Emphasize boundary: boost contrast in mid-iteration range
        float boundaryGlow = smoothstep(0.0, 0.3, t) * smoothstep(0.8, 0.3, t);
        col *= 0.6 + boundaryGlow * 0.5;

        // Beat: brief color intensity pulse (no white-out)
        col *= 1.0 + u_beat * 0.25;

        // Bass: very subtle overall brightness
        col *= 0.9 + u_bass * 0.1;

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
window.VJamFX.presets['fractal-zoom'] = FractalZoomPreset;
})();
