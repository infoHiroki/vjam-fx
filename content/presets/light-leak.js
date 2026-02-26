(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class LightLeakPreset extends BasePreset {
    constructor() {
        super();
        this.params = { sourceCount: 4 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.sources = [];
        this.streaks = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;
        preset.sources = [];
        preset.streaks = [];

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noStroke();

                // Warm film tone palette: amber, soft pink, golden, pale cyan
                const tones = [
                    { h: 35, s: 70, b: 95 },   // amber
                    { h: 340, s: 40, b: 95 },   // soft pink
                    { h: 45, s: 60, b: 100 },   // golden
                    { h: 180, s: 30, b: 90 },   // pale cyan
                    { h: 20, s: 55, b: 95 }     // warm peach
                ];

                const count = preset.params.sourceCount;
                for (let i = 0; i < count; i++) {
                    const tone = tones[i % tones.length];
                    preset.sources.push({
                        x: p.width * (0.2 + Math.random() * 0.6),
                        y: p.height * (0.2 + Math.random() * 0.6),
                        targetX: p.width * 0.5,
                        targetY: p.height * 0.5,
                        noiseOffX: Math.random() * 1000,
                        noiseOffY: Math.random() * 1000,
                        hue: tone.h,
                        sat: tone.s,
                        bri: tone.b,
                        baseSize: 150 + Math.random() * 200,
                        phase: Math.random() * p.TWO_PI,
                        driftSpeed: 0.003 + Math.random() * 0.004
                    });
                }

                // Anamorphic streaks
                for (let i = 0; i < 3; i++) {
                    preset.streaks.push({
                        y: p.height * (0.3 + Math.random() * 0.4),
                        hue: tones[i % tones.length].h,
                        noiseOff: Math.random() * 1000,
                        width: 0.6 + Math.random() * 0.4,
                        alpha: 8 + Math.random() * 8
                    });
                }
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.92;

                const time = p.frameCount * 0.005;

                // Draw light sources
                for (let i = 0; i < preset.sources.length; i++) {
                    const src = preset.sources[i];

                    // Noise-based organic drift
                    const nx = p.noise(src.noiseOffX + time * src.driftSpeed * 200) * p.width;
                    const ny = p.noise(src.noiseOffY + time * src.driftSpeed * 200) * p.height;
                    src.x += (nx - src.x) * 0.02;
                    src.y += (ny - src.y) * 0.02;

                    // Beat shift
                    if (preset.beatPulse > 0.1) {
                        src.x += (Math.random() - 0.5) * preset.beatPulse * 30;
                        src.y += (Math.random() - 0.5) * preset.beatPulse * 20;
                    }

                    const pulse = Math.sin(p.frameCount * 0.02 + src.phase) * 0.15 + 1;
                    const audioPulse = 1 + preset.audio.rms * 0.4 + preset.beatPulse * 0.5;
                    const size = src.baseSize * pulse * audioPulse;

                    // 4 concentric layers for soft gradient glow
                    const layers = 4;
                    for (let l = layers; l >= 1; l--) {
                        const ratio = l / layers;
                        const layerSize = size * ratio * 1.8;
                        const alpha = (1 - ratio * 0.6) * (12 + preset.audio.rms * 6 + preset.beatPulse * 10);
                        const sat = src.sat * (0.3 + ratio * 0.7);
                        const bri = src.bri;

                        p.fill(src.hue, sat, bri, Math.min(alpha, 35));
                        p.ellipse(src.x, src.y, layerSize * 1.3, layerSize);
                    }

                    // Bright center
                    const centerAlpha = 20 + preset.beatPulse * 25 + preset.audio.mid * 10;
                    p.fill(src.hue, src.sat * 0.3, 100, Math.min(centerAlpha, 50));
                    p.ellipse(src.x, src.y, size * 0.3, size * 0.25);
                }

                // Anamorphic horizontal streaks
                for (let i = 0; i < preset.streaks.length; i++) {
                    const streak = preset.streaks[i];
                    const yNoise = p.noise(streak.noiseOff + time * 0.3);
                    const y = streak.y + (yNoise - 0.5) * 80;
                    const w = p.width * streak.width;
                    const h = 20 + preset.audio.treble * 30 + preset.beatPulse * 25;
                    const alpha = streak.alpha + preset.audio.rms * 8 + preset.beatPulse * 12;

                    // Stretched horizontal highlight
                    const cx = p.width * 0.5 + Math.sin(time * 0.7 + i * 2) * p.width * 0.15;

                    for (let l = 3; l >= 1; l--) {
                        const lRatio = l / 3;
                        p.fill(streak.hue, 30 * lRatio, 95, alpha * (1 - lRatio * 0.5) * 0.5);
                        p.ellipse(cx, y, w * lRatio, h * lRatio * 1.5);
                    }
                }

                // Soft overall warm wash that breathes
                const washAlpha = 3 + Math.sin(time * 0.8) * 2 + preset.audio.bass * 3;
                p.fill(35, 30, 90, Math.max(washAlpha, 1));
                p.rect(0, 0, p.width, p.height);
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
    }
}

window.VJamFX.presets['light-leak'] = LightLeakPreset;
})();
