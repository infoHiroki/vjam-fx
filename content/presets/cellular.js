(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class CellularPreset extends BasePreset {
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
                let pg;
                const RES = 6; // Low res grid for cellular automaton
                let grid, nextGrid;
                let cols, rows;
                let hueOffset = 0;
                let frameSkip = 0;

                function initGrid() {
                    cols = Math.ceil(p.width / RES);
                    rows = Math.ceil(p.height / RES);
                    grid = new Uint8Array(cols * rows);
                    nextGrid = new Uint8Array(cols * rows);
                    // Random seed
                    for (let i = 0; i < grid.length; i++) {
                        grid[i] = Math.random() < 0.3 ? 1 : 0;
                    }
                }

                function countNeighbors(x, y) {
                    let sum = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = (x + dx + cols) % cols;
                            const ny = (y + dy + rows) % rows;
                            sum += grid[ny * cols + nx];
                        }
                    }
                    return sum;
                }

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
                    initGrid();
                };

                p.draw = () => {
                    const bass = preset.audio.bass;
                    const pulse = preset.beatPulse;
                    preset.beatPulse *= 0.92;

                    // Speed based on bass
                    const updateRate = Math.max(1, Math.floor(6 - bass * 5));
                    frameSkip++;
                    if (frameSkip >= updateRate) {
                        frameSkip = 0;

                        // Game of Life variant
                        for (let y = 0; y < rows; y++) {
                            for (let x = 0; x < cols; x++) {
                                const idx = y * cols + x;
                                const neighbors = countNeighbors(x, y);
                                const alive = grid[idx];

                                if (alive) {
                                    // Survive with 2-3 neighbors (classic)
                                    nextGrid[idx] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
                                } else {
                                    // Birth with 3 neighbors (classic)
                                    nextGrid[idx] = (neighbors === 3) ? 1 : 0;
                                }
                            }
                        }

                        // Swap
                        const tmp = grid;
                        grid = nextGrid;
                        nextGrid = tmp;
                    }

                    // Beat: inject cells
                    if (pulse > 0.3) {
                        const cx = Math.floor(cols / 2);
                        const cy = Math.floor(rows / 2);
                        const radius = Math.floor(5 + pulse * 10);
                        for (let i = 0; i < radius * 4; i++) {
                            const rx = cx + Math.floor((Math.random() - 0.5) * radius * 2);
                            const ry = cy + Math.floor((Math.random() - 0.5) * radius * 2);
                            if (rx >= 0 && rx < cols && ry >= 0 && ry < rows) {
                                grid[ry * cols + rx] = 1;
                            }
                        }
                        hueOffset += 30;
                    }

                    // Render
                    pg.background(0, 0, 0, 100);
                    for (let y = 0; y < rows; y++) {
                        for (let x = 0; x < cols; x++) {
                            if (grid[y * cols + x]) {
                                const hue = (hueOffset + x * 2 + y * 2) % 360;
                                const bri = 60 + bass * 30 + pulse * 20;
                                pg.fill(hue, 70, Math.min(100, bri), 90);
                                pg.rect(x, y, 1, 1);
                            }
                        }
                    }

                    p.image(pg, 0, 0, p.width, p.height);
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                    pg = p.createGraphics(
                        Math.ceil(p.width / RES),
                        Math.ceil(p.height / RES)
                    );
                    pg.colorMode(p.HSB, 360, 100, 100, 100);
                    pg.noStroke();
                    initGrid();
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

    window.VJamFX.presets['cellular'] = CellularPreset;
})();
