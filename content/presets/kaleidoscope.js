(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class KaleidoscopePreset extends BasePreset {
    constructor() {
        super();
        this.params = {
            segments: 8,
            speed: 0.5,
        };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.shapes = [];
        this.pendingBeats = [];
        this.spawnTimer = 0;
    }

    setup(container) {
        this.destroy();
        this.shapes = [];
        this.pendingBeats = [];
        this.spawnTimer = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);
            };

            p.draw = () => {
                p.background(0, 0, 0, 12);

                const cx = p.width / 2;
                const cy = p.height / 2;
                const segments = preset.params.segments;
                const angleStep = p.TWO_PI / segments;
                const time = p.frameCount * 0.02 * preset.params.speed;

                // Spawn shapes on beat
                for (const beat of preset.pendingBeats) {
                    const count = Math.floor(3 + beat.strength * 8);
                    for (let i = 0; i < count; i++) {
                        preset._addShape(p, angleStep, beat.strength);
                    }
                }
                preset.pendingBeats = [];

                // Ambient spawning (even without beats)
                preset.spawnTimer++;
                if (preset.spawnTimer >= 8) {
                    preset.spawnTimer = 0;
                    preset._addShape(p, angleStep, 0.3 + preset.audio.rms * 0.5);
                }

                // Draw mirrored segments
                p.push();
                p.translate(cx, cy);

                for (let i = preset.shapes.length - 1; i >= 0; i--) {
                    const s = preset.shapes[i];
                    s.dist += s.speed * (1 + preset.audio.bass * 2);
                    s.angle += 0.01 + preset.audio.treble * 0.02;
                    s.life -= 0.006;

                    const maxDist = Math.max(p.width, p.height) * 0.7;
                    if (s.life <= 0 || s.dist > maxDist) {
                        preset.shapes.splice(i, 1);
                        continue;
                    }

                    const alpha = s.life * 65;
                    const size = s.size * (0.6 + preset.audio.mid * 0.4);

                    for (let seg = 0; seg < segments; seg++) {
                        const baseAngle = seg * angleStep + time;

                        const a1 = baseAngle + s.angle;
                        const x1 = Math.cos(a1) * s.dist;
                        const y1 = Math.sin(a1) * s.dist;

                        const a2 = baseAngle - s.angle;
                        const x2 = Math.cos(a2) * s.dist;
                        const y2 = Math.sin(a2) * s.dist;

                        // Glow
                        p.noStroke();
                        p.fill(s.hue, 50, 90, alpha * 0.3);
                        p.circle(x1, y1, size * 1.8);
                        p.circle(x2, y2, size * 1.8);

                        // Main shape
                        p.fill(s.hue, 70, 95, alpha);
                        if (s.type === 0) {
                            p.circle(x1, y1, size);
                            p.circle(x2, y2, size);
                        } else if (s.type === 1) {
                            p.rectMode(p.CENTER);
                            p.push();
                            p.translate(x1, y1);
                            p.rotate(a1);
                            p.rect(0, 0, size, size);
                            p.pop();
                            p.push();
                            p.translate(x2, y2);
                            p.rotate(a2);
                            p.rect(0, 0, size, size);
                            p.pop();
                        } else {
                            const hs = size / 2;
                            p.triangle(x1, y1 - hs, x1 - hs, y1 + hs, x1 + hs, y1 + hs);
                            p.triangle(x2, y2 - hs, x2 - hs, y2 + hs, x2 + hs, y2 + hs);
                        }
                    }
                }

                p.pop();
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                p.background(0);
            };
        }, container);
    }

    _addShape(p, angleStep, strength) {
        this.shapes.push({
            dist: 5 + Math.random() * 20,
            angle: Math.random() * angleStep,
            size: 4 + Math.random() * 15 * strength,
            hue: (p.frameCount * 0.3 + Math.random() * 80) % 360,
            life: 1.0,
            speed: 0.8 + Math.random() * 2.5,
            type: Math.floor(Math.random() * 3),
        });
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.pendingBeats.push({ strength });
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['kaleidoscope'] = KaleidoscopePreset;
})();
