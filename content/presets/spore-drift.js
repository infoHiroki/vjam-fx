(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key b - Set D: 胞子が空中をゆっくり漂う自然系パーティクル
class SporeDriftPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.spores = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;
        preset.spores = [];

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noStroke();
                for (let i = 0; i < 80; i++) {
                    preset.spores.push(preset._make(p));
                }
            };

            p.draw = () => {
                p.background(0, 0, 0, 18);
                preset.beatPulse *= 0.93;

                const t = p.frameCount * 0.003 * preset.params.speed;
                const bass = preset.audio.bass;

                // Beat burst: release cluster
                if (preset.beatPulse > 0.3 && preset.spores.length < 150) {
                    const cx = Math.random() * p.width;
                    const cy = Math.random() * p.height;
                    const count = Math.floor(preset.beatPulse * 8);
                    for (let i = 0; i < count; i++) {
                        const sp = preset._make(p);
                        sp.x = cx + (Math.random() - 0.5) * 40;
                        sp.y = cy + (Math.random() - 0.5) * 40;
                        sp.alpha = 70;
                        preset.spores.push(sp);
                    }
                }

                // Connecting threads between nearby spores
                p.stroke(80, 30, 50, 5);
                p.strokeWeight(0.5);
                for (let i = 0; i < preset.spores.length; i++) {
                    for (let j = i + 1; j < preset.spores.length; j++) {
                        const a = preset.spores[i];
                        const b = preset.spores[j];
                        const dx = a.x - b.x;
                        const dy = a.y - b.y;
                        const d = dx * dx + dy * dy;
                        if (d < 3000) {
                            p.line(a.x, a.y, b.x, b.y);
                        }
                    }
                }
                p.noStroke();

                for (let i = preset.spores.length - 1; i >= 0; i--) {
                    const sp = preset.spores[i];

                    // Very gentle Perlin drift
                    const angle = p.noise(sp.nx, sp.ny, t) * p.TWO_PI * 2;
                    sp.vx += Math.cos(angle) * 0.02;
                    sp.vy += Math.sin(angle) * 0.02 - 0.003; // slight rise
                    sp.vx *= 0.985;
                    sp.vy *= 0.985;
                    sp.x += sp.vx * preset.params.speed;
                    sp.y += sp.vy * preset.params.speed;
                    sp.nx += 0.002;
                    sp.life -= 0.001;

                    if (sp.x < -15) sp.x = p.width + 15;
                    if (sp.x > p.width + 15) sp.x = -15;
                    if (sp.y < -15) sp.y = p.height + 15;
                    if (sp.y > p.height + 15) sp.y = -15;

                    if (sp.life <= 0) {
                        preset.spores[i] = preset._make(p);
                        continue;
                    }

                    const pulse = 0.6 + Math.sin(p.frameCount * sp.pulseSpeed + sp.phase) * 0.4;
                    const a = sp.alpha * sp.life * pulse;
                    const s = sp.size * (1 + bass * 0.2);

                    // Outer halo
                    p.fill(sp.hue, 40, 60, a * 0.08);
                    p.ellipse(sp.x, sp.y, s * 5, s * 5);

                    // Body
                    p.fill(sp.hue, 50, 70, a * 0.4);
                    p.ellipse(sp.x, sp.y, s, s * 1.1);

                    // Bright core
                    p.fill(sp.hue, 20, 90, a * 0.5);
                    p.ellipse(sp.x, sp.y, s * 0.3, s * 0.3);
                }

                while (preset.spores.length < 60) {
                    preset.spores.push(preset._make(p));
                }
                if (preset.spores.length > 180) {
                    preset.spores.splice(0, preset.spores.length - 180);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _make(p) {
        return {
            x: Math.random() * p.width,
            y: Math.random() * p.height,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
            nx: Math.random() * 1000,
            ny: Math.random() * 1000,
            size: 3 + Math.random() * 7,
            hue: 60 + Math.random() * 50, // yellow-green to olive
            alpha: 40 + Math.random() * 30,
            life: 0.6 + Math.random() * 0.4,
            pulseSpeed: 0.02 + Math.random() * 0.05,
            phase: Math.random() * Math.PI * 2,
        };
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
window.VJamFX.presets['spore-drift'] = SporeDriftPreset;
})();
