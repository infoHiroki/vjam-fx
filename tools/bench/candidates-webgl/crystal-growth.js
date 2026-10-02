(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CrystalGrowthPreset extends BasePreset {
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

        preset._time += 0.008 + preset.audio.bass * 0.006 + preset.audio.rms * 0.003;
        preset.beatPulse *= 0.91;

        try {
          p.background(0);
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
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;
      uniform vec2 u_resolution;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}

      mat2 rot(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }

      float anisotropicCrystal(vec2 p, float arms, float seedPhase) {
        float r = length(p);
        float a = atan(p.y, p.x);
        float symmetry = cos(arms * (a - seedPhase));
        float secondary = cos((arms * 2.0) * (a - seedPhase) + u_treble * 2.5);
        float growthPhase = fract(u_time * (0.085 + u_bass * 0.04 + u_beat * 0.03));
        float front = r - (0.08 + (0.75 + 0.42 * u_bass + 0.35 * u_beat) * growthPhase);
        front += 0.18 * symmetry * (1.0 + 0.55 * u_treble);
        front += 0.06 * secondary * (1.0 + 0.4 * u_mid);
        front += 0.05 * sin(r * (24.0 + 20.0 * u_treble) - u_time * (1.1 + u_bass));
        return front;
      }

      float dendriteLayer(vec2 uv, vec2 center, float seedPhase, float seedScale) {
        vec2 p = (uv - center) * seedScale;
        float sweep = fract(u_time * (0.055 + u_mid * 0.025) + seedScale * 0.07);
        p *= rot(seedPhase + (sweep - 0.5) * 0.7);
        float arms = 6.0 + floor(u_treble * 6.0) + seedScale * 0.6;
        float crystal = anisotropicCrystal(p, arms, seedPhase);
        float branchSweep = fract((atan(p.y, p.x) / 6.28318) * arms + length(p) * (1.9 + 2.8 * u_treble) - u_time * (0.18 + u_bass * 0.08));
        float sidebranches = abs(branchSweep * 2.0 - 1.0);
        float undercooling = 0.1 + 0.38 * u_beat + 0.28 * u_bass;
        float growth = smoothstep(0.12 + undercooling, -0.1 - undercooling * 0.6, crystal);
        growth *= 0.6 + 0.4 * smoothstep(0.92, 0.18, sidebranches);
        return growth;
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
        float audioHue = u_time * 0.06 + u_treble * 0.4;
        vec2 audioDrift = vec2(fract(u_time * 0.1) * 3.0, fract(u_time * 0.08) * 3.0);
        uv += (audioDrift - 1.5) * 0.12;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactFlow = fract(vec2(
          u_time * (0.058 + u_bass * 0.03) + reactScatter * 0.7,
          u_time * (0.05 + u_treble * 0.025) + noise(reactSeed.yx + 4.0) * 0.84
        ));
        vec2 reactCenter = (reactFlow - 0.5) * (0.76 + 0.18 * u_rms) + (reactScatter - 0.5) * 0.15;
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float spin = fract(u_time * (0.04 + u_mid * 0.018) + reactScatter * 0.16);
        uv *= rot((spin - 0.5) * 0.46);
        uv += (fract(vec2(
          u_time * (0.082 + u_mid * 0.05) + u_beat * 0.32,
          u_time * (0.067 + u_treble * 0.04) + u_bass * 0.24
        )) - 0.5) * vec2(0.2, 0.16) * (0.35 + u_beat);
        vec3 hueCycle = 0.5 + 0.5 * cos(6.2831853 * (audioHue + vec3(0.0, 0.33, 0.67)));

        float growthA = dendriteLayer(uv, vec2(0.0), 0.15 + u_mid * 0.5, 1.25);
        float growthB = dendriteLayer(uv, vec2(-0.22, 0.16), 0.65 + u_beat * 0.7, 1.75);
        float growthC = dendriteLayer(uv, vec2(0.2, -0.18), -0.5 - u_mid * 0.6, 1.55);
        float quench = dendriteLayer(uv, vec2(0.02, 0.0), 1.2 + u_beat * 1.4 + u_mid * 0.4, 2.15 + u_bass * 0.3) * u_beat;
        float crystal = max(max(growthA, max(0.85 * growthB, 0.82 * growthC)), quench);

        float r = length(uv);
        float angle = atan(uv.y, uv.x) - u_mid * 1.6;
        float supersaturation = 0.55 + 0.3 * (fract(u_time * (0.12 + u_rms * 0.04) - r * (1.1 + 0.9 * u_bass)) * 2.0 - 1.0);
        supersaturation += 0.15 * cos(angle * (6.0 + 4.0 * u_treble) + u_time * (0.7 + u_mid));
        supersaturation += 0.25 * u_beat;

        float facet = pow(max(cos((6.0 + 4.0 * u_treble) * angle), 0.0), 3.0);
        float sparkle = pow(max(cos(r * (36.0 + 22.0 * u_treble) - u_time * (2.0 + u_bass * 2.0)), 0.0), 8.0);
        sparkle *= 0.18 + 0.5 * u_rms + 0.22 * u_beat;

        vec3 iceBase = mix(vec3(0.02, 0.05, 0.08), hueCycle * 0.34 + vec3(0.06), 0.35 + 0.25 * u_mid);
        vec3 crystalColor = mix(hueCycle * 0.72 + vec3(0.08), hueCycle.yzx * 0.95 + vec3(0.12), 0.45 + 0.35 * u_rms);
        crystalColor += hueCycle.zxy * (0.12 * u_treble);
        crystalColor += hueCycle * (0.1 * u_bass);

        vec3 col = iceBase;
        col += vec3(0.05, 0.1, 0.16) * supersaturation * (0.8 + 0.4 * u_rms);
        col = mix(col, crystalColor, crystal);
        col += (hueCycle.yzx * 0.85 + vec3(0.16)) * facet * crystal * (0.22 + 0.3 * u_mid + 0.22 * u_treble);
        col += (hueCycle + vec3(0.24)) * sparkle * crystal;
        col += (hueCycle.zxy * 0.6 + vec3(0.08)) * (growthB + growthC) * (0.08 + 0.18 * u_beat);
        col += (hueCycle.yzx * 0.85 + vec3(0.18)) * quench * (0.25 + 0.55 * u_beat + 0.2 * u_rms);
        col += (hueCycle * 0.28 + vec3(0.12)) * smoothstep(0.2, 1.0, supersaturation) * (0.15 + 0.2 * u_bass);

        float vignette = 1.0 - dot(uv, uv) * (0.52 + 0.12 * u_rms);
        col *= max(vignette, 0.0);
        col = max(col, vec3(0.03));
        gl_FragColor = vec4(audioReactiveFinalize(clamp(col, 0.0, 1.0), uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }
    `;

    try {
      return p.createShader(vert, frag);
    } catch (_) {
      return null;
    }
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    this.beatPulse = Math.min(1, strength);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['crystal-growth'] = CrystalGrowthPreset;
})();
