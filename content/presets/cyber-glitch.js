(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CyberGlitchPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;
        this.p5 = new p5((p) => {
            const RES = 3;
            let buf;
            let autoTimer = 0;
            const NEON = [
                [0, 255, 255],
                [255, 0, 255],
                [255, 255, 0],
                [0, 255, 128],
                [255, 0, 128],
            ];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                buf = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                buf.noStroke();
            };

            p.draw = () => {
                p.background(5, 5, 15);
                preset.beatPulse *= 0.88;
                autoTimer++;

                const bw = buf.width;
                const bh = buf.height;

                // Fade buffer slightly
                buf.fill(5, 5, 15, 40);
                buf.rect(0, 0, bw, bh);

                // Determine glitch intensity
                let glitchAmt = preset.audio.treble * 0.5 + preset.beatPulse;
                const autoGlitch = (autoTimer % 90 < 5) ? 0.6 : 0;
                if (preset.audio.rms < 0.01) glitchAmt = autoGlitch;

                // Draw glitch blocks on buffer
                const blockCount = Math.floor(glitchAmt * 15) + 1;
                for (let i = 0; i < blockCount; i++) {
                    const c = NEON[Math.floor(p.random(NEON.length))];
                    const bx = p.random(bw);
                    const by = p.random(bh);
                    const w = p.random(10, bw * 0.4);
                    const h = p.random(2, 8);
                    buf.fill(c[0], c[1], c[2], 120 + glitchAmt * 80);
                    buf.rect(bx, by, w, h);
                }

                // Horizontal scan lines on buffer
                const scanCount = 3 + Math.floor(glitchAmt * 5);
                for (let i = 0; i < scanCount; i++) {
                    const sy = p.random(bh);
                    buf.fill(255, 255, 255, 20 + glitchAmt * 30);
                    buf.rect(0, sy, bw, 1);
                }

                // RGB channel separation offset
                const offset = (1 + glitchAmt * 8) * RES;

                // Draw buffer with RGB tinting
                p.push();
                p.blendMode(p.ADD);

                // Red channel
                p.tint(255, 0, 0, 160);
                p.image(buf, -offset, 0, p.width, p.height);

                // Green channel
                p.tint(0, 255, 0, 160);
                p.image(buf, 0, 0, p.width, p.height);

                // Blue channel
                p.tint(0, 0, 255, 160);
                p.image(buf, offset, 0, p.width, p.height);

                p.pop();

                // Horizontal line artifacts on main canvas
                p.noStroke();
                for (let i = 0; i < 3 + glitchAmt * 8; i++) {
                    const ly = p.random(p.height);
                    const lh = p.random(1, 3);
                    p.fill(255, 255, 255, 15 + glitchAmt * 25);
                    p.rect(0, ly, p.width, lh);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (buf) buf.remove();
                buf = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                buf.noStroke();
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
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['cyber-glitch'] = CyberGlitchPreset;
})();
