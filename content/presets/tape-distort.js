(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class TapeDistortPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.jumpOffset = 0;
    }

    setup(container) {
        this.destroy();
        this.jumpOffset = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 4;
            const NUM_LINES = 60;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
            };

            p.draw = () => {
                p.background(0);
                const t = p.frameCount * 0.015;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.85;
                preset.jumpOffset *= 0.92;

                pg.background(0);

                const w = pg.width;
                const h = pg.height;
                const lineH = h / NUM_LINES;
                const bassAmp = 6 + preset.audio.bass * 30 + pulse * 25;
                const trebleJitter = preset.audio.treble * 4;

                // Wow: slow global oscillation
                const wow = Math.sin(t * 0.25) * 2.5;

                for (let i = 0; i < NUM_LINES; i++) {
                    const y = i * lineH + lineH * 0.5;
                    const noiseVal = p.noise(i * 0.25, t + i * 0.08);

                    // Base horizontal offset
                    let xOff = (noiseVal - 0.5) * bassAmp + wow + preset.jumpOffset;

                    // Flutter: fast jitter on random lines (treble-reactive)
                    if (p.noise(i * 0.7, t * 4) > 0.65) {
                        xOff += (Math.random() - 0.5) * (3 + trebleJitter);
                    }

                    // Occasional large glitch jump on a few lines
                    const glitchChance = p.noise(i * 1.3, t * 2);
                    if (glitchChance > 0.88 + (1 - pulse) * 0.08) {
                        xOff += (Math.random() - 0.5) * 25;
                    }

                    // Line weight: slight variation
                    const weight = lineH * (0.6 + p.noise(i * 0.4, t * 0.5) * 0.3);

                    // Brightness based on position and noise
                    const bri = 140 + noiseVal * 80 + preset.audio.mid * 30;

                    // --- Red channel (shifted left) ---
                    const rOff = xOff - (1.5 + pulse * 3);
                    pg.stroke(bri, 0, 0, 160 + noiseVal * 60);
                    pg.strokeWeight(weight);
                    pg.strokeCap(pg.SQUARE);
                    pg.line(rOff, y, w + rOff, y);

                    // --- Green channel (center) ---
                    pg.stroke(0, bri, 0, 160 + noiseVal * 60);
                    pg.strokeWeight(weight);
                    pg.line(xOff, y, w + xOff, y);

                    // --- Blue channel (shifted right) ---
                    const bOff = xOff + (1.5 + pulse * 3);
                    pg.stroke(0, 0, bri, 160 + noiseVal * 60);
                    pg.strokeWeight(weight);
                    pg.line(bOff, y, w + bOff, y);
                }

                // Rolling noise band (VHS tracking artifact)
                const bandSpeed = 12 + preset.audio.bass * 8;
                const bandY = ((t * bandSpeed) % (h + 30)) - 15;
                const bandH = 3 + preset.audio.treble * 6 + pulse * 4;
                pg.noStroke();
                for (let y = bandY; y < bandY + bandH; y += 1) {
                    for (let x = 0; x < w; x += 2) {
                        const n = Math.random();
                        pg.fill(
                            n * 200, n * 200, n * 200,
                            120 + Math.random() * 80
                        );
                        pg.rect(x, y, 2, 1);
                    }
                }

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
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
        this.jumpOffset = (Math.random() - 0.5) * 35 * strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['tape-distort'] = TapeDistortPreset;
})();
