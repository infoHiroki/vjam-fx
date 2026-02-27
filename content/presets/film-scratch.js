(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class FilmScratchPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let pg, pgAccum;
            const RES = 3;
            let spliceY = -100;
            let spliceActive = false;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pgAccum = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pgAccum.colorMode(p.HSB, 360, 100, 100, 100);
                pgAccum.background(0, 0, 0, 100);
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.02 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                const w = pg.width;
                const h = pg.height;

                // Slowly fade accumulated scratches/dust on pgAccum
                pgAccum.fill(0, 0, 0, 1.5);
                pgAccum.noStroke();
                pgAccum.rect(0, 0, w, h);

                // New vertical scratch lines (1-2 per second at 60fps)
                const scratchRate = 0.025 + rms * 0.03 + pulse * 0.15;
                if (Math.random() < scratchRate * speed) {
                    const sx = Math.random() * w;
                    const sLen = h * (0.3 + Math.random() * 0.7);
                    const sy = Math.random() * (h - sLen);
                    const bri = 50 + Math.random() * 40;
                    const wobble = Math.random() * 2;

                    pgAccum.stroke(30, 15, bri, 60 + Math.random() * 30);
                    pgAccum.strokeWeight(0.3 + Math.random() * 0.7);
                    pgAccum.noFill();
                    pgAccum.beginShape();
                    for (let y = sy; y < sy + sLen; y += 3) {
                        const wx = sx + Math.sin(y * 0.05 + Math.random()) * wobble;
                        pgAccum.vertex(wx, y);
                    }
                    pgAccum.endShape();
                }

                // Burst of scratches on beat
                if (pulse > 0.4) {
                    for (let s = 0; s < 5; s++) {
                        const sx = Math.random() * w;
                        const sLen = h * (0.2 + Math.random() * 0.5);
                        const sy = Math.random() * h;
                        pgAccum.stroke(30, 20, 70 + Math.random() * 25, 50);
                        pgAccum.strokeWeight(0.3 + Math.random() * 0.5);
                        pgAccum.line(sx, sy, sx + (Math.random() - 0.5) * 3, sy + sLen);
                    }
                }

                // Dust specks
                const dustRate = 0.08 + treble * 0.05;
                if (Math.random() < dustRate * speed) {
                    const dx = Math.random() * w;
                    const dy = Math.random() * h;
                    pgAccum.noStroke();
                    pgAccum.fill(30, 10, 60 + Math.random() * 30, 50);
                    const ds = 0.5 + Math.random() * 1.5;
                    pgAccum.ellipse(dx, dy, ds, ds);
                }

                // Hair/fiber (bezier curves, occasional)
                if (Math.random() < 0.008 * speed) {
                    const hx = Math.random() * w;
                    const hy = Math.random() * h;
                    pgAccum.stroke(30, 8, 40, 25);
                    pgAccum.strokeWeight(0.3);
                    pgAccum.noFill();
                    pgAccum.bezier(
                        hx, hy,
                        hx + (Math.random() - 0.5) * 20, hy + Math.random() * 15,
                        hx + (Math.random() - 0.5) * 20, hy + Math.random() * 25,
                        hx + (Math.random() - 0.5) * 10, hy + Math.random() * 35
                    );
                }

                // Film splice: horizontal bright band that scrolls
                if (spliceActive) {
                    spliceY += 2 * speed;
                    if (spliceY > h + 10) spliceActive = false;
                } else if (Math.random() < 0.003 + pulse * 0.02) {
                    spliceActive = true;
                    spliceY = -5;
                }

                // Compose final frame
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(30, 25, 6, 100); // Dark sepia base

                // Subtle film grain across whole frame
                pg.noStroke();
                for (let i = 0; i < 120; i++) {
                    const gx = Math.random() * w;
                    const gy = Math.random() * h;
                    const gb = Math.random() * 18;
                    pg.fill(30, 10, gb, 30);
                    pg.rect(gx, gy, 1, 1);
                }

                // Subtle vignette: darken corners with 4 rects
                pg.noStroke();
                pg.fill(0, 0, 0, 15);
                pg.rect(0, 0, w * 0.1, h);
                pg.rect(w * 0.9, 0, w * 0.1, h);
                pg.fill(0, 0, 0, 10);
                pg.rect(0, 0, w, h * 0.08);
                pg.rect(0, h * 0.92, w, h * 0.08);

                // Draw accumulated scratches/dust
                pg.image(pgAccum, 0, 0);

                // Film splice band
                if (spliceActive) {
                    // Glow around splice
                    for (let g = 3; g > 0; g--) {
                        pg.fill(35, 30, 60, 8 / g);
                        pg.noStroke();
                        pg.rect(0, spliceY - g * 3, w, 4 + g * 6);
                    }
                    pg.fill(35, 40, 90, 70);
                    pg.noStroke();
                    pg.rect(0, spliceY, w, 3);
                    pg.fill(35, 20, 70, 40);
                    pg.rect(0, spliceY + 3, w, 1);
                }

                // Flicker: random brightness variation
                const flicker = p.noise(t * 5) * 0.15;
                if (flicker > 0.1) {
                    pg.fill(30, 10, 30, 8);
                    pg.noStroke();
                    pg.rect(0, 0, w, h);
                }

                // Frame jitter on beat
                const jitterX = pulse > 0.3 ? (Math.random() - 0.5) * 3 * pulse : 0;
                const jitterY = pulse > 0.3 ? (Math.random() - 0.5) * 2 * pulse : 0;

                p.background(0);
                p.image(pg, jitterX, jitterY, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                if (pgAccum) pgAccum.remove();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pgAccum = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pgAccum.colorMode(p.HSB, 360, 100, 100, 100);
                pgAccum.background(0, 0, 0, 100);
            };
        }, container);
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX.presets['film-scratch'] = FilmScratchPreset;
})();
