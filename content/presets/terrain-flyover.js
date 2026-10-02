(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Terrain Flyover — Raymarched voxel terrain seen from above, flying forward.
 * Heightmap from fbm, perspective camera. Different from existing terrain (2D ridge lines).
 * Bass = mountain height, treble = erosion detail, mid = flight speed,
 * beat = turbulence bump, rms = fog density.
 */
class TerrainFlyoverPreset extends BasePreset {
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
        preset._time += 0.005 + preset.audio.mid * 0.02;
        preset.beatPulse *= 0.88;
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

      float terrain(vec2 p) {
        float h = 0.0, a = 0.5;
        // Bass raises terrain, treble adds detail
        float octaves_amp = 0.5 + u_bass * 0.8;
        for (int i = 0; i < 8; i++) {
          h += noise(p) * a * octaves_amp;
          p *= 2.05;
          a *= 0.48 + u_treble * 0.08; // treble = more high-freq detail
          octaves_amp *= 0.95;
        }
        // Beat: terrain upheaval
        h += u_beat * 0.2 * noise(p * 0.5);
        return h;
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
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float audioHue = u_time * 0.06 + u_treble * 0.4;
        vec2 audioDrift = vec2(sin(u_time * 0.3) * 1.5 + 1.5, sin(u_time * 0.23) * 1.5 + 1.5);
        uv += vec2(sin(u_time * 0.15), cos(u_time * 0.12)) * 0.06;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactTravel = vec2(
          fract(u_time * (0.035 + 0.02 * u_mid) + noise(vec2(1.2, u_bass * 5.0))),
          fract(u_time * (0.055 + 0.018 * u_treble) + noise(vec2(7.4, u_mid * 4.0)))
        );
        vec2 reactCenter = (reactTravel * 2.0 - 1.0) * vec2(0.48, 0.28);
        reactCenter += (vec2(noise(reactSeed + 4.3), noise(reactSeed.yx + 10.1)) - 0.5) * (0.14 + 0.14 * u_rms);
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float t = u_time;

        // Camera setup — flying forward
        float flyPhase = fract(t * (0.04 + 0.11 * u_mid));
        float flyLoop = floor(t * (0.04 + 0.11 * u_mid));
        float flySpeed = flyLoop * 22.0 + flyPhase * 22.0;
        float lateral = (noise(vec2(flyPhase * 3.0 + flyLoop * 0.07, 2.8)) - 0.5) * (0.7 + 0.2 * u_bass);
        vec3 ro = vec3(lateral, 0.8 + u_bass * 0.5, flySpeed); // ray origin
        vec3 rd = normalize(vec3(uv.x, uv.y - 0.3, 0.8)); // ray direction (tilted down)

        // Raymarch terrain
        vec3 col = vec3(0.0);
        float totalDist = 0.0;
        bool hit = false;
        vec3 hitPos;

        for (int i = 0; i < 80; i++) {
          vec3 p = ro + rd * totalDist;
          float h = terrain(p.xz * 0.3) * (1.5 + u_bass * 2.0);
          float d = p.y - h;

          if (d < 0.01) {
            hit = true;
            hitPos = p;
            break;
          }

          totalDist += max(d * 0.5, 0.02);
          if (totalDist > 30.0) break;
        }

        if (hit) {
          // Normal calculation
          vec2 e = vec2(0.01, 0.0);
          float hc = terrain(hitPos.xz * 0.3) * (1.5 + u_bass * 2.0);
          float hx = terrain((hitPos.xz + e.xy) * 0.3) * (1.5 + u_bass * 2.0);
          float hz = terrain((hitPos.xz + e.yx) * 0.3) * (1.5 + u_bass * 2.0);
          vec3 normal = normalize(vec3(hc - hx, 0.02, hc - hz));

          // Lighting
          vec3 lightDir = normalize(vec3(0.5 + u_mid * 0.3, 0.8, -0.3));
          float diff = max(dot(normal, lightDir), 0.0);
          float spec = pow(max(dot(reflect(-lightDir, normal), -rd), 0.0), 16.0);

          // Surface detail noise for texture roughness
          float detailNoise = noise(hitPos.xz * 8.0) * 0.3 + noise(hitPos.xz * 16.0) * 0.15;

          // Height-based color — boosted saturation
          float h01 = clamp(hc / 2.0, 0.0, 1.0);
          vec3 lowCol = hsv2rgb(vec3(fract(audioHue + 0.05), 0.75, 0.55));
          vec3 midCol = hsv2rgb(vec3(fract(audioHue + 0.11), 0.72, 0.65));
          vec3 highCol = hsv2rgb(vec3(fract(audioHue + 0.18), 0.55, 0.8));
          vec3 snowCol = hsv2rgb(vec3(fract(audioHue + 0.24), 0.2, 1.0));

          vec3 terrainCol;
          if (h01 < 0.3) terrainCol = mix(lowCol, midCol, h01 / 0.3);
          else if (h01 < 0.6) terrainCol = mix(midCol, highCol, (h01 - 0.3) / 0.3);
          else terrainCol = mix(highCol, snowCol, (h01 - 0.6) / 0.4);

          // Add texture roughness instead of smooth blending
          terrainCol *= 0.85 + detailNoise + 0.2 * noise(hitPos.xz * 0.22 + audioHue * 3.0);

          col = terrainCol * (0.35 + diff * 0.85) * (0.6 + u_rms * 1.2);
          col += hsv2rgb(vec3(fract(audioHue + 0.08), 0.35, 1.0)) * spec * (0.3 + u_treble * 0.6);

          // Fog — rms = density
          float fog = 1.0 - exp(-totalDist * (0.03 + u_rms * 0.05));
          vec3 fogCol = hsv2rgb(vec3(fract(audioHue + 0.58), 0.4, 0.35 + 0.1 * u_beat));
          col = mix(col, fogCol, fog);
        } else {
          // Sky — boosted
          float skyGrad = uv.y + 0.3;
          col = mix(
            hsv2rgb(vec3(fract(audioHue + 0.6), 0.5, 0.35)),
            hsv2rgb(vec3(fract(audioHue + 0.68), 0.65, 0.22)),
            skyGrad
          );
          // Stars at top
          float stars = step(0.998, hash(floor(gl_FragCoord.xy * 0.3)));
          col += vec3(stars) * 0.4 * smoothstep(0.0, 0.3, skyGrad);
        }

        // Beat: sky flash
        col += vec3(0.12, 0.1, 0.06) * u_beat * 0.6;

        // Boost overall saturation and brightness
        col *= 1.6;
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(luma), col, 1.3);

        col = max(col, vec3(0.03));

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try { return p.createShader(vert, frag); } catch(_) { return null; }
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['terrain-flyover'] = TerrainFlyoverPreset;
})();
