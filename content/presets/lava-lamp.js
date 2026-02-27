(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class LavaLampPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 3;
            const NUM_BLOBS = 8;
            let blobs = [];

            function initBlobs(w, h) {
                blobs = [];
                for (let i = 0; i < NUM_BLOBS; i++) {
                    blobs.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        vx: (Math.random() - 0.5) * 0.3,
                        vy: -Math.random() * 0.5 - 0.3,
                        radius: 30 + Math.random() * 25,
                        hue: Math.random() * 60, // warm range 0-60
                    });
                }
            }

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
                initBlobs(pg.width, pg.height);
            };

            p.draw = () => {
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                const w = pg.width;
                const h = pg.height;
                const spd = preset.params.speed;

                // Update blobs
                for (const b of blobs) {
                    b.vy += -0.01 * spd; // upward buoyancy
                    b.vx += (Math.random() - 0.5) * 0.05;
                    b.vx *= 0.98;
                    b.vy = Math.max(b.vy, -1.2 * spd);

                    b.x += b.vx;
                    b.y += b.vy;

                    // Wrap top to bottom
                    if (b.y < -b.radius * 2) {
                        b.y = h + b.radius;
                        b.x = Math.random() * w;
                        b.vy = -Math.random() * 0.3 - 0.2;
                    }
                    // Horizontal bounds
                    if (b.x < 0) b.x = w;
                    if (b.x > w) b.x = 0;
                }

                // Render metaballs
                pg.background(0, 80, 8, 100);
                pg.loadPixels();
                const d = pg.pixelDensity();
                const pw = w * d;
                const ph = h * d;

                for (let py = 0; py < ph; py++) {
                    for (let px = 0; px < pw; px++) {
                        let sum = 0;
                        let hueSum = 0;
                        let weightSum = 0;

                        for (const b of blobs) {
                            const bx = b.x * d;
                            const by = b.y * d;
                            const r = (b.radius + bass * 20 + pulse * 15) * d;
                            const dx = px - bx;
                            const dy = py - by;
                            const distSq = dx * dx + dy * dy;
                            const val = (r * r) / (distSq + 1);
                            sum += val;
                            hueSum += b.hue * val;
                            weightSum += val;
                        }

                        const idx = (py * pw + px) * 4;
                        if (sum > 1.0) {
                            const avgHue = weightSum > 0 ? hueSum / weightSum : 20;
                            const intensity = Math.min(sum, 3.0);
                            // Map to warm HSB values then convert manually
                            const hue = (avgHue + mid * 30) % 60;
                            const sat = 85 - intensity * 5;
                            const bri = Math.min(100, 40 + intensity * 25 + pulse * 20);

                            // HSB to RGB conversion
                            const rgb = hsbToRgb(hue, sat, bri);
                            pg.pixels[idx] = rgb.r;
                            pg.pixels[idx + 1] = rgb.g;
                            pg.pixels[idx + 2] = rgb.b;
                            pg.pixels[idx + 3] = 255;
                        } else {
                            // Dark background
                            pg.pixels[idx] = 15;
                            pg.pixels[idx + 1] = 5;
                            pg.pixels[idx + 2] = 5;
                            pg.pixels[idx + 3] = 255;
                        }
                    }
                }
                pg.updatePixels();

                p.image(pg, 0, 0, p.width, p.height);
            };

            function hsbToRgb(h, s, b) {
                // h: 0-360, s: 0-100, b: 0-100
                const hf = h / 60;
                const sf = s / 100;
                const bf = b / 100;
                const c = bf * sf;
                const x = c * (1 - Math.abs((hf % 2) - 1));
                const m = bf - c;
                let r1, g1, b1;
                if (hf < 1) { r1 = c; g1 = x; b1 = 0; }
                else if (hf < 2) { r1 = x; g1 = c; b1 = 0; }
                else if (hf < 3) { r1 = 0; g1 = c; b1 = x; }
                else if (hf < 4) { r1 = 0; g1 = x; b1 = c; }
                else if (hf < 5) { r1 = x; g1 = 0; b1 = c; }
                else { r1 = c; g1 = 0; b1 = x; }
                return {
                    r: Math.round((r1 + m) * 255),
                    g: Math.round((g1 + m) * 255),
                    b: Math.round((b1 + m) * 255),
                };
            }

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.noStroke();
                initBlobs(pg.width, pg.height);
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
        this.beatPulse = strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['lava-lamp'] = LavaLampPreset;
})();
