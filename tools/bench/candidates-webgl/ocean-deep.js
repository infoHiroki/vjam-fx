(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class OceanDeepPreset extends BasePreset {
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
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      // Hash for pseudo-random
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Smooth noise
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

      // FBM for foam texture
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      // Gerstner-like wave: returns height and displacement
      float gerstnerWave(vec2 pos, vec2 dir, float freq, float amp, float speed, float steep) {
        float phase = dot(dir, pos) * freq + u_time * speed;
        return amp * pow((sin(phase) * 0.5 + 0.5), steep);
      }

      // Combined ocean height at a point
      float oceanHeight(vec2 pos) {
        float waveAmp = 0.18 + u_bass * 0.2 + u_beat * 0.4;
        float waveSpeed = 1.0 + u_mid * 1.5;

        float h = 0.0;
        // Wave 1: dominant swell
        h += gerstnerWave(pos, normalize(vec2(1.0, 0.3)), 1.2, waveAmp, waveSpeed * 0.8, 1.0);
        // Wave 2: cross swell
        h += gerstnerWave(pos, normalize(vec2(-0.5, 1.0)), 1.8, waveAmp * 0.6, waveSpeed * 1.1, 1.2);
        // Wave 3: chop
        h += gerstnerWave(pos, normalize(vec2(0.7, -0.6)), 3.0, waveAmp * 0.3, waveSpeed * 1.4, 1.5);
        // Wave 4: fine detail
        h += gerstnerWave(pos, normalize(vec2(-0.3, -0.8)), 5.0, waveAmp * 0.15, waveSpeed * 1.8, 1.3);
        // Wave 5: micro ripples
        h += gerstnerWave(pos, normalize(vec2(0.9, 0.5)), 8.0, waveAmp * 0.08, waveSpeed * 2.2, 1.0);

        return h;
      }

      // Compute normal via central differences
      vec3 oceanNormal(vec2 pos) {
        float eps = 0.02;
        float hL = oceanHeight(pos - vec2(eps, 0.0));
        float hR = oceanHeight(pos + vec2(eps, 0.0));
        float hD = oceanHeight(pos - vec2(0.0, eps));
        float hU = oceanHeight(pos + vec2(0.0, eps));
        return normalize(vec3(hL - hR, 2.0 * eps, hD - hU));
      }

      // Stars
      float stars(vec2 p) {
        vec2 id = floor(p * 80.0);
        float rnd = hash(id);
        vec2 center = (id + 0.5) / 80.0;
        float d = length(p - center) * 80.0;
        float brightness = step(0.97, rnd) * smoothstep(0.6, 0.0, d);
        // Twinkle
        brightness *= 0.6 + 0.4 * sin(rnd * 6.28 + u_time * (1.0 + rnd * 2.0));
        return brightness;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Camera setup: lower position for more immersive feel
        vec3 camPos = vec3(0.0, 2.0 + u_beat * 0.5, -3.0);
        vec3 camTarget = vec3(0.0, 0.0, 2.0);
        vec3 camFwd = normalize(camTarget - camPos);
        vec3 camRight = normalize(cross(camFwd, vec3(0.0, 1.0, 0.0)));
        vec3 camUp = cross(camRight, camFwd);

        vec3 rd = normalize(camFwd + uv.x * camRight + uv.y * camUp);

        // Night sky color - very dark
        vec3 skyColorTop = vec3(0.0, 0.005, 0.03);
        vec3 skyColorBot = vec3(0.01, 0.03, 0.08);
        float skyGrad = clamp(rd.y * 2.0 + 0.3, 0.0, 1.0);
        vec3 skyColor = mix(skyColorBot, skyColorTop, skyGrad);

        // Add stars to sky
        if (rd.y > 0.0) {
          float starField = stars(rd.xz / (rd.y + 0.01));
          skyColor += vec3(0.6, 0.7, 1.0) * starField * smoothstep(0.0, 0.15, rd.y);
        }

        // Moon direction: more overhead, cool white-blue
        vec3 sunDir = normalize(vec3(0.3, 0.6, 1.0));
        vec3 sunColor = vec3(0.7, 0.8, 1.0);

        // Raymarch to find ocean surface intersection
        vec3 col = skyColor;
        float t = 0.0;
        bool hit = false;
        vec3 hitPos = vec3(0.0);

        for (int i = 0; i < 50; i++) {
          vec3 pos = camPos + rd * t;
          float h = oceanHeight(pos.xz);
          float dist = pos.y - h;

          if (dist < 0.01) {
            hit = true;
            hitPos = pos;
            break;
          }

          // Adaptive step: larger steps when far from surface
          t += max(dist * 0.5, 0.05);

          if (t > 40.0) break;
        }

        if (hit) {
          vec3 normal = oceanNormal(hitPos.xz);

          // View direction
          vec3 viewDir = normalize(camPos - hitPos);

          // Fresnel: more reflective at glancing angles
          float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);
          fresnel = mix(0.04, 1.0, fresnel);

          // Deep water color - much darker blues
          vec3 deepColor = vec3(0.0, 0.01, 0.08);
          vec3 shallowColor = vec3(0.0, 0.06, 0.18);
          float depthFactor = clamp(oceanHeight(hitPos.xz) * 3.0, 0.0, 1.0);
          vec3 waterColor = mix(deepColor, shallowColor, depthFactor);

          // Reflection (simplified: reflect sky)
          vec3 reflDir = reflect(-viewDir, normal);
          float reflSky = clamp(reflDir.y * 2.0 + 0.3, 0.0, 1.0);
          vec3 reflColor = mix(skyColorBot * 1.3, skyColorTop, reflSky);

          // Moon specular highlight - tighter, brighter moon path
          float spec = pow(max(dot(reflDir, sunDir), 0.0), 256.0);
          reflColor += sunColor * spec * 3.5;

          // Broader moon path on water
          float moonPath = pow(max(dot(reflDir, sunDir), 0.0), 32.0);
          reflColor += sunColor * moonPath * 0.15;

          // Sub-surface scattering - cold cyan
          float sss = pow(max(dot(viewDir, -sunDir + normal * 0.5), 0.0), 3.0);
          vec3 sssColor = vec3(0.0, 0.2, 0.35) * sss * 0.3;

          // Combine via fresnel
          col = mix(waterColor + sssColor, reflColor, fresnel);

          // Bioluminescent foam / whitecaps
          float waveH = oceanHeight(hitPos.xz);
          float foamThreshold = 0.22 - u_treble * 0.1;
          float foamAmount = smoothstep(foamThreshold, foamThreshold + 0.12, waveH);
          float foamTex = fbm(hitPos.xz * 6.0 + u_time * 0.3);
          foamAmount *= foamTex;
          foamAmount *= (0.6 + u_treble * 0.8);
          // Bioluminescent cyan/turquoise foam that pulses with treble
          float bioPulse = 0.7 + 0.3 * sin(u_time * 3.0 + u_treble * 6.0);
          vec3 foamColor = vec3(0.2, 0.8, 0.9) * bioPulse;
          col = mix(col, foamColor, clamp(foamAmount, 0.0, 0.7));

          // Distance fog towards horizon
          float fogDist = length(hitPos - camPos);
          float fog = 1.0 - exp(-fogDist * 0.03);
          col = mix(col, skyColor * 1.1, fog);
        }

        // Horizon glow - subtle cool blue
        float horizonGlow = exp(-abs(rd.y) * 8.0) * 0.1;
        col += vec3(0.02, 0.06, 0.15) * horizonGlow;

        // Tone mapping
        col = col / (col + vec3(1.0));
        col = pow(col, vec3(0.9));

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['ocean-deep'] = OceanDeepPreset;
})();
