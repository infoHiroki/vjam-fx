(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class BokehPreset extends BasePreset {
        constructor() {
            super();
            this.params = { speed: 1 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.circles = [];
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
                    // Init bokeh circles
                    for (let i = 0; i < 40; i++) {
                        preset.circles.push(preset._makeCircle(p));
                    }
                };

                p.draw = () => {
                    p.background(0, 0, 5, 25);
                    preset.beatPulse *= 0.9;

                    const bass = preset.audio.bass;
                    const mid = preset.audio.mid;

                    // Spawn on bass
                    if (bass > 0.4 && preset.circles.length < 80) {
                        const count = Math.floor(bass * 3);
                        for (let i = 0; i < count; i++) {
                            preset.circles.push(preset._makeCircle(p));
                        }
                    }

                    // Beat burst: small bright particles
                    if (preset.beatPulse > 0.3) {
                        for (let i = 0; i < 8; i++) {
                            preset.circles.push({
                                x: Math.random() * p.width,
                                y: Math.random() * p.height,
                                vx: (Math.random() - 0.5) * 2,
                                vy: -Math.random() * 1.5 - 0.5,
                                size: 5 + Math.random() * 15,
                                hue: (30 + Math.random() * 40) % 360,
                                sat: 40,
                                bri: 90,
                                alpha: 50,
                                life: 0.6 + Math.random() * 0.4,
                            });
                        }
                    }

                    // Update and draw (write-index pattern to avoid splice)
                    let w = 0;
                    for (let i = 0; i < preset.circles.length; i++) {
                        const c = preset.circles[i];
                        c.x += c.vx * preset.params.speed;
                        c.y += c.vy * preset.params.speed;
                        c.life -= 0.002;

                        if (c.life <= 0 || c.y < -c.size || c.y > p.height + c.size) continue;

                        const s = c.size * (1 + bass * 0.3);
                        const alpha = c.alpha * c.life;

                        // Soft bokeh: multiple concentric circles
                        p.fill(c.hue, c.sat, c.bri, alpha * 0.3);
                        p.ellipse(c.x, c.y, s * 1.3, s * 1.3);
                        p.fill(c.hue, c.sat - 10, c.bri + 10, alpha * 0.5);
                        p.ellipse(c.x, c.y, s, s);
                        p.fill(c.hue, c.sat - 20, Math.min(100, c.bri + 20), alpha * 0.3);
                        p.ellipse(c.x, c.y, s * 0.5, s * 0.5);
                        preset.circles[w++] = c;
                    }
                    preset.circles.length = w;

                    // Cap
                    if (preset.circles.length > 100) {
                        preset.circles.length = 100;
                    }
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                };
            }, container);
        }

        _makeCircle(p) {
            return {
                x: Math.random() * p.width,
                y: p.height + Math.random() * 50,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -Math.random() * 0.8 - 0.2,
                size: 20 + Math.random() * 60,
                hue: (20 + Math.random() * 50) % 360, // warm tones
                sat: 30 + Math.random() * 30,
                bri: 50 + Math.random() * 40,
                alpha: 20 + Math.random() * 30,
                life: 1,
            };
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

    window.VJamFX.presets['bokeh'] = BokehPreset;
})();
