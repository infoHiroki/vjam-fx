(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class FrequencyRingsPreset extends BasePreset {
        constructor() {
            super();
            this.params = { ringCount: 10, speed: 1 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.rings = [];
        }

        setup(container) {
            this.destroy();
            const preset = this;

            this.p5 = new p5((p) => {
                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                    preset._initRings(p);
                };

                p.draw = () => {
                    p.background(0, 0, 5);

                    const cx = p.width / 2;
                    const cy = p.height / 2;

                    for (let i = 0; i < preset.rings.length; i++) {
                        const ring = preset.rings[i];

                        // Map ring index to frequency band energy
                        const t = i / (preset.rings.length - 1);
                        let energy;
                        if (t < 0.33) {
                            energy = preset.audio.bass;
                        } else if (t < 0.66) {
                            energy = preset.audio.mid;
                        } else {
                            energy = preset.audio.treble;
                        }

                        // Smooth energy
                        ring.energy = ring.energy * 0.7 + energy * 0.3;

                        const thickness = 1.5 + ring.energy * 8 + preset.beatPulse * 2;
                        const brightness = 30 + ring.energy * 70;
                        const saturation = 60 + ring.energy * 40;

                        // Slight radius oscillation
                        const osc = Math.sin(p.frameCount * 0.02 * preset.params.speed + i * 0.5) * 3;
                        const r = ring.baseRadius + osc + ring.energy * 15;

                        p.noFill();
                        p.strokeWeight(thickness);
                        p.stroke(ring.hue, saturation, brightness, 70 + ring.energy * 30);
                        p.ellipse(cx, cy, r * 2, r * 2);

                        // Inner glow
                        if (ring.energy > 0.3) {
                            p.strokeWeight(thickness * 2.5);
                            p.stroke(ring.hue, saturation * 0.5, brightness, 10 + ring.energy * 15);
                            p.ellipse(cx, cy, r * 2, r * 2);
                        }
                    }

                    preset.beatPulse *= 0.88;
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                    preset._initRings(p);
                };
            }, container);
        }

        _initRings(p) {
            this.rings = [];
            const maxR = Math.min(p.width, p.height) * 0.42;
            const minR = 30;
            for (let i = 0; i < this.params.ringCount; i++) {
                const t = i / (this.params.ringCount - 1);
                this.rings.push({
                    baseRadius: minR + t * (maxR - minR),
                    hue: 180 + t * 140,  // cyan to purple
                    energy: 0,
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
        }
    }

    window.VJamFX.presets['frequency-rings'] = FrequencyRingsPreset;
})();
