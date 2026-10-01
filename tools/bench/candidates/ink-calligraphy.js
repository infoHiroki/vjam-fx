(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Ink Calligraphy — Brush strokes that move across the screen.
 * Each stroke has momentum, pressure variation, and ink splatter.
 * Beat triggers new strokes. Bass controls pressure. Treble controls ink splatter.
 */
class InkCalligraphyPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._strokes = [];
    this._splatters = [];
  }

  setup(container) {
    this.destroy();
    this._strokes = [];
    this._splatters = [];
    const preset = this;

    this.p5 = new p5((p) => {
      let pg;

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        pg = p.createGraphics(p.width, p.height);
        pg.colorMode(p.HSB, 360, 100, 100, 100);
        pg.background(0);
      };

      p.draw = () => {
        preset.beatPulse *= 0.9;
        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;
        const rms = preset.audio.rms;
        const t = p.frameCount;

        // Slow fade — ink dries and fades
        pg.fill(0, 0, 0, 3 + rms * 2);
        pg.noStroke();
        pg.rect(0, 0, pg.width, pg.height);

        // Spawn strokes periodically or on beat
        if (t % 60 === 0 || preset.beatPulse > 0.5) {
          preset._strokes.push(preset._newStroke(p));
        }

        // Update and draw strokes
        for (let i = preset._strokes.length - 1; i >= 0; i--) {
          const s = preset._strokes[i];

          // Brush pressure varies with bass
          const pressure = s.basePressure * (0.5 + bass * 1.5) * (1 + preset.beatPulse * 0.5);
          const brushWidth = 3 + pressure * 25;

          // Move brush along its direction with curvature
          s.curvature += (p.noise(s.noiseOff) - 0.5) * 0.08 * (1 + mid);
          s.noiseOff += 0.01;
          s.angle += s.curvature;
          const speed = s.speed * (0.8 + rms * 2);
          s.x += Math.cos(s.angle) * speed;
          s.y += Math.sin(s.angle) * speed;

          // Pressure oscillation (like real brush lifting/pressing)
          s.basePressure = 0.3 + 0.7 * Math.sin(s.life * 0.06 + s.phase) ** 2;

          // Draw ink stroke segment
          const alpha = 40 + pressure * 40;
          const hue = s.hue;
          pg.stroke(hue, 10 + treble * 30, 80, alpha);
          pg.strokeWeight(brushWidth);
          pg.strokeCap(pg.ROUND);
          pg.line(s.prevX, s.prevY, s.x, s.y);

          // Dry brush effect — thin parallel lines when pressure is low
          if (pressure < 0.3) {
            const perp = s.angle + Math.PI * 0.5;
            for (let d = -2; d <= 2; d++) {
              if (Math.random() > 0.4) continue;
              const ox = Math.cos(perp) * d * brushWidth * 0.3;
              const oy = Math.sin(perp) * d * brushWidth * 0.3;
              pg.stroke(hue, 5, 60, alpha * 0.3);
              pg.strokeWeight(0.5);
              pg.line(s.prevX + ox, s.prevY + oy, s.x + ox, s.y + oy);
            }
          }

          // Ink splatter on high treble
          if (treble > 0.3 && Math.random() < treble * 0.3) {
            const splatterCount = 2 + Math.floor(treble * 5);
            for (let sp = 0; sp < splatterCount; sp++) {
              preset._splatters.push({
                x: s.x + (Math.random() - 0.5) * brushWidth * 4,
                y: s.y + (Math.random() - 0.5) * brushWidth * 4,
                size: 1 + Math.random() * 3 * pressure,
                hue: hue,
                alpha: 30 + Math.random() * 30,
              });
            }
          }

          s.prevX = s.x;
          s.prevY = s.y;
          s.life++;

          // End stroke when off-screen or aged out
          if (s.life > s.maxLife || s.x < -50 || s.x > p.width + 50 || s.y < -50 || s.y > p.height + 50) {
            preset._strokes.splice(i, 1);
          }
        }

        // Draw splatters
        pg.noStroke();
        for (let i = preset._splatters.length - 1; i >= 0; i--) {
          const sp = preset._splatters[i];
          pg.fill(sp.hue, 10, 70, sp.alpha);
          pg.ellipse(sp.x, sp.y, sp.size, sp.size);
          sp.alpha -= 0.5;
          if (sp.alpha <= 0) preset._splatters.splice(i, 1);
        }

        // Cap arrays
        if (preset._strokes.length > 8) preset._strokes.splice(0, preset._strokes.length - 8);
        if (preset._splatters.length > 200) preset._splatters.splice(0, preset._splatters.length - 200);

        p.image(pg, 0, 0);
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
        const oldPg = pg;
        pg = p.createGraphics(p.width, p.height);
        pg.colorMode(p.HSB, 360, 100, 100, 100);
        pg.image(oldPg, 0, 0, p.width, p.height);
        oldPg.remove();
      };
    }, container);
  }

  _newStroke(p) {
    // Start from edge, move inward
    const edge = Math.floor(Math.random() * 4);
    let x, y, angle;
    if (edge === 0) { x = 0; y = Math.random() * p.height; angle = Math.random() * 0.8 - 0.4; }
    else if (edge === 1) { x = p.width; y = Math.random() * p.height; angle = Math.PI + Math.random() * 0.8 - 0.4; }
    else if (edge === 2) { x = Math.random() * p.width; y = 0; angle = Math.PI * 0.5 + Math.random() * 0.8 - 0.4; }
    else { x = Math.random() * p.width; y = p.height; angle = -Math.PI * 0.5 + Math.random() * 0.8 - 0.4; }

    return {
      x, y, prevX: x, prevY: y,
      angle,
      curvature: 0,
      speed: 3 + Math.random() * 4,
      basePressure: 0.5 + Math.random() * 0.5,
      hue: Math.random() < 0.7 ? 0 : (180 + Math.random() * 40), // mostly black ink, sometimes blue
      phase: Math.random() * Math.PI * 2,
      noiseOff: Math.random() * 1000,
      life: 0,
      maxLife: 80 + Math.floor(Math.random() * 120),
    };
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = Math.min(1, s); }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['ink-calligraphy'] = InkCalligraphyPreset;
})();
