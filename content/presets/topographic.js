(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Topographic — Animated contour map with elevation changes driven by audio.
 * Bass raises terrain, treble adds ridges, beat triggers earthquake deformation.
 * Color shifts from deep blue (low) to white (high).
 */
class TopographicPreset extends BasePreset {
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
        preset._time += 0.006 + preset.audio.rms * 0.015;
        preset.beatPulse *= 0.88;

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
        for (int i = 0; i < 6; i++) { v += noise(p) * a; p *= 2.05; a *= 0.5; }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
        float t = u_time;

        // Terrain generation — bass raises mountains
        vec2 p = uv * (2.5 + u_mid);
        p += vec2(sin(t * 0.15), cos(t * 0.12)) * 0.5;

        // Beat: earthquake deformation
        p += vec2(sin(p.y * 8.0 + t * 5.0), cos(p.x * 8.0 + t * 5.0)) * u_beat * 0.15;

        float elevation = fbm(p) * (0.5 + u_bass * 1.5);
        // Treble adds high-frequency ridges
        elevation += fbm(p * 4.0 + t * 0.3) * u_treble * 0.6;
        // Mid shifts the base level
        elevation += sin(p.x * 3.0 + t * 0.4) * sin(p.y * 3.0 + t * 0.3) * u_mid * 0.25;

        // Contour lines
        float contourSpacing = 10.0 + u_bass * 8.0;
        float contourLine = abs(fract(elevation * contourSpacing) - 0.5);
        float isContour = 1.0 - smoothstep(0.0, 0.06 + u_rms * 0.04, contourLine);

        // Major contour every 5th line
        float majorLine = abs(fract(elevation * contourSpacing / 5.0) - 0.5);
        float isMajor = 1.0 - smoothstep(0.0, 0.04, majorLine);

        // Hypsometric color — elevation to color
        vec3 deepWater = vec3(0.02, 0.05, 0.2);
        vec3 shallowWater = vec3(0.05, 0.15, 0.35);
        vec3 lowland = vec3(0.12, 0.3, 0.1);
        vec3 highland = vec3(0.5, 0.35, 0.15);
        vec3 mountain = vec3(0.7, 0.6, 0.5);
        vec3 snow = vec3(0.95, 0.95, 1.0);

        float e = clamp(elevation, 0.0, 1.0);
        vec3 terrainCol;
        if (e < 0.2) terrainCol = mix(deepWater, shallowWater, e / 0.2);
        else if (e < 0.35) terrainCol = mix(shallowWater, lowland, (e - 0.2) / 0.15);
        else if (e < 0.55) terrainCol = mix(lowland, highland, (e - 0.35) / 0.2);
        else if (e < 0.75) terrainCol = mix(highland, mountain, (e - 0.55) / 0.2);
        else terrainCol = mix(mountain, snow, (e - 0.75) / 0.25);

        // Color shift with audio — bass warms, treble cools
        terrainCol += vec3(0.15, 0.05, -0.05) * u_bass;
        terrainCol += vec3(-0.05, 0.0, 0.15) * u_treble;

        // Apply contour lines
        vec3 contourCol = vec3(0.1, 0.08, 0.05);
        vec3 majorCol = vec3(0.02);
        vec3 col = terrainCol;
        col = mix(col, contourCol, isContour * 0.6);
        col = mix(col, majorCol, isMajor * 0.8);

        // Beat flash — topo paper flash
        col += vec3(0.2, 0.18, 0.12) * u_beat * 0.5;

        // RMS brightness
        col *= 0.7 + u_rms * 0.8;

        // Paper texture
        col *= 0.92 + noise(gl_FragCoord.xy * 0.3) * 0.12;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = Math.min(1, s); }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['topographic'] = TopographicPreset;
})();
