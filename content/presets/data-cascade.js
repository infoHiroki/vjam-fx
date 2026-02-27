(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key 7 - Set B: データカスケード（水平データフロー・滝のような落下・ネオンワイヤーフレーム）
class DataCascadePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.rows = [];
        this.blocks = [];
        this.gridLines = [];
        this.userChars = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;
        preset.rows = [];
        preset.blocks = [];
        preset.gridLines = [];

        this.p5 = new p5((p) => {
            const ROW_COUNT = 20;
            const BLOCK_CHARS = '■□▪▫▬▭▮▯◆◇◈';
            const DATA_CHARS = '0123456789ABCDEF<>{}[]|─═╔╗╚╝';
            const NEON_COLORS = [
                [0, 255, 220],    // cyan
                [255, 0, 160],    // hot pink
                [120, 80, 255],   // purple
                [0, 255, 100],    // neon green
                [255, 200, 0],    // gold
            ];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.textFont('monospace');
                preset._initRows(p, ROW_COUNT, NEON_COLORS, DATA_CHARS);
                preset._initBlocks(p, NEON_COLORS, BLOCK_CHARS);
                preset._initGrid(p);
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.9;

                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;
                const time = p.frameCount * 0.015;

                // --- Layer 1: Background wireframe grid ---
                p.strokeWeight(0.5);
                for (const gl of preset.gridLines) {
                    const pulse = Math.sin(time * gl.freq + gl.phase) * 0.5 + 0.5;
                    const alpha = (20 + pulse * 25 + bass * 30) * gl.brightness;
                    p.stroke(gl.color[0], gl.color[1], gl.color[2], Math.min(alpha, 120));
                    if (gl.horizontal) {
                        p.line(0, gl.pos, p.width, gl.pos);
                    } else {
                        p.line(gl.pos, 0, gl.pos, p.height);
                    }
                }

                // --- Layer 2: Horizontal data rows (main flow) ---
                for (const row of preset.rows) {
                    row.x += row.speed * preset.params.speed * (1 + rms * 2) * row.dir;

                    const fontSize = row.fontSize;
                    p.textSize(fontSize);
                    p.textAlign(p.LEFT, p.CENTER);

                    for (let j = 0; j < row.chars.length; j++) {
                        const cx = row.x + j * fontSize * 0.7 * row.dir;
                        if (cx < -fontSize * 2 || cx > p.width + fontSize * 2) continue;

                        const fade = 1 - j / row.chars.length;
                        const cr = row.color[0];
                        const cg = row.color[1];
                        const cb = row.color[2];

                        if (j === 0) {
                            // Leading character - bright
                            p.fill(255, 255, 255, 200 + preset.beatPulse * 55);
                            p.text(row.chars[j], cx, row.y);
                            // Glow trail
                            p.noStroke();
                            p.fill(cr, cg, cb, 40 + preset.beatPulse * 30);
                            p.ellipse(cx, row.y, fontSize * 3, fontSize * 1.2);
                        } else {
                            const alpha = fade * (130 + mid * 50 + preset.beatPulse * 40);
                            p.fill(cr, cg, cb, Math.min(alpha, 255));
                            p.text(row.chars[j], cx, row.y);
                        }

                        // Char flicker — use ONLY user chars if set
                        if (Math.random() < 0.03 + treble * 0.02) {
                            if (preset.userChars.length > 0) {
                                row.chars[j] = preset.userChars[Math.floor(Math.random() * preset.userChars.length)];
                            } else {
                                row.chars[j] = DATA_CHARS[Math.floor(Math.random() * DATA_CHARS.length)];
                            }
                        }
                    }

                    // Reset when off screen
                    const totalW = row.chars.length * row.fontSize * 0.7;
                    if (row.dir > 0 && row.x > p.width + totalW) {
                        row.x = -totalW;
                        row.speed = 1.5 + Math.random() * 3;
                    } else if (row.dir < 0 && row.x < -totalW) {
                        row.x = p.width + totalW;
                        row.speed = 1.5 + Math.random() * 3;
                    }
                }

                // --- Layer 3: Falling data blocks (cascade/waterfall) ---
                for (const blk of preset.blocks) {
                    blk.y += blk.fallSpeed * (1 + bass * 2);
                    blk.wobble += 0.05;

                    const bx = blk.x + Math.sin(blk.wobble) * 3;
                    const bw = blk.w;
                    const bh = blk.h;

                    // Neon wireframe rect
                    const cr = blk.color[0];
                    const cg = blk.color[1];
                    const cb = blk.color[2];
                    const alpha = 140 + preset.beatPulse * 80;
                    p.noFill();
                    p.strokeWeight(1.5);
                    p.stroke(cr, cg, cb, Math.min(alpha, 255));
                    p.rect(bx, blk.y, bw, bh, 2);

                    // Inner data text
                    p.noStroke();
                    p.fill(cr, cg, cb, Math.min(alpha * 0.8, 255));
                    p.textSize(Math.max(8, bh * 0.5));
                    p.textAlign(p.CENTER, p.CENTER);
                    p.text(blk.label, bx + bw / 2, blk.y + bh / 2);

                    // Glow beneath falling block
                    p.fill(cr, cg, cb, 15 + preset.beatPulse * 20);
                    p.ellipse(bx + bw / 2, blk.y + bh, bw * 1.5, bh * 0.5);

                    // Stack at bottom — slow down as it nears bottom
                    if (blk.y + bh > p.height - blk.stackHeight) {
                        blk.fallSpeed *= 0.92;
                        if (blk.fallSpeed < 0.1) {
                            // Reset block to top
                            blk.y = -blk.h - Math.random() * p.height * 0.3;
                            blk.fallSpeed = 1 + Math.random() * 2.5;
                            blk.x = Math.random() * (p.width - blk.w);
                            blk.stackHeight = 20 + Math.random() * 80;
                            if (preset.userChars.length > 0) {
                                const c1 = preset.userChars[Math.floor(Math.random() * preset.userChars.length)];
                                const c2 = preset.userChars[Math.floor(Math.random() * preset.userChars.length)];
                                blk.label = c1 + c2;
                            } else {
                                blk.label = BLOCK_CHARS[Math.floor(Math.random() * BLOCK_CHARS.length)] +
                                    DATA_CHARS[Math.floor(Math.random() * DATA_CHARS.length)];
                            }
                        }
                    }
                }

                // --- Beat flash: horizontal scan line ---
                if (preset.beatPulse > 0.3) {
                    p.noStroke();
                    const flashY = Math.random() * p.height;
                    p.fill(0, 255, 220, preset.beatPulse * 60);
                    p.rect(0, flashY, p.width, 3);
                    p.fill(255, 0, 160, preset.beatPulse * 40);
                    p.rect(0, flashY + 8, p.width, 2);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                preset._initRows(p, ROW_COUNT, NEON_COLORS, DATA_CHARS);
                preset._initBlocks(p, NEON_COLORS, BLOCK_CHARS);
                preset._initGrid(p);
            };
        }, container);
    }

    _initRows(p, rowCount, colors, dataChars) {
        this.rows = [];
        for (let i = 0; i < rowCount; i++) {
            const dir = Math.random() < 0.5 ? 1 : -1;
            const len = 8 + Math.floor(Math.random() * 20);
            const chars = [];
            const charPool = this.userChars.length > 0 ? this.userChars : [...dataChars];
            for (let j = 0; j < len; j++) {
                chars.push(charPool[Math.floor(Math.random() * charPool.length)]);
            }
            const fontSize = Math.max(10, Math.floor(p.height / 40) + Math.floor(Math.random() * 6));
            this.rows.push({
                x: dir > 0 ? -Math.random() * p.width : p.width + Math.random() * p.width,
                y: (i + 0.5) * (p.height / rowCount) + (Math.random() - 0.5) * 10,
                speed: 1.5 + Math.random() * 3,
                dir,
                chars,
                color: colors[Math.floor(Math.random() * colors.length)],
                fontSize,
            });
        }
    }

    _initBlocks(p, colors, blockChars) {
        this.blocks = [];
        const count = 12;
        const dataChars = '0123456789ABCDEF';
        for (let i = 0; i < count; i++) {
            const w = 30 + Math.random() * 50;
            const h = 15 + Math.random() * 25;
            this.blocks.push({
                x: Math.random() * (p.width - w),
                y: -h - Math.random() * p.height,
                w,
                h,
                fallSpeed: 1 + Math.random() * 2.5,
                color: colors[Math.floor(Math.random() * colors.length)],
                label: blockChars[Math.floor(Math.random() * blockChars.length)] +
                    dataChars[Math.floor(Math.random() * dataChars.length)],
                wobble: Math.random() * Math.PI * 2,
                stackHeight: 20 + Math.random() * 80,
            });
        }
    }

    _initGrid(p) {
        this.gridLines = [];
        const spacing = 60;
        for (let y = 0; y < p.height; y += spacing) {
            this.gridLines.push({
                pos: y, horizontal: true,
                color: [0, 255, 220], brightness: 0.3 + Math.random() * 0.4,
                freq: 0.5 + Math.random(), phase: Math.random() * Math.PI * 2,
            });
        }
        for (let x = 0; x < p.width; x += spacing) {
            this.gridLines.push({
                pos: x, horizontal: false,
                color: [120, 80, 255], brightness: 0.2 + Math.random() * 0.3,
                freq: 0.3 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2,
            });
        }
    }

    setParam(key, value) {
        super.setParam(key, value);
        if (key === 'text' && value) {
            this.userChars = [...value];
            // Replace all row chars and block labels with user text immediately
            for (const row of this.rows) {
                for (let j = 0; j < row.chars.length; j++) {
                    row.chars[j] = this.userChars[Math.floor(Math.random() * this.userChars.length)];
                }
            }
            for (const blk of this.blocks) {
                const c1 = this.userChars[Math.floor(Math.random() * this.userChars.length)];
                const c2 = this.userChars[Math.floor(Math.random() * this.userChars.length)];
                blk.label = c1 + c2;
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
        // Spawn extra falling blocks on beat
        if (strength > 0.4 && this.p5) {
            const p = this.p5;
            const BLOCK_CHARS = '■□▪▫▬▭▮▯◆◇◈';
            const DATA_CHARS = '0123456789ABCDEF';
            const NEON_COLORS = [[0, 255, 220], [255, 0, 160], [120, 80, 255], [0, 255, 100]];
            for (let i = 0; i < 3; i++) {
                const w = 30 + Math.random() * 50;
                const h = 15 + Math.random() * 25;
                this.blocks.push({
                    x: Math.random() * (p.width - w),
                    y: -h,
                    w, h,
                    fallSpeed: 3 + Math.random() * 4,
                    color: NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)],
                    label: this.userChars.length > 0
                        ? this.userChars[Math.floor(Math.random() * this.userChars.length)] +
                          this.userChars[Math.floor(Math.random() * this.userChars.length)]
                        : BLOCK_CHARS[Math.floor(Math.random() * BLOCK_CHARS.length)] +
                          DATA_CHARS[Math.floor(Math.random() * DATA_CHARS.length)],
                    wobble: Math.random() * Math.PI * 2,
                    stackHeight: 20 + Math.random() * 80,
                });
            }
            // Cap block count
            if (this.blocks.length > 25) {
                this.blocks.splice(0, this.blocks.length - 25);
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['data-cascade'] = DataCascadePreset;
})();
