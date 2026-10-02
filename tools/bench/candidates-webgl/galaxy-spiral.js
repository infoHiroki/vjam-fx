(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GalaxySpiralPreset extends BasePreset {
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
        preset._time += 0.004 + preset.audio.bass * 0.008;
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

      // Hash functions for stars
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Value noise
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

      // FBM for nebula clouds
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p * 2.0;
          a *= 0.5;
        }
        return v;
      }

      // Background star field
      float stars(vec2 uv, float scale, float threshold) {
        vec2 id = floor(uv * scale);
        vec2 gv = fract(uv * scale) - 0.5;
        float h = hash(id);
        float h2 = hash2(id);
        // Only some cells have stars
        float star = 0.0;
        if (h > threshold) {
          vec2 offset = vec2(hash(id + 10.0), hash(id + 20.0)) - 0.5;
          float d = length(gv - offset * 0.6);
          float brightness = smoothstep(0.03, 0.0, d) * (0.5 + 0.5 * h2);
          star = brightness;
        }
        return star;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 center = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

        float r = length(center);
        float angle = atan(center.y, center.x);

        // ---- Background scattered stars ----
        float bgStars = 0.0;
        bgStars += stars(uv, 80.0, 0.85) * 0.6;
        bgStars += stars(uv + 3.7, 120.0, 0.90) * 0.4;
        bgStars += stars(uv + 7.3, 200.0, 0.92) * 0.25;
        // Treble sparkle on background stars
        float twinkle = 0.7 + 0.3 * sin(u_time * 8.0 + hash(floor(uv * 80.0)) * 30.0);
        bgStars *= twinkle * (0.6 + u_treble * 0.8);
        vec3 starColor = mix(vec3(1.0, 1.0, 0.95), vec3(0.8, 0.85, 1.0), hash(floor(uv * 80.0)));

        // ---- Spiral arms ----
        float numArms = 3.0;
        float spiralTightness = 2.5;
        float rotation = u_time * (0.3 + u_bass * 0.5);

        // Logarithmic spiral: angle = tightness * ln(r) + offset
        float spiralAngle = spiralTightness * log(max(r, 0.001)) - rotation;
        float armAngle = mod(angle - spiralAngle, 6.2831853 / numArms);
        armAngle = armAngle / (6.2831853 / numArms); // normalize to 0..1
        float armDist = abs(armAngle - 0.5); // 0 at arm center, 0.5 at edge

        // Arm shape: bright center, fading edges
        float armWidth = 0.18 + 0.04 * sin(r * 5.0 + u_time);
        float arm = smoothstep(armWidth, armWidth * 0.15, armDist);

        // Arm fades at large radius
        float radialFade = exp(-r * 1.2) * smoothstep(0.0, 0.08, r);

        // Nebula texture on arms
        vec2 nebulaCoord = center * 3.0 + vec2(u_time * 0.05);
        float nebula = fbm(nebulaCoord);
        float nebula2 = fbm(nebulaCoord * 1.5 + 5.0);

        // Dust lanes (darker regions between arms)
        float dustAngle = mod(angle - spiralAngle + 3.1415926 / numArms, 6.2831853 / numArms);
        dustAngle = dustAngle / (6.2831853 / numArms);
        float dust = smoothstep(0.35, 0.5, abs(dustAngle - 0.5));
        float dustLane = 1.0 - 0.6 * dust * smoothstep(0.0, 0.3, r) * smoothstep(1.2, 0.2, r);

        // Arm brightness modulated by mid
        float armBrightness = arm * radialFade * (0.5 + u_mid * 0.8);

        // Nebula color: blue/purple palette
        vec3 nebulaColor1 = vec3(0.15, 0.1, 0.4);  // deep purple
        vec3 nebulaColor2 = vec3(0.1, 0.2, 0.55);   // blue
        vec3 nebulaColor3 = vec3(0.3, 0.15, 0.5);   // violet
        vec3 armColor = mix(nebulaColor1, nebulaColor2, nebula);
        armColor = mix(armColor, nebulaColor3, nebula2 * 0.5);
        armColor *= 1.5 + nebula * 1.2;

        // Stars within arms
        float armStars = stars(uv + vec2(sin(r * 4.0), cos(r * 4.0)) * 0.02, 150.0, 0.75);
        armStars *= arm * radialFade;
        // Treble makes arm stars sparkle
        float armTwinkle = 0.5 + 0.5 * sin(u_time * 12.0 + hash2(floor(uv * 150.0)) * 40.0);
        armStars *= armTwinkle * (0.4 + u_treble * 1.2);
        vec3 armStarColor = mix(vec3(1.0, 0.95, 0.8), vec3(0.7, 0.8, 1.0), hash(floor(uv * 150.0)));

        // ---- Galactic core ----
        float coreGlow = exp(-r * r * 18.0) * (1.2 + u_beat * 1.5);
        float coreOuter = exp(-r * r * 5.0) * 0.5;
        vec3 coreColor = mix(vec3(1.0, 0.95, 0.7), vec3(1.0, 0.8, 0.5), r * 4.0);
        vec3 core = coreColor * (coreGlow + coreOuter);

        // Beat pulse on core
        float beatRing = exp(-pow(r - 0.1 - u_beat * 0.05, 2.0) * 200.0) * u_beat * 2.0;
        core += vec3(0.8, 0.7, 1.0) * beatRing;

        // ---- Compose ----
        vec3 col = vec3(0.0);

        // Background color (very dark blue)
        col += vec3(0.02, 0.01, 0.04);

        // Background stars
        col += starColor * bgStars;

        // Spiral arms with nebula
        col += armColor * armBrightness * dustLane;

        // Stars on arms
        col += armStarColor * armStars;

        // Galactic core
        col += core;

        // Subtle overall nebula haze
        float haze = fbm(center * 1.5 - u_time * 0.02) * 0.06;
        col += vec3(0.1, 0.05, 0.2) * haze * (1.0 + u_bass * 0.5);

        // Vignette
        float vig = 1.0 - 0.4 * dot(center, center);
        col *= max(vig, 0.0);

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
window.VJamFX.presets['galaxy-spiral'] = GalaxySpiralPreset;
})();
