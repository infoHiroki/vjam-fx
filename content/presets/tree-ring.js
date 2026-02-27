(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class TreeRingPreset extends BasePreset {
    constructor() {
        super();
        this.params = {};
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.rings = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                preset.rings = [];
                // Start with staggered rings
                for (let i = 0; i < 8; i++) {
                    preset._addRing(p, 15 + i * 22, i * 0.4);
                }
            };

            p.draw = () => {
                p.background(0, 0, 0);
                const t = p.frameCount * 0.004;
                preset.beatPulse *= 0.9;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxDim = Math.max(p.width, p.height) * 0.6;

                // Auto-spawn new inner ring periodically
                if (p.frameCount % 80 === 0) {
                    preset._addRing(p, 5 + Math.random() * 15, 0);
                }

                // Remove old rings that have faded out or grown too large
                for (let i = preset.rings.length - 1; i >= 0; i--) {
                    if (preset.rings[i].alpha <= 0 || preset.rings[i].radius > maxDim * 1.5) {
                        preset.rings.splice(i, 1);
                    }
                }

                // Keep a healthy population
                while (preset.rings.length < 6) {
                    preset._addRing(p, 5 + Math.random() * 30, 0);
                }

                // Draw rings directly (no createGraphics)
                p.noFill();
                for (const ring of preset.rings) {
                    ring.age += 0.008;

                    // Continuous slow expansion
                    const expandSpeed = 0.15 + preset.audio.bass * 0.5 + preset.beatPulse * 1.5;
                    ring.radius += expandSpeed;

                    // Pulsing radius modulation
                    const pulseR = Math.sin(t * 2 + ring.noiseOff) * 3 * (1 + preset.audio.mid * 2);

                    // Fade in then fade out as ring expands
                    const fadeIn = Math.min(1, ring.age * 3);
                    const fadeOut = Math.max(0, 1 - ring.radius / maxDim);
                    ring.alpha = fadeIn * fadeOut;

                    if (ring.alpha <= 0.01) continue;

                    // Color shifting over time
                    const hue = (ring.hue + ring.age * 15 + preset.audio.treble * 30) % 360;
                    const sat = ring.sat + preset.audio.mid * 20;
                    const bri = ring.bri + preset.beatPulse * 25 + preset.audio.rms * 15;
                    const drawAlpha = ring.alpha * (30 + preset.audio.rms * 25 + preset.beatPulse * 20);

                    // Wobble intensity
                    const wobble = 4 + preset.audio.bass * 15 + preset.beatPulse * 8;

                    // Draw ring with organic noise shape
                    p.stroke(hue, Math.min(100, sat), Math.min(100, bri), Math.min(80, drawAlpha));
                    p.strokeWeight(ring.weight * (1 + preset.beatPulse * 0.5));
                    p.beginShape();
                    const steps = 72;
                    for (let i = 0; i <= steps; i++) {
                        const angle = (i / steps) * p.TWO_PI;
                        const nVal = p.noise(
                            Math.cos(angle) * 1.5 + ring.noiseOff,
                            Math.sin(angle) * 1.5 + ring.noiseOff,
                            t + ring.age * 0.15
                        );
                        const r = ring.radius + pulseR + (nVal - 0.5) * wobble * 2;
                        p.curveVertex(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
                    }
                    p.endShape(p.CLOSE);

                    // Secondary ghost ring (slightly offset)
                    if (ring.alpha > 0.3) {
                        const ghostAlpha = drawAlpha * 0.3;
                        p.stroke(hue + 15, Math.min(100, sat * 0.6), Math.min(100, bri * 0.7), ghostAlpha);
                        p.strokeWeight(ring.weight * 0.5);
                        p.beginShape();
                        for (let i = 0; i <= steps; i++) {
                            const angle = (i / steps) * p.TWO_PI;
                            const nVal = p.noise(
                                Math.cos(angle) * 1.5 + ring.noiseOff + 50,
                                Math.sin(angle) * 1.5 + ring.noiseOff + 50,
                                t * 0.8 + ring.age * 0.12
                            );
                            const r = ring.radius * 1.05 + (nVal - 0.5) * wobble * 1.5;
                            p.curveVertex(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
                        }
                        p.endShape(p.CLOSE);
                    }
                }

                // Center glow — heartbeat of the tree
                p.noStroke();
                const glowSize = 25 + Math.sin(t * 3) * 8 + preset.audio.rms * 20 + preset.beatPulse * 30;
                const glowBri = 20 + preset.beatPulse * 40 + preset.audio.bass * 15;
                p.fill(30, 50, Math.min(80, glowBri), 25);
                p.ellipse(cx, cy, glowSize, glowSize);
                p.fill(35, 30, Math.min(90, glowBri + 20), 15);
                p.ellipse(cx, cy, glowSize * 0.5, glowSize * 0.5);

                // Subtle radial bark lines
                p.strokeWeight(0.5);
                for (let i = 0; i < 4; i++) {
                    const angle = t * 0.1 + i * p.TWO_PI / 4 + Math.sin(t + i) * 0.2;
                    const r1 = 10 + Math.random() * 20;
                    const r2 = r1 + 40 + Math.random() * 80;
                    const lineAlpha = 8 + preset.audio.rms * 5;
                    p.stroke(30, 20, 25, lineAlpha);
                    p.line(
                        cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1,
                        cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2
                    );
                }
                p.noStroke();
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _addRing(p, radius, age) {
        this.rings.push({
            radius: radius || 10,
            hue: 20 + Math.random() * 25,
            sat: 35 + Math.random() * 30,
            bri: 25 + Math.random() * 35,
            weight: 1.2 + Math.random() * 2.5,
            noiseOff: Math.random() * 1000,
            age: age || 0,
            alpha: 1
        });
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        // Spawn new inner ring on beat
        if (this.rings && this.rings.length < 25) {
            this._addRing(null, 5 + Math.random() * 15, 0);
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['tree-ring'] = TreeRingPreset;
})();
