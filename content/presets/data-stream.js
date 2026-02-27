(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DataStreamPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.columns = [];
        this.burstColumns = [];
        this.userChars = [];
    }

    setup(container) {
        this.destroy();
        this.columns = [];
        this.burstColumns = [];
        const preset = this;

        this.p5 = new p5((p) => {
            const CHARS = '01ABCDEF0123456789αβγδ∑∏∫≈≠±';
            const HEX_BLOCKS = ['0xFF', '0xA3', '0x7B', '0xDE', '0x00', '0x1F', '0xC8', '0x9E'];
            const NUM_COLS = 28;
            const DEPTH_LAYERS = 3;

            const PALETTES = [
                [[0, 255, 180], [0, 200, 255]],     // cyan-green (front)
                [[180, 80, 255], [255, 60, 200]],    // purple-magenta (mid)
                [[255, 160, 40], [255, 80, 80]],     // orange-red (back)
            ];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.textFont('monospace');
                p.textAlign(p.CENTER, p.CENTER);
                preset._initColumns(p, NUM_COLS, DEPTH_LAYERS, PALETTES, CHARS);
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.88;

                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;
                const time = p.frameCount * 0.01;

                // Draw columns back-to-front for depth
                const sorted = [...preset.columns].sort((a, b) => a.depth - b.depth);

                for (const col of sorted) {
                    const depthFade = 0.4 + (col.depth / DEPTH_LAYERS) * 0.6;
                    const speedBoost = col.depth === DEPTH_LAYERS - 1 ? bass * 1.5 : rms * 0.8;
                    col.y += col.speed * preset.params.speed * (1 + speedBoost);

                    const fontSize = col.fontSize;
                    p.textSize(fontSize);

                    const trailLen = col.chars.length;
                    for (let j = 0; j < trailLen; j++) {
                        const charY = col.y - j * fontSize * 1.15;
                        if (charY < -fontSize || charY > p.height + fontSize) continue;

                        const fade = 1 - j / trailLen;
                        const cr = col.color[0];
                        const cg = col.color[1];
                        const cb = col.color[2];

                        if (j === 0) {
                            // Head: bright white with color glow
                            const headAlpha = (200 + preset.beatPulse * 55) * depthFade;
                            p.fill(255, 255, 255, Math.min(headAlpha, 255));
                            p.text(col.chars[j], col.x, charY);
                            // Glow
                            p.noStroke();
                            p.fill(cr, cg, cb, (60 + preset.beatPulse * 40) * depthFade);
                            p.ellipse(col.x, charY, fontSize * 2.5, fontSize * 1.5);
                        } else if (col.isPacket && j < 4) {
                            // Highlighted "packet" — brighter, different char set
                            const pAlpha = Math.min(fade * (220 + preset.beatPulse * 35) * depthFade, 255);
                            p.fill(255, 220, 60, pAlpha);
                            p.text(col.chars[j], col.x, charY);
                        } else {
                            const alpha = fade * (120 + mid * 40 + preset.beatPulse * 50) * depthFade;
                            p.fill(cr, cg, cb, Math.min(alpha, 255));
                            p.text(col.chars[j], col.x, charY);
                        }

                        // Flicker characters — use ONLY user chars if set
                        if (Math.random() < 0.03 + treble * 0.02) {
                            if (preset.userChars.length > 0) {
                                col.chars[j] = preset.userChars[Math.floor(Math.random() * preset.userChars.length)];
                            } else {
                                col.chars[j] = CHARS[Math.floor(Math.random() * CHARS.length)];
                            }
                        }
                    }

                    // Reset
                    if (col.y - trailLen * fontSize * 1.15 > p.height) {
                        col.y = -Math.random() * p.height * 0.6;
                        col.speed = col.baseSpeed + Math.random() * 2;
                        col.isPacket = Math.random() < 0.15;
                        if (col.isPacket) {
                            for (let j = 0; j < Math.min(4, col.chars.length); j++) {
                                col.chars[j] = HEX_BLOCKS[Math.floor(Math.random() * HEX_BLOCKS.length)];
                            }
                        }
                    }
                }

                // Beat burst: spawn temporary fast columns
                for (let i = preset.burstColumns.length - 1; i >= 0; i--) {
                    const bc = preset.burstColumns[i];
                    bc.y += bc.speed * 2;
                    bc.life -= 0.02;
                    if (bc.life <= 0 || bc.y > p.height + 100) {
                        preset.burstColumns.splice(i, 1);
                        continue;
                    }
                    p.textSize(bc.fontSize);
                    for (let j = 0; j < bc.chars.length; j++) {
                        const cy = bc.y - j * bc.fontSize * 1.1;
                        if (cy < -bc.fontSize || cy > p.height + bc.fontSize) continue;
                        const fade = (1 - j / bc.chars.length) * bc.life;
                        p.fill(255, 255, 255, Math.min(fade * 255, 255));
                        p.text(bc.chars[j], bc.x, cy);
                    }
                }

                // Scanline overlay (subtle)
                if (p.frameCount % 2 === 0) {
                    p.stroke(0, 255, 200, 8 + preset.beatPulse * 15);
                    p.strokeWeight(1);
                    const scanY = (time * 80) % p.height;
                    p.line(0, scanY, p.width, scanY);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                preset._initColumns(p, NUM_COLS, DEPTH_LAYERS, PALETTES, CHARS);
            };
        }, container);
    }

    _initColumns(p, numCols, depthLayers, palettes, chars) {
        this.columns = [];
        for (let i = 0; i < numCols; i++) {
            const depth = Math.floor(Math.random() * depthLayers);
            const palette = palettes[depth];
            const color = palette[Math.floor(Math.random() * palette.length)];
            const baseFontSize = Math.max(10, Math.floor(p.height / 35));
            const fontSize = baseFontSize * (0.6 + depth * 0.25);
            const trailLen = 6 + Math.floor(Math.random() * 18);
            const charArr = [];
            const charPool = this.userChars.length > 0 ? this.userChars : [...chars];
            for (let j = 0; j < trailLen; j++) {
                charArr.push(charPool[Math.floor(Math.random() * charPool.length)]);
            }
            const baseSpeed = 1.0 + depth * 1.0 + Math.random() * 1.5;
            this.columns.push({
                x: (i + 0.5) * (p.width / numCols) + (Math.random() - 0.5) * 15,
                y: -Math.random() * p.height,
                speed: baseSpeed,
                baseSpeed,
                chars: charArr,
                color,
                depth,
                fontSize,
                isPacket: Math.random() < 0.15,
            });
        }
    }

    setParam(key, value) {
        super.setParam(key, value);
        if (key === 'text' && value) {
            this.userChars = [...value];
            // Replace all column chars with user text immediately
            for (const col of this.columns) {
                for (let j = 0; j < col.chars.length; j++) {
                    col.chars[j] = this.userChars[Math.floor(Math.random() * this.userChars.length)];
                }
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
        this.beatPulse = strength;
        // Data burst: spawn 3-5 fast white columns
        if (this.p5 && strength > 0.3) {
            const p = this.p5;
            const count = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const chars = [];
                const len = 4 + Math.floor(Math.random() * 8);
                const CHARS = '01ABCDEF';
                for (let j = 0; j < len; j++) {
                    chars.push(CHARS[Math.floor(Math.random() * CHARS.length)]);
                }
                this.burstColumns.push({
                    x: Math.random() * p.width,
                    y: -Math.random() * 50,
                    speed: 6 + Math.random() * 8,
                    chars,
                    fontSize: Math.max(12, Math.floor(p.height / 30)),
                    life: 1,
                });
            }
        }
        // Refresh random column chars
        for (let k = 0; k < 3 && k < this.columns.length; k++) {
            const col = this.columns[Math.floor(Math.random() * this.columns.length)];
            col.isPacket = Math.random() < 0.4;
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['data-stream'] = DataStreamPreset;
})();
