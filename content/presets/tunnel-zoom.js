(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class TunnelZoom extends BasePreset {
    constructor() {
        super();
        this.params = { ringCount: 30, speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.phase = 0;
        this.burstRings = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.88;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxR = Math.sqrt(cx * cx + cy * cy) * 1.2;
                const rings = preset.params.ringCount;

                // Expansion speed: base + bass boost
                const speed = (0.008 + preset.audio.bass * 0.015) * preset.params.speed;
                preset.phase += speed * (1 + preset.beatPulse * 3);

                // Treble color tinting
                const trebleHue = preset.audio.treble;
                const colorMix = Math.min(preset.audio.treble * 1.5 + preset.audio.rms * 0.5, 1);

                // Process burst rings (from beats)
                for (let i = preset.burstRings.length - 1; i >= 0; i--) {
                    preset.burstRings[i].r += preset.burstRings[i].speed;
                    if (preset.burstRings[i].r > maxR) {
                        preset.burstRings.splice(i, 1);
                    }
                }

                p.noStroke();

                // Draw alternating concentric rings expanding outward
                // The key optical illusion: alternating black/white rings expanding
                // creates a powerful tunnel/vortex motion sensation
                for (let i = rings; i >= 0; i--) {
                    // Phase-shifted ring position for continuous expansion
                    const t = ((i / rings) + preset.phase) % 1;
                    const r = t * maxR;

                    if (r < 2) continue;

                    // Alternating: even rings are bright, odd rings are black (background)
                    const isLight = i % 2 === 0;

                    if (isLight) {
                        // Base white with treble-driven color tinting
                        const tint = colorMix;
                        const hueAngle = (p.frameCount * 0.5 + i * 10) * 0.01;
                        const rr = 255 * (1 - tint) + (128 + Math.sin(hueAngle) * 127) * tint;
                        const gg = 255 * (1 - tint) + (128 + Math.sin(hueAngle + 2.09) * 127) * tint;
                        const bb = 255 * (1 - tint) + (128 + Math.sin(hueAngle + 4.19) * 127) * tint;

                        // Brightness boost on beat
                        const bright = 1 + preset.beatPulse * 0.5;
                        p.fill(
                            Math.min(rr * bright, 255),
                            Math.min(gg * bright, 255),
                            Math.min(bb * bright, 255),
                            220
                        );
                    } else {
                        // Dark rings: not pure black, slight tint for depth
                        const darkTint = colorMix * 0.3;
                        const hueAngle = (p.frameCount * 0.5 + i * 10) * 0.01;
                        p.fill(
                            20 * darkTint + Math.sin(hueAngle) * 10 * darkTint,
                            10 * darkTint,
                            20 * darkTint + Math.sin(hueAngle + 4.19) * 10 * darkTint,
                            220
                        );
                    }

                    // Ring thickness: varies slightly with distance for depth illusion
                    const nextT = (((i - 1) / rings) + preset.phase) % 1;
                    const nextR = nextT * maxR;
                    const innerR = Math.max(nextR, 0);

                    // Draw ring as a thick ellipse (outer minus inner)
                    // Draw outer filled circle then punch inner with next ring
                    p.ellipse(cx, cy, r * 2, r * 2);
                }

                // Draw burst rings from beats (bright accent rings)
                p.noFill();
                for (const burst of preset.burstRings) {
                    const alpha = Math.max(0, 200 * (1 - burst.r / maxR));
                    p.strokeWeight(burst.thickness);
                    p.stroke(burst.r1, burst.g1, burst.b1, alpha);
                    p.ellipse(cx, cy, burst.r * 2, burst.r * 2);
                }

                // Center dark spot for depth
                p.noStroke();
                p.fill(0, 255);
                p.ellipse(cx, cy, 8, 8);

                // Subtle radial lines for extra vortex feel
                const lineCount = 12;
                p.strokeWeight(1);
                for (let i = 0; i < lineCount; i++) {
                    const angle = (i / lineCount) * p.TWO_PI + preset.phase * 2;
                    const alpha = 25 + preset.audio.rms * 30;
                    p.stroke(255, 255, 255, alpha);
                    const innerDist = 10;
                    const outerDist = maxR;
                    p.line(
                        cx + Math.cos(angle) * innerDist,
                        cy + Math.sin(angle) * innerDist,
                        cx + Math.cos(angle) * outerDist,
                        cy + Math.sin(angle) * outerDist
                    );
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
        // Spawn burst rings on beat
        const count = Math.ceil(strength * 3);
        for (let i = 0; i < count; i++) {
            const hue = Math.random() * 360;
            const h = hue * Math.PI / 180;
            this.burstRings.push({
                r: 5 + i * 15,
                speed: 4 + strength * 8 + Math.random() * 3,
                thickness: 2 + strength * 5,
                r1: Math.min(255, 128 + Math.cos(h) * 127),
                g1: Math.min(255, 128 + Math.cos(h + 2.09) * 127),
                b1: Math.min(255, 128 + Math.cos(h + 4.19) * 127)
            });
        }
    }
}

window.VJamFX.presets['tunnel-zoom'] = TunnelZoom;
})();
