(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PixelMosaicPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.pendingBeats = [];
        this.gridW = 40;
        this.gridH = 30;
        this.grid = [];
        this.nextGrid = [];
        this.palette = [
            { h: 130, s: 80, b: 65 },  // green
            { h: 240, s: 70, b: 62 },  // blue
            { h: 0,   s: 80, b: 65 },  // red
            { h: 330, s: 70, b: 70 },  // pink
            { h: 50,  s: 80, b: 70 },  // yellow
        ];
        this.trailGfx = null;
    }

    setup(container) {
        this.destroy();
        this.pendingBeats = [];
        const preset = this;

        // Initialize grid randomly
        this.grid = [];
        this.nextGrid = [];
        for (let i = 0; i < this.gridW * this.gridH; i++) {
            this.grid.push(Math.floor(Math.random() * 5));
            this.nextGrid.push(0);
        }

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                preset.trailGfx = p.createGraphics(p.width, p.height);
                preset.trailGfx.colorMode(preset.trailGfx.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const gw = preset.gridW;
                const gh = preset.gridH;
                const cellW = p.width / gw;
                const cellH = p.height / gh;

                // Process beats
                for (const beat of preset.pendingBeats) {
                    const count = Math.floor(gw * gh * 0.2 * beat.strength);
                    for (let i = 0; i < count; i++) {
                        const idx = Math.floor(Math.random() * gw * gh);
                        preset.grid[idx] = Math.floor(Math.random() * 5);
                    }
                }
                preset.pendingBeats = [];

                // Update cellular automaton every 4 frames
                if (p.frameCount % 4 === 0) {
                    for (let y = 0; y < gh; y++) {
                        for (let x = 0; x < gw; x++) {
                            const idx = y * gw + x;
                            const current = preset.grid[idx];

                            // Count neighbor states
                            const counts = [0, 0, 0, 0, 0];
                            for (let dy = -1; dy <= 1; dy++) {
                                for (let dx = -1; dx <= 1; dx++) {
                                    if (dx === 0 && dy === 0) continue;
                                    const nx = (x + dx + gw) % gw;
                                    const ny = (y + dy + gh) % gh;
                                    counts[preset.grid[ny * gw + nx]]++;
                                }
                            }

                            // Find most common neighbor state
                            let maxCount = 0;
                            let maxState = current;
                            for (let s = 0; s < 5; s++) {
                                if (counts[s] > maxCount) {
                                    maxCount = counts[s];
                                    maxState = s;
                                }
                            }

                            // Adopt if 2+ neighbors share state
                            if (maxCount >= 2 && maxState !== current) {
                                preset.nextGrid[idx] = maxState;
                            } else {
                                preset.nextGrid[idx] = current;
                            }
                        }
                    }

                    // Swap grids
                    const tmp = preset.grid;
                    preset.grid = preset.nextGrid;
                    preset.nextGrid = tmp;
                }

                // Trail effect
                const tg = preset.trailGfx;
                tg.colorMode(tg.HSB, 360, 100, 100, 100);
                tg.fill(0, 0, 0, 15);
                tg.noStroke();
                tg.rect(0, 0, tg.width, tg.height);

                // Draw cells onto trail graphics
                tg.noStroke();
                for (let y = 0; y < gh; y++) {
                    for (let x = 0; x < gw; x++) {
                        const state = preset.grid[y * gw + x];
                        const pal = preset.palette[state];
                        const bri = pal.b + bass * 12;
                        tg.fill(pal.h, pal.s, Math.min(bri, 100), 72);
                        tg.rect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
                    }
                }

                p.background(0);
                p.image(tg, 0, 0);

                // Grid lines for pixel look
                p.stroke(0, 0, 0, 20);
                p.strokeWeight(0.5);
                for (let x = 0; x <= gw; x++) {
                    p.line(x * cellW, 0, x * cellW, p.height);
                }
                for (let y = 0; y <= gh; y++) {
                    p.line(0, y * cellH, p.width, y * cellH);
                }

                // Scanline retro overlay
                p.stroke(0, 0, 100, 3);
                p.strokeWeight(1);
                for (let y = 0; y < p.height; y += 4) {
                    p.line(0, y, p.width, y);
                }

                // Glow on active areas
                p.noStroke();
                const glowCells = 3 + Math.floor(mid * 5);
                for (let i = 0; i < glowCells; i++) {
                    const gx = Math.floor(p.noise(i * 7.1, p.frameCount * 0.02) * gw);
                    const gy = Math.floor(p.noise(i * 11.3, p.frameCount * 0.02) * gh);
                    const state = preset.grid[gy * gw + gx];
                    const pal = preset.palette[state];
                    for (let layer = 1; layer >= 0; layer--) {
                        const s = cellW * (2 + layer * 2);
                        p.fill(pal.h, pal.s - 20, pal.b, 5 - layer * 2);
                        p.ellipse(gx * cellW + cellW / 2, gy * cellH + cellH / 2, s, s);
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (preset.trailGfx) preset.trailGfx.remove();
                preset.trailGfx = p.createGraphics(p.width, p.height);
                preset.trailGfx.colorMode(preset.trailGfx.HSB, 360, 100, 100, 100);
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
        this.pendingBeats.push({ strength });
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['pixel-mosaic'] = PixelMosaicPreset;
})();
