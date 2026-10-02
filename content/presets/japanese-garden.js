(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class JapaneseGardenPreset extends BasePreset {
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
        preset._time += 0.009 + preset.audio.mid * 0.01 + preset.audio.treble * 0.003;
        preset.beatPulse *= 0.92;
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

      float sandNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float groove(vec2 p, vec2 center, float spacing, float angle, float beatSwirl) {
        vec2 q = p - center;
        q *= rot(angle);
        float d = length(q);
        float ring = sin(d * (20.0 / spacing) - beatSwirl * 3.0);
        float rake = sin(q.x * (8.0 + u_mid * 10.0) + q.y * 3.0);
        return 0.5 + 0.35 * ring + 0.15 * rake;
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
        float beatStone = smoothstep(0.05, 0.95, u_beat);
        float lightAngle = -0.5 + u_rms * 1.4 + u_beat * 0.2;
        vec3 lightDir = normalize(vec3(cos(lightAngle), sin(lightAngle), 0.9));

        float spacing = 0.24 + u_bass * 0.32 + u_beat * 0.08;
        float rakeDir = -0.8 + u_mid * 2.2 + sin(u_time * 0.2) * 0.15;

        vec2 c1 = vec2(-0.42, -0.12);
        vec2 c2 = vec2(0.28, 0.18);
        vec2 c3 = mix(vec2(-0.08, 0.38), vec2(0.0, -0.04), beatStone);

        float g1 = groove(uv, c1, spacing, rakeDir, beatStone);
        float g2 = groove(uv, c2, spacing * 0.88, rakeDir + 0.35, beatStone * 1.4);
        float g3 = groove(uv, c3, spacing * 0.72, rakeDir - 0.5, beatStone * 2.2);
        float sand = g1 * 0.45 + g2 * 0.35 + g3 * 0.2;

        float grainA = sandNoise(uv * (110.0 + u_treble * 180.0) + u_time * 0.2);
        float grainB = sandNoise(uv.yx * (170.0 + u_treble * 260.0) - u_time * 0.15);
        float grains = (grainA + grainB) * 0.5;

        vec2 eps = vec2(0.008, 0.0);
        float sandX = groove(uv + eps.xy, c1, spacing, rakeDir, beatStone) * 0.45 +
                      groove(uv + eps.xy, c2, spacing * 0.88, rakeDir + 0.35, beatStone * 1.4) * 0.35 +
                      groove(uv + eps.xy, c3, spacing * 0.72, rakeDir - 0.5, beatStone * 2.2) * 0.2;
        float sandY = groove(uv + eps.yx, c1, spacing, rakeDir, beatStone) * 0.45 +
                      groove(uv + eps.yx, c2, spacing * 0.88, rakeDir + 0.35, beatStone * 1.4) * 0.35 +
                      groove(uv + eps.yx, c3, spacing * 0.72, rakeDir - 0.5, beatStone * 2.2) * 0.2;
        vec3 normal = normalize(vec3((sand - sandX) * 10.0, (sand - sandY) * 10.0, 1.0));

        float diffuse = clamp(dot(normal, lightDir), 0.0, 1.0);
        float spec = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 18.0 + u_treble * 25.0);

        vec3 sandBase = vec3(0.78, 0.73, 0.63);
        sandBase = mix(sandBase, vec3(0.92, 0.89, 0.82), u_rms * 0.45);
        sandBase = mix(sandBase, vec3(0.7, 0.64, 0.55), u_bass * 0.12);
        sandBase += vec3(0.06, 0.04, 0.02) * (grains - 0.5) * (0.5 + u_treble * 0.8);

        vec3 col = sandBase * (0.58 + diffuse * 0.55);
        col += vec3(0.9, 0.85, 0.74) * spec * (0.1 + u_rms * 0.28);

        float stone1 = exp(-length((uv - c1) * vec2(1.4, 1.0)) * 9.0);
        float stone2 = exp(-length((uv - c2) * vec2(1.1, 1.3)) * 10.0);
        float stone3 = exp(-length((uv - c3) * vec2(1.2, 1.2)) * (8.0 + beatStone * 4.0));
        float stones = max(max(stone1, stone2), stone3);
        vec3 stoneCol = vec3(0.22, 0.22, 0.2) + vec3(0.08, 0.1, 0.08) * u_rms;
        stoneCol += vec3(0.06, 0.08, 0.06) * beatStone;

        col = mix(col, stoneCol, stones);

        float moss = exp(-length(uv - c1 - vec2(-0.05, 0.08)) * 14.0) + exp(-length(uv - c2 - vec2(0.06, -0.04)) * 13.0);
        col += vec3(0.06, 0.12, 0.04) * moss * (0.08 + u_mid * 0.2);

        float rakeHighlight = smoothstep(0.78, 1.0, sand) * (0.06 + u_rms * 0.08 + u_treble * 0.08 + u_bass * 0.06);
        col += vec3(0.12, 0.1, 0.08) * rakeHighlight;
        col += vec3(0.05, 0.04, 0.03) * exp(-length(uv - c3) * (10.0 - u_bass * 4.0)) * u_bass * 0.18;

        float vignette = 1.0 - smoothstep(0.55, 1.25, length(uv));
        col *= 0.68 + vignette * 0.42;
        col = pow(max(col, 0.0), vec3(0.95));

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
window.VJamFX.presets['japanese-garden'] = JapaneseGardenPreset;
})();
