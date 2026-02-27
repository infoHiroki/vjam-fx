(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FireWallPreset extends BasePreset {
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
            const RES = 4;
            const COLS = 48;
            const embers = [];
            const EMBER_MAX = 60;

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
                // Seed embers
                for (let i = 0; i < EMBER_MAX; i++) {
                    embers.push(newEmber(pg.width, pg.height));
                }
            };

            function newEmber(w, h) {
                return {
                    x: Math.random() * w,
                    y: h * (0.3 + Math.random() * 0.7),
                    vy: -(0.3 + Math.random() * 0.8),
                    vx: (Math.random() - 0.5) * 0.4,
                    life: 1,
                    decay: 0.006 + Math.random() * 0.008,
                    hue: 10 + Math.random() * 30,
                    size: 1 + Math.random() * 2,
                };
            }

            p.draw = () => {
                const t = p.frameCount * 0.012 * preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                const w = pg.width;
                const h = pg.height;

                pg.background(0);

                // --- Flame columns: full height, brightness fades naturally ---
                const colW = w / COLS;
                for (let c = 0; c < COLS; c++) {
                    const cx = colW * (c + 0.5);
                    const nBase = p.noise(c * 0.12, t * 0.5);
                    // Column peak height: noise-driven, bass-reactive
                    const peakFrac = 0.5 + nBase * 0.35 + bass * 0.25 + pulse * 0.15;
                    const peakY = h * (1 - peakFrac);

                    // Draw segments from bottom to peak
                    const segments = 20;
                    for (let s = 0; s < segments; s++) {
                        const frac = s / segments; // 0=bottom, 1=top of this column
                        const y = h - frac * (h - peakY);

                        // Turbulent horizontal sway — increases upward
                        const sway = (p.noise(c * 0.2 + t * 0.7, frac * 3 + t) - 0.5)
                            * colW * 4 * frac * (1 + bass * 0.5);
                        const sx = cx + sway;

                        // Width: fat at base, thin at tip
                        const widthN = p.noise(c * 0.3, frac * 2, t * 0.4);
                        const segW = colW * (2.2 - frac * 1.5) * (0.7 + widthN * 0.6)
                            * (1 + pulse * 0.2);
                        const segH = (h - peakY) / segments * 1.6;

                        // Color: bottom=white-yellow → orange → red → dark tip
                        let hue, sat, bri, alpha;
                        if (frac < 0.12) {
                            // White-hot core at very bottom
                            hue = 42 + mid * 12;
                            sat = 15 + frac * 300;
                            bri = 95;
                            alpha = 85;
                        } else if (frac < 0.3) {
                            // Bright yellow-orange
                            hue = 32 - (frac - 0.12) * 60 + mid * 8;
                            sat = 70 + frac * 40;
                            bri = 90 - (frac - 0.12) * 80;
                            alpha = 80;
                        } else if (frac < 0.6) {
                            // Orange-red body
                            const t2 = (frac - 0.3) / 0.3;
                            hue = 18 - t2 * 14;
                            sat = 90;
                            bri = 70 - t2 * 30 + bass * 15;
                            alpha = 70 - t2 * 20;
                        } else {
                            // Dark red tips — fades smoothly to nothing
                            const t2 = (frac - 0.6) / 0.4;
                            const flicker = p.noise(c * 0.7, frac * 5, t * 1.5);
                            hue = 4 + flicker * 8;
                            sat = 95;
                            bri = (1 - t2) * 35 * flicker + bass * 10;
                            alpha = (1 - t2 * t2) * 40; // quadratic fadeout
                        }

                        // Beat: brighten + shift warm
                        if (pulse > 0.2) {
                            bri = Math.min(100, bri + pulse * 20);
                            hue = Math.min(50, hue + pulse * 12);
                            alpha = Math.min(90, alpha + pulse * 10);
                        }

                        pg.fill(
                            hue % 360,
                            Math.min(100, sat),
                            Math.min(100, Math.max(0, bri)),
                            Math.min(90, Math.max(0, alpha))
                        );

                        // Tips: triangles for pointed flame shape
                        if (frac > 0.65) {
                            pg.triangle(
                                sx - segW * 0.4, y + segH * 0.4,
                                sx + segW * 0.4, y + segH * 0.4,
                                sx + sway * 0.2, y - segH * 0.6
                            );
                        } else {
                            pg.ellipse(sx, y, segW, segH);
                        }
                    }
                }

                // --- Soft glow layer at base ---
                for (let i = 0; i < 6; i++) {
                    const gx = (w / 6) * (i + 0.5) +
                        (p.noise(i * 1.3, t * 0.4) - 0.5) * w * 0.06;
                    const gSize = w * 0.18 + p.noise(i * 0.7, t * 0.3) * w * 0.1;
                    pg.fill(25 + i * 3, 60, 50 + bass * 20, 15 + pulse * 5);
                    pg.ellipse(gx, h, gSize, gSize * 1.2);
                }

                // --- Embers ---
                for (let i = 0; i < embers.length; i++) {
                    const e = embers[i];
                    e.x += e.vx + Math.sin(t * 2 + i * 0.7) * 0.3;
                    e.y += e.vy * (1 + bass * 0.3);
                    e.life -= e.decay;

                    if (e.life <= 0 || e.y < 0) {
                        embers[i] = newEmber(w, h);
                        continue;
                    }

                    const ea = e.life * 65;
                    const eb = 60 + e.life * 35;
                    pg.fill(e.hue, 80, eb, ea);
                    const es = e.size * e.life;
                    pg.ellipse(e.x, e.y, es, es);
                }

                // Beat burst embers
                if (pulse > 0.4) {
                    const count = Math.floor(pulse * 8);
                    for (let i = 0; i < count; i++) {
                        pg.fill(20 + Math.random() * 25, 85, 90, pulse * 50);
                        const bx = Math.random() * w;
                        const by = h * (0.5 + Math.random() * 0.4);
                        pg.ellipse(bx, by, 2 + Math.random() * 2, 2 + Math.random() * 2);
                    }
                }

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.noStroke();
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
window.VJamFX.presets['fire-wall'] = FireWallPreset;
})();
