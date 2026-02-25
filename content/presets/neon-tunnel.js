import { BasePreset } from '../base-preset.js';

class NeonTunnelPreset extends BasePreset {
    constructor() {
        super();
        this.params = {
            ringCount: 20,
            speed: 1,
        };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.rings = [];
        this.hueOffset = 0;
        this.shakeX = 0;
        this.shakeY = 0;
    }

    setup(container) {
        this.destroy();
        this.rings = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);
                // Seed initial rings
                for (let i = 0; i < preset.params.ringCount; i++) {
                    preset.rings.push({
                        z: i / preset.params.ringCount,
                        hue: (i * 18) % 360,
                        sides: 4 + Math.floor(Math.random() * 4),
                        rotation: Math.random() * p.TWO_PI,
                    });
                }
            };

            p.draw = () => {
                p.background(0, 0, 0, 100);

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxSize = Math.max(p.width, p.height) * 0.8;
                const speed = preset.params.speed * (0.5 + preset.audio.rms * 1.5);

                preset.hueOffset += 0.3 + preset.audio.mid * 2;

                // Shake on strong bass
                preset.shakeX *= 0.85;
                preset.shakeY *= 0.85;

                p.push();
                p.translate(cx + preset.shakeX, cy + preset.shakeY);

                // Sort by z (back to front)
                preset.rings.sort((a, b) => b.z - a.z);

                for (let i = preset.rings.length - 1; i >= 0; i--) {
                    const ring = preset.rings[i];
                    ring.z -= 0.005 * speed;
                    ring.rotation += 0.005 + preset.audio.treble * 0.03;

                    if (ring.z <= 0) {
                        ring.z = 1;
                        ring.hue = (preset.hueOffset + Math.random() * 60) % 360;
                        ring.sides = 4 + Math.floor(Math.random() * 4);
                        continue;
                    }

                    const size = maxSize * (1 - ring.z);
                    const alpha = p.map(ring.z, 0, 1, 80, 10);
                    const weight = p.map(ring.z, 0, 1, 4, 1);

                    // Glow
                    p.noFill();
                    p.stroke(ring.hue, 60, 100, alpha * 0.3);
                    p.strokeWeight(weight * 3);
                    preset._drawPolygon(p, 0, 0, size / 2, ring.sides, ring.rotation);

                    // Main
                    p.stroke(ring.hue, 80, 100, alpha);
                    p.strokeWeight(weight);
                    preset._drawPolygon(p, 0, 0, size / 2, ring.sides, ring.rotation);
                }

                p.pop();
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _drawPolygon(p, x, y, radius, sides, rotation) {
        p.beginShape();
        for (let i = 0; i <= sides; i++) {
            const angle = (i / sides) * p.TWO_PI + rotation;
            p.vertex(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
        }
        p.endShape(p.CLOSE);
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.shakeX = (Math.random() - 0.5) * 20 * strength;
        this.shakeY = (Math.random() - 0.5) * 20 * strength;
        // Add extra rings on strong beats
        if (strength > 0.6 && this.rings.length < 40) {
            this.rings.push({
                z: 1,
                hue: (this.hueOffset + Math.random() * 90) % 360,
                sides: 3 + Math.floor(Math.random() * 5),
                rotation: Math.random() * Math.PI * 2,
            });
        }
    }
}

export { NeonTunnelPreset };
if (typeof window !== 'undefined') {
    window.VJamFX = window.VJamFX || { presets: {} };
    window.VJamFX.presets['neon-tunnel'] = NeonTunnelPreset;
}
