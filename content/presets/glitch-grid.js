(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class GlitchGridPreset extends BasePreset {
        constructor() {
            super();
            this.params = {
                baseCols: 10,
                baseRows: 8,
            };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.glitchedCells = [];
            this.shakeX = 0;
            this.shakeY = 0;
            this.pendingBeats = [];
            this.cols = 10;
            this.rows = 8;
        }

        setup(container) {
            this.destroy();
            this.pendingBeats = [];
            this.glitchedCells = [];
            this.shakeX = 0;
            this.shakeY = 0;
            const preset = this;

            this.p5 = new p5((p) => {
                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                    p.noSmooth();
                    preset._computeGrid(p);
                };

                p.draw = () => {
                    p.background(0);

                    const cols = preset.cols;
                    const rows = preset.rows;
                    const cellW = p.width / cols;
                    const cellH = p.height / rows;
                    const totalCells = cols * rows;

                    const bassIntensity = preset.audio.bass;
                    const treble = preset.audio.treble;
                    const time = p.frameCount * 0.015;

                    // Process pending beats
                    for (const beat of preset.pendingBeats) {
                        const maxAffected = Math.max(1, Math.floor(totalCells / 2));
                        const affected = Math.max(1, Math.floor(beat.strength * maxAffected));

                        // Build list of glitched cells with per-cell offsets
                        const newGlitched = [];
                        const indices = new Set();
                        for (let n = 0; n < affected; n++) {
                            let idx;
                            do {
                                idx = Math.floor(Math.random() * totalCells);
                            } while (indices.has(idx));
                            indices.add(idx);

                            newGlitched.push({
                                idx,
                                offsetX: (Math.random() - 0.5) * cellW * 0.6,
                                offsetY: (Math.random() - 0.5) * cellH * 0.4,
                                rgbSplit: 3 + Math.random() * 6,
                                life: 1.0,
                            });
                        }
                        preset.glitchedCells = newGlitched;

                        // Strong beat: full-frame offset/shake
                        if (beat.strength > 0.7) {
                            preset.shakeX = (Math.random() - 0.5) * 24 * beat.strength;
                            preset.shakeY = (Math.random() - 0.5) * 16 * beat.strength;
                        }
                    }
                    preset.pendingBeats = [];

                    // Decay shake smoothly
                    preset.shakeX *= 0.82;
                    preset.shakeY *= 0.82;
                    if (Math.abs(preset.shakeX) < 0.3) preset.shakeX = 0;
                    if (Math.abs(preset.shakeY) < 0.3) preset.shakeY = 0;

                    p.push();
                    p.translate(preset.shakeX, preset.shakeY);

                    // Build glitch lookup for fast access
                    const glitchMap = new Map();
                    for (const gc of preset.glitchedCells) {
                        glitchMap.set(gc.idx, gc);
                    }

                    // Draw grid cells
                    for (let row = 0; row < rows; row++) {
                        for (let col = 0; col < cols; col++) {
                            const idx = row * cols + col;
                            const x = col * cellW;
                            const y = row * cellH;

                            // Base pattern: noise-based shifting HSB gradient
                            const nVal = p.noise(col * 0.25, row * 0.25, time);
                            const hue = (nVal * 540 + p.frameCount * 0.4) % 360;
                            const sat = 30 + bassIntensity * 50;
                            const bri = 15 + bassIntensity * 55 * nVal;

                            const gc = glitchMap.get(idx);
                            if (gc && gc.life > 0) {
                                // Glitched cell: RGB channel separation
                                const split = gc.rgbSplit * gc.life;
                                const cellAlpha = 40 + gc.life * 40;

                                p.noStroke();

                                // Red channel (shifted right)
                                p.fill(0, 90, bri + 25, cellAlpha);
                                p.rect(x + split, y, cellW, cellH);

                                // Green channel (shifted up)
                                p.fill(120, 90, bri + 25, cellAlpha);
                                p.rect(x, y - split * 0.7, cellW, cellH);

                                // Blue channel (shifted left)
                                p.fill(240, 90, bri + 25, cellAlpha);
                                p.rect(x - split, y, cellW, cellH);

                                // Main cell with position offset
                                const ox = gc.offsetX * gc.life;
                                const oy = gc.offsetY * gc.life;
                                p.fill(hue, sat + 20, bri + 30, 75);
                                p.rect(x + ox, y + oy, cellW, cellH);
                            } else {
                                // Normal cell
                                p.fill(hue, sat, bri, 85);
                                p.noStroke();
                                p.rect(x, y, cellW, cellH);

                                // Subtle grid line
                                p.stroke(0, 0, 100, 6);
                                p.strokeWeight(0.5);
                                p.noFill();
                                p.rect(x, y, cellW, cellH);
                            }
                        }
                    }

                    // Scanline effect driven by treble
                    if (treble > 0.05) {
                        const lineCount = Math.floor(treble * 60);
                        for (let i = 0; i < lineCount; i++) {
                            const ly = Math.random() * p.height;
                            const alpha = Math.random() * treble * 50;
                            const weight = Math.random() < 0.3 ? 2 : 1;
                            p.stroke(0, 0, 100, alpha);
                            p.strokeWeight(weight);
                            p.line(0, ly, p.width, ly);
                        }

                        // Periodic thick scanline band
                        if (treble > 0.4) {
                            const bandY = (p.frameCount * 3.7) % (p.height + 40) - 20;
                            const bandAlpha = treble * 25;
                            p.noStroke();
                            p.fill(0, 0, 100, bandAlpha);
                            p.rect(0, bandY, p.width, 2 + Math.random() * 3);
                        }
                    }

                    p.pop();

                    // Decay glitched cells over time (write-index pattern)
                    let w = 0;
                    for (let i = 0; i < preset.glitchedCells.length; i++) {
                        preset.glitchedCells[i].life -= 0.03;
                        if (preset.glitchedCells[i].life > 0) {
                            preset.glitchedCells[w++] = preset.glitchedCells[i];
                        }
                    }
                    preset.glitchedCells.length = w;
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                    preset._computeGrid(p);
                };
            }, container);
        }

        _computeGrid(p) {
            // Adapt grid to aspect ratio, targeting ~10x8 for 16:9
            const aspect = p.width / p.height;
            this.rows = this.params.baseRows;
            this.cols = Math.round(this.rows * aspect);
            if (this.cols < 4) this.cols = 4;
        }

        updateAudio(audioData) {
            this.audio.bass = audioData.bass || 0;
            this.audio.mid = audioData.mid || 0;
            this.audio.treble = audioData.treble || 0;
            this.audio.rms = audioData.rms || 0;
            this.audio.strength = audioData.strength || 0;
        }

        onBeat(strength) {
            this.pendingBeats.push({ strength });
        }
    }

    window.VJamFX.presets['glitch-grid'] = GlitchGridPreset;
})();
