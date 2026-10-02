(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class BloodCellFlowPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
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
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }
        preset._time += 0.016 + preset.audio.bass * 0.02 + preset.audio.treble * 0.003;
        preset.beatPulse *= 0.89;
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
        } catch (_) {} finally {
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

      float hash(float n) {
        return fract(sin(n * 91.3458) * 43758.5453);
      }
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }

      mat2 rot(float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c);
      }

      vec2 vesselCurve(float x) {
        float wobble = sin(x * 2.1 + u_time * 0.8) * 0.08;
        wobble += sin(x * 4.7 - u_time * 0.5) * 0.04 * (1.0 + u_mid);
        float center = wobble * (0.7 + u_mid * 0.7);
        float radius = 0.42 + sin(x * 1.5 - u_time * 0.3) * 0.05;
        radius += u_mid * 0.16 + u_beat * 0.12;
        radius += exp(-abs(x) * 2.2) * u_beat * 0.14;
        return vec2(center, radius);
      }

      float redCell(vec2 p, vec2 center, float seed, float speed) {
        vec2 q = p - center;
        q *= rot(seed * 6.2831 + u_time * (0.4 + speed * 0.05));
        q.x *= 1.25;
        float outer = exp(-dot(q, q) * 42.0);
        float inner = exp(-dot(q * vec2(1.0, 1.6), q * vec2(1.0, 1.6)) * 85.0);
        float rim = max(outer - inner * (0.8 + u_rms * 0.2), 0.0);
        return rim;
      }

      float whiteCell(vec2 p, vec2 center, float seed) {
        vec2 q = p - center;
        q *= rot(seed * 9.0 + u_time * 0.2);
        float core = exp(-dot(q, q) * 26.0);
        float lobes = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          vec2 off = vec2(cos(seed * 20.0 + fi * 2.1), sin(seed * 18.0 + fi * 2.1)) * 0.035;
          lobes += exp(-dot(q - off, q - off) * 95.0);
        }
        return core * 0.5 + lobes * 0.35;
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float audioHue = u_time * 0.1 + u_treble * 0.5;
        vec2 audioDrift = vec2(fract(u_time * 0.1) * 3.0, fract(u_time * 0.08) * 3.0);
        uv += (audioDrift - 1.5) * 0.12;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float beatPulse = smoothstep(0.05, 0.95, u_beat);
        float flowSpeed = 0.45 + u_bass * 2.4 + u_beat * 0.8;

        vec2 vessel = vesselCurve(uv.x * 1.8);
        float center = vessel.x;
        float radius = vessel.y;
        float wall = abs(uv.y - center) - radius;
        float inside = smoothstep(0.03, -0.03, wall);

        vec3 plasma = mix(vec3(0.14, 0.0, 0.02), vec3(0.5, 0.06, 0.08), clamp(u_rms * 1.1, 0.0, 1.0));
        plasma += vec3(0.08, 0.0, 0.03) * u_mid;
        plasma += vec3(0.12, 0.02, 0.02) * beatPulse;
        plasma *= 0.9 + inside * 0.18;

        float stream = sin(uv.x * 16.0 - u_time * (2.0 + flowSpeed * 3.5) + uv.y * 8.0);
        stream += sin(uv.x * 29.0 - u_time * (3.4 + flowSpeed * 2.2));
        plasma += vec3(0.18, 0.01, 0.02) * inside * (0.08 + 0.08 * stream);

        float rbcAccum = 0.0;
        float depthAccum = 0.0;
        for (int i = 0; i < 11; i++) {
          float fi = float(i);
          float seed = hash(fi + 1.0);
          float lane = mix(-0.7, 0.7, hash(fi + 23.0));
          float x = fract(seed + u_time * (0.055 + flowSpeed * 0.06) + fi * 0.073) * 2.8 - 1.4;
          x = 1.4 - x;
          vec2 vesselNow = vesselCurve(x * 1.8);
          float y = vesselNow.x + lane * vesselNow.y * (0.66 + 0.12 * sin(fi * 3.1));
          y += sin(u_time * (1.4 + seed * 3.0) + fi * 7.0) * 0.016;
          float cell = redCell(uv, vec2(x, y), seed, flowSpeed);
          rbcAccum += cell;
          depthAccum += cell * (0.35 + 0.65 * (1.0 - abs(lane)));
        }

        float whiteAccum = 0.0;
        for (int j = 0; j < 4; j++) {
          float fj = float(j);
          float seed = hash(fj + 101.0);
          float spawn = step(0.55 - u_treble * 0.25, hash(floor(u_time * (2.0 + u_treble * 8.0)) + fj * 17.0));
          float x = fract(seed + u_time * (0.025 + u_bass * 0.04) + fj * 0.17) * 2.6 - 1.3;
          x = 1.3 - x;
          vec2 vesselNow = vesselCurve(x * 1.8);
          float y = vesselNow.x + sin(seed * 17.0 + u_time * 0.8) * vesselNow.y * 0.18;
          whiteAccum += whiteCell(uv, vec2(x, y), seed) * spawn;
        }

        vec3 oxygenA = vec3(0.35, 0.03, 0.05);
        vec3 oxygenB = vec3(0.12, 0.0, 0.02);
        vec3 rbcColor = mix(oxygenB, oxygenA, clamp(u_rms * 1.2, 0.0, 1.0));
        rbcColor += vec3(0.1, 0.01, 0.02) * u_bass;
        rbcColor += vec3(0.22, 0.04, 0.05) * beatPulse;

        vec3 wbcColor = vec3(0.95, 0.9, 0.72);
        wbcColor += vec3(0.1, 0.08, 0.12) * u_treble;

        vec3 wallCol = vec3(0.24, 0.03, 0.06) + vec3(0.1, 0.03, 0.05) * u_mid;
        float wallGlow = exp(-abs(wall) * (16.0 - u_mid * 5.0));

        vec3 col = plasma * inside;
        col += rbcColor * rbcAccum * (0.8 + depthAccum * 0.15);
        col += wbcColor * whiteAccum * (0.5 + u_treble * 0.9);
        col += wallCol * wallGlow * (0.2 + u_beat * 0.7);

        float pulseRing = exp(-20.0 * abs(abs(uv.y - center) - radius * (0.65 + 0.1 * sin(u_time * 3.0))));
        col += vec3(0.4, 0.08, 0.1) * pulseRing * u_beat;

        float vignette = 1.0 - smoothstep(0.55, 1.2, length(uv * vec2(0.9, 1.2)));
        col *= 0.6 + vignette * 0.55;
        col = pow(max(col, 0.0), vec3(0.88));

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
    this.beatPulse = Math.min(1, strength);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['blood-cell-flow'] = BloodCellFlowPreset;
})();
