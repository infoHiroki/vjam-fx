(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DotHalftonePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.timeJump = 0;
    }

    setup(container) {
        this.destroy();
        this.timeJump = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 3;
            const COLS = 32;
            const ROWS = 22;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.colorMode(p.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                const speed = 0.015 + preset.audio.mid * 0.01;
                const t = p.frameCount * speed + preset.timeJump;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                pg.background(0, 0, 5);

                const cellW = pg.width / COLS;
                const cellH = pg.height / ROWS;
                const maxSize = Math.min(cellW, cellH) * 0.9;

                // First grid layer (base)
                pg.noStroke();
                for (let row = 0; row < ROWS; row++) {
                    for (let col = 0; col < COLS; col++) {
                        const n = p.noise(col * 0.15, row * 0.15, t * 0.02);
                        const dotSize = n * maxSize * (0.6 + preset.audio.bass * 0.4 + pulse * 0.3);
                        if (dotSize < 1) continue;

                        const x = col * cellW + cellW / 2;
                        const y = row * cellH + cellH / 2;

                        // Amber hue with slight variation
                        const hue = 35 + n * 10;
                        const bri = 50 + n * 40 + pulse * 15;
                        pg.fill(hue, 50, bri, 70);
                        pg.ellipse(x, y, dotSize, dotSize);
                    }
                }

                // Second grid layer at slight angle for moire
                pg.push();
                pg.translate(pg.width / 2, pg.height / 2);
                pg.rotate(0.06);
                pg.translate(-pg.width / 2, -pg.height / 2);

                for (let row = -1; row < ROWS + 1; row++) {
                    for (let col = -1; col < COLS + 1; col++) {
                        const n = p.noise(col * 0.15 + 50, row * 0.15 + 50, t * 0.02 + 10);
                        const dotSize = n * maxSize * 0.7 * (0.5 + preset.audio.treble * 0.3);
                        if (dotSize < 1) continue;

                        const x = col * cellW + cellW / 2;
                        const y = row * cellH + cellH / 2;

                        const hue = 30 + n * 15;
                        const bri = 40 + n * 35;
                        pg.fill(hue, 40, bri, 45);
                        pg.ellipse(x, y, dotSize, dotSize);
                    }
                }

                pg.pop();

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
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
        this.timeJump += 2 + strength * 3;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['dot-halftone'] = DotHalftonePreset;
})();
