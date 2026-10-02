(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PlasmaGlobePreset extends BasePreset {
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
        preset._time += 0.02 + preset.audio.bass * 0.03;
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

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.2; a *= 0.5; }
        return v;
      }

      // Electric arc: high-contrast noise ridge along a direction
      float arc(vec2 uv, float angle, float seed, float t) {
        // Direction of this arc
        vec2 dir = vec2(cos(angle), sin(angle));
        // Project uv onto arc direction and perpendicular
        float along = dot(uv, dir);
        float perp = dot(uv, vec2(-dir.y, dir.x));

        // Only draw outward from center
        if (along < 0.0) return 0.0;

        // Noise-based displacement for lightning wiggle
        float wiggle = fbm(vec2(along * 8.0 + seed * 13.7, t * 2.0 + seed)) * 2.0 - 1.0;
        wiggle += noise(vec2(along * 16.0 - t * 3.0, seed * 7.3)) * 0.5 - 0.25;

        // Arc width narrows toward tip
        float width = 0.025 + 0.015 * u_bass;
        width *= smoothstep(0.8, 0.0, along); // Taper

        // Distance from arc centerline
        float d = abs(perp - wiggle * 0.12 * along);

        // Sharp bright core + softer glow
        float core = exp(-d * d / (width * width * 0.3));
        float glow = exp(-d * d / (width * width * 4.0)) * 0.4;

        // Fade at tip and near center
        float fade = smoothstep(0.0, 0.08, along) * smoothstep(0.85, 0.5, along);

        return (core + glow) * fade;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float t = u_time;
        float r = length(uv);

        // --- Dark background ---
        vec3 col = vec3(0.01, 0.005, 0.02);

        // --- Globe sphere (subtle shading) ---
        float sphereR = 0.32;
        float sphereEdge = smoothstep(sphereR + 0.02, sphereR - 0.02, r);
        // Dim inner sphere surface
        vec3 sphereCol = vec3(0.02, 0.01, 0.04) * sphereEdge;
        col += sphereCol;

        // Sphere rim glow
        float rim = smoothstep(sphereR + 0.06, sphereR - 0.01, r) * smoothstep(sphereR - 0.08, sphereR, r);
        col += rim * vec3(0.15, 0.1, 0.3) * (0.6 + u_bass * 0.4);

        // --- Electric arcs ---
        float arcCount = 5.0 + floor(u_mid * 5.0); // 5-10 arcs
        float totalArc = 0.0;
        float totalArcBlue = 0.0;

        for (int i = 0; i < 10; i++) {
          if (float(i) >= arcCount) break;
          float fi = float(i);
          // Each arc has a slowly drifting angle
          float angle = fi * 0.73 + t * (0.3 + fi * 0.07) + sin(t * 0.5 + fi * 2.1) * 0.8;
          float seed = fi + 1.0;

          float a = arc(uv, angle, seed, t);

          // Brightness variation per arc
          float brightness = 0.6 + 0.4 * sin(t * 1.5 + fi * 3.7);
          brightness *= (0.7 + u_bass * 0.6);

          totalArc += a * brightness;

          // Some arcs more blue, some more purple
          totalArcBlue += a * brightness * (0.5 + 0.5 * sin(fi * 2.3));
        }

        // Arc color: blend between electric blue and purple/white
        vec3 arcColorBlue = vec3(0.3, 0.5, 1.0);
        vec3 arcColorPurple = vec3(0.6, 0.3, 1.0);
        vec3 arcColorWhite = vec3(0.9, 0.9, 1.0);

        float blueRatio = totalArcBlue / max(totalArc, 0.001);
        vec3 arcBase = mix(arcColorPurple, arcColorBlue, blueRatio);
        // Bright cores go white
        vec3 arcCol = mix(arcBase, arcColorWhite, smoothstep(0.5, 1.5, totalArc));

        col += arcCol * totalArc;

        // --- Center glow (plasma core) ---
        float coreGlow = exp(-r * r / 0.008) * (0.5 + u_bass * 0.5 + u_beat * 0.8);
        col += vec3(0.5, 0.6, 1.0) * coreGlow;

        // Softer cyan ambient glow around center
        float ambientGlow = exp(-r * r / 0.06) * 0.15;
        col += vec3(0.2, 0.5, 0.8) * ambientGlow;

        // --- Outer glass sphere edge ---
        float outerRim = smoothstep(sphereR + 0.05, sphereR, r) * smoothstep(sphereR - 0.01, sphereR + 0.01, r);
        col += outerRim * vec3(0.15, 0.2, 0.4) * 0.5;

        // --- Beat flash ---
        float beatFlash = u_beat * exp(-r * 3.0);
        col += vec3(0.6, 0.7, 1.0) * beatFlash * 1.5;

        // Extra arcs on beat
        col += vec3(0.4, 0.5, 1.0) * u_beat * totalArc * 0.8;

        // --- Vignette (darken edges) ---
        col *= smoothstep(1.0, 0.3, r);

        // Treble: subtle sparkle at arc tips
        float sparkle = noise(uv * 30.0 + t * 5.0) * smoothstep(0.2, 0.5, r) * u_treble * 0.15;
        col += vec3(0.5, 0.7, 1.0) * sparkle * step(0.7, totalArc);

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['plasma-globe'] = PlasmaGlobePreset;
})();
