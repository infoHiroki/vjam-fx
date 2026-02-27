(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CathodeGlowPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.paramA = 3;
        this.paramB = 2;
        this.targetA = 3;
        this.targetB = 2;
        this.delta = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 3;
            const TRAIL_POINTS = 200;
            let trailIdx = 0;
            const trailX = new Float32Array(TRAIL_POINTS);
            const trailY = new Float32Array(TRAIL_POINTS);

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
                const t = p.frameCount * 0.025;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                // Slowly morph parameters
                preset.paramA += (preset.targetA - preset.paramA) * 0.005;
                preset.paramB += (preset.targetB - preset.paramB) * 0.005;
                preset.delta += 0.003 + preset.audio.mid * 0.005;

                const w = pg.width;
                const h = pg.height;
                const cx = w / 2;
                const cy = h / 2;

                // Phosphor fade (slow green afterglow)
                pg.colorMode(pg.RGB);
                pg.noStroke();
                pg.fill(0, 0, 0, 6);
                pg.rect(0, 0, w, h);
                pg.colorMode(pg.HSB, 360, 100, 100, 100);

                // Lissajous curve point
                const a = preset.paramA;
                const b = preset.paramB;
                const ampX = (w * 0.38) + preset.audio.bass * w * 0.05;
                const ampY = (h * 0.38) + preset.audio.bass * h * 0.05;

                const lx = cx + ampX * Math.sin(a * t + preset.delta);
                const ly = cy + ampY * Math.sin(b * t);

                // Store trail
                trailX[trailIdx % TRAIL_POINTS] = lx;
                trailY[trailIdx % TRAIL_POINTS] = ly;
                trailIdx++;

                // Draw recent trail segments
                const trailLen = Math.min(trailIdx, TRAIL_POINTS);
                pg.noFill();
                pg.strokeWeight(1);
                for (let i = 1; i < trailLen; i++) {
                    const idx = (trailIdx - trailLen + i) % TRAIL_POINTS;
                    const prevIdx = (idx - 1 + TRAIL_POINTS) % TRAIL_POINTS;
                    const age = i / trailLen;
                    pg.stroke(130, 100, 70 * age + 30, 50 * age);
                    pg.line(trailX[prevIdx], trailY[prevIdx], trailX[idx], trailY[idx]);
                }

                // Bright dot with glow (2 layers)
                pg.noStroke();
                // Outer glow
                pg.fill(130, 80, 90, 25 + pulse * 20);
                pg.ellipse(lx, ly, 10, 10);
                // Core
                pg.fill(130, 60, 100, 70 + pulse * 25);
                pg.ellipse(lx, ly, 4, 4);

                // Subtle grid overlay (oscilloscope graticule)
                pg.stroke(130, 30, 25, 12);
                pg.strokeWeight(0.5);
                for (let gx = 0; gx < w; gx += w / 8) {
                    pg.line(gx, 0, gx, h);
                }
                for (let gy = 0; gy < h; gy += h / 6) {
                    pg.line(0, gy, w, gy);
                }

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
        // Jump to new Lissajous parameters
        const options = [
            [3, 2], [5, 4], [3, 4], [5, 3], [7, 4], [4, 3], [5, 6], [7, 5]
        ];
        const choice = options[Math.floor(Math.random() * options.length)];
        this.targetA = choice[0];
        this.targetB = choice[1];
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['cathode-glow'] = CathodeGlowPreset;
})();
