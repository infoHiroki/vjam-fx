(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ElectricArcPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.nodes = [];
        this.arcs = [];
        this.sparks = [];
    }

    setup(container) {
        this.destroy();
        this.nodes = [];
        this.arcs = [];
        this.sparks = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                preset._initNodes(p);
                preset._spawnArc(p);
                preset._spawnArc(p);
            };

            p.draw = () => {
                p.background(5, 5, 15);
                preset.beatPulse *= 0.92;

                // move nodes slowly along edges
                for (const node of preset.nodes) {
                    node.x += Math.cos(node.angle) * 0.3;
                    node.y += Math.sin(node.angle) * 0.3;
                    // keep on edges
                    node.x = p.constrain(node.x, 0, p.width);
                    node.y = p.constrain(node.y, 0, p.height);
                    if (node.x <= 0 || node.x >= p.width) node.angle = Math.PI - node.angle;
                    if (node.y <= 0 || node.y >= p.height) node.angle = -node.angle;
                }

                // update and draw arcs
                for (let i = preset.arcs.length - 1; i >= 0; i--) {
                    const arc = preset.arcs[i];
                    arc.life -= 0.012;
                    if (arc.life <= 0) {
                        preset.arcs.splice(i, 1);
                        continue;
                    }
                    preset._drawArc(p, arc);
                }

                // maintain minimum arcs
                if (preset.arcs.length < 2) {
                    preset._spawnArc(p);
                }

                // sparks
                for (let i = preset.sparks.length - 1; i >= 0; i--) {
                    const sp = preset.sparks[i];
                    sp.x += sp.vx;
                    sp.y += sp.vy;
                    sp.vy += 0.15;
                    sp.life -= 0.04;
                    if (sp.life <= 0) {
                        preset.sparks.splice(i, 1);
                        continue;
                    }
                    const alpha = sp.life * 255;
                    p.noStroke();
                    p.fill(sp.r, sp.g, sp.b, alpha);
                    p.circle(sp.x, sp.y, 2.5);
                }

                // draw node points
                for (const node of preset.nodes) {
                    p.noStroke();
                    p.fill(0, 255, 255, 40);
                    p.circle(node.x, node.y, 16);
                    p.fill(0, 255, 255, 150);
                    p.circle(node.x, node.y, 5);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                preset._initNodes(p);
            };
        }, container);
    }

    _initNodes(p) {
        this.nodes = [];
        const w = p.width, h = p.height;
        // place 5 nodes on screen edges
        const edgePositions = [
            { x: w * 0.2, y: 0, angle: Math.PI * 0.5 },
            { x: w * 0.8, y: 0, angle: Math.PI * 0.4 },
            { x: w, y: h * 0.4, angle: Math.PI * 0.9 },
            { x: 0, y: h * 0.6, angle: -Math.PI * 0.2 },
            { x: w * 0.5, y: h, angle: -Math.PI * 0.5 },
        ];
        for (const pos of edgePositions) {
            this.nodes.push({ x: pos.x, y: pos.y, angle: pos.angle });
        }
    }

    _spawnArc(p) {
        if (this.nodes.length < 2) return;
        const i1 = Math.floor(Math.random() * this.nodes.length);
        let i2 = Math.floor(Math.random() * (this.nodes.length - 1));
        if (i2 >= i1) i2++;
        const n1 = this.nodes[i1], n2 = this.nodes[i2];
        this.arcs.push({
            n1: i1, n2: i2,
            life: 0.7 + Math.random() * 0.5,
        });

        // sparks at endpoints
        this._emitSparks(n1.x, n1.y, 4);
        this._emitSparks(n2.x, n2.y, 4);
    }

    _emitSparks(x, y, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            this.sparks.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.5,
                r: Math.random() < 0.5 ? 0 : 200,
                g: Math.random() < 0.5 ? 255 : 200,
                b: 255,
            });
        }
    }

    _drawArc(p, arc) {
        const n1 = this.nodes[arc.n1], n2 = this.nodes[arc.n2];
        const alpha = Math.min(arc.life, 1) * 255;
        const segments = 12;

        // generate zigzag midpoints (new each frame for flicker)
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const bx = n1.x + (n2.x - n1.x) * t;
            const by = n1.y + (n2.y - n1.y) * t;
            if (i === 0 || i === segments) {
                points.push({ x: bx, y: by });
            } else {
                const perpX = -(n2.y - n1.y);
                const perpY = (n2.x - n1.x);
                const len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
                const offset = (Math.random() - 0.5) * 50;
                points.push({
                    x: bx + (perpX / len) * offset,
                    y: by + (perpY / len) * offset,
                });
            }
        }

        // purple glow
        p.stroke(150, 0, 255, alpha * 0.25);
        p.strokeWeight(8);
        p.noFill();
        p.beginShape();
        for (const pt of points) p.vertex(pt.x, pt.y);
        p.endShape();

        // main arc - cyan/white
        p.stroke(180, 240, 255, alpha);
        p.strokeWeight(2);
        p.beginShape();
        for (const pt of points) p.vertex(pt.x, pt.y);
        p.endShape();

        // bright core
        p.stroke(255, 255, 255, alpha * 0.6);
        p.strokeWeight(1);
        p.beginShape();
        for (const pt of points) p.vertex(pt.x, pt.y);
        p.endShape();
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        if (this.p5) {
            this._spawnArc(this.p5);
            // extra sparks on beat
            for (const node of this.nodes) {
                if (Math.random() < 0.4) {
                    this._emitSparks(node.x, node.y, 6);
                }
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['electric-arc'] = ElectricArcPreset;
})();
