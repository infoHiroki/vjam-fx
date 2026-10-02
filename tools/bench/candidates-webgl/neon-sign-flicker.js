(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NeonSignFlickerPreset extends BasePreset {
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

        preset._time += 0.012 + preset.audio.treble * 0.012 + preset.audio.mid * 0.004;
        preset.beatPulse *= 0.88;

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

      float sdBox(vec2 p, vec2 b) {
        vec2 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      }

      float sdSegment(vec2 p, vec2 a, vec2 b) {
        vec2 pa = p - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return length(pa - ba * h);
      }

      float letterV(vec2 p) {
        return min(sdSegment(p, vec2(-0.18, -0.22), vec2(0.0, 0.22)), sdSegment(p, vec2(0.18, -0.22), vec2(0.0, 0.22)));
      }

      float letterJ(vec2 p) {
        float stem = sdSegment(p, vec2(0.12, -0.22), vec2(0.12, 0.18));
        float hook = abs(length(p - vec2(-0.02, 0.14)) - 0.14);
        hook = max(hook, -(p.x + 0.12));
        return min(stem, hook);
      }

      float letterA(vec2 p) {
        float left = sdSegment(p, vec2(-0.2, 0.22), vec2(0.0, -0.22));
        float right = sdSegment(p, vec2(0.2, 0.22), vec2(0.0, -0.22));
        float cross = sdSegment(p, vec2(-0.09, 0.02), vec2(0.09, 0.02));
        return min(min(left, right), cross);
      }

      float letterM(vec2 p) {
        float l = sdSegment(p, vec2(-0.22, 0.22), vec2(-0.22, -0.22));
        float r = sdSegment(p, vec2(0.22, 0.22), vec2(0.22, -0.22));
        float c1 = sdSegment(p, vec2(-0.22, 0.22), vec2(0.0, -0.02));
        float c2 = sdSegment(p, vec2(0.22, 0.22), vec2(0.0, -0.02));
        return min(min(l, r), min(c1, c2));
      }

      float wordVJAM(vec2 p) {
        float s = 0.35;
        float d = 10.0;
        d = min(d, letterV((p - vec2(-0.55, 0.0)) / s) * s);
        d = min(d, letterJ((p - vec2(-0.18, 0.0)) / s) * s);
        d = min(d, letterA((p - vec2(0.18, 0.0)) / s) * s);
        d = min(d, letterM((p - vec2(0.56, 0.0)) / s) * s);
        return d;
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
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
        float t = u_time;

        // Sign movement: both diagonals (upper-right to lower-left AND lower-left to upper-right)
        float movePhase = sin(t * 0.4 + u_mid * 2.0);
        float moveDir = sin(t * 0.17); // alternates direction
        vec2 signOffset = vec2(movePhase * 0.25 * moveDir, movePhase * 0.15 * moveDir);
        // Add perpendicular diagonal (upper-left to lower-right)
        float movePhase2 = sin(t * 0.33 + u_bass * 1.5);
        float moveDir2 = cos(t * 0.21);
        signOffset += vec2(-movePhase2 * 0.2 * moveDir2, movePhase2 * 0.12 * moveDir2);

        vec2 signUv = uv - signOffset;
        signUv.y += sin(signUv.x * 8.0 + t * (0.8 + u_rms * 2.0)) * 0.008 * (0.3 + u_rms);
        signUv.x += sin(signUv.y * 14.0 + t * (1.0 + u_rms * 3.0)) * 0.004 * (0.4 + u_rms);

        float tube = wordVJAM(signUv * vec2(1.25, 1.0));
        float frame = abs(sdBox(uv - signOffset, vec2(0.88, 0.42)) - 0.018);
        float wire = sdSegment(uv, vec2(-0.95, -0.48), vec2(-0.64 + signOffset.x, -0.34 + signOffset.y));
        wire = min(wire, sdSegment(uv, vec2(0.95, -0.48), vec2(0.64 + signOffset.x, -0.34 + signOffset.y)));

        float hum = sin(uv.y * 180.0 + t * (14.0 + u_rms * 35.0)) * 0.5 + 0.5;
        hum += noise(vec2(t * (1.5 + u_rms * 6.0), uv.y * 12.0)) * 0.5;
        hum *= 0.55 + u_rms * 0.9;

        float flickerRate = 3.0 + u_treble * 18.0;
        float flickerA = step(0.18 + u_beat * 0.25, sin(t * flickerRate + noise(vec2(floor(uv.y * 30.0), 1.0)) * 6.0) * 0.5 + 0.5);
        float flickerB = step(0.32, sin(t * (flickerRate * 0.43 + 2.0) + uv.x * 5.0 + u_treble * 4.0) * 0.5 + 0.5);
        float dropout = step(0.82 - u_treble * 0.2, noise(vec2(floor(uv.y * 50.0), floor(t * (6.0 + u_treble * 18.0)))));
        float recovery = smoothstep(0.1, 0.95, u_beat);
        float electrical = mix(flickerA * flickerB, 1.0, recovery);
        electrical *= mix(1.0, 0.18, dropout * (1.0 - recovery));

        float brightness = 0.12 + u_bass * 1.2 + hum * 0.35;
        brightness += u_beat * 1.7;
        brightness *= electrical;

        // Time-based hue cycling for color variation
        float hueCycleTime = t * 0.15 + u_mid * 0.8;
        float gasShift = sin(t * (0.6 + u_mid * 2.5) + uv.x * 3.0 + uv.y * 6.0);
        float gasRipple = noise(uv * (4.0 + u_mid * 6.0) + vec2(t * 0.25, -t * 0.18));
        vec3 gasA = vec3(1.0, 0.22, 0.15) * (0.5 + 0.5 * cos(hueCycleTime * 6.28 + vec3(0.0, 2.1, 4.2)));
        vec3 gasB = vec3(1.0, 0.28, 0.82) * (0.5 + 0.5 * cos(hueCycleTime * 6.28 + vec3(1.0, 3.1, 5.2)));
        vec3 gasC = vec3(0.26, 0.9, 1.0) * (0.5 + 0.5 * cos(hueCycleTime * 6.28 + vec3(2.0, 0.5, 3.8)));
        // Blend between different neon color palettes
        float paletteMix = sin(t * 0.08) * 0.5 + 0.5;
        gasA = mix(gasA, vec3(0.2, 0.8, 1.0), paletteMix * 0.4);
        gasB = mix(gasB, vec3(0.1, 1.0, 0.5), paletteMix * 0.3);
        vec3 tubeColor = mix(gasA, gasB, 0.5 + 0.5 * gasShift);
        tubeColor = mix(tubeColor, gasC, (0.15 + u_mid * 0.35) * gasRipple);
        tubeColor *= 0.65 + u_bass * 0.65 + u_mid * 0.2;

        float core = exp(-tube * (90.0 - u_bass * 20.0));
        float halo = exp(-tube * (18.0 - u_bass * 6.0));
        float bloom = exp(-tube * (5.0 - u_bass * 1.6));
        float frameGlow = exp(-frame * (40.0 - u_bass * 10.0)) * (0.3 + u_bass * 0.6);
        float wireGlow = exp(-wire * 50.0) * (0.15 + u_rms * 0.35);

        vec3 bg = mix(vec3(0.015, 0.01, 0.02), vec3(0.04, 0.02, 0.03), hum * 0.25 + u_rms * 0.2);
        bg += vec3(0.08, 0.03, 0.02) * frameGlow * 0.3;

        vec3 col = bg;
        col += tubeColor * halo * brightness;
        col += tubeColor * bloom * (0.22 + u_bass * 0.3);
        col += vec3(1.0, 0.95, 0.9) * core * (0.2 + brightness * 0.9);
        col += vec3(0.8, 0.18, 0.3) * frameGlow;
        col += vec3(0.6, 0.35, 0.2) * wireGlow;

        float stutter = step(0.88 - u_treble * 0.08, noise(vec2(floor(uv.x * 120.0), floor(t * (8.0 + u_treble * 28.0)))));
        col *= 1.0 - stutter * (0.18 + (1.0 - recovery) * 0.4);

        float allOnFlash = smoothstep(0.18, 0.95, u_beat);
        col += tubeColor * allOnFlash * (0.9 + u_bass * 0.5);
        col += vec3(1.0, 0.85, 0.75) * allOnFlash * core * 1.2;

        float vignette = 1.0 - smoothstep(0.82, 1.35, length(uv * vec2(0.95, 1.1)));
        col *= vignette + 0.08;
        col = 1.0 - exp(-col * (1.0 + u_bass * 0.3 + u_rms * 0.5));

        gl_FragColor = vec4(audioReactiveFinalize(clamp(col, 0.0, 1.0), uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
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

  onBeat(s) {
    this.beatPulse = Math.min(1, s);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['neon-sign-flicker'] = NeonSignFlickerPreset;
})();
