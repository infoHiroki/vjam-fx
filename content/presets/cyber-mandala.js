(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CyberMandalaPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.ringPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
            };

            p.draw = () => {
                p.background(5, 5, 15);
                preset.beatPulse *= 0.92;
                preset.ringPulse *= 0.96;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxR = Math.min(p.width, p.height) * 0.45;
                const t = p.frameCount * 0.01;

                const colors = [
                    [0, 255, 255],   // cyan
                    [255, 0, 255],   // magenta
                    [255, 255, 0],   // yellow
                    [0, 255, 100],   // green
                ];

                const ringCount = 8;

                for (let ring = 0; ring < ringCount; ring++) {
                    const baseR = (ring + 1) / ringCount * maxR;
                    const r = baseR + preset.ringPulse * 20 * (ring / ringCount);
                    const color = colors[ring % colors.length];
                    const segments = 6 + ring * 2;
                    const rotSpeed = (ring % 2 === 0 ? 1 : -1) * (0.5 + ring * 0.3);
                    const rot = t * rotSpeed;
                    const alpha = 120 + preset.beatPulse * 80;

                    p.push();
                    p.translate(cx, cy);
                    p.rotate(rot);

                    // Draw shapes at each segment angle
                    for (let s = 0; s < segments; s++) {
                        const angle = (p.TWO_PI / segments) * s;
                        const sx = Math.cos(angle) * r;
                        const sy = Math.sin(angle) * r;

                        p.push();
                        p.translate(sx, sy);
                        p.rotate(angle + t * 2);

                        const shapeType = (ring + s) % 4;
                        const size = 6 + ring * 2 + preset.beatPulse * 5;

                        // Glow
                        p.noFill();
                        p.stroke(color[0], color[1], color[2], alpha * 0.3);
                        p.strokeWeight(3);
                        preset._drawShape(p, shapeType, size * 1.2);

                        // Core
                        p.stroke(color[0], color[1], color[2], alpha);
                        p.strokeWeight(1.5);
                        preset._drawShape(p, shapeType, size);

                        p.pop();
                    }

                    // Connecting ring line
                    p.noFill();
                    p.stroke(color[0], color[1], color[2], 40 + preset.beatPulse * 30);
                    p.strokeWeight(0.5);
                    p.ellipse(0, 0, r * 2, r * 2);

                    p.pop();
                }

                // Center dot
                p.noStroke();
                p.fill(255, 255, 255, 200 + preset.beatPulse * 55);
                p.ellipse(cx, cy, 6 + preset.beatPulse * 8, 6 + preset.beatPulse * 8);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _drawShape(p, type, size) {
        switch (type) {
            case 0: // Triangle
                p.triangle(0, -size, -size * 0.866, size * 0.5, size * 0.866, size * 0.5);
                break;
            case 1: // Circle
                p.ellipse(0, 0, size * 2, size * 2);
                break;
            case 2: // Diamond
                p.quad(0, -size, size, 0, 0, size, -size, 0);
                break;
            case 3: // Line cross
                p.line(-size, 0, size, 0);
                p.line(0, -size, 0, size);
                break;
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
        this.ringPulse = strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['cyber-mandala'] = CyberMandalaPreset;
})();
