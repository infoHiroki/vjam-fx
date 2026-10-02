(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MandelbrotZoomPreset extends BasePreset {
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
        p.createCanvas(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight, p.WEBGL);
        p.pixelDensity(1);
      };
      p.draw = () => {
        if (!preset._shader) { preset._shader = preset._initShader(p); if (!preset._shader) return; }
        preset._time += 0.025 + preset.audio.bass * 0.04;
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
        } catch (e) {} finally { p.resetShader(); }
      };
      p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
    }, container);
  }

  _initShader(p) {
    const vert = `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vUv;
      void main() { vUv = aTexCoord; vec4 pos = vec4(aPosition, 1.0); pos.xy = pos.xy * 2.0 - 1.0; gl_Position = pos; }
    `;
    const frag = `
      precision highp float;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      // Attempt smooth coloring with log2
      // Palette function (attempt cosine palette)
      vec3 palette(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.00, 0.33, 0.67);
        return a + b * cos(6.28318 * (c * t + d));
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        float aspect = u_resolution.x / u_resolution.y;

        // Center and apply aspect ratio
        vec2 coord = (uv - 0.5) * 2.0;
        coord.x *= aspect;

        // Zoom target: a visually rich area near the boundary
        vec2 target = vec2(-0.7453, 0.1862);

        // Continuous zoom that slowly accelerates
        float zoomSpeed = u_time * 0.15;
        float zoom = pow(1.4, zoomSpeed);

        // Map screen coords to complex plane with zoom
        vec2 c = target + coord / zoom;

        // Mandelbrot iteration
        vec2 z = vec2(0.0);
        float iter = 0.0;
        const int MAX_ITER = 128;

        for (int i = 0; i < MAX_ITER; i++) {
          // z = z^2 + c
          float x2 = z.x * z.x - z.y * z.y + c.x;
          float y2 = 2.0 * z.x * z.y + c.y;
          z = vec2(x2, y2);

          if (dot(z, z) > 256.0) break;
          iter += 1.0;
        }

        // Smooth iteration count for anti-aliased coloring
        float smoothIter = iter;
        if (iter < float(MAX_ITER)) {
          // Normalized iteration count using escape radius
          float log_zn = log(dot(z, z)) * 0.5; // log(|z|)
          float nu = log(log_zn / log(2.0)) / log(2.0);
          smoothIter = iter + 1.0 - nu;
        }

        // Normalize to 0-1 range
        float t = smoothIter / float(MAX_ITER);

        // Color palette rotation: mid controls speed
        float paletteSpeed = 0.1 + u_mid * 0.3;
        float colorShift = u_time * paletteSpeed;

        // Beat causes palette jump
        colorShift += u_beat * 2.0;

        // Generate color
        vec3 col = vec3(0.0);
        if (iter < float(MAX_ITER)) {
          // Outside the set: apply colorful palette
          float colorIdx = sqrt(t) * 4.0 + colorShift;
          col = palette(colorIdx);

          // Bass affects saturation/intensity
          float satBoost = 1.0 + u_bass * 0.8;
          col *= satBoost;

          // Treble adds brightness to high-iteration areas
          col += vec3(0.1) * u_treble * t;
        } else {
          // Inside the set: deep black with subtle beat glow
          col = vec3(0.0) + vec3(0.15, 0.05, 0.2) * u_beat;
        }

        // Beat flash: brief white-ish pulse
        col += vec3(0.3, 0.25, 0.35) * u_beat * 0.6;

        // Subtle vignette
        vec2 vigUv = uv - 0.5;
        float vig = 1.0 - 0.3 * dot(vigUv, vigUv);
        col *= vig;

        col = clamp(col, 0.0, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['mandelbrot-zoom'] = MandelbrotZoomPreset;
})();
