(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PixelSortBPreset extends BasePreset {
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
            let sortThreshold = 0.5;
            let sortVertical = false;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noSmooth();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.colorMode(p.HSB, 360, 100, 100);
            };

            p.draw = () => {
                const t = p.frameCount * 0.01 * preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;

                const w = pg.width;
                const h = pg.height;

                // Generate colorful noise pattern
                pg.loadPixels();
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const n1 = pg.noise(x * 0.05 + t, y * 0.05 + t * 0.3);
                        const n2 = pg.noise(x * 0.08 + t * 0.5 + 100, y * 0.03);
                        const hue = (n1 * 360 + bass * 120) % 360;
                        const sat = 60 + n2 * 40;
                        const bri = n1 * 100;

                        const c = pg.color(hue, sat, bri);
                        const idx = (y * w + x) * 4;
                        pg.pixels[idx] = pg.red(c);
                        pg.pixels[idx + 1] = pg.green(c);
                        pg.pixels[idx + 2] = pg.blue(c);
                        pg.pixels[idx + 3] = 255;
                    }
                }
                pg.updatePixels();

                // Sort threshold modulated by audio
                sortThreshold = 0.3 + mid * 0.4 + treble * 0.3;

                // Beat: toggle sort direction and shift threshold
                if (pulse > 0.4) {
                    sortThreshold = Math.random() * 0.8 + 0.1;
                    sortVertical = !sortVertical;
                }

                // Pixel sort
                pg.loadPixels();
                const threshold = sortThreshold * 255;

                if (sortVertical) {
                    // Sort columns
                    for (let x = 0; x < w; x++) {
                        let start = -1;
                        for (let y = 0; y <= h; y++) {
                            if (y < h) {
                                const idx = (y * w + x) * 4;
                                const bri = pg.pixels[idx] * 0.299 + pg.pixels[idx + 1] * 0.587 + pg.pixels[idx + 2] * 0.114;
                                if (bri > threshold) {
                                    if (start === -1) start = y;
                                } else {
                                    if (start !== -1) {
                                        sortColumnSegment(pg.pixels, w, x, start, y - 1);
                                        start = -1;
                                    }
                                }
                            } else if (start !== -1) {
                                sortColumnSegment(pg.pixels, w, x, start, y - 1);
                            }
                        }
                    }
                } else {
                    // Sort rows
                    for (let y = 0; y < h; y++) {
                        let start = -1;
                        for (let x = 0; x <= w; x++) {
                            if (x < w) {
                                const idx = (y * w + x) * 4;
                                const bri = pg.pixels[idx] * 0.299 + pg.pixels[idx + 1] * 0.587 + pg.pixels[idx + 2] * 0.114;
                                if (bri > threshold) {
                                    if (start === -1) start = x;
                                } else {
                                    if (start !== -1) {
                                        sortRowSegment(pg.pixels, w, y, start, x - 1);
                                        start = -1;
                                    }
                                }
                            } else if (start !== -1) {
                                sortRowSegment(pg.pixels, w, y, start, x - 1);
                            }
                        }
                    }
                }

                pg.updatePixels();
                p.image(pg, 0, 0, p.width, p.height);
            };

            function sortRowSegment(pixels, w, y, x1, x2) {
                const seg = [];
                for (let x = x1; x <= x2; x++) {
                    const idx = (y * w + x) * 4;
                    seg.push({
                        r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2],
                        bri: pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114
                    });
                }
                seg.sort((a, b) => a.bri - b.bri);
                for (let i = 0; i < seg.length; i++) {
                    const idx = (y * w + (x1 + i)) * 4;
                    pixels[idx] = seg[i].r;
                    pixels[idx + 1] = seg[i].g;
                    pixels[idx + 2] = seg[i].b;
                }
            }

            function sortColumnSegment(pixels, w, x, y1, y2) {
                const seg = [];
                for (let y = y1; y <= y2; y++) {
                    const idx = (y * w + x) * 4;
                    seg.push({
                        r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2],
                        bri: pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114
                    });
                }
                seg.sort((a, b) => a.bri - b.bri);
                for (let i = 0; i < seg.length; i++) {
                    const idx = ((y1 + i) * w + x) * 4;
                    pixels[idx] = seg[i].r;
                    pixels[idx + 1] = seg[i].g;
                    pixels[idx + 2] = seg[i].b;
                }
            }

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.colorMode(p.HSB, 360, 100, 100);
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
window.VJamFX.presets['pixel-sort-b'] = PixelSortBPreset;
})();
