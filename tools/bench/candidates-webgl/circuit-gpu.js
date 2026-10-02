(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CircuitGpuPreset extends BasePreset {
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
      precision mediump float;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      // Hash functions for deterministic randomness
      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
      }

      // Smooth line segment SDF
      float sdSegment(vec2 p, vec2 a, vec2 b) {
        vec2 pa = p - a, ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return length(pa - ba * h);
      }

      // Box SDF for solder pads
      float sdBox(vec2 p, vec2 b) {
        vec2 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Grid density driven by mid
        float gridSize = mix(0.08, 0.04, u_mid);
        vec2 gridUV = uv / gridSize;
        vec2 cellID = floor(gridUV);
        vec2 cellUV = fract(gridUV) - 0.5;

        // PCB dark green background with subtle gradient
        vec3 bgCol = vec3(0.0, 0.04, 0.02) + 0.01 * length(uv);
        vec3 col = bgCol;

        // Trace color palette
        vec3 traceCol = vec3(0.0, 0.7, 0.3);
        vec3 glowCol = vec3(0.0, 1.0, 0.6);
        vec3 pulseCol = vec3(0.2, 1.0, 0.9);

        float traceBright = 0.0;
        float glowAccum = 0.0;

        // Check current cell and neighbors for traces
        for (int dy = -1; dy <= 1; dy++) {
          for (int dx = -1; dx <= 1; dx++) {
            vec2 neighbor = vec2(float(dx), float(dy));
            vec2 nID = cellID + neighbor;
            vec2 nUV = cellUV - neighbor;

            float h = hash21(nID);

            // Each cell has a node at center
            // Determine outgoing trace directions based on hash
            float dirHash = hash21(nID * 7.13 + 3.7);

            // Up to 2 outgoing traces per node
            // Direction encoding: 0=right, 1=up, 2=left, 3=down
            int dir1 = int(mod(dirHash * 17.0, 4.0));
            int dir2 = int(mod(hash21(nID * 13.37 + 1.1) * 19.0, 4.0));

            // Skip cells with low hash (create gaps in the circuit)
            float density = 0.5 + u_mid * 0.3;
            if (h > density) continue;

            // Draw traces from this node
            vec2 center = vec2(0.0);
            float traceW = 0.03;

            // Trace 1
            vec2 end1 = center;
            if (dir1 == 0) end1 = vec2(0.5, 0.0);
            else if (dir1 == 1) end1 = vec2(0.0, 0.5);
            else if (dir1 == 2) end1 = vec2(-0.5, 0.0);
            else end1 = vec2(0.0, -0.5);

            float d1 = sdSegment(nUV, center, end1);
            float t1 = smoothstep(traceW, traceW * 0.3, d1);
            traceBright = max(traceBright, t1);

            // Glow around trace
            float gw = 0.12 + u_treble * 0.1;
            glowAccum += exp(-d1 * d1 / (gw * gw * 0.01)) * 0.15;

            // Trace 2 (only if different direction)
            if (dir2 != dir1) {
              vec2 end2 = center;
              if (dir2 == 0) end2 = vec2(0.5, 0.0);
              else if (dir2 == 1) end2 = vec2(0.0, 0.5);
              else if (dir2 == 2) end2 = vec2(-0.5, 0.0);
              else end2 = vec2(0.0, -0.5);

              float d2 = sdSegment(nUV, center, end2);
              float t2 = smoothstep(traceW, traceW * 0.3, d2);
              traceBright = max(traceBright, t2);
              glowAccum += exp(-d2 * d2 / (gw * gw * 0.01)) * 0.15;
            }

            // Solder pad at node center
            float padSize = 0.06 + 0.02 * step(0.7, h);
            float pad = sdBox(nUV, vec2(padSize));
            float padBright = smoothstep(0.02, 0.0, pad);
            traceBright = max(traceBright, padBright * 0.8);

            // Small circle inside pad (drill hole)
            float hole = length(nUV);
            float holeBright = smoothstep(0.03, 0.02, hole);
            traceBright = max(traceBright, holeBright * 0.3);

            // Pulse propagation along traces
            float pulseSpeed = 2.0 + u_bass * 3.0;
            // Distance from center of screen for beat burst
            float distFromCenter = length(nID * gridSize);
            // Pulse wave traveling outward on beat
            float beatWave = u_beat * exp(-abs(distFromCenter - u_beat * 1.5) * 4.0);

            // Continuous pulses along traces
            float pulsePhase1 = fract(u_time * pulseSpeed * 0.3 + h * 6.28);
            float pulseDist1 = length(nUV - end1 * pulsePhase1);
            float pulse1 = exp(-pulseDist1 * pulseDist1 * 80.0) * (0.5 + u_bass * 0.8);

            float pulsePhase2 = fract(u_time * pulseSpeed * 0.25 + h * 3.14);
            float pulseDist2 = length(nUV - end1 * pulsePhase2);
            float pulse2 = exp(-pulseDist2 * pulseDist2 * 80.0) * 0.4;

            // Accumulate pulse glow
            glowAccum += (pulse1 + pulse2 + beatWave) * 0.6;
          }
        }

        // Compose final color
        // Base traces
        col = mix(col, traceCol * (0.4 + u_treble * 0.3), traceBright);

        // Glow layer
        col += glowCol * glowAccum * (0.3 + u_treble * 0.5);

        // Pulse highlights
        col += pulseCol * glowAccum * u_bass * 0.4;

        // Beat flash - brief bright burst from center
        float centerDist = length(uv);
        float beatFlash = u_beat * exp(-centerDist * 3.0) * 0.3;
        col += vec3(0.1, 0.8, 0.6) * beatFlash;

        // Subtle vignette
        float vig = 1.0 - 0.4 * dot(uv, uv);
        col *= vig;

        // Clamp output
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
window.VJamFX.presets['circuit-gpu'] = CircuitGpuPreset;
})();
