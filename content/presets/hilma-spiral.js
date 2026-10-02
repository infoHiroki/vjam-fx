(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class HilmaSpiralPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
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
        preset._time += 0.008 + preset._sMid * 0.012;
        preset.beatPulse *= 0.90;
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
      precision highp float;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      // Value noise
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
        return v;
      }

      // Soft pastel palette: peach, sage, dusty rose, cream, golden ochre
      vec3 pastelColor(float t) {
        // 5 anchor colours cycled via smooth interpolation
        float s = fract(t) * 5.0;
        float idx = floor(s);
        float f   = fract(s);
        f = f * f * (3.0 - 2.0 * f); // smoothstep

        vec3 c0, c1;
        if (idx < 1.0) {
          c0 = vec3(0.96, 0.78, 0.68); // peach
          c1 = vec3(0.72, 0.82, 0.70); // sage green
        } else if (idx < 2.0) {
          c0 = vec3(0.72, 0.82, 0.70); // sage green
          c1 = vec3(0.84, 0.70, 0.74); // dusty rose
        } else if (idx < 3.0) {
          c0 = vec3(0.84, 0.70, 0.74); // dusty rose
          c1 = vec3(0.95, 0.92, 0.82); // cream
        } else if (idx < 4.0) {
          c0 = vec3(0.95, 0.92, 0.82); // cream
          c1 = vec3(0.84, 0.66, 0.28); // golden ochre
        } else {
          c0 = vec3(0.84, 0.66, 0.28); // golden ochre
          c1 = vec3(0.96, 0.78, 0.68); // back to peach
        }
        return mix(c0, c1, f);
      }

      // Logarithmic spiral SDF: returns proximity to spiral arm
      // a = scale, b = tightness, armOffset = which arm (0..N-1)
      float spiralArm(vec2 uv, float a, float b, float angleOffset, float rot) {
        float r   = length(uv);
        float phi = atan(uv.y, uv.x) + rot + angleOffset;

        // Canonical log-spiral: r = a * exp(b * phi)
        // Invert: phi_n = (log(r/a)) / b
        // Distance to nearest arm: |phi - phi_n - 2*pi*k| minimised over integer k
        float phiN = (r > 0.0001) ? log(r / a) / b : 0.0;
        float diff = mod(phi - phiN + 3.14159, 6.28318) - 3.14159;

        // Convert angular difference to approximate arc distance
        return abs(diff) * r;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Bass controls scale/expansion; beat causes an outward bloom
        float expansion = 1.0 + u_bass * 0.4 + u_beat * 0.25;
        uv /= expansion;

        // Slight organic warp via fbm
        float warpAmt = 0.04 + u_treble * 0.02;
        vec2 warpUV = uv + warpAmt * vec2(fbm(uv * 3.0 + u_time * 0.2) - 0.5,
                           fbm(uv * 3.0 + 1.7 + u_time * 0.2) - 0.5);

        // Spiral parameters
        float a = 0.08;   // initial radius
        float b = 0.22;   // growth rate per radian

        // Mid controls rotation speed
        float rotSpeed = 0.25 + u_mid * 0.35;

        vec3 col = vec3(0.06, 0.05, 0.04); // dark warm background

        // Draw 4 layered spirals, each with a different arm count,
        // rotation offset, colour offset, and opacity
        for (int s = 0; s < 4; s++) {
          float sf     = float(s);
          float arms   = 2.0 + sf;           // 2, 3, 4, 5 arms
          float rotOff = sf * 1.1;            // phase offset
          float speed  = rotSpeed * (0.6 + sf * 0.15);
          float rot    = u_time * speed + rotOff;
          float bScale = 0.18 + sf * 0.04;   // each spiral slightly tighter

          float minDist = 1e9;
          for (float k = 0.0; k < 5.0; k++) {
            if (k >= arms) break;
            float armAngle = k * 6.28318 / arms;
            float d = spiralArm(warpUV, a, bScale, armAngle, rot);
            minDist = min(minDist, d);
          }

          // Soft brush stroke width
          float strokeW = 0.012 + sf * 0.004 + u_bass * 0.008;
          float glow    = exp(-minDist * minDist / (strokeW * strokeW));
          float soft    = smoothstep(strokeW * 2.5, 0.0, minDist) * 0.6;

          // Colour: cycle through pastel palette, unique per spiral
          float colorT = sf * 0.22 + u_time * 0.04 + u_mid * 0.1;
          vec3 spiralCol = pastelColor(colorT);

          // Fade toward the centre (inner calm) and edges
          float r = length(warpUV);
          float radFade = smoothstep(0.0, 0.12, r) * (1.0 - smoothstep(0.55, 0.72, r));

          col += spiralCol * (glow + soft) * radFade * (0.55 - sf * 0.05);
        }

        // Golden shimmer layer driven by treble
        if (u_treble > 0.05) {
          float shimmerN = fbm(warpUV * 12.0 + u_time * 0.8);
          float shimmer  = pow(shimmerN, 3.0) * u_treble * 1.4;
          col += vec3(0.95, 0.80, 0.35) * shimmer;
        }

        // Beat bloom: warm golden radial pulse
        float r2 = length(warpUV);
        float bloom = u_beat * exp(-r2 * r2 * 6.0) * 0.5;
        col += vec3(0.98, 0.88, 0.55) * bloom;

        // Soft vignette for spiritual depth
        float vig = 1.0 - dot(uv, uv) * 1.1;
        col *= clamp(vig, 0.0, 1.0);

        // Warm ambient lift
        col += vec3(0.04, 0.03, 0.02);

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
window.VJamFX.presets['hilma-spiral'] = HilmaSpiralPreset;
})();
