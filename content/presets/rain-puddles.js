(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key 7 - Set D: 雨の波紋が全面に広がる（falling/全面系）
class RainPuddlesPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.ripples = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;
        preset.ripples = [];

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noFill();
            };

            p.draw = () => {
                p.background(0, 0, 0, 25);
                preset.beatPulse *= 0.92;

                const bass = preset.audio.bass;

                // Auto-spawn ripples
                if (p.frameCount % Math.max(3, Math.floor(8 - bass * 5)) === 0) {
                    preset.ripples.push({
                        x: Math.random() * p.width,
                        y: Math.random() * p.height,
                        r: 0,
                        maxR: 30 + Math.random() * 60 + bass * 40,
                        speed: 0.8 + Math.random() * 1.2,
                        hue: 200 + Math.random() * 30,
                    });
                }

                // Beat burst
                if (preset.beatPulse > 0.3) {
                    const count = Math.floor(preset.beatPulse * 6);
                    for (let i = 0; i < count; i++) {
                        preset.ripples.push({
                            x: Math.random() * p.width,
                            y: Math.random() * p.height,
                            r: 0,
                            maxR: 50 + preset.beatPulse * 80,
                            speed: 1.5 + Math.random() * 1,
                            hue: 190 + Math.random() * 40,
                        });
                    }
                }

                for (let i = preset.ripples.length - 1; i >= 0; i--) {
                    const rp = preset.ripples[i];
                    rp.r += rp.speed * preset.params.speed;

                    if (rp.r > rp.maxR) {
                        preset.ripples.splice(i, 1);
                        continue;
                    }

                    const life = 1 - rp.r / rp.maxR;
                    const alpha = life * 50;

                    // Concentric rings
                    p.strokeWeight(1.2);
                    p.stroke(rp.hue, 30, 70, alpha);
                    p.ellipse(rp.x, rp.y, rp.r * 2, rp.r * 2);

                    if (rp.r > 5) {
                        p.stroke(rp.hue, 25, 60, alpha * 0.5);
                        p.ellipse(rp.x, rp.y, rp.r * 1.4, rp.r * 1.4);
                    }

                    // Drop splash at center (brief)
                    if (rp.r < 8) {
                        p.noStroke();
                        p.fill(rp.hue, 15, 90, (1 - rp.r / 8) * 60);
                        p.ellipse(rp.x, rp.y, 4, 4);
                        p.noFill();
                    }
                }

                // Cap
                if (preset.ripples.length > 100) {
                    preset.ripples.splice(0, preset.ripples.length - 100);
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
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['rain-puddles'] = RainPuddlesPreset;
})();
