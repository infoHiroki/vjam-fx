(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GrowthSpiralPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.n = 0;
        this.colorFlash = 0;
    }

    setup(container) {
        this.destroy();
        this.n = 0;
        this.colorFlash = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const goldenAngle = 137.508;
            const baseC = 4;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(0, 0, 5);
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;
                preset.colorFlash *= 0.95;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxR = Math.min(p.width, p.height) * 0.45;

                // Slow fade for trail
                pg.fill(0, 0, 5, 2);
                pg.noStroke();
                pg.rect(0, 0, pg.width, pg.height);

                // Draw new dots per frame
                const dotsPerFrame = Math.floor(3 + speed * 2 + pulse * 8);
                for (let i = 0; i < dotsPerFrame; i++) {
                    preset.n += 0.5;
                    const angle = preset.n * goldenAngle * (Math.PI / 180);
                    const r = baseC * Math.sqrt(preset.n);

                    // Wrap around when spiral exceeds canvas
                    if (r > maxR) {
                        preset.n = 0;
                        pg.fill(0, 0, 5, 8);
                        pg.rect(0, 0, pg.width, pg.height);
                        continue;
                    }

                    const x = cx + Math.cos(angle) * r;
                    const y = cy + Math.sin(angle) * r;

                    // HSB color: gold(40) -> green(120), shift with n
                    const baseHue = 40 + (preset.n % 200) / 200 * 80;
                    const hue = (baseHue + preset.colorFlash * 60) % 360;
                    const sat = 70 + p.noise(preset.n * 0.02) * 25;
                    const bri = 60 + pulse * 30 + preset.audio.rms * 20;

                    // Dot size decreases toward center
                    const dotSize = 2 + (r / maxR) * 5 + pulse * 2;

                    // Glow: draw 2x
                    pg.noStroke();
                    pg.fill(hue, sat * 0.6, bri, 20);
                    pg.ellipse(x, y, dotSize * 2.5, dotSize * 2.5);
                    pg.fill(hue, sat, bri, 70);
                    pg.ellipse(x, y, dotSize, dotSize);
                }

                // Additional ambient noise-driven dots
                if (preset.audio.mid > 0.3) {
                    const extraN = preset.n - Math.floor(Math.random() * 50);
                    if (extraN > 0) {
                        const a = extraN * goldenAngle * (Math.PI / 180);
                        const er = baseC * Math.sqrt(extraN);
                        if (er < maxR) {
                            const ex = cx + Math.cos(a) * er;
                            const ey = cy + Math.sin(a) * er;
                            pg.fill(60, 40, 90, 30);
                            pg.ellipse(ex, ey, 8, 8);
                        }
                    }
                }

                p.image(pg, 0, 0);

                // Center glow
                p.noStroke();
                const cGlow = 20 + pulse * 30;
                p.fill(50, 50, 90, 8 + pulse * 10);
                p.ellipse(cx, cy, cGlow * 3, cGlow * 3);
                p.fill(50, 30, 95, 15);
                p.ellipse(cx, cy, cGlow, cGlow);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                const oldPg = pg;
                if (pg) pg.remove();
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.image(oldPg, 0, 0, p.width, p.height);
                oldPg.remove();
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
        this.colorFlash = strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['growth-spiral'] = GrowthSpiralPreset;
})();
