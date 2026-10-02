(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class OilPaintingPreset extends BasePreset {
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

        preset._time += 0.007 + preset.audio.treble * 0.004 + preset.audio.rms * 0.003;
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

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      vec3 palette(float t) {
        vec3 a = vec3(0.22, 0.2, 0.24);
        vec3 b = vec3(0.42, 0.36, 0.34);
        vec3 c = vec3(1.0, 1.0, 1.0) + vec3(0.08, 0.12, 0.16) * u_beat;
        vec3 d = vec3(t + u_time * 0.06 + u_treble * 0.4, t + 0.33 + u_mid * 0.18, t + 0.67 + u_bass * 0.2);
        return a + b * cos(6.28318 * (c * t + d));
      }

      float strokeBand(vec2 uv, vec2 center, vec2 dir, float width, float lengthScale, float ridge) {
        vec2 q = uv - center;
        float along = dot(q, dir);
        float across = dot(q, vec2(-dir.y, dir.x));
        float body = exp(-abs(across) / width) * exp(-along * along / lengthScale);
        float bristle = 0.55 + 0.45 * sin(along * (22.0 + 18.0 * u_mid) + ridge * 6.28318 + u_time * (0.8 + u_treble));
        bristle += 0.25 * cos(across * (30.0 + 16.0 * u_treble) + u_bass * 7.0);
        return body * max(bristle, 0.0);
      }

      float heightField(vec2 uv) {
        float h = 0.0;
        float beatPhase = floor(fract(u_time * 0.18 + u_beat * 0.8) * 9.0);
        float layers = 0.75 + u_beat * 0.9;
        vec2 scroll = vec2(fract(u_time * (0.09 + u_mid * 0.04)), fract(u_time * (0.05 + u_treble * 0.05))) - 0.5;
        uv += scroll * vec2(1.6, 0.9);
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          vec2 centerFlow = fract(vec2(
            u_time * (0.07 + 0.015 * fi + 0.04 * u_rms) + fi * 0.19 + beatPhase * 0.07,
            u_time * (0.045 + 0.012 * fi + 0.03 * u_mid) + fi * 0.23 + beatPhase * 0.05
          ));
          vec2 center = (centerFlow - 0.5) * vec2(1.1, 1.0);
          float angle = fi * 0.75 + fract(u_time * (0.11 + 0.06 * u_mid) + fi * 0.13) * 6.28318;
          vec2 dir = normalize(rot(angle) * vec2(1.0, 0.18 + 0.2 * sin(fi * 1.7 + u_mid * 4.0)));
          float width = 0.022 + 0.045 * u_bass + 0.01 * sin(fi + u_bass * 8.0);
          float lengthScale = 0.18 + 0.16 * u_rms + 0.06 * u_beat;
          float ridge = hash21(vec2(fi, beatPhase));
          h += strokeBand(uv, center, dir, width, lengthScale, ridge) * (0.3 + 0.22 * fi / 5.0) * layers;
        }
        h += 0.12 * sin((uv.x + uv.y) * (12.0 + u_treble * 14.0) + u_time * (0.6 + u_mid));
        h += 0.08 * cos(length(uv) * (18.0 + 10.0 * u_bass) - u_time * (1.0 + u_rms * 2.0));
        return h;
      }

      vec3 paintColor(vec2 uv, float h) {
        float tone = 0.35 * uv.x + 0.18 * uv.y + 0.2 * h;
        tone += 0.12 * sin(u_time * 0.3 + uv.y * (8.0 + 6.0 * u_mid));
        tone += 0.1 * cos(u_time * 0.22 + uv.x * (10.0 + 8.0 * u_treble));
        vec3 base = palette(tone);
        vec3 accent = palette(tone + 0.18 + 0.22 * u_beat);
        base = mix(base, accent, 0.3 + 0.35 * u_treble);
        base += vec3(0.12, 0.06, 0.02) * u_bass;
        base += vec3(0.08, 0.14, 0.2) * u_mid;
        base += vec3(0.2, 0.18, 0.08) * u_beat;
        return base;
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
          u_time * (0.055 + u_mid * 0.025) + reactScatter * 0.75,
          u_time * (0.048 + u_treble * 0.03) + noise(reactSeed.yx + 4.0) * 0.82
        ));
        vec2 reactCenter = (reactFlow - 0.5) * (0.76 + 0.18 * u_rms) + (reactScatter - 0.5) * 0.14;
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float sweep = fract(u_time * (0.045 + u_mid * 0.02) + reactScatter * 0.18);
        uv *= rot((sweep - 0.5) * 0.42);
        uv += (fract(vec2(
          u_time * (0.085 + u_mid * 0.05) + u_beat * 0.3,
          u_time * (0.062 + u_treble * 0.045) + u_bass * 0.22
        )) - 0.5) * vec2(0.22, 0.14) * (0.35 + u_beat);

        float h = heightField(uv);
        float eps = 0.006 + 0.003 * u_rms;
        float hx = heightField(uv + vec2(eps, 0.0)) - heightField(uv - vec2(eps, 0.0));
        float hy = heightField(uv + vec2(0.0, eps)) - heightField(uv - vec2(0.0, eps));
        vec3 normal = normalize(vec3(-hx * (2.3 + u_bass * 1.4), -hy * (2.1 + u_mid * 1.2), 1.0));

        vec3 lightDir = normalize(vec3(
          -0.35 - 0.3 * sin(u_time * 0.5 + u_mid * 4.0),
          0.55 + 0.2 * cos(u_time * 0.44 + u_bass * 5.0),
          0.9 + 0.7 * u_rms
        ));
        vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
        vec3 halfDir = normalize(lightDir + viewDir);

        float diff = max(dot(normal, lightDir), 0.0);
        float spec = pow(max(dot(normal, halfDir), 0.0), 18.0 + 26.0 * u_rms + 10.0 * u_treble);
        float grazing = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);

        vec3 pigment = paintColor(uv, h);
        vec3 underpaint = palette(0.12 + 0.15 * sin(u_time * 0.11 + u_beat));
        vec3 topLayer = palette(0.65 + 0.18 * cos(u_time * 0.14 + u_treble * 2.0));
        float layerMask = smoothstep(0.18 - 0.08 * u_beat, 0.62 + 0.05 * u_bass, h);
        float freshLayer = smoothstep(
          0.1 - 0.05 * u_beat,
          0.85,
          heightField(uv * (1.18 + 0.12 * u_beat) + vec2(0.22, -0.17) * u_beat)
        ) * u_beat;
        vec3 col = mix(underpaint, pigment, 0.6 + 0.2 * u_mid);
        col = mix(col, topLayer, layerMask * (0.28 + 0.42 * u_beat));
        col = mix(col, palette(0.9 + h * 0.3 + u_bass * 0.2), freshLayer * 0.55);
        col *= 0.5 + 0.75 * diff + 0.2 * u_rms;
        col += vec3(1.0, 0.95, 0.9) * spec * (0.25 + 0.45 * u_rms + 0.2 * u_beat);
        col += vec3(0.24, 0.14, 0.06) * grazing * (0.4 + 0.5 * u_treble);
        col += vec3(0.16, 0.11, 0.08) * h * (0.3 + 0.45 * u_bass);
        col += vec3(0.04, 0.06, 0.12) * sin(h * 8.0 + u_time * (0.8 + u_mid)) * (0.2 + 0.25 * u_mid);

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
window.VJamFX.presets['oil-painting'] = OilPaintingPreset;
})();
