(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class BubbleFloatPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.bubbles = [];
        this.pops = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                for (let i = 0; i < 60; i++) {
                    preset.bubbles.push(preset._makeBubble(p, false));
                }
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.9;
                const time = p.frameCount * 0.01;

                // Update and draw pops
                for (let i = preset.pops.length - 1; i >= 0; i--) {
                    const pop = preset.pops[i];
                    pop.life -= 0.08;
                    pop.radius += 4;
                    if (pop.life <= 0) {
                        preset.pops.splice(i, 1);
                        continue;
                    }
                    const alpha = pop.life * 60;
                    p.noFill();
                    p.stroke(pop.hue, 40, 95, alpha);
                    p.strokeWeight(1.5);
                    p.ellipse(pop.x, pop.y, pop.radius * 2, pop.radius * 2);
                    // Small sparkle fragments
                    for (let j = 0; j < pop.frags.length; j++) {
                        const fr = pop.frags[j];
                        const fx = pop.x + Math.cos(fr.angle) * pop.radius * 0.8;
                        const fy = pop.y + Math.sin(fr.angle) * pop.radius * 0.8;
                        p.noStroke();
                        p.fill(pop.hue, 30, 100, alpha * 0.7);
                        p.ellipse(fx, fy, 3 * pop.life, 3 * pop.life);
                    }
                }

                p.noStroke();

                // Update and draw bubbles
                for (let i = preset.bubbles.length - 1; i >= 0; i--) {
                    const b = preset.bubbles[i];

                    // Wobble horizontal movement via noise
                    const wobble = p.noise(b.noiseX, time) * 2 - 1;
                    b.x += wobble * 0.8 * preset.params.speed;
                    b.y -= b.riseSpeed * preset.params.speed * (1 + preset.audio.bass * 0.5);
                    b.noiseX += 0.008;
                    b.life -= 0.001;
                    b.highlightAngle += 0.015;

                    // Off screen or expired
                    if (b.y < -b.size || b.life <= 0) {
                        // Pop effect
                        preset.pops.push({
                            x: b.x, y: b.y, radius: b.size * 0.5,
                            hue: b.hue, life: 1,
                            frags: Array.from({ length: 5 }, () => ({
                                angle: Math.random() * Math.PI * 2
                            }))
                        });
                        preset.bubbles.splice(i, 1);
                        continue;
                    }

                    const sz = b.size * (1 + preset.beatPulse * 0.15);
                    const hueShift = (b.hue + p.frameCount * 0.3) % 360;

                    // Outer iridescent glow
                    p.fill(hueShift, 30, 80, 8);
                    p.ellipse(b.x, b.y, sz * 1.4, sz * 1.4);

                    // Bubble ring (thin arc simulation with multiple arcs)
                    p.noFill();
                    p.stroke(hueShift, 50, 95, 35 * b.life);
                    p.strokeWeight(1.5);
                    p.ellipse(b.x, b.y, sz, sz);

                    // Second iridescent ring offset
                    p.stroke((hueShift + 120) % 360, 40, 90, 20 * b.life);
                    p.strokeWeight(0.8);
                    p.ellipse(b.x, b.y, sz * 0.92, sz * 0.92);

                    // Third ring
                    p.stroke((hueShift + 240) % 360, 45, 85, 15 * b.life);
                    p.strokeWeight(0.6);
                    p.ellipse(b.x, b.y, sz * 0.85, sz * 0.85);

                    p.noStroke();

                    // Highlight reflection spot (rotating)
                    const hlx = b.x + Math.cos(b.highlightAngle) * sz * 0.25;
                    const hly = b.y + Math.sin(b.highlightAngle) * sz * 0.25;
                    p.fill(0, 0, 100, 45 * b.life);
                    p.ellipse(hlx, hly, sz * 0.18, sz * 0.12);

                    // Secondary smaller highlight
                    const hl2x = b.x - Math.cos(b.highlightAngle + 2.5) * sz * 0.15;
                    const hl2y = b.y - Math.sin(b.highlightAngle + 2.5) * sz * 0.15;
                    p.fill(0, 0, 100, 25 * b.life);
                    p.ellipse(hl2x, hl2y, sz * 0.08, sz * 0.06);

                    // Inner color fill (very transparent)
                    p.fill(hueShift, 35, 70, 6);
                    p.ellipse(b.x, b.y, sz * 0.8, sz * 0.8);
                }

                // Maintain population
                while (preset.bubbles.length < 40) {
                    preset.bubbles.push(preset._makeBubble(p, true));
                }
                if (preset.bubbles.length > 80) {
                    preset.bubbles.splice(0, preset.bubbles.length - 80);
                }
                if (preset.pops.length > 20) {
                    preset.pops.splice(0, preset.pops.length - 20);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _makeBubble(p, fromBottom) {
        return {
            x: Math.random() * p.width,
            y: fromBottom ? p.height + Math.random() * 40 : Math.random() * p.height,
            size: 15 + Math.random() * 45,
            riseSpeed: 0.3 + Math.random() * 0.8,
            hue: Math.random() * 360,
            noiseX: Math.random() * 1000,
            highlightAngle: Math.random() * Math.PI * 2,
            life: 0.7 + Math.random() * 0.3,
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
        if (this.p5 && strength > 0.3) {
            const p = this.p5;
            const count = Math.floor(strength * 8) + 3;
            for (let i = 0; i < count; i++) {
                this.bubbles.push({
                    x: Math.random() * p.width,
                    y: p.height * 0.5 + (Math.random() - 0.5) * p.height * 0.6,
                    size: 20 + Math.random() * 40,
                    riseSpeed: 0.5 + Math.random() * 1.2,
                    hue: Math.random() * 360,
                    noiseX: Math.random() * 1000,
                    highlightAngle: Math.random() * Math.PI * 2,
                    life: 0.8 + Math.random() * 0.2,
                });
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['bubble-float'] = BubbleFloatPreset;
})();
