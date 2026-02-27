(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FungalWebPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.hyphae = [];       // growing filament tips
        this.spores = [];       // glowing spore nodes at junctions
        this.maxHyphae = 25;    // sparse: much fewer than before (was 60)
        this.maxSpores = 40;    // fewer nodes (was 120)
    }

    setup(container) {
        this.destroy();
        this.hyphae = [];
        this.spores = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg; // persistent trail layer

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(0);

                // Seed 3 origin points — sparse, spread apart
                for (let i = 0; i < 3; i++) {
                    preset._seedHypha(p);
                }
            };

            p.draw = () => {
                const t = p.frameCount;
                const speed = preset.params.speed;
                preset.beatPulse *= 0.9;

                // Very slow fade for long trails — mycelium persists
                pg.noStroke();
                pg.fill(0, 0, 0, 4 + preset.audio.bass * 3);
                pg.rect(0, 0, pg.width, pg.height);

                const bassBoost = 1 + preset.audio.bass * 1.5;

                // Grow each hypha tip
                for (let i = preset.hyphae.length - 1; i >= 0; i--) {
                    const h = preset.hyphae[i];
                    if (h.dead) {
                        preset.hyphae.splice(i, 1);
                        continue;
                    }

                    // 1-2 growth steps per frame — slow, organic
                    const steps = Math.ceil(1 + preset.beatPulse * 1.5);
                    for (let s = 0; s < steps; s++) {
                        const prevX = h.x;
                        const prevY = h.y;

                        // Perlin-guided wandering
                        const n = p.noise(h.x * 0.002, h.y * 0.002, h.seed + t * 0.003 * speed);
                        const angleShift = (n - 0.5) * 0.3;
                        h.angle += angleShift;

                        const stepLen = (1.2 + Math.random() * 0.8) * bassBoost * speed;
                        h.x += Math.cos(h.angle) * stepLen;
                        h.y += Math.sin(h.angle) * stepLen;
                        h.age++;

                        // Life progress 0..1
                        const life = h.age / h.maxAge;

                        // Thickness: starts thin, swells slightly, tapers off
                        const thickCurve = Math.sin(life * Math.PI);
                        const thickness = 0.4 + thickCurve * h.baseThick;

                        // Brightness pulses with beat
                        const bri = Math.min(100, h.bri + preset.beatPulse * 20 + preset.audio.rms * 10);
                        const alpha = Math.min(100, 50 + (1 - life) * 30 + preset.beatPulse * 20);

                        // Draw the filament segment with glow
                        // Outer glow
                        pg.strokeWeight(thickness + 3);
                        pg.stroke(h.hue, h.sat * 0.5, bri * 0.5, alpha * 0.15);
                        pg.line(prevX, prevY, h.x, h.y);
                        // Core filament
                        pg.strokeWeight(thickness);
                        pg.stroke(h.hue, h.sat, bri, alpha);
                        pg.line(prevX, prevY, h.x, h.y);

                        // Branching — rare, for airy network
                        if (h.age > 20 && h.depth < 3 && Math.random() < 0.008 + preset.beatPulse * 0.015) {
                            if (preset.hyphae.length < preset.maxHyphae) {
                                const branchAngle = h.angle + (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.8);
                                const childHue = preset._childHue(h.hue);
                                preset.hyphae.push({
                                    x: h.x, y: h.y,
                                    angle: branchAngle,
                                    seed: Math.random() * 1000,
                                    hue: childHue,
                                    sat: 50 + Math.random() * 30,
                                    bri: 60 + Math.random() * 30,
                                    baseThick: h.baseThick * 0.7,
                                    age: 0,
                                    maxAge: h.maxAge * (0.4 + Math.random() * 0.3),
                                    depth: h.depth + 1,
                                    dead: false
                                });

                                // Spore node at branch junction
                                if (preset.spores.length < preset.maxSpores) {
                                    preset.spores.push({
                                        x: h.x, y: h.y,
                                        hue: childHue,
                                        size: 2 + Math.random() * 3,
                                        phase: Math.random() * Math.PI * 2,
                                        birth: t,
                                        maxLife: 300 + Math.random() * 400
                                    });
                                }
                            }
                        }

                        // Die if out of bounds or life expired
                        if (h.x < -30 || h.x > p.width + 30 ||
                            h.y < -30 || h.y > p.height + 30 ||
                            h.age >= h.maxAge) {
                            h.dead = true;
                            break;
                        }
                    }
                }

                // Respawn if too few active hyphae — slow renewal
                const activeCount = preset.hyphae.filter(h => !h.dead).length;
                if (activeCount < 3 && t % 30 === 0) {
                    preset._seedHypha(p);
                }
                // Periodic slow spawn
                if (t % 180 === 0 && activeCount < preset.maxHyphae - 3) {
                    preset._seedHypha(p);
                }

                // Draw persistent layer
                p.background(0);
                p.image(pg, 0, 0);

                // Draw spore nodes on top (glowing, pulsing)
                p.noStroke();
                for (let i = preset.spores.length - 1; i >= 0; i--) {
                    const sp = preset.spores[i];
                    const sporeAge = t - sp.birth;
                    if (sporeAge > sp.maxLife) {
                        preset.spores.splice(i, 1);
                        continue;
                    }

                    // Smooth fade in/out
                    const lifeRatio = sporeAge / sp.maxLife;
                    const fadeIn = Math.min(1, lifeRatio * 5);
                    const fadeOut = lifeRatio > 0.7 ? 1 - (lifeRatio - 0.7) / 0.3 : 1;
                    const fade = fadeIn * fadeOut;

                    // Bioluminescent pulse
                    const pulse = Math.sin(t * 0.03 + sp.phase) * 0.3 + 0.7;
                    const beatGlow = 1 + preset.beatPulse * 0.6;
                    const size = sp.size * pulse * beatGlow;
                    const alpha = (30 + preset.audio.mid * 30 + preset.beatPulse * 20) * fade;

                    // Outer glow halo
                    p.fill(sp.hue, 30, 70, alpha * 0.12);
                    p.circle(sp.x, sp.y, size * 7);
                    // Mid glow
                    p.fill(sp.hue, 40, 85, alpha * 0.3);
                    p.circle(sp.x, sp.y, size * 3);
                    // Bright core
                    p.fill(sp.hue, 20, 100, alpha);
                    p.circle(sp.x, sp.y, size);
                }
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

    _seedHypha(p) {
        // Spawn from edges or sparse interior points
        let x, y, angle;
        const r = Math.random();
        if (r < 0.3) {
            // Left edge
            x = -5;
            y = p.height * 0.2 + Math.random() * p.height * 0.6;
            angle = (Math.random() - 0.5) * 0.6;
        } else if (r < 0.6) {
            // Right edge
            x = p.width + 5;
            y = p.height * 0.2 + Math.random() * p.height * 0.6;
            angle = Math.PI + (Math.random() - 0.5) * 0.6;
        } else if (r < 0.75) {
            // Bottom
            x = p.width * 0.15 + Math.random() * p.width * 0.7;
            y = p.height + 5;
            angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 0.5;
        } else {
            // Sparse interior — keep spacing from existing hyphae
            x = p.width * 0.15 + Math.random() * p.width * 0.7;
            y = p.height * 0.15 + Math.random() * p.height * 0.7;
            angle = Math.random() * Math.PI * 2;
        }

        // Bioluminescent color palette: cyan, green, blue-purple
        const palettes = [
            { hue: 170 + Math.random() * 20, sat: 60, bri: 80 },  // cyan
            { hue: 130 + Math.random() * 20, sat: 55, bri: 75 },  // green
            { hue: 270 + Math.random() * 20, sat: 50, bri: 70 },  // purple
            { hue: 190 + Math.random() * 15, sat: 50, bri: 85 },  // teal
            { hue: 80  + Math.random() * 20, sat: 45, bri: 70 },  // chartreuse
        ];
        const pal = palettes[Math.floor(Math.random() * palettes.length)];

        this.hyphae.push({
            x, y, angle,
            seed: Math.random() * 1000,
            hue: pal.hue,
            sat: pal.sat,
            bri: pal.bri,
            baseThick: 1.2 + Math.random() * 1.5,
            age: 0,
            maxAge: 200 + Math.random() * 300,
            depth: 0,
            dead: false
        });
    }

    _childHue(parentHue) {
        // Shift hue slightly for organic variation
        const shift = (Math.random() - 0.5) * 30;
        return (parentHue + shift + 360) % 360;
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        // On beat: spawn 1-2 new hyphae for growth burst
        if (this.p5 && strength > 0.3) {
            const count = Math.min(2, this.maxHyphae - this.hyphae.length);
            for (let i = 0; i < count; i++) {
                this._seedHypha(this.p5);
            }
            // Existing spores flash brighter (handled via beatPulse in draw)
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['fungal-web'] = FungalWebPreset;
})();
