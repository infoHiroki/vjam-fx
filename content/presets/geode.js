(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GeodePreset extends BasePreset {
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

        preset._time += 0.009 + preset.audio.mid * 0.016 + preset.audio.treble * 0.02;
        preset.beatPulse *= 0.9;

        try {
          p.background(0);
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
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

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        rgb = rgb * rgb * (3.0 - 2.0 * rgb);
        return c.z * mix(vec3(1.0), rgb, c.y);
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
        vec2 audioDrift = vec2(sin(u_time * 0.3) * 1.5 + 1.5, sin(u_time * 0.23) * 1.5 + 1.5);
        uv += vec2(sin(u_time * 0.15), cos(u_time * 0.12)) * 0.06;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        vec2 suv = uv;
        float r = length(uv);
        float ang = atan(uv.y, uv.x);

        float cavity = 0.18 + u_bass * 0.18 + u_beat * 0.04;
        float layerSeed = floor(u_time * (0.25 + u_beat * 1.15));
        float layers = 7.0 + floor(u_beat * 6.0);
        float bandFreq = 18.0 + layers * 2.0 + u_mid * 9.0;
        float wobble = noise(vec2(ang * 2.8 + layerSeed, r * 9.0 - u_time * 0.25));
        float strata = r + wobble * 0.08 + sin(ang * (5.0 + u_mid * 7.0) + u_time * 0.35) * 0.03;
        float rawBand = strata * bandFreq - u_time * 0.1;
        float band = rawBand - floor(rawBand);
        band = smoothstep(0.0, 0.08, band) * smoothstep(1.0, 0.92, band) * band + (1.0 - smoothstep(0.0, 0.08, band) * smoothstep(1.0, 0.92, band)) * band;

        float edgeJag = noise(vec2(ang * (14.0 + u_mid * 10.0), layerSeed + 3.0)) * 0.08;
        float crystalRing = smoothstep(cavity + 0.34 + edgeJag, cavity + 0.04 + edgeJag, r);
        float shellRing = smoothstep(1.0, cavity + 0.16, r);

        float protrusionFreq = 22.0 + u_treble * 45.0 + u_bass * 16.0;
        float spikeAngle = ang + noise(vec2(ang * 3.0, r * 5.0)) * 0.3;
        float spikes = pow(max(0.0, sin(spikeAngle * protrusionFreq + u_time * (1.2 + u_treble * 4.0)) * 0.5 + 0.5), 2.0 + u_bass * 5.0);
        float crystalEdge = smoothstep(cavity + 0.12 + spikes * (0.18 + u_bass * 0.22), cavity - 0.02, r);

        float hueDrift = u_time * (0.03 + u_mid * 0.28) + band * 0.12;
        vec3 shellA = hsv2rgb(vec3(fract(0.62 + hueDrift), 0.55, 0.35 + u_rms * 0.25));
        vec3 shellB = hsv2rgb(vec3(fract(0.84 + hueDrift * 1.2), 0.6, 0.6 + u_rms * 0.2));
        vec3 shellC = hsv2rgb(vec3(fract(0.08 + hueDrift * 0.8), 0.72, 0.82));
        vec3 shellCol = mix(shellA, shellB, smoothstep(0.18, 0.82, band));
        shellCol = mix(shellCol, shellC, smoothstep(0.78, 1.0, band));

        float shellVein = noise(vec2(ang * 9.0, r * 22.0) + u_time * 0.15) * (0.22 + u_mid * 0.38);
        shellCol += shellVein * vec3(0.08, 0.1, 0.14);

        float sparkleField = noise(vec2(ang * (30.0 + u_treble * 40.0), r * 50.0 - u_time * (4.0 + u_treble * 12.0)));
        float sparkle = pow(max(0.0, sparkleField - (0.72 - u_treble * 0.24)), 3.5) * crystalRing;
        vec3 crystalCol = mix(
          hsv2rgb(vec3(fract(0.58 + hueDrift * 1.4), 0.4, 0.55 + u_rms * 0.3)),
          hsv2rgb(vec3(fract(0.72 + hueDrift * 1.8), 0.3 + u_treble * 0.25, 1.0)),
          spikes
        );
        crystalCol += sparkle * vec3(1.0, 0.98, 1.0) * (0.5 + u_treble * 1.6 + u_beat * 0.5);

        float transparency = 0.65 + u_rms * 0.55;
        float innerGlow = exp(-max(r - cavity, 0.0) * 9.0) * (0.15 + u_rms * 0.6 + u_beat * 0.4);

        vec3 col = vec3(0.015, 0.015, 0.02);
        col += shellCol * shellRing * transparency;
        col = mix(col, crystalCol * (0.8 + u_bass * 0.5), crystalEdge);
        col += innerGlow * vec3(0.35, 0.5, 0.75);
        col += vec3(0.06, 0.09, 0.14) * u_rms * shellRing;
        col *= 1.0 - dot(suv, suv) * 0.35;

        gl_FragColor = vec4(audioReactiveFinalize(max(col, 0.0), uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
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
    this.beatPulse = Math.min(1, Math.max(this.beatPulse, strength || 0));
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['geode'] = GeodePreset;
})();
