import { BasePreset } from '../base-preset.js';

class StarfieldPreset extends BasePreset {
    constructor() {
        super();
        this.params = {
            starCount: 800,
            baseSpeed: 8,
        };
        this.stars = [];
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.warpSpeed = 0;
    }

    setup(container) {
        this.destroy();
        this.stars = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);
                preset._initStars(p);
            };

            p.draw = () => {
                // Trail fading
                p.fill(0, 0, 0, 15 + preset.audio.rms * 15);
                p.noStroke();
                p.rect(0, 0, p.width, p.height);

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxDepth = 1000;
                const speed = preset.params.baseSpeed * (1 + preset.audio.bass * 3 + preset.warpSpeed * 8);

                preset.warpSpeed *= 0.93;

                for (let i = 0; i < preset.stars.length; i++) {
                    const star = preset.stars[i];

                    // Previous screen position
                    const prevScale = maxDepth / star.z;
                    const prevSx = cx + star.x * prevScale;
                    const prevSy = cy + star.y * prevScale;

                    // Move star toward camera
                    star.z -= speed;

                    if (star.z <= 1) {
                        preset._resetStar(star, p, maxDepth);
                        continue;
                    }

                    // Current screen position
                    const scale = maxDepth / star.z;
                    const sx = cx + star.x * scale;
                    const sy = cy + star.y * scale;

                    // Out of bounds
                    if (sx < -100 || sx > p.width + 100 || sy < -100 || sy > p.height + 100) {
                        preset._resetStar(star, p, maxDepth);
                        continue;
                    }

                    const depthRatio = 1 - star.z / maxDepth;
                    const size = 1 + depthRatio * 5;
                    const alpha = 20 + depthRatio * 80;

                    // Draw streak
                    p.stroke(star.hue, 20, 100, alpha * 0.5);
                    p.strokeWeight(size * 0.4);
                    p.line(prevSx, prevSy, sx, sy);

                    // Draw star
                    p.noStroke();
                    p.fill(star.hue, 15, 100, alpha);
                    p.circle(sx, sy, size);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                p.background(0);
            };
        }, container);
    }

    _resetStar(star, p, maxDepth) {
        star.x = (Math.random() - 0.5) * 2;
        star.y = (Math.random() - 0.5) * 2;
        star.z = maxDepth * (0.5 + Math.random() * 0.5);
        star.hue = 180 + Math.random() * 80;
    }

    _initStars(p) {
        const maxDepth = 1000;
        this.stars = [];
        for (let i = 0; i < this.params.starCount; i++) {
            this.stars.push({
                x: (Math.random() - 0.5) * 2,
                y: (Math.random() - 0.5) * 2,
                z: Math.random() * maxDepth,
                hue: 180 + Math.random() * 80,
            });
        }
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.warpSpeed = strength;
        for (const star of this.stars) {
            if (Math.random() < strength * 0.3) {
                star.hue = Math.random() * 360;
            }
        }
    }
}

export { StarfieldPreset };
if (typeof window !== 'undefined') {
    window.VJamFX = window.VJamFX || { presets: {} };
    window.VJamFX.presets['starfield'] = StarfieldPreset;
}
