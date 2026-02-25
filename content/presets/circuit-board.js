(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class CircuitBoardPreset extends BasePreset {
        constructor() {
            super();
            this.params = { speed: 1 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.traces = [];
            this.pads = [];
        }

        setup(container) {
            this.destroy();
            const preset = this;

            this.p5 = new p5((p) => {
                const GRID = 20;
                const BG_COLOR = [10, 40, 20];
                const TRACE_COLOR = [60, 180, 80];

                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.strokeCap(p.SQUARE);
                    preset.traces = [];
                    preset.pads = [];
                    // Seed initial traces
                    for (let i = 0; i < 15; i++) {
                        preset._addTrace(p);
                    }
                };

                p.draw = () => {
                    const speed = preset.params.speed;
                    const bass = preset.audio.bass;
                    const treble = preset.audio.treble;
                    const pulse = preset.beatPulse;
                    preset.beatPulse *= 0.92;

                    p.background(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2]);

                    // Grow traces
                    for (const trace of preset.traces) {
                        if (trace.growing && p.frameCount % Math.max(1, Math.floor(4 / speed)) === 0) {
                            const last = trace.points[trace.points.length - 1];
                            // Right-angle routing: pick horizontal or vertical
                            const dirs = [[GRID, 0], [-GRID, 0], [0, GRID], [0, -GRID]];
                            const dir = dirs[Math.floor(Math.random() * dirs.length)];
                            const nx = last.x + dir[0];
                            const ny = last.y + dir[1];

                            if (nx >= 0 && nx <= p.width && ny >= 0 && ny <= p.height) {
                                trace.points.push({ x: nx, y: ny });
                                // Sometimes add a solder pad
                                if (Math.random() < 0.3) {
                                    preset.pads.push({ x: nx, y: ny, age: 0 });
                                }
                            }

                            if (trace.points.length > trace.maxLen) {
                                trace.growing = false;
                            }
                        }
                    }

                    // Draw traces
                    for (const trace of preset.traces) {
                        const alpha = 150 + bass * 100;
                        p.stroke(
                            TRACE_COLOR[0] + pulse * 80,
                            TRACE_COLOR[1] + pulse * 60,
                            TRACE_COLOR[2],
                            alpha
                        );
                        p.strokeWeight(2);
                        p.noFill();
                        for (let i = 1; i < trace.points.length; i++) {
                            p.line(
                                trace.points[i - 1].x, trace.points[i - 1].y,
                                trace.points[i].x, trace.points[i].y
                            );
                        }
                    }

                    // Draw solder pads
                    p.noStroke();
                    for (const pad of preset.pads) {
                        pad.age++;
                        const glow = pulse > 0.3 ? 40 : 0;
                        p.fill(
                            TRACE_COLOR[0] + 40 + glow,
                            TRACE_COLOR[1] + 40 + glow,
                            TRACE_COLOR[2] + 20,
                            180
                        );
                        p.ellipse(pad.x, pad.y, 8, 8);
                        // Inner ring
                        p.fill(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2]);
                        p.ellipse(pad.x, pad.y, 4, 4);
                    }

                    // Beat: spawn new traces
                    if (pulse > 0.3) {
                        const count = Math.floor(pulse * 4) + 1;
                        for (let i = 0; i < count; i++) {
                            preset._addTrace(p);
                        }
                    }

                    // Limit total traces
                    if (preset.traces.length > 60) {
                        preset.traces.splice(0, preset.traces.length - 60);
                    }
                    if (preset.pads.length > 200) {
                        preset.pads.splice(0, preset.pads.length - 200);
                    }
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                };
            }, container);
        }

        _addTrace(p) {
            const GRID = 20;
            const x = Math.floor(Math.random() * (p.width / GRID)) * GRID;
            const y = Math.floor(Math.random() * (p.height / GRID)) * GRID;
            this.traces.push({
                points: [{ x, y }],
                maxLen: 10 + Math.floor(Math.random() * 30),
                growing: true
            });
            this.pads.push({ x, y, age: 0 });
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
        }
    }

    window.VJamFX.presets['circuit-board'] = CircuitBoardPreset;
})();
