(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DnaAuroraPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
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
                p.background(0);
                const t = p.frameCount * 0.012 * preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                const w = p.width;
                const h = p.height;
                const cx = w / 2;

                // DNA double helix parameters
                const helixRadius = w * (0.12 + bass * 0.06 + pulse * 0.04);
                const segments = 120;
                const verticalSpan = h * 1.2;
                const twists = 3 + mid * 1.5; // number of full rotations visible
                const yOffset = h * 0.5 - verticalSpan * 0.5;

                // Two strands with phase offset
                const strands = [
                    { phaseOff: 0, hue1: 140, hue2: 180 },      // green-cyan strand
                    { phaseOff: Math.PI, hue1: 280, hue2: 320 }, // purple-pink strand
                ];

                // Draw rungs (connections between strands) first
                p.strokeWeight(1.5 + bass * 1);
                const rungInterval = 4;
                for (let i = 0; i < segments; i += rungInterval) {
                    const frac = i / segments;
                    const y = yOffset + frac * verticalSpan;
                    const angle = frac * twists * p.TWO_PI + t * 2;

                    const x1 = cx + Math.cos(angle) * helixRadius;
                    const x2 = cx + Math.cos(angle + Math.PI) * helixRadius;

                    // Only draw rung when both strands are "in front" (visible)
                    const z1 = Math.sin(angle);
                    const z2 = Math.sin(angle + Math.PI);

                    const rungAlpha = 15 + Math.abs(z1 - z2) * 12 + pulse * 8;
                    const rungHue = (210 + frac * 60 + treble * 30) % 360;

                    p.stroke(rungHue, 40, 60, rungAlpha);
                    p.line(x1, y, x2, y);

                    // Base pair dots at connection points
                    p.noStroke();
                    const dotSize = 3 + bass * 2;
                    p.fill(rungHue, 50, 70, rungAlpha + 10);
                    p.ellipse(x1, y, dotSize, dotSize);
                    p.ellipse(x2, y, dotSize, dotSize);
                    p.strokeWeight(1.5 + bass * 1);
                }

                // Draw each strand
                for (const strand of strands) {
                    // Multiple glow layers for aurora effect
                    const layers = [
                        { weight: 12 + bass * 6, alphaBase: 6 },
                        { weight: 6 + bass * 3, alphaBase: 12 },
                        { weight: 2.5 + bass * 1, alphaBase: 35 },
                        { weight: 1, alphaBase: 55 },
                    ];

                    for (const layer of layers) {
                        p.noFill();
                        p.strokeWeight(layer.weight + pulse * 2);

                        p.beginShape();
                        for (let i = 0; i <= segments; i++) {
                            const frac = i / segments;
                            const y = yOffset + frac * verticalSpan;
                            const angle = frac * twists * p.TWO_PI + t * 2 + strand.phaseOff;

                            // 3D depth: z determines brightness/alpha
                            const z = Math.sin(angle);
                            const x = cx + Math.cos(angle) * helixRadius;

                            // Depth-based appearance
                            const depthFade = 0.4 + (z + 1) * 0.3; // 0.4 (back) to 1.0 (front)
                            const hue = (strand.hue1 + frac * (strand.hue2 - strand.hue1) +
                                treble * 20 + Math.sin(t + frac * 4) * 15) % 360;
                            const sat = 55 + mid * 25;
                            const bri = (40 + z * 25 + pulse * 15) * depthFade;
                            const alpha = layer.alphaBase * depthFade + pulse * 5;

                            p.stroke(hue, Math.min(100, sat), Math.min(100, bri), Math.min(80, alpha));
                            p.curveVertex(x, y);
                        }
                        p.endShape();
                    }
                }

                // Floating particles along the helix
                p.noStroke();
                const particleCount = 30 + Math.floor(treble * 15);
                for (let i = 0; i < particleCount; i++) {
                    const pFrac = (i / particleCount + t * 0.05) % 1;
                    const pAngle = pFrac * twists * p.TWO_PI + t * 2 +
                        Math.sin(i * 1.7) * 0.5;
                    const pY = yOffset + pFrac * verticalSpan;
                    const pX = cx + Math.cos(pAngle) * (helixRadius + Math.sin(t + i) * 8);
                    const pZ = Math.sin(pAngle);

                    const pHue = (160 + i * 7 + t * 10) % 360;
                    const pSize = (2 + Math.sin(t * 3 + i) * 1) * (0.5 + (pZ + 1) * 0.25);
                    const pAlpha = (20 + (pZ + 1) * 15 + pulse * 10);

                    p.fill(pHue, 50, 80, pAlpha);
                    p.ellipse(pX, pY, pSize, pSize);
                }

                // Beat flash — bright core pulse
                if (pulse > 0.3) {
                    p.fill(200, 30, 60, pulse * 8);
                    p.ellipse(cx, h * 0.5, helixRadius * 3, h * 0.6);
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
window.VJamFX.presets['dna-aurora'] = DnaAuroraPreset;
})();
