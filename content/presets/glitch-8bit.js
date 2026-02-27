(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class Glitch8bitPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.majorGlitch = 0;
    }

    setup(container) {
        this.destroy();
        this.majorGlitch = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 3;
            const GRID_X = 8;
            const GRID_Y = 6;

            // NES-inspired color palette (HSB)
            const NES_COLORS = [
                [0, 80, 90],     // red
                [130, 90, 80],   // green
                [240, 85, 95],   // blue
                [35, 90, 95],    // amber/orange
                [320, 75, 90],   // pink
                [55, 80, 90],    // yellow
            ];

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
                const t = p.frameCount * 0.01;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.85;
                preset.majorGlitch *= 0.9;

                const w = pg.width;
                const h = pg.height;

                // Trail bg
                pg.colorMode(pg.RGB);
                pg.noStroke();
                pg.fill(0, 0, 0, 40);
                pg.rect(0, 0, w, h);
                pg.colorMode(pg.HSB, 360, 100, 100, 100);

                const cellW = w / GRID_X;
                const cellH = h / GRID_Y;
                const glitchIntensity = p.noise(t * 0.5) * 0.5 + preset.majorGlitch;

                for (let gy = 0; gy < GRID_Y; gy++) {
                    // Row displacement
                    let rowShift = 0;
                    if (preset.majorGlitch > 0.3 && Math.random() < 0.4) {
                        rowShift = (Math.random() - 0.5) * cellW * 2;
                    }

                    for (let gx = 0; gx < GRID_X; gx++) {
                        const bx = gx * cellW;
                        const by = gy * cellH;

                        // Block displacement
                        let dx = rowShift;
                        let dy = 0;
                        const shouldGlitch = p.noise(gx * 0.5, gy * 0.5, t * 2) > (1 - glitchIntensity * 0.6);

                        if (shouldGlitch) {
                            dx += (Math.random() - 0.5) * cellW * glitchIntensity;
                            dy += (Math.random() - 0.5) * cellH * 0.3 * glitchIntensity;
                        }

                        // Pick color from NES palette
                        const colorIdx = Math.floor(p.noise(gx * 0.3, gy * 0.3, t * 0.05) * NES_COLORS.length);
                        const [hue, sat, bri] = NES_COLORS[colorIdx % NES_COLORS.length];

                        // Normal block or corrupted
                        const corrupted = shouldGlitch && glitchIntensity > 0.4;

                        if (corrupted) {
                            // Chromatic separation: 3 offset draws
                            const sepAmt = 2 + glitchIntensity * 4;
                            pg.noStroke();
                            // R channel
                            pg.fill(0, 80, bri, 35);
                            pg.rect(bx + dx - sepAmt, by + dy, cellW - 1, cellH - 1);
                            // G channel
                            pg.fill(130, 80, bri, 35);
                            pg.rect(bx + dx, by + dy, cellW - 1, cellH - 1);
                            // B channel
                            pg.fill(240, 80, bri, 35);
                            pg.rect(bx + dx + sepAmt, by + dy, cellW - 1, cellH - 1);
                        } else {
                            // Normal block with subtle pattern
                            const blockBri = bri * (0.5 + p.noise(gx, gy, t * 0.3) * 0.5);
                            pg.noStroke();
                            pg.fill(hue, sat, blockBri, 55 + pulse * 20);
                            pg.rect(bx + dx, by + dy, cellW - 1, cellH - 1);

                            // Inner pixel detail (8-bit feel)
                            if (p.noise(gx * 2, gy * 2, t) > 0.5) {
                                const subSize = cellW / 3;
                                pg.fill(hue, sat * 0.7, blockBri * 1.3, 40);
                                const sx = bx + dx + Math.floor(Math.random() * 2) * subSize;
                                const sy = by + dy + Math.floor(Math.random() * 2) * subSize;
                                pg.rect(sx, sy, subSize, subSize);
                            }
                        }
                    }
                }

                // Scanline overlay
                pg.stroke(0, 0, 0, 15);
                pg.strokeWeight(0.5);
                for (let y = 0; y < h; y += 3) {
                    pg.line(0, y, w, y);
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
        this.majorGlitch = strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['glitch-8bit'] = Glitch8bitPreset;
})();
