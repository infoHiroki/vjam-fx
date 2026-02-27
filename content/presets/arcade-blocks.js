(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ArcadeBlocksPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.pendingBeats = [];
        this.gridCols = 10;
        this.gridRows = 20;
        this.board = [];
        this.boardColors = [];
        this.piece = null;
        this.dropTimer = 0;
        this.dropInterval = 30;
        this.score = 0;
        this.flashRows = [];
        this.pieces = [
            { shape: [[0,0],[0,1],[0,2],[0,3]], color: { h: 180, s: 80, b: 90 } },  // I
            { shape: [[0,0],[1,0],[1,1],[1,2]], color: { h: 240, s: 70, b: 85 } },  // L
            { shape: [[0,0],[0,1],[0,2],[1,1]], color: { h: 330, s: 70, b: 90 } },  // T
            { shape: [[0,0],[0,1],[1,1],[1,2]], color: { h: 130, s: 80, b: 80 } },  // S
            { shape: [[1,0],[1,1],[0,1],[0,2]], color: { h: 50, s: 80, b: 90 } },   // Z
            { shape: [[0,0],[0,1],[1,0],[1,1]], color: { h: 0, s: 75, b: 85 } },    // O
        ];
    }

    setup(container) {
        this.destroy();
        this.pendingBeats = [];
        this.score = 0;
        this.flashRows = [];
        this.dropTimer = 0;
        const preset = this;

        // Initialize empty board
        this.board = new Array(this.gridCols * this.gridRows).fill(0);
        this.boardColors = new Array(this.gridCols * this.gridRows).fill(null);
        this._spawnPiece();

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                p.background(0);
                const bass = preset.audio.bass;
                const cols = preset.gridCols;
                const rows = preset.gridRows;
                const cellSize = Math.min(p.width / (cols + 4), p.height / (rows + 2));
                const boardW = cols * cellSize;
                const boardH = rows * cellSize;
                const ox = (p.width - boardW) / 2;
                const oy = (p.height - boardH) / 2;

                // Process beats - instant drop
                for (const beat of preset.pendingBeats) {
                    if (preset.piece && beat.strength > 0.3) {
                        while (preset._canMove(0, 1)) {
                            preset.piece.row++;
                        }
                        preset._lockPiece();
                        preset._checkRows(p);
                        preset._spawnPiece();
                    }
                }
                preset.pendingBeats = [];

                // Auto drop
                preset.dropTimer++;
                const interval = Math.max(8, preset.dropInterval - Math.floor(bass * 15));
                if (preset.dropTimer >= interval) {
                    preset.dropTimer = 0;
                    if (preset.piece) {
                        if (preset._canMove(0, 1)) {
                            preset.piece.row++;
                        } else {
                            preset._lockPiece();
                            preset._checkRows(p);
                            preset._spawnPiece();
                        }
                    }
                }

                // Draw board border
                p.stroke(130, 60, 60, 50);
                p.strokeWeight(2);
                p.noFill();
                p.rect(ox - 2, oy - 2, boardW + 4, boardH + 4);

                // Draw locked blocks
                p.noStroke();
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const idx = r * cols + c;
                        if (preset.board[idx]) {
                            const col = preset.boardColors[idx];
                            const flash = preset.flashRows.includes(r);
                            const bri = flash ? 100 : col.b;
                            p.fill(col.h, flash ? 20 : col.s, bri, 90);
                            p.rect(ox + c * cellSize + 1, oy + r * cellSize + 1,
                                   cellSize - 2, cellSize - 2, 2);
                            // Highlight
                            p.fill(0, 0, 100, 15);
                            p.rect(ox + c * cellSize + 1, oy + r * cellSize + 1,
                                   cellSize - 2, (cellSize - 2) * 0.3, 2);
                        }
                    }
                }

                // Draw active piece
                if (preset.piece) {
                    const pc = preset.piece.color;
                    for (const [dr, dc] of preset.piece.type.shape) {
                        const r = preset.piece.row + dr;
                        const c = preset.piece.col + dc;
                        if (r >= 0 && r < rows && c >= 0 && c < cols) {
                            // Glow
                            p.fill(pc.h, pc.s - 20, pc.b, 15);
                            p.ellipse(ox + c * cellSize + cellSize / 2,
                                      oy + r * cellSize + cellSize / 2,
                                      cellSize * 2, cellSize * 2);
                            // Block
                            p.fill(pc.h, pc.s, pc.b, 90);
                            p.rect(ox + c * cellSize + 1, oy + r * cellSize + 1,
                                   cellSize - 2, cellSize - 2, 2);
                        }
                    }
                }

                // Score display
                p.fill(130, 60, 80, 70);
                p.noStroke();
                p.textSize(cellSize * 0.8);
                p.textAlign(p.CENTER, p.TOP);
                p.text(String(preset.score).padStart(6, '0'), p.width / 2, oy - cellSize * 1.2);

                // CRT scanlines
                p.stroke(0, 0, 0, 15);
                p.strokeWeight(1);
                for (let y = 0; y < p.height; y += 3) {
                    p.line(0, y, p.width, y);
                }

                // Flash row decay
                if (preset.flashRows.length > 0 && p.frameCount % 3 === 0) {
                    preset.flashRows = [];
                }

                // Grid lines
                p.stroke(130, 30, 30, 12);
                p.strokeWeight(0.5);
                for (let c = 0; c <= cols; c++) {
                    p.line(ox + c * cellSize, oy, ox + c * cellSize, oy + boardH);
                }
                for (let r = 0; r <= rows; r++) {
                    p.line(ox, oy + r * cellSize, ox + boardW, oy + r * cellSize);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _spawnPiece() {
        const type = this.pieces[Math.floor(Math.random() * this.pieces.length)];
        this.piece = {
            type: type,
            color: type.color,
            row: 0,
            col: Math.floor(this.gridCols / 2) - 1
        };
        // If can't place, reset board
        if (!this._canMove(0, 0)) {
            this.board.fill(0);
            this.boardColors.fill(null);
        }
    }

    _canMove(dc, dr) {
        if (!this.piece) return false;
        for (const [sdr, sdc] of this.piece.type.shape) {
            const r = this.piece.row + sdr + dr;
            const c = this.piece.col + sdc + dc;
            if (c < 0 || c >= this.gridCols || r >= this.gridRows) return false;
            if (r >= 0 && this.board[r * this.gridCols + c]) return false;
        }
        return true;
    }

    _lockPiece() {
        if (!this.piece) return;
        for (const [dr, dc] of this.piece.type.shape) {
            const r = this.piece.row + dr;
            const c = this.piece.col + dc;
            if (r >= 0 && r < this.gridRows && c >= 0 && c < this.gridCols) {
                this.board[r * this.gridCols + c] = 1;
                this.boardColors[r * this.gridCols + c] = this.piece.color;
            }
        }
    }

    _checkRows() {
        const cols = this.gridCols;
        for (let r = this.gridRows - 1; r >= 0; r--) {
            let full = true;
            for (let c = 0; c < cols; c++) {
                if (!this.board[r * cols + c]) { full = false; break; }
            }
            if (full) {
                this.flashRows.push(r);
                this.score += 100;
                // Remove row and shift down
                this.board.splice(r * cols, cols);
                this.boardColors.splice(r * cols, cols);
                for (let i = 0; i < cols; i++) {
                    this.board.unshift(0);
                    this.boardColors.unshift(null);
                }
                r++; // re-check same row
            }
        }
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
window.VJamFX.presets['arcade-blocks'] = ArcadeBlocksPreset;
})();
