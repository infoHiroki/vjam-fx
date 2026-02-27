(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key 6 - Set C: ネオンカラー微粒子が全画面に浮遊
class NeonDustPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.particles = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;
        preset.particles = [];

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noStroke();
                for (let i = 0; i < 200; i++) {
                    preset.particles.push(preset._make(p));
                }
            };

            p.draw = () => {
                p.background(0, 0, 0, 25);
                preset.beatPulse *= 0.93;

                const t = p.frameCount * 0.003 * preset.params.speed;
                const bass = preset.audio.bass;

                // Spawn burst on beat
                if (preset.beatPulse > 0.3 && preset.particles.length < 400) {
                    const count = Math.floor(preset.beatPulse * 10);
                    for (let i = 0; i < count; i++) {
                        const pt = preset._make(p);
                        pt.size *= 1.5;
                        pt.alpha = 90;
                        preset.particles.push(pt);
                    }
                }

                for (let i = preset.particles.length - 1; i >= 0; i--) {
                    const pt = preset.particles[i];
                    // Perlin drift
                    const angle = p.noise(pt.nx, pt.ny, t) * p.TWO_PI * 2;
                    pt.vx += Math.cos(angle) * 0.08;
                    pt.vy += Math.sin(angle) * 0.08;
                    pt.vx *= 0.97;
                    pt.vy *= 0.97;
                    pt.x += pt.vx * preset.params.speed;
                    pt.y += pt.vy * preset.params.speed;
                    pt.nx += 0.003;
                    pt.ny += 0.003;
                    pt.life -= 0.002;

                    // Wrap
                    if (pt.x < -10) pt.x = p.width + 10;
                    if (pt.x > p.width + 10) pt.x = -10;
                    if (pt.y < -10) pt.y = p.height + 10;
                    if (pt.y > p.height + 10) pt.y = -10;

                    if (pt.life <= 0) {
                        preset.particles.splice(i, 1);
                        continue;
                    }

                    const flicker = 0.6 + Math.sin(p.frameCount * pt.flickerSpeed + pt.phase) * 0.4;
                    const a = pt.alpha * pt.life * flicker;
                    const s = pt.size * (1 + bass * 0.5 + preset.beatPulse * 0.3);

                    // Glow
                    p.fill(pt.hue, 80, 90, a * 0.2);
                    p.ellipse(pt.x, pt.y, s * 4, s * 4);
                    // Core
                    p.fill(pt.hue, 70, 100, a * 0.6);
                    p.ellipse(pt.x, pt.y, s, s);
                    // Hot center
                    p.fill(pt.hue, 20, 100, a * 0.4);
                    p.ellipse(pt.x, pt.y, s * 0.3, s * 0.3);
                }

                // Maintain
                while (preset.particles.length < 150) {
                    preset.particles.push(preset._make(p));
                }
                if (preset.particles.length > 450) {
                    preset.particles.splice(0, preset.particles.length - 450);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _make(p) {
        const hues = [180, 200, 280, 320]; // cyan, blue, purple, magenta
        return {
            x: Math.random() * p.width,
            y: Math.random() * p.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            nx: Math.random() * 1000,
            ny: Math.random() * 1000,
            size: 2 + Math.random() * 5,
            hue: hues[Math.floor(Math.random() * hues.length)] + Math.random() * 20,
            alpha: 50 + Math.random() * 30,
            life: 0.5 + Math.random() * 0.5,
            flickerSpeed: 0.05 + Math.random() * 0.1,
            phase: Math.random() * Math.PI * 2,
        };
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
window.VJamFX.presets['neon-dust'] = NeonDustPreset;
})();
