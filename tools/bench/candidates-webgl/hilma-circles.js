(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class HilmaCirclesPreset extends BasePreset {
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
        preset._time += 0.022 + preset._sMid * 0.018;
        preset.beatPulse *= 0.88;
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

      // Smooth noise for organic drift
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

      // Draw a single soft circle/oval
      // Returns blended color contribution and alpha
      vec4 softCircle(vec2 uv, vec2 center, float rx, float ry, vec3 color, float opacity) {
        vec2 delta = (uv - center) / vec2(rx, ry);
        float dist = length(delta);
        // Soft gradient edge: fully opaque at center, fades at edge
        float alpha = smoothstep(1.0, 0.0, dist) * smoothstep(1.0, 0.4, dist) * 2.0;
        alpha = clamp(alpha, 0.0, 1.0);
        // Radial gradient within circle: slightly lighter at center
        float radGrad = 1.0 - dist * 0.4;
        vec3 col = color * (0.8 + radGrad * 0.4);
        return vec4(col, alpha * opacity);
      }

      // Blend a circle onto accumulated color using soft over-compositing
      vec3 blendCircle(vec3 base, vec4 circle) {
        return mix(base, circle.rgb, circle.a * 0.65);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        float t = u_time;
        float bass = u_bass;
        float mid = u_mid;
        float treble = u_treble;
        float beat = u_beat;

        // Dark warm background — trail/afterimage: fade toward bg instead of hard clear
        vec3 bg = vec3(0.12, 0.10, 0.14);

        // Global swirl rotation driven by time + bass
        float swirlAngle = t * 0.08 + bass * 0.4;
        float cs = cos(swirlAngle);
        float sn = sin(swirlAngle);
        vec2 swirlUv = vec2(uv.x * cs - uv.y * sn, uv.x * sn + uv.y * cs);
        // Blend between original and swirled UV so circles orbit visibly
        vec2 ruv = mix(uv, swirlUv, 0.35 + bass * 0.15);

        vec3 col = bg;

        // Breathing scale from bass — much more dramatic
        float breathe = 1.0 + bass * 0.45 + beat * 0.25;

        // Drift amplitude: 3-4x larger, strongly audio-driven
        float driftAmp = 0.16 + mid * 0.22 + bass * 0.12;

        // Extra size pulse from beat
        float sizePulse = 1.0 + beat * 0.35;

        // --- Circle 1: Warm pink, large, upper-left drift ---
        {
          float px = -0.28 + sin(t * 0.31) * driftAmp + noise(vec2(t * 0.11, 0.0)) * driftAmp * 0.7;
          float py =  0.15 + cos(t * 0.27) * driftAmp + noise(vec2(0.0, t * 0.09)) * driftAmp * 0.7;
          float rx = (0.38 + noise(vec2(t * 0.07, 1.0)) * 0.09 + bass * 0.12) * breathe * sizePulse;
          float ry = (0.32 + noise(vec2(t * 0.08, 2.0)) * 0.09 + bass * 0.10) * breathe * sizePulse;
          vec3 color = vec3(0.85, 0.35, 0.45) + treble * vec3(0.15, 0.05, 0.08) + beat * vec3(0.2, 0.0, 0.1);
          vec4 c = softCircle(ruv, vec2(px, py), rx, ry, color, 0.82);
          col = blendCircle(col, c);
        }

        // --- Circle 2: Soft sky blue, large, right side ---
        {
          float px = 0.30 + cos(t * 0.23) * driftAmp + noise(vec2(t * 0.13, 3.0)) * driftAmp * 0.7;
          float py = 0.05 + sin(t * 0.19) * driftAmp + noise(vec2(3.0, t * 0.12)) * driftAmp * 0.7;
          float rx = (0.35 + noise(vec2(t * 0.06, 4.0)) * 0.10 + mid * 0.10) * breathe * sizePulse;
          float ry = (0.40 + noise(vec2(t * 0.07, 5.0)) * 0.08 + mid * 0.08) * breathe * sizePulse;
          vec3 color = vec3(0.25, 0.50, 0.80) + treble * vec3(0.05, 0.12, 0.18) + beat * vec3(0.0, 0.1, 0.2);
          vec4 c = softCircle(ruv, vec2(px, py), rx, ry, color, 0.78);
          col = blendCircle(col, c);
        }

        // --- Circle 3: Golden yellow, medium, upper-center ---
        {
          float px = 0.02 + sin(t * 0.17 + 1.2) * driftAmp + noise(vec2(t * 0.10, 6.0)) * driftAmp * 0.6;
          float py = 0.28 + cos(t * 0.21 + 0.5) * driftAmp + noise(vec2(6.0, t * 0.11)) * driftAmp * 0.6;
          float rx = (0.26 + noise(vec2(t * 0.09, 7.0)) * 0.08 + treble * 0.10) * breathe * sizePulse;
          float ry = (0.22 + noise(vec2(t * 0.08, 8.0)) * 0.07 + treble * 0.08) * breathe * sizePulse;
          vec3 color = vec3(0.85, 0.75, 0.30) + treble * vec3(0.12, 0.10, 0.04) + beat * vec3(0.15, 0.1, 0.0);
          vec4 c = softCircle(ruv, vec2(px, py), rx, ry, color, 0.80);
          col = blendCircle(col, c);
        }

        // --- Circle 4: Mint green, medium, lower-left ---
        {
          float px = -0.22 + cos(t * 0.29 + 2.1) * driftAmp + noise(vec2(t * 0.12, 9.0)) * driftAmp * 0.8;
          float py = -0.24 + sin(t * 0.25 + 1.8) * driftAmp + noise(vec2(9.0, t * 0.14)) * driftAmp * 0.8;
          float rx = (0.30 + noise(vec2(t * 0.07, 10.0)) * 0.09 + mid * 0.09) * breathe * sizePulse;
          float ry = (0.28 + noise(vec2(t * 0.09, 11.0)) * 0.08 + mid * 0.08) * breathe * sizePulse;
          vec3 color = vec3(0.20, 0.65, 0.45) + treble * vec3(0.05, 0.15, 0.08) + beat * vec3(0.0, 0.2, 0.05);
          vec4 c = softCircle(ruv, vec2(px, py), rx, ry, color, 0.78);
          col = blendCircle(col, c);
        }

        // --- Circle 5: Lavender, medium-large, lower-right ---
        {
          float px = 0.24 + sin(t * 0.22 + 3.3) * driftAmp + noise(vec2(t * 0.11, 12.0)) * driftAmp * 0.7;
          float py = -0.20 + cos(t * 0.26 + 2.7) * driftAmp + noise(vec2(12.0, t * 0.10)) * driftAmp * 0.7;
          float rx = (0.32 + noise(vec2(t * 0.08, 13.0)) * 0.10 + bass * 0.09) * breathe * sizePulse;
          float ry = (0.30 + noise(vec2(t * 0.07, 14.0)) * 0.08 + bass * 0.08) * breathe * sizePulse;
          vec3 color = vec3(0.55, 0.35, 0.80) + treble * vec3(0.10, 0.04, 0.15) + beat * vec3(0.1, 0.0, 0.2);
          vec4 c = softCircle(ruv, vec2(px, py), rx, ry, color, 0.82);
          col = blendCircle(col, c);
        }

        // --- Circle 6: Peach/rose, small accent, center ---
        {
          float px = 0.06 + cos(t * 0.35 + 4.5) * driftAmp * 0.9 + noise(vec2(t * 0.14, 15.0)) * driftAmp;
          float py = -0.04 + sin(t * 0.32 + 3.9) * driftAmp * 0.9 + noise(vec2(15.0, t * 0.13)) * driftAmp;
          float rx = (0.20 + noise(vec2(t * 0.10, 16.0)) * 0.07 + treble * 0.10) * breathe * sizePulse;
          float ry = (0.18 + noise(vec2(t * 0.09, 17.0)) * 0.06 + treble * 0.08) * breathe * sizePulse;
          vec3 color = vec3(0.80, 0.45, 0.35) + treble * vec3(0.15, 0.08, 0.05) + beat * vec3(0.2, 0.05, 0.0);
          vec4 c = softCircle(ruv, vec2(px, py), rx, ry, color, 0.75);
          col = blendCircle(col, c);
        }

        // --- Circle 7: Pale teal, small accent, upper-right ---
        {
          float px = 0.38 + sin(t * 0.28 + 1.7) * driftAmp * 0.85 + noise(vec2(t * 0.12, 18.0)) * driftAmp;
          float py = 0.30 + cos(t * 0.24 + 2.3) * driftAmp * 0.85 + noise(vec2(18.0, t * 0.11)) * driftAmp;
          float rx = (0.16 + noise(vec2(t * 0.09, 19.0)) * 0.06 + mid * 0.08) * breathe * sizePulse;
          float ry = (0.20 + noise(vec2(t * 0.08, 20.0)) * 0.06 + mid * 0.07) * breathe * sizePulse;
          vec3 color = vec3(0.15, 0.60, 0.65) + treble * vec3(0.04, 0.15, 0.15) + beat * vec3(0.0, 0.15, 0.2);
          vec4 c = softCircle(ruv, vec2(px, py), rx, ry, color, 0.72);
          col = blendCircle(col, c);
        }

        // Treble luminosity: clearly visible brightening
        col += treble * 0.18 * vec3(1.0, 0.98, 0.95);

        // Beat: strong flash pulse from center
        float beatDist = length(uv);
        float beatGlow = beat * exp(-beatDist * 1.8) * 0.55;
        col += beatGlow * vec3(1.0, 0.94, 0.88);

        // Additive overlap boost — vivid color mixing where circles meet
        // Desaturate slightly toward white at high overall brightness (bloom-like)
        float brightness = dot(col, vec3(0.333));
        col = mix(col, vec3(brightness) * 1.2, clamp((brightness - 0.6) * 1.5, 0.0, 0.4));

        // Soft vignette to frame the composition
        float vig = 1.0 - dot(uv * 0.7, uv * 0.7);
        vig = clamp(vig, 0.0, 1.0);
        col = mix(vec3(0.05, 0.04, 0.08), col, 0.7 + vig * 0.3);

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
window.VJamFX.presets['hilma-circles'] = HilmaCirclesPreset;
})();
