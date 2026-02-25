(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class ConstellationPreset extends BasePreset {
        constructor() {
            super();
            this.params = { starCount: 120, lineDistance: 120, speed: 0.4 };
            this.stars = [];
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
        }

        setup(container) {
            this.destroy();
            const preset = this;

            this.p5 = new p5((p) => {
                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.background(0);
                    preset._initStars(p);
                };

                p.draw = () => {
                    p.background(5, 5, 15);

                    const lineDist = preset.params.lineDistance + preset.audio.bass * 60;

                    // Draw connection lines
                    p.strokeWeight(0.5);
                    for (let i = 0; i < preset.stars.length; i++) {
                        for (let j = i + 1; j < preset.stars.length; j++) {
                            const a = preset.stars[i];
                            const b = preset.stars[j];
                            const d = p.dist(a.x, a.y, b.x, b.y);
                            if (d < lineDist) {
                                const alpha = p.map(d, 0, lineDist, 120, 0);
                                p.stroke(180, 200, 255, alpha);
                                p.line(a.x, a.y, b.x, b.y);
                            }
                        }
                    }

                    // Update and draw stars
                    for (const star of preset.stars) {
                        star.x += star.vx;
                        star.y += star.vy;

                        // Bounce off edges
                        if (star.x < 0 || star.x > p.width) star.vx *= -1;
                        if (star.y < 0 || star.y > p.height) star.vy *= -1;
                        star.x = p.constrain(star.x, 0, p.width);
                        star.y = p.constrain(star.y, 0, p.height);

                        // Draw star
                        const brightness = 180 + preset.audio.rms * 75;
                        const sz = star.size * (1 + preset.beatPulse * 0.5);
                        p.noStroke();
                        p.fill(200, 220, 255, brightness);
                        p.ellipse(star.x, star.y, sz, sz);

                        // Glow
                        p.fill(150, 180, 255, 30);
                        p.ellipse(star.x, star.y, sz * 3, sz * 3);
                    }

                    preset.beatPulse *= 0.9;
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                };
            }, container);
        }

        _initStars(p) {
            this.stars = [];
            for (let i = 0; i < this.params.starCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = (Math.random() * 0.5 + 0.2) * this.params.speed;
                this.stars.push({
                    x: Math.random() * p.width,
                    y: Math.random() * p.height,
                    vx: Math.cos(angle) * spd,
                    vy: Math.sin(angle) * spd,
                    size: Math.random() * 2 + 1.5,
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
            this.beatPulse = strength;
            // Scatter stars on beat
            for (const star of this.stars) {
                const angle = Math.random() * Math.PI * 2;
                const force = strength * 3;
                star.vx += Math.cos(angle) * force;
                star.vy += Math.sin(angle) * force;
            }
        }
    }

    window.VJamFX.presets['constellation'] = ConstellationPreset;
})();
