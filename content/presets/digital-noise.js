(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

const RES = 4;

class DigitalNoisePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.blocks = [];
    }

    setup(container) {
        this.destroy();
        this.blocks = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let buf;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                buf = p.createGraphics(Math.floor(p.width / RES), Math.floor(p.height / RES));
                buf.noStroke();

                // Initialize persistent blocks
                const bw = buf.width;
                const bh = buf.height;
                for (let i = 0; i < 60; i++) {
                    preset.blocks.push(preset._newBlock(bw, bh));
                }
            };

            p.draw = () => {
                // Draw to buffer
                buf.background(5, 5, 15);

                // Determine how many blocks change this frame
                const changeRate = 0.05 + preset.beatPulse * 0.4 + preset.audio.treble * 0.2;
                const bw = buf.width;
                const bh = buf.height;

                for (let i = 0; i < preset.blocks.length; i++) {
                    const block = preset.blocks[i];
                    block.life--;

                    // Replace expired blocks
                    if (block.life <= 0 || Math.random() < changeRate * 0.1) {
                        preset.blocks[i] = preset._newBlock(bw, bh);
                    }
                }

                // Beat: add burst of bright blocks
                if (preset.beatPulse > 0.3) {
                    const extra = Math.floor(preset.beatPulse * 15);
                    for (let i = 0; i < extra; i++) {
                        const b = preset._newBlock(bw, bh);
                        b.bright = true;
                        b.size = 3 + Math.floor(Math.random() * 6);
                        preset.blocks.push(b);
                    }
                    // Cap total blocks
                    if (preset.blocks.length > 120) {
                        preset.blocks.splice(0, preset.blocks.length - 120);
                    }
                }

                // Draw blocks to buffer
                for (const block of preset.blocks) {
                    if (block.bright) {
                        const colors = [
                            [0, 255, 255],
                            [255, 0, 255],
                            [255, 255, 0],
                            [0, 255, 100],
                        ];
                        const c = colors[Math.floor(Math.random() * colors.length)];
                        buf.fill(c[0], c[1], c[2], 160 + Math.random() * 95);
                    } else {
                        const v = 20 + Math.random() * 40;
                        buf.fill(v, v, v + 10, 120 + Math.random() * 80);
                    }
                    buf.rect(block.x, block.y, block.size, block.size);
                }

                // Copy buffer to main canvas (pixelated)
                p.image(buf, 0, 0, p.width, p.height);

                // Overlay grid lines on main canvas
                p.stroke(30, 30, 50, 60);
                p.strokeWeight(1);
                const gridSize = RES * 4;
                for (let x = 0; x < p.width; x += gridSize) {
                    p.line(x, 0, x, p.height);
                }
                for (let y = 0; y < p.height; y += gridSize) {
                    p.line(0, y, p.width, y);
                }

                // Beat flash overlay
                if (preset.beatPulse > 0.2) {
                    p.noStroke();
                    p.fill(0, 255, 255, preset.beatPulse * 15);
                    p.rect(0, 0, p.width, p.height);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (buf) buf.remove();
                buf = p.createGraphics(Math.floor(p.width / RES), Math.floor(p.height / RES));
                buf.noStroke();
            };
        }, container);
    }

    _newBlock(bw, bh) {
        return {
            x: Math.floor(Math.random() * bw),
            y: Math.floor(Math.random() * bh),
            size: 1 + Math.floor(Math.random() * 3),
            life: 10 + Math.floor(Math.random() * 50),
            bright: false,
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
window.VJamFX.presets['digital-noise'] = DigitalNoisePreset;
})();
