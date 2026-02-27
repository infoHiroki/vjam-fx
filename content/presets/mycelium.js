(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MyceliumPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.tips = [];
        this.nodes = [];
    }

    setup(container) {
        this.destroy();
        this.tips = [];
        this.nodes = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(p.width, p.height);
                pg.background(0);
                // Seed multiple origin points spread across screen
                for (let i = 0; i < 5; i++) {
                    const cx = p.width * (0.2 + Math.random() * 0.6);
                    const cy = p.height * (0.2 + Math.random() * 0.6);
                    preset.nodes.push({ x: cx, y: cy });
                    for (let j = 0; j < 6; j++) {
                        const angle = (j / 6) * p.TWO_PI + Math.random() * 0.3;
                        preset.tips.push({
                            x: cx, y: cy, angle,
                            life: 1, speed: 1.2 + Math.random() * 0.6,
                            thickness: 1.5 + Math.random() * 1.0,
                            depth: 0,
                        });
                    }
                }
            };

            p.draw = () => {
                p.background(0);
                const speed = preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.91;

                // Gentle fade for trails
                pg.fill(0, 0, 0, 3);
                pg.noStroke();
                pg.rect(0, 0, pg.width, pg.height);

                const stepsPerFrame = pulse > 0.3 ? 5 : 3;

                for (let step = 0; step < stepsPerFrame; step++) {
                    const newTips = [];
                    for (let i = preset.tips.length - 1; i >= 0; i--) {
                        const tip = preset.tips[i];
                        const prevX = tip.x;
                        const prevY = tip.y;

                        // Organic wandering via noise
                        const n = p.noise(tip.x * 0.004, tip.y * 0.004, p.frameCount * 0.003 * speed);
                        tip.angle += (n - 0.5) * 0.5;
                        tip.x += Math.cos(tip.angle) * tip.speed * speed;
                        tip.y += Math.sin(tip.angle) * tip.speed * speed;
                        tip.life -= 0.0015;

                        const w = Math.max(0.3, tip.thickness * tip.life);
                        const alpha = Math.max(15, tip.life * 180);
                        const brightness = 170 + preset.audio.mid * 60;

                        // Glow layer
                        pg.strokeWeight(w * 3);
                        pg.stroke(brightness, brightness * 0.9, brightness * 0.7, alpha * 0.12);
                        pg.line(prevX, prevY, tip.x, tip.y);

                        // Main hypha strand
                        pg.strokeWeight(w);
                        pg.stroke(brightness, brightness * 0.95, brightness * 0.8, alpha);
                        pg.line(prevX, prevY, tip.x, tip.y);

                        // Branching — more frequent for denser network
                        const branchChance = 0.025 + pulse * 0.04;
                        if (Math.random() < branchChance && tip.depth < 5 && tip.life > 0.2) {
                            const bAngle = tip.angle + (Math.random() > 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.6);
                            newTips.push({
                                x: tip.x, y: tip.y, angle: bAngle,
                                life: tip.life * 0.85,
                                speed: tip.speed * 0.9,
                                thickness: w * 0.7,
                                depth: tip.depth + 1,
                            });
                        }

                        // Fine sub-branches for density
                        if (Math.random() < 0.015 && tip.depth < 6 && tip.life > 0.15) {
                            const sAngle = tip.angle + (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.8);
                            newTips.push({
                                x: tip.x, y: tip.y, angle: sAngle,
                                life: tip.life * 0.5,
                                speed: tip.speed * 0.6,
                                thickness: Math.max(0.3, w * 0.4),
                                depth: tip.depth + 2,
                            });
                        }

                        // Connection nodes — bright dots where hyphae meet
                        if (tip.life > 0.3 && Math.random() < 0.008) {
                            preset.nodes.push({ x: tip.x, y: tip.y });
                            pg.noStroke();
                            pg.fill(220, 230, 200, 140);
                            pg.ellipse(tip.x, tip.y, 3 + w * 1.5);
                            // Glow around node
                            pg.fill(200, 210, 180, 40);
                            pg.ellipse(tip.x, tip.y, 8 + w * 2);
                        }

                        // Kill off-screen or dead
                        if (tip.life <= 0 || tip.x < -20 || tip.x > p.width + 20 || tip.y < -20 || tip.y > p.height + 20) {
                            preset.tips.splice(i, 1);
                            continue;
                        }
                    }

                    for (const t of newTips) {
                        preset.tips.push(t);
                    }
                }

                // Draw node-to-node connections periodically (network effect)
                if (p.frameCount % 30 === 0 && preset.nodes.length > 2) {
                    pg.strokeWeight(0.5);
                    const connBri = 140 + preset.audio.treble * 50;
                    pg.stroke(connBri, connBri * 0.9, connBri * 0.7, 25);
                    for (let i = 0; i < Math.min(8, preset.nodes.length); i++) {
                        const a = preset.nodes[Math.floor(Math.random() * preset.nodes.length)];
                        const b = preset.nodes[Math.floor(Math.random() * preset.nodes.length)];
                        const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
                        if (dist < 200 && dist > 20) {
                            pg.line(a.x, a.y, b.x, b.y);
                        }
                    }
                }

                // Cap tips
                if (preset.tips.length > 400) {
                    // Remove oldest/deepest first
                    preset.tips.sort((a, b) => a.life - b.life);
                    preset.tips.splice(0, preset.tips.length - 350);
                }

                // Cap nodes
                if (preset.nodes.length > 200) {
                    preset.nodes.splice(0, preset.nodes.length - 150);
                }

                // Continuously spawn new growth points
                if (p.frameCount % 60 === 0) {
                    const cx = p.width * (0.1 + Math.random() * 0.8);
                    const cy = p.height * (0.1 + Math.random() * 0.8);
                    preset.nodes.push({ x: cx, y: cy });
                    for (let j = 0; j < 4; j++) {
                        const angle = Math.random() * p.TWO_PI;
                        preset.tips.push({
                            x: cx, y: cy, angle,
                            life: 1, speed: 1.0 + Math.random() * 0.8,
                            thickness: 1.2 + Math.random() * 0.8,
                            depth: 0,
                        });
                    }
                }

                // Beat: explosive growth burst from multiple points
                if (pulse > 0.3) {
                    const burstCount = 3;
                    for (let b = 0; b < burstCount; b++) {
                        let cx, cy;
                        if (preset.nodes.length > 0 && Math.random() < 0.7) {
                            // Grow from existing node
                            const node = preset.nodes[Math.floor(Math.random() * preset.nodes.length)];
                            cx = node.x;
                            cy = node.y;
                        } else {
                            cx = p.width * (0.15 + Math.random() * 0.7);
                            cy = p.height * (0.15 + Math.random() * 0.7);
                        }
                        preset.nodes.push({ x: cx, y: cy });
                        // Bright flash at burst origin
                        pg.noStroke();
                        pg.fill(255, 255, 220, 60);
                        pg.ellipse(cx, cy, 10 + pulse * 15);
                        for (let j = 0; j < 6; j++) {
                            const angle = (j / 6) * p.TWO_PI + Math.random() * 0.5;
                            preset.tips.push({
                                x: cx, y: cy, angle,
                                life: 1, speed: 1.5 + Math.random() * 1.0,
                                thickness: 1.5 + Math.random() * 1.0,
                                depth: 0,
                            });
                        }
                    }
                }

                // If no tips, reseed everywhere
                if (preset.tips.length === 0) {
                    for (let i = 0; i < 6; i++) {
                        const cx = p.width * (0.15 + Math.random() * 0.7);
                        const cy = p.height * (0.15 + Math.random() * 0.7);
                        preset.nodes.push({ x: cx, y: cy });
                        for (let j = 0; j < 5; j++) {
                            const angle = (j / 5) * p.TWO_PI;
                            preset.tips.push({
                                x: cx, y: cy, angle,
                                life: 1, speed: 1.3 + Math.random() * 0.5,
                                thickness: 1.3 + Math.random() * 0.8,
                                depth: 0,
                            });
                        }
                    }
                }

                p.image(pg, 0, 0);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                const oldPg = pg;
                if (pg) pg.remove();
                pg = p.createGraphics(p.width, p.height);
                pg.image(oldPg, 0, 0, p.width, p.height);
                oldPg.remove();
            };
        }, container);
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['mycelium'] = MyceliumPreset;
})();
