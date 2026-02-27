(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FlickerStrobePreset extends BasePreset {
    constructor() {
        super();
        this.params = {
            flashDuration: 6,
            afterimageDuration: 30,
        };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.flashes = [];
        this.shapeIndex = 0;
    }

    setup(container) {
        this.destroy();
        this.flashes = [];
        this.shapeIndex = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.RGB, 255, 255, 255, 255);
                p.background(0);
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.85;

                const now = p.frameCount;

                // Auto-generate flashes based on frameCount for autonomous animation
                if (now % 20 === 0 && preset.beatPulse < 0.1) {
                    preset._addFlash(p, 0.4);
                }

                // Draw all active flashes (newest first for layering)
                for (let i = preset.flashes.length - 1; i >= 0; i--) {
                    const flash = preset.flashes[i];
                    const age = now - flash.born;
                    const totalLife = preset.params.flashDuration + preset.params.afterimageDuration;

                    if (age > totalLife) {
                        preset.flashes.splice(i, 1);
                        continue;
                    }

                    // Phase: bright flash then fading afterimage
                    let alpha;
                    let scale;
                    if (age < preset.params.flashDuration) {
                        // Main flash - bright burst
                        const t = age / preset.params.flashDuration;
                        alpha = 255 * flash.intensity * (1 - t * 0.3);
                        scale = 1 + t * 0.1;
                    } else {
                        // Afterimage - persistence of vision ghost
                        const afterAge = age - preset.params.flashDuration;
                        const t = afterAge / preset.params.afterimageDuration;
                        alpha = 255 * flash.intensity * (1 - t) * 0.35;
                        scale = 1 + t * 0.3;
                        // Afterimage shifts slightly (simulating retinal drift)
                    }

                    if (alpha < 2) continue;

                    const size = flash.size * scale;
                    const x = flash.x;
                    const y = flash.y;

                    // During afterimage phase, draw as complementary/inverted color
                    const isAfterimage = age >= preset.params.flashDuration;
                    let r, g, b;
                    if (isAfterimage) {
                        // Complementary color for afterimage effect
                        r = 255 - flash.r;
                        g = 255 - flash.g;
                        b = 255 - flash.b;
                    } else {
                        r = flash.r;
                        g = flash.g;
                        b = flash.b;
                    }

                    p.noStroke();
                    p.fill(r, g, b, Math.min(255, alpha));

                    // Draw the shape
                    preset._drawShape(p, flash.shape, x, y, size);

                    // White highlight for main flash
                    if (!isAfterimage && alpha > 150) {
                        p.fill(255, 255, 255, alpha * 0.5);
                        preset._drawShape(p, flash.shape, x, y, size * 0.5);
                    }
                }

                // Bass-driven ambient glow in corners
                if (preset.audio.bass > 0.1) {
                    const glowAlpha = preset.audio.bass * 40;
                    p.noStroke();
                    p.fill(255, 0, 0, glowAlpha);
                    p.circle(0, 0, 200 * preset.audio.bass);
                    p.fill(0, 0, 255, glowAlpha);
                    p.circle(p.width, p.height, 200 * preset.audio.bass);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _drawShape(p, shape, x, y, size) {
        const half = size / 2;
        switch (shape) {
            case 0: // circle
                p.circle(x, y, size);
                break;
            case 1: // triangle
                p.triangle(
                    x, y - half,
                    x - half * 0.866, y + half * 0.5,
                    x + half * 0.866, y + half * 0.5
                );
                break;
            case 2: // square
                p.rectMode(p.CENTER);
                p.rect(x, y, size * 0.8, size * 0.8);
                break;
            case 3: // diamond
                p.quad(x, y - half, x + half * 0.6, y, x, y + half, x - half * 0.6, y);
                break;
            case 4: // star burst (lines from center)
                p.strokeWeight(size * 0.05 + 1);
                p.stroke(p.red(p.color(255)), p.green(p.color(255)), p.blue(p.color(255)), 200);
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                    p.line(x, y, x + Math.cos(a) * half, y + Math.sin(a) * half);
                }
                p.noStroke();
                break;
        }
    }

    _addFlash(p, intensity) {
        // Pick colors: bold primaries + white
        const colors = [
            [255, 40, 40],    // red
            [40, 80, 255],    // blue
            [255, 240, 40],   // yellow
            [255, 255, 255],  // white
            [255, 40, 200],   // magenta
            [40, 255, 120],   // green
        ];
        const bassBoost = 1 + this.audio.bass * 1.5;

        // Generate 1-3 shapes per flash
        const count = 1 + Math.floor(intensity * 2);
        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const shape = this.shapeIndex % 5;
            this.shapeIndex++;

            // Position: spread across canvas, biased toward center
            const spread = 0.7;
            const x = p.width / 2 + (Math.random() - 0.5) * p.width * spread;
            const y = p.height / 2 + (Math.random() - 0.5) * p.height * spread;

            this.flashes.push({
                x: x,
                y: y,
                size: (80 + Math.random() * 160) * bassBoost,
                shape: shape,
                r: color[0],
                g: color[1],
                b: color[2],
                intensity: Math.min(1, intensity * bassBoost),
                born: p.frameCount,
            });
        }

        // Cap active flashes to prevent memory bloat
        if (this.flashes.length > 60) {
            this.flashes.splice(0, this.flashes.length - 60);
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
        if (this.p5) {
            this._addFlash(this.p5, strength);
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['flicker-strobe'] = FlickerStrobePreset;
})();
