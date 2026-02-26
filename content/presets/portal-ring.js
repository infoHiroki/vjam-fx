(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class PortalRingPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;
        this.p5 = new p5((p) => {
            const particles = [];
            const NUM_PARTICLES = 80;
            let ringExpand = 0;

            function resetParticle(pt) {
                const angle = p.random(p.TWO_PI);
                const dist = p.random(300, 600);
                pt.x = p.cos(angle) * dist;
                pt.y = p.sin(angle) * dist;
                pt.speed = p.random(1, 3);
                pt.hue = p.random(170, 320);
                pt.size = p.random(2, 5);
            }

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                for (let i = 0; i < NUM_PARTICLES; i++) {
                    const pt = {};
                    resetParticle(pt);
                    particles.push(pt);
                }
            };

            p.draw = () => {
                p.background(5, 30, 6);
                preset.beatPulse *= 0.92;
                ringExpand *= 0.94;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const baseRadius = p.min(p.width, p.height) * 0.2 + ringExpand * 50;

                p.push();
                p.translate(cx, cy);

                // Particles pulled toward center
                p.noStroke();
                for (const pt of particles) {
                    const dist = p.sqrt(pt.x * pt.x + pt.y * pt.y);
                    const angle = p.atan2(pt.y, pt.x);
                    const pullSpeed = pt.speed + preset.audio.bass * 2;

                    pt.x -= p.cos(angle) * pullSpeed;
                    pt.y -= p.sin(angle) * pullSpeed;

                    if (dist < 20) {
                        resetParticle(pt);
                    }

                    const alpha = p.map(dist, 20, 600, 90, 30);
                    p.fill(pt.hue, 70, 90, alpha);
                    p.ellipse(pt.x, pt.y, pt.size, pt.size);

                    // Trail toward center
                    p.stroke(pt.hue, 60, 70, alpha * 0.3);
                    p.strokeWeight(0.5);
                    const tx = pt.x - p.cos(angle) * 15;
                    const ty = pt.y - p.sin(angle) * 15;
                    p.line(pt.x, pt.y, tx, ty);
                    p.noStroke();
                }

                // Portal ring - 3D rotation via ellipse
                const rotation = p.frameCount * 0.02;
                const tilt = p.sin(p.frameCount * 0.015) * 0.4;
                const ringW = baseRadius * 2;
                const ringH = baseRadius * 2 * p.abs(p.cos(tilt));

                p.noFill();
                for (let r = 0; r < 4; r++) {
                    const offset = r * 3;
                    const hue = (190 + r * 40 + p.frameCount * 0.5) % 360;
                    const alpha = 70 - r * 12 + preset.beatPulse * 20;
                    p.stroke(hue, 80, 90, alpha);
                    p.strokeWeight(3 - r * 0.5);
                    p.push();
                    p.rotate(rotation + r * 0.1);
                    p.ellipse(0, 0, ringW + offset * 2, ringH + offset * 2);
                    p.pop();
                }

                // Energy lines from ring to center
                const numLines = 12;
                for (let i = 0; i < numLines; i++) {
                    const a = (p.TWO_PI / numLines) * i + rotation;
                    const rx = p.cos(a) * baseRadius * p.cos(tilt * 0.5);
                    const ry = p.sin(a) * baseRadius * p.abs(p.cos(tilt));
                    const alpha = 30 + p.sin(p.frameCount * 0.1 + i) * 20 + preset.beatPulse * 30;
                    p.stroke(190, 60, 80, alpha);
                    p.strokeWeight(0.8);
                    p.line(rx, ry, 0, 0);
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

window.VJamFX.presets['portal-ring'] = PortalRingPreset;
})();
