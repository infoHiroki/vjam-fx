(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class Tunnel3dPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._tunnelRings = null;
    this._tunnelOffset = 0;
  }

  _initTunnelRings() {
    const rings = [];
    for (let i = 0; i < 28; i++) {
      rings.push({
        z: -i * 100,
        hue: (i * 13) % 360,
        radius: 0.85 + Math.random() * 0.3,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 0.02 + Math.random() * 0.04,
      });
    }
    return rings;
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

        if (!preset._tunnelRings) preset._tunnelRings = preset._initTunnelRings();

        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;
        const speed = 4 + bass * 12 + preset.beatPulse * 25;
        preset._tunnelOffset += speed;
        const maxZ = -28 * 100;
        const scale = Math.min(p.width, p.height) * 0.4;
        p.camera(0, 0, (Math.min(p.width, p.height) / 2) / Math.tan(Math.PI / 6) * 1.3, 0, 0, 0, 0, 1, 0);

        p.colorMode(p.HSB, 360, 100, 100, 255);

        for (const ring of preset._tunnelRings) {
          ring.z += speed;
          if (ring.z > 400) {
            ring.z = maxZ + (ring.z - 400);
            ring.hue = Math.random() * 360;
          }

          const zRange = -maxZ + 400;
          const zNorm = (ring.z - maxZ) / zRange;
          const alpha = Math.pow(zNorm, 0.5) * 255 * Math.min(1, (400 - ring.z) / 500);
          if (alpha < 3) continue;

          const beatR = 1 + preset.beatPulse * 0.5;
          const r = scale * ring.radius * beatR;
          const tubeR = r * (0.03 + preset.beatPulse * 0.04 + mid * 0.02);
          const hue = (ring.hue + preset._tunnelOffset * 0.02 + treble * 100) % 360;

          const wobX = Math.sin(ring.wobblePhase + preset._tunnelOffset * 0.001) * ring.wobbleAmp * scale;
          const wobY = Math.cos(ring.wobblePhase * 1.3 + preset._tunnelOffset * 0.0008) * ring.wobbleAmp * scale;

          p.push();
          p.translate(wobX, wobY, ring.z);

          p.noFill();
          p.stroke(hue, 85, 95, alpha);
          p.strokeWeight(2.0 + preset.beatPulse * 4 + bass * 1.5);
          p.torus(r, tubeR, 20, 8);

          if (alpha > 60) {
            p.stroke(hue, 20, 100, alpha * 0.4);
            p.strokeWeight(0.8);
            p.torus(r * 0.92, tubeR * 0.5, 20, 6);
          }

          p.pop();
        }
        p.colorMode(p.RGB, 255);
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
    this._tunnelRings = null;
    this._tunnelOffset = 0;
    super.destroy();
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['3d-tunnel'] = Tunnel3dPreset;
})();
