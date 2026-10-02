(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Neon Grid City — Cyberpunk cityscape from above with neon grid streets.
 * Camera flies over a grid city at night. Buildings pulse with bass.
 * Different from existing neon-highway (side view) and wireframe-city (isometric).
 * Bass = building height, treble = neon sign flicker, mid = traffic flow speed,
 * beat = city-wide power surge, rms = ambient light pollution.
 */
class NeonGridCityPreset extends BasePreset {
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
      p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL); p.pixelDensity(1); };
      p.draw = () => {
        if (!preset._shader) { preset._shader = preset._initShader(p); if (!preset._shader) return; }
        preset._time += 0.008 + preset.audio.mid * 0.015;
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
          p.noStroke(); p.quad(-1,-1,1,-1,1,1,-1,1);
        } catch(e){} finally { p.resetShader(); }
      };
      p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
    }, container);
  }

  _initShader(p) {
    const vert = `attribute vec3 aPosition; attribute vec2 aTexCoord; varying vec2 vUv;

void main(){ vUv=aTexCoord; vec4 pos=vec4(aPosition,1.0); pos.xy=pos.xy*2.0-1.0; gl_Position=pos; }`;
    const frag = `
      precision highp float;
      varying vec2 vUv;
      uniform float u_time, u_bass, u_mid, u_treble, u_rms, u_beat;
      uniform vec2 u_resolution;

      vec3 hsv2rgb(vec3 c){
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        rgb = rgb * rgb * (3.0 - 2.0 * rgb);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }

      vec3 audioReactiveFinalize(vec3 inCol, vec2 uv, float hue, vec2 reactCenter, float reactScatter, float reactPulse) {
        vec3 hueCycle = 0.5 + 0.5 * cos(6.2831853 * (hue + vec3(0.0, 0.33, 0.67)));
        vec3 baseGlow = hueCycle * (0.16 + 0.14 * reactScatter);
        baseGlow += hueCycle * reactPulse * (0.18 + u_rms * 0.4 + u_beat * 0.25);
        baseGlow += vec3(0.06, 0.07, 0.09) * (0.6 + reactScatter * 0.8);
        baseGlow *= 0.75 + 0.25 * exp(-length(uv - reactCenter) * 2.8);
        inCol = mix(inCol, inCol * hueCycle, 0.2 + 0.15 * reactScatter);
        inCol += baseGlow;
        return max(inCol, vec3(0.03));
      }
void main(){
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
        float audioHue = u_time * 0.06 + u_treble * 0.4;
        vec2 audioDrift = vec2(sin(u_time * 0.3) * 1.5 + 1.5, sin(u_time * 0.23) * 1.5 + 1.5);
        uv += vec2(sin(u_time * 0.15), cos(u_time * 0.12)) * 0.06;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactTravel = vec2(
          fract(u_time * (0.042 + 0.02 * u_mid) + noise(vec2(2.0, u_bass * 5.0))),
          fract(u_time * (0.075 + 0.024 * u_treble) + noise(vec2(8.0, u_mid * 4.0)))
        );
        vec2 reactCenter = (reactTravel * 2.0 - 1.0) * vec2(0.52, 0.32);
        reactCenter += (vec2(noise(reactSeed + 9.0), noise(reactSeed.yx + 13.0)) - 0.5) * (0.16 + 0.12 * u_rms);
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float t = u_time;

        // Perspective transform — looking down at angle
        float focalLen = 1.2;
        float tilt = 0.35 + u_bass * 0.1;
        vec2 ground;
        float py = uv.y + tilt;
        if (py < 0.01) py = 0.01;
        ground.x = uv.x * focalLen / py;
        ground.y = focalLen / py;

        // Scroll forward with mid
        float flyPhase = fract(t * (0.06 + 0.14 * u_mid));
        float flyLoop = floor(t * (0.06 + 0.14 * u_mid));
        ground.y += flyLoop * 34.0 + flyPhase * 34.0;
        ground.x += (noise(vec2(flyPhase * 3.0 + flyLoop * 0.11, 4.2)) - 0.5) * 0.7;

        // City grid
        float gridScale = 4.0;
        vec2 cell = floor(ground * gridScale);
        vec2 cellUV = fract(ground * gridScale);

        // Building or street?
        float streetW = 0.12 + u_mid * 0.04;
        float isStreet = step(cellUV.x, streetW) + step(1.0 - streetW, cellUV.x) +
                        step(cellUV.y, streetW) + step(1.0 - streetW, cellUV.y);
        isStreet = min(isStreet, 1.0);

        // Building height from hash — bass raises all
        float bHeight = hash(cell) * (0.5 + u_bass * 1.5) + u_beat * hash(cell + 99.0) * 0.5;

        // Depth fade - use continuous function instead of abrupt cutoff
        float depthFade = 1.0 / (ground.y * 0.15 + 0.5);
        // Gradual distance fade instead of hard cutoff
        float distFade = smoothstep(60.0, 5.0, ground.y);

        vec3 col = vec3(0.0);

        if (isStreet > 0.5) {
          // Street — dark with neon lines
          col = vec3(0.02, 0.02, 0.03);

          // Neon street lines
          float lineH = smoothstep(0.005, 0.0, abs(cellUV.x - 0.5) - 0.48);
          float lineV = smoothstep(0.005, 0.0, abs(cellUV.y - 0.5) - 0.48);

          // Traffic flow dots (mid speed)
          float traffic = step(0.95, hash(cell * 3.0 + floor(vec2(t * (1.0 + u_mid * 3.0)))));

          float streetHue = fract(audioHue + hash(cell + 50.0) * 0.8 + ground.y * 0.004);
          vec3 neonCol = hsv2rgb(vec3(streetHue, 0.9, 1.0));
          col += neonCol * (lineH + lineV) * (0.3 + u_rms * 0.7) * depthFade * distFade;
          col += hsv2rgb(vec3(fract(audioHue + 0.12 + hash(cell * 5.0) * 0.5), 0.7, 1.0)) * traffic * 0.5 * depthFade * distFade;
        } else {
          // Building
          float topBright = bHeight * (0.15 + u_rms * 0.3);

          // Window grid on buildings
          vec2 winUV = fract(cellUV * vec2(4.0, 8.0));
          float window = step(0.2, winUV.x) * step(winUV.x, 0.8) * step(0.15, winUV.y) * step(winUV.y, 0.85);

          // Random lit windows — treble = flicker
          float lit = step(0.4 - u_treble * 0.2, hash(cell * 7.0 + floor(cellUV * vec2(4.0, 8.0)) + floor(t * u_treble * 2.0)));

          // Window color
          vec3 winColor = hsv2rgb(vec3(
            fract(audioHue + hash(cell + floor(cellUV * 4.0)) * 0.9 + bHeight * 0.2),
            0.65,
            1.0
          ));

          col = vec3(0.03, 0.03, 0.05) * (1.0 + topBright);
          col += winColor * window * lit * (0.3 + u_bass * 0.5 + u_treble * 0.3) * depthFade * distFade;

          // Rooftop neon signs
          float roofSign = step(0.85, cellUV.y) * step(0.3, cellUV.x) * step(cellUV.x, 0.7);
          vec3 signCol = hsv2rgb(vec3(fract(audioHue + 0.2 + hash(cell * 13.0) * 0.8), 0.85, 1.0));
          float signFlicker = 0.7 + 0.3 * sin(t * (5.0 + hash(cell) * 10.0) * (1.0 + u_treble * 3.0));
          col += signCol * roofSign * signFlicker * (0.4 + u_treble * 0.8) * depthFade * distFade;
        }

        // Beat: city-wide power surge — everything brightens
        col *= 1.0 + u_beat * 1.5;
        col += vec3(0.05, 0.02, 0.08) * u_beat * depthFade;

        // Minimal fog (reduced significantly from original)
        float fog = 1.0 - exp(-ground.y * (0.03 + u_rms * 0.02));
        vec3 fogCol = vec3(0.02, 0.01, 0.04) * (1.0 + u_rms * 0.5);
        col = mix(col, fogCol, fog * 0.3);

        // Sky at top - just dark, no aurora
        if (uv.y + tilt < 0.02) {
          col = vec3(0.02, 0.01, 0.04);
        }

        col = max(col, vec3(0.03));
        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try { return p.createShader(vert, frag); } catch(_) { return null; }
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['neon-grid-city'] = NeonGridCityPreset;
})();
