(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class DeepOceanPreset extends BasePreset {
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
            const MAX_PARTICLES = 200;
            let particles = [];

            function createParticle(burst) {
                return {
                    x: Math.random() * p.width,
                    y: burst ? p.height + Math.random() * 50 : Math.random() * p.height,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: -(Math.random() * 0.5 + 0.2),
                    size: Math.random() * 4 + 1,
                    hue: [180, 190, 160, 200, 170][Math.floor(Math.random() * 5)],
                    pulsePhase: Math.random() * Math.PI * 2,
                    pulseSpeed: Math.random() * 0.03 + 0.01,
                    alpha: Math.random() * 40 + 20,
                    glowSize: Math.random() * 20 + 10,
                };
            }

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noStroke();
                // Initial particles
                for (let i = 0; i < 80; i++) {
                    particles.push(createParticle(false));
                }
            };

            p.draw = () => {
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                const spd = preset.params.speed;

                // Deep ocean gradient background
                p.background(220, 80, 5, 100);
                // Subtle gradient overlay
                for (let y = 0; y < p.height; y += 20) {
                    const frac = y / p.height;
                    const bri = 3 + frac * 4; // Slightly lighter at bottom
                    p.fill(220, 70, bri, 30);
                    p.rect(0, y, p.width, 20);
                }

                // Ambient caustic-like undulations
                const t = p.frameCount * 0.01 * spd;
                for (let i = 0; i < 3; i++) {
                    const cx = p.width * 0.5 + Math.sin(t * 0.3 + i * 2) * p.width * 0.3;
                    const cy = p.height * 0.3 + Math.cos(t * 0.2 + i * 1.5) * p.height * 0.2;
                    p.fill(200, 50, 15 + bass * 10, 5);
                    p.ellipse(cx, cy, 200 + mid * 100, 150 + mid * 80);
                }

                // Beat burst: spawn new particles
                if (pulse > 0.3) {
                    const count = Math.floor(5 + pulse * 10);
                    for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
                        particles.push(createParticle(true));
                    }
                }

                // Slowly add particles
                if (p.frameCount % 10 === 0 && particles.length < 100) {
                    particles.push(createParticle(true));
                }

                // Update and draw particles
                for (let i = particles.length - 1; i >= 0; i--) {
                    const pt = particles[i];

                    // Drift upward
                    pt.x += pt.vx + Math.sin(p.frameCount * 0.02 + pt.pulsePhase) * 0.2;
                    pt.y += pt.vy * spd;
                    pt.pulsePhase += pt.pulseSpeed;

                    // Pulsing glow
                    const pulseFactor = 0.7 + 0.3 * Math.sin(pt.pulsePhase);
                    const glowAlpha = pt.alpha * pulseFactor * (0.5 + mid * 0.5);

                    // Outer glow
                    const gs = pt.glowSize * (1 + bass * 0.5 + pulse * 0.3);
                    p.fill(pt.hue, 60, 50, glowAlpha * 0.3);
                    p.ellipse(pt.x, pt.y, gs, gs);

                    // Inner bright core
                    p.fill(pt.hue, 40, 80 + treble * 20, glowAlpha);
                    p.ellipse(pt.x, pt.y, pt.size * pulseFactor, pt.size * pulseFactor);

                    // Remove if off screen
                    if (pt.y < -20) {
                        particles.splice(i, 1);
                    }
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
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX.presets['deep-ocean'] = DeepOceanPreset;
})();
