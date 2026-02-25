(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class SacredGeometryPreset extends BasePreset {
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
                    const t = p.frameCount * 0.005 * preset.params.speed;
                    const bass = preset.audio.bass;
                    const mid = preset.audio.mid;
                    const pulse = preset.beatPulse;
                    preset.beatPulse *= 0.92;

                    p.background(0, 0, 0, 40);

                    const cx = p.width / 2;
                    const cy = p.height / 2;
                    const baseRadius = Math.min(p.width, p.height) * 0.12;

                    p.push();
                    p.translate(cx, cy);
                    p.rotate(t);

                    // Glow on beat
                    const glowAlpha = 15 + pulse * 40;
                    const strokeW = 1 + pulse * 1.5;

                    // Flower of Life: central circle + 6 surrounding
                    const layers = 3 + Math.floor(mid * 2);
                    for (let layer = 0; layer < layers; layer++) {
                        const r = baseRadius * (1 + layer * 0.5) * (1 + bass * 0.3);
                        const numCircles = layer === 0 ? 1 : layer * 6;

                        for (let i = 0; i < numCircles; i++) {
                            const angle = (p.TWO_PI / numCircles) * i + layer * 0.1;
                            const dist = layer === 0 ? 0 : baseRadius * layer * 0.5;
                            const x = Math.cos(angle) * dist;
                            const y = Math.sin(angle) * dist;

                            // Gold/white color
                            const hue = (45 + layer * 10) % 360;
                            const sat = 30 - layer * 5;
                            const bri = 80 + pulse * 20;

                            p.noFill();
                            p.stroke(hue, Math.max(0, sat), Math.min(100, bri), glowAlpha);
                            p.strokeWeight(strokeW);
                            p.ellipse(x, y, r, r);
                        }
                    }

                    // Outer boundary circles
                    for (let i = 0; i < 6; i++) {
                        const angle = (p.TWO_PI / 6) * i + t * 0.5;
                        const outerR = baseRadius * (layers + 1) * 0.5;
                        const x = Math.cos(angle) * outerR;
                        const y = Math.sin(angle) * outerR;

                        p.stroke(50, 20, 90, glowAlpha * 0.6);
                        p.strokeWeight(strokeW * 0.7);
                        p.ellipse(x, y, baseRadius * 2, baseRadius * 2);
                    }

                    // Connecting lines through centers (hexagonal grid)
                    p.stroke(45, 15, 70, glowAlpha * 0.4);
                    p.strokeWeight(0.5);
                    for (let i = 0; i < 6; i++) {
                        const angle = (p.TWO_PI / 6) * i;
                        const far = baseRadius * layers * 0.8;
                        p.line(0, 0, Math.cos(angle) * far, Math.sin(angle) * far);
                    }

                    p.pop();
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

    window.VJamFX.presets['sacred-geometry'] = SacredGeometryPreset;
})();
