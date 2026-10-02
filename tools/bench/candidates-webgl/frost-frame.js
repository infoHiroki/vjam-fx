(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FrostFramePreset extends BasePreset {
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
        preset._time += 0.015 + preset.audio.mid * 0.02;
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

      // Hash for randomness
      vec2 hash22(vec2 p) {
        vec3 a = fract(p.xyx * vec3(123.34, 234.34, 345.65));
        a += dot(a, a.yzx + 45.32);
        return fract(vec2(a.x * a.y, a.y * a.z));
      }

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // Voronoi cell edges for crystalline structure
      float voronoi(vec2 p) {
        vec2 ip = floor(p);
        vec2 fp = fract(p);
        float d1 = 8.0;
        float d2 = 8.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash22(ip + neighbor);
            point = 0.5 + 0.5 * sin(u_time * 0.3 + 6.2831 * point);
            vec2 diff = neighbor + point - fp;
            float dist = length(diff);
            if (dist < d1) { d2 = d1; d1 = dist; }
            else if (dist < d2) { d2 = dist; }
          }
        }
        return d2 - d1;
      }

      // Simple noise
      float noise(vec2 p) {
        vec2 ip = floor(p);
        vec2 fp = fract(p);
        fp = fp * fp * (3.0 - 2.0 * fp);
        float a = hash21(ip);
        float b = hash21(ip + vec2(1.0, 0.0));
        float c = hash21(ip + vec2(0.0, 1.0));
        float d = hash21(ip + vec2(1.0, 1.0));
        return mix(mix(a, b, fp.x), mix(c, d, fp.x), fp.y);
      }

      // FBM - 3 octaves for performance
      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 3; i++) {
          val += amp * noise(p);
          p *= 2.1;
          amp *= 0.5;
        }
        return val;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);

        // Distance from each edge (0 at edge, 0.5 at center)
        float dLeft = uv.x;
        float dRight = 1.0 - uv.x;
        float dTop = 1.0 - uv.y;
        float dBottom = uv.y;

        // Minimum distance to any edge
        float edgeDist = min(min(dLeft, dRight), min(dTop, dBottom));

        // Corner distance (minimum of two nearest edges combined)
        float cornerDist = min(dLeft, dRight) + min(dTop, dBottom);

        // Frost penetration depth: ~20-25% from edges, more from corners
        float frostEdge = smoothstep(0.25, 0.02, edgeDist);
        float frostCorner = smoothstep(0.50, 0.02, cornerDist);
        float frostMask = max(frostEdge, frostCorner);

        // Early exit for center pixels (pure black)
        if (frostMask < 0.001) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        // Frost pattern coordinates (aspect-corrected)
        vec2 frostUV = uv * aspect;

        // Voronoi crystal cells at two scales
        float crystalLarge = voronoi(frostUV * 8.0 + u_time * 0.1);
        float crystalSmall = voronoi(frostUV * 18.0 - u_time * 0.07);

        // FBM branching noise for frost tendrils
        float branch = fbm(frostUV * 6.0 + u_time * 0.05 * (1.0 + u_mid));
        float branchFine = fbm(frostUV * 14.0 - vec2(u_time * 0.03));

        // Combine into frost pattern
        // Crystal edges (thin bright lines)
        float crystalEdge = smoothstep(0.0, 0.08, crystalLarge) * (1.0 - smoothstep(0.08, 0.18, crystalLarge));
        float crystalEdge2 = smoothstep(0.0, 0.06, crystalSmall) * (1.0 - smoothstep(0.06, 0.14, crystalSmall));

        // Branching frost (thicker, softer)
        float frostBranch = smoothstep(0.3, 0.6, branch) * 0.6;
        float frostDetail = smoothstep(0.35, 0.65, branchFine) * 0.3;

        // Combine patterns
        float frost = crystalEdge * 0.8 + crystalEdge2 * 0.5 + frostBranch + frostDetail;
        frost = clamp(frost, 0.0, 1.0);

        // Apply frost mask (edges/corners only)
        frost *= frostMask;

        // Add extra density at corners
        float cornerBoost = smoothstep(0.4, 0.0, cornerDist) * 0.4;
        frost += cornerBoost * frostMask * (0.3 + 0.3 * fbm(frostUV * 4.0));
        frost = clamp(frost, 0.0, 1.0);

        // Color: ice white/blue with prismatic highlights
        vec3 iceBase = vec3(0.75, 0.85, 1.0);
        vec3 iceBlue = vec3(0.5, 0.7, 1.0);
        vec3 prismatic = vec3(
          0.5 + 0.5 * sin(frostUV.x * 20.0 + u_time * 0.5),
          0.5 + 0.5 * sin(frostUV.y * 20.0 + u_time * 0.5 + 2.094),
          0.5 + 0.5 * sin((frostUV.x + frostUV.y) * 15.0 + u_time * 0.5 + 4.189)
        );

        // Mix colors based on frost structure
        vec3 frostColor = mix(iceBase, iceBlue, crystalEdge * 0.6 + crystalEdge2 * 0.4);
        // Subtle prismatic highlight on crystal edges
        frostColor += prismatic * 0.12 * (crystalEdge + crystalEdge2);

        // Bass controls brightness/opacity
        float bassBoost = 0.6 + u_bass * 0.5;
        frostColor *= bassBoost;

        // Beat sparkle/shimmer
        float sparkleNoise = hash21(floor(frostUV * 40.0) + floor(u_time * 8.0));
        float sparkle = step(0.92, sparkleNoise) * u_beat * 2.0;
        frostColor += vec3(1.0) * sparkle * frost;

        // Treble adds subtle shimmer to edges
        float trebleShimmer = u_treble * 0.15 * sin(u_time * 4.0 + edgeDist * 30.0);
        frostColor += vec3(0.6, 0.8, 1.0) * trebleShimmer * crystalEdge;

        // Final composite: frost on black
        vec3 col = frostColor * frost;

        // Clamp
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
window.VJamFX.presets['frost-frame'] = FrostFramePreset;
})();
