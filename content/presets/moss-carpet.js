(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MossCarpetPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.particles = [];
    }

    setup(container) {
        this.destroy();
        this.particles = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(0);
                for (let i = 0; i < 200; i++) {
                    preset._addParticle(p);
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                // Very slow fade for mossy accumulation
                pg.fill(0, 0, 0, 1.5);
                pg.noStroke();
                pg.rect(0, 0, pg.width, pg.height);

                const t = p.frameCount * 0.004 * speed;

                for (let i = 0; i < preset.particles.length; i++) {
                    const pt = preset.particles[i];

                    // Noise flow field
                    const nx = pt.x * 0.003 + pt.seed * 0.1;
                    const ny = pt.y * 0.003 + pt.seed * 0.1;
                    const angle = p.noise(nx, ny, t) * p.TWO_PI * 2;
                    const fieldSpeed = p.noise(nx + 100, ny + 100, t) * 1.5 + 0.3;

                    const prevX = pt.x;
                    const prevY = pt.y;
                    pt.x += Math.cos(angle) * fieldSpeed * speed * (1 + pulse * 2);
                    pt.y += Math.sin(angle) * fieldSpeed * speed * (1 + pulse * 2);
                    pt.life -= 0.001;

                    // Draw moss deposit — glow layer then core
                    const hue = (pt.hue + preset.audio.mid * 15) % 360;
                    const sat = 40 + pt.satVar;
                    const bri = 25 + pt.life * 30 + preset.audio.bass * 10;
                    const alpha = 15 + pt.life * 20;

                    // Glow
                    pg.strokeWeight(pt.size * 2.5);
                    pg.stroke(hue, sat, bri * 0.6, alpha * 0.3);
                    pg.line(prevX, prevY, pt.x, pt.y);

                    // Core
                    pg.strokeWeight(pt.size);
                    pg.stroke(hue, sat, bri, alpha);
                    pg.line(prevX, prevY, pt.x, pt.y);

                    // Spore dots at intervals
                    if (p.frameCount % 8 === 0 && Math.random() < 0.03) {
                        pg.noStroke();
                        pg.fill((hue + 30) % 360, 30, bri + 15, alpha * 1.2);
                        const dotSize = 1 + Math.random() * 2.5;
                        pg.ellipse(pt.x + (Math.random() - 0.5) * 6, pt.y + (Math.random() - 0.5) * 6, dotSize, dotSize);
                    }

                    // Recycle off-screen or dead particles
                    if (pt.x < -20 || pt.x > p.width + 20 || pt.y < -20 || pt.y > p.height + 20 || pt.life <= 0) {
                        preset._resetParticle(pt, p);
                    }
                }

                // Ambient moisture spots
                if (p.frameCount % 12 === 0) {
                    const mx = Math.random() * p.width;
                    const my = Math.random() * p.height;
                    const mHue = 100 + Math.random() * 40;
                    pg.noStroke();
                    pg.fill(mHue, 25, 20, 8);
                    pg.ellipse(mx, my, 8 + Math.random() * 15, 8 + Math.random() * 15);
                }

                // Beat: spawn extra bright cluster
                if (pulse > 0.3) {
                    const cx = Math.random() * p.width;
                    const cy = Math.random() * p.height;
                    for (let j = 0; j < 5; j++) {
                        pg.noStroke();
                        pg.fill(110 + Math.random() * 30, 50, 50, 30);
                        pg.ellipse(cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 40, 4 + Math.random() * 6, 4 + Math.random() * 6);
                    }
                }

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

    _addParticle(p) {
        const pt = {
            x: Math.random() * p.width,
            y: Math.random() * p.height,
            hue: 95 + Math.random() * 60,
            satVar: Math.random() * 25,
            size: 0.8 + Math.random() * 2,
            life: 0.5 + Math.random() * 0.5,
            seed: Math.random() * 100,
        };
        this.particles.push(pt);
        return pt;
    }

    _resetParticle(pt, p) {
        pt.x = Math.random() * p.width;
        pt.y = Math.random() * p.height;
        pt.life = 0.5 + Math.random() * 0.5;
        pt.hue = 95 + Math.random() * 60;
        pt.satVar = Math.random() * 25;
        pt.seed = Math.random() * 100;
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
window.VJamFX.presets['moss-carpet'] = MossCarpetPreset;
})();
