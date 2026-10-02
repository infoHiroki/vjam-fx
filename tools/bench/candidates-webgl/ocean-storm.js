(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class OceanStormPreset extends BasePreset {
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

      float hash1(float n) {
        return fract(sin(n) * 43758.5453);
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

      // FBM for clouds and foam (3 octaves for performance)
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      // Gerstner-like wave
      float gerstnerWave(vec2 pos, vec2 dir, float freq, float amp, float speed, float steep) {
        float phase = dot(dir, pos) * freq + u_time * speed;
        return amp * pow((sin(phase) * 0.5 + 0.5), steep);
      }

      // Combined ocean height — 7 layers, much choppier
      float oceanHeight(vec2 pos) {
        float waveAmp = 0.2 + u_bass * 0.25 + u_beat * 0.5;
        float waveSpeed = 1.2 + u_mid * 2.0;
        float chop = 1.0 + u_bass * 0.6;

        float h = 0.0;
        // Wave 1: massive dominant swell
        h += gerstnerWave(pos, normalize(vec2(1.0, 0.2)), 1.0, waveAmp, waveSpeed * 0.7, 1.2 * chop);
        // Wave 2: strong cross swell
        h += gerstnerWave(pos, normalize(vec2(-0.6, 1.0)), 1.5, waveAmp * 0.7, waveSpeed * 1.0, 1.5 * chop);
        // Wave 3: aggressive chop
        h += gerstnerWave(pos, normalize(vec2(0.8, -0.5)), 2.5, waveAmp * 0.45, waveSpeed * 1.3, 1.8 * chop);
        // Wave 4: cross chop
        h += gerstnerWave(pos, normalize(vec2(-0.4, -0.9)), 3.5, waveAmp * 0.3, waveSpeed * 1.6, 2.0 * chop);
        // Wave 5: rough detail
        h += gerstnerWave(pos, normalize(vec2(0.9, 0.6)), 5.0, waveAmp * 0.2, waveSpeed * 2.0, 1.6);
        // Wave 6: fine turbulence
        h += gerstnerWave(pos, normalize(vec2(-0.7, 0.3)), 7.0, waveAmp * 0.12, waveSpeed * 2.4, 1.3);
        // Wave 7: micro chop
        h += gerstnerWave(pos, normalize(vec2(0.3, -0.7)), 10.0, waveAmp * 0.07, waveSpeed * 2.8, 1.1);

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

      // Lightning bolt branching
      float lightning(vec2 uv, float seed) {
        float bolt = 0.0;
        vec2 p = vec2(hash1(seed * 13.7) * 0.6 - 0.3, 0.5);
        for (int i = 0; i < 6; i++) {
          p.y -= 0.08;
          p.x += (hash1(seed + float(i) * 7.3) - 0.5) * 0.15;
          float d = length(uv - p);
          bolt += 0.003 / (d + 0.002);
        }
        return bolt;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Camera: lower, more tilted — feeling of being ON the stormy water
        vec3 camPos = vec3(0.0, 1.6 + u_beat * 0.4, -2.0);
        vec3 camTarget = vec3(0.0, -0.3, 3.0);
        vec3 camFwd = normalize(camTarget - camPos);
        vec3 camRight = normalize(cross(camFwd, vec3(0.0, 1.0, 0.0)));
        vec3 camUp = cross(camRight, camFwd);

        vec3 rd = normalize(camFwd + uv.x * camRight + uv.y * camUp);

        // Stormy sky — dark gray-green with heavy cloud FBM
        vec3 skyDark = vec3(0.04, 0.05, 0.06);
        vec3 skyMid = vec3(0.07, 0.08, 0.1);
        float skyGrad = clamp(rd.y * 2.0 + 0.3, 0.0, 1.0);
        vec3 skyColor = mix(skyMid, skyDark, skyGrad);

        // Heavy storm clouds
        vec2 cloudUV = rd.xz / (rd.y + 0.3) * 2.0;
        float clouds = fbm(cloudUV * 1.5 + u_time * 0.05);
        float cloudDark = fbm(cloudUV * 3.0 - u_time * 0.03);
        skyColor *= 0.6 + clouds * 0.5;
        skyColor -= vec3(0.02) * cloudDark;
        skyColor = max(skyColor, vec3(0.0));

        // Lightning flash on beat
        float lightningFlash = u_beat * u_beat;
        vec3 flashColor = vec3(0.8, 0.85, 1.0);
        skyColor += flashColor * lightningFlash * 0.6;

        // Lightning bolt shapes on strong beats
        if (u_beat > 0.3) {
          float bolt = lightning(uv, floor(u_time * 3.0));
          bolt += lightning(uv * 1.1 + vec2(0.1, 0.0), floor(u_time * 3.0) + 100.0) * 0.5;
          skyColor += flashColor * bolt * u_beat * 0.8;
        }

        // No real sun — dim diffuse light through clouds
        vec3 sunDir = normalize(vec3(0.3, 0.25, 1.0));
        vec3 sunColor = vec3(0.5, 0.5, 0.55);

        // Raymarch ocean surface
        vec3 col = skyColor;
        float t = 0.0;
        bool hit = false;
        vec3 hitPos = vec3(0.0);

        for (int i = 0; i < 45; i++) {
          vec3 pos = camPos + rd * t;
          float h = oceanHeight(pos.xz);
          float dist = pos.y - h;

          if (dist < 0.01) {
            hit = true;
            hitPos = pos;
            break;
          }

          t += max(dist * 0.4, 0.04);

          if (t > 50.0) break;
        }

        if (hit) {
          vec3 normal = oceanNormal(hitPos.xz);
          vec3 viewDir = normalize(camPos - hitPos);

          // Fresnel
          float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);
          fresnel = mix(0.06, 1.0, fresnel);

          // Dark stormy green-gray water colors
          vec3 deepColor = vec3(0.01, 0.04, 0.05);
          vec3 shallowColor = vec3(0.03, 0.1, 0.08);
          float depthFactor = clamp(oceanHeight(hitPos.xz) * 2.5, 0.0, 1.0);
          vec3 waterColor = mix(deepColor, shallowColor, depthFactor);

          // Lightning illuminates water surface
          waterColor += vec3(0.05, 0.07, 0.1) * lightningFlash;

          // Reflection
          vec3 reflDir = reflect(-viewDir, normal);
          float reflSky = clamp(reflDir.y * 2.0 + 0.3, 0.0, 1.0);
          vec3 reflColor = mix(skyMid * 0.8, skyDark, reflSky);
          reflColor += flashColor * lightningFlash * 0.3;

          // Dim specular (no bright sun, just diffuse cloud light)
          float spec = pow(max(dot(reflDir, sunDir), 0.0), 64.0);
          reflColor += sunColor * spec * 0.5;

          // Subtle SSS
          float sss = pow(max(dot(viewDir, -sunDir + normal * 0.5), 0.0), 3.0);
          vec3 sssColor = vec3(0.0, 0.15, 0.2) * sss * 0.15;

          // Combine via fresnel
          col = mix(waterColor + sssColor, reflColor, fresnel);

          // Heavy foam / whitecaps — lower threshold, more turbulent
          float waveH = oceanHeight(hitPos.xz);
          float foamThreshold = 0.1 - u_treble * 0.06 - u_bass * 0.04;
          float foamAmount = smoothstep(foamThreshold, foamThreshold + 0.08, waveH);
          float foamTex = fbm(hitPos.xz * 8.0 + u_time * 0.5);
          float foamTex2 = fbm(hitPos.xz * 15.0 - u_time * 0.3);
          foamAmount *= max(foamTex, foamTex2 * 0.7);
          foamAmount *= (0.8 + u_treble * 1.0);
          vec3 foamColor = vec3(0.65, 0.7, 0.72);
          col = mix(col, foamColor, clamp(foamAmount, 0.0, 0.8));

          // Spray particles near wave peaks
          float sprayH = smoothstep(0.25, 0.5, waveH);
          float spray = hash(floor(hitPos.xz * 20.0 + u_time * 2.0)) * sprayH;
          spray *= step(0.7, hash(floor(hitPos.xz * 30.0)));
          spray *= (0.5 + u_treble * 1.5);
          col += vec3(0.6, 0.65, 0.7) * spray * 0.5;

          // Heavier distance fog — oppressive atmosphere
          float fogDist = length(hitPos - camPos);
          float fog = 1.0 - exp(-fogDist * 0.05);
          vec3 fogColor = vec3(0.04, 0.05, 0.07) + flashColor * lightningFlash * 0.1;
          col = mix(col, fogColor, fog);
        }

        // Rain — diagonal streaks across the screen
        float rainUV_x = uv.x + uv.y * 0.4 + u_time * 0.8;
        float rainUV_y = uv.y - u_time * 3.0;
        float rain = hash(floor(vec2(rainUV_x * 80.0, rainUV_y * 20.0)));
        rain = step(0.97, rain) * 0.12;
        col += vec3(0.3, 0.33, 0.35) * rain;

        // Horizon glow — muted, stormy
        float horizonGlow = exp(-abs(rd.y) * 10.0) * 0.08;
        col += vec3(0.05, 0.06, 0.08) * horizonGlow;

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
window.VJamFX.presets['ocean-storm'] = OceanStormPreset;
})();
