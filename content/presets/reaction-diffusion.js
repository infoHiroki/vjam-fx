(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ReactionDiffusionPreset extends BasePreset {
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
        preset._time += 0.015 + preset.audio.bass * 0.02;
        preset.beatPulse *= 0.93;
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
    // Simulated reaction-diffusion via procedural noise (no framebuffer needed)
    const frag = `
      precision highp float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }

      // Turing pattern approximation via layered noise
      float turingPattern(vec2 p, float t) {
        float scale1 = 8.0 + u_mid * 4.0;
        float scale2 = 16.0 + u_treble * 8.0;

        // Activator (broad, slow)
        float activator = noise(p * scale1 + t * 0.3);
        activator += noise(p * scale1 * 0.5 + t * 0.2 + 5.0) * 0.5;

        // Inhibitor (fine, fast)
        float inhibitor = noise(p * scale2 + t * 0.5 + 10.0);
        inhibitor += noise(p * scale2 * 0.7 + t * 0.4 + 15.0) * 0.5;

        // Reaction: activator - inhibitor creates pattern
        float reaction = activator - inhibitor * 0.8;

        // Sharp threshold for organic spots/stripes
        return smoothstep(-0.1 + u_bass * 0.15, 0.1, reaction);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float t = u_time;

        // Slowly deforming coordinate space
        vec2 p = uv;
        p += vec2(sin(t * 0.1 + uv.y * 2.0), cos(t * 0.08 + uv.x * 2.0)) * 0.05;

        // Bass: coordinate breathing
        p *= 1.0 + sin(t * 0.2) * 0.1 + u_bass * 0.1;

        // Multiple scales of Turing patterns
        float pat1 = turingPattern(p, t);
        float pat2 = turingPattern(p * 1.5 + 3.0, t * 0.8);
        float pat3 = turingPattern(p * 0.7 + 7.0, t * 1.2);

        // Combine at different weights
        float pattern = pat1 * 0.5 + pat2 * 0.3 + pat3 * 0.2;

        // Color: organic tones that shift with time
        vec3 colA = 0.5 + 0.5 * cos(t * 0.15 + vec3(0.0, 0.5, 1.0));
        vec3 colB = 0.5 + 0.5 * cos(t * 0.15 + vec3(2.0, 3.0, 4.0));

        vec3 col = mix(colA * 0.15, colB, pattern);

        // Edge glow at pattern boundary
        float edge = abs(pat1 - 0.5);
        float edgeGlow = smoothstep(0.15, 0.0, edge);
        col += edgeGlow * colB * 0.4 * (1.0 + u_mid);

        // Beat: pattern inversion flash
        col = mix(col, 1.0 - col, u_beat * 0.3);

        // Brightness
        col *= 0.9 + u_bass * 0.15;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['reaction-diffusion'] = ReactionDiffusionPreset;
})();
