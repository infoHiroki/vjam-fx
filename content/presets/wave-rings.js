(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class WaveRingsPreset extends BasePreset {
    constructor() {
        super();
        this.params = {
            maxRings: 30,
            baseExpansionSpeed: 2,
        };
        this.rings = [];
        this.audio = { bass: 0, mid: 0, treble: 0, strength: 0 };
        this.pendingBeats = [];
    }

    setup(container) {
        this.destroy();
        this.rings = [];
        this.pendingBeats = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);
            };

            p.draw = () => {
                p.background(0, 0, 0, 100);

                const cx = p.width / 2;
                const cy = p.height / 2;
                const expansionSpeed = preset.params.baseExpansionSpeed + preset.audio.bass * 4;

                // Spawn rings from pending beats
                for (const beat of preset.pendingBeats) {
                    if (preset.rings.length < preset.params.maxRings) {
                        preset.rings.push({
                            radius: 5,
                            weight: p.lerp(2, 10, beat.strength),
                            hue: (p.frameCount * 0.5 + preset.audio.mid * 200) % 360,
                            life: 1.0,
                            noiseOffset: Math.random() * 1000,
                        });
                    }
                }
                preset.pendingBeats = [];

                // Update and draw rings
                const trebleDistortion = preset.audio.treble;

                for (let i = preset.rings.length - 1; i >= 0; i--) {
                    const ring = preset.rings[i];
                    ring.radius += expansionSpeed;

                    const maxRadius = Math.max(p.width, p.height) * 0.8;
                    ring.life = 1.0 - (ring.radius / maxRadius);

                    if (ring.life <= 0) {
                        preset.rings.splice(i, 1);
                        continue;
                    }

                    const alpha = ring.life * 70;
                    const vertices = 80;

                    // Glow pass (thick, low alpha)
                    p.noFill();
                    p.stroke(ring.hue, 60, 100, alpha * 0.3);
                    p.strokeWeight(ring.weight * 3);
                    p.beginShape();
                    for (let v = 0; v <= vertices; v++) {
                        const angle = (v / vertices) * p.TWO_PI;
                        const noiseVal = p.noise(
                            Math.cos(angle) * 2 + ring.noiseOffset,
                            Math.sin(angle) * 2 + ring.noiseOffset,
                            p.frameCount * 0.01
                        );
                        const displacement = noiseVal * trebleDistortion * ring.radius * 0.15;
                        const r = ring.radius + displacement;
                        p.vertex(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
                    }
                    p.endShape(p.CLOSE);

                    // Main ring pass
                    p.stroke(ring.hue, 80, 100, alpha);
                    p.strokeWeight(ring.weight);
                    p.beginShape();
                    for (let v = 0; v <= vertices; v++) {
                        const angle = (v / vertices) * p.TWO_PI;
                        const noiseVal = p.noise(
                            Math.cos(angle) * 2 + ring.noiseOffset,
                            Math.sin(angle) * 2 + ring.noiseOffset,
                            p.frameCount * 0.01
                        );
                        const displacement = noiseVal * trebleDistortion * ring.radius * 0.15;
                        const r = ring.radius + displacement;
                        p.vertex(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
                    }
                    p.endShape(p.CLOSE);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.pendingBeats.push({ strength });
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['wave-rings'] = WaveRingsPreset;
})();
