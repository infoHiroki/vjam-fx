(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class StainedGlassRosePreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._time = 0;
    this._sBass = 0;
    this._sMid = 0;
    this._sTreble = 0;
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
        const k = 0.12;
        preset._sBass += (preset.audio.bass - preset._sBass) * k;
        preset._sMid += (preset.audio.mid - preset._sMid) * k;
        preset._sTreble += (preset.audio.treble - preset._sTreble) * k;
        preset._time += 0.018 + preset._sMid * 0.03;
        preset.beatPulse *= 0.85;
        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset._sBass);
          preset._shader.setUniform('u_mid', preset._sMid);
          preset._shader.setUniform('u_treble', preset._sTreble);
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

      // Hash for cell color assignment
      float hash1(float n) {
        return fract(sin(n) * 43758.5453);
      }

      float hash1v(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Smooth noise for glass texture
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash1v(i);
        float b = hash1v(i + vec2(1.0, 0.0));
        float c = hash1v(i + vec2(0.0, 1.0));
        float d = hash1v(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // Cathedral jewel palette: ruby, sapphire, amethyst, topaz, emerald
      vec3 jewelColor(float id) {
        float h = fract(id * 7.391);
        float seg = floor(h * 5.0);
        float t = fract(h * 5.0);
        vec3 c;
        if (seg < 1.0)      c = mix(vec3(0.75, 0.04, 0.10), vec3(0.90, 0.08, 0.18), t); // ruby
        else if (seg < 2.0) c = mix(vec3(0.06, 0.12, 0.78), vec3(0.10, 0.22, 0.92), t); // sapphire
        else if (seg < 3.0) c = mix(vec3(0.52, 0.08, 0.72), vec3(0.68, 0.14, 0.88), t); // amethyst
        else if (seg < 4.0) c = mix(vec3(0.88, 0.62, 0.06), vec3(0.98, 0.80, 0.14), t); // topaz
        else                c = mix(vec3(0.04, 0.58, 0.16), vec3(0.08, 0.76, 0.28), t); // emerald
        return c;
      }

      // Signed distance to a rounded arc segment (petal shape)
      // Returns distance to the filled petal region
      float petalSDF(vec2 p, float r0, float r1, float a0, float a1) {
        float r = length(p);
        float a = atan(p.y, p.x);

        // Normalize angle into [a0, a1]
        float halfSpan = (a1 - a0) * 0.5;
        float mid = a0 + halfSpan;
        float da = a - mid;
        // Wrap da into [-PI, PI]
        da = da - floor((da + 3.14159265) / 6.28318530) * 6.28318530;

        float dAngle = abs(da) - halfSpan;
        float dRadial = max(r0 - r, r - r1);
        return max(dAngle, dRadial);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

        // Bass pulse: expand/contract central pattern
        float bassExpand = 1.0 + u_bass * 0.22;

        // Mid: slow rotation of the whole pattern
        float rotation = u_time * 0.12 + u_mid * 0.6;
        float cosR = cos(rotation);
        float sinR = sin(rotation);
        vec2 ruv = vec2(cosR * uv.x - sinR * uv.y, sinR * uv.x + cosR * uv.y);
        ruv /= bassExpand;

        float r = length(ruv);
        float a = atan(ruv.y, ruv.x); // [-PI, PI]

        // --- Rose window geometry ---
        // 3 concentric rings + center
        // Ring params: [rInner, rOuter, numSegments]
        // Ring 0 (innermost): 8 petals  r: 0.08 - 0.22
        // Ring 1: 16 petals             r: 0.22 - 0.42
        // Ring 2 (outer): 24 petals     r: 0.42 - 0.66
        // Outer frame: solid ring        r: 0.66 - 0.72

        float PI = 3.14159265;
        float TWO_PI = 6.28318530;

        // Lead thickness (border between segments)
        float leadW = 0.018;

        // Determine which ring we're in
        float cellId = 0.0;
        float edgeDist = 1.0; // distance to nearest lead line (positive = inside glass)
        vec3 segColor = vec3(0.0);
        bool inGlass = false;

        // Center circle
        if (r < 0.08) {
          float d = 0.08 - r;
          edgeDist = d / leadW;
          cellId = 0.5;
          segColor = jewelColor(0.5);
          inGlass = true;
        }

        // Ring 0: 8 petals, r 0.08–0.22
        if (!inGlass && r >= 0.08 && r < 0.22) {
          int n = 8;
          float segAngle = TWO_PI / float(n);
          float normA = fract((a + PI) / TWO_PI);  // [0,1]
          float seg = floor(normA * float(n));
          float segCenter = (seg + 0.5) / float(n) * TWO_PI - PI;
          float da = a - segCenter;
          da = da - floor((da + PI) / TWO_PI) * TWO_PI;
          float halfSeg = segAngle * 0.5;
          float dAngle = (halfSeg - abs(da)) / halfSeg; // >0 inside
          float dRadial = min(r - 0.08, 0.22 - r) / 0.07;
          edgeDist = min(dAngle, dRadial) * 0.8;
          cellId = hash1(seg * 3.7 + 1.0);
          segColor = jewelColor(cellId);
          inGlass = true;
        }

        // Ring 1: 16 petals, r 0.22–0.42
        if (!inGlass && r >= 0.22 && r < 0.42) {
          int n = 16;
          float segAngle = TWO_PI / float(n);
          // Slight angular offset for interlocking look
          float offsetA = a + segAngle * 0.5;
          float normA = fract((offsetA + PI) / TWO_PI);
          float seg = floor(normA * float(n));
          float segCenter = (seg + 0.5) / float(n) * TWO_PI - PI - segAngle * 0.5;
          float da = a - segCenter;
          da = da - floor((da + PI) / TWO_PI) * TWO_PI;
          float halfSeg = segAngle * 0.5;
          float dAngle = (halfSeg - abs(da)) / halfSeg;
          float dRadial = min(r - 0.22, 0.42 - r) / 0.10;
          edgeDist = min(dAngle, dRadial) * 0.8;
          cellId = hash1(seg * 5.3 + 2.0);
          segColor = jewelColor(cellId);
          inGlass = true;
        }

        // Ring 2: 24 petals, r 0.42–0.66
        if (!inGlass && r >= 0.42 && r < 0.66) {
          int n = 24;
          float segAngle = TWO_PI / float(n);
          float normA = fract((a + PI) / TWO_PI);
          float seg = floor(normA * float(n));
          float segCenter = (seg + 0.5) / float(n) * TWO_PI - PI;
          float da = a - segCenter;
          da = da - floor((da + PI) / TWO_PI) * TWO_PI;
          float halfSeg = segAngle * 0.5;
          float dAngle = (halfSeg - abs(da)) / halfSeg;
          float dRadial = min(r - 0.42, 0.66 - r) / 0.12;
          edgeDist = min(dAngle, dRadial) * 0.8;
          cellId = hash1(seg * 2.9 + 3.0);
          segColor = jewelColor(cellId);
          inGlass = true;
        }

        // Outer solid frame ring r 0.66–0.72
        if (!inGlass && r >= 0.66 && r < 0.72) {
          float d = min(r - 0.66, 0.72 - r) / 0.03;
          edgeDist = d;
          cellId = 0.13; // dark amber frame
          segColor = vec3(0.60, 0.40, 0.06);
          inGlass = true;
        }

        // Glass texture: subtle ripple imperfection
        float tex = vnoise(ruv * 18.0 + cellId * 8.0) * 0.12 + 0.88;
        segColor *= tex;

        // Light from behind: diffuse warm glow centered at origin
        float lightR = 1.0 / (1.0 + r * 4.5);
        float ambient = 0.55 + u_bass * 0.35;
        segColor *= ambient + lightR * 0.8;

        // Treble: sparkle / refraction shimmer on glass surface
        float shimmerU = vnoise(ruv * 40.0 + u_time * 2.5);
        float shimmerV = vnoise(ruv * 40.0 + vec2(5.3, 2.7) + u_time * 2.5);
        float shimmer = pow(shimmerU * shimmerV, 3.0) * u_treble * 3.5;
        segColor += vec3(1.0, 0.97, 0.90) * shimmer;

        // Beat: bright light flood from behind
        float beatFlood = u_beat * 0.9 * lightR;
        segColor += vec3(1.0, 0.94, 0.82) * beatFlood;

        // Lead lines: dark borders between segments
        float leadMask = smoothstep(0.0, 1.0, edgeDist);
        vec3 leadColor = vec3(0.015, 0.012, 0.010);
        // Treble adds subtle glow to lead lines
        leadColor += vec3(0.08, 0.06, 0.04) * u_treble;

        vec3 col;
        if (inGlass) {
          col = mix(leadColor, segColor, clamp(leadMask, 0.0, 1.0));
        } else {
          // Outside the rose window: very dark stone wall
          col = vec3(0.018, 0.014, 0.012);
          // Faint light leak at edges of window
          float wallGlow = smoothstep(0.90, 0.72, r) * u_bass * 0.15;
          col += vec3(0.4, 0.3, 0.1) * wallGlow;
        }

        // Global vignette (squared falloff)
        float vig = 1.0 - smoothstep(0.55, 1.0, length(uv));
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
window.VJamFX.presets['stained-glass-rose'] = StainedGlassRosePreset;
})();
