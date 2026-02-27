(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CircuitTracePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.traces = [];
        this.nodes = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                preset.traces = [];
                preset.nodes = [];
                // Spawn initial traces
                for (let i = 0; i < 5; i++) {
                    preset._spawnTrace(p);
                }
            };

            p.draw = () => {
                p.background(5, 5, 15, 40);
                preset.beatPulse *= 0.92;

                // Update and draw traces
                for (let i = preset.traces.length - 1; i >= 0; i--) {
                    const trace = preset.traces[i];
                    trace.age += 1;
                    trace.alpha -= 0.3;

                    if (trace.alpha <= 0) {
                        preset.traces.splice(i, 1);
                        continue;
                    }

                    // Grow trace
                    if (trace.growing && trace.age % 2 === 0) {
                        const step = 8;
                        const nx = trace.x + trace.dx * step;
                        const ny = trace.y + trace.dy * step;

                        // Add segment
                        trace.segments.push({ x1: trace.x, y1: trace.y, x2: nx, y2: ny });
                        trace.x = nx;
                        trace.y = ny;

                        // Random turn or branch
                        if (Math.random() < 0.08) {
                            // Branch
                            const dirs = preset._getDirections();
                            const newDir = dirs[Math.floor(Math.random() * dirs.length)];
                            preset.nodes.push({ x: trace.x, y: trace.y, alpha: 255 });
                            if (preset.traces.length < 60) {
                                preset.traces.push({
                                    x: trace.x, y: trace.y,
                                    dx: newDir.dx, dy: newDir.dy,
                                    segments: [],
                                    alpha: trace.alpha,
                                    age: 0,
                                    growing: true,
                                });
                            }
                        } else if (Math.random() < 0.12) {
                            // Turn 90 degrees
                            const temp = trace.dx;
                            trace.dx = -trace.dy;
                            trace.dy = temp;
                            if (Math.random() < 0.5) {
                                trace.dx = -trace.dx;
                                trace.dy = -trace.dy;
                            }
                            preset.nodes.push({ x: trace.x, y: trace.y, alpha: 255 });
                        }

                        // Stop if off screen
                        if (trace.x < -50 || trace.x > p.width + 50 || trace.y < -50 || trace.y > p.height + 50) {
                            trace.growing = false;
                        }

                        // Limit segment count
                        if (trace.segments.length > 80) {
                            trace.growing = false;
                        }
                    }

                    // Draw segments with glow
                    const a = Math.min(trace.alpha, 255);
                    for (const seg of trace.segments) {
                        // Glow (thick, dim)
                        p.stroke(0, 255, 0, a * 0.3);
                        p.strokeWeight(4);
                        p.line(seg.x1, seg.y1, seg.x2, seg.y2);
                        // Core (thin, bright)
                        p.stroke(0, 255, 0, a);
                        p.strokeWeight(1.5);
                        p.line(seg.x1, seg.y1, seg.x2, seg.y2);
                    }
                }

                // Draw nodes
                for (let i = preset.nodes.length - 1; i >= 0; i--) {
                    const node = preset.nodes[i];
                    node.alpha -= 0.5;
                    if (node.alpha <= 0) {
                        preset.nodes.splice(i, 1);
                        continue;
                    }
                    p.noStroke();
                    // Glow
                    p.fill(0, 255, 0, node.alpha * 0.2);
                    p.ellipse(node.x, node.y, 12, 12);
                    // Core
                    p.fill(0, 255, 0, node.alpha);
                    p.ellipse(node.x, node.y, 5, 5);
                }

                // Auto-spawn periodically
                if (p.frameCount % 60 === 0 && preset.traces.length < 10) {
                    preset._spawnTrace(p);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _getDirections() {
        return [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
            { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
            { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
        ];
    }

    _spawnTrace(p) {
        const cx = p.width / 2 + (Math.random() - 0.5) * p.width * 0.4;
        const cy = p.height / 2 + (Math.random() - 0.5) * p.height * 0.4;
        const dirs = this._getDirections();
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        this.traces.push({
            x: cx, y: cy,
            dx: dir.dx, dy: dir.dy,
            segments: [],
            alpha: 255,
            age: 0,
            growing: true,
        });
        this.nodes.push({ x: cx, y: cy, alpha: 255 });
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
            const count = 1 + Math.floor(strength * 3);
            for (let i = 0; i < count; i++) {
                this._spawnTrace(this.p5);
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['circuit-trace'] = CircuitTracePreset;
})();
