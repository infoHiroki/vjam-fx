(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class RadialBurstPreset extends BasePreset {
    constructor() {
        super();
        this.params = {
            particleCount: 600,
            baseSpeed: 2,
        };
        this.particles = [];
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        this.particles = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);
                preset._initParticles(p);
            };

            p.draw = () => {
                // Semi-transparent black for trails
                p.fill(0, 0, 0, 12 + preset.audio.rms * 10);
                p.noStroke();
                p.rect(0, 0, p.width, p.height);

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxDist = Math.sqrt(cx * cx + cy * cy) * 1.2;
                const speed = preset.params.baseSpeed * (1 + preset.audio.bass * 4 + preset.beatPulse * 6);
                const dotScale = 1 + preset.audio.treble * 3;

                preset.beatPulse *= 0.92;

                for (let i = 0; i < preset.particles.length; i++) {
                    const pt = preset.particles[i];

                    // Move outward radially
                    pt.dist += pt.speed * speed;

                    // Reset when out of bounds
                    if (pt.dist > maxDist) {
                        preset._resetParticle(pt);
                    }

                    const sx = cx + Math.cos(pt.angle) * pt.dist;
                    const sy = cy + Math.sin(pt.angle) * pt.dist;

                    // Skip if off-screen
                    if (sx < -20 || sx > p.width + 20 || sy < -20 || sy > p.height + 20) continue;

                    const ratio = pt.dist / maxDist;
                    const size = (pt.baseSize + ratio * 3) * dotScale;
                    const alpha = 30 + ratio * 70;

                    // Draw streak line from previous position
                    const prevDist = pt.dist - pt.speed * speed * 1.5;
                    if (prevDist > 0) {
                        const px = cx + Math.cos(pt.angle) * prevDist;
                        const py = cy + Math.sin(pt.angle) * prevDist;
                        p.stroke(pt.hue, pt.sat, 100, alpha * 0.4);
                        p.strokeWeight(size * 0.3);
                        p.line(px, py, sx, sy);
                    }

                    // Draw dot
                    p.noStroke();
                    p.fill(pt.hue, pt.sat, 100, alpha);
                    p.circle(sx, sy, size);

                    // Bright core for larger particles
                    if (size > 3) {
                        p.fill(pt.hue, 10, 100, alpha * 0.6);
                        p.circle(sx, sy, size * 0.4);
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                p.background(0);
            };
        }, container);
    }

    _resetParticle(pt) {
        pt.angle = Math.random() * Math.PI * 2;
        pt.dist = Math.random() * 20;
        pt.speed = 0.3 + Math.random() * 1.2;
        pt.baseSize = 1 + Math.random() * 2.5;
        // Cycle through white / cyan / magenta
        const colorChoice = Math.random();
        if (colorChoice < 0.4) {
            pt.hue = 180; pt.sat = 70; // cyan
        } else if (colorChoice < 0.7) {
            pt.hue = 300; pt.sat = 60; // magenta
        } else {
            pt.hue = 200; pt.sat = 5;  // white-ish
        }
    }

    _initParticles(p) {
        const maxDist = Math.sqrt((p.width / 2) ** 2 + (p.height / 2) ** 2) * 1.2;
        this.particles = [];
        for (let i = 0; i < this.params.particleCount; i++) {
            const pt = {
                angle: 0, dist: 0, speed: 0, baseSize: 0, hue: 0, sat: 0,
            };
            this._resetParticle(pt);
            // Distribute across the full range initially
            pt.dist = Math.random() * maxDist;
            this.particles.push(pt);
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
        // Burst: spawn a ring of fast particles near center
        const burstCount = Math.floor(strength * 40);
        for (let i = 0; i < burstCount && i < this.particles.length; i++) {
            const idx = Math.floor(Math.random() * this.particles.length);
            const pt = this.particles[idx];
            pt.dist = 0;
            pt.angle = Math.random() * Math.PI * 2;
            pt.speed = 1.5 + Math.random() * 2;
            pt.baseSize = 2 + Math.random() * 3;
            // Beat particles are brighter white/cyan
            pt.hue = 180 + Math.random() * 30;
            pt.sat = Math.random() < 0.5 ? 5 : 60;
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['radial-burst'] = RadialBurstPreset;
})();
