import { BasePreset } from '../base-preset.js';

class RainPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.drops = [];
        this.ripples = [];
        this.lightning = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                // Init rain drops
                for (let i = 0; i < 300; i++) {
                    preset.drops.push(preset._makeDrop(p));
                }
            };

            p.draw = () => {
                // Lightning flash on beat
                if (preset.lightning > 0.5) {
                    p.background(220, 5, 90, 60);
                } else {
                    p.background(220, 20, 5, 50);
                }
                preset.lightning *= 0.85;
                preset.beatPulse *= 0.92;

                const bass = preset.audio.bass;
                const wind = (bass - 0.3) * 4; // wind direction from bass

                // Draw rain
                p.strokeWeight(1.5);
                for (const drop of preset.drops) {
                    drop.x += wind * drop.speed * 0.3;
                    drop.y += drop.speed * (1 + preset.audio.rms * 2);
                    drop.x += drop.windOffset;

                    const alpha = 30 + drop.depth * 40;
                    const len = drop.len * (1 + preset.audio.rms);
                    p.stroke(210, 20, 70 + drop.depth * 20, alpha);
                    p.line(drop.x, drop.y, drop.x + wind * 2, drop.y + len);

                    // Hit bottom - create ripple
                    if (drop.y > p.height) {
                        if (Math.random() < 0.3) {
                            preset.ripples.push({
                                x: drop.x, y: p.height - 5 + Math.random() * 10,
                                radius: 0, maxRadius: 8 + Math.random() * 12,
                                life: 1,
                            });
                        }
                        Object.assign(drop, preset._makeDrop(p));
                        drop.y = -20;
                    }
                }

                // Draw ripples at bottom
                p.noFill();
                for (let i = preset.ripples.length - 1; i >= 0; i--) {
                    const r = preset.ripples[i];
                    r.radius += 0.8;
                    r.life -= 0.02;
                    if (r.life <= 0) {
                        preset.ripples.splice(i, 1);
                        continue;
                    }
                    p.stroke(210, 15, 60, r.life * 40);
                    p.strokeWeight(1);
                    p.ellipse(r.x, r.y, r.radius * 2, r.radius * 0.5);
                }

                // Cap ripples
                if (preset.ripples.length > 100) {
                    preset.ripples.splice(0, preset.ripples.length - 100);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _makeDrop(p) {
        const depth = Math.random();
        return {
            x: Math.random() * p.width * 1.2 - p.width * 0.1,
            y: Math.random() * p.height,
            speed: 4 + depth * 8,
            len: 8 + depth * 15,
            depth: depth,
            windOffset: (Math.random() - 0.5) * 0.5,
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
        if (strength > 0.5) {
            this.lightning = strength;
        }
    }
}

export { RainPreset };
if (typeof window !== 'undefined') {
    window.VJamFX = window.VJamFX || { presets: {} };
    window.VJamFX.presets['rain'] = RainPreset;
}
