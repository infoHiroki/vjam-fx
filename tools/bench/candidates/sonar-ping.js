(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SonarPingPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.autoBeat = 0;
    this.contacts = [];
    this.pings = [];
    this.returns = [];
    this.sweepAngle = 0;
    this.depthGlow = 0;
    this.seed = Math.random() * 1000;
  }

  setup(container) {
    this.destroy();
    this.contacts = [];
    this.pings = [];
    this.returns = [];
    this.beatPulse = 0;
    this.autoBeat = 0;
    this.sweepAngle = 0;
    this.depthGlow = 0;
    const preset = this;

    this.p5 = new p5((p) => {
      let pg;

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        pg = p.createGraphics(p.width, p.height);
        pg.pixelDensity(1);
        pg.colorMode(p.HSB, 360, 100, 100, 100);
        pg.background(0);
        preset._rebuildContacts(p);
      };

      p.draw = () => {
        p.background(0);
        preset.autoBeat++;
        preset.beatPulse *= 0.92;
        preset.depthGlow *= 0.965;
        preset.sweepAngle += 0.018 + preset.audio.mid * 0.09 + preset.audio.rms * 0.03;

        if (preset.autoBeat > 82) {
          preset._launchPing(0.55);
        }

        preset._fadeTrail(pg);
        preset._updatePingPhysics(p);
        preset._drawWater(p);
        preset._drawTrail(pg, p);
        p.image(pg, 0, 0);
        preset._drawHud(p);
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
        const oldPg = pg;
        pg = p.createGraphics(p.width, p.height);
        pg.pixelDensity(1);
        pg.colorMode(p.HSB, 360, 100, 100, 100);
        pg.background(0);
        oldPg.remove();
        preset._rebuildContacts(p);
      };
    }, container);
  }

  _rebuildContacts(p) {
    this.contacts = [];
    const count = 7 + Math.floor(this.audio.treble * 14);
    const maxR = Math.min(p.width, p.height) * 0.46;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.82 + Math.random() * Math.PI * 1.64;
      const radius = maxR * (0.28 + Math.random() * 0.68);
      const jitter = (Math.random() - 0.5) * maxR * 0.08;
      const x = p.width * 0.5 + Math.cos(angle) * radius + jitter;
      const yBias = p.height * (0.06 + Math.random() * 0.22);
      const y = p.height * 0.5 + Math.sin(angle) * radius + yBias;
      this.contacts.push({
        x,
        y,
        radius: 8 + Math.random() * 18,
        strength: 0.5 + Math.random() * 0.5,
        flicker: Math.random() * Math.PI * 2,
        lit: 0,
        hueOffset: (i / count) * 280 + Math.random() * 30,
      });
    }
  }

  _fadeTrail(pg) {
    pg.noStroke();
    pg.fill(0, 0, 0, 14 + this.audio.rms * 18);
    pg.rect(0, 0, pg.width, pg.height);
  }

  _launchPing(strength) {
    const power = 0.35 + strength * 0.45 + this.audio.bass * 0.7 + this.audio.rms * 0.25;
    this.autoBeat = 0;
    this.beatPulse = Math.max(this.beatPulse, Math.min(1, strength));
    this.depthGlow = Math.max(this.depthGlow, power);
    this.pings.push({
      radius: 6,
      speed: 5 + this.audio.mid * 4 + strength * 5,
      power,
      width: 8 + this.audio.bass * 28,
      triggered: {},
    });
    if (this.pings.length > 6) this.pings.shift();
  }

  _updatePingPhysics(p) {
    const cx = p.width * 0.5;
    const cy = p.height * 0.5;
    const maxR = Math.sqrt(cx * cx + cy * cy);

    for (let i = this.pings.length - 1; i >= 0; i--) {
      const ping = this.pings[i];
      ping.radius += ping.speed * (1 + this.audio.bass * 0.9 + this.audio.rms * 0.4);
      ping.power *= 0.995;
      if (ping.radius > maxR) {
        this.pings.splice(i, 1);
      }
    }

    for (let i = 0; i < this.contacts.length; i++) {
      const c = this.contacts[i];
      c.lit *= 0.9;
      for (let j = 0; j < this.pings.length; j++) {
        const ping = this.pings[j];
        const dx = c.x - cx;
        const dy = c.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (!ping.triggered[i] && Math.abs(ping.radius - dist) < ping.speed * 1.6) {
          ping.triggered[i] = true;
          c.lit = 1;
          this.returns.push({
            radius: dist,
            speed: 2.2 + this.audio.mid * 2.8 + c.strength * 1.4,
            alpha: 0.8 + c.strength * 0.6,
            strength: c.strength,
          });
          if (this.returns.length > 18) this.returns.shift();
        }
      }
    }

    for (let i = this.returns.length - 1; i >= 0; i--) {
      const echo = this.returns[i];
      echo.radius -= echo.speed * (1 + this.audio.rms * 0.25);
      echo.alpha *= 0.986;
      if (echo.radius <= 8 || echo.alpha < 0.04) {
        this.returns.splice(i, 1);
      }
    }
  }

  _drawWater(p) {
    const horizon = p.height * 0.58;
    p.noStroke();
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const y = p.lerp(0, p.height, t);
      const hue = 190 - t * 26;
      const sat = 48 + t * 20;
      const bri = 5 + (1 - t) * 12 + this.depthGlow * 6;
      p.fill(hue, sat, bri, 28);
      p.rect(0, y, p.width, p.height / 6 + 2);
    }

    p.fill(150, 35, 7 + this.audio.rms * 8, 55);
    p.beginShape();
    p.vertex(0, p.height);
    for (let x = 0; x <= p.width; x += Math.max(18, Math.floor(p.width / 20))) {
      const n = p.noise(this.seed + x * 0.004, p.frameCount * 0.003);
      const y = horizon + n * p.height * 0.22 + Math.sin(x * 0.01 + p.frameCount * 0.015) * 8;
      p.vertex(x, y);
    }
    p.vertex(p.width, p.height);
    p.endShape(p.CLOSE);
  }

  _drawTrail(pg, p) {
    const cx = p.width * 0.5;
    const cy = p.height * 0.5;
    const sweepReach = Math.min(p.width, p.height) * 0.48;

    pg.push();
    pg.translate(cx, cy);
    pg.rotate(this.sweepAngle);
    pg.noStroke();
    pg.fill(122, 70, 55 + this.audio.mid * 28, 8 + this.audio.rms * 10);
    pg.arc(0, 0, sweepReach * 2, sweepReach * 2, -0.16, 0.16, pg.PIE);
    pg.pop();

    for (let i = 0; i < this.pings.length; i++) {
      const ping = this.pings[i];
      pg.noFill();
      pg.stroke(118, 70, 55 + ping.power * 30, 32 + ping.power * 28);
      pg.strokeWeight(1.2 + ping.width * 0.16);
      pg.ellipse(cx, cy, ping.radius * 2, ping.radius * 2);
      pg.stroke(125, 18, 100, 5 + ping.power * 8);
      pg.strokeWeight(ping.width);
      pg.ellipse(cx, cy, ping.radius * 2, ping.radius * 2);
    }

    for (let i = 0; i < this.returns.length; i++) {
      const echo = this.returns[i];
      pg.noFill();
      pg.stroke(140, 50, 90, 10 + echo.alpha * 18);
      pg.strokeWeight(1 + echo.strength * 2.8 + this.audio.treble * 1.5);
      pg.ellipse(cx, cy, echo.radius * 2, echo.radius * 2);
    }

    const detail = 2 + Math.floor(this.audio.treble * 5);
    for (let i = 0; i < this.contacts.length; i++) {
      const c = this.contacts[i];
      const shimmer = 0.5 + 0.5 * Math.sin(p.frameCount * 0.06 + c.flicker);
      const alpha = 10 + c.lit * 40 + shimmer * 6;
      const cHue = (c.hueOffset + p.frameCount * 0.1) % 360;
      pg.noStroke();
      pg.fill(cHue, 55, 50 + c.lit * 45, alpha);
      pg.ellipse(c.x, c.y, c.radius * 1.3, c.radius * 1.3);
      pg.fill(cHue, 25, 100, alpha * 0.5);
      pg.ellipse(c.x, c.y, c.radius * 0.45, c.radius * 0.45);

      if (c.lit > 0.08) {
        pg.stroke(cHue, 55, 90, 8 + c.lit * 18);
        pg.strokeWeight(0.8);
        for (let j = 0; j < detail; j++) {
          const a = (j / detail) * Math.PI * 2 + p.frameCount * 0.03;
          const r = c.radius * (1.6 + j * 0.45);
          pg.line(c.x, c.y, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
        }
      }
    }
  }

  _drawHud(p) {
    const cx = p.width * 0.5;
    const cy = p.height * 0.5;
    const maxR = Math.min(p.width, p.height) * 0.46;

    p.noFill();
    p.stroke(120, 25, 32, 18);
    p.strokeWeight(1);
    for (let i = 1; i <= 4; i++) {
      const r = maxR * (i / 4);
      p.ellipse(cx, cy, r * 2, r * 2);
    }

    p.stroke(125, 55, 80, 35 + this.beatPulse * 30);
    p.strokeWeight(1.2 + this.audio.bass * 1.4);
    p.line(cx - 12, cy, cx + 12, cy);
    p.line(cx, cy - 12, cx, cy + 12);

    p.noStroke();
    p.fill(185, 18, 28, 28);
    p.rect(18, 18, p.width - 36, p.height - 36, 18);
    p.fill(120, 40, 92, 18 + this.beatPulse * 16);
    p.rect(28, p.height - 44, (p.width - 56) * Math.min(1, this.depthGlow), 10, 5);
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
  }

  onBeat(strength) {
    this._launchPing(Math.min(1, strength || 0));
    if (this.p5 && this.contacts.length !== 7 + Math.floor(this.audio.treble * 14)) {
      this._rebuildContacts(this.p5);
    }
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['sonar-ping'] = SonarPingPreset;
})();
