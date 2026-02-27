(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class HexNetworkPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.nodes = [];
        this.edges = [];
        this.packets = [];
        this.hexRadius = 60;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                preset._buildGrid(p);
            };

            p.draw = () => {
                p.background(5, 5, 15);
                preset.beatPulse *= 0.92;

                const t = p.frameCount * 0.02;

                // Draw edges
                for (const edge of preset.edges) {
                    const n1 = preset.nodes[edge[0]];
                    const n2 = preset.nodes[edge[1]];
                    p.stroke(0, 255, 200, 30 + edge.glow * 200);
                    p.strokeWeight(1 + edge.glow * 2);
                    p.line(n1.x, n1.y, n2.x, n2.y);
                    edge.glow *= 0.95;
                }

                // Draw nodes
                for (let i = 0; i < preset.nodes.length; i++) {
                    const node = preset.nodes[i];
                    const pulse = Math.sin(t + i * 0.5) * 0.3 + 0.7;
                    const r = 4 + pulse * 3 + preset.beatPulse * 3;
                    // Glow
                    p.noStroke();
                    p.fill(0, 255, 200, 30 * pulse);
                    p.ellipse(node.x, node.y, r * 4, r * 4);
                    // Core
                    p.fill(0, 255, 200, 150 + pulse * 105);
                    p.ellipse(node.x, node.y, r, r);
                }

                // Update and draw packets
                for (let i = preset.packets.length - 1; i >= 0; i--) {
                    const pkt = preset.packets[i];
                    pkt.t += pkt.speed;
                    if (pkt.t >= 1) {
                        // Arrived: light up edge and pick next
                        const edge = preset.edges[pkt.edgeIdx];
                        if (edge) edge.glow = 1;
                        const currentNode = preset.nodes[edge[1]];
                        // Find connected edges
                        const connected = [];
                        for (let j = 0; j < preset.edges.length; j++) {
                            if (preset.edges[j][0] === edge[1] || preset.edges[j][1] === edge[1]) {
                                connected.push(j);
                            }
                        }
                        if (connected.length > 0 && Math.random() < 0.7) {
                            const nextEdgeIdx = connected[Math.floor(Math.random() * connected.length)];
                            const ne = preset.edges[nextEdgeIdx];
                            pkt.edgeIdx = nextEdgeIdx;
                            pkt.fromIdx = ne[0] === edge[1] ? 0 : 1;
                            pkt.t = 0;
                        } else {
                            preset.packets.splice(i, 1);
                        }
                        continue;
                    }

                    const edge = preset.edges[pkt.edgeIdx];
                    const fromNode = preset.nodes[edge[pkt.fromIdx === 0 ? 0 : 1]];
                    const toNode = preset.nodes[edge[pkt.fromIdx === 0 ? 1 : 0]];
                    const px = p.lerp(fromNode.x, toNode.x, pkt.t);
                    const py = p.lerp(fromNode.y, toNode.y, pkt.t);

                    // Trail glow
                    p.noStroke();
                    p.fill(0, 255, 255, 40);
                    p.ellipse(px, py, 12, 12);
                    // Core
                    p.fill(200, 255, 255, 240);
                    p.ellipse(px, py, 5, 5);
                }

                // Spawn packets periodically
                if (p.frameCount % 30 === 0 && preset.edges.length > 0) {
                    preset._spawnPacket();
                }

                // Keep packet count reasonable
                if (preset.packets.length > 30) {
                    preset.packets.splice(0, preset.packets.length - 30);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                preset._buildGrid(p);
            };
        }, container);
    }

    _buildGrid(p) {
        this.nodes = [];
        this.edges = [];
        const r = this.hexRadius;
        const w = r * 2;
        const h = r * Math.sqrt(3);

        for (let col = -1; col <= Math.ceil(p.width / (w * 0.75)) + 1; col++) {
            for (let row = -1; row <= Math.ceil(p.height / h) + 1; row++) {
                const x = col * w * 0.75;
                const y = row * h + (col % 2 === 0 ? 0 : h / 2);
                this.nodes.push({ x, y });
            }
        }

        // Connect nearby nodes
        const maxDist = r * 1.9;
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const dx = this.nodes[i].x - this.nodes[j].x;
                const dy = this.nodes[i].y - this.nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < maxDist) {
                    const edge = [i, j];
                    edge.glow = 0;
                    this.edges.push(edge);
                }
            }
        }
    }

    _spawnPacket() {
        if (this.edges.length === 0) return;
        const edgeIdx = Math.floor(Math.random() * this.edges.length);
        this.packets.push({
            edgeIdx,
            fromIdx: 0,
            t: 0,
            speed: 0.02 + Math.random() * 0.02,
        });
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        const count = 2 + Math.floor(strength * 4);
        for (let i = 0; i < count; i++) {
            this._spawnPacket();
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['hex-network'] = HexNetworkPreset;
})();
