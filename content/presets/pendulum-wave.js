(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PendulumWavePreset extends BasePreset {
    constructor() {
        super();
        this.params = { count: 18 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.energy = 0;
        this.trailBuffer = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                preset.trailBuffer = [];
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.92;

                // Energy accumulates from beats, decays slowly
                preset.energy = preset.energy * 0.997 + preset.beatPulse * 0.3;
                const baseAmplitude = 0.6 + preset.energy * 0.4;

                const w = p.width;
                const h = p.height;
                const count = preset.params.count;
                const time = p.frameCount * 0.02;
                const pivotY = h * 0.05;
                const stringLength = h * 0.65;
                const bassBoost = preset.audio.bass;
                const beat = preset.beatPulse;

                // Current frame bob positions
                const currentPositions = [];

                for (let i = 0; i < count; i++) {
                    const x = w * (0.1 + 0.8 * i / (count - 1));
                    // Each pendulum has slightly different period
                    // Period ratio: (count + i) / count -> creates wave pattern
                    const period = 1.0 + i * 0.06;
                    const angle = Math.sin(time * period) * baseAmplitude * (0.8 + bassBoost * 0.3);

                    const bobX = x + Math.sin(angle) * stringLength;
                    const bobY = pivotY + Math.cos(angle) * stringLength;
                    const hue = (i / count) * 300 + p.frameCount * 0.3;

                    currentPositions.push({ x: bobX, y: bobY, hue: hue % 360, pivotX: x });
                }

                // Store trail (keep last 5 frames)
                preset.trailBuffer.push(currentPositions.map(pos => ({ ...pos })));
                if (preset.trailBuffer.length > 5) {
                    preset.trailBuffer.shift();
                }

                // Draw trails (ghost positions, oldest first)
                for (let t = 0; t < preset.trailBuffer.length - 1; t++) {
                    const trailFrame = preset.trailBuffer[t];
                    const trailAge = (preset.trailBuffer.length - 1 - t) / preset.trailBuffer.length;
                    const trailAlpha = (1 - trailAge) * 25;

                    for (let i = 0; i < trailFrame.length; i++) {
                        const pos = trailFrame[i];
                        const bobSize = 10 + bassBoost * 4;

                        // Ghost bob
                        p.noStroke();
                        p.fill(pos.hue, 60, 70, trailAlpha);
                        p.ellipse(pos.x, pos.y, bobSize, bobSize);
                    }
                }

                // Draw current pendulums
                for (let i = 0; i < count; i++) {
                    const pos = currentPositions[i];
                    const hue = pos.hue;
                    const bobSize = 14 + bassBoost * 6 + beat * 8;

                    // Pivot point
                    p.fill(0, 0, 40, 80);
                    p.noStroke();
                    p.ellipse(pos.pivotX, pivotY, 4, 4);

                    // String
                    p.stroke(0, 0, 50, 50 + beat * 20);
                    p.strokeWeight(1.5);
                    p.line(pos.pivotX, pivotY, pos.x, pos.y);

                    // Glow behind bob
                    p.noStroke();
                    const glowSize = bobSize * 3 + bassBoost * 15 + beat * 20;
                    p.fill(hue, 70, 80, 15 + bassBoost * 10);
                    p.ellipse(pos.x, pos.y, glowSize, glowSize);
                    p.fill(hue, 50, 90, 10 + beat * 8);
                    p.ellipse(pos.x, pos.y, glowSize * 1.6, glowSize * 1.6);

                    // Bob (bright neon circle)
                    p.fill(hue, 75, 95, 90 + beat * 10);
                    p.ellipse(pos.x, pos.y, bobSize, bobSize);

                    // Bright core
                    p.fill(hue, 30, 100, 80);
                    p.ellipse(pos.x, pos.y, bobSize * 0.4, bobSize * 0.4);
                }

                // Top bar connecting pivot points
                p.stroke(0, 0, 30, 60);
                p.strokeWeight(2);
                const firstX = w * 0.1;
                const lastX = w * 0.9;
                p.line(firstX - 10, pivotY, lastX + 10, pivotY);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                preset.trailBuffer = [];
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

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['pendulum-wave'] = PendulumWavePreset;
})();
