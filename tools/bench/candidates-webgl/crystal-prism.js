(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CrystalPrismPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._time = 0;
    this._sBass = 0;
    this._sMid = 0;
    this._sTreble = 0;
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
        const k = 0.12;
        preset._sBass += (preset.audio.bass - preset._sBass) * k;
        preset._sMid += (preset.audio.mid - preset._sMid) * k;
        preset._sTreble += (preset.audio.treble - preset._sTreble) * k;
        preset._time += 0.025 + preset._sBass * 0.04;
        preset.beatPulse *= 0.88;
        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset._sBass);
          preset._shader.setUniform('u_mid', preset._sMid);
          preset._shader.setUniform('u_treble', preset._sTreble);
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

      // Rotation matrices
      mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1,0,0, 0,c,-s, 0,s,c); }
      mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c,0,s, 0,1,0, -s,0,c); }
      mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c,-s,0, s,c,0, 0,0,1); }

      // Octahedron SDF
      float sdOctahedron(vec3 p, float s) {
        p = abs(p);
        float m = p.x + p.y + p.z - s;
        vec3 q;
        if (3.0 * p.x < m) q = p.xyz;
        else if (3.0 * p.y < m) q = p.yzx;
        else if (3.0 * p.z < m) q = p.zxy;
        else return m * 0.57735027;
        float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);
        return length(vec3(q.x, q.y - s + k, q.z - k));
      }

      // Hash for stars
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // Rainbow color from angle
      vec3 rainbow(float t) {
        return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67)));
      }

      // Scene SDF
      float crystalSize;
      mat3 crystalRot;

      float map(vec3 p) {
        vec3 rp = crystalRot * p;
        return sdOctahedron(rp, crystalSize);
      }

      // Normal via central differences
      vec3 calcNormal(vec3 p) {
        vec2 e = vec2(0.001, 0.0);
        return normalize(vec3(
          map(p + e.xyy) - map(p - e.xyy),
          map(p + e.yxy) - map(p - e.yxy),
          map(p + e.yyx) - map(p - e.yyx)
        ));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Crystal parameters
        crystalSize = 0.7 + u_bass * 0.3 + u_beat * 0.15;
        float rotSpeed = 0.15 + u_bass * 0.1;
        crystalRot = rotY(u_time * rotSpeed) * rotX(sin(u_time * 0.13) * 0.6) * rotZ(cos(u_time * 0.09) * 0.4);

        // Background: dark gradient with stars
        vec3 bgCol = mix(vec3(0.02, 0.01, 0.05), vec3(0.06, 0.02, 0.1), uv.y * 0.5 + 0.5);
        vec2 starUV = uv * 8.0;
        float star = hash(floor(starUV));
        float sparkle = smoothstep(0.97, 1.0, star) * (0.5 + 0.5 * sin(u_time * 3.0 + star * 40.0));
        sparkle *= (0.3 + u_treble * 0.7);
        bgCol += vec3(sparkle * 0.6, sparkle * 0.7, sparkle);

        // Camera
        vec3 ro = vec3(0.0, 0.0, 3.2);
        vec3 rd = normalize(vec3(uv, -1.5));

        // Raymarch (50 steps max for mobile)
        float t = 0.0;
        float d;
        bool hit = false;
        for (int i = 0; i < 50; i++) {
          vec3 p = ro + rd * t;
          d = map(p);
          if (d < 0.001) { hit = true; break; }
          if (t > 10.0) break;
          t += d;
        }

        vec3 col = bgCol;

        if (hit) {
          vec3 pos = ro + rd * t;
          vec3 nor = calcNormal(pos);

          // Fresnel
          float fresnel = pow(1.0 - abs(dot(nor, -rd)), 3.0);
          fresnel = mix(0.1, 1.0, fresnel);

          // Reflection direction
          vec3 ref = reflect(rd, nor);

          // Internal refraction - chromatic aberration for rainbow caustics
          float ior = 1.45;
          float spread = 0.06 + u_mid * 0.08;
          vec3 refractR = refract(rd, nor, 1.0 / (ior - spread));
          vec3 refractG = refract(rd, nor, 1.0 / ior);
          vec3 refractB = refract(rd, nor, 1.0 / (ior + spread));

          // Internal caustic colors from refracted rays
          float causticR = 0.5 + 0.5 * sin(dot(refractR, vec3(1.0, 2.0, 3.0)) * 8.0 + u_time * 2.0);
          float causticG = 0.5 + 0.5 * sin(dot(refractG, vec3(2.0, 3.0, 1.0)) * 8.0 + u_time * 2.3);
          float causticB = 0.5 + 0.5 * sin(dot(refractB, vec3(3.0, 1.0, 2.0)) * 8.0 + u_time * 2.7);
          vec3 caustics = vec3(causticR, causticG, causticB);

          // Rainbow internal color based on normal direction + mid audio
          float rainbowPhase = dot(crystalRot * nor, vec3(0.5, 0.8, 0.3)) + u_time * 0.5;
          vec3 internalRainbow = rainbow(rainbowPhase) * (0.5 + u_mid * 0.8);

          // Facet variation: different facets catch light differently
          vec3 rotNor = crystalRot * nor;
          float facetID = floor(dot(abs(rotNor), vec3(3.0, 5.0, 7.0)) * 2.0);
          float facetBright = 0.6 + 0.4 * sin(facetID * 1.618 + u_time);

          // Combine internal color
          vec3 internalCol = mix(caustics, internalRainbow, 0.5) * facetBright;
          internalCol *= (0.6 + u_mid * 0.6);

          // Specular highlights (treble-driven sparkle)
          float spec = pow(max(dot(ref, vec3(0.577)), 0.0), 32.0);
          spec += pow(max(dot(ref, normalize(vec3(-0.5, 0.7, 0.3))), 0.0), 64.0);
          float specIntensity = (0.3 + u_treble * 1.5);
          vec3 specCol = vec3(1.0, 0.95, 0.9) * spec * specIntensity;

          // Reflection environment (fake sky gradient)
          vec3 envCol = mix(vec3(0.05, 0.02, 0.1), vec3(0.2, 0.15, 0.35), ref.y * 0.5 + 0.5);
          envCol += rainbow(ref.x * 0.3 + ref.y * 0.5 + u_time * 0.2) * 0.15;

          // Final crystal color: mix internal and reflection via fresnel
          col = mix(internalCol, envCol, fresnel) + specCol;

          // Edge glow
          float edge = 1.0 - abs(dot(nor, -rd));
          col += vec3(0.3, 0.5, 1.0) * pow(edge, 4.0) * 0.4;

          // Beat flash: prismatic burst
          float beatFlash = u_beat * u_beat;
          col += rainbow(length(uv) * 2.0 - u_time * 3.0) * beatFlash * 1.5;
          col += vec3(1.0) * beatFlash * 0.3;
        }

        // Beat ambient flash on background too
        col += rainbow(length(uv) * 3.0 + u_time) * u_beat * 0.2;

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
window.VJamFX.presets['crystal-prism'] = CrystalPrismPreset;
})();
