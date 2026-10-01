(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Compass Rose — Ornate nautical compass that reacts to audio.
 * Bass rotates the outer ring, treble spins the inner star.
 * Beat causes magnetic disturbance flicker. Gold on dark navy.
 */
class CompassRosePreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._outerAngle = 0;
    this._innerAngle = 0;
    this._needleAngle = 0;
    this._targetNeedle = 0;
    this._disturbance = 0;
  }

  setup(container) {
    this.destroy();
    this._outerAngle = 0;
    this._innerAngle = 0;
    this._needleAngle = 0;
    this._targetNeedle = 0;
    this._disturbance = 0;
    const preset = this;

    this.p5 = new p5((p) => {
      let pg;

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        pg = p.createGraphics(p.width, p.height);
        pg.colorMode(p.HSB, 360, 100, 100, 100);
      };

      p.draw = () => {
        p.background(0);
        preset.beatPulse *= 0.88;
        preset._disturbance *= 0.92;

        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;
        const rms = preset.audio.rms;
        const t = p.frameCount;

        // Rotate rings
        preset._outerAngle += 0.005 + bass * 0.08 + preset.beatPulse * 0.15;
        preset._innerAngle -= 0.008 + treble * 0.12 + preset.beatPulse * 0.2;

        // Needle seeks target — smooth, bass-driven swing
        preset._targetNeedle += Math.sin(t * 0.008) * 0.01 + bass * 0.15 - mid * 0.1;
        preset._needleAngle += (preset._targetNeedle - preset._needleAngle) * (0.03 + bass * 0.06);
        // Beat: single strong kick, not jitter
        if (preset._disturbance > 0.3) {
          preset._needleAngle += preset._disturbance * 0.15 * Math.sin(t * 0.5);
        }

        // Trail
        pg.fill(220, 40, 5, 18 + rms * 8);
        pg.noStroke();
        pg.rect(0, 0, pg.width, pg.height);

        const cx = p.width / 2;
        const cy = p.height / 2;
        const maxR = Math.min(p.width, p.height) * 0.42;

        // Outer ring — graduated marks
        preset._drawOuterRing(pg, cx, cy, maxR, bass, rms);

        // Middle ornate ring — 16-point star
        preset._drawStarRing(pg, cx, cy, maxR * 0.75, preset._outerAngle, 16, bass, mid);

        // Inner 8-point star
        preset._drawStarRing(pg, cx, cy, maxR * 0.45, preset._innerAngle, 8, treble, rms);

        // Center needle
        preset._drawNeedle(pg, cx, cy, maxR * 0.6, preset._needleAngle, bass, preset.beatPulse);

        // Center jewel
        pg.noStroke();
        pg.fill(35, 70, 95, 80 + preset.beatPulse * 20);
        pg.ellipse(cx, cy, 14 + bass * 8, 14 + bass * 8);
        pg.fill(45, 40, 100, 60);
        pg.ellipse(cx, cy, 6, 6);

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

  _drawOuterRing(pg, cx, cy, r, bass, rms) {
    const ticks = 72;
    pg.strokeCap(pg.ROUND);
    for (let i = 0; i < ticks; i++) {
      const angle = (i / ticks) * Math.PI * 2 + this._outerAngle;
      const isMajor = i % 9 === 0;
      const isMid = i % 3 === 0;
      const len = isMajor ? 18 + bass * 10 : isMid ? 10 + rms * 6 : 5;
      const alpha = isMajor ? 70 + bass * 25 : isMid ? 45 + rms * 15 : 25;

      pg.stroke(38, 55, 85, alpha);
      pg.strokeWeight(isMajor ? 2.5 : isMid ? 1.5 : 0.8);

      const x1 = cx + Math.cos(angle) * (r - len);
      const y1 = cy + Math.sin(angle) * (r - len);
      const x2 = cx + Math.cos(angle) * r;
      const y2 = cy + Math.sin(angle) * r;
      pg.line(x1, y1, x2, y2);
    }

    // Outer circle
    pg.noFill();
    pg.stroke(38, 50, 70, 40);
    pg.strokeWeight(2);
    pg.ellipse(cx, cy, r * 2, r * 2);
  }

  _drawStarRing(pg, cx, cy, r, angle, points, audio1, audio2) {
    const innerR = r * (0.4 + audio1 * 0.35);
    pg.noFill();

    for (let layer = 0; layer < 2; layer++) {
      const layerR = layer === 0 ? r : r * 0.85;
      const layerInnerR = layer === 0 ? innerR : innerR * 0.9;
      const alpha = layer === 0 ? 50 + audio1 * 30 : 30 + audio2 * 20;

      pg.stroke(35 + layer * 10, 50 + audio2 * 25, 80 + audio1 * 15, alpha);
      pg.strokeWeight(1.5 - layer * 0.5);

      pg.beginShape();
      for (let i = 0; i <= points * 2; i++) {
        const a = angle + (i / (points * 2)) * Math.PI * 2;
        const rad = i % 2 === 0 ? layerR : layerInnerR;
        pg.vertex(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
      pg.endShape(pg.CLOSE);
    }
  }

  _drawNeedle(pg, cx, cy, len, angle, bass, beat) {
    const tipX = cx + Math.cos(angle) * len;
    const tipY = cy + Math.sin(angle) * len;
    const tailX = cx + Math.cos(angle + Math.PI) * len * 0.4;
    const tailY = cy + Math.sin(angle + Math.PI) * len * 0.4;

    // North — red
    pg.stroke(0, 75, 85, 70 + beat * 25);
    pg.strokeWeight(3 + bass * 2);
    pg.line(cx, cy, tipX, tipY);

    // Arrowhead
    const headSize = 8 + bass * 6;
    const headAngle = angle;
    pg.noStroke();
    pg.fill(0, 70, 90, 75 + beat * 20);
    pg.triangle(
      tipX, tipY,
      tipX - Math.cos(headAngle - 0.3) * headSize, tipY - Math.sin(headAngle - 0.3) * headSize,
      tipX - Math.cos(headAngle + 0.3) * headSize, tipY - Math.sin(headAngle + 0.3) * headSize,
    );

    // South — white/silver
    pg.stroke(40, 15, 80, 50);
    pg.strokeWeight(2.5 + bass);
    pg.line(cx, cy, tailX, tailY);
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) {
    this.beatPulse = Math.min(1, s);
    this._disturbance = Math.max(this._disturbance, s);
    this._targetNeedle += (Math.random() > 0.5 ? 1 : -1) * 0.8 * s;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['compass-rose'] = CompassRosePreset;
})();
