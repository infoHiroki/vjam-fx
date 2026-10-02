(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GlitchCorruptionPreset extends BasePreset {
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

        preset._time += 0.02 + preset.audio.bass * 0.014 + preset.audio.treble * 0.008;
        preset.beatPulse *= 0.86;

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

      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }

      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash2(i);
        float b = hash2(i + vec2(1.0, 0.0));
        float c = hash2(i + vec2(0.0, 1.0));
        float d = hash2(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      vec3 sourcePattern(vec2 uv, float t) {
        vec2 g = uv;
        float bands = sin(g.y * (20.0 + u_treble * 90.0) + t * (1.5 + u_treble * 6.0));
        float diag = sin((g.x + g.y) * 30.0 + t * (2.0 + u_bass * 2.0));
        float grid = sin(g.x * 18.0) * sin(g.y * 14.0);
        float data = noise(g * (8.0 + u_rms * 12.0) + t * 0.7);
        vec3 c = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + diag * 2.5 + data * 3.0);
        c *= 0.45 + 0.35 * bands + 0.25 * grid;
        c += vec3(data * 0.5);
        c += vec3(0.2, 0.1, 0.25) * u_rms;
        return max(c, 0.0);
      }

      vec2 collapseUv(vec2 uv, float t) {
        float strip = floor(uv.y * (22.0 + u_bass * 38.0));
        float block = floor(uv.x * (10.0 + u_bass * 18.0));
        float trigger = hash(strip * 17.13 + block * 3.7 + floor(t * (2.0 + u_bass * 6.0)));
        float collapse = smoothstep(0.45, 1.0, u_bass + u_beat * 0.8) * step(0.55 - u_bass * 0.25, trigger);
        float drop = (hash(strip * 9.1 + floor(t * 11.0)) - 0.5) * collapse * (0.25 + u_bass * 0.45);
        float shear = (hash(block * 5.7 + floor(t * 8.0)) - 0.5) * collapse * (0.2 + u_bass * 0.5);
        uv.y += drop;
        uv.x += shear;
        uv += vec2(0.03, -0.02) * u_beat * step(0.82, trigger);
        return uv;
      }

      vec3 sampledSorted(vec2 uv, float t) {
        vec2 dir = normalize(vec2(1.0, 0.22 + u_mid * 0.9));
        float span = (0.015 + u_bass * 0.08) * (1.0 + u_beat * 0.7);
        vec2 aUv = uv - dir * span;
        vec2 bUv = uv;
        vec2 cUv = uv + dir * span;

        vec3 a = sourcePattern(aUv, t);
        vec3 b = sourcePattern(bUv, t);
        vec3 c = sourcePattern(cUv, t);

        float la = dot(a, vec3(0.299, 0.587, 0.114));
        float lb = dot(b, vec3(0.299, 0.587, 0.114));
        float lc = dot(c, vec3(0.299, 0.587, 0.114));

        vec3 low = a;
        float ll = la;
        if (lb < ll) { low = b; ll = lb; }
        if (lc < ll) { low = c; ll = lc; }

        vec3 high = a;
        float hl = la;
        if (lb > hl) { high = b; hl = lb; }
        if (lc > hl) { high = c; hl = lc; }

        vec3 mid = a + b + c - low - high;
        float sorter = 0.5 + 0.5 * sin(t * (1.0 + u_bass * 3.0) + uv.y * 20.0);
        vec3 sorted = mix(mix(low, mid, sorter), high, clamp(u_bass * 0.7 + u_beat * 1.2, 0.0, 1.0));
        return sorted;
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
        vec2 uv = vUv;
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
        float t = u_time;

        vec2 corrupted = collapseUv(uv, t);
        float channelSplit = 0.004 + u_mid * 0.035 + u_beat * 0.05;
        vec3 base = sampledSorted(corrupted, t);
        float r = sampledSorted(corrupted + vec2(channelSplit, 0.0), t).r;
        float g = base.g;
        float b = sampledSorted(corrupted - vec2(channelSplit, 0.0), t).b;
        vec3 col = vec3(r, g, b);

        float scan = sin((uv.y + noise(vec2(uv.y * 40.0, t))) * u_resolution.y * (0.4 + u_treble * 1.5));
        col *= 0.82 + 0.18 * scan;

        float blockGrid = step(0.85 - u_bass * 0.2, hash2(floor(uv * vec2(18.0 + u_bass * 25.0, 10.0 + u_bass * 18.0)) + floor(t * 3.0)));
        col = mix(col, col.bgr, blockGrid * (u_mid * 0.7 + u_beat * 1.1));

        float snow = hash2(gl_FragCoord.xy + vec2(floor(t * (50.0 + u_treble * 120.0))));
        col += vec3(snow) * (0.03 + u_rms * 0.35 + u_beat * 0.25);

        float teardown = smoothstep(0.2, 1.0, u_beat) * step(0.78, hash(floor(t * 8.0)));
        vec2 fracture = fract(uv * (12.0 + u_bass * 24.0));
        float shard = smoothstep(0.48, 0.0, abs(fracture.x - 0.5)) * smoothstep(0.48, 0.0, abs(fracture.y - 0.5));
        col = mix(col, vec3(1.0), teardown * shard);
        col *= 1.0 - smoothstep(0.75, 1.4, length((uv * 2.0 - 1.0) * vec2(1.0, 1.1))) * 0.24;
        col = pow(max(col, 0.0), vec3(0.9));

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
window.VJamFX.presets['glitch-corruption'] = GlitchCorruptionPreset;
})();
