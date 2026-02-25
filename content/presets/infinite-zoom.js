(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class InfiniteZoomPreset extends BasePreset {
        constructor() {
            super();
            this.params = { speed: 1 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.shapes = [];
            this.spawnTimer = 0;
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
                    preset._initShapes(p);
                };

                p.draw = () => {
                    p.background(0, 0, 0, 95);

                    const cx = p.width / 2;
                    const cy = p.height / 2;
                    const maxSize = Math.max(p.width, p.height) * 1.6;
                    const speedMult = p.lerp(0.8, 3, preset.audio.rms) * preset.params.speed;

                    // Spawn new shapes at edges
                    preset.spawnTimer += speedMult;
                    if (preset.spawnTimer > 20) {
                        preset.spawnTimer = 0;
                        preset.shapes.push({
                            scale: maxSize,
                            rotation: preset.shapes.length > 0
                                ? preset.shapes[preset.shapes.length - 1].rotation + 0.12
                                : 0,
                            hue: (p.frameCount * 2 + Math.random() * 30) % 360,
                            type: Math.floor(Math.random() * 3), // 0=square, 1=circle, 2=hexagon
                        });
                    }

                    // Update and draw shapes (back to front: largest first)
                    p.noFill();
                    let w = 0;
                    for (let i = 0; i < preset.shapes.length; i++) {
                        const s = preset.shapes[i];

                        // Shrink toward center
                        s.scale *= 1 - 0.008 * speedMult;
                        s.rotation += 0.003 * speedMult;

                        if (s.scale < 2) {
                            continue;
                        }

                        preset.shapes[w++] = s;

                        const t = 1 - s.scale / maxSize;
                        const alpha = t < 0.1 ? t * 10 * 70 : t > 0.9 ? (1 - t) * 10 * 70 : 70;
                        const weight = p.map(s.scale, 2, maxSize, 0.5, 4);
                        const sat = p.lerp(40, 90, preset.audio.bass);

                        p.stroke(s.hue, sat, 90, alpha);
                        p.strokeWeight(weight * (1 + preset.beatPulse * 2));

                        p.push();
                        p.translate(cx, cy);
                        p.rotate(s.rotation);

                        const half = s.scale / 2;
                        if (s.type === 0) {
                            // Square
                            p.rectMode(p.CENTER);
                            p.rect(0, 0, s.scale, s.scale);
                        } else if (s.type === 1) {
                            // Circle
                            p.ellipse(0, 0, s.scale, s.scale);
                        } else {
                            // Hexagon
                            p.beginShape();
                            for (let a = 0; a < 6; a++) {
                                const angle = p.TWO_PI / 6 * a - p.HALF_PI;
                                p.vertex(Math.cos(angle) * half, Math.sin(angle) * half);
                            }
                            p.endShape(p.CLOSE);
                        }

                        p.pop();
                    }
                    preset.shapes.length = w;

                    // Beat flash at center
                    if (preset.beatPulse > 0) {
                        const flashSize = preset.beatPulse * 150;
                        p.noStroke();
                        p.fill(0, 0, 100, preset.beatPulse * 30);
                        p.ellipse(cx, cy, flashSize, flashSize);
                        preset.beatPulse *= 0.88;
                        if (preset.beatPulse < 0.01) preset.beatPulse = 0;
                    }

                    // Keep array bounded
                    if (preset.shapes.length > 80) {
                        preset.shapes.splice(0, preset.shapes.length - 80);
                    }
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                    p.background(0);
                };
            }, container);
        }

        _initShapes(p) {
            this.shapes = [];
            const maxSize = Math.max(p.width, p.height) * 1.6;
            for (let i = 0; i < 20; i++) {
                this.shapes.push({
                    scale: maxSize * (i / 20),
                    rotation: i * 0.12,
                    hue: (i * 18) % 360,
                    type: i % 3,
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

    window.VJamFX.presets['infinite-zoom'] = InfiniteZoomPreset;
})();
