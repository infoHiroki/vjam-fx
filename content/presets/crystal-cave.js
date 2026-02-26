(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class CrystalCavePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.crystals = [];
        this.lightRays = [];
        this.maxCrystals = 150;
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
                preset.crystals = [];
                preset.lightRays = [];
                preset._spawnInitial(p);
            };

            p.draw = () => {
                p.background(0);

                const speedMult = p.lerp(0.5, 2, preset.audio.rms) * preset.params.speed;
                const t = p.frameCount * 0.01;

                // Deep cave ambient glow
                p.noStroke();
                const ambientPulse = 1 + preset.audio.bass * 0.5 + preset.beatPulse * 0.3;
                for (let i = 0; i < 4; i++) {
                    const gx = p.width * (0.2 + i * 0.2) + Math.sin(t + i * 2) * 40;
                    const gy = p.height * (0.3 + Math.sin(t * 0.7 + i) * 0.2);
                    const gSize = 200 * ambientPulse + preset.audio.mid * 100;
                    p.fill(260 + i * 20, 40, 15, 8);
                    p.ellipse(gx, gy, gSize, gSize * 0.8);
                }

                // Light rays bouncing between crystals
                preset._updateLightRays(p, t);
                for (const ray of preset.lightRays) {
                    const rayAlpha = ray.alpha * (0.5 + preset.audio.treble * 0.5);
                    // Bright ray core
                    p.stroke(ray.hue, 30, 100, rayAlpha);
                    p.strokeWeight(1.5 + preset.beatPulse * 2);
                    p.line(ray.x1, ray.y1, ray.x2, ray.y2);
                    // Soft glow
                    p.stroke(ray.hue, 15, 100, rayAlpha * 0.3);
                    p.strokeWeight(5 + preset.beatPulse * 4);
                    p.line(ray.x1, ray.y1, ray.x2, ray.y2);
                }

                // Grow and draw crystals
                for (let i = preset.crystals.length - 1; i >= 0; i--) {
                    const c = preset.crystals[i];

                    // Grow
                    if (c.len < c.maxLen) {
                        c.len += c.growSpeed * speedMult;
                        if (c.len > c.maxLen) c.len = c.maxLen;
                    } else {
                        c.alpha -= 0.2 * speedMult;
                    }

                    if (c.alpha <= 0) {
                        preset.crystals.splice(i, 1);
                        continue;
                    }

                    const endX = c.x + Math.cos(c.angle) * c.len;
                    const endY = c.y + Math.sin(c.angle) * c.len;

                    // Faceted crystal body (hexagonal prism shape)
                    const hue = (250 + c.hueOffset) % 360;
                    const sat = p.lerp(35, 75, preset.audio.treble);
                    const bri = p.lerp(50, 100, preset.audio.bass);
                    const alpha = Math.min(c.alpha, 85);

                    preset._drawFacetedCrystal(p, c.x, c.y, endX, endY, c.thickness, hue, sat, bri, alpha, t);

                    // Internal glow / refraction at crystal tip
                    if (c.len > c.maxLen * 0.5) {
                        const glowSize = c.thickness * (3 + preset.beatPulse * 4 + Math.sin(t * 3 + c.x) * 1);
                        p.noStroke();
                        p.fill(hue, 20, 100, alpha * 0.25);
                        p.ellipse(endX, endY, glowSize, glowSize);
                        // Refraction sparkle
                        const sparkle = Math.sin(t * 5 + c.hueOffset) * 0.5 + 0.5;
                        p.fill((hue + 40) % 360, 15, 100, alpha * 0.15 * sparkle);
                        p.ellipse(endX, endY, glowSize * 1.8, glowSize * 1.8);
                    }

                    // Branch at tip
                    if (c.len >= c.maxLen && !c.branched && c.depth < 4) {
                        c.branched = true;
                        const branchCount = 2 + Math.floor(Math.random() * 2);
                        for (let b = 0; b < branchCount; b++) {
                            const spread = (Math.random() - 0.5) * 1.0;
                            preset._addCrystal(
                                endX, endY,
                                c.angle + spread,
                                c.depth + 1,
                                c.maxLen * p.lerp(0.5, 0.8, Math.random()),
                                c.thickness * 0.65,
                                c.hueOffset + (Math.random() - 0.5) * 30
                            );
                        }
                    }
                }

                // Ambient spawn
                if (p.frameCount % 20 === 0 && preset.crystals.length < preset.maxCrystals) {
                    preset._spawnEdgeCrystal(p);
                }

                // Beat decay
                if (preset.beatPulse > 0) {
                    preset.beatPulse *= 0.85;
                    if (preset.beatPulse < 0.01) preset.beatPulse = 0;
                }

                // Cap
                while (preset.crystals.length > preset.maxCrystals) {
                    preset.crystals.shift();
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                p.background(0);
            };
        }, container);
    }

    _drawFacetedCrystal(p, x1, y1, x2, y2, thickness, hue, sat, bri, alpha, t) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;

        const nx = -dy / len;
        const ny = dx / len;
        const w = thickness * (1 + this.beatPulse * 0.5);

        // Left face (darker)
        p.noStroke();
        p.fill(hue, sat, bri * 0.5, alpha * 0.7);
        p.beginShape();
        p.vertex(x1 - nx * w * 0.3, y1 - ny * w * 0.3);
        p.vertex(x1 - nx * w, y1 - ny * w);
        p.vertex(x2 - nx * w * 0.6, y2 - ny * w * 0.6);
        p.vertex(x2, y2);
        p.endShape(p.CLOSE);

        // Right face (brighter)
        p.fill(hue, sat * 0.7, bri, alpha * 0.8);
        p.beginShape();
        p.vertex(x1 + nx * w * 0.3, y1 + ny * w * 0.3);
        p.vertex(x1 + nx * w, y1 + ny * w);
        p.vertex(x2 + nx * w * 0.6, y2 + ny * w * 0.6);
        p.vertex(x2, y2);
        p.endShape(p.CLOSE);

        // Center highlight (specular)
        p.stroke(hue, sat * 0.3, 100, alpha * 0.5);
        p.strokeWeight(0.8);
        p.line(x1, y1, x2, y2);

        // Edge highlights
        p.stroke(hue, sat * 0.5, bri * 0.9, alpha * 0.35);
        p.strokeWeight(0.5);
        p.line(x1 - nx * w, y1 - ny * w, x2 - nx * w * 0.6, y2 - ny * w * 0.6);
        p.line(x1 + nx * w, y1 + ny * w, x2 + nx * w * 0.6, y2 + ny * w * 0.6);
    }

    _updateLightRays(p, t) {
        // Maintain a few light rays that connect grown crystals
        this.lightRays = [];
        const grownCrystals = this.crystals.filter(c => c.len >= c.maxLen * 0.8 && c.alpha > 30);
        const rayCount = Math.min(6, Math.floor(grownCrystals.length / 2));

        for (let i = 0; i < rayCount; i++) {
            const idx = Math.floor(p.noise(i * 5.3, t * 0.2) * grownCrystals.length);
            const idx2 = Math.floor(p.noise(i * 5.3 + 50, t * 0.2) * grownCrystals.length);
            if (idx === idx2 || idx >= grownCrystals.length || idx2 >= grownCrystals.length) continue;
            const c1 = grownCrystals[idx];
            const c2 = grownCrystals[idx2];
            const ex1 = c1.x + Math.cos(c1.angle) * c1.len;
            const ey1 = c1.y + Math.sin(c1.angle) * c1.len;
            const ex2 = c2.x + Math.cos(c2.angle) * c2.len;
            const ey2 = c2.y + Math.sin(c2.angle) * c2.len;
            const dist = Math.sqrt((ex2 - ex1) ** 2 + (ey2 - ey1) ** 2);
            if (dist > 300) continue;
            const flicker = 0.5 + Math.sin(t * 8 + i * 3) * 0.5;
            this.lightRays.push({
                x1: ex1, y1: ey1, x2: ex2, y2: ey2,
                hue: (260 + i * 25) % 360,
                alpha: 15 * flicker + this.beatPulse * 20,
            });
        }
    }

    _addCrystal(x, y, angle, depth, maxLen, thickness, hueOffset) {
        this.crystals.push({
            x, y, angle, depth,
            len: 0,
            maxLen: maxLen || 40 + Math.random() * 80,
            growSpeed: 1.5 + Math.random() * 2,
            thickness: thickness || 2 + Math.random() * 3,
            alpha: 85,
            hueOffset: hueOffset || (Math.random() - 0.5) * 40,
            branched: false,
        });
    }

    _spawnEdgeCrystal(p) {
        const edge = Math.floor(Math.random() * 4);
        let x, y, angle;
        const cx = p.width / 2;
        const cy = p.height / 2;

        switch (edge) {
            case 0:
                x = Math.random() * p.width;
                y = 0;
                angle = Math.atan2(cy - y, cx - x) + (Math.random() - 0.5) * 0.8;
                break;
            case 1:
                x = p.width;
                y = Math.random() * p.height;
                angle = Math.atan2(cy - y, cx - x) + (Math.random() - 0.5) * 0.8;
                break;
            case 2:
                x = Math.random() * p.width;
                y = p.height;
                angle = Math.atan2(cy - y, cx - x) + (Math.random() - 0.5) * 0.8;
                break;
            default:
                x = 0;
                y = Math.random() * p.height;
                angle = Math.atan2(cy - y, cx - x) + (Math.random() - 0.5) * 0.8;
                break;
        }

        this._addCrystal(x, y, angle, 0, 50 + Math.random() * 100, 2 + Math.random() * 3.5, (Math.random() - 0.5) * 30);
    }

    _spawnInitial(p) {
        for (let i = 0; i < 20; i++) {
            this._spawnEdgeCrystal(p);
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
        if (this.p5) {
            const count = Math.floor(4 + strength * 6);
            for (let i = 0; i < count; i++) {
                this._spawnEdgeCrystal(this.p5);
            }
        }
    }
}

window.VJamFX.presets['crystal-cave'] = CrystalCavePreset;
})();
