(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class VoronoiElectricPreset extends BasePreset {
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
        preset._time += 0.008 + preset.audio.bass * 0.006;
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

      // Hash functions for pseudo-random
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      float hash1(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Simple noise for lightning jitter
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash1(i);
        float b = hash1(i + vec2(1.0, 0.0));
        float c = hash1(i + vec2(0.0, 1.0));
        float d = hash1(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 st = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

        // Scale the space for ~12 cells (3-4 per axis)
        float cellScale = 3.5;
        vec2 scaledSt = st * cellScale;

        float minDist = 1e10;
        float secondDist = 1e10;
        vec2 closestCell = vec2(0.0);
        vec2 closestPoint = vec2(0.0);

        // Voronoi: check 5x5 neighborhood for proper edge detection
        vec2 iSt = floor(scaledSt);
        vec2 fSt = fract(scaledSt);

        for (int y = -2; y <= 2; y++) {
          for (int x = -2; x <= 2; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 cellId = iSt + neighbor;

            // Seed point with slow audio-reactive movement
            vec2 seed = hash2(cellId);
            float speed = 0.3 + u_bass * 0.2;
            seed = 0.5 + 0.4 * sin(u_time * speed + seed * 6.2831);

            vec2 point = neighbor + seed - fSt;
            float dist = length(point);

            if (dist < minDist) {
              secondDist = minDist;
              minDist = dist;
              closestCell = cellId;
              closestPoint = point;
            } else if (dist < secondDist) {
              secondDist = dist;
            }
          }
        }

        // Edge distance (difference between closest and second closest)
        float edgeDist = secondDist - minDist;

        // Lightning jitter along edges using FBM noise
        float jitterScale = 8.0 + u_treble * 6.0;
        float jitter = fbm(scaledSt * jitterScale + u_time * 2.0) * 0.06;
        float jitter2 = fbm(scaledSt * jitterScale * 1.7 - u_time * 3.0) * 0.03;
        float edgeDistJittered = edgeDist + jitter - jitter2;

        // Arc thickness — treble makes arcs more intense/wider
        float arcThick = 0.04 + u_treble * 0.03;
        float arc = smoothstep(arcThick, 0.0, edgeDistJittered);

        // Sharp bright core
        float arcCore = smoothstep(arcThick * 0.3, 0.0, edgeDistJittered);

        // Wider glow around edges
        float glowWidth = 0.12 + u_bass * 0.06;
        float glow = exp(-edgeDistJittered * edgeDistJittered / (glowWidth * glowWidth)) * 0.4;

        // Flickering along arcs (high frequency noise for electric feel)
        float flicker = 0.7 + 0.3 * noise(scaledSt * 20.0 + u_time * 8.0);
        arc *= flicker;
        arcCore *= flicker;

        // Cell interior — dark with subtle color
        float cellShade = minDist * 0.3;
        float cellPulse = 0.02 + 0.02 * sin(u_time * 1.5 + hash1(closestCell) * 6.28) * (0.5 + u_mid * 0.5);
        vec3 cellColor = vec3(0.01, 0.02, 0.05) + vec3(0.0, 0.01, 0.03) * cellShade + cellPulse * vec3(0.0, 0.05, 0.1);

        // Electric blue/cyan palette
        vec3 arcColor = vec3(0.15, 0.5, 1.0);        // blue
        vec3 coreColor = vec3(0.6, 0.9, 1.0);        // bright cyan-white
        vec3 glowColor = vec3(0.05, 0.2, 0.6);       // deep blue glow

        // Treble shifts color toward white/cyan
        arcColor = mix(arcColor, vec3(0.4, 0.8, 1.0), u_treble * 0.4);
        coreColor = mix(coreColor, vec3(1.0), u_treble * 0.3);

        // Compose
        vec3 col = cellColor;
        col += glowColor * glow;
        col += arcColor * arc * 0.8;
        col += coreColor * arcCore * 1.2;

        // Beat flash — bright white flash on all edges
        float beatFlash = u_beat * smoothstep(0.15, 0.0, edgeDist) * 1.5;
        col += vec3(0.9, 0.95, 1.0) * beatFlash;

        // Subtle overall beat brightness
        col += vec3(0.02, 0.04, 0.08) * u_beat * 0.5;

        // Vignette
        float vig = 1.0 - 0.3 * dot(st, st);
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
window.VJamFX.presets['voronoi-electric'] = VoronoiElectricPreset;
})();
