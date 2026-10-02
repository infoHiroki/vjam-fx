(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class StormCellPreset extends BasePreset {
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
        p.createCanvas(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight, p.WEBGL);
        p.pixelDensity(1);
      };

      p.draw = () => {
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }

        preset._time += 0.013 + preset.audio.bass * 0.015 + preset.audio.treble * 0.008;
        preset.beatPulse *= 0.85;

        p.background(0);

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
        } catch (_) {
        } finally {
          p.resetShader();
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
      };
    }, container);
  }

  _initShader(p) {
    const vert = `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vUv;

void main() {
        vUv = aTexCoord;
        vec4 pos = vec4(aPosition, 1.0);
        pos.xy = pos.xy * 2.0 - 1.0;
        gl_Position = pos;
      }
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

      mat2 rot(float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c);
      }

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 6; i++) {
          v += a * noise(p);
          p = rot(0.55) * p * 2.02 + vec2(5.7, 9.2);
          a *= 0.52;
        }
        return v;
      }

      // Lightning bolt with branching
      float lightning(vec2 uv, float seed, float beat) {
        float intensity = 0.0;
        // Main bolt
        float xPath = sin(uv.y * (8.0 + seed * 5.0) - u_time * (4.0 + seed * 2.0) + seed * 6.0);
        xPath += sin(uv.y * (20.0 + seed * 8.0) + u_time * (10.0 + seed * 3.0)) * 0.3;
        xPath *= 0.1 + u_mid * 0.06 + beat * 0.1;
        float core = smoothstep(0.06 + u_bass * 0.03, 0.0, abs(uv.x - xPath));
        // Jagged segments
        float jagged = smoothstep(0.025, 0.0, abs(fract(uv.y * (10.0 + u_treble * 12.0) + seed * 3.0) - 0.5));
        intensity += core * jagged * (0.5 + u_treble * 1.5 + beat * 2.0);

        // Branch
        float branchY = 0.1 + seed * 0.3;
        float branchUvY = uv.y - branchY;
        if (branchUvY > 0.0 && branchUvY < 0.25) {
          float bx = xPath + branchUvY * (1.5 + seed);
          bx += sin(branchUvY * 30.0 + seed * 10.0) * 0.04;
          float branch = smoothstep(0.04, 0.0, abs(uv.x - bx)) * smoothstep(0.25, 0.0, branchUvY);
          intensity += branch * 0.4;
        }
        return intensity;
      }

      // Rain particles
      float rain(vec2 p, float density, float speed) {
        float r = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          vec2 rp = p;
          rp.x *= density * (1.0 + fi * 0.3);
          rp.y = rp.y * 3.0 - u_time * speed * (1.0 + fi * 0.5);
          // Wind slant
          rp.x += rp.y * (0.15 + u_bass * 0.1);
          vec2 id = floor(rp);
          vec2 fid = fract(rp);
          float h = hash21(id + fi * 7.3);
          // Elongated drops
          float drop = smoothstep(0.15, 0.0, abs(fid.x - 0.5)) * smoothstep(0.4, 0.0, abs(fid.y - h));
          r += drop * (0.15 + fi * 0.05);
        }
        return r;
      }

      vec3 audioReactiveFinalize(vec3 inCol, vec2 uv, float hue, vec2 reactCenter, float reactScatter, float reactPulse) {
        vec3 hueCycle = 0.5 + 0.5 * cos(6.2831853 * (hue + vec3(0.0, 0.33, 0.67)));
        vec3 baseGlow = hueCycle * (0.16 + 0.14 * reactScatter);
        baseGlow += hueCycle * reactPulse * (0.18 + u_rms * 0.4 + u_beat * 0.25);
        baseGlow += vec3(0.06, 0.07, 0.09) * (0.6 + reactScatter * 0.8);
        baseGlow *= 0.75 + 0.25 * exp(-length(uv - reactCenter) * 2.8);
        inCol = mix(inCol, inCol * hueCycle, 0.2 + 0.15 * reactScatter);
        inCol += baseGlow;
        return max(inCol, vec3(0.02, 0.02, 0.03));
      }
void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
        float audioHue = u_time * 0.1 + u_treble * 0.5;
        vec2 audioDrift = vec2(sin(u_time * 0.3) * 1.5 + 1.5, sin(u_time * 0.23) * 1.5 + 1.5);
        uv += vec2(sin(u_time * 0.15), cos(u_time * 0.12)) * 0.06;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));

        // Thunder screen shake on beat
        vec2 shake = vec2(0.0);
        shake += vec2(sin(u_time * 45.0), cos(u_time * 37.0)) * u_beat * 0.015;
        shake += vec2(sin(u_time * 80.0), sin(u_time * 63.0)) * u_bass * u_beat * 0.008;
        vec2 p = uv + shake;

        // Rotating cloud vortex
        float vortexSpeed = 0.2 + u_mid * 0.3 + u_bass * 0.15;
        p *= rot(u_time * vortexSpeed * 0.15);
        p.y -= 0.05 + u_bass * 0.03;

        float radius = length(vec2(p.x * 0.8, p.y + 0.1));
        float angle = atan(p.y, p.x);

        // Swirling cloud mass
        float swirl = angle * (1.2 + u_mid * 2.0) - u_time * (0.25 + u_bass * 0.2);
        vec2 cloudUv = vec2(swirl * 0.8, radius * (2.8 + u_bass * 0.8) - u_time * (0.5 + u_bass * 0.5));

        float updraft = fbm(cloudUv + vec2(0.0, -u_bass * 2.2));
        float shelf = fbm(p * vec2(2.5, 1.8) + vec2(0.0, u_time * 0.1));
        float cell = fbm(p * (3.5 + u_rms * 2.5) + vec2(u_time * 0.06, -u_time * 0.05));
        float cloud = smoothstep(0.25 - u_bass * 0.1, 0.85 + u_rms * 0.1, updraft * 0.55 + shelf * 0.3 + cell * 0.45);

        // Eye of the storm — clear center
        float eye = smoothstep(0.15, 0.35, radius);
        cloud *= eye;

        // Cloud colors — dark ominous base with illuminated edges
        vec3 darkCloud = vec3(0.02, 0.025, 0.05);
        vec3 midCloud = vec3(0.06, 0.07, 0.12);
        vec3 litCloud = vec3(0.12, 0.14, 0.22);
        vec3 col = mix(darkCloud, midCloud, cloud);
        col = mix(col, litCloud, cloud * cloud);

        // Underlit clouds — warm orange from below
        vec3 underlight = mix(vec3(0.1, 0.06, 0.03), vec3(0.25, 0.15, 0.08), u_bass + u_rms * 0.5);
        col = mix(col, col + underlight, smoothstep(-0.1, 0.6, p.y + 0.5 + u_bass * 0.15) * cloud);

        // Heavy rain
        float rainIntensity = rain(uv + shake, 25.0 + u_rms * 20.0, 2.5 + u_bass * 2.0);
        float rainMask = smoothstep(-0.2, 0.4, p.y + cloud * 0.3);
        col += vec3(0.25, 0.3, 0.4) * rainIntensity * rainMask * (0.5 + u_rms * 1.0);

        // Lightning — triggered by beat, with lingering flash
        float beatGate = smoothstep(0.1, 0.6, u_beat);
        // Multiple bolt positions
        float bolt1 = lightning(uv + vec2(-0.2, 0.15), 0.3, u_beat);
        float bolt2 = lightning(uv + vec2(0.25, 0.1), 0.7, u_beat);
        float bolt3 = lightning(uv * vec2(0.9, 1.0) + vec2(0.05, 0.2), 1.2, u_beat);
        float bolts = (bolt1 + bolt2 * 0.7 + bolt3 * 0.5) * beatGate;

        // Bolt color — bright blue-white core with purple fringe
        col += vec3(0.8, 0.85, 1.0) * bolts;
        col += vec3(0.4, 0.3, 0.8) * bolts * 0.3;

        // Lightning flash illuminates clouds
        float flash = u_beat * (0.6 + cloud * 0.5);
        col += vec3(0.9, 0.92, 1.0) * flash * 0.5;
        // Internal cloud illumination from lightning
        float internalFlash = u_beat * cloud * 0.4;
        col += vec3(0.6, 0.65, 0.9) * internalFlash;

        // Bass-driven thunder pulse — screen darkens then brightens
        float thunderPulse = u_bass * u_bass * 0.3;
        col *= 1.0 + thunderPulse * sin(u_time * 25.0) * 0.15;

        // Rotating vortex funnel hint
        float funnel = smoothstep(0.2, 0.0, radius) * (0.15 + u_mid * 0.2);
        col += vec3(0.08, 0.1, 0.18) * funnel * (1.0 + u_beat * 0.5);

        // Anvil top glow
        float anvil = smoothstep(0.85 + u_bass * 0.1, 0.05, length(vec2(p.x, p.y + 0.5)));
        col += vec3(0.04, 0.06, 0.1) * anvil * (0.5 + u_mid * 0.4);

        // Vignette — darker at edges for drama
        float vignette = smoothstep(1.6, 0.15, length(uv + vec2(0.0, 0.1)));
        col *= vignette;

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }
    `;

    try {
      return p.createShader(vert, frag);
    } catch (_) {
      return null;
    }
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
  }

  onBeat(strength) {
    this.beatPulse = Math.min(1, strength || 0);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['storm-cell'] = StormCellPreset;
})();
