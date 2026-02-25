(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class FractalTreePreset extends BasePreset {
        constructor() {
            super();
            this.params = { speed: 1 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.leaves = [];
        }

        setup(container) {
            this.destroy();
            const preset = this;

            this.p5 = new p5((p) => {
                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                };

                function branch(x, y, len, angle, depth, maxDepth) {
                    if (depth > maxDepth || len < 2) return;

                    const bass = preset.audio.bass;
                    const pulse = preset.beatPulse;

                    const spread = p.PI / 4 + bass * 0.4 + pulse * 0.3;
                    const endX = x + Math.cos(angle) * len;
                    const endY = y + Math.sin(angle) * len;

                    const hue = (120 + depth * 25 + preset.audio.mid * 60) % 360;
                    const bri = 40 + depth * 8 + bass * 20;
                    const weight = Math.max(1, (maxDepth - depth) * 1.5);

                    p.stroke(hue, 50, Math.min(100, bri), 80);
                    p.strokeWeight(weight);
                    p.line(x, y, endX, endY);

                    const shrink = 0.68 + preset.audio.treble * 0.1;
                    const sway = Math.sin(p.frameCount * 0.02 + depth) * 0.1;

                    branch(endX, endY, len * shrink, angle - spread * 0.5 + sway, depth + 1, maxDepth);
                    branch(endX, endY, len * shrink, angle + spread * 0.5 + sway, depth + 1, maxDepth);

                    // Spawn leaves on beat at tips
                    if (depth >= maxDepth - 1 && pulse > 0.3 && Math.random() < 0.3) {
                        preset.leaves.push({
                            x: endX, y: endY,
                            vx: (Math.random() - 0.5) * 2,
                            vy: Math.random() * -1 - 0.5,
                            life: 1,
                            hue: (90 + Math.random() * 60) % 360,
                            size: 3 + Math.random() * 4,
                        });
                    }
                }

                p.draw = () => {
                    p.background(0, 0, 5, 40);
                    preset.beatPulse *= 0.9;

                    const bass = preset.audio.bass;
                    const maxDepth = Math.floor(7 + bass * 3);
                    const trunkLen = p.height * 0.22 + bass * p.height * 0.08;

                    // Draw tree from bottom center
                    branch(p.width / 2, p.height, trunkLen, -p.HALF_PI, 0, maxDepth);

                    // Update and draw leaves (write-index pattern)
                    p.noStroke();
                    let w = 0;
                    for (let i = 0; i < preset.leaves.length; i++) {
                        const leaf = preset.leaves[i];
                        leaf.x += leaf.vx;
                        leaf.y += leaf.vy;
                        leaf.vy += 0.05; // gravity
                        leaf.vx += Math.sin(p.frameCount * 0.05 + i) * 0.05; // wind
                        leaf.life -= 0.008;

                        if (leaf.life <= 0) {
                            continue;
                        }

                        p.fill(leaf.hue, 60, 80, leaf.life * 80);
                        p.ellipse(leaf.x, leaf.y, leaf.size * leaf.life, leaf.size * leaf.life);
                        preset.leaves[w++] = leaf;
                    }
                    preset.leaves.length = w;

                    // Cap leaves
                    if (preset.leaves.length > 200) {
                        preset.leaves.splice(0, preset.leaves.length - 200);
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

    window.VJamFX.presets['fractal-tree'] = FractalTreePreset;
})();
