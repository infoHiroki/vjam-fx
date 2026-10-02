(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class HeatDistortionPreset extends BasePreset {
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
        preset._time += 0.008 + preset.audio.mid * 0.015;
        preset.beatPulse *= 0.90;
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

      // Pseudo-random hash
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Smooth noise
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

      // FBM for organic turbulence
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = p * 2.0 + shift;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        float aspect = u_resolution.x / u_resolution.y;

        // --- Heat distortion parameters ---
        float distStrength = 0.02 + u_bass * 0.04 + u_beat * 0.06;
        float riseSpeed = u_time * (1.0 + u_mid * 2.0);

        // --- Rising heat wave layers ---
        // Layer 1: broad slow waves
        float wave1 = sin(uv.y * 8.0 - riseSpeed * 1.2 + sin(uv.x * 3.0 + u_time * 0.5) * 1.5);
        // Layer 2: medium waves
        float wave2 = sin(uv.y * 15.0 - riseSpeed * 1.8 + cos(uv.x * 5.0 - u_time * 0.7) * 1.2) * 0.6;
        // Layer 3: fine shimmer (treble-driven)
        float wave3 = sin(uv.y * 30.0 - riseSpeed * 2.5 + sin(uv.x * 10.0 + u_time * 1.3) * 0.8) * 0.3 * (0.3 + u_treble * 0.7);

        // Organic turbulence from FBM
        vec2 fbmCoord = vec2(uv.x * 3.0 * aspect, uv.y * 4.0 - riseSpeed * 0.4);
        float turb = fbm(fbmCoord) * 2.0 - 1.0;

        // Combined distortion offset (rises from bottom)
        float heatMask = smoothstep(0.0, 0.8, 1.0 - uv.y); // stronger near bottom
        float distX = (wave1 + wave2 + wave3 + turb * 0.5) * distStrength * heatMask;
        float distY = (wave2 * 0.5 + turb * 0.3) * distStrength * heatMask * 0.5;

        // Beat burst: radial wave from center-bottom
        vec2 burstCenter = vec2(0.5, 0.0);
        float burstDist = length((uv - burstCenter) * vec2(aspect, 1.0));
        float burstWave = sin(burstDist * 20.0 - u_time * 3.0) * u_beat * 0.03;
        distX += burstWave;
        distY += burstWave * 0.5;

        // Distorted UV
        vec2 dUv = uv + vec2(distX, distY);

        // --- Background gradient: dark sky to hot amber ground ---
        vec3 skyColor = vec3(0.02, 0.02, 0.06);
        vec3 midColor = vec3(0.08, 0.03, 0.01);
        vec3 groundColor = vec3(0.6, 0.25, 0.05);
        vec3 hotColor = vec3(1.0, 0.5, 0.1);

        float gy = dUv.y;
        vec3 bg = mix(hotColor, groundColor, smoothstep(0.0, 0.15, gy));
        bg = mix(bg, midColor, smoothstep(0.15, 0.55, gy));
        bg = mix(bg, skyColor, smoothstep(0.55, 1.0, gy));

        // --- Heat shimmer lines (brightness variation along waves) ---
        float shimmerLine = abs(wave1 + wave2);
        float shimmer = smoothstep(0.6, 1.0, shimmerLine) * 0.15 * heatMask;
        bg += vec3(shimmer * 1.2, shimmer * 0.8, shimmer * 0.3);

        // --- Chromatic aberration in distorted areas ---
        float aberration = distStrength * heatMask * 3.0;
        vec2 uvR = uv + vec2(distX + aberration * 0.008, distY);
        vec2 uvB = uv + vec2(distX - aberration * 0.008, distY + aberration * 0.004);

        // Re-compute background at offset UVs for color separation
        float gyR = uvR.y;
        float gyB = uvB.y;

        vec3 bgR = mix(hotColor, groundColor, smoothstep(0.0, 0.15, gyR));
        bgR = mix(bgR, midColor, smoothstep(0.15, 0.55, gyR));
        bgR = mix(bgR, skyColor, smoothstep(0.55, 1.0, gyR));

        vec3 bgB = mix(hotColor, groundColor, smoothstep(0.0, 0.15, gyB));
        bgB = mix(bgB, midColor, smoothstep(0.15, 0.55, gyB));
        bgB = mix(bgB, skyColor, smoothstep(0.55, 1.0, gyB));

        vec3 col = vec3(bgR.r, bg.g, bgB.b);

        // Add shimmer to final color
        col += vec3(shimmer * 1.2, shimmer * 0.8, shimmer * 0.3);

        // --- Rising heat particle streaks ---
        float streaks = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          vec2 sUv = vec2(uv.x * aspect * (3.0 + fi), uv.y * 5.0 - riseSpeed * (0.8 + fi * 0.3));
          float n = noise(sUv + fi * 17.3);
          float streak = smoothstep(0.72, 0.78, n) * heatMask;
          streaks += streak;
        }
        col += vec3(0.4, 0.2, 0.05) * streaks * 0.3;

        // --- Bass-reactive ground glow ---
        float groundGlow = exp(-uv.y * 4.0) * (0.3 + u_bass * 0.5);
        col += vec3(0.5, 0.15, 0.02) * groundGlow * 0.4;

        // --- Beat flash ---
        col += vec3(0.3, 0.15, 0.05) * u_beat * 0.4 * heatMask;

        // Subtle vignette
        vec2 vc = (uv - 0.5) * vec2(aspect, 1.0);
        float vig = 1.0 - 0.3 * dot(vc, vc);
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
window.VJamFX.presets['heat-distortion'] = HeatDistortionPreset;
})();
