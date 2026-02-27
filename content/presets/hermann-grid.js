(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class HermannGrid extends BasePreset {
    constructor() {
        super();
        this.params = { gridSize: 8, speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                p.background(0, 0, 0, 100);
                preset.beatPulse *= 0.9;

                const time = p.frameCount * 0.01 * preset.params.speed;
                const cols = preset.params.gridSize;

                // Gap size: base + mid audio influence + breathing
                const breathe = Math.sin(time * 0.8) * 0.3 + 1;
                const baseGap = 12 + preset.audio.mid * 20;
                const gap = baseGap * breathe;

                // Calculate square size to fill screen
                const maxDim = Math.max(p.width, p.height);
                const squareSize = (maxDim / cols) - gap;

                // Center the grid
                const totalW = cols * (squareSize + gap) - gap;
                const totalH = cols * (squareSize + gap) - gap;
                const offsetX = (p.width - totalW) / 2;
                const offsetY = (p.height - totalH) / 2;

                // Beat flash brightness
                const flashBoost = preset.beatPulse * 30;

                p.noStroke();

                for (let row = 0; row < cols; row++) {
                    for (let col = 0; col < cols; col++) {
                        const x = offsetX + col * (squareSize + gap);
                        const y = offsetY + row * (squareSize + gap);

                        // Subtle color cycling: slow hue wave across grid
                        const hue = (time * 20 + row * 15 + col * 15 + preset.audio.treble * 60) % 360;
                        const saturation = 8 + preset.audio.rms * 25 + preset.beatPulse * 15;
                        const brightness = 85 + flashBoost + preset.audio.bass * 10;

                        p.fill(hue, saturation, Math.min(brightness, 100), 100);

                        // Slight scale pulse per square for organic feel
                        const pulse = Math.sin(time * 1.5 + row * 0.4 + col * 0.3) * 2 * (1 + preset.audio.bass);
                        p.rect(x - pulse / 2, y - pulse / 2, squareSize + pulse, squareSize + pulse);
                    }
                }

                // Overlay: draw slightly brighter border on each square for crispness
                // This enhances the illusion by making edges sharper
                p.noFill();
                p.strokeWeight(1);
                for (let row = 0; row < cols; row++) {
                    for (let col = 0; col < cols; col++) {
                        const x = offsetX + col * (squareSize + gap);
                        const y = offsetY + row * (squareSize + gap);
                        const hue = (time * 20 + row * 15 + col * 15 + preset.audio.treble * 60) % 360;
                        p.stroke(hue, 5, 95 + flashBoost * 0.5, 40);
                        p.rect(x, y, squareSize, squareSize);
                    }
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
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['hermann-grid'] = HermannGrid;
})();
