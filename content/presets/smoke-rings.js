(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SmokeRingsPreset extends BasePreset {
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

      // Hash-based noise
      float hash(vec3 p) {
        p = fract(p * vec3(443.897, 441.423, 437.195));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }

      float noise3d(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash(i);
        float n100 = hash(i + vec3(1,0,0));
        float n010 = hash(i + vec3(0,1,0));
        float n110 = hash(i + vec3(1,1,0));
        float n001 = hash(i + vec3(0,0,1));
        float n101 = hash(i + vec3(1,0,1));
        float n011 = hash(i + vec3(0,1,1));
        float n111 = hash(i + vec3(1,1,1));
        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        float nxy0 = mix(nx00, nx10, f.y);
        float nxy1 = mix(nx01, nx11, f.y);
        return mix(nxy0, nxy1, f.z);
      }

      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * noise3d(p);
          p *= 2.1;
          a *= 0.5;
        }
        return v;
      }

      // Torus SDF: torus at origin with major radius R and minor radius r
      float sdTorus(vec3 p, float R, float r) {
        vec2 q = vec2(length(p.xz) - R, p.y);
        return length(q) - r;
      }

      // Rotation around Y axis
      vec3 rotY(vec3 p, float a) {
        float c = cos(a), s = sin(a);
        return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
      }

      // Rotation around X axis
      vec3 rotX(vec3 p, float a) {
        float c = cos(a), s = sin(a);
        return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
      }

      // Pinball bounce: triangle wave that bounces between -range and +range
      float bounce(float t, float range) {
        return abs(mod(t, range * 4.0) - range * 2.0) - range;
      }

      // Scene: multiple smoke rings with pinball-style bouncing
      // Noise only applied when close to surface (saves GPU)
      float scene(vec3 p, float time, float bass, float mid, float beat) {
        float ringSize = 1.0 + bass * 0.5 + beat * 0.8;
        float thickness = 0.15 + bass * 0.12 + beat * 0.2;
        float turbulence = 0.2 + mid * 0.4;

        // Ring 1
        vec3 pos1 = vec3(bounce(time * 0.37, 1.5), bounce(time * 0.29 + 1.7, 1.0), bounce(time * 0.23 + 0.5, 0.8));
        vec3 p1 = rotX(rotY(p - pos1, time * 0.2), 0.3 + sin(time * 0.15) * 0.2);
        float d1 = sdTorus(p1, ringSize, thickness);
        if (d1 < 0.5) d1 = sdTorus(p1 + noise3d(p1 * 2.0 + time * 0.4) * turbulence * 0.3, ringSize, thickness);

        // Ring 2
        vec3 pos2 = vec3(bounce(time * 0.31 + 3.1, 1.3), bounce(time * 0.43 + 0.8, 1.1), bounce(time * 0.19 + 2.3, 0.7));
        vec3 p2 = rotX(rotY(p - pos2, -time * 0.15 + 1.0), -0.4 + cos(time * 0.2) * 0.25);
        float d2 = sdTorus(p2, ringSize * 0.75, thickness * 0.8);
        if (d2 < 0.5) d2 = sdTorus(p2 + noise3d(p2 * 2.2 - time * 0.35) * turbulence * 0.3, ringSize * 0.75, thickness * 0.8);

        // Ring 3
        vec3 pos3 = vec3(bounce(time * 0.47 + 5.2, 1.4), bounce(time * 0.33 + 2.1, 0.9), bounce(time * 0.27 + 4.0, 0.6));
        vec3 p3 = rotX(rotY(p - pos3, time * 0.35 + 2.5), 0.6 + sin(time * 0.18 + 1.0) * 0.3);
        float d3 = sdTorus(p3, ringSize * 0.55, thickness * 0.7);
        if (d3 < 0.5) d3 = sdTorus(p3 + noise3d(p3 * 1.8 + time * 0.5) * turbulence * 0.25, ringSize * 0.55, thickness * 0.7);

        return min(d1, min(d2, d3));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Camera
        vec3 ro = vec3(0.0, 0.0, -3.5);
        vec3 rd = normalize(vec3(uv, 1.2));

        // Volumetric accumulation
        float density = 0.0;
        vec3 col = vec3(0.0);
        float t = 0.5;
        float stepSize = 0.1;
        float smokeOpacity = 0.8 + u_treble * 0.5;

        for (int i = 0; i < 30; i++) {
          vec3 pos = ro + rd * t;
          float d = scene(pos, u_time, u_bass, u_mid, u_beat);

          if (d < stepSize * 2.0) {
            // Inside or near smoke — much higher density
            float smokeDensity = smoothstep(stepSize * 2.0, -0.15, d) * 0.3 * smokeOpacity;

            // Single noise for color variation (no FBM)
            float cn = noise3d(pos * 1.5 + u_time * 0.2);

            // Vivid blue/purple/cyan palette
            vec3 smokeCol = mix(
              vec3(0.4, 0.5, 0.9),     // bright blue
              vec3(0.7, 0.3, 0.85),    // vivid purple
              cn
            );

            // Warm highlight from noise peaks
            smokeCol += vec3(0.3, 0.15, 0.05) * smoothstep(0.5, 0.8, cn);

            // Cyan rim light at edges
            float rim = smoothstep(-0.05, stepSize * 1.5, d);
            smokeCol += vec3(0.3, 0.7, 1.0) * rim * 0.5;

            // Self-illumination: smoke glows brighter near center
            float glow = exp(-d * 8.0) * 0.4;
            smokeCol += vec3(0.6, 0.4, 0.9) * glow;

            // Beat flash: bright cyan/white pulse
            smokeCol += vec3(0.8, 0.9, 1.0) * u_beat * 1.0;

            // Bass makes smoke brighter
            smokeCol *= 1.0 + u_bass * 0.6;

            // Accumulate
            float alpha = smokeDensity * (1.0 - density);
            col += smokeCol * alpha;
            density += alpha;

            if (density > 0.95) break;
          }

          t += max(d * 0.4, stepSize);
          if (t > 8.0) break;
        }

        // Background: dark with subtle purple gradient
        vec3 bg = vec3(0.03, 0.02, 0.06) + vec3(0.03, 0.01, 0.05) * (1.0 - length(uv) * 0.5);
        col = mix(bg, col, min(density, 1.0));

        // Boost overall brightness
        col *= 1.5;

        // Slight vignette
        float vig = 1.0 - dot(uv, uv) * 0.2;
        col *= vig;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['smoke-rings'] = SmokeRingsPreset;
})();
