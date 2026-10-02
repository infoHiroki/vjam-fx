(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class Bubble3dPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._bubbles = null;
    this._lightAngle = 0;
  }

  _initBubbles() {
    const bubbles = [];
    const a = () => (Math.random() - 0.5) * 2;
    for (let i = 0; i < 12; i++) {
      const spd = 0.7 + Math.random() * 1.3;
      const ang = Math.random() * Math.PI * 2;
      bubbles.push({
        x: a() * 0.8, y: a() * 0.8, z: a() * 0.4,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, vz: a() * 0.5,
        r: 0.08 + Math.random() * 0.18,
        hue: Math.random() * 360,
        spin: Math.random() * Math.PI * 2,
      });
    }
    return bubbles;
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
        p.camera(0, 0, (Math.min(p.width, p.height) / 2) / Math.tan(Math.PI / 6) * 1.3, 0, 0, 0, 0, 1, 0);
        preset.beatPulse *= 0.9;
        preset._lightAngle = (preset._lightAngle + 0.03 + preset.audio.bass * 0.08 + preset.beatPulse * 0.3) % 6.2832;

        if (!preset._bubbles) preset._bubbles = preset._initBubbles();

        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const t = p.frameCount * 0.01;
        const hw = p.width * 0.5;
        const hh = p.height * 0.5;
        const hd = Math.min(hw, hh) * 0.6;

        p.ambientLight(60 + preset.beatPulse * 40);
        const lx = Math.cos(preset._lightAngle);
        const lz = Math.sin(preset._lightAngle);
        p.directionalLight(180, 180, 200, lx, -0.4, lz);

        const kick = preset.beatPulse * 2;

        for (const b of preset._bubbles) {
          if (kick > 1.2) {
            b.vx += (Math.random() - 0.5) * kick;
            b.vy += (Math.random() - 0.5) * kick;
          }

          b.vx *= 0.97;
          b.vy *= 0.97;
          b.vz *= 0.97;

          const speed = 1 + bass * 0.5;
          b.x += b.vx * speed * 0.005;
          b.y += b.vy * speed * 0.005;
          b.z += b.vz * speed * 0.003;

          const wall = 0.92;
          if (b.x > wall)  { b.x = wall;  b.vx = -Math.abs(b.vx); }
          if (b.x < -wall) { b.x = -wall; b.vx =  Math.abs(b.vx); }
          if (b.y > wall)  { b.y = wall;  b.vy = -Math.abs(b.vy); }
          if (b.y < -wall) { b.y = -wall; b.vy =  Math.abs(b.vy); }
          if (b.z > 0.5)   { b.z = 0.5;   b.vz = -Math.abs(b.vz); }
          if (b.z < -0.5)  { b.z = -0.5;  b.vz =  Math.abs(b.vz); }

          const bx = b.x * hw;
          const by = b.y * hh;
          const bz = b.z * hd;
          const scale = Math.min(hw, hh);
          const radius = b.r * scale * (1 + bass * 0.4 + preset.beatPulse * 0.6);

          const hue = (b.hue + t * 40 + mid * 200) % 360;

          b.spin += 0.02 + bass * 0.05;

          p.push();
          p.translate(bx, by, bz);
          p.rotateY(b.spin);
          p.rotateX(b.spin * 0.6);

          p.colorMode(p.HSB, 360, 100, 100, 255);
          p.fill(hue, 30, 90, 25);
          p.stroke(hue, 50, 100, 120 + preset.beatPulse * 135);
          p.strokeWeight(0.8 + preset.beatPulse * 2);
          p.sphere(radius, 16, 12);
          p.colorMode(p.RGB, 255);

          p.pop();
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
    this._bubbles = null;
    super.destroy();
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['3d-bubble'] = Bubble3dPreset;
})();
