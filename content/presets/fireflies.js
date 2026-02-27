(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FirefliesPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.flies = [];
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
                for (let i = 0; i < 50; i++) {
                    preset.flies.push(preset._makeFly(p));
                }
            };

            p.draw = () => {
                p.background(0, 0, 2, 30);
                preset.beatPulse *= 0.92;

                const bass = preset.audio.bass;
                const treble = preset.audio.treble;
                const time = p.millis() * 0.001;

                // Beat burst: spawn bright flies
                if (preset.beatPulse > 0.3 && preset.flies.length < 120) {
                    const count = Math.floor(preset.beatPulse * 6);
                    for (let i = 0; i < count; i++) {
                        const fly = preset._makeFly(p);
                        fly.bri = 90;
                        fly.alpha = 80;
                        fly.glowSize = 30 + Math.random() * 20;
                        preset.flies.push(fly);
                    }
                }

                for (let i = preset.flies.length - 1; i >= 0; i--) {
                    const f = preset.flies[i];

                    // Wandering motion with Perlin noise
                    const angle = p.noise(f.noiseX, f.noiseY, time * 0.3) * p.TWO_PI * 2;
                    f.vx += Math.cos(angle) * 0.15;
                    f.vy += Math.sin(angle) * 0.15;
                    f.vx *= 0.95;
                    f.vy *= 0.95;

                    f.x += f.vx * preset.params.speed;
                    f.y += f.vy * preset.params.speed;
                    f.noiseX += 0.005;
                    f.noiseY += 0.005;
                    f.life -= 0.001;

                    // Wrap around edges
                    if (f.x < -20) f.x = p.width + 20;
                    if (f.x > p.width + 20) f.x = -20;
                    if (f.y < -20) f.y = p.height + 20;
                    if (f.y > p.height + 20) f.y = -20;

                    if (f.life <= 0) {
                        preset.flies.splice(i, 1);
                        continue;
                    }

                    // Pulsing glow (individual rhythm)
                    const pulse = (Math.sin(time * f.pulseSpeed + f.pulsePhase) + 1) * 0.5;
                    const glowIntensity = 0.3 + pulse * 0.7 + bass * 0.3;
                    const size = f.glowSize * glowIntensity * (1 + preset.beatPulse * 0.5);
                    const alpha = f.alpha * f.life * glowIntensity;

                    // Outer glow
                    p.fill(f.hue, f.sat, f.bri, alpha * 0.15);
                    p.ellipse(f.x, f.y, size * 3, size * 3);

                    // Mid glow
                    p.fill(f.hue, f.sat - 10, Math.min(100, f.bri + 10), alpha * 0.3);
                    p.ellipse(f.x, f.y, size * 1.5, size * 1.5);

                    // Core
                    p.fill(f.hue, f.sat - 30, Math.min(100, f.bri + 30), alpha * 0.7);
                    p.ellipse(f.x, f.y, size * 0.4, size * 0.4);

                    // Bright center
                    p.fill(f.hue, 10, 100, alpha * 0.5);
                    p.ellipse(f.x, f.y, size * 0.15, size * 0.15);
                }

                // Maintain population
                while (preset.flies.length < 30) {
                    preset.flies.push(preset._makeFly(p));
                }

                // Cap
                if (preset.flies.length > 150) {
                    preset.flies.splice(0, preset.flies.length - 150);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _makeFly(p) {
        return {
            x: Math.random() * p.width,
            y: Math.random() * p.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            noiseX: Math.random() * 1000,
            noiseY: Math.random() * 1000,
            glowSize: 8 + Math.random() * 16,
            hue: 50 + Math.random() * 30, // yellow-green (firefly colors)
            sat: 60 + Math.random() * 30,
            bri: 60 + Math.random() * 30,
            alpha: 40 + Math.random() * 40,
            life: 0.6 + Math.random() * 0.4,
            pulseSpeed: 1.5 + Math.random() * 3,
            pulsePhase: Math.random() * Math.PI * 2,
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
window.VJamFX.presets['fireflies'] = FirefliesPreset;
})();
