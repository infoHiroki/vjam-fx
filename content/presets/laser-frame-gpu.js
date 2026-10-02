(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class LaserFrameGpuPreset extends BasePreset {
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
        preset._time += 0.02 + preset.audio.mid * 0.04;
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

      // Laser dot moving along a border edge
      // pos: position along edge (0-1), center: laser center position
      float laserDot(float pos, float center, float width) {
        float d = abs(pos - center);
        // Wrap around for smooth looping
        d = min(d, 1.0 - d);
        return exp(-d * d / (width * width));
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;

        // Distance from each edge
        float dLeft = uv.x;
        float dRight = 1.0 - uv.x;
        float dBottom = uv.y;
        float dTop = 1.0 - uv.y;

        // Frame border zone: ~15% from each edge
        float borderWidth = 0.15;
        float minEdge = min(min(dLeft, dRight), min(dBottom, dTop));

        // Hard cutoff: center is completely black
        if (minEdge > borderWidth) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        // Fade factor: strongest at edge, fading toward center
        float edgeFade = 1.0 - smoothstep(0.0, borderWidth, minEdge);

        // Determine which edge we're closest to and the position along that edge
        float alongEdge = 0.0;
        float edgeDist = 0.0;
        // 0=left, 1=top, 2=right, 3=bottom
        float edgeID = 0.0;

        if (dLeft <= dRight && dLeft <= dTop && dLeft <= dBottom) {
          alongEdge = uv.y;
          edgeDist = dLeft;
          edgeID = 0.0;
        } else if (dTop <= dLeft && dTop <= dRight && dTop <= dBottom) {
          alongEdge = uv.x;
          edgeDist = dTop;
          edgeID = 1.0;
        } else if (dRight <= dLeft && dRight <= dTop && dRight <= dBottom) {
          alongEdge = 1.0 - uv.y;
          edgeDist = dRight;
          edgeID = 2.0;
        } else {
          alongEdge = 1.0 - uv.x;
          edgeDist = dBottom;
          edgeID = 3.0;
        }

        // Glow width controlled by bass
        float glowW = 0.03 + u_bass * 0.04;

        // Speed controlled by mid
        float speed = 1.0 + u_mid * 2.0;

        vec3 col = vec3(0.0);

        // --- 6 laser dots per edge, each with different speed/color ---
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          // Each laser has a unique speed and phase
          float laserSpeed = speed * (0.6 + fi * 0.25);
          float phase = fi * 0.37 + edgeID * 1.57;
          float center = fract(u_time * laserSpeed * 0.15 + phase);

          // Laser trail width varies
          float trailW = glowW * (0.8 + 0.4 * sin(fi * 2.1));

          float dot = laserDot(alongEdge, center, trailW);

          // Edge proximity glow: laser is brightest right at the border
          float proxGlow = exp(-edgeDist * edgeDist / (glowW * glowW * 4.0));

          float intensity = dot * proxGlow;

          // Color: cycle through red, green, blue neon
          vec3 laserCol;
          float colorPhase = mod(fi + floor(u_time * 0.3), 3.0);
          if (colorPhase < 1.0) {
            laserCol = vec3(1.0, 0.1, 0.15);  // Red
          } else if (colorPhase < 2.0) {
            laserCol = vec3(0.1, 1.0, 0.2);   // Green
          } else {
            laserCol = vec3(0.15, 0.3, 1.0);  // Blue
          }

          // Treble adds brightness shimmer
          float shimmer = 0.8 + 0.2 * u_treble;

          col += laserCol * intensity * shimmer * 1.5;
        }

        // --- Corner crossing: lasers that smoothly go around corners ---
        // Use a continuous perimeter coordinate (0-4 around the frame)
        float perim = 0.0;
        if (dBottom <= borderWidth && dLeft <= borderWidth) {
          // Bottom-left corner region
          perim = mix(3.0 + (1.0 - uv.x), 0.0 + uv.y, step(dLeft, dBottom));
        } else if (dLeft <= borderWidth) {
          perim = uv.y;
        } else if (dTop <= borderWidth) {
          perim = 1.0 + uv.x;
        } else if (dRight <= borderWidth) {
          perim = 2.0 + (1.0 - uv.y);
        } else {
          perim = 3.0 + (1.0 - uv.x);
        }
        perim /= 4.0; // Normalize to 0-1

        // 3 perimeter-tracing lasers
        for (int j = 0; j < 3; j++) {
          float fj = float(j);
          float pCenter = fract(u_time * speed * 0.08 * (1.0 + fj * 0.3) + fj * 0.33);
          float pDot = laserDot(perim, pCenter, glowW * 1.2);

          float proxGlow = exp(-minEdge * minEdge / (glowW * glowW * 3.0));
          float pIntensity = pDot * proxGlow * 0.8;

          vec3 pColor;
          float cIdx = mod(fj + floor(u_time * 0.2 + 1.5), 3.0);
          if (cIdx < 1.0) pColor = vec3(1.0, 0.2, 0.6);      // Pink
          else if (cIdx < 2.0) pColor = vec3(0.2, 0.9, 1.0);  // Cyan
          else pColor = vec3(1.0, 1.0, 0.2);                   // Yellow

          col += pColor * pIntensity;
        }

        // --- Subtle ambient border glow ---
        float ambientGlow = exp(-minEdge * 8.0) * 0.06 * (1.0 + u_bass * 0.5);
        col += vec3(0.3, 0.1, 0.5) * ambientGlow;

        // --- Beat flash: all borders light up ---
        float beatFlash = u_beat * exp(-minEdge * 12.0);
        col += vec3(1.0, 1.0, 1.0) * beatFlash * 0.7;

        // Apply edge fade to ensure clean center
        col *= edgeFade;

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
window.VJamFX.presets['laser-frame-gpu'] = LaserFrameGpuPreset;
})();
