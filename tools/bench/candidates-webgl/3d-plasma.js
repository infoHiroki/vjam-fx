(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class Plasma3dPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._shaderTime = 0;
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
      precision mediump float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        // bass で UV を呼吸するように歪める
        uv *= 1.0 + u_bass * 0.15;
        float d = length(uv);
        float t = u_time;
        // 5層のsin波（trebleで細かいディテール追加）
        float v1 = sin(uv.x * 4.0 + t * 1.4 + sin(uv.y * 3.0 + t) * 2.5);
        float v2 = sin(uv.y * 5.0 - t * 1.1 + cos(uv.x * 4.0 + t * 1.3) * 2.0);
        float v3 = sin(d * 6.0 - t * 1.8 + u_bass * 5.0);
        float v4 = sin(length(uv - vec2(sin(t * 0.8), cos(t * 0.6))) * 5.0 + t * 1.2);
        float v5 = sin((uv.x + uv.y) * 3.0 + t * 0.7) * u_treble;
        float v = (v1 + v2 + v3 + v4 + v5) * 0.2;
        // 高コントラストなネオンカラー
        float r = pow(sin(v * 3.14159 + t * 0.4) * 0.5 + 0.5, 0.7);
        float g = pow(sin(v * 3.14159 + t * 0.4 + 2.094) * 0.5 + 0.5, 0.7);
        float b = pow(sin(v * 3.14159 + t * 0.4 + 4.189) * 0.5 + 0.5, 0.7);
        vec3 col = vec3(r, g, b);
        // ビートで白フラッシュ（一瞬全体が白く飛ぶ）
        col = mix(col, vec3(1.0), u_beat * 0.6);
        // 全体の明度を上げる（VJ映え）
        col *= 1.3 + u_bass * 0.4;
        // エッジフェード
        float fade = smoothstep(1.5, 0.2, d);
        col *= fade;
        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try {
      return p.createShader(vert, frag);
    } catch (_) {
      return null;
    }
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
        p.background(0);
        preset.beatPulse *= 0.9;

        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }
        preset._shaderTime += 0.04 + preset.audio.bass * 0.08 + preset.beatPulse * 0.2;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._shaderTime);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          p.noStroke();
          p.quad(-1, -1, 1, -1, 1, 1, -1, 1);
        } catch (_) {
          // noop
        } finally {
          p.resetShader();
        }
      };
      p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
    }, container);
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    if (strength > 0.2) this.beatPulse = Math.min(1, strength);
  }

  destroy() {
    this._shader = null;
    this._shaderTime = 0;
    super.destroy();
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['3d-plasma'] = Plasma3dPreset;
})();
