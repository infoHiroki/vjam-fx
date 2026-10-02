(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class Particles3dPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._particles3d = null;
  }

  _initParticles() {
    const particles = [];
    for (let i = 0; i < 400; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.15 + Math.random() * 0.85;
      const y = (Math.random() - 0.5) * 2;
      particles.push({
        angle, radius, y,
        baseRadius: radius,
        baseY: y,
        speed: 0.2 + Math.random() * 0.8,
        hue: Math.random() * 360,
        size: 0.8 + Math.random() * 1.2,
        explode: 0,
        explodeDir: Math.random() * Math.PI * 2,
        yDir: (Math.random() - 0.5) * 2,
      });
    }
    return particles;
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

        if (!preset._particles3d) preset._particles3d = preset._initParticles();

        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;
        const rms = preset.audio.rms;
        const scale = Math.min(p.width, p.height) * 0.42;
        p.camera(0, 0, (Math.min(p.width, p.height) / 2) / Math.tan(Math.PI / 6) * 1.3, 0, 0, 0, 0, 1, 0);
        const hueShift = treble * 250;
        const swirl = 0.015 + bass * 0.06;
        const fc = p.frameCount;

        // Beat explosion
        if (preset.beatPulse > 0.3) {
          for (const pt of preset._particles3d) {
            pt.explode = preset.beatPulse;
            pt.explodeDir = Math.random() * Math.PI * 2;
            pt.yDir = (Math.random() - 0.5) * 2;
          }
        }

        p.colorMode(p.HSB, 360, 100, 100, 255);

        p.push();
        p.rotateY(fc * 0.004 + bass * 0.01);
        p.rotateX(Math.sin(fc * 0.002) * 0.15);

        const positions = [];
        p.beginShape(p.POINTS);
        for (const pt of preset._particles3d) {
          pt.angle += swirl * pt.speed;
          pt.explode *= 0.94;
          const expR = pt.explode * 2.0;
          const currentR = pt.baseRadius + expR;

          const x = Math.cos(pt.angle) * currentR * scale
                    + Math.cos(pt.explodeDir) * expR * scale * 0.3;
          const z = Math.sin(pt.angle) * currentR * scale
                    + Math.sin(pt.explodeDir) * expR * scale * 0.3;
          const yWave = Math.sin(pt.angle * 2.5 + fc * 0.025) * 0.25;
          const y = (pt.baseY + yWave) * scale
                    + pt.explode * pt.yDir * scale * 0.7;

          const depthFactor = 1 + z / (scale * 2);
          const sz = pt.size * (3 + rms * 6 + preset.beatPulse * 4) * Math.max(0.4, depthFactor);
          p.strokeWeight(sz);

          const hue = (pt.hue + hueShift + fc * 0.6) % 360;
          const bri = 75 + preset.beatPulse * 25 + mid * 10;
          const alpha = 170 + preset.beatPulse * 85;
          p.stroke(hue, 65, bri, alpha);
          p.vertex(x, y, z);

          positions.push({ x, y, z, hue });
        }
        p.endShape();

        // Constellation connections
        if (mid > 0.1 || preset.beatPulse > 0.2) {
          const connAlpha = 20 + mid * 40 + preset.beatPulse * 60;
          p.strokeWeight(0.4 + preset.beatPulse * 0.6);
          const threshold = scale * (0.25 + preset.beatPulse * 0.15);
          const threshSq = threshold * threshold;
          const step = Math.max(4, Math.floor(400 / (30 + preset.beatPulse * 20)));
          for (let i = 0; i < positions.length; i += step) {
            const a = positions[i];
            for (let j = i + step; j < positions.length; j += step) {
              const b = positions[j];
              const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
              const dSq = dx * dx + dy * dy + dz * dz;
              if (dSq < threshSq) {
                const lineHue = (a.hue + b.hue) * 0.5;
                p.stroke(lineHue, 50, 80, connAlpha * (1 - dSq / threshSq));
                p.line(a.x, a.y, a.z, b.x, b.y, b.z);
              }
            }
          }
        }

        p.colorMode(p.RGB, 255);
        p.pop();
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
    this._particles3d = null;
    super.destroy();
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['3d-particles'] = Particles3dPreset;
})();
