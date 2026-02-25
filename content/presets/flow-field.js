(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class FlowFieldPreset extends BasePreset {
        constructor() {
            super();
            this.params = {
                particleCount: 800,
                speed: 2,
                noiseScale: 0.01,
                colorMode: 'angle',
            };
            this.particles = [];
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.scatterFlag = false;
        }

        setup(container) {
            this.destroy();
            const preset = this;

            this.p5 = new p5((p) => {
                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                    p.background(0);
                    preset._initParticles(p);
                };

                p.draw = () => {
                    // Trail effect
                    p.fill(0, 0, 0, p.map(preset.audio.rms, 0, 1, 8, 25));
                    p.noStroke();
                    p.rect(0, 0, p.width, p.height);

                    const noiseScale = p.lerp(0.005, 0.02, preset.audio.bass);
                    const speedMult = p.lerp(1, 5, preset.audio.rms);
                    const baseSpeed = preset.params.speed;

                    for (let i = 0; i < preset.particles.length; i++) {
                        const pt = preset.particles[i];

                        // Scatter on beat
                        if (preset.scatterFlag && Math.random() < 0.3) {
                            pt.vx = (Math.random() - 0.5) * 10;
                            pt.vy = (Math.random() - 0.5) * 10;
                        }

                        const angle = p.noise(pt.x * noiseScale, pt.y * noiseScale, p.frameCount * 0.005) * p.TWO_PI * 2;
                        const force = baseSpeed * speedMult;

                        pt.vx = p.lerp(pt.vx, Math.cos(angle) * force, 0.1);
                        pt.vy = p.lerp(pt.vy, Math.sin(angle) * force, 0.1);
                        pt.x += pt.vx;
                        pt.y += pt.vy;

                        // Wrap edges
                        if (pt.x < 0) pt.x = p.width;
                        if (pt.x > p.width) pt.x = 0;
                        if (pt.y < 0) pt.y = p.height;
                        if (pt.y > p.height) pt.y = 0;

                        const hue = (p.degrees(angle) + 360) % 360;
                        const sat = p.lerp(30, 100, preset.audio.strength);
                        const bri = p.lerp(50, 100, preset.audio.strength);

                        p.stroke(hue, sat, bri, 60);
                        p.strokeWeight(1.5);
                        p.point(pt.x, pt.y);
                    }

                    preset.scatterFlag = false;
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                    p.background(0);
                };
            }, container);
        }

        _initParticles(p) {
            this.particles = [];
            for (let i = 0; i < this.params.particleCount; i++) {
                this.particles.push({
                    x: Math.random() * p.width,
                    y: Math.random() * p.height,
                    vx: 0,
                    vy: 0,
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
            this.scatterFlag = true;
        }
    }

    window.VJamFX.presets['flow-field'] = FlowFieldPreset;
})();
