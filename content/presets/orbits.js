(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class OrbitsPreset extends BasePreset {
    constructor() {
        super();
        this.params = { orbitCount: 8 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.orbits = [];
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        this.orbits = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                preset._initOrbits();
            };

            p.draw = () => {
                p.background(0, 0, 0, 15);
                preset.beatPulse *= 0.93;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxR = Math.min(p.width, p.height) * 0.4;

                // Central body
                const coreSize = 15 + preset.audio.bass * 20 + preset.beatPulse * 10;
                p.noStroke();
                p.fill(40, 80, 100, 30);
                p.circle(cx, cy, coreSize * 2);
                p.fill(40, 60, 100, 60);
                p.circle(cx, cy, coreSize);

                for (const orb of preset.orbits) {
                    orb.angle += orb.speed * (1 + preset.audio.rms * 2);

                    const radius = orb.radius * maxR * (1 + preset.beatPulse * 0.1);

                    // Draw orbit path
                    p.noFill();
                    p.stroke(orb.hue, 30, 40, 15);
                    p.strokeWeight(0.5);
                    p.ellipse(cx, cy, radius * 2 * orb.eccentricity, radius * 2);

                    // Planet position (elliptical)
                    const px = cx + Math.cos(orb.angle + orb.tilt) * radius * orb.eccentricity;
                    const py = cy + Math.sin(orb.angle + orb.tilt) * radius;

                    // Trail
                    const trailCount = 20;
                    for (let t = 0; t < trailCount; t++) {
                        const ta = orb.angle - t * 0.05;
                        const tx = cx + Math.cos(ta + orb.tilt) * radius * orb.eccentricity;
                        const ty = cy + Math.sin(ta + orb.tilt) * radius;
                        const alpha = (1 - t / trailCount) * 30;
                        p.noStroke();
                        p.fill(orb.hue, 60, 80, alpha);
                        p.circle(tx, ty, orb.size * (1 - t / trailCount * 0.5));
                    }

                    // Planet glow
                    p.fill(orb.hue, 40, 100, 20);
                    p.circle(px, py, orb.size * 3);

                    // Planet
                    p.fill(orb.hue, 60, 100, 80);
                    p.circle(px, py, orb.size);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _initOrbits() {
        this.orbits = [];
        for (let i = 0; i < this.params.orbitCount; i++) {
            this.orbits.push({
                radius: 0.15 + i * 0.1 + Math.random() * 0.05,
                angle: Math.random() * Math.PI * 2,
                speed: 0.02 / (0.5 + i * 0.3),
                hue: (i * 45 + Math.random() * 20) % 360,
                size: 4 + Math.random() * 6,
                eccentricity: 0.8 + Math.random() * 0.4,
                tilt: Math.random() * 0.5,
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
        for (const orb of this.orbits) {
            orb.speed += strength * 0.01;
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['orbits'] = OrbitsPreset;
})();
