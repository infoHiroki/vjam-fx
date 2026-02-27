(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NeuralNetPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this._nodes = null;
    }

    setup(container) {
        this.destroy();
        const preset = this;
        this.p5 = new p5((p) => {
            const nodes = [];
            const connections = [];
            const NUM_NODES = 40;
            const CONNECT_DIST = 200;
            preset._nodes = nodes;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);

                for (let i = 0; i < NUM_NODES; i++) {
                    nodes.push({
                        x: p.random(60, p.width - 60),
                        y: p.random(60, p.height - 60),
                        vx: p.random(-0.3, 0.3),
                        vy: p.random(-0.3, 0.3),
                        fire: 0,
                        fireDelay: -1,
                        size: p.random(4, 8),
                        idx: i
                    });
                }

                // Build connections
                rebuildConnections();
            };

            function rebuildConnections() {
                connections.length = 0;
                for (let i = 0; i < nodes.length; i++) {
                    for (let j = i + 1; j < nodes.length; j++) {
                        const dx = nodes[i].x - nodes[j].x;
                        const dy = nodes[i].y - nodes[j].y;
                        if (p.sqrt(dx * dx + dy * dy) < CONNECT_DIST) {
                            connections.push({ a: i, b: j });
                        }
                    }
                }
            }

            p.draw = () => {
                p.background(5, 30, 6);
                preset.beatPulse *= 0.92;

                for (const node of nodes) {
                    node.x += node.vx;
                    node.y += node.vy;

                    if (node.x < 30 || node.x > p.width - 30) node.vx *= -1;
                    if (node.y < 30 || node.y > p.height - 30) node.vy *= -1;

                    if (node.fire > 0) node.fire *= 0.95;

                    if (node.fireDelay > 0) {
                        node.fireDelay--;
                    } else if (node.fireDelay === 0) {
                        node.fire = 1;
                        node.fireDelay = -1;
                        for (const conn of connections) {
                            let target = -1;
                            if (conn.a === node.idx) target = conn.b;
                            if (conn.b === node.idx) target = conn.a;
                            if (target >= 0 && nodes[target].fire < 0.3 && nodes[target].fireDelay < 0) {
                                nodes[target].fireDelay = p.floor(p.random(5, 15));
                            }
                        }
                    }

                    if (p.random() < 0.002 && node.fire < 0.1) {
                        node.fire = 1;
                    }
                }

                // Draw connections
                for (const conn of connections) {
                    const a = nodes[conn.a];
                    const b = nodes[conn.b];
                    const fireBrightness = p.max(a.fire, b.fire);
                    const hue = fireBrightness > 0.5 ? 0 : 310;
                    const brightness = 30 + fireBrightness * 70;
                    const alpha = 20 + fireBrightness * 60;

                    p.stroke(hue, 70, brightness, alpha);
                    p.strokeWeight(0.8 + fireBrightness * 1.5);
                    p.line(a.x, a.y, b.x, b.y);
                }

                // Draw nodes
                p.noStroke();
                for (const node of nodes) {
                    const hue = node.fire > 0.5 ? 0 : 190;
                    const brightness = 50 + node.fire * 50;
                    const alpha = 60 + node.fire * 40;

                    if (node.fire > 0.3) {
                        p.fill(hue, 50, 100, node.fire * 20);
                        p.ellipse(node.x, node.y, node.size * 6, node.size * 6);
                    }

                    p.fill(hue, 70, brightness, alpha);
                    p.ellipse(node.x, node.y, node.size + node.fire * 4, node.size + node.fire * 4);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                for (const node of nodes) {
                    node.x = p.constrain(node.x, 30, p.width - 30);
                    node.y = p.constrain(node.y, 30, p.height - 30);
                }
                rebuildConnections();
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
        if (this._nodes && this._nodes.length > 0) {
            const count = Math.min(6, this._nodes.length);
            for (let i = 0; i < count; i++) {
                const idx = Math.floor(Math.random() * this._nodes.length);
                this._nodes[idx].fire = 1;
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['neural-net'] = NeuralNetPreset;
})();
