(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PulseRingPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;
        this.p5 = new p5((p) => {
            let rings = [];
            const PALETTE = [
                [0, 255, 255],    // cyan
                [255, 0, 255],    // magenta
                [255, 255, 0],    // yellow
                [0, 255, 128],    // green-cyan
                [255, 0, 128],    // hot pink
            ];
            let colorIdx = 0;
            let autoTimer = 0;

            function spawnRing() {
                const c = PALETTE[colorIdx % PALETTE.length];
                colorIdx++;
                rings.push({ radius: 0, color: c, alpha: 255, weight: p.random(2, 5) });
            }

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noFill();
            };

            p.draw = () => {
                p.background(5, 5, 15);
                preset.beatPulse *= 0.92;
                autoTimer++;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxR = p.dist(0, 0, cx, cy);
                const speed = 1.5 + preset.audio.bass * 4;

                // Auto-spawn when no audio
                if (preset.audio.rms < 0.01 && autoTimer % 60 === 0) {
                    spawnRing();
                }

                // Update and draw rings
                for (let i = rings.length - 1; i >= 0; i--) {
                    const ring = rings[i];
                    ring.radius += speed;
                    ring.alpha = p.map(ring.radius, 0, maxR, 255, 0);

                    if (ring.alpha <= 0) {
                        rings.splice(i, 1);
                        continue;
                    }

                    const c = ring.color;
                    const w = ring.weight * (1 + preset.beatPulse * 2);

                    // Glow layer
                    p.strokeWeight(w + 4);
                    p.stroke(c[0], c[1], c[2], ring.alpha * 0.2);
                    p.ellipse(cx, cy, ring.radius * 2, ring.radius * 2);

                    // Main ring
                    p.strokeWeight(w);
                    p.stroke(c[0], c[1], c[2], ring.alpha);
                    p.ellipse(cx, cy, ring.radius * 2, ring.radius * 2);
                }

                // Cap ring count
                if (rings.length > 50) {
                    rings.splice(0, rings.length - 50);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };

            // Expose spawn for beat triggers
            preset._spawnRing = spawnRing;
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
        if (this._spawnRing) {
            const count = 3 + Math.floor(strength * 2);
            for (let i = 0; i < count; i++) {
                this._spawnRing();
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['pulse-ring'] = PulseRingPreset;
})();
