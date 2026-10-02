(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NeonGridShaderPreset extends BasePreset {
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
        preset.beatPulse *= 0.88;
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
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float t = u_time;

        // Perspective warp (looking down at a grid)
        float horizon = 0.1;
        float perspective = 1.0 / (uv.y + horizon + 0.3);
        vec2 grid = vec2(uv.x * perspective * 2.0, perspective * 1.5 - t * 0.8);

        // Grid lines
        float gridSize = 1.0;
        vec2 gridUv = fract(grid / gridSize) - 0.5;
        float lineX = smoothstep(0.02 + u_treble * 0.01, 0.0, abs(gridUv.x));
        float lineY = smoothstep(0.02 + u_treble * 0.01, 0.0, abs(gridUv.y));
        float lines = max(lineX, lineY);

        // Cell identity for per-cell effects
        vec2 cellId = floor(grid / gridSize);
        float cellRand = hash(cellId);

        // Some cells light up on beat
        float cellActive = step(0.7 - u_beat * 0.3, cellRand);
        float cellPulse = cellActive * (0.3 + sin(t * 3.0 + cellRand * 10.0) * 0.2);

        // Cell glow color
        vec3 cellCol = 0.5 + 0.5 * cos(cellRand * 6.28 + t * 0.3 + vec3(0, 2, 4));
        vec3 cellGlow = cellCol * cellPulse * perspective * 0.3;

        // Grid line color (shifts with bass)
        vec3 lineCol = 0.5 + 0.5 * cos(t * 0.2 + perspective * 0.5 + vec3(0, 1.5, 3));
        lineCol *= 1.0 + u_bass * 0.5;

        // Distance fade
        float fade = smoothstep(20.0, 1.0, perspective);
        lines *= fade;

        vec3 col = lineCol * lines * 0.8;
        col += cellGlow;

        // Horizon glow
        float horizonGlow = exp(-abs(uv.y - horizon) * 15.0) * (0.5 + u_bass * 0.5);
        vec3 hCol = vec3(1.0, 0.3, 0.6);
        col += hCol * horizonGlow;

        // Sky: subtle gradient above horizon
        if (uv.y > horizon) {
          float skyGrad = (uv.y - horizon) * 2.0;
          col += vec3(0.05, 0.0, 0.1) * skyGrad;
          // Stars
          float star = step(0.998, hash(floor(gl_FragCoord.xy * 0.3)));
          col += star * 0.4 * vec3(1.0);
        }

        // Beat flash on grid
        col += lines * u_beat * 0.5 * vec3(1.0, 0.9, 0.8);

        // Scanline effect
        float scan = sin(gl_FragCoord.y * 1.5) * 0.03;
        col -= scan;

        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['neon-grid-shader'] = NeonGridShaderPreset;
})();
