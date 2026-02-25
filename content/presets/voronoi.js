(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class VoronoiPreset extends BasePreset {
        constructor() {
            super();
            this.params = { pointCount: 30 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.points = [];
            this.beatPulse = 0;
        }

        setup(container) {
            this.destroy();
            this.points = [];
            const preset = this;

            this.p5 = new p5((p) => {
                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                    preset._initPoints(p);
                };

                p.draw = () => {
                    p.background(0);
                    preset.beatPulse *= 0.9;

                    const bassSpeed = 1 + preset.audio.bass * 3;

                    // Move points
                    for (const pt of preset.points) {
                        pt.x += pt.vx * bassSpeed;
                        pt.y += pt.vy * bassSpeed;
                        if (pt.x < 0 || pt.x > p.width) pt.vx *= -1;
                        if (pt.y < 0 || pt.y > p.height) pt.vy *= -1;
                        pt.x = p.constrain(pt.x, 0, p.width);
                        pt.y = p.constrain(pt.y, 0, p.height);
                    }

                    // Draw approximate voronoi using pixel sampling
                    const step = 8;
                    const trebleShift = preset.audio.treble * 120;

                    for (let x = 0; x < p.width; x += step) {
                        for (let y = 0; y < p.height; y += step) {
                            let minDist = Infinity;
                            let secondDist = Infinity;
                            let closest = 0;

                            for (let i = 0; i < preset.points.length; i++) {
                                const dx = x - preset.points[i].x;
                                const dy = y - preset.points[i].y;
                                const d = dx * dx + dy * dy;
                                if (d < minDist) {
                                    secondDist = minDist;
                                    minDist = d;
                                    closest = i;
                                } else if (d < secondDist) {
                                    secondDist = d;
                                }
                            }

                            const edge = Math.sqrt(secondDist) - Math.sqrt(minDist);
                            const hue = (preset.points[closest].hue + trebleShift) % 360;

                            if (edge < 8 + preset.beatPulse * 15) {
                                // Edge: bright line
                                p.fill(hue, 40, 100, 80);
                            } else {
                                // Cell interior
                                const dist = Math.sqrt(minDist);
                                const bri = p.map(dist, 0, 200, 40, 10) + preset.audio.rms * 20;
                                p.fill(hue, 60, Math.min(100, bri + preset.beatPulse * 30), 80);
                            }
                            p.noStroke();
                            p.rect(x, y, step, step);
                        }
                    }

                    // Draw point centers
                    for (const pt of preset.points) {
                        p.fill(0, 0, 100, 60);
                        p.noStroke();
                        p.circle(pt.x, pt.y, 4 + preset.beatPulse * 6);
                    }
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                };
            }, container);
        }

        _initPoints(p) {
            this.points = [];
            for (let i = 0; i < this.params.pointCount; i++) {
                this.points.push({
                    x: Math.random() * p.width,
                    y: Math.random() * p.height,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    hue: Math.random() * 360,
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
            for (const pt of this.points) {
                pt.vx += (Math.random() - 0.5) * strength * 4;
                pt.vy += (Math.random() - 0.5) * strength * 4;
            }
        }
    }

    window.VJamFX.presets['voronoi'] = VoronoiPreset;
})();
