(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Thermal Camera — Heat map visualization of audio energy.
 * Each frequency band heats a different zone. Beat = heat burst.
 * Color palette: black→blue→cyan→green→yellow→red→white (thermal LUT).
 */
class ThermalCamPreset extends BasePreset {
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
        preset._time += 0.008 + preset.audio.rms * 0.015;
        preset.beatPulse *= 0.87;

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
        for (int i = 0; i < 5; i++) { v += noise(p) * a; p *= 2.1; a *= 0.5; }
        return v;
      }

      // Thermal color LUT
      vec3 thermal(float t) {
        // black → deep blue → cyan → green → yellow → red → white
        vec3 c;
        if (t < 0.15) c = mix(vec3(0.0), vec3(0.0, 0.0, 0.4), t / 0.15);
        else if (t < 0.3) c = mix(vec3(0.0, 0.0, 0.4), vec3(0.0, 0.5, 0.7), (t - 0.15) / 0.15);
        else if (t < 0.45) c = mix(vec3(0.0, 0.5, 0.7), vec3(0.0, 0.8, 0.2), (t - 0.3) / 0.15);
        else if (t < 0.6) c = mix(vec3(0.0, 0.8, 0.2), vec3(0.9, 0.9, 0.0), (t - 0.45) / 0.15);
        else if (t < 0.8) c = mix(vec3(0.9, 0.9, 0.0), vec3(1.0, 0.2, 0.0), (t - 0.6) / 0.2);
        else c = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 1.0, 1.0), (t - 0.8) / 0.2);
        return c;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
        float t = u_time;

        // Heat sources — each band heats different locations
        // Bass: large hot spot bottom center
        vec2 bassCenter = vec2(sin(t * 0.2) * 0.3, 0.3 + u_bass * 0.1);
        float bassHeat = exp(-length(uv - bassCenter) * (2.0 - u_bass * 1.5)) * u_bass * 1.8;

        // Mid: two spots left/right
        vec2 midL = vec2(-0.3 + sin(t * 0.3) * 0.1, sin(t * 0.15) * 0.2);
        vec2 midR = vec2(0.3 + cos(t * 0.25) * 0.1, cos(t * 0.18) * 0.2);
        float midHeat = (exp(-length(uv - midL) * (3.0 - u_mid)) + exp(-length(uv - midR) * (3.0 - u_mid))) * u_mid * 1.2;

        // Treble: scattered small hot points
        float trebleHeat = 0.0;
        for (int i = 0; i < 5; i++) {
          vec2 tp = vec2(
            sin(t * 0.5 + float(i) * 1.3) * 0.5,
            cos(t * 0.4 + float(i) * 1.7) * 0.4
          );
          trebleHeat += exp(-length(uv - tp) * (5.0 - u_treble * 2.0)) * u_treble;
        }
        trebleHeat *= 0.6;

        // Combine heat
        float heat = bassHeat + midHeat + trebleHeat;

        // RMS = ambient temperature
        heat += u_rms * 0.3;

        // Beat = heat burst everywhere
        heat += u_beat * 0.5 * exp(-length(uv) * 1.5);

        // Thermal noise
        heat += fbm(uv * 8.0 + t * 0.5) * 0.08;
        heat += noise(gl_FragCoord.xy * 0.3 + t * 3.0) * 0.03;

        // Clamp and apply LUT
        heat = clamp(heat, 0.0, 1.0);
        vec3 col = thermal(heat);

        // Scanline effect (thermal camera look)
        float scan = 0.95 + 0.05 * sin(gl_FragCoord.y * 2.0);
        col *= scan;

        // Crosshair center
        float crossH = smoothstep(0.003, 0.0, abs(uv.x)) * smoothstep(0.15, 0.05, abs(uv.y));
        float crossV = smoothstep(0.003, 0.0, abs(uv.y)) * smoothstep(0.15, 0.05, abs(uv.x));
        col += vec3(1.0) * (crossH + crossV) * 0.15;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = Math.min(1, s); }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['thermal-cam'] = ThermalCamPreset;
})();
