(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PlasmaBallPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.tendrils = [];
    }

    setup(container) {
        this.destroy();
        this.tendrils = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.92;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxDim = Math.max(p.width, p.height);
                const maxR = maxDim * 0.75;

                // Ensure we have tendrils
                const tendrilCount = 10 + (preset.beatPulse > 0.3 ? 6 : 0);
                while (preset.tendrils.length < tendrilCount) {
                    preset.tendrils.push(preset._newTendril(p, cx, cy, maxR));
                }
                while (preset.tendrils.length > tendrilCount + 2) {
                    preset.tendrils.pop();
                }

                // Central sphere glow
                const sphereR = 35 + preset.audio.bass * 50 + preset.beatPulse * 25;
                p.noStroke();
                for (let i = 5; i >= 0; i--) {
                    const r = sphereR + i * 25;
                    const alpha = 25 - i * 3;
                    p.fill(180, 50, 255, alpha);
                    p.ellipse(cx, cy, r * 2, r * 2);
                }
                // Inner sphere bright core
                p.fill(220, 180, 255, 220);
                p.ellipse(cx, cy, sphereR * 1.1, sphereR * 1.1);
                p.fill(255, 255, 255, 180);
                p.ellipse(cx, cy, sphereR * 0.5, sphereR * 0.5);

                // Draw tendrils with branching
                for (const t of preset.tendrils) {
                    t.targetAngle += (p.noise(t.noiseOff + p.frameCount * 0.008) - 0.5) * 0.08;
                    t.targetDist = maxR * (0.7 + p.noise(t.noiseOff + 100 + p.frameCount * 0.004) * 0.3);
                    const audioPush = preset.audio.bass * maxR * 0.15 + preset.beatPulse * maxR * 0.1;
                    const dist = t.targetDist + audioPush;

                    const ex = cx + Math.cos(t.targetAngle) * dist;
                    const ey = cy + Math.sin(t.targetAngle) * dist;

                    // Main tendril segments (jagged lightning style)
                    const segments = 12 + Math.floor(preset.beatPulse * 6);
                    const points = [{ x: cx, y: cy }];
                    for (let s = 1; s <= segments; s++) {
                        const frac = s / segments;
                        const baseX = p.lerp(cx, ex, frac);
                        const baseY = p.lerp(cy, ey, frac);
                        const jitter = (1 - Math.abs(frac - 0.5) * 2) * 60 * (1 + preset.beatPulse);
                        const nx = p.noise(t.noiseOff + s * 0.3 + p.frameCount * 0.03);
                        const ny = p.noise(t.noiseOff + s * 0.3 + 500 + p.frameCount * 0.03);
                        points.push({
                            x: baseX + (nx - 0.5) * jitter,
                            y: baseY + (ny - 0.5) * jitter,
                        });
                    }

                    const brightness = 180 + preset.beatPulse * 75;

                    // Outer glow
                    p.strokeWeight(8 + preset.beatPulse * 4);
                    p.stroke(t.color[0], t.color[1], t.color[2], 25);
                    p.noFill();
                    p.beginShape();
                    for (const pt of points) p.vertex(pt.x, pt.y);
                    p.endShape();

                    // Main arc
                    p.strokeWeight(2.5 + preset.beatPulse * 1.5);
                    p.stroke(t.color[0], t.color[1], t.color[2], Math.min(255, brightness));
                    p.beginShape();
                    for (const pt of points) p.vertex(pt.x, pt.y);
                    p.endShape();

                    // White-hot core
                    p.strokeWeight(1);
                    p.stroke(255, 255, 255, Math.min(220, brightness * 0.7));
                    p.beginShape();
                    for (const pt of points) p.vertex(pt.x, pt.y);
                    p.endShape();

                    // Branches from mid-points
                    const branchCount = 2 + Math.floor(preset.beatPulse * 3);
                    for (let b = 0; b < branchCount; b++) {
                        const srcIdx = 3 + Math.floor(p.noise(t.noiseOff + b * 7 + p.frameCount * 0.01) * (points.length - 4));
                        if (srcIdx >= points.length) continue;
                        const src = points[srcIdx];
                        const branchLen = 30 + p.noise(t.noiseOff + b * 13 + p.frameCount * 0.02) * 80 + preset.beatPulse * 40;
                        const branchAngle = t.targetAngle + (p.noise(t.noiseOff + b * 11 + p.frameCount * 0.015) - 0.5) * 3;

                        const bpts = [src];
                        const bSegs = 4;
                        for (let bs = 1; bs <= bSegs; bs++) {
                            const bf = bs / bSegs;
                            const bx = src.x + Math.cos(branchAngle) * branchLen * bf + (p.noise(t.noiseOff + b + bs * 0.5 + p.frameCount * 0.04) - 0.5) * 30;
                            const by = src.y + Math.sin(branchAngle) * branchLen * bf + (p.noise(t.noiseOff + b + bs * 0.5 + 300 + p.frameCount * 0.04) - 0.5) * 30;
                            bpts.push({ x: bx, y: by });
                        }

                        // Branch glow
                        p.strokeWeight(4);
                        p.stroke(t.color[0], t.color[1], t.color[2], 20);
                        p.beginShape();
                        for (const bp of bpts) p.vertex(bp.x, bp.y);
                        p.endShape();

                        // Branch line
                        p.strokeWeight(1.5);
                        p.stroke(t.color[0], t.color[1], t.color[2], Math.min(200, brightness * 0.6));
                        p.beginShape();
                        for (const bp of bpts) p.vertex(bp.x, bp.y);
                        p.endShape();

                        // Branch core
                        p.strokeWeight(0.5);
                        p.stroke(255, 255, 255, Math.min(160, brightness * 0.4));
                        p.beginShape();
                        for (const bp of bpts) p.vertex(bp.x, bp.y);
                        p.endShape();
                    }

                    // End point spark (bigger, brighter)
                    p.noStroke();
                    const sparkSize = 10 + preset.beatPulse * 12;
                    p.fill(t.color[0], t.color[1], t.color[2], 30);
                    p.ellipse(ex, ey, sparkSize * 3, sparkSize * 3);
                    p.fill(t.color[0], t.color[1], t.color[2], 150 + preset.beatPulse * 80);
                    p.ellipse(ex, ey, sparkSize, sparkSize);
                    p.fill(255, 255, 255, 180);
                    p.ellipse(ex, ey, sparkSize * 0.4, sparkSize * 0.4);
                }

                // Ambient electric haze near center
                p.noStroke();
                const hazeR = sphereR * 2.5;
                p.fill(140, 40, 255, 8 + preset.beatPulse * 12);
                p.ellipse(cx, cy, hazeR, hazeR);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _newTendril(p, cx, cy, maxR) {
        const angle = p.random(p.TWO_PI);
        const colors = [
            [255, 50, 255],   // hot magenta
            [180, 80, 255],   // electric purple
            [0, 255, 255],    // cyan
            [120, 200, 255],  // ice blue
            [255, 120, 220],  // pink
            [100, 150, 255],  // blue
        ];
        return {
            targetAngle: angle,
            targetDist: maxR * p.random(0.6, 1.0),
            noiseOff: p.random(10000),
            color: colors[Math.floor(p.random(colors.length))],
        };
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        for (const t of this.tendrils) {
            t.targetAngle += (Math.random() - 0.5) * 1.5;
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['plasma-ball'] = PlasmaBallPreset;
})();
