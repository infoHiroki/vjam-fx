(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class RainWindowPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._time = 0;
    this._gustTimer = 0;
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
        preset._time += 0.016 + preset._sMid * 0.02;
        preset.beatPulse *= 0.88;
        // Gust decays over ~1 second
        preset._gustTimer = Math.max(0.0, preset._gustTimer - 0.016);
        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset._sBass);
          preset._shader.setUniform('u_mid', preset._sMid);
          preset._shader.setUniform('u_treble', preset._sTreble);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_gust', preset._gustTimer);
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
      uniform float u_gust;
      uniform vec2 u_resolution;

      // --- Hash / noise helpers ---
      float hash11(float n) { return fract(sin(n) * 43758.5453); }
      float hash12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec2  hash21(float n) { return fract(sin(vec2(n, n + 1.0)) * vec2(43758.5453, 22578.1459)); }
      vec2  hash22(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash12(i);
        float b = hash12(i + vec2(1.0, 0.0));
        float c = hash12(i + vec2(0.0, 1.0));
        float d = hash12(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // --- Bokeh city-lights background ---
      // Returns warm/cool blurry light color at uv
      vec3 cityLights(vec2 uv, float t) {
        vec3 col = vec3(0.0);
        // Dark blue-purple night sky gradient
        col = mix(vec3(0.01, 0.01, 0.06), vec3(0.05, 0.02, 0.12), uv.y);

        // Scattered bokeh blobs — fixed positions animated slightly
        for (int i = 0; i < 20; i++) {
          float fi = float(i);
          vec2 seed = hash22(vec2(fi * 3.7, fi * 1.3));
          // Position: spread across screen, slight slow drift
          vec2 pos = seed + vec2(sin(t * 0.05 + fi) * 0.02, cos(t * 0.04 + fi * 1.4) * 0.01);

          float radius = 0.04 + seed.x * 0.12 + u_bass * 0.03;
          float d = length(uv - pos);

          // Soft bokeh falloff
          float bokeh = exp(-d * d / (radius * radius * 0.5));

          // Alternating warm (amber/orange) and cool (cyan/blue/violet) lights
          vec3 lightCol;
          float which = fract(seed.y * 7.3);
          if (which < 0.2) {
            lightCol = vec3(1.0, 0.6, 0.1); // amber
          } else if (which < 0.4) {
            lightCol = vec3(0.2, 0.8, 1.0); // cyan
          } else if (which < 0.6) {
            lightCol = vec3(1.0, 0.2, 0.5); // neon pink
          } else if (which < 0.8) {
            lightCol = vec3(0.4, 0.3, 1.0); // violet
          } else {
            lightCol = vec3(0.9, 1.0, 0.4); // yellow-green
          }

          col += lightCol * bokeh * (0.4 + seed.x * 0.6);
        }

        // Subtle horizontal street-level glow at bottom
        float streetGlow = exp(-uv.y * 6.0) * 0.3;
        col += vec3(0.8, 0.5, 0.1) * streetGlow;

        return col;
      }

      // --- Water film on glass ---
      // Returns a small displacement based on slow-moving film
      vec2 glassFilm(vec2 uv, float t) {
        float n1 = vnoise(uv * 8.0 + vec2(t * 0.04, t * 0.01));
        float n2 = vnoise(uv * 12.0 - vec2(t * 0.02, t * 0.05));
        float film = n1 * 0.6 + n2 * 0.4;
        // Gradient of film used as refraction displacement
        vec2 eps = vec2(0.003, 0.0);
        float dx = vnoise(uv * 8.0 + eps.xy + vec2(t * 0.04)) - vnoise(uv * 8.0 - eps.xy + vec2(t * 0.04));
        float dy = vnoise(uv * 8.0 + eps.yx + vec2(t * 0.04)) - vnoise(uv * 8.0 - eps.yx + vec2(t * 0.04));
        return vec2(dx, dy) * 0.008 * film;
      }

      // --- Single raindrop ---
      // dropId: integer id
      // uv: screen uv (0-1)
      // t: time
      // Returns: (distortion_strength, trail_strength, drop_alpha, sparkle)
      vec4 raindrop(int dropId, vec2 uv, float t, float speed, float rainAmount, float gust) {
        float fi = float(dropId);

        // Per-drop random properties
        vec2 seed = hash22(vec2(fi * 2.71, fi * 1.618));
        vec2 seed2 = hash22(vec2(fi * 5.13, fi * 3.07));

        // Column x position — drops stay roughly in their column
        float colX = seed.x;

        // Drop starts at random y, falls at speed modulated by mid
        float dropSpeed = 0.08 + seed2.x * 0.18 + speed * 0.15;

        // Slight x wobble as the drop slides
        float wobbleFreq = 3.0 + seed.y * 5.0;
        float wobbleAmp  = 0.004 + seed2.y * 0.006;

        // Phase offset so drops don't all start together
        float phase = seed.x * 10.0 + seed2.y * 7.3;

        // Continuous fall (mod 1 for looping)
        float fallY = 1.0 - mod(t * dropSpeed + phase, 1.2);

        // Gust: lateral push that decays
        float gustDir = sign(sin(fi * 7.3)); // each drop has its own gust direction tendency
        float gustShift = gustDir * gust * 0.06;

        float dropX = colX + sin(fallY * wobbleFreq + t) * wobbleAmp + gustShift;

        // Drop body: small oval
        float dropW = 0.008 + rainAmount * 0.006 + seed2.x * 0.004;
        float dropH = 0.016 + rainAmount * 0.008 + seed2.y * 0.006;

        vec2 delta = uv - vec2(dropX, fallY);
        // Aspect correct
        float aspect = u_resolution.x / u_resolution.y;
        delta.x *= aspect;

        float dropDist = length(delta / vec2(dropW * aspect, dropH));

        float dropAlpha = smoothstep(1.0, 0.3, dropDist);

        // Trail above the drop
        float trailLen = 0.05 + rainAmount * 0.08 + seed2.x * 0.04;
        float trailAbove = uv.y - fallY;
        float trailX = uv.x - dropX;
        float trailAlpha = 0.0;
        if (trailAbove > 0.0 && trailAbove < trailLen && abs(trailX * aspect) < dropW * aspect * 0.6) {
          float trailFade = 1.0 - trailAbove / trailLen;
          trailAlpha = trailFade * trailFade * 0.4;
        }

        // Refraction strength inside drop
        float refractStr = dropAlpha * (0.04 + rainAmount * 0.02);

        // Sparkle on drop surface: high-frequency glint
        float sparkle = dropAlpha * max(0.0, sin(dropDist * 30.0 - t * 5.0)) * 0.5;

        return vec4(refractStr, trailAlpha, dropAlpha, sparkle);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;

        // Rain parameters from audio
        float rainAmount = 0.2 + u_bass * 0.8;      // bass = more/bigger drops
        float slideSpeed = u_mid;                     // mid = slide speed
        float gust = u_gust;                          // beat = lateral gust

        // --- Glass film displacement ---
        vec2 filmDisp = glassFilm(uv, u_time);

        // --- Accumulate raindrop contributions ---
        // Max drops constrained by rainAmount to keep perf reasonable
        // We use a fixed loop of 30 drops; rainAmount gates visibility
        vec2 totalRefract = vec2(0.0);
        float totalTrail  = 0.0;
        float totalDrop   = 0.0;
        float totalSparkle = 0.0;

        int numDrops = int(clamp(rainAmount * 30.0, 4.0, 30.0));

        for (int i = 0; i < 30; i++) {
          if (i >= numDrops) break;

          vec4 drop = raindrop(i, uv, u_time, slideSpeed, rainAmount, gust);
          float refr = drop.x;
          float trail = drop.y;
          float alpha = drop.z;
          float sparkle = drop.w;

          // Refraction direction: vertical lens (drops refract scene upward/inward)
          vec2 fi2 = hash22(vec2(float(i) * 2.71, float(i) * 1.618));
          vec2 dropCenter = vec2(fi2.x, 1.0 - mod(u_time * (0.08 + fi2.y * 0.18) + fi2.x * 10.0 + hash22(vec2(float(i) * 5.13, float(i) * 3.07)).y * 7.3, 1.2));
          vec2 fromCenter = uv - dropCenter;
          // Vertical lens: magnify inside drop (refract toward top of drop)
          vec2 refractDir = normalize(fromCenter + vec2(0.0, 0.01)) * refr;
          totalRefract += refractDir * alpha;

          totalTrail   += trail * (1.0 - totalTrail); // accumulate without blowing out
          totalDrop    = max(totalDrop, alpha);
          totalSparkle = max(totalSparkle, sparkle);
        }

        // --- Sample background through refraction + film ---
        vec2 bgUV = uv + totalRefract + filmDisp;
        bgUV = clamp(bgUV, 0.0, 1.0);

        vec3 bgCol = cityLights(bgUV, u_time);

        // --- Water trail rendering ---
        // Trail is thin water film — slightly lighter, barely refracting
        vec3 trailCol = cityLights(uv + filmDisp * 0.3, u_time) * 1.1;
        trailCol = mix(trailCol, vec3(0.6, 0.7, 0.8), totalTrail * 0.3);

        vec3 col = bgCol;
        col = mix(col, trailCol, totalTrail * 0.5);

        // --- Drop surface: glassy brightening at edges + refraction already applied ---
        // Inside drops: slight cool-blue tint + brightness from lens
        vec3 dropSurface = cityLights(uv - totalRefract * 1.5, u_time) * 1.2;
        dropSurface = mix(dropSurface, vec3(0.7, 0.85, 1.0), 0.15);
        col = mix(col, dropSurface, totalDrop * 0.5);

        // --- Drop edge highlight ---
        // Rim light: bright thin rim around each drop
        float rim = totalDrop * (1.0 - totalDrop * 0.8);
        col += vec3(0.8, 0.9, 1.0) * rim * 0.4;

        // --- Treble: sparkle/reflection glints ---
        col += vec3(1.0, 0.97, 0.9) * totalSparkle * (0.3 + u_treble * 0.7);

        // --- Beat: flash / gust streak ---
        float beatFlash = u_beat * 0.15;
        col += vec3(0.6, 0.8, 1.0) * beatFlash;

        // --- Glass surface sheen: subtle top-edge brightness ---
        float sheen = exp(-uv.y * 6.0) * 0.06 + exp(-(1.0 - uv.y) * 8.0) * 0.04;
        col += vec3(0.5, 0.6, 0.7) * sheen;

        // --- Vignette ---
        vec2 vig_uv = uv * 2.0 - 1.0;
        float vig = 1.0 - dot(vig_uv, vig_uv) * 0.35;
        col *= vig;

        // Overall brightness breathes with bass
        col *= 0.85 + u_bass * 0.25;

        col = clamp(col, 0.0, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) {
    this.audio.bass   = d.bass   || 0;
    this.audio.mid    = d.mid    || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms    = d.rms    || 0;
    this.audio.strength = d.strength || 0;
  }

  onBeat(strength) {
    this.beatPulse = strength;
    // Beat triggers a gust that lasts ~1 second
    this._gustTimer = Math.min(1.0, this._gustTimer + strength * 0.8);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['rain-window'] = RainWindowPreset;
})();
