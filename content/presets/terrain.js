(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class TerrainPreset extends BasePreset {
        constructor() {
            super();
            this.params = { cols: 60, rows: 40 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.offset = 0;
        }

        setup(container) {
            this.destroy();
            this.offset = 0;
            const preset = this;

            this.p5 = new p5((p) => {
                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                };

                p.draw = () => {
                    p.background(0, 0, 5, 100);
                    preset.beatPulse *= 0.92;
                    preset.offset += 0.03 * (1 + preset.audio.bass * 2);

                    const cols = preset.params.cols;
                    const rows = preset.params.rows;
                    const cellW = p.width / cols;
                    const cellH = p.height / rows * 0.6;
                    const heightScale = 80 + preset.audio.bass * 120 + preset.beatPulse * 60;
                    const hueBase = (p.frameCount * 0.3) % 360;

                    // Perspective projection parameters
                    const vanishY = p.height * 0.3;
                    const horizonY = p.height * 0.25;

                    for (let y = rows - 1; y >= 0; y--) {
                        const depthRatio = y / rows;
                        const perspective = 0.3 + depthRatio * 0.7;
                        const screenY = horizonY + depthRatio * (p.height - horizonY);

                        for (let x = 0; x <= cols; x++) {
                            const nx = x * 0.15;
                            const ny = y * 0.15 + preset.offset;
                            const elevation = p.noise(nx, ny) * heightScale;

                            const screenX = p.width / 2 + (x - cols / 2) * cellW * perspective;
                            const elevatedY = screenY - elevation * perspective;

                            const hue = (hueBase + elevation * 0.8 + preset.audio.treble * 60) % 360;
                            const bri = 45 + (elevation / heightScale) * 40 + preset.audio.rms * 15;
                            const alpha = 30 + depthRatio * 40;

                            // Draw wireframe dots and connecting lines
                            p.stroke(hue, 60, Math.min(100, bri), alpha);
                            p.strokeWeight(1);

                            // Horizontal line to next point
                            if (x < cols) {
                                const nx2 = (x + 1) * 0.15;
                                const elev2 = p.noise(nx2, ny) * heightScale;
                                const sx2 = p.width / 2 + (x + 1 - cols / 2) * cellW * perspective;
                                const sy2 = screenY - elev2 * perspective;
                                p.line(screenX, elevatedY, sx2, sy2);
                            }

                            // Vertical line to next row
                            if (y < rows - 1) {
                                const ny2 = (y + 1) * 0.15 + preset.offset;
                                const elev2 = p.noise(nx, ny2) * heightScale;
                                const depthRatio2 = (y + 1) / rows;
                                const persp2 = 0.3 + depthRatio2 * 0.7;
                                const sy2 = horizonY + depthRatio2 * (p.height - horizonY) - elev2 * persp2;
                                const sx2 = p.width / 2 + (x - cols / 2) * cellW * persp2;
                                p.line(screenX, elevatedY, sx2, sy2);
                            }

                            // Dot at vertex
                            p.noStroke();
                            p.fill(hue, 40, 100, alpha + 10);
                            p.circle(screenX, elevatedY, 2 * perspective);
                        }
                    }
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
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

    window.VJamFX.presets['terrain'] = TerrainPreset;
})();
