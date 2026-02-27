(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ParticleStormPreset extends BasePreset {
    constructor() {
        super();
        this.params = {
            maxParticles: 3000,
            baseGravity: 0.05,
        };
        this.particles = [];
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.pendingBursts = [];
    }

    setup(container) {
        this.destroy();
        this.particles = [];
        this.pendingBursts = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);
            };

            p.draw = () => {
                // Trail effect
                p.fill(0, 0, 0, 20);
                p.noStroke();
                p.rect(0, 0, p.width, p.height);

                const gravity = preset.params.baseGravity + preset.audio.rms * 0.15;
                const particleSize = p.lerp(2, 8, preset.audio.bass);
                const cx = p.width / 2;
                const cy = p.height / 2;

                // Process pending bursts
                for (const burst of preset.pendingBursts) {
                    const count = burst.count;
                    const hue = burst.hue;
                    for (let i = 0; i < count; i++) {
                        if (preset.particles.length >= preset.params.maxParticles) break;
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 2 + Math.random() * 8;
                        preset.particles.push({
                            x: cx,
                            y: cy,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed - Math.random() * 2,
                            life: 1.0,
                            decay: 1.0 / (120 + Math.random() * 120), // 2-4 seconds at 60fps
                            hue: hue + (Math.random() - 0.5) * 30,
                            size: particleSize * (0.5 + Math.random()),
                        });
                    }
                }
                preset.pendingBursts = [];

                // Update and draw particles (write-index pattern to avoid splice)
                let w = 0;
                for (let i = 0; i < preset.particles.length; i++) {
                    const pt = preset.particles[i];
                    pt.vy += gravity;
                    pt.x += pt.vx;
                    pt.y += pt.vy;
                    pt.life -= pt.decay;

                    if (pt.life <= 0) continue;

                    const alpha = pt.life * 80;
                    const hue = ((pt.hue % 360) + 360) % 360;
                    p.fill(hue, 80, 100, alpha);
                    p.noStroke();
                    p.circle(pt.x, pt.y, pt.size * pt.life);
                    preset.particles[w++] = pt;
                }
                preset.particles.length = w;
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                p.background(0);
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
        const count = Math.floor(50 + strength * 150);
        const hue = Math.random() * 360;
        this.pendingBursts.push({ count, hue });
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['particle-storm'] = ParticleStormPreset;
})();
