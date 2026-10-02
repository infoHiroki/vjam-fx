(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class OrigamiPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.foldStep = 0;
    this.foldPhase = 0;
    this._shader = null;
  }

  setup(container) {
    this.destroy();
    this.foldStep = 0;
    this.foldPhase = 0;
    this._shader = null;
    const preset = this;

    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL);
        p.pixelDensity(1);
      };

      p.draw = () => {
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) {
            p.background(0);
            return;
          }
        }

        preset.beatPulse *= 0.88;
        // Faster fold animation cycle
        preset.foldPhase += 0.02 + preset.audio.mid * 0.15 + preset.audio.bass * 0.05;
        const foldAmount = Math.min(10, preset.foldStep + preset.foldPhase * 0.6);

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_time', p.frameCount * 0.01);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_fold', foldAmount);
          p.noStroke();
          p.quad(-1, -1, 1, -1, 1, 1, -1, 1);
        } catch (_) {
          p.background(0);
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
      uniform float u_fold;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

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

      mat2 rot(float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c);
      }

      // Sharp fold — reflects across line defined by normal n
      vec2 fold(vec2 p, vec2 n, float amt) {
        float d = dot(p, n);
        if (d < 0.0) {
          p -= n * d * 2.0 * amt;
        }
        return p;
      }

      // Diamond/rhombus mask for origami shape
      float diamondMask(vec2 p, float size) {
        p = abs(p);
        return (p.x + p.y) - size;
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
        float audioHue = u_time * 0.08 + u_treble * 0.4;
        vec2 audioDrift = vec2(sin(u_time * 0.3) * 1.5 + 1.5, sin(u_time * 0.23) * 1.5 + 1.5);
        uv += vec2(sin(u_time * 0.15), cos(u_time * 0.12)) * 0.06;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactFlow = fract(vec2(
          u_time * (0.06 + u_bass * 0.025) + reactScatter * 0.7,
          u_time * (0.045 + u_mid * 0.03) + noise(reactSeed.yx + 4.0) * 0.9
        ));
        vec2 reactCenter = (reactFlow - 0.5) * (0.72 + 0.2 * u_rms) + (reactScatter - 0.5) * 0.18;
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        vec2 p = uv;
        vec3 hueCycle = 0.5 + 0.5 * cos(6.2831853 * (audioHue + vec3(0.0, 0.33, 0.67)));

        float baseRot = u_time * 0.15 + u_mid * 1.2;
        p *= rot(baseRot);

        // Strong fold depth for angular, geometric look
        float foldDepth = 0.7 + u_bass * 4.0;
        float pulse = u_beat * 5.0;

        // Multiple fold iterations — more frequent, sharper
        vec2 q = p;
        for (int i = 0; i < 10; i++) {
          if (float(i) >= u_fold) break;
          float fi = float(i);
          // Each fold at a distinct angle — creates sharp geometric patterns
          float foldCycle = fract(u_time * (0.12 + u_mid * 0.06) + fi / 10.0);
          float ang = fi * 0.628318 + foldCycle * 3.14159 + u_beat * 0.8;
          vec2 n = vec2(cos(ang), sin(ang));
          float amt = foldDepth * (0.6 + 0.4 * foldCycle);
          q = fold(q, n, amt);
          // Sharp displacement along fold axis
          q += n.yx * vec2(1.0, -1.0) * 0.01 * (1.0 + u_bass * 0.5);
        }

        // Diamond body shape
        float body = diamondMask(q * rot(-baseRot * 0.3), 0.55);
        float inside = smoothstep(0.02, -0.02, body);

        // Sharp crease lines — the key origami feature
        float creaseA = abs(q.x);
        float creaseB = abs(q.y);
        float creaseC = abs((q.x + q.y) * 0.7071);
        float creaseD = abs((q.x - q.y) * 0.7071);
        // Diagonal creases for more angular look
        float creaseE = abs(q.x * 0.866 + q.y * 0.5);
        float creaseF = abs(q.x * 0.5 - q.y * 0.866);
        float crease = min(min(min(creaseA, creaseB), min(creaseC, creaseD)), min(creaseE, creaseF));
        float creaseLine = smoothstep(0.08 + u_bass * 0.15, 0.0, crease);

        // Faceted shading — each folded panel has distinct brightness
        float facet = 0.5 + 0.5 * sin(q.x * 22.0 + q.y * 18.0 + u_fold * 1.2);
        float facet2 = 0.5 + 0.5 * cos(q.x * 14.0 - q.y * 20.0 + u_fold * 0.9);
        float panel = facet * 0.6 + facet2 * 0.4;

        // Paper color — crisp whites and clean colors
        vec3 paperBase = vec3(0.85, 0.82, 0.78);
        vec3 paperTint = hueCycle * 0.3 + vec3(0.7);
        vec3 paper = mix(paperBase, paperTint, 0.3 + u_treble * 0.3);
        paper *= 0.7 + panel * 0.3;

        // Sharp specular highlight along creases
        float spec = pow(max(0.0, 1.0 - abs(crease * 8.0 - sin(u_time * 1.2 + q.x * 12.0) * 0.1)), 12.0);
        spec *= (0.3 + u_treble * 3.0 + pulse * 2.0);
        vec3 highlight = (hueCycle * 0.4 + vec3(0.6)) * spec;

        // Crease color — sharp lines glow on beat
        vec3 creaseCol = mix(vec3(0.15), hueCycle * 0.9 + vec3(0.1), u_treble * 1.2 + pulse * 0.3);

        vec3 col = paper * inside;
        // Dark crease shadows
        col -= creaseLine * vec3(0.25 + foldDepth * 0.15) * inside;
        // Glowing crease highlights
        col += creaseLine * creaseCol * (0.25 + pulse * 0.5) * inside;
        col += highlight * inside;

        // Strong shadow for 3D effect
        float shadow = smoothstep(-0.3, 0.5, q.y + sin(q.x * 10.0 + u_time * 1.5) * 0.08);
        col *= mix(0.5, 1.15, shadow);

        // Sharp outline
        float outline = smoothstep(0.025, 0.0, abs(body));
        col += outline * vec3(0.9, 0.85, 0.8) * (0.15 + pulse * 0.6);

        // Background — subtle geometric pattern
        float bgPattern = 0.0;
        bgPattern += smoothstep(0.04, 0.0, abs(fract(uv.x * 4.0 + uv.y * 4.0) - 0.5)) * 0.08;
        bgPattern += smoothstep(0.04, 0.0, abs(fract(uv.x * 4.0 - uv.y * 4.0) - 0.5)) * 0.08;
        vec3 bg = vec3(0.03, 0.03, 0.04) + hueCycle * bgPattern * 0.3;
        bg += hueCycle * pulse * 0.12;

        col = mix(bg, col, inside + outline * 0.5);
        float vignette = 1.0 - dot(uv, uv) * 0.65;
        col *= max(0.0, vignette);
        col = max(col, vec3(0.025));

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
    this.foldStep = (this.foldStep + 1) % 10;
    this.foldPhase = 0;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['origami'] = OrigamiPreset;
})();
