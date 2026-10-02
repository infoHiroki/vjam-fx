(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DigitalRainGpuPreset extends BasePreset {
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
        preset._time += 0.016 + preset.audio.bass * 0.03;
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
      precision mediump float;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      float hash(float n) { return fract(sin(n) * 43758.5453); }
      float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      // Pseudo-glyph pattern
      float glyph(vec2 cellUv, float id) {
        vec2 g = floor(cellUv * 5.0);
        float h = hash2(g + id * 137.0);
        // Create glyph-like pattern
        float on = step(0.4, h);
        // Padding
        float px = step(0.12, cellUv.x) * step(cellUv.x, 0.88);
        float py = step(0.08, cellUv.y) * step(cellUv.y, 0.92);
        return on * px * py;
      }

      vec3 rainLayer(vec2 uv, float seed, float speedMul, float colScale, float bright) {
        float numCols = 28.0 * colScale;
        float numRows = 40.0 * colScale;

        float colIdx = floor(uv.x * numCols);
        float cellX = fract(uv.x * numCols);

        // Per-column properties
        float cSeed = hash(colIdx * 0.371 + seed);
        float speed = (0.3 + cSeed * 0.7) * speedMul * (1.0 + u_bass * 1.5);
        float offset = hash(colIdx * 1.73 + seed) * 30.0;
        float trailLen = 0.3 + hash(colIdx * 2.91 + seed) * 0.4;

        // Drop position (0=top, 1=bottom), wrapping
        float dropY = fract(u_time * speed + offset);

        // y in screen space: uv.y=1 is top, uv.y=0 is bottom
        // dist: how far this pixel is ABOVE the drop head
        // head is at screenY = 1.0 - dropY
        float headScreenY = 1.0 - dropY;
        float dist = uv.y - headScreenY;

        // Wrap: allow trail to cross the top edge
        if (dist < -0.5) dist += 1.0;
        if (dist > 0.5) dist -= 1.0;

        // Trail is ABOVE the head (positive dist), head is at dist=0
        float trail = smoothstep(trailLen, 0.0, dist) * step(0.0, dist);
        // Head glow (near dist=0)
        float headGlow = exp(-abs(dist) * 60.0);

        // Character grid
        float rowIdx = floor((1.0 - uv.y) * numRows);
        float cellY = fract((1.0 - uv.y) * numRows);

        // Cycling character ID
        float cycle = floor(u_time * 4.0 + hash(colIdx) * 50.0);
        float charId = hash2(vec2(colIdx, rowIdx + cycle));
        float ch = glyph(vec2(cellX, cellY), charId);

        // Colors
        vec3 green = vec3(0.1, 0.85, 0.3);
        vec3 white = vec3(0.75, 1.0, 0.85);
        vec3 color = mix(green, white, headGlow * 0.8);

        float intensity = ch * trail * bright * (1.0 + u_treble * 0.6);
        intensity += headGlow * 0.4 * bright;
        intensity += u_beat * 0.4 * trail * ch;

        // Ambient column glow
        float ambGlow = trail * 0.04 * step(0.1, cellX) * step(cellX, 0.9);

        return color * intensity + green * ambGlow;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;

        vec3 col = vec3(0.0);

        // 3 layers at different scales/speeds
        col += rainLayer(uv, 0.0, 1.0, 1.0, 1.0);
        col += rainLayer(uv, 42.0, 0.65, 1.4, 0.35);
        col += rainLayer(uv, 99.0, 0.4, 1.8, 0.12);

        // Beat flash
        col += vec3(0.06, 0.12, 0.06) * u_beat;

        // Vignette
        vec2 vc = uv - 0.5;
        col *= 1.0 - 0.35 * dot(vc, vc);

        // Scanlines
        col *= 0.95 + 0.05 * sin(gl_FragCoord.y * 1.5);

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
window.VJamFX.presets['digital-rain-gpu'] = DigitalRainGpuPreset;
})();
