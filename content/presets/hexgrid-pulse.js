(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class HexgridPulsePreset extends BasePreset {
        constructor() {
            super();
            this.params = { speed: 1 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.pulseWaves = [];
        }

        setup(container) {
            this.destroy();
            const preset = this;

            this.p5 = new p5((p) => {
                const HEX_SIZE = 22;

                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                };

                function drawHex(x, y, size) {
                    p.beginShape();
                    for (let i = 0; i < 6; i++) {
                        const angle = p.TWO_PI / 6 * i - p.PI / 6;
                        p.vertex(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
                    }
                    p.endShape(p.CLOSE);
                }

                p.draw = () => {
                    p.background(0, 0, 3);
                    preset.beatPulse *= 0.92;

                    const bass = preset.audio.bass;
                    const mid = preset.audio.mid;
                    const treble = preset.audio.treble;
                    const cx = p.width / 2;
                    const cy = p.height / 2;

                    // Update pulse waves (write-index pattern)
                    let w = 0;
                    for (let i = 0; i < preset.pulseWaves.length; i++) {
                        preset.pulseWaves[i].radius += 5 + bass * 3;
                        preset.pulseWaves[i].life -= 0.01;
                        if (preset.pulseWaves[i].life > 0) {
                            preset.pulseWaves[w++] = preset.pulseWaves[i];
                        }
                    }
                    preset.pulseWaves.length = w;

                    // Hex grid
                    const hw = HEX_SIZE * 1.73; // horizontal spacing
                    const h = HEX_SIZE * 1.5;  // vertical spacing
                    const cols = Math.ceil(p.width / hw) + 2;
                    const rows = Math.ceil(p.height / h) + 2;

                    p.strokeWeight(1);

                    for (let row = -1; row < rows; row++) {
                        for (let col = -1; col < cols; col++) {
                            const offsetX = (row % 2) * hw * 0.5;
                            const hx = col * hw + offsetX;
                            const hy = row * h;

                            const dx = hx - cx;
                            const dy = hy - cy;
                            const dist = Math.sqrt(dx * dx + dy * dy);

                            // Pulse wave effect
                            let pulseIntensity = 0;
                            for (const wave of preset.pulseWaves) {
                                const ringDist = Math.abs(dist - wave.radius);
                                if (ringDist < 30) {
                                    pulseIntensity += wave.life * (1 - ringDist / 30);
                                }
                            }

                            // Tron-style colors
                            const hue = (190 + mid * 40 + pulseIntensity * 60) % 360;
                            const baseBri = 10 + bass * 15;
                            const pulseBri = pulseIntensity * 60;
                            const bri = Math.min(100, baseBri + pulseBri);
                            const sat = 70 + treble * 20;

                            if (bri < 5) {
                                // Just draw outline
                                p.noFill();
                                p.stroke(hue, sat, 15, 30);
                                drawHex(hx, hy, HEX_SIZE * 0.9);
                            } else {
                                p.fill(hue, sat, bri, 40 + pulseIntensity * 40);
                                p.stroke(hue, sat, Math.min(100, bri + 20), 60 + pulseIntensity * 30);
                                drawHex(hx, hy, HEX_SIZE * 0.9);

                                // Inner glow for pulsed hexes
                                if (pulseIntensity > 0.3) {
                                    p.noStroke();
                                    p.fill(hue, sat - 20, Math.min(100, bri + 30), pulseIntensity * 25);
                                    drawHex(hx, hy, HEX_SIZE * 0.5);
                                }
                            }
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
            this.pulseWaves.push({ radius: 0, life: 1 });
            if (this.pulseWaves.length > 5) {
                this.pulseWaves.shift();
            }
        }
    }

    window.VJamFX.presets['hexgrid-pulse'] = HexgridPulsePreset;
})();
