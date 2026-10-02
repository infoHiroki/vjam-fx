(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MetaballPulsePreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
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
        if (!preset._shader) { preset._shader = preset._initShader(p); if (!preset._shader) return; }
        preset._time += 0.025 + preset.audio.bass * 0.04;
        preset.beatPulse *= 0.88;
        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          p.noStroke();
          p.quad(-1, -1, 1, -1, 1, 1, -1, 1);
        } catch (e) {} finally { p.resetShader(); }
      };
      p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
    }, container);
  }

  _initShader(p) {
    const vert = `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vUv;
      void main() { vUv = aTexCoord; vec4 pos = vec4(aPosition, 1.0); pos.xy = pos.xy * 2.0 - 1.0; gl_Position = pos; }
    `;
    const frag = `
      precision highp float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      float smin(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
      }

      mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

      float sdSphere(vec3 p, float r) { return length(p) - r; }

      float scene(vec3 p) {
        float t = u_time;
        float k = 0.5 + u_bass * 0.8 + u_beat * 0.6;

        // 4 orbiting metaballs
        float d = 1e10;
        for (float i = 0.0; i < 4.0; i++) {
          float angle = t * (0.4 + i * 0.15) + i * 1.571;
          float r = 0.6 + sin(t * 0.3 + i * 2.0) * 0.2 + u_mid * 0.2;
          vec3 offset = vec3(cos(angle) * r, sin(angle * 0.7 + i) * r * 0.5, sin(angle) * r);
          float size = 0.2 + sin(t * 0.5 + i * 1.5) * 0.05 + u_bass * 0.1;
          d = smin(d, sdSphere(p - offset, size), k);
        }

        // Central pulsing sphere
        float center = sdSphere(p, 0.25 + u_bass * 0.15 + u_beat * 0.1);
        d = smin(d, center, k);

        // Beat: extra sphere burst
        if (u_beat > 0.1) {
          float burstR = 0.4 + u_beat * 0.3;
          vec3 burstP = vec3(sin(t * 2.0) * burstR, cos(t * 1.7) * burstR, sin(t * 2.3) * burstR * 0.5);
          d = smin(d, sdSphere(p - burstP, 0.15), k * 1.5);
        }

        return d;
      }

      vec3 calcNormal(vec3 p) {
        const float e = 0.001;
        return normalize(vec3(
          scene(p + vec3(e,0,0)) - scene(p - vec3(e,0,0)),
          scene(p + vec3(0,e,0)) - scene(p - vec3(0,e,0)),
          scene(p + vec3(0,0,e)) - scene(p - vec3(0,0,e))
        ));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float t = u_time;

        // Camera orbiting
        float ca = t * 0.25;
        vec3 ro = vec3(cos(ca) * 2.5, sin(t * 0.15) * 0.6, sin(ca) * 2.5);
        vec3 ta = vec3(0.0);
        vec3 ww = normalize(ta - ro);
        vec3 uu = normalize(cross(ww, vec3(0, 1, 0)));
        vec3 vv = cross(uu, ww);
        vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.8 * ww);

        float dist = 0.0;
        float d;
        for (int i = 0; i < 64; i++) {
          d = scene(ro + rd * dist);
          if (d < 0.001 || dist > 15.0) break;
          dist += d;
        }

        vec3 col = vec3(0.0);
        if (dist < 15.0) {
          vec3 pos = ro + rd * dist;
          vec3 nor = calcNormal(pos);
          vec3 light = normalize(vec3(1, 1, -0.5));

          float diff = max(dot(nor, light), 0.0);
          float spec = pow(max(dot(reflect(-light, nor), -rd), 0.0), 16.0);
          float fres = pow(1.0 - max(dot(nor, -rd), 0.0), 3.0);

          // Iridescent color from normal
          vec3 base = 0.5 + 0.5 * cos(t * 0.3 + pos * 2.0 + vec3(0, 2, 4));
          col = base * (diff * 0.7 + 0.25);
          col += spec * 0.5;
          col += base * fres * 0.5;
          col += vec3(0.5, 0.2, 1.0) * fres * u_beat;
        }

        vec3 bg = vec3(0.02, 0.01, 0.04) + rd.y * 0.03;
        col = mix(bg, col, step(0.001, 15.0 - dist));
        col *= 1.1 + u_bass * 0.2;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['metaball-pulse'] = MetaballPulsePreset;
})();
