(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SunSurfacePreset extends BasePreset {
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
        preset._time += 0.015 + preset.audio.bass * 0.025;
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
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      // Hash and noise functions
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }

      // FBM — 4 octaves max for performance
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
        return v;
      }

      // Voronoi for granulation cells
      float voronoi(vec2 p) {
        vec2 ip = floor(p);
        vec2 fp = fract(p);
        float minDist = 1.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 cell = ip + neighbor;
            vec2 rnd = vec2(hash(cell), hash(cell + vec2(37.0, 91.0)));
            vec2 point = neighbor + 0.5 + 0.4 * sin(u_time * 0.3 + rnd * 6.28);
            float d = length(fp - point);
            minDist = min(minDist, d);
          }
        }
        return minDist;
      }

      // Sun color ramp: black -> deep red -> orange -> yellow -> white
      vec3 sunColor(float t) {
        vec3 c;
        if (t < 0.2) {
          c = mix(vec3(0.05, 0.0, 0.0), vec3(0.6, 0.05, 0.0), t / 0.2);
        } else if (t < 0.45) {
          c = mix(vec3(0.6, 0.05, 0.0), vec3(1.0, 0.4, 0.0), (t - 0.2) / 0.25);
        } else if (t < 0.7) {
          c = mix(vec3(1.0, 0.4, 0.0), vec3(1.0, 0.85, 0.2), (t - 0.45) / 0.25);
        } else {
          c = mix(vec3(1.0, 0.85, 0.2), vec3(1.0, 1.0, 0.95), (t - 0.7) / 0.3);
        }
        return c;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        float aspect = u_resolution.x / u_resolution.y;
        vec2 st = uv;
        st.x *= aspect;
        float t = u_time;

        // === Granulation (convection cells) ===
        float cellScale = 8.0 + u_treble * 2.0;
        float cells = voronoi(st * cellScale);
        float granulation = smoothstep(0.0, 0.35, cells);

        // === Turbulent plasma (FBM) ===
        float turbulence = u_bass * 0.5 + 0.3;
        vec2 fbmCoord = st * 3.5 + vec2(t * 0.08, t * 0.06);
        float plasma1 = fbm(fbmCoord + fbm(fbmCoord + t * 0.05) * turbulence);
        float plasma2 = fbm(fbmCoord * 1.5 - vec2(t * 0.1, t * 0.07));
        float plasma = plasma1 * 0.65 + plasma2 * 0.35;

        // === Sunspots (slowly drifting dark regions) ===
        vec2 spotUV = st * 2.0 + vec2(t * 0.01, t * 0.008);
        float spotNoise = fbm(spotUV);
        float spot = smoothstep(0.62, 0.68, spotNoise);
        spot *= smoothstep(0.68, 0.62, spotNoise - 0.06);
        float sunspot = 1.0 - spot * 0.7;

        // === Combine surface intensity ===
        float intensity = plasma * 0.6 + granulation * 0.4;
        intensity *= sunspot;
        intensity = clamp(intensity, 0.0, 1.0);

        // Boost hot spots
        intensity = pow(intensity, 0.85);

        // Base color from ramp
        vec3 col = sunColor(intensity);

        // === Solar flares (arcs from edges) ===
        vec2 center = vec2(aspect * 0.5, 0.5);
        float dist = length(st - center) / (0.5 * aspect);

        // Flare arcs driven by mid and beat
        float flareActivity = u_mid * 0.6 + u_beat * 0.8;
        float angle = atan(st.y - 0.5, st.x - center.x);
        float flareNoise = fbm(vec2(angle * 2.0, t * 0.2) * 3.0);
        float flareShape = smoothstep(0.7, 0.9, dist) * smoothstep(1.3, 0.85, dist);
        float flare = flareShape * flareNoise * flareActivity;

        // Flare color — brighter yellow-white
        vec3 flareCol = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 1.0, 0.8), flareNoise);
        col += flareCol * flare * 1.5;

        // === Beat: bright solar burst ===
        float burstAngle = noise(vec2(floor(t * 0.5), 0.0)) * 6.28;
        vec2 burstDir = vec2(cos(burstAngle), sin(burstAngle));
        float burstAlign = max(0.0, dot(normalize(st - center), burstDir));
        float burst = u_beat * burstAlign * burstAlign * smoothstep(0.5, 0.8, dist) * smoothstep(1.2, 0.85, dist);
        col += vec3(1.0, 0.95, 0.7) * burst * 2.5;

        // === Corona glow at edges ===
        float corona = smoothstep(0.6, 1.0, dist) * smoothstep(1.4, 0.9, dist);
        float coronaFlicker = 0.8 + 0.2 * sin(angle * 6.0 + t * 1.5) * sin(angle * 10.0 - t * 2.0);
        corona *= coronaFlicker;
        vec3 coronaCol = mix(vec3(1.0, 0.6, 0.1), vec3(1.0, 0.9, 0.5), corona);
        col += coronaCol * corona * (0.4 + u_mid * 0.3);

        // === Overall brightness from bass ===
        col *= 0.95 + u_bass * 0.2;

        // Vignette — darken far edges beyond corona
        float vignette = smoothstep(1.5, 0.7, dist);
        col *= vignette;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['sun-surface'] = SunSurfacePreset;
})();
