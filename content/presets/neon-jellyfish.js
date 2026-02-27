(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NeonJellyfishPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.jellyfish = [];
    }

    setup(container) {
        this.destroy();
        this.jellyfish = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                // 6 jellyfish at varying depths/sizes
                for (let i = 0; i < 6; i++) {
                    preset.jellyfish.push(preset._createJellyfish(p, i));
                }
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.92;

                // Sort by depth (smaller = further back, draw first)
                const sorted = [...preset.jellyfish].sort((a, b) => a.depthScale - b.depthScale);
                for (const jf of sorted) {
                    preset._updateJellyfish(p, jf);
                    preset._drawJellyfish(p, jf);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _createJellyfish(p, index) {
        const colors = [
            [0, 255, 255],
            [255, 80, 255],
            [160, 60, 255],
            [255, 120, 200],
            [0, 255, 180],
            [120, 80, 255],
        ];
        const col = colors[index % colors.length];
        // Varying sizes for depth: 0.5 to 1.2
        const depthScale = 0.5 + Math.random() * 0.7;
        const bellW = (50 + Math.random() * 50) * depthScale;
        return {
            x: Math.random() * (p.width || 800),
            y: Math.random() * (p.height || 600),
            speedY: -(0.25 + Math.random() * 0.4) * depthScale,
            wobbleOffset: Math.random() * 1000,
            bellWidth: bellW,
            bellHeight: bellW * 0.55,
            tentacles: 7,
            tentacleLen: (70 + Math.random() * 50) * depthScale,
            color: col,
            pulsePhase: Math.random() * Math.PI * 2,
            tentaclePulse: 0,
            depthScale,
            // Each tentacle has unique phase offsets for organic movement
            tentaclePhases: Array.from({ length: 7 }, () => Math.random() * Math.PI * 2),
        };
    }

    _updateJellyfish(p, jf) {
        const t = p.frameCount * 0.02;
        // Bass makes them pulse upward
        jf.y += jf.speedY - this.audio.bass * 0.6 * jf.depthScale;
        jf.x += Math.sin(t + jf.wobbleOffset) * 0.7 * jf.depthScale;
        jf.tentaclePulse *= 0.9;

        const margin = jf.bellHeight + jf.tentacleLen + 30;
        if (jf.y < -margin) {
            jf.y = p.height + margin;
            jf.x = Math.random() * p.width;
        }
    }

    _drawJellyfish(p, jf) {
        const t = p.frameCount * 0.025;
        // Bass-reactive breathing
        const bassBreathe = this.audio.bass * 0.15;
        const breathe = Math.sin(t + jf.pulsePhase) * 0.12 + bassBreathe;
        const bw = jf.bellWidth * (1 + breathe);
        const bh = jf.bellHeight * (1 + breathe * 0.6);
        const r = jf.color[0], g = jf.color[1], b = jf.color[2];
        const depthAlpha = 0.5 + jf.depthScale * 0.5; // further = more transparent

        p.push();
        p.translate(jf.x, jf.y);

        // === BELL (smooth dome using bezier curves) ===

        // Layer 1: Wide outer glow
        p.noStroke();
        p.fill(r, g, b, 12 * depthAlpha);
        this._drawDome(p, bw * 1.5, bh * 1.5);

        // Layer 2: Mid glow
        p.fill(r, g, b, 22 * depthAlpha);
        this._drawDome(p, bw * 1.2, bh * 1.2);

        // Layer 3: Main bell body
        p.fill(r, g, b, 45 * depthAlpha);
        this._drawDome(p, bw, bh);

        // Layer 4: Inner translucent highlight (3D depth feel)
        p.fill(r, g, b, 70 * depthAlpha);
        this._drawDome(p, bw * 0.7, bh * 0.65);

        // Layer 5: Bright core highlight
        p.fill(255, 255, 255, 30 * depthAlpha);
        this._drawDome(p, bw * 0.35, bh * 0.3);

        // Inner rim line for structure
        p.noFill();
        p.stroke(r, g, b, 60 * depthAlpha);
        p.strokeWeight(1.2 * jf.depthScale);
        p.arc(0, 0, bw * 0.85, bh * 0.4, p.PI * 0.85, p.PI * 0.15);

        // === TENTACLES (organic sine-wave flow) ===
        p.noFill();
        const spacing = bw * 0.85 / (jf.tentacles + 1);
        const startX = -bw * 0.85 / 2 + spacing;
        const swayExtra = jf.tentaclePulse * 3;

        for (let i = 0; i < jf.tentacles; i++) {
            const tx = startX + i * spacing;
            const phase = jf.tentaclePhases[i];
            const tentLen = jf.tentacleLen * (0.7 + 0.3 * Math.sin(phase + i));

            // Glow layer for tentacle
            p.stroke(r, g, b, 35 * depthAlpha);
            p.strokeWeight(3 * jf.depthScale);
            p.beginShape();
            const segments = 14;
            for (let s = 0; s <= segments; s++) {
                const frac = s / segments;
                // Multiple sine waves at different frequencies for organic movement
                const wave1 = Math.sin(t * 1.8 + phase + frac * 4) * (10 + frac * 18);
                const wave2 = Math.sin(t * 2.5 + phase * 1.7 + frac * 6) * (4 + frac * 8);
                const wave3 = Math.sin(t * 0.8 + i * 0.9 + frac * 2) * (3 + frac * 5);
                const sway = (wave1 + wave2 + wave3) * frac + swayExtra * frac * Math.sin(t + i);
                const sx = tx + sway;
                const sy = frac * tentLen;
                p.curveVertex(sx, sy);
            }
            p.endShape();

            // Core bright line
            p.stroke(r, g, b, 120 * depthAlpha);
            p.strokeWeight(1.2 * jf.depthScale);
            p.beginShape();
            for (let s = 0; s <= segments; s++) {
                const frac = s / segments;
                const wave1 = Math.sin(t * 1.8 + phase + frac * 4) * (10 + frac * 18);
                const wave2 = Math.sin(t * 2.5 + phase * 1.7 + frac * 6) * (4 + frac * 8);
                const wave3 = Math.sin(t * 0.8 + i * 0.9 + frac * 2) * (3 + frac * 5);
                const sway = (wave1 + wave2 + wave3) * frac + swayExtra * frac * Math.sin(t + i);
                const sx = tx + sway;
                const sy = frac * tentLen;
                // Fade alpha toward tip
                p.curveVertex(sx, sy);
            }
            p.endShape();
        }

        // Small trailing particles near tentacle tips for sparkle
        p.noStroke();
        for (let i = 0; i < 3; i++) {
            const px = (Math.random() - 0.5) * bw * 0.8;
            const py = jf.tentacleLen * (0.6 + Math.random() * 0.4);
            const sparkle = Math.sin(t * 3 + i * 2 + jf.wobbleOffset) * 0.5 + 0.5;
            p.fill(r, g, b, 40 * sparkle * depthAlpha);
            p.ellipse(px, py, 3 * jf.depthScale, 3 * jf.depthScale);
        }

        p.pop();
    }

    _drawDome(p, w, h) {
        // Smooth dome shape using bezierVertex for organic bell
        p.beginShape();
        // Start at bottom-left of dome
        p.vertex(-w / 2, 0);
        // Left side curve up
        p.bezierVertex(
            -w / 2, -h * 0.6,
            -w * 0.3, -h,
            0, -h
        );
        // Right side curve down
        p.bezierVertex(
            w * 0.3, -h,
            w / 2, -h * 0.6,
            w / 2, 0
        );
        // Close bottom with slight inward curve (tighter semicircle)
        p.bezierVertex(
            w * 0.3, h * 0.08,
            -w * 0.3, h * 0.08,
            -w / 2, 0
        );
        p.endShape(p.CLOSE);
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        for (const jf of this.jellyfish) {
            jf.tentaclePulse = strength;
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['neon-jellyfish'] = NeonJellyfishPreset;
})();
