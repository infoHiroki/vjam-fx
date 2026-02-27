(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PixelCascadePreset extends BasePreset {
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
            const COLS = 32;
            let ROWS, cellW, cellH;
            let fallingBlocks = [];
            let grid = []; // stores color arrays or 0
            let stackMaxRow; // top row index of stack zone (bottom 30%)
            const STREAM_COUNT = 5;
            let streamX = [];

            const NES_COLORS = [
                [130, 80, 85],
                [240, 70, 90],
                [330, 75, 90],
                [50, 80, 95],
                [0, 80, 90],
                [270, 60, 85],
            ];

            const initGrid = (rows) => {
                grid = [];
                for (let r = 0; r < rows; r++) {
                    grid[r] = new Array(COLS).fill(0);
                }
                stackMaxRow = Math.floor(rows * 0.7); // stack zone: rows 70%~100% (bottom 30%)
            };

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                cellW = pg.width / COLS;
                cellH = cellW;
                ROWS = Math.ceil(pg.height / cellH);
                initGrid(ROWS);
                fallingBlocks = [];
                streamX = [];
                for (let i = 0; i < STREAM_COUNT; i++) {
                    streamX.push(Math.floor(Math.random() * (COLS - 2)) + 1);
                }
            };

            p.draw = () => {
                p.background(0);
                const speed = preset.params.speed;
                const bass = preset.audio.bass;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;

                const w = pg.width;
                const h = pg.height;

                // Clear pg
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(0, 0, 0, 100);

                // Spawn new falling blocks from streams
                const spawnRate = 0.08 + bass * 0.12 + pulse * 0.15;
                for (let s = 0; s < STREAM_COUNT; s++) {
                    if (Math.random() < spawnRate * speed) {
                        const col = NES_COLORS[s % NES_COLORS.length];
                        fallingBlocks.push({
                            x: streamX[s],
                            y: 0,
                            vy: 0.4 + Math.random() * 0.3,
                            col: col,
                        });
                    }
                    // Drift streams slightly
                    streamX[s] += (p.noise(s * 10, p.frameCount * 0.005) - 0.5) * 0.2;
                    streamX[s] = p.constrain(streamX[s], 1, COLS - 2);
                }

                // Beat burst: spawn a few extra
                if (pulse > 0.4) {
                    for (let s = 0; s < STREAM_COUNT; s++) {
                        const col = NES_COLORS[s % NES_COLORS.length];
                        fallingBlocks.push({
                            x: streamX[s] + (Math.random() - 0.5) * 2,
                            y: -Math.random() * 2,
                            vy: 0.3 + Math.random() * 0.5,
                            col: col,
                        });
                    }
                }

                // Update falling blocks
                for (let i = fallingBlocks.length - 1; i >= 0; i--) {
                    const b = fallingBlocks[i];
                    b.vy += 0.1 * speed; // gravity
                    b.vy = Math.min(b.vy, 2.5); // terminal velocity
                    b.y += b.vy * speed;

                    const gridCol = Math.floor(p.constrain(b.x, 0, COLS - 1));
                    const gridRow = Math.floor(b.y);

                    // Only stack in the bottom 30% zone
                    if (gridRow >= ROWS - 1) {
                        // Hit bottom — stack it
                        const settleRow = ROWS - 1;
                        if (!grid[settleRow][gridCol]) {
                            grid[settleRow][gridCol] = b.col.slice();
                        }
                        fallingBlocks.splice(i, 1);
                        continue;
                    }

                    // Check collision with existing stacked block (only in stack zone)
                    if (gridRow >= stackMaxRow - 1 && gridRow < ROWS - 1 && grid[gridRow + 1] && grid[gridRow + 1][gridCol]) {
                        const settleRow = gridRow;
                        if (settleRow >= stackMaxRow && settleRow < ROWS && !grid[settleRow][gridCol]) {
                            grid[settleRow][gridCol] = b.col.slice();
                        }
                        fallingBlocks.splice(i, 1);
                        continue;
                    }

                    // If above stack zone and would stack too high, just remove
                    if (gridRow >= 0 && gridRow < stackMaxRow && grid[gridRow + 1] && grid[gridRow + 1][gridCol]) {
                        fallingBlocks.splice(i, 1);
                        continue;
                    }

                    // Remove if fallen off screen
                    if (b.y > ROWS + 2) {
                        fallingBlocks.splice(i, 1);
                        continue;
                    }

                    // Draw falling block (same size/style as stacked)
                    const px = Math.floor(b.x) * cellW;
                    const py = b.y * cellH;
                    pg.fill(b.col[0], b.col[1], b.col[2], 90);
                    pg.noStroke();
                    pg.rect(px, py, cellW + 0.5, cellH + 0.5);
                    // Subtle glow
                    pg.fill(b.col[0], b.col[1] * 0.5, 100, 10);
                    pg.rect(px - 0.5, py - 0.5, cellW + 1, cellH + 1);
                }

                // Dissolve stacked blocks gradually from the bottom up
                // Every few frames, fade out some blocks in lowest rows
                const dissolveRate = 3 + Math.floor(bass * 2); // dissolve more on bass
                if (p.frameCount % Math.max(1, 6 - dissolveRate) === 0) {
                    // Dissolve random cells in stack zone
                    for (let r = ROWS - 1; r >= stackMaxRow; r--) {
                        for (let c = 0; c < COLS; c++) {
                            if (grid[r][c] && Math.random() < 0.08) {
                                grid[r][c] = 0;
                            }
                        }
                    }
                }

                // Also enforce: nothing stacks above stackMaxRow
                for (let r = 0; r < stackMaxRow; r++) {
                    for (let c = 0; c < COLS; c++) {
                        grid[r][c] = 0;
                    }
                }

                // Draw stacked grid (same style as falling blocks)
                for (let r = stackMaxRow; r < ROWS; r++) {
                    for (let c = 0; c < COLS; c++) {
                        if (grid[r][c]) {
                            const col = grid[r][c];
                            pg.fill(col[0], col[1], col[2], 85);
                            pg.noStroke();
                            pg.rect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
                        }
                    }
                }

                // Keep falling blocks count reasonable
                if (fallingBlocks.length > 120) fallingBlocks.splice(0, fallingBlocks.length - 120);

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                cellW = pg.width / COLS;
                cellH = cellW;
                ROWS = Math.ceil(pg.height / cellH);
                initGrid(ROWS);
                fallingBlocks = [];
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
window.VJamFX.presets['pixel-cascade'] = PixelCascadePreset;
})();
