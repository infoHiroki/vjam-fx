(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CrystalLatticePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.nodes = [];
    }

    setup(container) {
        this.destroy();
        this.nodes = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                // Sparse lattice: fewer nodes, widely spread
                for (let i = 0; i < 25; i++) {
                    preset._addNode(p, false);
                }
            };

            p.draw = () => {
                p.background(0);
                const speed = preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;
                const t = p.frameCount * 0.003 * speed;

                const rotY = t * 0.35;
                const rotX = Math.sin(t * 0.12) * 0.25;
                const cx = p.width / 2;
                const cy = p.height / 2;
                const focalLen = Math.min(p.width, p.height) * 0.9;

                // Project 3D to 2D
                const projected = [];
                for (let i = 0; i < preset.nodes.length; i++) {
                    const n = preset.nodes[i];

                    // Grow outward slowly
                    if (n.growing) {
                        n.x += n.gx * 0.12 * speed;
                        n.y += n.gy * 0.12 * speed;
                        n.z += n.gz * 0.12 * speed;
                        const dist = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
                        if (dist > 400) n.growing = false;
                    }

                    // Rotate Y then X
                    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
                    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
                    let rx = n.x * cosY - n.z * sinY;
                    let rz = n.x * sinY + n.z * cosY;
                    let ry = n.y * cosX - rz * sinX;
                    rz = n.y * sinX + rz * cosX;

                    // Perspective
                    const z = rz + 500;
                    if (z < 50) { projected.push(null); continue; }
                    const scale = focalLen / z;
                    const sx = cx + rx * scale;
                    const sy = cy + ry * scale;
                    n.life -= 0.0003;

                    projected.push({ sx, sy, scale, depth: z, idx: i, life: n.life, hue: n.hue });
                }

                // Sort back-to-front for proper depth
                const sorted = projected.filter(a => a && a.life > 0);
                sorted.sort((a, b) => b.depth - a.depth);

                // Draw connections between nearby nodes (generous threshold for sparse layout)
                for (let i = 0; i < sorted.length; i++) {
                    const a = sorted[i];
                    for (let j = i + 1; j < sorted.length; j++) {
                        const b = sorted[j];
                        const dx = a.sx - b.sx;
                        const dy = a.sy - b.sy;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const threshold = 160 + pulse * 40;

                        if (dist < threshold) {
                            const alpha = (1 - dist / threshold) * 30 * Math.min(a.life, b.life);
                            const hue = (a.hue + b.hue) / 2;
                            const avgScale = (a.scale + b.scale) / 2;

                            // Outer glow line
                            p.strokeWeight(4 * avgScale * 0.3);
                            p.stroke(hue, 40, 50, alpha * 0.3);
                            p.line(a.sx, a.sy, b.sx, b.sy);

                            // Core line
                            p.strokeWeight(1.2 * avgScale * 0.3);
                            p.stroke(hue, 30, 80, alpha * 0.9);
                            p.line(a.sx, a.sy, b.sx, b.sy);
                        }
                    }
                }

                // Draw nodes with multi-layer glow
                for (const a of sorted) {
                    const nodeSize = Math.max(2, 5 * a.scale * 0.3);
                    const hue = (a.hue + preset.audio.mid * 15) % 360;
                    const bri = 50 + preset.audio.treble * 20 + pulse * 15;

                    p.noStroke();

                    // Wide soft glow
                    p.fill(hue, 30, bri * 0.4, 8 * a.life);
                    p.ellipse(a.sx, a.sy, nodeSize * 6, nodeSize * 6);

                    // Mid glow
                    p.fill(hue, 35, bri * 0.7, 18 * a.life);
                    p.ellipse(a.sx, a.sy, nodeSize * 3, nodeSize * 3);

                    // Bright core
                    p.fill(hue, 20, bri + 20, 50 * a.life);
                    p.ellipse(a.sx, a.sy, nodeSize * 1.2, nodeSize * 1.2);

                    // Hot white center
                    p.fill(hue, 10, 100, 40 * a.life);
                    p.ellipse(a.sx, a.sy, nodeSize * 0.5, nodeSize * 0.5);
                }

                // Beat: spawn a small cluster
                if (pulse > 0.3) {
                    for (let c = 0; c < 2; c++) {
                        preset._addNode(p, true);
                    }
                }

                // Periodic growth (keep sparse)
                if (p.frameCount % 120 === 0 && preset.nodes.length < 45) {
                    preset._addNode(p, true);
                }

                // Cleanup dead nodes
                if (preset.nodes.length > 45) {
                    preset.nodes = preset.nodes.filter(n => n.life > 0);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _addNode(p, growing) {
        // Wider spread: radius 80-350 (was 30-150)
        const r = 80 + Math.random() * 270;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        const len = Math.sqrt(x * x + y * y + z * z) || 1;
        this.nodes.push({
            x, y, z,
            gx: x / len * (0.2 + Math.random() * 0.4),
            gy: y / len * (0.2 + Math.random() * 0.4),
            gz: z / len * (0.2 + Math.random() * 0.4),
            hue: 185 + Math.random() * 40,
            life: 1,
            growing,
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
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['crystal-lattice'] = CrystalLatticePreset;
})();
