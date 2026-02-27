(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key b - Set B: タンポポの綿毛が風に漂う浮遊パーティクル
class DandelionSeedsPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.seeds = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;
        preset.seeds = [];

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                for (let i = 0; i < 40; i++) {
                    preset.seeds.push(preset._make(p));
                }
            };

            p.draw = () => {
                p.background(0, 0, 0, 20);
                preset.beatPulse *= 0.93;

                const t = p.frameCount * 0.004 * preset.params.speed;
                const bass = preset.audio.bass;

                // Wind burst on beat
                if (preset.beatPulse > 0.3 && preset.seeds.length < 80) {
                    const count = Math.floor(preset.beatPulse * 5);
                    for (let i = 0; i < count; i++) {
                        preset.seeds.push(preset._make(p));
                    }
                }

                for (let i = preset.seeds.length - 1; i >= 0; i--) {
                    const s = preset.seeds[i];

                    // Gentle Perlin wind
                    const windAngle = p.noise(s.nx, s.ny, t) * p.TWO_PI * 1.5;
                    s.vx += Math.cos(windAngle) * 0.04 + 0.02; // slight rightward drift
                    s.vy += Math.sin(windAngle) * 0.04 - 0.01; // slight upward drift
                    s.vx *= 0.97;
                    s.vy *= 0.97;
                    s.x += s.vx * preset.params.speed;
                    s.y += s.vy * preset.params.speed;
                    s.nx += 0.003;
                    s.rotation += s.rotSpeed;
                    s.life -= 0.001;

                    // Wrap
                    if (s.x > p.width + 20) s.x = -20;
                    if (s.x < -20) s.x = p.width + 20;
                    if (s.y > p.height + 20) s.y = -20;
                    if (s.y < -20) s.y = p.height + 20;

                    if (s.life <= 0) {
                        preset.seeds[i] = preset._make(p);
                        continue;
                    }

                    const a = s.alpha * s.life;
                    const sz = s.size * (1 + bass * 0.3);

                    p.push();
                    p.translate(s.x, s.y);
                    p.rotate(s.rotation);

                    // Stem
                    p.stroke(50, 15, 70, a * 0.4);
                    p.strokeWeight(0.5);
                    p.line(0, 0, 0, sz * 0.8);

                    // Filaments (pappus)
                    p.noStroke();
                    const filaments = 8;
                    for (let f = 0; f < filaments; f++) {
                        const fa = (f / filaments) * p.TWO_PI;
                        const fl = sz * (0.5 + 0.3 * Math.sin(p.frameCount * 0.02 + f));
                        const fx = Math.cos(fa) * fl;
                        const fy = Math.sin(fa) * fl - sz * 0.2;

                        p.fill(50, 10, 95, a * 0.3);
                        p.ellipse(fx, fy, 1.5, 1.5);

                        // Thin line to filament tip
                        p.stroke(50, 10, 90, a * 0.2);
                        p.strokeWeight(0.3);
                        p.line(0, -sz * 0.2, fx, fy);
                        p.noStroke();
                    }

                    // Center seed body
                    p.fill(40, 20, 80, a * 0.6);
                    p.ellipse(0, 0, sz * 0.2, sz * 0.3);

                    // Outer glow
                    p.fill(50, 10, 90, a * 0.08);
                    p.ellipse(0, -sz * 0.1, sz * 2, sz * 2);

                    p.pop();
                }

                while (preset.seeds.length < 30) {
                    preset.seeds.push(preset._make(p));
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
            vx: (Math.random() - 0.3) * 0.3,
            vy: (Math.random() - 0.5) * 0.2,
            nx: Math.random() * 1000,
            ny: Math.random() * 1000,
            size: 8 + Math.random() * 14,
            alpha: 50 + Math.random() * 30,
            life: 0.6 + Math.random() * 0.4,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.01,
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
window.VJamFX.presets['dandelion-seeds'] = DandelionSeedsPreset;
})();
