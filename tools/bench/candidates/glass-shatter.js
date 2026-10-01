(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GlassShatterPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.autoBeat = 0;
    this.phase = 1;
    this.impact = { x: 0.5, y: 0.5 };
    this.spokes = [];
    this.shards = [];
    this.ring = 0;
  }

  setup(container) {
    this.destroy();
    this.beatPulse = 0;
    this.autoBeat = 0;
    this.phase = 1;
    this.ring = 0;
    this.spokes = [];
    this.shards = [];
    const preset = this;

    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        preset._shatter(p, 0.6);
      };

      p.draw = () => {
        p.background(0);
        preset.autoBeat++;
        preset.beatPulse *= 0.9;
        preset.ring *= 0.92;

        if (preset.autoBeat > 84) {
          preset._shatter(p, 0.52);
        }

        const rebuild = 0.016 + preset.audio.mid * 0.075 + preset.audio.rms * 0.018;
        preset.phase = Math.min(1, preset.phase + rebuild);

        preset._drawBackdrop(p);
        preset._drawShards(p);
        preset._drawCracks(p);
        preset._drawFrame(p);
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
        preset._shatter(p, 0.45);
      };
    }, container);
  }

  _shatter(p, strength) {
    this.autoBeat = 0;
    this.phase = 0;
    this.beatPulse = Math.max(this.beatPulse, Math.min(1, strength));
    this.ring = 1;
    this.impact.x = 0.24 + Math.random() * 0.52;
    this.impact.y = 0.2 + Math.random() * 0.46;

    const cx = p.width * this.impact.x;
    const cy = p.height * this.impact.y;
    const count = 10 + Math.floor(this.audio.treble * 18) + Math.floor(strength * 10);
    const radiusBase = Math.min(p.width, p.height) * (0.28 + this.audio.bass * 0.2 + strength * 0.08);

    this.spokes = [];
    this.shards = [];

    for (let i = 0; i < count; i++) {
      const base = (i / count) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 0.22;
      const angle = base + jitter;
      const reach = radiusBase * (0.55 + Math.random() * 0.8);
      const bend = (Math.random() - 0.5) * 0.28;
      const split = 0.35 + Math.random() * 0.4;
      const midX = cx + Math.cos(angle + bend) * reach * split;
      const midY = cy + Math.sin(angle + bend) * reach * split;
      const endX = cx + Math.cos(angle) * reach;
      const endY = cy + Math.sin(angle) * reach;
      this.spokes.push({
        angle,
        bend,
        reach,
        midX,
        midY,
        endX,
        endY,
        depth: 0.4 + Math.random() * 0.6,
      });
    }

    for (let i = 0; i < count; i++) {
      const a = this.spokes[i];
      const b = this.spokes[(i + 1) % count];
      const centroidX = (cx + a.endX + b.endX) / 3;
      const centroidY = (cy + a.endY + b.endY) / 3;
      const dirX = centroidX - cx;
      const dirY = centroidY - cy;
      const mag = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const normX = dirX / mag;
      const normY = dirY / mag;
      const spin = (Math.random() - 0.5) * 0.24;
      const lift = 12 + Math.random() * 36 + this.audio.bass * 45;

      this.shards.push({
        a0x: cx,
        a0y: cy,
        a1x: a.endX,
        a1y: a.endY,
        a2x: b.endX,
        a2y: b.endY,
        offsetX: normX * lift,
        offsetY: normY * lift - Math.abs(normY) * (8 + Math.random() * 14),
        spin,
        shine: Math.random() * Math.PI * 2,
      });
    }
  }

  _drawBackdrop(p) {
    const glow = 10 + this.audio.rms * 18 + this.beatPulse * 32;
    p.noStroke();
    p.fill(200, 35, glow, 22);
    p.ellipse(p.width * this.impact.x, p.height * this.impact.y, p.width * 0.8, p.height * 0.8);

    const shardsOpen = Math.sin(Math.min(1, this.phase * 1.2) * Math.PI);
    p.fill(190, 20, 10 + shardsOpen * 10, 16);
    p.rect(0, 0, p.width, p.height);
  }

  _drawShards(p) {
    const shardsOpen = Math.sin(Math.min(1, this.phase * 1.2) * Math.PI);
    const drift = shardsOpen * (0.6 + this.audio.bass * 1.25 + this.beatPulse * 0.7);
    const cyan = 180 + this.audio.treble * 22;

    for (let i = 0; i < this.shards.length; i++) {
      const shard = this.shards[i];
      const angle = shard.spin * shardsOpen * 5.5;
      const ox = shard.offsetX * drift;
      const oy = shard.offsetY * drift;

      p.push();
      p.translate(ox, oy);
      p.translate(p.width * this.impact.x, p.height * this.impact.y);
      p.rotate(angle);
      p.translate(-p.width * this.impact.x, -p.height * this.impact.y);

      p.noStroke();
      p.fill(cyan, 18, 92, 8 + this.audio.rms * 8);
      p.triangle(shard.a0x, shard.a0y, shard.a1x, shard.a1y, shard.a2x, shard.a2y);

      p.stroke(cyan, 22, 100, 30 + this.beatPulse * 28);
      p.strokeWeight(0.7 + this.audio.treble * 1.2);
      p.line(shard.a0x, shard.a0y, shard.a1x, shard.a1y);
      p.line(shard.a1x, shard.a1y, shard.a2x, shard.a2y);
      p.line(shard.a2x, shard.a2y, shard.a0x, shard.a0y);

      const gleam = 0.5 + 0.5 * Math.sin(p.frameCount * 0.08 + shard.shine);
      p.stroke(195, 8, 100, 10 + gleam * 14 + this.audio.rms * 6);
      p.strokeWeight(0.5);
      p.line(
        (shard.a0x + shard.a1x) * 0.5,
        (shard.a0y + shard.a1y) * 0.5,
        (shard.a0x + shard.a2x) * 0.5,
        (shard.a0y + shard.a2y) * 0.5
      );
      p.pop();
    }
  }

  _drawCracks(p) {
    const cx = p.width * this.impact.x;
    const cy = p.height * this.impact.y;
    const settle = 1 - this.phase;
    const depth = 1 + this.audio.bass * 4.4;
    const sparkle = 2 + Math.floor(this.audio.treble * 6);
    const cyan = 188 + this.audio.treble * 16;

    p.stroke(cyan, 40, 100, 9 + settle * 20 + this.beatPulse * 20);
    p.strokeWeight(depth * 3.2);
    for (let i = 0; i < this.spokes.length; i++) {
      const s = this.spokes[i];
      p.noFill();
      p.beginShape();
      p.vertex(cx, cy);
      p.vertex(s.midX, s.midY);
      p.vertex(s.endX, s.endY);
      p.endShape();
    }

    p.stroke(0, 0, 100, 35 + settle * 45);
    p.strokeWeight(0.8 + depth * 0.65);
    for (let i = 0; i < this.spokes.length; i++) {
      const s = this.spokes[i];
      p.noFill();
      p.beginShape();
      p.vertex(cx, cy);
      p.vertex(s.midX, s.midY);
      p.vertex(s.endX, s.endY);
      p.endShape();

      for (let j = 0; j < sparkle; j++) {
        const t = 0.2 + (j / sparkle) * 0.7;
        const px = p.lerp(cx, s.endX, t);
        const py = p.lerp(cy, s.endY, t);
        const len = (6 + this.audio.rms * 10) * (1 - t) * s.depth;
        const a = s.angle + (j % 2 === 0 ? -1 : 1) * (1.15 + s.bend);
        p.line(px, py, px + Math.cos(a) * len, py + Math.sin(a) * len);
      }
    }

    p.noStroke();
    p.fill(190, 14, 100, 25 + this.ring * 22);
    p.ellipse(cx, cy, 20 + this.ring * 90, 20 + this.ring * 90);
  }

  _drawFrame(p) {
    p.noFill();
    p.stroke(190, 10, 100, 18);
    p.strokeWeight(1.4);
    p.rect(10, 10, p.width - 20, p.height - 20, 18);
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
  }

  onBeat(strength) {
    if (this.p5) this._shatter(this.p5, Math.min(1, strength || 0));
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['glass-shatter'] = GlassShatterPreset;
})();
