(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GlitchRainPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
  }

  setup(container) {
    this.destroy();
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
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

        preset._time += 0.012 + preset.audio.mid * 0.018 + preset.audio.treble * 0.004;
        preset.beatPulse *= 0.87;

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
      uniform vec2 u_resolution;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(41.0, 289.0))) * 43758.5453);
      }

      float hash11(float n) {
        return fract(sin(n * 127.1) * 43758.5453);
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
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
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
        vec2 suv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float t = u_time;
        float beatGate = smoothstep(0.12, 0.8, u_beat);

        float blockScale = 22.0 + u_bass * 90.0 + beatGate * 40.0;
        vec2 grid = floor(uv * blockScale);
        float id = grid.x + grid.y * blockScale;
        float drop = fract(hash11(grid.x * 9.3) + t * (0.25 + u_mid * 1.8));
        float streak = smoothstep(0.16 + u_mid * 0.08, 0.0, abs(fract(uv.y * (14.0 + u_mid * 28.0) + drop) - 0.5));
        float block = smoothstep(0.65 - u_rms * 0.18, 1.0, hash11(id + floor(t * 12.0)));

        vec2 glitchUv = uv;
        float sweep = smoothstep(0.0, 1.0, sin((uv.y + t * 2.0) * (8.0 + u_mid * 8.0)) * 0.5 + 0.5);
        glitchUv.x += (hash11(floor(uv.y * (50.0 + u_mid * 80.0)) + floor(t * 24.0)) - 0.5) * (0.01 + u_treble * 0.08 + beatGate * 0.14);
        glitchUv.y += (hash11(floor(uv.x * 90.0) + floor(t * 18.0)) - 0.5) * beatGate * 0.05;
        glitchUv.x += sin(uv.y * 42.0 + u_beat * 18.0) * u_beat * 0.03;

        float stripe = smoothstep(0.48, 0.4, abs(fract(glitchUv.x * (40.0 + u_treble * 120.0)) - 0.5));
        float noiseField = hash21(floor(glitchUv * vec2(120.0 + u_rms * 180.0, 80.0 + u_rms * 140.0) + t * 20.0));
        float density = smoothstep(0.7 - u_rms * 0.35, 1.0, noiseField);

        vec3 base = vec3(0.02, 0.03, 0.05);
        base += vec3(0.06, 0.08, 0.1) * density * (0.25 + u_rms * 0.8);

        vec3 rainCol = vec3(0.08, 0.95, 0.78) * streak * (0.2 + u_mid * 0.75);
        rainCol += vec3(0.16, 0.4, 1.0) * block * (0.15 + u_bass * 0.8);
        rainCol += vec3(1.0, 0.2, 0.2) * stripe * u_treble * 0.16;

        float shift = 0.004 + u_treble * 0.04 + beatGate * 0.08;
        float r = hash21(floor((glitchUv + vec2(shift, 0.0)) * (80.0 + blockScale)));
        float g = hash21(floor(glitchUv * (80.0 + blockScale) + t * 12.0));
        float b = hash21(floor((glitchUv - vec2(shift, 0.0)) * (80.0 + blockScale)));
        vec3 rgbSplit = vec3(r, g, b) * (0.1 + u_treble * 0.9 + beatGate * 0.8);

        float collapse = smoothstep(0.2, 0.9, beatGate);
        vec2 storm = suv;
        storm.x += sin(storm.y * 18.0 + t * 12.0) * collapse * 0.18;
        storm.y += cos(storm.x * 12.0 - t * 9.0) * collapse * 0.08;
        float fullGlitch = smoothstep(0.62, 1.0, hash21(floor((storm + 1.4) * (35.0 + u_bass * 45.0) + t * 30.0)));

        vec3 col = base + rainCol + rgbSplit * 0.3;
        col += vec3(1.0, 0.95, 0.9) * fullGlitch * collapse * (0.08 + u_beat * 0.9 + u_bass * 0.1);
        col = mix(col, vec3(g, b, r), collapse * fullGlitch * 0.55);
        col *= 1.0 - sweep * 0.08;

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

  onBeat(strength) {
    this.beatPulse = Math.min(1, strength);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['glitch-rain'] = GlitchRainPreset;
})();
