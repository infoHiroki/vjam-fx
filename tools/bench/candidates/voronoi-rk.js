(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class VoronoiRkPreset extends BasePreset {
  constructor() {
    super();
    this.params = { speed: 1 };
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.pendingBeats = 0;
    this.points = [];
    this.MAX_POINTS = 60;
  }

  setup(container) {
    this.destroy();
    this.points = [];
    const preset = this;

    // Seed initial points
    for (let i = 0; i < 12; i++) {
      this.points.push(this._newPoint(container.clientWidth, container.clientHeight));
    }

    this.p5 = new p5((p) => {
      let pg;
      const RES = 6;

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.noSmooth();
        pg = p.createGraphics(
          Math.ceil(p.width / RES),
          Math.ceil(p.height / RES)
        );
        pg.colorMode(p.HSB, 360, 100, 100, 100);
        pg.noStroke();
      };

      p.draw = () => {
        const pts = preset.points;
        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const rms = preset.audio.rms;

        // Consume pending beats: split random points
        while (preset.pendingBeats > 0 && pts.length < preset.MAX_POINTS) {
          preset.pendingBeats--;
          const src = pts[Math.floor(Math.random() * pts.length)];
          const angle = Math.random() * Math.PI * 2;
          const child = {
            x: src.x / RES + Math.cos(angle) * 3,
            y: src.y / RES + Math.sin(angle) * 3,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            hue: (src.hue / RES + 30 + Math.random() * 30) % 360,
            life: 1,
            decay: 0.003 + Math.random() * 0.004,
          };
          // Store in pg-space
          child.x = src.x / RES;
          child.y = src.y / RES;
          // Convert back to canvas space for consistency — actually store in canvas space
          pts.push({
            x: src.x + Math.cos(angle) * 20,
            y: src.y + Math.sin(angle) * 20,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            hue: (src.hue + 30 + Math.random() * 30) % 360,
            life: 1,
            decay: 0.003 + Math.random() * 0.004,
          });
        }
        preset.pendingBeats = 0;

        const w = pg.width;
        const h = pg.height;
        const speed = (0.5 + bass * 2) * preset.params.speed;

        // Update points, decay life, compact
        let writeIdx = 0;
        for (let i = 0; i < pts.length; i++) {
          const pt = pts[i];
          pt.life -= pt.decay;
          if (pt.life <= 0) continue;

          pt.x += pt.vx * speed;
          pt.y += pt.vy * speed;
          if (pt.x < 0 || pt.x > p.width) pt.vx *= -1;
          if (pt.y < 0 || pt.y > p.height) pt.vy *= -1;
          pt.x = Math.max(0, Math.min(p.width, pt.x));
          pt.y = Math.max(0, Math.min(p.height, pt.y));

          pts[writeIdx++] = pt;
        }
        pts.length = writeIdx;

        // Ensure minimum points
        while (pts.length < 8) {
          pts.push(preset._newPoint(p.width, p.height));
        }

        // Edge width from rms
        const edgeThresh = 3 + rms * 8;
        // Saturation from mid
        const sat = 40 + mid * 50;

        // Build scaled point array for pg-space lookup
        const scaledPts = [];
        for (let i = 0; i < pts.length; i++) {
          scaledPts[i] = {
            x: pts[i].x / RES,
            y: pts[i].y / RES,
            hue: pts[i].hue,
            life: pts[i].life,
          };
        }

        pg.background(0);

        // Brute-force voronoi on low-res buffer
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let minDist = Infinity;
            let secondDist = Infinity;
            let closestIdx = 0;

            for (let i = 0; i < scaledPts.length; i++) {
              const dx = x - scaledPts[i].x;
              const dy = y - scaledPts[i].y;
              const d = dx * dx + dy * dy;
              if (d < minDist) {
                secondDist = minDist;
                minDist = d;
                closestIdx = i;
              } else if (d < secondDist) {
                secondDist = d;
              }
            }

            const edge = Math.sqrt(secondDist) - Math.sqrt(minDist);
            const sp = scaledPts[closestIdx];

            if (edge < edgeThresh) {
              // Edge: colored line (Raven Kwok style)
              const alpha = sp.life * 80;
              pg.fill(sp.hue, sat, 90, alpha);
            } else {
              // Cell interior: black
              pg.fill(0, 0, 0, 100);
            }
            pg.rect(x, y, 1, 1);
          }
        }

        p.image(pg, 0, 0, p.width, p.height);
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
        pg = p.createGraphics(
          Math.ceil(p.width / RES),
          Math.ceil(p.height / RES)
        );
        pg.colorMode(p.HSB, 360, 100, 100, 100);
        pg.noStroke();
      };
    }, container);
  }

  _newPoint(canvasW, canvasH) {
    return {
      x: Math.random() * canvasW,
      y: Math.random() * canvasH,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      hue: Math.random() * 360,
      life: 1,
      decay: 0.001 + Math.random() * 0.002, // long-lived seed points
    };
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    this.pendingBeats++;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['voronoi-rk'] = VoronoiRkPreset;
})();
