(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class SnowfallPreset extends BasePreset {
        constructor() {
            super();
            this.params = { speed: 1 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.flakes = [];
            this.groundHeight = [];
            this.windGust = 0;
        }

        setup(container) {
            this.destroy();
            this.flakes = [];
            this.groundHeight = [];
            this.windGust = 0;
            const preset = this;

            this.p5 = new p5((p) => {
                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                    // Init ground height map
                    const cols = Math.ceil(p.width / 4);
                    preset.groundHeight = new Array(cols).fill(0);
                    // Init snowflakes
                    for (let i = 0; i < 200; i++) {
                        preset.flakes.push(preset._makeFlake(p, true));
                    }
                };

                p.draw = () => {
                    p.background(220, 15, 8);
                    const speed = preset.params.speed;
                    const pulse = preset.beatPulse;
                    preset.beatPulse *= 0.95;
                    preset.windGust *= 0.97;

                    const wind = preset.windGust;
                    const groundY = p.height;
                    const cols = preset.groundHeight.length;

                    // Draw ground snow
                    p.noStroke();
                    p.fill(210, 5, 90, 80);
                    p.beginShape();
                    p.vertex(0, groundY);
                    for (let i = 0; i < cols; i++) {
                        p.vertex(i * 4, groundY - preset.groundHeight[i]);
                    }
                    p.vertex(p.width, groundY);
                    p.endShape(p.CLOSE);

                    // Update and draw snowflakes
                    p.noStroke();
                    for (const f of preset.flakes) {
                        // Perlin drift
                        const drift = p.noise(f.x * 0.003, f.y * 0.003, p.frameCount * 0.003) - 0.5;
                        f.x += drift * 2 * f.size + wind * f.size * 0.5;
                        f.y += f.speed * speed;
                        f.angle += f.rotSpeed;

                        // Ground collision
                        const col = Math.floor(f.x / 4);
                        if (col >= 0 && col < cols) {
                            const surfaceY = groundY - preset.groundHeight[col];
                            if (f.y >= surfaceY - f.size) {
                                // Accumulate snow (cap height)
                                if (preset.groundHeight[col] < p.height * 0.15) {
                                    preset.groundHeight[col] += 0.3;
                                    // Smooth neighbors
                                    if (col > 0) preset.groundHeight[col - 1] += 0.1;
                                    if (col < cols - 1) preset.groundHeight[col + 1] += 0.1;
                                }
                                Object.assign(f, preset._makeFlake(p, false));
                                continue;
                            }
                        }

                        // Wrap horizontally
                        if (f.x < -20) f.x = p.width + 20;
                        if (f.x > p.width + 20) f.x = -20;
                        if (f.y > groundY + 10) {
                            Object.assign(f, preset._makeFlake(p, false));
                        }

                        // Draw 6-pointed star snowflake
                        p.push();
                        p.translate(f.x, f.y);
                        p.rotate(f.angle);
                        const alpha = 50 + f.size * 8;
                        p.stroke(210, 10, 95, alpha);
                        p.strokeWeight(f.size < 3 ? 0.5 : 1);
                        p.noFill();
                        for (let a = 0; a < 6; a++) {
                            const ang = (a / 6) * p.TWO_PI;
                            const ex = Math.cos(ang) * f.size;
                            const ey = Math.sin(ang) * f.size;
                            p.line(0, 0, ex, ey);
                            // Small branches on larger flakes
                            if (f.size > 3) {
                                const bx = ex * 0.6;
                                const by = ey * 0.6;
                                const perpX = -Math.sin(ang) * f.size * 0.25;
                                const perpY = Math.cos(ang) * f.size * 0.25;
                                p.line(bx, by, bx + perpX, by + perpY);
                                p.line(bx, by, bx - perpX, by - perpY);
                            }
                        }
                        p.pop();
                    }

                    // Slowly melt ground over time
                    if (p.frameCount % 60 === 0) {
                        for (let i = 0; i < cols; i++) {
                            preset.groundHeight[i] = Math.max(0, preset.groundHeight[i] - 0.2);
                        }
                    }
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                    const cols = Math.ceil(p.width / 4);
                    const old = preset.groundHeight;
                    preset.groundHeight = new Array(cols).fill(0);
                    for (let i = 0; i < Math.min(old.length, cols); i++) {
                        preset.groundHeight[i] = old[i];
                    }
                };
            }, container);
        }

        _makeFlake(p, randomY) {
            return {
                x: Math.random() * p.width,
                y: randomY ? Math.random() * p.height : -Math.random() * 50 - 10,
                size: 1.5 + Math.random() * 5,
                speed: 0.5 + Math.random() * 2,
                angle: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.02,
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
            if (strength > 0.4) {
                this.windGust = (Math.random() > 0.5 ? 1 : -1) * strength * 8;
            }
        }
    }

    window.VJamFX.presets['snowfall'] = SnowfallPreset;
})();
