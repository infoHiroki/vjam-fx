(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class DeepDivePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.bubbles = [];
        this.fish = [];
    }

    setup(container) {
        this.destroy();
        this.bubbles = [];
        this.fish = [];
        const preset = this;

        this.p5 = new p5((p) => {
            // Light ray parameters — defined once, animated every frame
            const rays = [];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);

                // Create light rays with individual movement properties
                for (let i = 0; i < 7; i++) {
                    rays.push({
                        baseX: p.width * (0.1 + i * 0.12),
                        width: 15 + Math.random() * 25,
                        phase: Math.random() * Math.PI * 2,
                        swaySpeed: 0.3 + Math.random() * 0.4,
                        swayAmount: 30 + Math.random() * 50,
                        alpha: 4 + Math.random() * 4,
                        length: 0.5 + Math.random() * 0.4,
                        pulsePhase: Math.random() * Math.PI * 2,
                    });
                }

                // A few fish silhouettes
                for (let i = 0; i < 4; i++) {
                    preset.fish.push({
                        x: Math.random() * p.width,
                        y: p.height * (0.25 + Math.random() * 0.5),
                        speed: 0.4 + Math.random() * 0.8,
                        dir: Math.random() > 0.5 ? 1 : -1,
                        size: 8 + Math.random() * 12,
                        tailPhase: Math.random() * Math.PI * 2,
                        depth: 0.3 + Math.random() * 0.7,
                    });
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.01 * speed;
                preset.beatPulse *= 0.88;

                // Black background for screen blend
                p.background(0);

                // Subtle deep ocean gradient
                p.noStroke();
                for (let y = 0; y < 4; y++) {
                    const yy = y / 4;
                    const bri = p.lerp(8, 2, yy);
                    p.fill(210, 70, bri, 100);
                    p.rect(0, p.height * yy, p.width, p.height * 0.26);
                }

                // Animated light rays from surface — swaying, pulsing
                for (const ray of rays) {
                    const sway = Math.sin(t * ray.swaySpeed + ray.phase) * ray.swayAmount;
                    const pulse = 0.7 + Math.sin(t * 0.4 + ray.pulsePhase) * 0.3;
                    const beatBoost = 1 + preset.beatPulse * 0.8;
                    const rayX = ray.baseX + sway;
                    const rw = ray.width * pulse * beatBoost;
                    const rayLen = p.height * ray.length;
                    const alpha = ray.alpha * pulse * beatBoost + preset.audio.treble * 4;

                    // Each ray is a tapered quad with soft edges
                    // Outer glow
                    p.noStroke();
                    p.fill(195, 25, 80, alpha * 0.4);
                    p.beginShape();
                    p.vertex(rayX - rw * 0.6, 0);
                    p.vertex(rayX + rw * 0.6, 0);
                    p.vertex(rayX + sway * 0.3 + rw * 2.5, rayLen);
                    p.vertex(rayX + sway * 0.3 - rw * 2, rayLen);
                    p.endShape(p.CLOSE);

                    // Inner core — brighter
                    p.fill(190, 15, 90, alpha * 0.7);
                    p.beginShape();
                    p.vertex(rayX - rw * 0.2, 0);
                    p.vertex(rayX + rw * 0.2, 0);
                    p.vertex(rayX + sway * 0.3 + rw * 0.8, rayLen * 0.8);
                    p.vertex(rayX + sway * 0.3 - rw * 0.5, rayLen * 0.8);
                    p.endShape(p.CLOSE);
                }

                // Fish silhouettes — simple, dark shapes moving through
                for (const f of preset.fish) {
                    f.x += f.speed * f.dir * speed;
                    f.tailPhase += 0.08 * speed;

                    // Wrap around
                    if (f.dir > 0 && f.x > p.width + 30) f.x = -30;
                    if (f.dir < 0 && f.x < -30) f.x = p.width + 30;

                    const sz = f.size;
                    const tailWag = Math.sin(f.tailPhase) * sz * 0.3;
                    const alpha = 15 + f.depth * 15;

                    p.push();
                    p.translate(f.x, f.y + Math.sin(t * 0.5 + f.tailPhase) * 5);
                    p.scale(f.dir, 1);

                    // Body
                    p.noStroke();
                    p.fill(210, 50, 30, alpha);
                    p.beginShape();
                    p.vertex(sz, 0);
                    p.bezierVertex(sz * 0.5, -sz * 0.35, -sz * 0.2, -sz * 0.25, -sz * 0.5, 0);
                    p.bezierVertex(-sz * 0.2, sz * 0.25, sz * 0.5, sz * 0.35, sz, 0);
                    p.endShape(p.CLOSE);

                    // Tail
                    p.beginShape();
                    p.vertex(-sz * 0.5, 0);
                    p.vertex(-sz * 0.9, -sz * 0.25 + tailWag * 0.5);
                    p.vertex(-sz * 0.9, sz * 0.25 + tailWag * 0.5);
                    p.endShape(p.CLOSE);

                    p.pop();
                }

                // Bubbles rising — kept and enhanced
                for (let i = preset.bubbles.length - 1; i >= 0; i--) {
                    const b = preset.bubbles[i];
                    b.y -= b.speed * speed;
                    b.x += Math.sin(t * 3 + b.phase) * 0.6;
                    // Bubbles grow slightly as they rise (pressure decrease)
                    b.size += 0.003;

                    if (b.y < -20) {
                        preset.bubbles.splice(i, 1);
                        continue;
                    }

                    // Bubble outline
                    p.noFill();
                    p.stroke(190, 25, 75, 45);
                    p.strokeWeight(0.8);
                    p.ellipse(b.x, b.y, b.size);

                    // Highlight reflection
                    p.noStroke();
                    p.fill(190, 10, 100, 35);
                    p.ellipse(b.x - b.size * 0.2, b.y - b.size * 0.2, b.size * 0.25);

                    // Subtle inner glow
                    p.fill(195, 20, 80, 10);
                    p.ellipse(b.x, b.y, b.size * 0.7);
                }

                // Spawn bubbles — steady stream + more on beat
                const spawnRate = preset.beatPulse > 0.3 ? 3 : 10;
                if (p.frameCount % spawnRate === 0 && preset.bubbles.length < 30) {
                    const count = preset.beatPulse > 0.3 ? 3 : 1;
                    for (let n = 0; n < count; n++) {
                        preset.bubbles.push({
                            x: p.width * (0.2 + Math.random() * 0.6),
                            y: p.height + 10,
                            size: 3 + Math.random() * 10,
                            speed: 0.6 + Math.random() * 1.2,
                            phase: Math.random() * 100,
                        });
                    }
                }

                // Beat: flash of light from surface
                if (preset.beatPulse > 0.1) {
                    p.noStroke();
                    p.fill(195, 15, 100, preset.beatPulse * 20);
                    p.rect(0, 0, p.width, p.height * 0.2 * preset.beatPulse);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                // Reposition rays
                for (let i = 0; i < rays.length; i++) {
                    rays[i].baseX = p.width * (0.1 + i * 0.12);
                }
            };
        }, container);
    }

    updateAudio(ad) {
        this.audio.bass = ad.bass || 0;
        this.audio.mid = ad.mid || 0;
        this.audio.treble = ad.treble || 0;
        this.audio.rms = ad.rms || 0;
        this.audio.strength = ad.strength || 0;
    }

    onBeat(s) {
        this.beatPulse = s;
    }
}

window.VJamFX.presets['deep-dive'] = DeepDivePreset;
})();
