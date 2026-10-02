(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Sound Sculpture — 3D shape that IS the sound. Each frequency band sculpts a different axis.
 * Bass = Y stretch, treble = X deformation, mid = Z twist, beat = explosion/reform, rms = glow.
 * Like a physical manifestation of audio.
 */
class SoundSculpturePreset extends BasePreset {
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
        preset._time += 0.01 + preset.audio.rms * 0.015;
        preset.beatPulse *= 0.85;
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

      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }

      // SDF for the sound sculpture
      float sculpture(vec3 p, float t) {
        // Base sphere
        float d = length(p) - 0.8;

        // Bass stretches Y
        p.y *= 1.0 / (1.0 + u_bass * 1.5);
        d = length(p) - 0.8;

        // Treble deforms X with high-freq noise
        float trebleWave = sin(p.y * (8.0 + u_treble * 20.0) + t * 3.0) * u_treble * 0.3;
        d += trebleWave;

        // Mid twists Z
        float twist = u_mid * 3.0 + t * 0.3;
        float ct = cos(p.y * twist), st = sin(p.y * twist);
        vec2 twisted = vec2(p.x * ct - p.z * st, p.x * st + p.z * ct);
        d = min(d, length(vec3(twisted, p.y)) - 0.7);

        // Beat: explode outward then reform
        d += u_beat * 0.5 * sin(p.x * 10.0) * sin(p.y * 10.0) * sin(p.z * 10.0);

        // RMS: organic surface detail
        float detail = noise(p.xy * 8.0 + t) * noise(p.yz * 8.0 - t) * u_rms * 0.2;
        d += detail;

        return d;
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
void main(){
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
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

        // Ray setup
        vec3 ro = vec3(0.0, 0.0, 2.5);
        vec3 rd = normalize(vec3(uv, -1.5));

        // Rotate camera
        float camAngle = t * 0.2 + u_mid * 0.5;
        float cc = cos(camAngle), cs = sin(camAngle);
        ro.xz = vec2(ro.x * cc - ro.z * cs, ro.x * cs + ro.z * cc);
        rd.xz = vec2(rd.x * cc - rd.z * cs, rd.x * cs + rd.z * cc);

        // Raymarch
        float totalDist = 0.0;
        vec3 col = vec3(0.0);

        for (int i = 0; i < 64; i++) {
          vec3 p = ro + rd * totalDist;
          float d = sculpture(p, t);

          if (d < 0.005) {
            // Normal
            vec2 e = vec2(0.005, 0.0);
            vec3 n = normalize(vec3(
              sculpture(p + e.xyy, t) - sculpture(p - e.xyy, t),
              sculpture(p + e.yxy, t) - sculpture(p - e.yxy, t),
              sculpture(p + e.yyx, t) - sculpture(p - e.yyx, t)
            ));

            // Lighting
            vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
            float diff = max(dot(n, lightDir), 0.0);
            float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 32.0);
            float fresnel = pow(1.0 - abs(dot(n, -rd)), 3.0);

            // Color based on audio bands
            vec3 bassCol = vec3(0.8, 0.2, 0.1) * u_bass * 1.5;
            vec3 midCol = vec3(0.1, 0.7, 0.3) * u_mid * 1.2;
            vec3 trebleCol = vec3(0.2, 0.3, 1.0) * u_treble * 1.5;
            vec3 baseCol = vec3(0.15, 0.12, 0.2);

            col = baseCol + bassCol + midCol + trebleCol;
            col *= 0.3 + diff * 0.7;
            col += vec3(0.8, 0.9, 1.0) * spec * (0.3 + u_treble * 0.5);
            col += vec3(0.3, 0.4, 0.6) * fresnel * (0.2 + u_rms * 0.8);

            // Beat: bright emission
            col += vec3(1.0, 0.8, 0.5) * u_beat * 0.5;

            // Glow with rms
            col *= 0.5 + u_rms * 1.5;

            break;
          }

          totalDist += d;
          if (totalDist > 5.0) break;
        }

        // Background glow
        float bgGlow = exp(-length(uv) * 2.0) * (0.1 + u_rms * 0.15);
        col += vec3(0.1, 0.08, 0.15) * bgGlow;

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try { return p.createShader(vert, frag); } catch(_) { return null; }
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['sound-sculpture'] = SoundSculpturePreset;
})();
