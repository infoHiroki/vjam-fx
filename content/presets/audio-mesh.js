(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class AudioMeshPreset extends BasePreset {
    constructor() {
        super();
        this.params = { gridSize: 36, speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.heights = [];
        this.ripple = { x: 0, y: 0, time: -1 };
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                preset._initGrid();
            };

            p.draw = () => {
                p.background(0);

                const gs = preset.params.gridSize;
                const cx = p.width / 2;
                const cy = p.height * 0.55;

                // Cell size scales to fill ~85% of width
                const cs = (p.width * 0.85) / gs;

                // Update heights with noise + audio
                const time = p.frameCount * 0.018 * preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;

                for (let gy = 0; gy < gs; gy++) {
                    for (let gx = 0; gx < gs; gx++) {
                        let h = p.noise(gx * 0.12, gy * 0.12, time) * 50;

                        // Audio displacement — bass deforms center dramatically
                        const dx = gx - gs / 2;
                        const dy = gy - gs / 2;
                        const dist = Math.sqrt(dx * dx + dy * dy) / (gs / 2);
                        h += bass * (1 - dist) * 120;
                        h += mid * (0.5 + 0.5 * Math.sin(dist * 4 + time * 2)) * 40;
                        h += treble * dist * 35;

                        // Beat ripple
                        if (preset.ripple.time >= 0) {
                            const rdx = gx - preset.ripple.x;
                            const rdy = gy - preset.ripple.y;
                            const rd = Math.sqrt(rdx * rdx + rdy * rdy);
                            const ripplePhase = rd * 0.4 - preset.ripple.time * 3.5;
                            if (ripplePhase > -Math.PI && ripplePhase < Math.PI) {
                                h += Math.cos(ripplePhase) * 50 * Math.max(0, 1 - preset.ripple.time * 0.25);
                            }
                        }

                        // Smooth toward target
                        const idx = gy * gs + gx;
                        preset.heights[idx] = p.lerp(preset.heights[idx] || 0, h, 0.25);
                    }
                }

                // Advance ripple
                if (preset.ripple.time >= 0) {
                    preset.ripple.time += 0.1;
                    if (preset.ripple.time > 6) preset.ripple.time = -1;
                }

                // Isometric projection — centered, fills screen
                const tiltX = 0.7;
                const tiltY = 0.45;
                const project = (gx, gy, h) => {
                    const wx = (gx - gs / 2) * cs;
                    const wy = (gy - gs / 2) * cs;
                    const sx = cx + wx * tiltX - wy * tiltX;
                    const sy = cy + wx * tiltY + wy * tiltY - h;
                    return { x: sx, y: sy };
                };

                // Height-based color with glow
                const colorForHeight = (h) => {
                    const t = Math.min(1, Math.max(0, h / 100));
                    const r = Math.floor(30 + t * 200 + rms * 25);
                    const g = Math.floor(100 + t * 155 - t * t * 80);
                    const b = Math.floor(220 - t * 100 + bass * 35);
                    const a = 140 + t * 115;
                    return [Math.min(r, 255), Math.min(g, 255), Math.min(b, 255), Math.min(a, 255)];
                };

                // Draw glow layer (thicker, low alpha) then crisp lines
                for (let pass = 0; pass < 2; pass++) {
                    const isGlow = pass === 0;
                    p.strokeWeight(isGlow ? 3.5 : 1.2);
                    p.noFill();

                    // Draw rows (X direction)
                    for (let gy = 0; gy < gs; gy++) {
                        for (let gx = 0; gx < gs - 1; gx++) {
                            const idx0 = gy * gs + gx;
                            const idx1 = gy * gs + gx + 1;
                            const h0 = preset.heights[idx0];
                            const h1 = preset.heights[idx1];
                            const p0 = project(gx, gy, h0);
                            const p1 = project(gx + 1, gy, h1);
                            const c = colorForHeight((h0 + h1) * 0.5);
                            if (isGlow) {
                                p.stroke(c[0], c[1], c[2], c[3] * 0.2);
                            } else {
                                p.stroke(c[0], c[1], c[2], c[3]);
                            }
                            p.line(p0.x, p0.y, p1.x, p1.y);
                        }
                    }

                    // Draw cols (Y direction)
                    for (let gx = 0; gx < gs; gx++) {
                        for (let gy = 0; gy < gs - 1; gy++) {
                            const idx0 = gy * gs + gx;
                            const idx1 = (gy + 1) * gs + gx;
                            const h0 = preset.heights[idx0];
                            const h1 = preset.heights[idx1];
                            const p0 = project(gx, gy, h0);
                            const p1 = project(gx, gy + 1, h1);
                            const c = colorForHeight((h0 + h1) * 0.5);
                            if (isGlow) {
                                p.stroke(c[0], c[1], c[2], c[3] * 0.2);
                            } else {
                                p.stroke(c[0], c[1], c[2], c[3]);
                            }
                            p.line(p0.x, p0.y, p1.x, p1.y);
                        }
                    }
                }

                // Highlight peaks with bright dots
                for (let gy = 0; gy < gs; gy += 3) {
                    for (let gx = 0; gx < gs; gx += 3) {
                        const idx = gy * gs + gx;
                        const h = preset.heights[idx];
                        if (h > 60) {
                            const pt = project(gx, gy, h);
                            const bright = Math.min((h - 60) / 40, 1);
                            p.noStroke();
                            p.fill(200 + bright * 55, 220 + bright * 35, 255, 120 + bright * 135);
                            p.ellipse(pt.x, pt.y, 3 + bright * 4, 3 + bright * 4);
                        }
                    }
                }

                preset.beatPulse *= 0.9;
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _initGrid() {
        const gs = this.params.gridSize;
        this.heights = new Array(gs * gs).fill(0);
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        // Trigger ripple from near center for dramatic effect
        const gs = this.params.gridSize;
        const centerRange = gs * 0.3;
        this.ripple.x = gs / 2 + (Math.random() - 0.5) * centerRange;
        this.ripple.y = gs / 2 + (Math.random() - 0.5) * centerRange;
        this.ripple.time = 0;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['audio-mesh'] = AudioMeshPreset;
})();
