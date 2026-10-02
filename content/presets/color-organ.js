(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Color Organ — Full-screen color fields that shift with each frequency band.
 * Inspired by Scriabin's color-music synesthesia.
 * Bass = red/warm, mid = green/cyan, treble = blue/violet. Beat = white flash.
 * Pure color experience — no shapes, just light.
 */
class ColorOrganPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL);
        p.pixelDensity(1);
      };

      p.draw = () => {
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }
        preset._time += 0.008 + preset.audio.rms * 0.02;
        preset.beatPulse *= 0.85;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
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
      uniform float u_rms;
      uniform float u_beat;
      uniform vec2 u_resolution;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += noise(p) * a; p *= 2.1; a *= 0.5; }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
        float t = u_time;

        // Flowing color fields — each band gets its own region
        vec2 bassFlow = uv + vec2(sin(t * 0.3), cos(t * 0.2)) * 0.4;
        vec2 midFlow = uv + vec2(cos(t * 0.25 + 2.0), sin(t * 0.35 + 1.0)) * 0.3;
        vec2 trebleFlow = uv + vec2(sin(t * 0.4 + 4.0), cos(t * 0.3 + 3.0)) * 0.35;

        float bassField = fbm(bassFlow * 2.0 + t * 0.15);
        float midField = fbm(midFlow * 2.5 + t * 0.2);
        float trebleField = fbm(trebleFlow * 3.0 + t * 0.25);

        // Bass = warm (red/orange/amber)
        vec3 bassColor = mix(
          vec3(0.6, 0.05, 0.0),
          vec3(1.0, 0.4, 0.05),
          bassField
        ) * u_bass * 2.5;

        // Mid = cool-warm (green/cyan/teal)
        vec3 midColor = mix(
          vec3(0.0, 0.4, 0.3),
          vec3(0.1, 0.9, 0.6),
          midField
        ) * u_mid * 2.0;

        // Treble = cool (blue/violet/magenta)
        vec3 trebleColor = mix(
          vec3(0.1, 0.0, 0.5),
          vec3(0.5, 0.2, 0.9),
          trebleField
        ) * u_treble * 2.5;

        // Combine additively
        vec3 col = bassColor + midColor + trebleColor;

        // RMS = overall brightness breathing
        col *= 0.4 + u_rms * 1.5;

        // Beat = white flash with chromatic aberration
        float flash = u_beat * u_beat;
        col += vec3(1.0) * flash * 0.8;

        // Subtle structure — large soft blobs
        float structure = fbm(uv * 1.5 + t * 0.08);
        col *= 0.7 + structure * 0.5;

        // Auto animation when no audio
        float autoBase = sin(t * 0.8) * 0.5 + 0.5;
        float autoMid = sin(t * 1.2 + 1.0) * 0.5 + 0.5;
        float autoTreb = sin(t * 2.0 + 2.0) * 0.5 + 0.5;
        float autoLevel = step(u_bass + u_mid + u_treble, 0.05);
        col += (vec3(0.5, 0.05, 0.0) * autoBase + vec3(0.0, 0.3, 0.2) * autoMid + vec3(0.1, 0.0, 0.4) * autoTreb) * autoLevel * 0.5;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = Math.min(1, s); }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['color-organ'] = ColorOrganPreset;
})();
