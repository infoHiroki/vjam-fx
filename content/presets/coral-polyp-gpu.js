(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Coral Polyp GPU
 * Branching coral SDF populated with oscillating polyps and beat-wide contractions.
 */
class CoralPolypGpuPreset extends BasePreset {
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
        p.background(0);
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }

        preset.beatPulse *= 0.88;
        preset._time += 0.009 + preset.audio.mid * 0.006 + preset.audio.treble * 0.004;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          p.noStroke();
          p.quad(-1, -1, 1, -1, 1, 1, -1, 1);
        } catch (_) {
        } finally {
          p.resetShader();
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
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
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(91.7, 251.3))) * 43758.5453123);
      }
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }

      mat2 rot(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }

      float sdSegment(vec2 p, vec2 a, vec2 b) {
        vec2 pa = p - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return length(pa - ba * h);
      }

      float branchField(vec2 p, float flow) {
        float trunk = exp(-sdSegment(p, vec2(0.0, -0.95), vec2(0.0, 0.2)) * 25.0);
        float leftA = exp(-sdSegment(p, vec2(0.0, -0.2), vec2(-0.42 + flow * 0.22, 0.46)) * 22.0);
        float rightA = exp(-sdSegment(p, vec2(0.0, -0.14), vec2(0.46 + flow * 0.2, 0.5)) * 22.0);
        float leftB = exp(-sdSegment(p, vec2(-0.25, 0.16), vec2(-0.62 + flow * 0.16, 0.78)) * 18.0);
        float rightB = exp(-sdSegment(p, vec2(0.24, 0.2), vec2(0.66 + flow * 0.15, 0.82)) * 18.0);
        float crownL = exp(-sdSegment(p, vec2(-0.46, 0.45), vec2(-0.7 + flow * 0.12, 1.0)) * 15.0);
        float crownR = exp(-sdSegment(p, vec2(0.44, 0.47), vec2(0.72 + flow * 0.12, 1.02)) * 15.0);
        return trunk + leftA + rightA + leftB + rightB + crownL + crownR;
      }

      vec3 hsv2rgb(vec3 c) {
        vec3 p = abs(fract(c.xxx + vec3(0.0, 0.6666667, 0.3333333)) * 6.0 - 3.0);
        return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
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
        vec2 p = uv + audioDrift;
        float flowAngle = sin(u_time * (0.45 + u_mid * 1.5)) * (0.25 + u_mid * 0.55);
        p *= rot(flowAngle);
        p.x += 0.07 * sin(p.y * (6.0 + u_mid * 7.0) + u_time * (0.8 + u_mid * 2.0));
        p += 0.025 * u_beat * vec2(sin(p.y * 8.0), cos(p.x * 7.0));

        float coral = branchField(p, sin(u_time * 0.8 + u_mid * 2.0) * 0.2);
        float skeleton = smoothstep(0.1, 0.5, coral);

        vec2 lattice = p * (7.0 + u_mid * 8.0 + u_beat * 3.0);
        vec2 cell = floor(lattice);
        vec2 local = fract(lattice) - 0.5;
        float anchor = branchField(cell / (7.0 + u_mid * 8.0), 0.0);
        float attach = smoothstep(0.05, 0.42, anchor);

        float seed = hash(cell);
        float radius = 0.1 + 0.18 * seed;
        float breathing = 0.45 + 0.45 * sin(u_time * (1.2 + seed + u_bass * 1.8) + seed * 6.2831);
        float open = mix(0.22, 1.0, breathing * (0.6 + u_bass * 0.8));
        open *= 1.0 - u_beat * 0.82;

        float tentacle = 0.0;
        float ring = 0.0;
        float vib = u_time * (5.0 + u_treble * 18.0) + seed * 11.0;
        for (int i = 0; i < 8; i++) {
          float fi = float(i) / 8.0;
          float ang = fi * 6.2831853 + seed * 2.6 + sin(vib + fi * 3.0) * (0.18 + u_treble * 0.34);
          vec2 dir = vec2(cos(ang), sin(ang));
          vec2 tip = dir * radius * (0.45 + open + 0.18 * sin(vib * 1.3 + fi * 7.0));
          float arm = exp(-sdSegment(local, dir * radius * 0.12, tip) * (35.0 - u_treble * 11.0));
          tentacle += arm;
          ring += exp(-abs(length(local) - length(tip)) * (24.0 - u_rms * 8.0));
        }

        float mouth = exp(-length(local) * (24.0 - u_bass * 8.0)) * (0.5 + u_rms * 0.8);
        float polyp = (tentacle * (0.24 + u_treble * 0.45) + ring * 0.07 + mouth) * attach;

        float bio = pow(max(0.0, sin(vib * 0.6 + length(local) * 18.0)), 3.0);
        bio *= (0.15 + u_rms * 1.7 + u_treble * 0.25) * attach;

        vec3 water = vec3(0.01, 0.06, 0.09);
        water += vec3(0.0, 0.08, 0.1) * exp(-length(uv) * 2.4);
        water += vec3(0.02, 0.05, 0.08) * (0.3 + u_rms) * (0.5 + 0.5 * sin(uv.y * 9.0 + u_time));

        vec3 coralCol = hsv2rgb(vec3(0.03 + seed * 0.08 + u_treble * 0.06, 0.72, 0.4 + u_bass * 0.4));
        coralCol = mix(coralCol, vec3(0.92, 0.48, 0.3), 0.2 + u_bass * 0.2);
        vec3 glowCol = hsv2rgb(vec3(0.42 + seed * 0.1 + u_treble * 0.08, 0.65, 1.0));

        vec3 col = water;
        col += coralCol * skeleton * (0.4 + u_bass * 0.7 + u_mid * 0.2);
        col += coralCol * polyp * (0.55 + u_bass * 0.85);
        col += glowCol * bio;
        col += vec3(0.85, 0.95, 1.0) * u_beat * skeleton * 0.35;
        col += vec3(0.08, 0.2, 0.22) * attach * (0.25 + u_mid * 0.3);

        float caustic = 0.5 + 0.5 * sin((uv.x + uv.y) * (12.0 + u_treble * 18.0) + u_time * (1.1 + u_treble * 3.0));
        col += vec3(0.06, 0.1, 0.08) * caustic * (0.15 + u_rms * 0.4);
        col *= 1.0 - dot(uv, uv) * 0.22;
        col = pow(max(col, 0.0), vec3(0.9));
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
window.VJamFX.presets['coral-polyp-gpu'] = CoralPolypGpuPreset;
})();
