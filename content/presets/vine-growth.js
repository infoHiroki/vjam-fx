(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class VineGrowthPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.vines = [];
    }

    setup(container) {
        this.destroy();
        this.vines = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(0);
                // Many initial vines from all edges
                for (let i = 0; i < 20; i++) {
                    preset._addVine(p);
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.93;

                // Slow fade
                pg.fill(0, 0, 0, 3);
                pg.noStroke();
                pg.rect(0, 0, pg.width, pg.height);

                const growSteps = pulse > 0.3 ? 6 : 3;

                for (let step = 0; step < growSteps; step++) {
                    for (let i = preset.vines.length - 1; i >= 0; i--) {
                        const v = preset.vines[i];
                        if (!v.growing) continue;

                        const prevX = v.x;
                        const prevY = v.y;

                        // Curl with Perlin noise
                        const noiseVal = p.noise(v.x * 0.004, v.y * 0.004, p.frameCount * 0.003 * speed + v.seed);
                        v.angle += (noiseVal - 0.5) * 0.25 + v.curlBias * 0.04;
                        v.x += Math.cos(v.angle) * v.speed * speed;
                        v.y += Math.sin(v.angle) * v.speed * speed;
                        v.segments++;
                        v.life -= 0.002;

                        // Draw vine segment — thicker main stems
                        const thickness = Math.max(0.8, v.thickness * v.life);
                        const hue = (120 + v.hueShift + preset.audio.mid * 25) % 360;
                        const sat = 50 + v.life * 30;
                        const bri = 30 + v.life * 50;
                        const alpha = Math.max(15, v.life * 85);

                        // Main vine stroke
                        pg.strokeWeight(thickness);
                        pg.stroke(hue, sat, bri, alpha);
                        pg.line(prevX, prevY, v.x, v.y);

                        // Highlight on vine edge
                        if (thickness > 1.5) {
                            pg.strokeWeight(thickness * 0.3);
                            pg.stroke(hue, sat * 0.5, bri + 20, alpha * 0.4);
                            const nx = -Math.sin(v.angle) * thickness * 0.3;
                            const ny = Math.cos(v.angle) * thickness * 0.3;
                            pg.line(prevX + nx, prevY + ny, v.x + nx, v.y + ny);
                        }

                        // Leaf buds at regular intervals (more frequent)
                        if (v.segments % 12 === 0 && v.life > 0.25) {
                            preset._drawLeaf(pg, v, hue, alpha, thickness, p.frameCount);
                        }

                        // Small curling tendril at intervals
                        if (v.segments % 25 === 0 && v.life > 0.3 && v.depth < 2) {
                            const tAngle = v.angle + (v.curlBias > 0 ? 1.2 : -1.2);
                            let tx = v.x, ty = v.y;
                            pg.strokeWeight(0.6);
                            pg.stroke(hue, 40, 50, alpha * 0.5);
                            pg.noFill();
                            pg.beginShape();
                            pg.vertex(tx, ty);
                            for (let s = 0; s < 8; s++) {
                                const curl = tAngle + s * 0.4 * v.curlBias;
                                tx += Math.cos(curl) * 3;
                                ty += Math.sin(curl) * 3;
                                pg.vertex(tx, ty);
                            }
                            pg.endShape();
                        }

                        // Random branching (more frequent)
                        if (Math.random() < 0.012 + pulse * 0.015 && v.depth < 4 && v.life > 0.25) {
                            const branchAngle = v.angle + (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.7);
                            preset.vines.push({
                                x: v.x, y: v.y,
                                angle: branchAngle,
                                speed: v.speed * 0.85,
                                thickness: thickness * 0.6,
                                hueShift: v.hueShift + (Math.random() - 0.5) * 15,
                                curlBias: -v.curlBias,
                                life: v.life * 0.75,
                                segments: 0,
                                depth: v.depth + 1,
                                growing: true,
                                seed: Math.random() * 1000,
                            });
                        }

                        // Stop when off-screen or life depleted
                        if (v.life <= 0 || v.x < -20 || v.x > p.width + 20 || v.y < -20 || v.y > p.height + 20) {
                            v.growing = false;
                        }
                    }
                }

                // Cleanup
                if (preset.vines.length > 500) {
                    preset.vines = preset.vines.filter(v => v.growing);
                }

                // Add new vines frequently
                if (p.frameCount % 20 === 0) {
                    for (let i = 0; i < 2; i++) {
                        preset._addVine(p);
                    }
                }

                // If few growing vines, seed more
                const growingCount = preset.vines.filter(v => v.growing).length;
                if (growingCount < 8) {
                    for (let i = 0; i < 6; i++) {
                        preset._addVine(p);
                    }
                }

                p.background(0);
                p.image(pg, 0, 0);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                const oldPg = pg;
                if (pg) pg.remove();
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.image(oldPg, 0, 0, p.width, p.height);
                oldPg.remove();
            };
        }, container);
    }

    _drawLeaf(pg, v, hue, alpha, thickness, frame) {
        pg.noStroke();
        const leafHue = (hue + 15 + Math.sin(frame * 0.05) * 10) % 360;
        const leafSize = 3 + thickness * 2;
        const side = v.segments % 24 < 12 ? 1 : -1;
        const leafAngle = v.angle + side * 1.0;
        const lx = v.x + Math.cos(leafAngle) * leafSize * 0.8;
        const ly = v.y + Math.sin(leafAngle) * leafSize * 0.8;

        // Leaf shape with pointed tip
        pg.fill(leafHue, 60, 55, alpha * 0.8);
        pg.push();
        pg.translate(lx, ly);
        pg.rotate(leafAngle);
        pg.beginShape();
        pg.vertex(0, 0);
        pg.bezierVertex(leafSize * 0.4, -leafSize * 0.3, leafSize * 0.8, -leafSize * 0.15, leafSize, 0);
        pg.bezierVertex(leafSize * 0.8, leafSize * 0.15, leafSize * 0.4, leafSize * 0.3, 0, 0);
        pg.endShape(pg.CLOSE);

        // Leaf vein
        pg.stroke(leafHue, 45, 40, alpha * 0.4);
        pg.strokeWeight(0.4);
        pg.line(0, 0, leafSize * 0.85, 0);
        pg.pop();

        // Small bud dot at leaf base
        pg.noStroke();
        pg.fill((leafHue + 30) % 360, 50, 70, alpha * 0.5);
        pg.ellipse(v.x, v.y, 2.5, 2.5);
    }

    _addVine(p) {
        const edge = Math.floor(Math.random() * 4);
        let x, y, angle;
        switch (edge) {
            case 0: // top
                x = Math.random() * p.width;
                y = 0;
                angle = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
                break;
            case 1: // bottom
                x = Math.random() * p.width;
                y = p.height;
                angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
                break;
            case 2: // left
                x = 0;
                y = Math.random() * p.height;
                angle = (Math.random() - 0.5) * 0.8;
                break;
            case 3: // right
                x = p.width;
                y = Math.random() * p.height;
                angle = Math.PI + (Math.random() - 0.5) * 0.8;
                break;
        }
        this.vines.push({
            x, y, angle,
            speed: 1.2 + Math.random() * 1.0,
            thickness: 3 + Math.random() * 4,
            hueShift: Math.random() * 40 - 20,
            curlBias: Math.random() > 0.5 ? 1 : -1,
            life: 1,
            segments: 0,
            depth: 0,
            growing: true,
            seed: Math.random() * 1000,
        });
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
window.VJamFX.presets['vine-growth'] = VineGrowthPreset;
})();
