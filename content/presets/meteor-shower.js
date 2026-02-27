(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MeteorShowerPreset extends BasePreset {
    constructor() {
        super();
        this.params = {};
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.meteors = [];
        this.stars = [];
        this.starsReady = false;
    }

    setup(container) {
        this.destroy();
        const preset = this;
        preset.meteors = [];
        preset.stars = [];
        preset.starsReady = false;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noStroke();

                // Generate background stars
                const starCount = 60 + Math.floor(Math.random() * 20);
                for (let i = 0; i < starCount; i++) {
                    preset.stars.push({
                        x: Math.random() * p.width,
                        y: Math.random() * p.height,
                        size: 0.8 + Math.random() * 2,
                        phase: Math.random() * p.TWO_PI,
                        speed: 0.02 + Math.random() * 0.04,
                        brightness: 50 + Math.random() * 50
                    });
                }
                preset.starsReady = true;

                // Start with a few meteors
                for (let i = 0; i < 4; i++) {
                    preset._spawnMeteor(p, false);
                }
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.93;

                if (!preset.starsReady) return;

                // Draw twinkling stars
                for (let i = 0; i < preset.stars.length; i++) {
                    const star = preset.stars[i];
                    const twinkle = Math.sin(p.frameCount * star.speed + star.phase);
                    const alpha = 30 + (twinkle * 0.5 + 0.5) * star.brightness * 0.6;
                    const bri = 60 + twinkle * 20;
                    p.fill(40, 10, bri, alpha);
                    p.circle(star.x, star.y, star.size);
                }

                // Spawn new meteors to maintain 3-5 visible
                if (p.frameCount % 30 === 0 && preset.meteors.length < 3) {
                    preset._spawnMeteor(p, false);
                }
                if (p.frameCount % 60 === 0 && preset.meteors.length < 5) {
                    preset._spawnMeteor(p, Math.random() < 0.15);
                }

                // Update and draw meteors
                for (let i = preset.meteors.length - 1; i >= 0; i--) {
                    const m = preset.meteors[i];

                    // Update position
                    m.x += m.vx;
                    m.y += m.vy;
                    m.life--;

                    // Store trail position
                    m.trail.unshift({ x: m.x, y: m.y });
                    if (m.trail.length > m.tailLength) {
                        m.trail.pop();
                    }

                    // Remove if off screen or dead
                    if (m.x < -50 || m.x > p.width + 50 || m.y > p.height + 50 || m.life <= 0) {
                        preset.meteors.splice(i, 1);
                        continue;
                    }

                    const lifeFade = Math.min(1, m.life / 30);

                    // Draw tail segments (back to front)
                    for (let t = m.trail.length - 1; t >= 1; t--) {
                        const ratio = t / m.trail.length;
                        const pt = m.trail[t];

                        // Warm orange tail fading out
                        const tailHue = 20 + ratio * 15;
                        const tailAlpha = (1 - ratio) * 60 * lifeFade;
                        const tailSize = m.size * (1 - ratio * 0.7);

                        if (tailAlpha > 2) {
                            p.fill(tailHue, 70 + ratio * 20, 90 - ratio * 30, tailAlpha);
                            p.circle(pt.x, pt.y, tailSize);
                        }
                    }

                    // Draw bright head
                    // Outer glow
                    p.fill(210, 20, 100, 25 * lifeFade + preset.beatPulse * 15);
                    p.circle(m.x, m.y, m.size * 3);

                    // White-blue core
                    p.fill(210, 30, 100, 85 * lifeFade);
                    p.circle(m.x, m.y, m.size * 1.5);

                    // Hot white center
                    p.fill(200, 10, 100, 95 * lifeFade);
                    p.circle(m.x, m.y, m.size * 0.7);

                    // Wide trail for large meteors
                    if (m.isLarge && m.trail.length > 2) {
                        for (let t = 0; t < Math.min(m.trail.length - 1, 6); t++) {
                            const pt = m.trail[t];
                            const alpha = (1 - t / 6) * 15 * lifeFade;
                            p.fill(30, 50, 90, alpha);
                            p.ellipse(pt.x, pt.y, m.size * (3 - t * 0.3), m.size * (1.5 - t * 0.15));
                        }
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                // Reposition stars
                for (let i = 0; i < preset.stars.length; i++) {
                    preset.stars[i].x = Math.random() * p.width;
                    preset.stars[i].y = Math.random() * p.height;
                }
            };
        }, container);
    }

    _spawnMeteor(p, isLarge) {
        // Mostly upper-right to lower-left, with variety
        const angleBase = Math.PI * 0.6 + (Math.random() - 0.5) * 0.8;
        const speed = isLarge
            ? 4 + Math.random() * 3
            : 5 + Math.random() * 6;

        const startX = p.width * (0.3 + Math.random() * 0.8);
        const startY = -10 - Math.random() * 40;

        const tailLength = isLarge
            ? 12 + Math.floor(Math.random() * 4)
            : 8 + Math.floor(Math.random() * 7);

        this.meteors.push({
            x: startX,
            y: startY,
            vx: Math.cos(angleBase) * speed,
            vy: Math.sin(angleBase) * speed,
            size: isLarge ? 6 + Math.random() * 3 : 2.5 + Math.random() * 3,
            tailLength: tailLength,
            trail: [],
            life: 120 + Math.floor(Math.random() * 80),
            isLarge: isLarge
        });
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
        if (!this.p5) return;
        const p = this.p5;
        // Burst of 5-8 meteors
        const burstCount = 5 + Math.floor(strength * 3);
        for (let i = 0; i < burstCount; i++) {
            this._spawnMeteor(p, i === 0 && strength > 0.7);
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['meteor-shower'] = MeteorShowerPreset;
})();
