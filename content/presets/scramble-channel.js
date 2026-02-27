(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ScrambleChannelPreset extends BasePreset {
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
            let pg, pgR, pgB;
            const RES = 3;
            const BAND_COUNT = 20;
            let bands = [];
            let clearTimer = 0;

            // Classic TV test pattern colors in HSB
            const TEST_COLORS = [
                [0, 0, 95],    // white
                [55, 80, 95],  // yellow
                [175, 80, 90], // cyan
                [130, 70, 85], // green
                [290, 70, 85], // magenta
                [0, 80, 85],   // red
                [240, 80, 90], // blue
            ];

            const initBands = () => {
                bands = [];
                for (let i = 0; i < BAND_COUNT; i++) {
                    bands.push({
                        speed: (Math.random() - 0.5) * 4,
                        offset: 0,
                        colorBar: Math.random() < 0.15 ? TEST_COLORS[Math.floor(Math.random() * TEST_COLORS.length)] : null
                    });
                }
            };

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pgR = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pgB = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pgR.colorMode(p.HSB, 360, 100, 100, 100);
                pgB.colorMode(p.HSB, 360, 100, 100, 100);
                initBands();
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.02 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;

                const w = pg.width;
                const h = pg.height;
                const bandH = h / BAND_COUNT;

                // Clear timer for brief alignment
                if (clearTimer > 0) clearTimer -= speed;

                // Beat: reshuffle speeds + trigger color bars
                if (pulse > 0.3) {
                    for (let i = 0; i < BAND_COUNT; i++) {
                        bands[i].speed = (Math.random() - 0.5) * 6 * (1 + pulse);
                        bands[i].colorBar = Math.random() < 0.3 ? TEST_COLORS[Math.floor(Math.random() * TEST_COLORS.length)] : null;
                    }
                    clearTimer = 10;
                }

                pg.background(0, 0, 5, 100);

                // Draw bands with displacement
                for (let i = 0; i < BAND_COUNT; i++) {
                    const b = bands[i];
                    const by = i * bandH;

                    // Update offset
                    if (clearTimer <= 0) {
                        b.offset += b.speed * speed;
                    } else {
                        b.offset *= 0.85; // snap toward center
                    }

                    // Band content
                    const ox = b.offset;

                    if (b.colorBar && Math.random() > 0.3) {
                        // Solid color bar
                        pg.noStroke();
                        pg.fill(b.colorBar[0], b.colorBar[1], b.colorBar[2], 85);
                        pg.rect(ox, by, w, bandH + 0.5);
                    } else {
                        // Noise/image content
                        const noiseSeed = i * 100;
                        for (let x = 0; x < w; x += 3) {
                            const n = p.noise((x + ox) * 0.02 + noiseSeed, t + i * 0.5);
                            const hue = (n * 360 + i * 20) % 360;
                            const bri = 20 + n * 50 + rms * 20;
                            pg.noStroke();
                            pg.fill(hue, 40 + mid * 30, bri, 70);
                            pg.rect(x, by, 3.5, bandH + 0.5);
                        }
                    }

                    // Edge artifacts at displacement boundaries
                    if (Math.abs(b.speed) > 1.5) {
                        pg.stroke(0, 0, 80, 30);
                        pg.strokeWeight(0.5);
                        pg.line(0, by, w, by);
                    }
                }

                // RGB separation effect (every 3rd frame)
                if (p.frameCount % 3 === 0) {
                    const shift = 2 + bass * 3;
                    // Draw shifted copies for chromatic aberration
                    pgR.clear();
                    pgB.clear();
                    pgR.tint(0, 80, 80, 25);
                    pgR.image(pg, -shift, 0);
                    pgB.tint(240, 80, 80, 25);
                    pgB.image(pg, shift, 0);

                    pg.blendMode(p.ADD);
                    pg.image(pgR, 0, 0);
                    pg.image(pgB, 0, 0);
                    pg.blendMode(p.BLEND);
                }

                // Horizontal interference lines
                pg.stroke(0, 0, 60, 20);
                pg.strokeWeight(0.3);
                for (let y = 0; y < h; y += 2) {
                    if (Math.random() < 0.3) pg.line(0, y, w, y);
                }

                // Occasional bright horizontal flash line
                if (Math.random() < 0.03 + treble * 0.05) {
                    const fy = Math.random() * h;
                    pg.stroke(0, 0, 90, 50);
                    pg.strokeWeight(1);
                    pg.line(0, fy, w, fy);
                }

                // Glow on color bar bands
                pg.noStroke();
                for (let i = 0; i < BAND_COUNT; i++) {
                    if (bands[i].colorBar) {
                        const by = i * bandH;
                        for (let g = 2; g > 0; g--) {
                            pg.fill(bands[i].colorBar[0], 30, 60, 4 / g);
                            pg.rect(0, by - g * 2, w, bandH + g * 4);
                        }
                    }
                }

                // Clear frame flash
                if (clearTimer > 5) {
                    pg.fill(0, 0, 95, 15);
                    pg.noStroke();
                    pg.rect(0, 0, w, h);
                }

                // Scanlines
                pg.stroke(0, 0, 0, 12);
                pg.strokeWeight(0.3);
                for (let y = 0; y < h; y += 3) {
                    pg.line(0, y, w, y);
                }

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pgR = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pgB = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pgR.colorMode(p.HSB, 360, 100, 100, 100);
                pgB.colorMode(p.HSB, 360, 100, 100, 100);
                initBands();
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
window.VJamFX.presets['scramble-channel'] = ScrambleChannelPreset;
})();
