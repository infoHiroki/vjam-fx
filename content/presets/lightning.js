(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class LightningPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.bolts = [];
        this.sparks = [];
        this.flash = 0;
        this._spawnTimer = 0;
        this._sparkTimer = 0;
        this._glowBuf = null;
    }

    setup(container) {
        this.destroy();
        this.bolts = [];
        this.sparks = [];
        this.flash = 0;
        this._spawnTimer = 0;
        this._sparkTimer = 0;
        this._glowBuf = null;
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                const w = container.clientWidth;
                const h = container.clientHeight;
                p.createCanvas(w, h);
                p.pixelDensity(1);
                p.colorMode(p.RGB, 255, 255, 255, 255);
                // Afterimage buffer at 1/3 res for persistent glow
                const RES = 3;
                preset._glowBuf = p.createGraphics(
                    Math.floor(w / RES),
                    Math.floor(h / RES)
                );
                preset._glowBuf.colorMode(p.RGB, 255, 255, 255, 255);
            };

            p.draw = () => {
                const spd = preset.params.speed;
                p.background(0);
                preset.beatPulse *= 0.9;
                preset.flash *= 0.75;

                const glow = preset._glowBuf;
                if (!glow) return;

                // Fade the glow buffer slowly — creates afterimage trails
                glow.fill(0, 0, 0, 18 + preset.audio.bass * 10);
                glow.noStroke();
                glow.rect(0, 0, glow.width, glow.height);

                // Draw bolts into glow buffer (scaled down)
                const sx = glow.width / p.width;
                const sy = glow.height / p.height;

                // Autonomous bolt spawning — frameCount based with audio influence
                preset._spawnTimer += spd * (1 + preset.audio.bass * 3);
                if (preset._spawnTimer > 28) {
                    preset._spawnTimer = 0;
                    preset.bolts.push(preset._createBolt(p, false));
                }

                // Ambient crackling sparks between strikes
                preset._sparkTimer += spd * (1 + preset.audio.treble * 2);
                if (preset._sparkTimer > 4) {
                    preset._sparkTimer = 0;
                    preset._spawnSparks(p, 1 + Math.floor(preset.audio.mid * 3));
                }

                // Screen flash on beat
                if (preset.flash > 0.05) {
                    const fa = Math.min(70, preset.flash * 100);
                    p.noStroke();
                    // Purple-blue flash
                    p.fill(120, 100, 255, fa);
                    p.rect(0, 0, p.width, p.height);
                }

                // Update and draw bolts
                for (let i = preset.bolts.length - 1; i >= 0; i--) {
                    const bolt = preset.bolts[i];
                    bolt.life -= 0.02 * spd;
                    // Jitter bolt segments for electric flicker
                    if (bolt.life > 0.3) {
                        preset._jitterBolt(bolt, 2);
                    }
                    if (bolt.life <= 0) {
                        preset.bolts.splice(i, 1);
                        continue;
                    }
                    preset._drawBolt(p, bolt);
                    // Also render into glow buffer for afterimage
                    preset._drawBoltGlow(glow, bolt, sx, sy);
                }

                // Update and draw sparks
                for (let i = preset.sparks.length - 1; i >= 0; i--) {
                    const sp = preset.sparks[i];
                    sp.life -= 0.04 * spd;
                    sp.x += sp.vx;
                    sp.y += sp.vy;
                    sp.vy += 0.15;
                    if (sp.life <= 0) {
                        preset.sparks.splice(i, 1);
                        continue;
                    }
                    const sa = sp.life * 255;
                    p.stroke(sp.r, sp.g, sp.b, sa);
                    p.strokeWeight(sp.size);
                    p.point(sp.x, sp.y);
                }

                // Render glow buffer onto canvas with additive feel
                p.blendMode(p.SCREEN);
                p.image(glow, 0, 0, p.width, p.height);
                p.blendMode(p.BLEND);

                // Ambient horizon glow — electric blue shimmer at bottom
                const horizonAlpha = 15 + preset.audio.bass * 40 + preset.flash * 30;
                p.noStroke();
                for (let i = 0; i < 3; i++) {
                    const yy = p.height - (i * p.height * 0.04);
                    const aa = Math.max(0, horizonAlpha - i * 8);
                    p.fill(60, 80 + i * 30, 200 + i * 20, aa);
                    p.rect(0, yy, p.width, p.height * 0.04);
                }

                // Cap arrays
                if (preset.bolts.length > 14) {
                    preset.bolts.splice(0, preset.bolts.length - 14);
                }
                if (preset.sparks.length > 80) {
                    preset.sparks.splice(0, preset.sparks.length - 80);
                }
            };

            p.windowResized = () => {
                const w = container.clientWidth;
                const h = container.clientHeight;
                p.resizeCanvas(w, h);
                if (preset._glowBuf) {
                    preset._glowBuf.remove();
                }
                const RES = 3;
                preset._glowBuf = p.createGraphics(
                    Math.floor(w / RES),
                    Math.floor(h / RES)
                );
                preset._glowBuf.colorMode(p.RGB, 255, 255, 255, 255);
            };
        }, container);
    }

    _drawBolt(p, bolt) {
        const alpha = bolt.life;
        const hue = bolt.hue; // 0 = blue, 1 = purple

        // Color mixing: blue vs purple based on bolt hue
        const outerR = p.lerp(60, 140, hue);
        const outerG = p.lerp(140, 60, hue);
        const outerB = 255;

        const midR = p.lerp(120, 180, hue);
        const midG = p.lerp(180, 120, hue);
        const midB = 255;

        const drawSegs = (segs, weight, r, g, b, a) => {
            p.strokeWeight(weight);
            p.stroke(r, g, b, a);
            p.noFill();
            for (let j = 0; j < segs.length - 1; j++) {
                p.line(segs[j].x, segs[j].y, segs[j + 1].x, segs[j + 1].y);
            }
        };

        // Widest outer glow
        drawSegs(bolt.segments, 10 * bolt.thickness, outerR, outerG, outerB, alpha * 20);
        // Mid glow
        drawSegs(bolt.segments, 5 * bolt.thickness, midR, midG, midB, alpha * 70);
        // Core — bright white with slight color tint
        drawSegs(bolt.segments, 2 * bolt.thickness, 230, 240, 255, alpha * 255);

        // Branches
        for (const branch of bolt.branches) {
            drawSegs(branch, 6, outerR, outerG, outerB, alpha * 15);
            drawSegs(branch, 2.5, midR, midG, midB, alpha * 55);
            drawSegs(branch, 1, 210, 230, 255, alpha * 200);
        }

        // Sub-branches
        for (const sub of bolt.subBranches) {
            drawSegs(sub, 3, outerR, outerG, outerB, alpha * 12);
            drawSegs(sub, 1, 200, 220, 255, alpha * 150);
        }

        // Impact point glow at bolt end
        if (bolt.life > 0.5 && bolt.segments.length > 2) {
            const end = bolt.segments[bolt.segments.length - 1];
            if (end.y > p.height * 0.7) {
                const gr = alpha * 60;
                p.noStroke();
                p.fill(outerR, outerG, outerB, gr * 0.3);
                p.ellipse(end.x, end.y, 80, 30);
                p.fill(200, 220, 255, gr);
                p.ellipse(end.x, end.y, 30, 12);
            }
        }
    }

    _drawBoltGlow(glow, bolt, sx, sy) {
        // Simplified rendering into the afterimage buffer
        const alpha = bolt.life;
        const hue = bolt.hue;
        const r = glow.lerp(80, 150, hue);
        const g = glow.lerp(150, 80, hue);
        glow.strokeWeight(3);
        glow.stroke(r, g, 255, alpha * 120);
        glow.noFill();
        const segs = bolt.segments;
        for (let j = 0; j < segs.length - 1; j++) {
            glow.line(
                segs[j].x * sx, segs[j].y * sy,
                segs[j + 1].x * sx, segs[j + 1].y * sy
            );
        }
    }

    _jitterBolt(bolt, amount) {
        // Slightly move segments for electric flicker effect
        for (let i = 1; i < bolt.segments.length - 1; i++) {
            bolt.segments[i].x += (Math.random() - 0.5) * amount;
            bolt.segments[i].y += (Math.random() - 0.5) * amount * 0.3;
        }
    }

    _spawnSparks(p, count) {
        // Small crackling sparks — ambient electric energy
        for (let i = 0; i < count; i++) {
            const x = Math.random() * p.width;
            const y = Math.random() * p.height * 0.8;
            // Slight blue/white/purple variation
            const hue = Math.random();
            this.sparks.push({
                x, y,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 2,
                life: 0.3 + Math.random() * 0.5,
                size: 1 + Math.random() * 2,
                r: hue < 0.5 ? 150 + Math.random() * 100 : 120,
                g: hue < 0.5 ? 180 + Math.random() * 70 : 100 + Math.random() * 60,
                b: 255,
            });
        }
    }

    _createBolt(p, massive) {
        const startX = p.width * 0.1 + Math.random() * p.width * 0.8;
        const segments = [{ x: startX, y: -5 }];
        const branches = [];
        const subBranches = [];
        let x = startX;
        let y = 0;
        const steps = massive
            ? 28 + Math.floor(Math.random() * 18)
            : 16 + Math.floor(Math.random() * 14);
        const stepY = p.height / steps;
        const jitter = massive ? 100 : 60;
        // Bolt color hue: 0=blue, 1=purple
        const hue = Math.random() * 0.6;
        // Thickness variation
        const thickness = massive ? 1.0 + Math.random() * 0.5 : 0.6 + Math.random() * 0.4;

        // Main bolt with some angular variation
        let angle = 0;
        for (let i = 0; i < steps; i++) {
            // Occasional sharp kinks
            if (Math.random() < 0.15) {
                angle = (Math.random() - 0.5) * 1.2;
            } else {
                angle *= 0.7;
                angle += (Math.random() - 0.5) * 0.4;
            }
            x += Math.sin(angle) * jitter * (0.5 + Math.random() * 0.5);
            y += stepY * (0.5 + Math.random() * 0.7);
            // Keep in bounds horizontally
            x = Math.max(p.width * 0.05, Math.min(p.width * 0.95, x));
            segments.push({ x, y });

            // Branching
            const branchChance = massive ? 0.5 : 0.3;
            if (Math.random() < branchChance) {
                const branch = [{ x, y }];
                let bx = x;
                let by = y;
                const bSteps = 3 + Math.floor(Math.random() * 7);
                const dir = Math.random() > 0.5 ? 1 : -1;
                for (let j = 0; j < bSteps; j++) {
                    bx += dir * (15 + Math.random() * 45);
                    by += stepY * (0.25 + Math.random() * 0.55);
                    branch.push({ x: bx, y: by });

                    // Sub-branches
                    if (Math.random() < 0.35) {
                        const sub = [{ x: bx, y: by }];
                        let sx = bx;
                        let sy = by;
                        const sDir = Math.random() > 0.5 ? 1 : -1;
                        const sSteps = 2 + Math.floor(Math.random() * 3);
                        for (let k = 0; k < sSteps; k++) {
                            sx += sDir * (6 + Math.random() * 18);
                            sy += stepY * (0.15 + Math.random() * 0.35);
                            sub.push({ x: sx, y: sy });
                        }
                        subBranches.push(sub);
                    }
                }
                branches.push(branch);
            }

            if (y >= p.height) break;
        }

        return { segments, branches, subBranches, life: 1, hue, thickness };
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        if (strength > 0.2 && this.p5) {
            this.flash = strength;
            // Massive bolt on beat
            this.bolts.push(this._createBolt(this.p5, true));
            // Burst of sparks at beat
            this._spawnSparks(this.p5, 5 + Math.floor(strength * 15));
            // Strong beat: simultaneous bolts
            if (strength > 0.5) {
                this.bolts.push(this._createBolt(this.p5, true));
            }
            if (strength > 0.7) {
                this.bolts.push(this._createBolt(this.p5, true));
            }
        }
    }

    destroy() {
        if (this._glowBuf) {
            this._glowBuf.remove();
            this._glowBuf = null;
        }
        super.destroy();
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['lightning'] = LightningPreset;
})();
