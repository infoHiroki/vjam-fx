(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class VoronoiGpuPreset extends BasePreset {
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
        preset._time += 0.025 + preset.audio.bass * 0.04;
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

      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)),
            dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      void main() {
        float aspect = u_resolution.x / u_resolution.y;
        vec2 uv = vUv;
        uv.x *= aspect;

        // Grid scale — treble adds complexity
        float scale = 6.0 + u_treble * 3.0;
        vec2 p = uv * scale;

        // Beat: explode outward from center
        vec2 center = vec2(aspect * 0.5, 0.5) * scale;
        vec2 dir = p - center;
        p += normalize(dir) * u_beat * 0.5;

        vec2 ip = floor(p);
        vec2 fp = fract(p);

        float minDist = 1.0;
        float minDist2 = 1.0;
        vec2 minPoint = vec2(0.0);
        vec2 minCell = vec2(0.0);

        // Search 3x3 neighborhood
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 cell = ip + neighbor;
            vec2 rnd = hash2(cell);

            // Animate cell centers
            float speed = 0.5 + u_mid * 0.5;
            vec2 point = neighbor + 0.5 + 0.4 * sin(u_time * speed + rnd * 6.28);

            // Bass: pulsate cell movement
            point += (rnd - 0.5) * u_bass * 0.3;

            float d = length(fp - point);
            if (d < minDist) {
              minDist2 = minDist;
              minDist = d;
              minPoint = point;
              minCell = cell;
            } else if (d < minDist2) {
              minDist2 = d;
            }
          }
        }

        // Edge detection (Raven Kwok style)
        float edge = minDist2 - minDist;
        float edgeLine = 1.0 - smoothstep(0.0, 0.05 + u_treble * 0.02, edge);

        // Cell color from hash
        vec2 cellHash = hash2(minCell);
        float hue = cellHash.x + u_time * 0.05;

        // HSV to RGB
        vec3 cellCol = 0.5 + 0.5 * cos(6.28 * (hue + vec3(0.0, 0.33, 0.67)));

        // Dark cells with bright edges (Raven Kwok aesthetic)
        vec3 col = cellCol * 0.1;
        col = mix(col, cellCol * (1.2 + u_bass * 0.5), edgeLine);

        // Inner glow based on distance
        float glow = exp(-minDist * 4.0) * 0.3;
        col += cellCol * glow * (1.0 + u_mid * 2.0);

        // Beat: edge flash white
        col = mix(col, vec3(1.0), edgeLine * u_beat * 0.8);

        // Brightness
        col *= 1.2 + u_bass * 0.3;

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
window.VJamFX.presets['voronoi-gpu'] = VoronoiGpuPreset;
})();
