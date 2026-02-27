(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class RiverStreamPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.particles = [];
        this.ripples = [];
    }

    setup(container) {
        this.destroy();
        this.particles = [];
        this.ripples = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(0);
                for (let i = 0; i < 180; i++) {
                    preset._addParticle(p);
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;
                const t = p.frameCount * 0.005 * speed;

                // Fade — bass makes trails longer (slower fade)
                const fadeAlpha = Math.max(1, 4 - bass * 2);
                pg.fill(0, 0, 0, fadeAlpha);
                pg.noStroke();
                pg.rect(0, 0, pg.width, pg.height);

                const centerY = pg.height * 0.5;
                const riverHalf = pg.height * 0.35;

                // Flow speed reacts to bass
                const flowMult = 1 + bass * 1.5 + pulse * 2;
                // Wave height reacts to mid
                const waveMult = 1 + mid * 2.5;

                for (let i = 0; i < preset.particles.length; i++) {
                    const pt = preset.particles[i];
                    const prevX = pt.x;
                    const prevY = pt.y;

                    const distFromCenter = Math.abs(pt.y - centerY) / riverHalf;
                    const speedFactor = Math.max(0.1, 1 - distFromCenter * distFromCenter);

                    // Noise-driven flow
                    const nx = pt.x * 0.004 + pt.seed;
                    const ny = pt.y * 0.006;
                    const noiseAngle = (p.noise(nx, ny, t) - 0.5) * (0.6 + mid * 0.8);

                    const baseSpeed = (1.5 + speedFactor * 2.5) * speed * flowMult;
                    pt.x += baseSpeed + Math.cos(noiseAngle) * 0.6;
                    pt.y += Math.sin(noiseAngle) * speedFactor * waveMult * 1.5;

                    // Soft bounds
                    if (pt.y < centerY - riverHalf) pt.y = centerY - riverHalf + Math.random() * 5;
                    if (pt.y > centerY + riverHalf) pt.y = centerY + riverHalf - Math.random() * 5;

                    // Color: hue shifts with mid, brightness with bass
                    const hue = (195 + pt.hueOff + mid * 15) % 360;
                    const sat = 30 + speedFactor * 25 + treble * 10;
                    const bri = 18 + speedFactor * 30 + bass * 15 + pulse * 10;
                    const alpha = 12 + speedFactor * 22 + bass * 8;

                    // Glow trail
                    pg.strokeWeight(pt.size * 2.8);
                    pg.stroke(hue, sat * 0.6, bri * 0.5, alpha * 0.25);
                    pg.line(prevX, prevY, pt.x, pt.y);

                    // Core trail
                    pg.strokeWeight(pt.size);
                    pg.stroke(hue, sat, bri, alpha);
                    pg.line(prevX, prevY, pt.x, pt.y);

                    // Recycle
                    if (pt.x > pg.width + 10) {
                        preset._resetParticle(pt, p);
                    }
                }

                // Treble sparkles on water surface
                const sparkleCount = 2 + Math.floor(treble * 10) + Math.floor(pulse * 6);
                pg.noStroke();
                for (let s = 0; s < sparkleCount; s++) {
                    const sx = Math.random() * pg.width;
                    const sy = centerY + (Math.random() - 0.5) * riverHalf * 1.6;
                    const sparkleAlpha = 15 + treble * 30 + pulse * 15;
                    const sparkleSize = 0.8 + Math.random() * 1.5 + treble * 1.5;

                    // Outer glow
                    pg.fill(190 + Math.random() * 20, 8, 75, sparkleAlpha * 0.35);
                    pg.ellipse(sx, sy, sparkleSize * 3, sparkleSize * 3);
                    // Bright core
                    pg.fill(195, 5, 90, sparkleAlpha);
                    pg.ellipse(sx, sy, sparkleSize, sparkleSize);
                }

                // Beat ripple bursts
                for (let i = preset.ripples.length - 1; i >= 0; i--) {
                    const rip = preset.ripples[i];
                    rip.size += 2 + bass * 2;
                    rip.alpha -= 1.5;
                    if (rip.alpha <= 0) {
                        preset.ripples.splice(i, 1);
                        continue;
                    }
                    pg.noFill();
                    pg.strokeWeight(1.2);
                    pg.stroke(200, 20, 50, rip.alpha);
                    pg.ellipse(rip.x, rip.y, rip.size, rip.size * 0.45);
                    pg.stroke(195, 15, 40, rip.alpha * 0.5);
                    pg.ellipse(rip.x, rip.y, rip.size * 1.6, rip.size * 0.7);
                }

                // River bank edges
                pg.noStroke();
                for (let e = 0; e < 4; e++) {
                    const edgeAlpha = 6 - e;
                    const topY = centerY - riverHalf - 4 + e * 3;
                    const botY = centerY + riverHalf + 4 - e * 3;
                    pg.fill(160, 30, 8, edgeAlpha);
                    pg.rect(0, topY, pg.width, 3);
                    pg.rect(0, botY, pg.width, 3);
                }

                // Periodic ripples (autonomous + beat)
                if (p.frameCount % 25 === 0) {
                    preset.ripples.push({
                        x: Math.random() * pg.width,
                        y: centerY + (Math.random() - 0.5) * riverHalf,
                        size: 5 + Math.random() * 10,
                        alpha: 25
                    });
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
            y: p.height * (0.2 + Math.random() * 0.6),
            size: 0.6 + Math.random() * 1.8,
            hueOff: Math.random() * 20 - 10,
            seed: Math.random() * 100,
        };
        this.particles.push(pt);
        return pt;
    }

    _resetParticle(pt, p) {
        pt.x = -5;
        pt.y = p.height * (0.2 + Math.random() * 0.6);
        pt.seed = Math.random() * 100;
        pt.hueOff = Math.random() * 20 - 10;
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        // Burst of ripples on beat
        if (this.p5) {
            const p = this.p5;
            const centerY = p.height * 0.5;
            const riverHalf = p.height * 0.35;
            const count = 3 + Math.floor(strength * 4);
            for (let i = 0; i < count; i++) {
                this.ripples.push({
                    x: Math.random() * p.width,
                    y: centerY + (Math.random() - 0.5) * riverHalf,
                    size: 8 + Math.random() * 15,
                    alpha: 30 + strength * 15
                });
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['river-stream'] = RiverStreamPreset;
})();
