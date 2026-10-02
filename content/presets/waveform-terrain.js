(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class WaveformTerrainPreset extends BasePreset {
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

      // Hash and noise functions
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        for (int i = 0; i < 3; i++) {
          v += a * noise(p);
          p = p * 2.0 + shift;
          a *= 0.5;
        }
        return v;
      }

      // Terrain height at world xz position
      float terrain(vec2 p) {
        float baseHeight = 0.5 + u_bass * 1.2;
        float h = fbm(p * 0.3) * baseHeight;
        // Mid adds wave-like ridges
        h += sin(p.x * 2.0 + u_time * 1.5) * u_mid * 0.3;
        // Beat causes spiky mountain burst
        h += u_beat * 0.8 * noise(p * 1.5 + u_time * 0.5);
        return h;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Camera setup - above-front angle looking at terrain
        float scrollSpeed = 0.6 + u_mid * 0.8;
        float scroll = u_time * scrollSpeed;

        vec3 ro = vec3(0.0, 1.2 + u_bass * 0.3, scroll); // ray origin (camera)
        vec3 lookAt = vec3(0.0, 0.4, scroll + 3.0);

        // Simple camera matrix
        vec3 fwd = normalize(lookAt - ro);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
        vec3 up = cross(fwd, right);

        vec3 rd = normalize(fwd + uv.x * right + uv.y * up);

        // Raymarching against terrain
        vec3 col = vec3(0.0);
        float t = 0.0;
        bool hit = false;
        vec3 hitPos = vec3(0.0);

        for (int i = 0; i < 45; i++) {
          vec3 pos = ro + rd * t;
          float h = terrain(pos.xz);
          float diff = pos.y - h;

          if (diff < 0.01) {
            hit = true;
            hitPos = pos;
            break;
          }

          // Adaptive step size
          t += max(diff * 0.5, 0.02);

          if (t > 30.0) break;
        }

        if (hit) {
          vec2 worldXZ = hitPos.xz;
          float h = terrain(worldXZ);

          // Grid / wireframe lines on terrain surface
          float gridScale = 0.7;
          vec2 gridUV = fract(worldXZ / gridScale) - 0.5;
          float lineWidth = 0.04 + u_treble * 0.04;
          float lineX = smoothstep(lineWidth, 0.0, abs(gridUV.x));
          float lineZ = smoothstep(lineWidth, 0.0, abs(gridUV.y));
          float grid = max(lineX, lineZ);

          // Grid line brightness — always visible, treble boosts
          float gridBright = 1.0 + u_treble * 1.2;
          grid *= gridBright;

          // Height-based coloring
          float hNorm = clamp(h * 1.2, 0.0, 1.0);

          // Neon cyan for low areas, magenta for peaks, white-hot at extreme
          vec3 cyanNeon = vec3(0.0, 1.0, 1.0);
          vec3 magentaNeon = vec3(1.0, 0.15, 0.8);
          vec3 whiteHot = vec3(1.0, 0.9, 1.0);
          vec3 gridColor = mix(cyanNeon, magentaNeon, hNorm);
          gridColor = mix(gridColor, whiteHot, smoothstep(0.7, 1.0, hNorm));

          // Dark terrain base with purple tint
          vec3 baseColor = vec3(0.03, 0.01, 0.06);

          // Combine base + grid lines + surface glow
          col = baseColor + gridColor * grid;

          // Surface glow proportional to height and bass
          col += gridColor * 0.12 * hNorm * (1.0 + u_bass * 0.8);

          // Grid glow halo (wider, softer)
          float glowWidth = lineWidth * 4.0;
          float glowX = smoothstep(glowWidth, 0.0, abs(gridUV.x));
          float glowZ = smoothstep(glowWidth, 0.0, abs(gridUV.y));
          float glow = max(glowX, glowZ) * 0.2;
          col += gridColor * glow;

          // Beat flash — strong white burst on terrain
          col += grid * u_beat * 1.0 * vec3(1.0, 0.85, 0.95);
          col += u_beat * 0.3 * vec3(1.0, 0.5, 0.8);

          // Distance fog (lighter, less aggressive)
          float dist = length(hitPos - ro);
          float fog = 1.0 - exp(-dist * 0.05);
          vec3 fogColor = vec3(0.06, 0.01, 0.12);
          col = mix(col, fogColor, fog);
        } else {
          // Sky - dark gradient with vivid glow at horizon
          float skyGrad = clamp(-uv.y + 0.3, 0.0, 1.0);
          col = vec3(0.04, 0.01, 0.08) * skyGrad;

          // Horizon glow line — much brighter, bass reactive
          float horizonGlow = exp(-abs(uv.y + 0.1) * 10.0) * (0.7 + u_bass * 0.8);
          col += vec3(1.0, 0.25, 0.6) * horizonGlow;

          // Secondary cyan glow
          float horizonGlow2 = exp(-abs(uv.y + 0.05) * 15.0) * (0.3 + u_mid * 0.4);
          col += vec3(0.0, 0.6, 1.0) * horizonGlow2;

          // Sparse stars
          float star = step(0.997, hash(floor(gl_FragCoord.xy * 0.25)));
          float twinkle = 0.4 + 0.3 * sin(u_time * 2.0 + hash(floor(gl_FragCoord.xy * 0.25)) * 20.0);
          col += star * twinkle * vec3(0.9, 0.9, 1.0);
        }

        // Scanline overlay for retro feel
        float scan = sin(gl_FragCoord.y * 1.2) * 0.025;
        col -= scan;

        // Vignette
        vec2 vig = uv * 1.2;
        col *= 1.0 - dot(vig, vig) * 0.3;

        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['waveform-terrain'] = WaveformTerrainPreset;
})();
