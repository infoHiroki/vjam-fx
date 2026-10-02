(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SdfShapesPreset extends BasePreset {
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
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        p.createCanvas(w, h, p.WEBGL);
        p.pixelDensity(1);
      };

      p.draw = () => {
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }
        preset._time += 0.03 + preset.audio.bass * 0.05;
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
        } catch (e) {
          // noop
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
      uniform float u_beat;
      uniform vec2 u_resolution;

      // SDF primitives
      float sdSphere(vec3 p, float r) {
        return length(p) - r;
      }

      float sdTorus(vec3 p, vec2 t) {
        vec2 q = vec2(length(p.xz) - t.x, p.y);
        return length(q) - t.y;
      }

      float sdBox(vec3 p, vec3 b) {
        vec3 q = abs(p) - b;
        return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
      }

      float sdOctahedron(vec3 p, float s) {
        p = abs(p);
        return (p.x + p.y + p.z - s) * 0.57735027;
      }

      // Smooth min for organic blending
      float smin(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
      }

      // Rotation
      mat2 rot2(float a) {
        float c = cos(a), s = sin(a);
        return mat2(c, -s, s, c);
      }

      float scene(vec3 p) {
        float t = u_time;

        // Breathing sphere (smaller)
        float sphereR = 0.35 + u_bass * 0.15 + u_beat * 0.1;
        float sphere = sdSphere(p, sphereR);

        // Orbiting torus
        vec3 tp = p;
        tp.xz *= rot2(t * 0.5);
        tp.xy *= rot2(t * 0.3 + u_mid);
        float torus = sdTorus(tp, vec2(0.7 + u_mid * 0.15, 0.1 + u_treble * 0.06));

        // Second torus perpendicular
        vec3 tp2 = p;
        tp2.yz *= rot2(t * 0.4);
        tp2.xz *= rot2(t * 0.6 + u_treble);
        float torus2 = sdTorus(tp2, vec2(0.7 + u_treble * 0.15, 0.08 + u_bass * 0.05));

        // Octahedron
        vec3 op = p;
        op.xy *= rot2(t * 0.2);
        op.yz *= rot2(t * 0.3);
        float octa = sdOctahedron(op, 0.5 + u_mid * 0.2) - 0.02;

        // Smooth blend: bass controls blend softness
        float k = 0.3 + u_bass * 0.5 + u_beat * 0.4;
        float d = smin(sphere, torus, k);
        d = smin(d, torus2, k);

        // Beat: morph toward octahedron
        d = mix(d, smin(d, octa, k * 0.5), u_beat * 0.6);

        return d;
      }

      vec3 calcNormal(vec3 p) {
        const float e = 0.001;
        return normalize(vec3(
          scene(p + vec3(e, 0, 0)) - scene(p - vec3(e, 0, 0)),
          scene(p + vec3(0, e, 0)) - scene(p - vec3(0, e, 0)),
          scene(p + vec3(0, 0, e)) - scene(p - vec3(0, 0, e))
        ));
      }

      void main() {
        // gl_FragCoord based UV (bypasses p5.js tex coord issues)
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Camera — smooth orbit at comfortable distance
        float camAngle = u_time * 0.3;
        float camDist = 3.0 + sin(u_time * 0.15) * 0.3;
        vec3 ro = vec3(cos(camAngle) * camDist, sin(u_time * 0.2) * 0.5, sin(camAngle) * camDist);
        vec3 ta = vec3(0.0);
        vec3 ww = normalize(ta - ro);
        vec3 uu = normalize(cross(ww, vec3(0, 1, 0)));
        vec3 vv = cross(uu, ww);
        vec3 rd = normalize(uv.x * uu + uv.y * vv + 2.0 * ww);

        // Ray march
        float t = 0.0;
        float d;
        for (int i = 0; i < 64; i++) {
          d = scene(ro + rd * t);
          if (d < 0.001 || t > 20.0) break;
          t += d;
        }

        vec3 col = vec3(0.0);

        if (t < 20.0) {
          vec3 pos = ro + rd * t;
          vec3 nor = calcNormal(pos);

          // Lighting
          vec3 lightDir = normalize(vec3(1.0, 1.0, -0.5));
          float diff = max(dot(nor, lightDir), 0.0);
          float spec = pow(max(dot(reflect(-lightDir, nor), -rd), 0.0), 32.0);
          float fres = pow(1.0 - max(dot(nor, -rd), 0.0), 3.0);

          // Color based on normal + time
          vec3 baseCol = 0.5 + 0.5 * cos(u_time * 0.5 + nor * 2.0 + vec3(0, 2, 4));
          col = baseCol * (diff * 0.8 + 0.2);
          col += vec3(1.0) * spec * 0.6;
          col += baseCol * fres * 0.4;

          // Rim glow on beat
          col += vec3(0.3, 0.6, 1.0) * fres * u_beat * 2.0;

          // AO approximation
          float ao = 1.0 - smoothstep(0.0, 0.5, scene(pos + nor * 0.1) / 0.1);
          col *= 0.7 + 0.3 * ao;
        }

        // Background gradient
        vec3 bg = vec3(0.02, 0.01, 0.05) + rd.y * 0.05;
        col = mix(bg, col, step(0.001, 20.0 - t));

        // Overall brightness
        col *= 1.3 + u_bass * 0.3;

        // Beat flash
        col = mix(col, vec3(1.0), u_beat * 0.3);

        gl_FragColor = vec4(col, 1.0);
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
    this.audio.strength = audioData.strength || 0;
  }

  onBeat(strength) {
    this.beatPulse = strength;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['sdf-shapes'] = SdfShapesPreset;
})();
