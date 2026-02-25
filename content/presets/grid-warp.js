(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class GridWarpPreset extends BasePreset {
        constructor() {
            super();
            this.params = { speed: 1 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.ripples = [];
        }

        setup(container) {
            this.destroy();
            const preset = this;

            this.p5 = new p5((p) => {
                const GRID_SPACING = 20;

                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                };

                p.draw = () => {
                    p.background(0, 0, 5);
                    preset.beatPulse *= 0.92;

                    const t = p.frameCount * 0.01 * preset.params.speed;
                    const bass = preset.audio.bass;
                    const mid = preset.audio.mid;
                    const treble = preset.audio.treble;
                    const cx = p.width / 2;
                    const cy = p.height / 2;

                    // Update ripples (write-index pattern)
                    let w = 0;
                    for (let i = 0; i < preset.ripples.length; i++) {
                        preset.ripples[i].radius += 4;
                        preset.ripples[i].life -= 0.015;
                        if (preset.ripples[i].life > 0) {
                            preset.ripples[w++] = preset.ripples[i];
                        }
                    }
                    preset.ripples.length = w;

                    // Draw dot grid with Perlin noise displacement
                    const noiseScale = 0.02 + treble * 0.02;
                    const warpStrength = 8 + bass * 20;

                    for (let gx = 0; gx < p.width + GRID_SPACING; gx += GRID_SPACING) {
                        for (let gy = 0; gy < p.height + GRID_SPACING; gy += GRID_SPACING) {
                            // Perlin noise displacement
                            const nx = gx * noiseScale + t;
                            const ny = gy * noiseScale + t * 0.7;
                            const dx = (p.noise(nx, ny) - 0.5) * warpStrength;
                            const dy = (p.noise(nx + 100, ny + 100) - 0.5) * warpStrength;

                            // Ripple displacement
                            let rippleDx = 0;
                            let rippleDy = 0;
                            for (const ripple of preset.ripples) {
                                const rdx = gx - ripple.x;
                                const rdy = gy - ripple.y;
                                const dist = Math.sqrt(rdx * rdx + rdy * rdy);
                                const ringDist = Math.abs(dist - ripple.radius);
                                if (ringDist < 40) {
                                    const force = ripple.life * 15 * Math.exp(-ringDist * 0.1);
                                    if (dist > 0) {
                                        rippleDx += (rdx / dist) * force;
                                        rippleDy += (rdy / dist) * force;
                                    }
                                }
                            }

                            const finalX = gx + dx + rippleDx;
                            const finalY = gy + dy + rippleDy;

                            // Distance from center for color
                            const distFromCenter = Math.sqrt((gx - cx) * (gx - cx) + (gy - cy) * (gy - cy));
                            const maxDist = Math.sqrt(cx * cx + cy * cy);
                            const normDist = distFromCenter / maxDist;

                            const hue = (normDist * 180 + mid * 120 + t * 20) % 360;
                            const bri = 40 + bass * 30 + preset.beatPulse * 20;
                            const dotSize = 2 + bass * 2 + (Math.abs(dx) + Math.abs(dy)) * 0.1;

                            p.noStroke();
                            p.fill(hue, 60 + treble * 30, Math.min(100, bri), 80);
                            p.ellipse(finalX, finalY, dotSize, dotSize);
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
        this.audio.strength = audioData.strength || 0;
        }

        onBeat(strength) {
            this.beatPulse = strength;
            // Spawn ripple from center
            if (this.p5) {
                const p = this.p5;
                this.ripples.push({
                    x: p.width / 2,
                    y: p.height / 2,
                    radius: 0,
                    life: 1,
                });
                if (this.ripples.length > 5) {
                    this.ripples.shift();
                }
            }
        }
    }

    window.VJamFX.presets['grid-warp'] = GridWarpPreset;
})();
