(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GlitchBorderPreset extends BasePreset {
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
        preset._time += 0.03 + preset.audio.mid * 0.06;
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
      precision mediump float;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      // Hash for deterministic randomness - blocky digital feel
      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }

      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      // Block noise - quantized for digital glitch look
      float blockNoise(vec2 p, float scale) {
        vec2 i = floor(p * scale);
        return hash2(i);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 uvCenter = uv - 0.5; // centered coords

        // Distance from each edge (0 at edge, 0.5 at center)
        float dLeft = uv.x;
        float dRight = 1.0 - uv.x;
        float dTop = 1.0 - uv.y;
        float dBottom = uv.y;
        float dEdge = min(min(dLeft, dRight), min(dTop, dBottom));

        // Border zone: ~15% from edge, with bass expanding it
        float borderWidth = 0.15 + u_bass * 0.06;
        float borderMask = 1.0 - smoothstep(0.0, borderWidth, dEdge);

        // If not in border zone, output black
        if (borderMask < 0.001) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        vec3 col = vec3(0.0);

        // Time variables with mid-driven speed
        float t = u_time;
        float fastTime = t * (3.0 + u_mid * 5.0);

        // --- Horizontal scan lines (glitch tears) ---
        float scanY = floor(uv.y * (30.0 + u_bass * 40.0));
        float scanHash = hash(scanY + floor(fastTime * 2.0));
        float scanActive = step(0.65 - u_bass * 0.2 - u_beat * 0.3, scanHash);
        float scanDisplace = (scanHash - 0.5) * 0.08 * (u_bass + u_beat * 0.5);

        // Displaced UV for RGB split
        vec2 uvDisplaced = uv + vec2(scanDisplace * scanActive * borderMask, 0.0);

        // --- RGB channel separation at borders ---
        float rgbSplit = (0.01 + u_bass * 0.02 + u_beat * 0.03) * borderMask;
        float r = blockNoise(uvDisplaced + vec2(rgbSplit, 0.0), 40.0 + u_treble * 20.0);
        float g = blockNoise(uvDisplaced, 40.0 + u_treble * 20.0);
        float b = blockNoise(uvDisplaced - vec2(rgbSplit, 0.0), 40.0 + u_treble * 20.0);

        // Thin scan line brightness
        float scanLine = scanActive * (0.3 + u_bass * 0.4);
        col += vec3(r, g, b) * scanLine * 0.3;

        // --- Colored glitch blocks ---
        // Block grid - different sizes for variety
        float blockScale1 = 8.0 + u_bass * 6.0;
        float blockScale2 = 15.0 + u_bass * 10.0;

        // Large blocks
        vec2 blockID1 = floor(uv * blockScale1);
        float blockHash1 = hash2(blockID1 + floor(fastTime * 1.5));
        // Flicker: some blocks rapidly toggle on/off
        float flicker1 = step(0.5, hash(blockHash1 * 100.0 + floor(t * 12.0)));
        float blockActive1 = step(0.78 - u_bass * 0.15 - u_beat * 0.25, blockHash1) * flicker1;

        // Small blocks
        vec2 blockID2 = floor(uv * blockScale2);
        float blockHash2 = hash2(blockID2 + floor(fastTime * 2.5));
        float flicker2 = step(0.4, hash(blockHash2 * 77.0 + floor(t * 18.0)));
        float blockActive2 = step(0.80 - u_bass * 0.12 - u_beat * 0.2, blockHash2) * flicker2;

        // Neon color palette: cyan, magenta, white
        vec3 cyan = vec3(0.0, 1.0, 1.0);
        vec3 magenta = vec3(1.0, 0.0, 1.0);
        vec3 white = vec3(1.0);

        // Color selection based on hash
        float colorSel1 = hash(blockHash1 * 37.0);
        vec3 blockColor1 = colorSel1 < 0.33 ? cyan : (colorSel1 < 0.66 ? magenta : white);

        float colorSel2 = hash(blockHash2 * 53.0);
        vec3 blockColor2 = colorSel2 < 0.33 ? cyan : (colorSel2 < 0.66 ? magenta : white);

        // Add blocks (only in border zone)
        col += blockColor1 * blockActive1 * borderMask * (0.6 + u_beat * 0.4);
        col += blockColor2 * blockActive2 * borderMask * (0.4 + u_beat * 0.3);

        // --- Interference / noise pattern along border ---
        float noiseScale = 80.0 + u_treble * 40.0;
        float noise = hash2(floor(uv * noiseScale) + floor(t * 6.0));
        float noiseActive = step(0.85 - u_beat * 0.15, noise);
        float noiseBright = noiseActive * borderMask * (0.15 + u_treble * 0.15);
        col += vec3(noiseBright);

        // --- Horizontal glitch bars (thicker, border-only) ---
        float barY = floor(uv.y * (6.0 + u_bass * 8.0));
        float barHash = hash(barY + floor(t * 4.0) * 7.0);
        float barActive = step(0.85 - u_beat * 0.3 - u_bass * 0.1, barHash);
        float barDisplace = (barHash - 0.5) * 0.15 * borderMask;

        // Bar contributes displaced colored line
        vec3 barColor = mix(cyan, magenta, hash(barY * 13.0));
        col += barColor * barActive * borderMask * 0.35;

        // --- Beat burst: intense flash along all borders ---
        float beatFlash = u_beat * borderMask * 0.5;
        col += white * beatFlash;

        // --- Edge glow (subtle constant border presence) ---
        float edgeGlow = borderMask * (0.03 + u_bass * 0.04);
        col += cyan * edgeGlow * 0.5;

        // Clamp and output
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
window.VJamFX.presets['glitch-border'] = GlitchBorderPreset;
})();
