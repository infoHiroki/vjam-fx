(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MeadowBreezePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.seeds = [];
        this.sunPatches = [];
    }

    setup(container) {
        this.destroy();
        this.seeds = [];
        this.sunPatches = [];
        const preset = this;

        this.p5 = new p5((p) => {
            const blades = [];
            const flowers = [];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);

                // 3 depth layers of grass blades
                for (let layer = 0; layer < 3; layer++) {
                    const count = layer === 0 ? 50 : layer === 1 ? 80 : 120;
                    for (let i = 0; i < count; i++) {
                        blades.push({
                            x: Math.random() * p.width,
                            baseY: p.height * (0.6 + layer * 0.1) + Math.random() * p.height * 0.15,
                            height: 30 + Math.random() * 60 + (2 - layer) * 20,
                            thickness: 0.8 + (2 - layer) * 0.6 + Math.random() * 0.5,
                            hue: 100 + Math.random() * 35,
                            brightness: 25 + (2 - layer) * 12 + Math.random() * 10,
                            alpha: 35 + (2 - layer) * 15,
                            noiseOff: Math.random() * 1000,
                            layer,
                        });
                    }
                }

                // Scattered flowers
                for (let i = 0; i < 20; i++) {
                    flowers.push({
                        x: Math.random() * p.width,
                        y: p.height * (0.65 + Math.random() * 0.25),
                        size: 2 + Math.random() * 4,
                        hue: Math.random() > 0.5 ? (340 + Math.random() * 30) % 360 : 50 + Math.random() * 20,
                        noiseOff: Math.random() * 100,
                    });
                }

                // Sunlight patches
                for (let i = 0; i < 6; i++) {
                    preset.sunPatches.push({
                        x: Math.random() * p.width,
                        y: p.height * (0.3 + Math.random() * 0.5),
                        baseSize: 60 + Math.random() * 120,
                        phase: Math.random() * Math.PI * 2,
                        driftPhase: Math.random() * Math.PI * 2,
                        speed: 0.3 + Math.random() * 0.4,
                    });
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.93;
                const t = p.frameCount * 0.008 * speed;

                // Black background for screen blend
                p.background(0);

                const windStrength = 0.6 + preset.audio.bass * 0.5 + pulse * 2;
                const globalWind = Math.sin(t * 0.7) * 0.3;

                // Drifting sunlight patches — moving beams of warm light
                for (const sp of preset.sunPatches) {
                    const drift = Math.sin(t * sp.speed + sp.driftPhase) * 80;
                    const breathe = 0.6 + Math.sin(t * 0.5 + sp.phase) * 0.4;
                    const sz = sp.baseSize * breathe * (1 + preset.audio.mid * 0.5);
                    const px = sp.x + drift + globalWind * 40;
                    const py = sp.y + Math.cos(t * 0.3 + sp.phase) * 20;

                    // Warm light glow — outer
                    p.noStroke();
                    p.fill(55, 30, 60, 6 + pulse * 4);
                    p.ellipse(px, py, sz * 1.8, sz * 1.4);
                    // Inner core
                    p.fill(50, 20, 80, 10 + pulse * 6);
                    p.ellipse(px, py, sz * 0.8, sz * 0.6);
                }

                // Light beams from top — swaying rays
                for (let i = 0; i < 5; i++) {
                    const rayPhase = i * 1.3 + t * 0.4;
                    const rayX = p.width * (0.15 + i * 0.17) + Math.sin(rayPhase) * 60;
                    const rayWidth = 20 + Math.sin(t * 0.6 + i * 2) * 10;
                    const rayAlpha = 5 + Math.sin(t * 0.3 + i) * 3 + preset.audio.treble * 5;
                    const spread = rayWidth + Math.sin(t * 0.2 + i) * 15;

                    p.noStroke();
                    p.fill(55, 25, 75, rayAlpha);
                    p.beginShape();
                    p.vertex(rayX - rayWidth * 0.3, 0);
                    p.vertex(rayX + rayWidth * 0.3, 0);
                    p.vertex(rayX + spread * 2, p.height * 0.75);
                    p.vertex(rayX - spread * 1.5, p.height * 0.75);
                    p.endShape(p.CLOSE);
                }

                // Draw grass blades as bezier curves
                for (let i = 0; i < blades.length; i++) {
                    const b = blades[i];
                    const wind = p.noise(b.x * 0.01, t + b.noiseOff) - 0.45 + globalWind;
                    const sway = wind * windStrength * b.height * 0.6;

                    const x1 = b.x;
                    const y1 = b.baseY;
                    const cx1 = b.x + sway * 0.3;
                    const cy1 = b.baseY - b.height * 0.4;
                    const cx2 = b.x + sway * 0.7;
                    const cy2 = b.baseY - b.height * 0.75;
                    const x2 = b.x + sway;
                    const y2 = b.baseY - b.height;

                    const hue = (b.hue + preset.audio.mid * 10) % 360;
                    const bri = b.brightness + preset.audio.treble * 8;

                    // Glow
                    p.strokeWeight(b.thickness * 2.5);
                    p.stroke(hue, 40, bri * 0.5, b.alpha * 0.25);
                    p.noFill();
                    p.bezier(x1, y1, cx1, cy1, cx2, cy2, x2, y2);

                    // Core blade
                    p.strokeWeight(b.thickness);
                    p.stroke(hue, 50, bri, b.alpha);
                    p.bezier(x1, y1, cx1, cy1, cx2, cy2, x2, y2);
                }

                // Flowers swaying with wind
                for (let i = 0; i < flowers.length; i++) {
                    const f = flowers[i];
                    const fWind = (p.noise(f.x * 0.01, t + f.noiseOff) - 0.45 + globalWind) * windStrength * 3;
                    const fx = f.x + fWind;
                    const fy = f.y;

                    p.noStroke();
                    p.fill(f.hue, 50, 60, 18);
                    p.ellipse(fx, fy, f.size * 3, f.size * 3);
                    p.fill(f.hue, 60, 70, 50);
                    p.ellipse(fx, fy, f.size, f.size);
                    p.fill((f.hue + 40) % 360, 40, 80, 55);
                    p.ellipse(fx, fy, f.size * 0.4, f.size * 0.4);
                }

                // Floating seeds / pollen — always spawning, more on beat
                if (pulse > 0.2 || p.frameCount % 15 === 0) {
                    const count = pulse > 0.3 ? 3 : 1;
                    for (let n = 0; n < count; n++) {
                        preset.seeds.push({
                            x: Math.random() * p.width,
                            y: p.height * (0.2 + Math.random() * 0.5),
                            vx: 0.2 + Math.random() * 0.6,
                            vy: -0.3 - Math.random() * 0.5,
                            life: 1,
                            size: 1 + Math.random() * 2.5,
                            wobble: Math.random() * Math.PI * 2,
                            type: Math.random() > 0.5 ? 'seed' : 'pollen',
                        });
                    }
                }

                for (let i = preset.seeds.length - 1; i >= 0; i--) {
                    const s = preset.seeds[i];
                    const sw = (p.noise(s.x * 0.02, t) - 0.4 + globalWind) * windStrength;
                    s.wobble += 0.05;
                    s.x += s.vx + sw;
                    s.y += s.vy + Math.sin(s.wobble) * 0.3;
                    s.life -= 0.006;

                    if (s.life <= 0 || s.x > p.width + 10 || s.x < -10) {
                        preset.seeds.splice(i, 1);
                        continue;
                    }

                    p.noStroke();
                    if (s.type === 'seed') {
                        // Dandelion seed — tiny starburst
                        p.fill(50, 10, 90, s.life * 40);
                        p.ellipse(s.x, s.y, s.size, s.size);
                        p.stroke(50, 10, 80, s.life * 20);
                        p.strokeWeight(0.3);
                        for (let a = 0; a < 4; a++) {
                            const angle = a * Math.PI / 2 + s.wobble * 0.5;
                            p.line(s.x, s.y,
                                s.x + Math.cos(angle) * s.size * 2,
                                s.y + Math.sin(angle) * s.size * 2);
                        }
                    } else {
                        // Pollen — soft dot
                        p.fill(45, 30, 80, s.life * 35);
                        p.ellipse(s.x, s.y, s.size * 1.5, s.size * 1.5);
                        p.fill(50, 15, 95, s.life * 20);
                        p.ellipse(s.x, s.y, s.size * 0.6, s.size * 0.6);
                    }
                }

                if (preset.seeds.length > 120) preset.seeds.splice(0, 30);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                blades.forEach(b => {
                    b.baseY = p.height * (0.6 + b.layer * 0.1) + Math.random() * p.height * 0.15;
                });
                flowers.forEach(f => { f.y = p.height * (0.65 + Math.random() * 0.25); });
                preset.sunPatches.forEach(sp => {
                    sp.x = Math.random() * p.width;
                    sp.y = p.height * (0.3 + Math.random() * 0.5);
                });
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
window.VJamFX.presets['meadow-breeze'] = MeadowBreezePreset;
})();
