(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Waveform Mesh — 3D wireframe mesh that deforms as a waveform surface.
 * Like an oscilloscope but in 3D perspective with mesh grid.
 * Bass = wave amplitude, treble = wave frequency, mid = mesh rotation,
 * beat = wave explosion, rms = glow intensity.
 */
class WaveformMeshPreset extends BasePreset {
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
        preset.beatPulse *= 0.87;
        try {
          p.background(0);
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

      // Height function for the mesh surface
      float surface(vec2 p, float t) {
        float wave = sin(p.x * (3.0 + u_treble * 8.0) + t * 2.0) * (0.3 + u_bass * 1.2);
        wave += sin(p.y * (2.0 + u_treble * 5.0) + t * 1.5) * (0.2 + u_bass * 0.8);
        wave += sin((p.x + p.y) * (4.0 + u_treble * 6.0) - t * 3.0) * u_mid * 0.5;
        // Beat: explosion ripple from center
        float dist = length(p);
        wave += sin(dist * 10.0 - t * 8.0) * u_beat * 1.5 * exp(-dist * 0.5);
        return wave;
      }

      // Project 3D point to screen with perspective
      vec2 project(vec3 p, float rotY) {
        // Rotate around Y
        float cy = cos(rotY), sy = sin(rotY);
        float px = p.x * cy - p.z * sy;
        float pz = p.x * sy + p.z * cy;
        // Tilt down
        float tilt = 0.6;
        float ct = cos(tilt), st = sin(tilt);
        float py = p.y * ct - pz * st;
        pz = p.y * st + pz * ct;
        // Perspective
        float fov = 2.0;
        float depth = pz + 4.0;
        return vec2(px, py) * fov / max(depth, 0.1);
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
        float rotY = t * 0.2 + u_mid * 1.0;

        vec3 col = vec3(0.01, 0.01, 0.02); // Dark bg

        // Draw mesh grid lines by checking proximity to projected grid
        const int GRID_STEPS = 12;
        float lineWidth = 0.004 + u_rms * 0.003;
        float totalGlow = 0.0;

        for (int iy = 0; iy <= GRID_STEPS; iy++) {
          float gy = -2.0 + 4.0 * float(iy) / float(GRID_STEPS);
          for (int ix = 0; ix <= GRID_STEPS; ix++) {
            float gx = -2.0 + 4.0 * float(ix) / float(GRID_STEPS);
            vec2 gp = vec2(gx, gy);
            float h = surface(gp, t);
            vec3 worldPos = vec3(gp.x, h * 0.3, gp.y);
            vec2 screenPos = project(worldPos, rotY);

            float d = length(uv - screenPos);
            float glow = exp(-d * d / (lineWidth * lineWidth));

            // Height-based color
            float hNorm = clamp(h * 0.3 + 0.5, 0.0, 1.0);
            vec3 lineCol = mix(
              vec3(0.0, 0.3, 0.8),  // Low = blue
              vec3(1.0, 0.3, 0.1),  // High = red
              hNorm
            );
            lineCol = mix(lineCol, vec3(0.2, 1.0, 0.4), u_mid * 0.3); // Mid shifts to green

            col += lineCol * glow * (0.3 + u_rms * 1.0);
            totalGlow += glow;
          }
        }

        // Grid line connections (horizontal)
        float connStep = 4.0 / float(GRID_STEPS);
        for (int cy = 0; cy <= GRID_STEPS; cy++) {
          float gy = -2.0 + 4.0 * float(cy) / float(GRID_STEPS);
          for (int cx = 0; cx < GRID_STEPS; cx++) {
            float gx = -2.0 + 4.0 * float(cx) / float(GRID_STEPS);
            vec2 gp1 = vec2(gx, gy);
            vec2 gp2 = vec2(gx + connStep, gy);
            float h1 = surface(gp1, t);
            float h2 = surface(gp2, t);
            vec2 sp1 = project(vec3(gp1.x, h1 * 0.3, gp1.y), rotY);
            vec2 sp2 = project(vec3(gp2.x, h2 * 0.3, gp2.y), rotY);

            // Line segment distance
            vec2 ab = sp2 - sp1;
            float len2 = dot(ab, ab);
            if (len2 > 0.0001) {
              float param = clamp(dot(uv - sp1, ab) / len2, 0.0, 1.0);
              vec2 closest = sp1 + ab * param;
              float d = length(uv - closest);
              float lineGlow = exp(-d * d / (lineWidth * 0.5 * lineWidth * 0.5));

              float hAvg = (h1 + h2) * 0.5;
              float hN = clamp(hAvg * 0.3 + 0.5, 0.0, 1.0);
              vec3 lc = mix(vec3(0.0, 0.2, 0.5), vec3(0.8, 0.2, 0.1), hN);
              col += lc * lineGlow * (0.15 + u_rms * 0.5);
            }
          }
        }

        for (int cx = 0; cx <= GRID_STEPS; cx++) {
          float gx = -2.0 + 4.0 * float(cx) / float(GRID_STEPS);
          for (int cy = 0; cy < GRID_STEPS; cy++) {
            float gy = -2.0 + 4.0 * float(cy) / float(GRID_STEPS);
            vec2 gp1 = vec2(gx, gy);
            vec2 gp2 = vec2(gx, gy + connStep);
            float h1 = surface(gp1, t);
            float h2 = surface(gp2, t);
            vec2 sp1 = project(vec3(gp1.x, h1 * 0.3, gp1.y), rotY);
            vec2 sp2 = project(vec3(gp2.x, h2 * 0.3, gp2.y), rotY);

            vec2 ab = sp2 - sp1;
            float len2 = dot(ab, ab);
            if (len2 > 0.0001) {
              float param = clamp(dot(uv - sp1, ab) / len2, 0.0, 1.0);
              vec2 closest = sp1 + ab * param;
              float d = length(uv - closest);
              float lineGlow = exp(-d * d / (lineWidth * 0.5 * lineWidth * 0.5));

              float hAvg = (h1 + h2) * 0.5;
              float hN = clamp(hAvg * 0.3 + 0.5, 0.0, 1.0);
              vec3 lc = mix(vec3(0.0, 0.24, 0.56), vec3(0.95, 0.32, 0.12), hN);
              col += lc * lineGlow * (0.12 + u_rms * 0.45);
            }
          }
        }

        // Beat: bright flash on mesh
        col += vec3(0.1, 0.15, 0.2) * u_beat * 0.5 * totalGlow;

        // Ambient glow
        col += vec3(0.02, 0.03, 0.05) * (0.5 + u_rms * 0.5);

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try { return p.createShader(vert, frag); } catch(_) { return null; }
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['waveform-mesh'] = WaveformMeshPreset;
})();
