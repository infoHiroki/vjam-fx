(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class AntColonyPreset extends BasePreset {
        constructor() {
            super();
            this.params = { speed: 1 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.ants = [];
        }

        setup(container) {
            this.destroy();
            this.ants = [];
            const preset = this;

            this.p5 = new p5((p) => {
                let pg;
                const RES = 4;

                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.noSmooth();
                    pg = p.createGraphics(
                        Math.ceil(p.width / RES),
                        Math.ceil(p.height / RES)
                    );
                    pg.colorMode(p.HSB, 360, 100, 100, 100);
                    pg.background(0);
                    pg.noStroke();

                    // Init ants
                    for (let i = 0; i < 50; i++) {
                        preset.ants.push({
                            x: Math.random() * pg.width,
                            y: Math.random() * pg.height,
                            angle: Math.random() * Math.PI * 2,
                            speed: 0.5 + Math.random() * 1,
                            hueOffset: Math.random() * 60,
                        });
                    }
                };

                p.draw = () => {
                    const speed = preset.params.speed;
                    const pulse = preset.beatPulse;
                    preset.beatPulse *= 0.93;

                    const w = pg.width;
                    const h = pg.height;

                    // Fade pheromone trails slowly
                    pg.fill(0, 0, 0, 4 + preset.audio.treble * 3);
                    pg.noStroke();
                    pg.rect(0, 0, w, h);

                    // Audio-driven pheromone hue
                    const baseHue = (p.frameCount * 0.3 + preset.audio.bass * 120) % 360;

                    // Update and draw ants
                    pg.noStroke();
                    for (const ant of preset.ants) {
                        // Random walk with Perlin noise
                        const noiseVal = p.noise(ant.x * 0.02, ant.y * 0.02, p.frameCount * 0.005 * speed);
                        ant.angle += (noiseVal - 0.5) * 1.2;

                        // Beat scatter
                        if (pulse > 0.3) {
                            ant.angle += (Math.random() - 0.5) * pulse * 3;
                            ant.speed = 1.5 + pulse * 2;
                        } else {
                            ant.speed = Math.max(0.5, ant.speed * 0.98 + 0.01);
                        }

                        ant.x += Math.cos(ant.angle) * ant.speed * speed;
                        ant.y += Math.sin(ant.angle) * ant.speed * speed;

                        // Wrap around
                        if (ant.x < 0) ant.x += w;
                        if (ant.x >= w) ant.x -= w;
                        if (ant.y < 0) ant.y += h;
                        if (ant.y >= h) ant.y -= h;

                        // Draw pheromone trail
                        const trailHue = (baseHue + ant.hueOffset) % 360;
                        const brightness = 50 + preset.audio.rms * 40 + pulse * 20;
                        pg.fill(trailHue, 70, Math.min(100, brightness), 60);
                        pg.ellipse(ant.x, ant.y, 2, 2);

                        // Draw ant body (slightly brighter dot)
                        pg.fill(trailHue, 40, 95, 90);
                        pg.ellipse(ant.x, ant.y, 1.5, 1.5);
                    }

                    p.image(pg, 0, 0, p.width, p.height);
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                    const oldPg = pg;
                    pg = p.createGraphics(
                        Math.ceil(p.width / RES),
                        Math.ceil(p.height / RES)
                    );
                    pg.colorMode(p.HSB, 360, 100, 100, 100);
                    pg.image(oldPg, 0, 0, pg.width, pg.height);
                    pg.noStroke();
                    oldPg.remove();
                    // Rescale ant positions
                    for (const ant of preset.ants) {
                        ant.x = Math.min(ant.x, pg.width - 1);
                        ant.y = Math.min(ant.y, pg.height - 1);
                    }
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

    window.VJamFX.presets['ant-colony'] = AntColonyPreset;
})();
