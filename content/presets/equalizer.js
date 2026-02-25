(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class EqualizerPreset extends BasePreset {
        constructor() {
            super();
            this.params = { barCount: 64 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.bars = [];
            this.peaks = [];
            this.beatFlash = 0;
        }

        setup(container) {
            this.destroy();
            const preset = this;

            this.p5 = new p5((p) => {
                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                    preset.bars = new Array(preset.params.barCount).fill(0);
                    preset.peaks = new Array(preset.params.barCount).fill(0);
                };

                p.draw = () => {
                    p.background(0, 0, 5, 100);
                    preset.beatFlash *= 0.9;

                    const barCount = preset.params.barCount;
                    const barW = p.width / barCount;
                    const maxH = p.height * 0.85;
                    const baseY = p.height;

                    // Simulate frequency bars from audio bands
                    for (let i = 0; i < barCount; i++) {
                        const ratio = i / barCount;
                        let target;
                        if (ratio < 0.33) {
                            target = preset.audio.bass * (0.6 + Math.random() * 0.4);
                        } else if (ratio < 0.66) {
                            target = preset.audio.mid * (0.6 + Math.random() * 0.4);
                        } else {
                            target = preset.audio.treble * (0.6 + Math.random() * 0.4);
                        }
                        target += preset.beatFlash * 0.3;

                        // Smooth rise, fast fall
                        if (target > preset.bars[i]) {
                            preset.bars[i] = p.lerp(preset.bars[i], target, 0.4);
                        } else {
                            preset.bars[i] *= 0.92;
                        }

                        // Peaks
                        if (preset.bars[i] > preset.peaks[i]) {
                            preset.peaks[i] = preset.bars[i];
                        } else {
                            preset.peaks[i] -= 0.005;
                        }

                        const h = preset.bars[i] * maxH;
                        const hue = p.map(i, 0, barCount, 180, 360) % 360;

                        // Bar glow
                        p.noStroke();
                        p.fill(hue, 60, 80, 20);
                        p.rect(i * barW, baseY - h - 10, barW - 1, h + 10);

                        // Main bar (gradient effect with segments)
                        const segments = Math.max(1, Math.floor(h / 4));
                        const segH = h / segments;
                        for (let s = 0; s < segments; s++) {
                            const segY = baseY - (s + 1) * segH;
                            const segRatio = s / segments;
                            const bri = 50 + segRatio * 50;
                            const sat = 70 - segRatio * 20;
                            p.fill(hue, sat, bri, 85);
                            p.rect(i * barW + 1, segY, barW - 2, segH - 1);
                        }

                        // Peak indicator
                        const peakY = baseY - preset.peaks[i] * maxH;
                        p.fill(hue, 30, 100, 90);
                        p.rect(i * barW, peakY - 2, barW - 1, 2);
                    }

                    // Reflection (subtle)
                    p.push();
                    p.scale(1, -0.3);
                    p.translate(0, -p.height * 3.33);
                    for (let i = 0; i < barCount; i++) {
                        const h = preset.bars[i] * maxH * 0.3;
                        const hue = p.map(i, 0, barCount, 180, 360) % 360;
                        p.noStroke();
                        p.fill(hue, 60, 40, 15);
                        p.rect(i * barW + 1, baseY - h, barW - 2, h);
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
            this.beatFlash = strength;
        }
    }

    window.VJamFX.presets['equalizer'] = EqualizerPreset;
})();
