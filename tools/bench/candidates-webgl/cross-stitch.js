(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Cross Stitch GPU
 * Grid-sampled embroidery field with beat-driven row insertion and woven X stitches.
 */
class CrossStitchPreset extends BasePreset {
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

        preset.beatPulse *= 0.9;
        preset._time += 0.01 + preset.audio.treble * 0.008 + preset.audio.rms * 0.003;

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
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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

      vec3 palette(float t) {
        vec3 c1 = vec3(0.88, 0.23, 0.28);
        vec3 c2 = vec3(0.94, 0.73, 0.18);
        vec3 c3 = vec3(0.11, 0.62, 0.78);
        vec3 c4 = vec3(0.93, 0.92, 0.87);
        t = fract(t);
        if (t < 0.25) return mix(c1, c2, t * 4.0);
        if (t < 0.5) return mix(c2, c3, (t - 0.25) * 4.0);
        if (t < 0.75) return mix(c3, c4, (t - 0.5) * 4.0);
        return mix(c4, c1, (t - 0.75) * 4.0);
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
        vec2 audioDrift = vec2(fract(u_time * 0.1) * 3.0, fract(u_time * 0.08) * 3.0);
        uv += (audioDrift - 1.5) * 0.12;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float beatRows = floor(u_time * (0.6 + u_beat * 3.5));
        float gridY = 20.0 + u_bass * 32.0 + mod(beatRows, 6.0) * 2.0;
        float gridX = gridY * (0.82 + u_mid * 0.6 + u_beat * 0.12);

        vec2 warpUv = uv;
        warpUv += 0.015 * vec2(
          sin(uv.y * (6.0 + u_mid * 10.0) + u_time * (0.8 + u_treble * 2.4)),
          cos(uv.x * (7.0 + u_mid * 9.0) - u_time * (0.7 + u_treble * 2.0))
        );
        warpUv += 0.02 * u_beat * normalize(vec2(uv.y + 0.001, -uv.x + 0.001));

        vec2 grid = warpUv * vec2(gridX, gridY);
        vec2 cell = floor(grid);
        vec2 local = fract(grid) - 0.5;

        float insertShift = step(0.78, fract(cell.y * 0.11 + u_time * 0.13 + u_beat * 0.9));
        local.y += insertShift * (0.22 + u_beat * 0.18);

        float rowSeed = floor(cell.y + beatRows);
        float densityGate = hash(vec2(cell.x * 0.73, rowSeed * 1.37));
        float density = smoothstep(0.93, 0.18, densityGate - u_bass * 0.55 + u_beat * 0.22);

        float complexity = 1.0 + floor(u_mid * 4.0 + hash(cell + rowSeed) * 2.0);
        vec2 stitchUv = local * rot(0.1 * sin(rowSeed * 0.4 + u_time * 0.6));
        stitchUv *= 1.0 + 0.18 * sin((cell.x + cell.y) * 0.7 + u_time * (0.5 + u_mid));

        float threadA = sdSegment(stitchUv, vec2(-0.34, -0.34), vec2(0.34, 0.34));
        float threadB = sdSegment(stitchUv, vec2(-0.34, 0.34), vec2(0.34, -0.34));
        float threadW = 0.065 + u_rms * 0.04 + u_bass * 0.012;
        float xStitch = exp(-threadA * (34.0 - u_rms * 10.0)) + exp(-threadB * (34.0 - u_rms * 10.0));
        xStitch *= density;

        float weave = 0.5 + 0.5 * sin((threadA - threadB) * 90.0 * complexity + u_time * (2.5 + u_treble * 9.0));
        weave += 0.35 * sin((threadA + threadB) * 110.0 + u_time * (1.4 + u_treble * 7.0));
        float sheen = pow(max(weave, 0.0), 2.0) * (0.25 + u_rms * 1.6 + u_beat * 0.4);

        float knot = exp(-length(local) * (18.0 + u_mid * 10.0)) * (0.15 + u_bass * 0.6 + u_beat * 0.5);
        float cloth = 0.6 + 0.15 * sin(grid.x * 3.14159) * sin(grid.y * 3.14159);
        cloth += 0.08 * sin((grid.x + grid.y) * 0.9 + u_time * 0.35);

        float hueT = hash(cell + complexity) + u_time * (0.03 + u_treble * 0.28) + u_treble * 0.35;
        vec3 threadCol = palette(hueT);
        threadCol = mix(threadCol, threadCol.bgr, 0.12 + 0.22 * sin(rowSeed * 0.2 + u_time * u_treble));
        threadCol *= 0.65 + 0.5 * density + 0.25 * u_bass;

        vec3 clothCol = vec3(0.06, 0.055, 0.05) * cloth;
        clothCol += vec3(0.02, 0.018, 0.014) * (u_rms + u_bass * 0.3);

        float border = smoothstep(0.5, 0.38, max(abs(local.x), abs(local.y)));
        vec3 col = clothCol;
        col += threadCol * xStitch * (0.8 + 0.4 * complexity / 5.0);
        col += vec3(1.0, 0.96, 0.9) * sheen * xStitch;
        col += vec3(0.8, 0.75, 0.68) * knot * density;
        col += vec3(0.04, 0.03, 0.025) * border * (0.7 + u_mid * 0.4);
        col += vec3(0.12, 0.09, 0.05) * u_beat * density * step(0.72, densityGate);

        col *= 1.0 - dot(uv, uv) * (0.24 - u_rms * 0.06);
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
window.VJamFX.presets['cross-stitch'] = CrossStitchPreset;
})();
