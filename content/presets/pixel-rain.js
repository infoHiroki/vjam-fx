(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PixelRainPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.drops = [];
        this.splashes = [];
        this.maxDrops = 150;
    }

    setup(container) {
        this.destroy();
        this.drops = [];
        this.splashes = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noSmooth();
                // Initialize drops
                for (let i = 0; i < preset.maxDrops; i++) {
                    preset.drops.push(preset._newDrop(p, true));
                }
            };

            p.draw = () => {
                p.background(5, 5, 15);
                preset.beatPulse *= 0.92;

                // Update and draw drops
                p.noStroke();
                for (let i = 0; i < preset.drops.length; i++) {
                    const d = preset.drops[i];
                    d.timer++;

                    // Steppy movement: move every N frames
                    if (d.timer % d.stepInterval === 0) {
                        d.y += d.h;
                    }

                    // Draw blocky raindrop
                    const bright = 180 + Math.floor(Math.random() * 75);
                    p.fill(0, bright, 255, d.alpha);
                    p.rect(d.x, d.y, d.w, d.h);
                    // White highlight on top pixel
                    p.fill(200, 255, 255, d.alpha * 0.7);
                    p.rect(d.x, d.y, d.w, 2);

                    // Reset when off screen
                    if (d.y > p.height) {
                        // Splash on beat
                        if (preset.beatPulse > 0.2) {
                            preset.splashes.push({
                                x: d.x, y: p.height - 4,
                                size: 4, maxSize: 20 + preset.beatPulse * 30,
                                alpha: 200
                            });
                        }
                        preset.drops[i] = preset._newDrop(p, false);
                    }
                }

                // Draw splashes (expanding squares)
                for (let i = preset.splashes.length - 1; i >= 0; i--) {
                    const s = preset.splashes[i];
                    s.size += 2;
                    s.alpha -= 10;

                    if (s.alpha <= 0) {
                        preset.splashes.splice(i, 1);
                        continue;
                    }

                    p.noFill();
                    p.stroke(0, 255, 255, s.alpha);
                    p.strokeWeight(2);
                    p.rect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
                    // Inner square
                    const inner = s.size * 0.5;
                    p.stroke(200, 255, 255, s.alpha * 0.6);
                    p.rect(s.x - inner / 2, s.y - inner / 2, inner, inner);
                }

                // Beat: trigger splash wave at bottom
                if (preset.beatPulse > 0.5) {
                    for (let sx = 0; sx < p.width; sx += 60) {
                        preset.splashes.push({
                            x: sx + Math.random() * 40,
                            y: p.height - 4,
                            size: 4,
                            maxSize: 30,
                            alpha: 180
                        });
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _newDrop(p, randomY) {
        const w = Math.random() < 0.5 ? 4 : 6;
        const h = w === 4 ? 8 : 12;
        return {
            x: Math.floor(Math.random() * (p.width / w)) * w,
            y: randomY ? -Math.random() * p.height : -h - Math.random() * 100,
            w: w,
            h: h,
            stepInterval: 2 + Math.floor(Math.random() * 2),
            timer: Math.floor(Math.random() * 10),
            alpha: 150 + Math.random() * 105
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
window.VJamFX.presets['pixel-rain'] = PixelRainPreset;
})();
