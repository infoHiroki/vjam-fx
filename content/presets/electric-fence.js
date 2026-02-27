(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ElectricFencePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.arcs = [];
        this.sparks = [];
        this.cornerBridges = [];
    }

    setup(container) {
        this.destroy();
        this.arcs = [];
        this.sparks = [];
        this.cornerBridges = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                preset._generateArcs(p);
            };

            p.draw = () => {
                p.background(0, 0, 0, 100);
                preset.beatPulse *= 0.88;

                const time = p.frameCount * 0.015;

                // Regenerate arcs periodically
                if (p.frameCount % 90 === 0) {
                    preset._generateArcs(p);
                }

                // Draw all edge arcs
                for (const arc of preset.arcs) {
                    preset._drawEdgeArc(p, arc, time);
                }

                // Corner bridges on beat
                for (let i = preset.cornerBridges.length - 1; i >= 0; i--) {
                    const cb = preset.cornerBridges[i];
                    cb.life -= 0.03;
                    if (cb.life <= 0) {
                        preset.cornerBridges.splice(i, 1);
                        continue;
                    }
                    preset._drawCornerBridge(p, cb);
                }

                // Sparks
                p.noStroke();
                for (let i = preset.sparks.length - 1; i >= 0; i--) {
                    const sp = preset.sparks[i];
                    sp.x += sp.vx;
                    sp.y += sp.vy;
                    sp.vy += 0.1;
                    sp.life -= 0.035;
                    if (sp.life <= 0) {
                        preset.sparks.splice(i, 1);
                        continue;
                    }
                    const alpha = sp.life * 70;
                    p.fill(190, 20, 100, alpha);
                    p.circle(sp.x, sp.y, 2);
                    p.fill(190, 5, 100, alpha * 0.5);
                    p.circle(sp.x, sp.y, 4);
                }

                // Random spark emission from edges
                if (p.frameCount % 6 === 0) {
                    const edge = Math.floor(Math.random() * 4);
                    let sx, sy;
                    const w = p.width, h = p.height;
                    if (edge === 0) { sx = Math.random() * w; sy = Math.random() * 20; }
                    else if (edge === 1) { sx = Math.random() * w; sy = h - Math.random() * 20; }
                    else if (edge === 2) { sx = Math.random() * 20; sy = Math.random() * h; }
                    else { sx = w - Math.random() * 20; sy = Math.random() * h; }
                    preset._emitSparks(sx, sy, 2 + Math.floor(preset.audio.rms * 3));
                }

                if (preset.sparks.length > 150) {
                    preset.sparks.splice(0, preset.sparks.length - 150);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                preset._generateArcs(p);
            };
        }, container);
    }

    _generateArcs(p) {
        this.arcs = [];
        const w = p.width, h = p.height;

        // 2-3 arcs per edge
        for (let edge = 0; edge < 4; edge++) {
            const count = 2 + Math.floor(Math.random() * 2);
            for (let a = 0; a < count; a++) {
                const startT = Math.random() * 0.6;
                const endT = startT + 0.2 + Math.random() * 0.3;
                const segments = 10 + Math.floor(Math.random() * 8);
                const intensity = 0.5 + Math.random() * 0.5;
                const speed = 0.5 + Math.random() * 1.5;
                const offset = Math.random() * 1000;

                this.arcs.push({ edge, startT, endT: Math.min(endT, 1), segments, intensity, speed, offset });
            }
        }
    }

    _getEdgePoint(p, edge, t) {
        const w = p.width, h = p.height;
        if (edge === 0) return { x: t * w, y: 0 };           // top
        if (edge === 1) return { x: t * w, y: h };            // bottom
        if (edge === 2) return { x: 0, y: t * h };            // left
        return { x: w, y: t * h };                              // right
    }

    _drawEdgeArc(p, arc, time) {
        const { edge, startT, endT, segments, intensity, speed, offset } = arc;
        const jitter = 15 + this.audio.bass * 20 + this.beatPulse * 15;
        const alpha = 40 + intensity * 30 + this.audio.rms * 20 + this.beatPulse * 20;

        // Generate zigzag points along edge
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const t = startT + (endT - startT) * (i / segments);
            const base = this._getEdgePoint(p, edge, t);

            // Perpendicular offset for zigzag (inward from edge)
            let offX = 0, offY = 0;
            if (i > 0 && i < segments) {
                const noise = Math.sin(i * 3.7 + time * speed + offset) * jitter;
                const noise2 = Math.cos(i * 2.3 + time * speed * 1.3 + offset) * jitter * 0.5;
                if (edge === 0) offY = Math.abs(noise) + Math.abs(noise2);       // top: push down
                else if (edge === 1) offY = -(Math.abs(noise) + Math.abs(noise2)); // bottom: push up
                else if (edge === 2) offX = Math.abs(noise) + Math.abs(noise2);   // left: push right
                else offX = -(Math.abs(noise) + Math.abs(noise2));                 // right: push left
            }
            points.push({ x: base.x + offX, y: base.y + offY });
        }

        // Outer glow
        p.stroke(195, 50, 80, alpha * 0.3);
        p.strokeWeight(6);
        p.noFill();
        p.beginShape();
        for (const pt of points) p.vertex(pt.x, pt.y);
        p.endShape();

        // Main arc - cyan
        p.stroke(195, 60, 100, alpha);
        p.strokeWeight(2);
        p.beginShape();
        for (const pt of points) p.vertex(pt.x, pt.y);
        p.endShape();

        // White core
        p.stroke(195, 10, 100, alpha * 0.7);
        p.strokeWeight(1);
        p.beginShape();
        for (const pt of points) p.vertex(pt.x, pt.y);
        p.endShape();
    }

    _drawCornerBridge(p, cb) {
        const alpha = cb.life * 60;
        const w = p.width, h = p.height;
        const corners = [
            { x: 0, y: 0 }, { x: w, y: 0 },
            { x: w, y: h }, { x: 0, y: h }
        ];
        const c1 = corners[cb.corner1];
        const c2 = corners[cb.corner2];
        const segments = 8;
        const points = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const bx = c1.x + (c2.x - c1.x) * t;
            const by = c1.y + (c2.y - c1.y) * t;
            if (i === 0 || i === segments) {
                points.push({ x: bx, y: by });
            } else {
                const perpX = -(c2.y - c1.y);
                const perpY = (c2.x - c1.x);
                const len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
                const jit = (Math.random() - 0.5) * 60;
                points.push({ x: bx + (perpX / len) * jit, y: by + (perpY / len) * jit });
            }
        }

        p.stroke(195, 40, 90, alpha * 0.4);
        p.strokeWeight(5);
        p.noFill();
        p.beginShape();
        for (const pt of points) p.vertex(pt.x, pt.y);
        p.endShape();

        p.stroke(195, 50, 100, alpha);
        p.strokeWeight(2);
        p.beginShape();
        for (const pt of points) p.vertex(pt.x, pt.y);
        p.endShape();

        p.stroke(0, 0, 100, alpha * 0.6);
        p.strokeWeight(1);
        p.beginShape();
        for (const pt of points) p.vertex(pt.x, pt.y);
        p.endShape();
    }

    _emitSparks(x, y, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 1 + Math.random() * 3;
            this.sparks.push({
                x, y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                life: 0.4 + Math.random() * 0.5
            });
        }
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        // Regenerate arcs on strong beats
        if (this.p5 && strength > 0.5) {
            this._generateArcs(this.p5);
        }
        // Corner bridges
        if (this.p5 && strength > 0.3) {
            const c1 = Math.floor(Math.random() * 4);
            let c2 = (c1 + 1 + Math.floor(Math.random() * 2)) % 4;
            this.cornerBridges.push({ corner1: c1, corner2: c2, life: 0.8 + Math.random() * 0.3 });
        }
        // Extra sparks at corners
        if (this.p5) {
            const p = this.p5;
            const corners = [[0, 0], [p.width, 0], [p.width, p.height], [0, p.height]];
            for (const c of corners) {
                if (Math.random() < 0.5) {
                    this._emitSparks(c[0], c[1], 4);
                }
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['electric-fence'] = ElectricFencePreset;
})();
