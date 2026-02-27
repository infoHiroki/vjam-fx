(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CheckerWavePreset extends BasePreset {
    constructor() {
        super();
        this.params = {
            cellSize: 40,
            waveAmplitude: 0.4,
            waveFrequency: 0.08,
        };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.rippleTime = 0;
        this.rippleStrength = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noStroke();
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.92;
                preset.rippleStrength *= 0.96;
                preset.rippleTime += 0.05;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const cellSize = preset.params.cellSize;
                const cols = Math.ceil(p.width / cellSize) + 4;
                const rows = Math.ceil(p.height / cellSize) + 4;
                const time = p.frameCount * 0.02;

                // Wave parameters driven by audio
                const amp = preset.params.waveAmplitude * (1 + preset.audio.bass * 3 + preset.beatPulse * 2);
                const freq = preset.params.waveFrequency * (1 + preset.audio.mid * 2);

                for (let gy = -2; gy < rows; gy++) {
                    for (let gx = -2; gx < cols; gx++) {
                        const baseX = gx * cellSize;
                        const baseY = gy * cellSize;

                        // Distance from center for ripple effect
                        const dcx = baseX + cellSize / 2 - cx;
                        const dcy = baseY + cellSize / 2 - cy;
                        const distCenter = Math.sqrt(dcx * dcx + dcy * dcy);

                        // Main sine wave distortion (horizontal wave)
                        const waveOffset = Math.sin(baseY * freq + time * 2) * cellSize * amp;

                        // Secondary vertical wave
                        const waveOffset2 = Math.sin(baseX * freq * 0.7 + time * 1.5) * cellSize * amp * 0.5;

                        // Beat ripple from center
                        const ripple = preset.rippleStrength *
                            Math.sin(distCenter * 0.02 - preset.rippleTime * 3) *
                            cellSize * 0.6 *
                            Math.max(0, 1 - distCenter / (Math.max(p.width, p.height) * 0.8));

                        const dx = waveOffset + ripple * (dcx / (distCenter + 1)) * 0.3;
                        const dy = waveOffset2 + ripple * (dcy / (distCenter + 1)) * 0.3;

                        const fx = baseX + dx;
                        const fy = baseY + dy;

                        // Checker pattern
                        const isWhite = (gx + gy) % 2 === 0;

                        // Distortion intensity affects brightness
                        const distortion = Math.abs(dx) + Math.abs(dy);
                        const brightness = isWhite
                            ? 200 + Math.min(55, distortion * 1.5)
                            : 10 + Math.min(40, distortion * 0.8);

                        // Add subtle color tint based on wave phase
                        const phase = Math.sin(baseY * freq + time * 2);
                        if (isWhite) {
                            const r = brightness + phase * 20;
                            const g = brightness - Math.abs(phase) * 15;
                            const b = brightness + Math.cos(time + distCenter * 0.005) * 25;
                            p.fill(
                                Math.max(120, Math.min(255, r)),
                                Math.max(120, Math.min(255, g)),
                                Math.max(120, Math.min(255, b))
                            );
                        } else {
                            p.fill(brightness);
                        }

                        // Draw warped cell as quad for proper distortion
                        const s = cellSize;
                        const corners = [
                            [0, 0], [s, 0], [s, s], [0, s]
                        ];

                        // Per-corner distortion for true warping
                        p.beginShape();
                        for (const [ox, oy] of corners) {
                            const px = baseX + ox;
                            const py = baseY + oy;
                            const cd = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
                            const localWave = Math.sin(py * freq + time * 2) * cellSize * amp;
                            const localWave2 = Math.sin(px * freq * 0.7 + time * 1.5) * cellSize * amp * 0.5;
                            const localRipple = preset.rippleStrength *
                                Math.sin(cd * 0.02 - preset.rippleTime * 3) *
                                cellSize * 0.6 *
                                Math.max(0, 1 - cd / (Math.max(p.width, p.height) * 0.8));

                            const cdx = px - cx;
                            const cdy = py - cy;
                            const vx = px + localWave + localRipple * (cdx / (cd + 1)) * 0.3;
                            const vy = py + localWave2 + localRipple * (cdy / (cd + 1)) * 0.3;
                            p.vertex(vx, vy);
                        }
                        p.endShape(p.CLOSE);
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
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
        this.rippleStrength = strength;
        this.rippleTime = 0;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['checker-wave'] = CheckerWavePreset;
})();
