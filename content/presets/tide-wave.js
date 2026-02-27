(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class TideWavePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.foamParticles = [];
    }

    setup(container) {
        this.destroy();
        this.foamParticles = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const waves = [];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(0);
                // Initialize 5 wave layers
                for (let i = 0; i < 5; i++) {
                    waves.push({
                        baseY: p.height * (0.3 + i * 0.12),
                        amp: 20 + i * 12,
                        freq: 0.005 - i * 0.0006,
                        phaseSpeed: 0.015 + i * 0.005,
                        hue: 195 + i * 4,
                        alpha: 22 - i * 2,
                    });
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.94;
                const t = p.frameCount * speed;

                // Trail fade
                pg.fill(0, 0, 0, 20);
                pg.noStroke();
                pg.rect(0, 0, pg.width, pg.height);

                // Draw each wave layer
                for (let w = waves.length - 1; w >= 0; w--) {
                    const wave = waves[w];
                    const ampMod = wave.amp * (1 + preset.audio.bass * 0.6 + pulse * 0.8);
                    const phase = t * wave.phaseSpeed;

                    // Wave shape with vertices
                    pg.beginShape();
                    pg.noStroke();
                    const hue = (wave.hue + preset.audio.mid * 8) % 360;
                    pg.fill(hue, 45 + w * 5, 30 + w * 5, wave.alpha);

                    pg.vertex(0, pg.height);
                    for (let x = 0; x <= pg.width; x += 4) {
                        const n = p.noise(x * 0.008, w * 10, t * 0.005);
                        const y = wave.baseY
                            + Math.sin(x * wave.freq + phase) * ampMod
                            + Math.sin(x * wave.freq * 2.3 + phase * 1.5) * ampMod * 0.3
                            + (n - 0.5) * 15;
                        pg.vertex(x, y);

                        // Detect crests for foam (where wave curves down)
                        if (w === 0 && x > 0 && x % 20 === 0) {
                            const yPrev = wave.baseY + Math.sin((x - 4) * wave.freq + phase) * ampMod;
                            const yNext = wave.baseY + Math.sin((x + 4) * wave.freq + phase) * ampMod;
                            if (y < yPrev && y < yNext && Math.random() < 0.15) {
                                preset.foamParticles.push({
                                    x: x + (Math.random() - 0.5) * 10,
                                    y: y - 2,
                                    vx: (Math.random() - 0.5) * 0.8,
                                    vy: -0.3 - Math.random() * 0.5,
                                    life: 1,
                                    size: 1.5 + Math.random() * 3,
                                });
                            }
                        }
                    }
                    pg.vertex(pg.width, pg.height);
                    pg.endShape(p.CLOSE);

                    // Wave crest highlight line
                    pg.noFill();
                    pg.strokeWeight(1.2);
                    pg.stroke(hue - 5, 30, 55 + w * 8, wave.alpha * 1.5);
                    pg.beginShape();
                    for (let x = 0; x <= pg.width; x += 6) {
                        const n = p.noise(x * 0.008, w * 10, t * 0.005);
                        const y = wave.baseY
                            + Math.sin(x * wave.freq + phase) * ampMod
                            + Math.sin(x * wave.freq * 2.3 + phase * 1.5) * ampMod * 0.3
                            + (n - 0.5) * 15;
                        pg.vertex(x, y);
                    }
                    pg.endShape();
                }

                // Update and draw foam particles
                for (let i = preset.foamParticles.length - 1; i >= 0; i--) {
                    const fp = preset.foamParticles[i];
                    fp.x += fp.vx;
                    fp.y += fp.vy;
                    fp.vy += 0.02;
                    fp.life -= 0.015;

                    if (fp.life <= 0) {
                        preset.foamParticles.splice(i, 1);
                        continue;
                    }

                    // Glow
                    pg.noStroke();
                    pg.fill(200, 15, 70, fp.life * 15);
                    pg.ellipse(fp.x, fp.y, fp.size * 2.5, fp.size * 2.5);
                    // Core
                    pg.fill(195, 10, 85, fp.life * 40);
                    pg.ellipse(fp.x, fp.y, fp.size, fp.size);
                }

                // Cap foam count
                if (preset.foamParticles.length > 150) {
                    preset.foamParticles.splice(0, 30);
                }

                // Sparkle on water surface
                if (p.frameCount % 3 === 0) {
                    for (let s = 0; s < 2; s++) {
                        const sx = Math.random() * pg.width;
                        const sy = waves[0].baseY + (Math.random() - 0.5) * 40;
                        pg.noStroke();
                        pg.fill(200, 10, 90, 25 + pulse * 20);
                        const ss = 1 + Math.random() * 2;
                        pg.ellipse(sx, sy, ss, ss);
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
                waves.forEach((w, i) => { w.baseY = p.height * (0.3 + i * 0.12); });
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
window.VJamFX.presets['tide-wave'] = TideWavePreset;
})();
