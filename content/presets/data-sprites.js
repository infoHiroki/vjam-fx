(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key b - Set C: ネオンカラーのデータ粒子が浮遊するサイバーパーティクル
class DataSpritesPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.sprites = [];
        this.userChars = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;
        preset.sprites = [];

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.textFont('monospace');
                for (let i = 0; i < 60; i++) {
                    preset.sprites.push(preset._make(p));
                }
            };

            p.draw = () => {
                p.background(0, 0, 0, 22);
                preset.beatPulse *= 0.92;

                const t = p.frameCount * 0.004 * preset.params.speed;
                const bass = preset.audio.bass;

                // Beat spawn
                if (preset.beatPulse > 0.3 && preset.sprites.length < 100) {
                    for (let i = 0; i < 4; i++) {
                        const sp = preset._make(p);
                        sp.size *= 1.5;
                        sp.alpha = 80;
                        preset.sprites.push(sp);
                    }
                }

                for (let i = preset.sprites.length - 1; i >= 0; i--) {
                    const sp = preset.sprites[i];

                    // Drift with Perlin
                    const angle = p.noise(sp.nx, sp.ny, t) * p.TWO_PI * 2;
                    sp.vx += Math.cos(angle) * 0.06;
                    sp.vy += Math.sin(angle) * 0.06;
                    sp.vx *= 0.96;
                    sp.vy *= 0.96;
                    sp.x += sp.vx * preset.params.speed;
                    sp.y += sp.vy * preset.params.speed;
                    sp.nx += 0.004;
                    sp.life -= 0.0015;

                    if (sp.x < -15) sp.x = p.width + 15;
                    if (sp.x > p.width + 15) sp.x = -15;
                    if (sp.y < -15) sp.y = p.height + 15;
                    if (sp.y > p.height + 15) sp.y = -15;

                    if (sp.life <= 0) {
                        preset.sprites[i] = preset._make(p);
                        continue;
                    }

                    const flicker = Math.sin(p.frameCount * sp.flickRate + sp.phase) > -0.2 ? 1 : 0.2;
                    const a = sp.alpha * sp.life * flicker;
                    const s = sp.size * (1 + bass * 0.4);

                    // Outer glow
                    p.noStroke();
                    p.fill(sp.hue, 80, 90, a * 0.1);
                    p.ellipse(sp.x, sp.y, s * 5, s * 5);

                    // Data character
                    if (sp.type === 'char') {
                        // Change char periodically
                        if (p.frameCount % 10 === 0 && Math.random() < 0.3) {
                            sp.char = preset._randChar();
                        }
                        p.fill(sp.hue, 70, 100, a * 0.7);
                        p.textSize(s * 1.2);
                        p.textAlign(p.CENTER, p.CENTER);
                        p.text(sp.char, sp.x, sp.y);
                    } else {
                        // Geometric sprite
                        p.fill(sp.hue, 70, 100, a * 0.6);
                        if (sp.shape === 0) {
                            p.ellipse(sp.x, sp.y, s, s);
                        } else if (sp.shape === 1) {
                            p.rectMode(p.CENTER);
                            p.push();
                            p.translate(sp.x, sp.y);
                            p.rotate(p.frameCount * 0.02 + sp.phase);
                            p.rect(0, 0, s * 0.8, s * 0.8);
                            p.pop();
                        } else {
                            // Diamond
                            p.push();
                            p.translate(sp.x, sp.y);
                            p.rotate(p.PI / 4 + p.frameCount * 0.01);
                            p.rect(0 - s * 0.35, 0 - s * 0.35, s * 0.7, s * 0.7);
                            p.pop();
                        }
                    }
                }

                while (preset.sprites.length < 50) {
                    preset.sprites.push(preset._make(p));
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _randChar() {
        // If user text is set, use ONLY those characters
        if (this.userChars.length > 0) {
            return this.userChars[Math.floor(Math.random() * this.userChars.length)];
        }
        const chars = '01アイウエオカキクケコ◆◇●○□■△▽☆★';
        return chars[Math.floor(Math.random() * chars.length)];
    }

    _make(p) {
        const hues = [170, 190, 270, 310];
        const isChar = Math.random() < 0.5;
        return {
            x: Math.random() * p.width,
            y: Math.random() * p.height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            nx: Math.random() * 1000,
            ny: Math.random() * 1000,
            size: 6 + Math.random() * 10,
            hue: hues[Math.floor(Math.random() * hues.length)] + Math.random() * 20,
            alpha: 50 + Math.random() * 30,
            life: 0.5 + Math.random() * 0.5,
            flickRate: 0.05 + Math.random() * 0.15,
            phase: Math.random() * Math.PI * 2,
            type: isChar ? 'char' : 'shape',
            char: this._randChar ? this._randChar() : '0',
            shape: Math.floor(Math.random() * 3),
        };
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    setParam(key, value) {
        super.setParam(key, value);
        if (key === 'text' && value) {
            this.userChars = [...value];
        }
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['data-sprites'] = DataSpritesPreset;
})();
