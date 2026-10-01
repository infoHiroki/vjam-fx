(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DeepNebulaPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.pendingBeats = [];
  }

  setup(container) {
    this.destroy();
    this.pendingBeats = [];
    const preset = this;

    this.p5 = new p5((p) => {
      // Star layers
      let bgStars = [];       // distant dim stars
      let fgStars = [];       // bright foreground stars
      const NUM_BG_STARS = 200;
      const NUM_FG_STARS = 40;

      // Gas cloud layers (3 layers with different colors/speeds)
      const clouds = [
        { hue: 280, sat: 60, xOff: 0, yOff: 100, speed: 0.003, scale: 0.005 },
        { hue: 340, sat: 50, xOff: 200, yOff: 300, speed: 0.004, scale: 0.007 },
        { hue: 220, sat: 55, xOff: 400, yOff: 500, speed: 0.002, scale: 0.004 }
      ];

      // Nova bursts
      const novas = [];       // { x, y, time, strength, hue }
      const godRays = [];     // { angle, width, length, life, hue }
      let godRayW = 0;
      let cloudPulse = 0;

      function initStars() {
        bgStars = [];
        fgStars = [];
        for (let i = 0; i < NUM_BG_STARS; i++) {
          bgStars.push({
            x: p.random(p.width),
            y: p.random(p.height),
            size: p.random(0.5, 1.5),
            twinkleSpeed: p.random(0.02, 0.08),
            twinklePhase: p.random(p.TWO_PI),
            bright: p.random(30, 60)
          });
        }
        for (let i = 0; i < NUM_FG_STARS; i++) {
          fgStars.push({
            x: p.random(p.width),
            y: p.random(p.height),
            size: p.random(1.5, 4),
            twinkleSpeed: p.random(0.03, 0.1),
            twinklePhase: p.random(p.TWO_PI),
            hue: p.random(180, 240),
            bright: p.random(70, 100)
          });
        }
      }

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        initStars();
      };

      p.draw = () => {
        p.background(240, 20, 3);
        preset.beatPulse *= 0.9;
        cloudPulse *= 0.96;

        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;
        const t = p.frameCount;

        // Drain beats → nova bursts
        for (let b = 0; b < preset.pendingBeats.length; b++) {
          const str = preset.pendingBeats[b].strength;
          cloudPulse = Math.max(cloudPulse, str);
          novas.push({
            x: p.random(p.width * 0.15, p.width * 0.85),
            y: p.random(p.height * 0.15, p.height * 0.85),
            time: 0,
            strength: str,
            hue: p.random(180, 300)
          });
          // God rays from nova
          const numRays = (4 + str * 6) | 0;
          for (let i = 0; i < numRays; i++) {
            godRays.push({
              x: novas[novas.length - 1].x,
              y: novas[novas.length - 1].y,
              angle: p.random(p.TWO_PI),
              width: p.random(2, 8) * str,
              length: p.random(100, 300) * str,
              life: 1,
              hue: p.random(200, 300)
            });
          }
        }
        preset.pendingBeats.length = 0;

        // Background stars
        p.noStroke();
        const twinkleMult = 1 + treble * 3;
        for (let i = 0; i < bgStars.length; i++) {
          const s = bgStars[i];
          const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed * twinkleMult + s.twinklePhase);
          p.fill(0, 0, s.bright * twinkle, 60);
          p.ellipse(s.x, s.y, s.size, s.size);
        }

        // Gas cloud layers (Perlin noise based)
        const cloudRes = 8;
        const cellW = Math.ceil(p.width / cloudRes) + 1;
        const cellH = Math.ceil(p.height / cloudRes) + 1;
        p.noStroke();

        for (let ci = 0; ci < clouds.length; ci++) {
          const c = clouds[ci];
          const timeOff = t * c.speed;
          const sat = c.sat + mid * 30;
          const baseBright = 15 + bass * 20 + cloudPulse * 15;

          for (let gx = 0; gx < cellW; gx++) {
            for (let gy = 0; gy < cellH; gy++) {
              const nx = gx * c.scale + c.xOff + timeOff;
              const ny = gy * c.scale + c.yOff + timeOff * 0.6;
              const n = p.noise(nx, ny);
              // Only draw where noise is above threshold (sparse clouds)
              if (n < 0.4) continue;
              const density = (n - 0.4) / 0.6;
              const alpha = density * (baseBright + density * 15);
              if (alpha < 2) continue;
              const hue = (c.hue + density * 30 + bass * 10) % 360;
              p.fill(hue, Math.min(sat, 100), 40 + density * 40, Math.min(alpha, 40));
              p.rect(gx * cloudRes, gy * cloudRes, cloudRes, cloudRes);
            }
          }
        }

        // Nova bursts
        for (let i = novas.length - 1; i >= 0; i--) {
          const n = novas[i];
          n.time += 1;
          const maxTime = 60;
          if (n.time > maxTime) { novas.splice(i, 1); continue; }
          const fade = 1 - n.time / maxTime;
          const radius = n.time * 3 * n.strength;
          // Bright flash
          p.noStroke();
          p.fill(n.hue, 20, 100, fade * n.strength * 50);
          p.ellipse(n.x, n.y, radius * 2, radius * 2);
          p.fill(n.hue, 10, 100, fade * n.strength * 80);
          p.ellipse(n.x, n.y, radius * 0.5, radius * 0.5);
        }

        // God rays
        godRayW = 0;
        for (let i = 0; i < godRays.length; i++) {
          const r = godRays[i];
          r.life -= 0.015;
          if (r.life <= 0) continue;
          const endX = r.x + Math.cos(r.angle) * r.length;
          const endY = r.y + Math.sin(r.angle) * r.length;
          p.stroke(r.hue, 30, 100, r.life * 25);
          p.strokeWeight(r.width * r.life);
          p.line(r.x, r.y, endX, endY);
          // Glow
          p.stroke(r.hue, 20, 100, r.life * 10);
          p.strokeWeight(r.width * r.life * 3);
          p.line(r.x, r.y, endX, endY);
          godRays[godRayW++] = r;
        }
        godRays.length = godRayW;

        // Foreground bright stars (with cross flare)
        p.noStroke();
        for (let i = 0; i < fgStars.length; i++) {
          const s = fgStars[i];
          const twinkle = 0.6 + 0.4 * Math.sin(t * s.twinkleSpeed * twinkleMult + s.twinklePhase);
          const bright = s.bright * twinkle;
          // Star glow
          p.fill(s.hue, 20, bright, 15);
          p.ellipse(s.x, s.y, s.size * 6, s.size * 6);
          // Star core
          p.fill(s.hue, 15, 100, bright * 0.8);
          p.ellipse(s.x, s.y, s.size, s.size);
          // Cross flare
          if (twinkle > 0.8) {
            const fLen = s.size * 4 * twinkle;
            p.stroke(s.hue, 10, 100, bright * 0.3);
            p.strokeWeight(0.5);
            p.line(s.x - fLen, s.y, s.x + fLen, s.y);
            p.line(s.x, s.y - fLen, s.x, s.y + fLen);
            p.noStroke();
          }
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
        initStars();
      };
    }, container);
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    this.pendingBeats.push({ strength });
    this.beatPulse = strength;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['deep-nebula'] = DeepNebulaPreset;
})();
