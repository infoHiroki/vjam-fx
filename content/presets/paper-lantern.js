(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PaperLanternPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.lanterns = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                for (let i = 0; i < 20; i++) {
                    preset.lanterns.push(preset._makeLantern(p, false));
                }
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.9;
                const time = p.frameCount * 0.01;

                for (let i = preset.lanterns.length - 1; i >= 0; i--) {
                    const ln = preset.lanterns[i];

                    // Gentle upward drift
                    ln.y -= ln.riseSpeed * preset.params.speed * (1 + preset.audio.bass * 0.3);

                    // Horizontal sway via noise
                    const sway = p.noise(ln.noiseX, time * 0.5) * 2 - 1;
                    ln.x += sway * 0.6 * preset.params.speed;
                    ln.noiseX += 0.005;
                    ln.life -= 0.0008;

                    // Flame flicker
                    ln.flicker = 0.7 + p.noise(ln.flickerSeed, time * 3) * 0.3;

                    if (ln.y < -ln.size * 2 || ln.life <= 0) {
                        preset.lanterns.splice(i, 1);
                        continue;
                    }

                    const sz = ln.size;
                    const lifeAlpha = ln.life;

                    // Warm glow halo (large, soft)
                    p.noStroke();
                    const glowIntensity = ln.flicker * (1 + preset.beatPulse * 0.4);
                    p.fill(ln.hue, 60, 80, 5 * lifeAlpha * glowIntensity);
                    p.ellipse(ln.x, ln.y, sz * 5, sz * 5);
                    p.fill(ln.hue, 50, 85, 10 * lifeAlpha * glowIntensity);
                    p.ellipse(ln.x, ln.y, sz * 3, sz * 3);

                    // Lantern body (rounded rectangle)
                    p.fill(ln.hue, 65, 75, 40 * lifeAlpha);
                    p.rectMode(p.CENTER);
                    const bodyW = sz * 0.9;
                    const bodyH = sz * 1.2;
                    p.rect(ln.x, ln.y, bodyW, bodyH, sz * 0.2);

                    // Inner glow on body
                    p.fill(ln.hue, 40, 90, 25 * lifeAlpha * ln.flicker);
                    p.rect(ln.x, ln.y, bodyW * 0.7, bodyH * 0.7, sz * 0.15);

                    // Flame inside (small flickering ellipse)
                    const flameH = sz * 0.3 * ln.flicker;
                    const flameW = sz * 0.15 * ln.flicker;
                    const flameY = ln.y + sz * 0.05;
                    // Flame outer
                    p.fill(30, 80, 100, 50 * lifeAlpha);
                    p.ellipse(ln.x, flameY, flameW * 1.8, flameH * 1.8);
                    // Flame core
                    p.fill(45, 60, 100, 65 * lifeAlpha);
                    p.ellipse(ln.x, flameY, flameW, flameH);
                    // Flame bright center
                    p.fill(50, 20, 100, 55 * lifeAlpha);
                    p.ellipse(ln.x, flameY, flameW * 0.4, flameH * 0.5);

                    // Top opening of lantern
                    p.fill(ln.hue, 50, 60, 30 * lifeAlpha);
                    p.ellipse(ln.x, ln.y - bodyH * 0.5, bodyW * 0.5, sz * 0.12);

                    // Bottom rim
                    p.fill(ln.hue, 55, 55, 25 * lifeAlpha);
                    p.ellipse(ln.x, ln.y + bodyH * 0.5, bodyW * 0.6, sz * 0.1);

                    // Smoke wisps trailing behind
                    for (let s = 0; s < 3; s++) {
                        const smokeTime = time + s * 1.5 + ln.flickerSeed;
                        const smokeX = ln.x + Math.sin(smokeTime * 2 + s) * sz * 0.3;
                        const smokeY = ln.y + bodyH * 0.5 + sz * 0.3 + s * sz * 0.25;
                        const smokeAlpha = (3 - s) * 3 * lifeAlpha;
                        const smokeSize = sz * 0.15 * (1 + s * 0.3);
                        p.fill(30, 10, 60, smokeAlpha);
                        p.ellipse(smokeX, smokeY, smokeSize, smokeSize * 0.7);
                    }
                }

                // Maintain population
                while (preset.lanterns.length < 15) {
                    preset.lanterns.push(preset._makeLantern(p, true));
                }
                if (preset.lanterns.length > 25) {
                    preset.lanterns.splice(0, preset.lanterns.length - 25);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _makeLantern(p, fromBottom) {
        return {
            x: Math.random() * p.width,
            y: fromBottom ? p.height + Math.random() * 30 : Math.random() * p.height,
            size: 25 + Math.random() * 30,
            riseSpeed: 0.2 + Math.random() * 0.4,
            hue: 20 + Math.random() * 25,  // warm orange/amber range
            noiseX: Math.random() * 1000,
            flickerSeed: Math.random() * 1000,
            flicker: 1,
            life: 0.8 + Math.random() * 0.2,
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
        if (this.p5 && strength > 0.3) {
            const p = this.p5;
            const count = Math.floor(strength * 4) + 1;
            for (let i = 0; i < count; i++) {
                const lantern = this._makeLantern(p, true);
                lantern.x = p.width * 0.2 + Math.random() * p.width * 0.6;
                lantern.riseSpeed *= 1.3;
                this.lanterns.push(lantern);
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['paper-lantern'] = PaperLanternPreset;
})();
