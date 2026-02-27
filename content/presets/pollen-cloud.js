(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PollenCloudPreset extends BasePreset {
    constructor() {
        super();
        this.params = {};
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.particles = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noStroke();
                preset.particles = [];
                for (let i = 0; i < 300; i++) {
                    preset.particles.push({
                        x: Math.random() * p.width,
                        y: Math.random() * p.height,
                        vx: 0, vy: 0,
                        size: 2 + Math.random() * 4,
                        hue: 40 + Math.random() * 15,
                        bri: 60 + Math.random() * 30,
                        life: 0.5 + Math.random() * 0.5
                    });
                }
            };

            p.draw = () => {
                const t = p.frameCount * 0.004;
                preset.beatPulse *= 0.94;

                // Trail background
                p.background(30, 20, 8, 20);

                const cx = p.width / 2;
                const cy = p.height / 2;

                for (const pt of preset.particles) {
                    // Noise field drives movement
                    const noiseX = p.noise(pt.x * 0.008, pt.y * 0.008, t) - 0.5;
                    const noiseY = p.noise(pt.x * 0.008 + 100, pt.y * 0.008 + 100, t) - 0.5;

                    pt.vx += noiseX * 0.3;
                    pt.vy += noiseY * 0.3;

                    // Damping
                    pt.vx *= 0.96;
                    pt.vy *= 0.96;

                    pt.x += pt.vx + preset.audio.mid * noiseX * 2;
                    pt.y += pt.vy + preset.audio.bass * noiseY * 2;

                    // Wrap
                    if (pt.x < -20) pt.x += p.width + 40;
                    if (pt.x > p.width + 20) pt.x -= p.width + 40;
                    if (pt.y < -20) pt.y += p.height + 40;
                    if (pt.y > p.height + 20) pt.y -= p.height + 40;

                    // Speed-based brightness
                    const speed = Math.sqrt(pt.vx * pt.vx + pt.vy * pt.vy);
                    const alpha = 30 + Math.min(speed * 15, 40) + preset.audio.rms * 20;
                    const size = pt.size + speed * 0.5;

                    // Glow for bright particles
                    if (pt.bri > 75) {
                        p.fill(pt.hue, 30, pt.bri, alpha * 0.3);
                        p.circle(pt.x, pt.y, size * 3);
                    }

                    p.fill(pt.hue, 45, pt.bri, alpha);
                    p.circle(pt.x, pt.y, size);
                }

                // Subtle warm glow in center
                const centerGlow = 5 + preset.audio.rms * 8 + preset.beatPulse * 10;
                p.fill(45, 25, 60, centerGlow);
                p.circle(cx, cy, 200 + preset.audio.bass * 100);
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
        // Explosion force from center
        if (this.particles && this.p5) {
            const cx = this.p5.width / 2;
            const cy = this.p5.height / 2;
            for (const pt of this.particles) {
                const dx = pt.x - cx;
                const dy = pt.y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy) + 1;
                const force = strength * 8 / Math.max(dist * 0.01, 1);
                pt.vx += (dx / dist) * force;
                pt.vy += (dy / dist) * force;
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['pollen-cloud'] = PollenCloudPreset;
})();
