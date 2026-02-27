(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class WaterfallMistPreset extends BasePreset {
    constructor() {
        super();
        this.params = {};
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.waterDrops = [];
        this.mistParticles = [];
        this.pg = null;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                preset.pg = p.createGraphics(p.width, p.height);
                preset.pg.colorMode(preset.pg.HSB, 360, 100, 100, 100);
                preset.pg.background(0, 0, 3);
                preset.waterDrops = [];
                preset.mistParticles = [];

                for (let i = 0; i < 200; i++) {
                    preset._addWaterDrop(p);
                }
            };

            preset._addWaterDrop = (p) => {
                const fallZone = p.width * 0.35;
                preset.waterDrops.push({
                    x: p.width * 0.1 + Math.random() * fallZone * 0.8,
                    y: Math.random() * p.height * 0.4,
                    vy: 2 + Math.random() * 4,
                    vx: 0,
                    size: 1.5 + Math.random() * 2.5,
                    isMist: false
                });
            };

            preset._spawnMist = (p, x, y) => {
                if (preset.mistParticles.length > 80) return;
                preset.mistParticles.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.3) * 3,
                    vy: -0.5 - Math.random() * 1.5,
                    size: 8 + Math.random() * 20,
                    alpha: 15 + Math.random() * 10,
                    life: 1
                });
            };

            p.draw = () => {
                const t = p.frameCount * 0.005;
                preset.beatPulse *= 0.92;

                // Fade pg
                preset.pg.noStroke();
                preset.pg.fill(0, 0, 3, 8);
                preset.pg.rect(0, 0, preset.pg.width, preset.pg.height);

                p.background(210, 25, 6, 100);

                const baseY = p.height * 0.65; // Where water hits rock
                const fallZone = p.width * 0.35;

                // Rock silhouette
                p.noStroke();
                p.fill(210, 15, 8, 100);
                p.beginShape();
                p.vertex(0, p.height);
                p.vertex(0, baseY + 20);
                p.vertex(p.width * 0.08, baseY);
                p.vertex(p.width * 0.15, baseY - 15);
                p.vertex(p.width * 0.2, baseY + 5);
                p.vertex(p.width * 0.35, baseY + 10);
                p.vertex(p.width * 0.45, baseY - 5);
                p.vertex(p.width * 0.5, baseY + 20);
                p.vertex(p.width * 0.7, baseY + 40);
                p.vertex(p.width, baseY + 60);
                p.vertex(p.width, p.height);
                p.endShape(p.CLOSE);

                // Cliff face on left
                p.fill(215, 18, 10, 100);
                p.beginShape();
                p.vertex(0, 0);
                p.vertex(p.width * 0.08, 0);
                p.vertex(p.width * 0.1, baseY * 0.3);
                p.vertex(p.width * 0.07, baseY);
                p.vertex(0, baseY + 20);
                p.endShape(p.CLOSE);

                // Water drops
                p.stroke(200, 30, 80, 35);
                p.strokeWeight(1.5);
                for (const d of preset.waterDrops) {
                    d.vy += 0.15; // gravity
                    d.x += d.vx + p.noise(d.x * 0.01, t) * 0.5 - 0.25;
                    d.y += d.vy + preset.audio.bass * 2;

                    if (d.y > baseY - 10 + Math.random() * 20) {
                        // Hit base — spawn mist
                        preset._spawnMist(p, d.x, baseY);
                        // Reset drop
                        d.x = p.width * 0.1 + Math.random() * fallZone * 0.8;
                        d.y = -Math.random() * 30;
                        d.vy = 2 + Math.random() * 4;
                        d.vx = 0;
                    }

                    p.line(d.x, d.y, d.x + d.vx * 0.3, d.y + d.size * 2);
                }

                // Draw water trail accumulation on pg
                preset.pg.stroke(200, 25, 55, 3);
                preset.pg.strokeWeight(2);
                for (let i = 0; i < 8; i++) {
                    const wx = p.width * 0.1 + Math.random() * fallZone * 0.8;
                    const wy = Math.random() * baseY;
                    preset.pg.line(wx, wy, wx + Math.random() * 3 - 1.5, wy + 10 + Math.random() * 20);
                }
                p.image(preset.pg, 0, 0);

                // Mist particles
                p.noStroke();
                for (let i = preset.mistParticles.length - 1; i >= 0; i--) {
                    const m = preset.mistParticles[i];
                    m.x += m.vx;
                    m.y += m.vy;
                    m.life -= 0.008;
                    m.vx *= 0.99;
                    m.vy *= 0.995;
                    m.size += 0.3;

                    if (m.life <= 0) {
                        preset.mistParticles.splice(i, 1);
                        continue;
                    }

                    const alpha = m.alpha * m.life;
                    p.fill(195, 15, 80, alpha);
                    p.ellipse(m.x, m.y, m.size * 1.5, m.size);
                }

                // Pool shimmer at base
                for (let i = 0; i < 3; i++) {
                    const sx = p.width * 0.3 + Math.random() * p.width * 0.3;
                    const sy = baseY + 10 + Math.random() * 30;
                    p.fill(200, 20, 50, 5 + preset.audio.rms * 8);
                    p.ellipse(sx, sy, 20 + Math.random() * 40, 4);
                }

                p.noStroke();
            };

            p.windowResized = () => {
                const oldPg = preset.pg;
                preset.pg = p.createGraphics(p.width, p.height);
                preset.pg.colorMode(preset.pg.HSB, 360, 100, 100, 100);
                preset.pg.image(oldPg, 0, 0);
                oldPg.remove();
                p.resizeCanvas(container.clientWidth, container.clientHeight);
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
        // Surge of water
        if (this.p5) {
            for (let i = 0; i < 15; i++) {
                this._addWaterDrop(this.p5);
            }
        }
    }

    _addWaterDrop(p) {
        if (!p) return;
        const fallZone = p.width * 0.35;
        this.waterDrops.push({
            x: p.width * 0.1 + Math.random() * fallZone * 0.8,
            y: -Math.random() * 20,
            vy: 4 + Math.random() * 6,
            vx: 0,
            size: 1.5 + Math.random() * 2.5,
            isMist: false
        });
        // Cap water drops
        if (this.waterDrops.length > 300) {
            this.waterDrops.splice(0, this.waterDrops.length - 250);
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['waterfall-mist'] = WaterfallMistPreset;
})();
