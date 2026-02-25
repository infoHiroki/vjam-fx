(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class PrismPreset extends BasePreset {
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
                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                };

                p.draw = () => {
                    p.background(0, 0, 3);
                    preset.beatPulse *= 0.92;

                    const t = p.frameCount * 0.005 * preset.params.speed;
                    const bass = preset.audio.bass;
                    const mid = preset.audio.mid;
                    const treble = preset.audio.treble;
                    const pulse = preset.beatPulse;
                    const cx = p.width * 0.4;
                    const cy = p.height * 0.5;

                    // Draw prism (triangle)
                    const prismSize = Math.min(p.width, p.height) * 0.2;
                    const px1 = cx;
                    const py1 = cy - prismSize * 0.8;
                    const px2 = cx - prismSize * 0.7;
                    const py2 = cy + prismSize * 0.5;
                    const px3 = cx + prismSize * 0.7;
                    const py3 = cy + prismSize * 0.5;

                    // Incoming white light beam
                    const beamWidth = 3 + bass * 5;
                    p.stroke(0, 0, 80 + bass * 20, 70);
                    p.strokeWeight(beamWidth);
                    p.line(0, cy, cx - prismSize * 0.3, cy);

                    // Glow around beam
                    p.stroke(0, 0, 50, 15);
                    p.strokeWeight(beamWidth * 4);
                    p.line(0, cy, cx - prismSize * 0.2, cy);

                    // Draw prism body
                    p.noStroke();
                    p.fill(0, 0, 15, 80);
                    p.triangle(px1, py1, px2, py2, px3, py3);
                    p.noFill();
                    p.stroke(0, 0, 40, 60);
                    p.strokeWeight(1.5);
                    p.triangle(px1, py1, px2, py2, px3, py3);

                    // Rainbow dispersion from prism
                    const rainbowColors = 12;
                    const spreadAngle = 0.4 + bass * 0.3 + pulse * 0.2;
                    const exitX = cx + prismSize * 0.4;
                    const exitY = cy;

                    for (let i = 0; i < rainbowColors; i++) {
                        const ratio = i / (rainbowColors - 1);
                        const angle = -spreadAngle / 2 + ratio * spreadAngle;

                        const hue = ratio * 300; // Red to violet
                        const endX = exitX + Math.cos(angle) * p.width;
                        const endY = exitY + Math.sin(angle) * p.width * 0.5;

                        // Main ray
                        const alpha = 30 + mid * 30 + pulse * 20;
                        const weight = 2 + bass * 3;
                        p.stroke(hue, 80, 80 + treble * 20, alpha);
                        p.strokeWeight(weight);
                        p.line(exitX, exitY, endX, endY);

                        // Glow
                        p.stroke(hue, 60, 60, alpha * 0.3);
                        p.strokeWeight(weight * 5);
                        p.line(exitX, exitY, endX, endY);

                        // Spectral particles on beat
                        if (pulse > 0.3 && Math.random() < 0.4) {
                            const pd = 50 + Math.random() * 300;
                            const ppx = exitX + Math.cos(angle) * pd;
                            const ppy = exitY + Math.sin(angle) * pd * 0.5;
                            p.noStroke();
                            p.fill(hue, 70, 90, 50);
                            p.ellipse(ppx, ppy, 4 + Math.random() * 6, 4 + Math.random() * 6);
                        }
                    }

                    // Refraction highlight on prism
                    p.noStroke();
                    p.fill(0, 0, 100, 10 + pulse * 20);
                    p.ellipse(cx, cy, prismSize * 0.3, prismSize * 0.3);
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

    window.VJamFX.presets['prism'] = PrismPreset;
})();
