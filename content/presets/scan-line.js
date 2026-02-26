(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class ScanLinePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.scanY = 0;
        this.scanSpeed = 2;
        this.trails = [];
        this.secondScan = -1;
    }

    setup(container) {
        this.destroy();
        this.scanY = 0;
        this.trails = [];
        this.secondScan = -1;
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
            };

            p.draw = () => {
                p.background(5, 5, 15);
                preset.beatPulse *= 0.92;

                const speed = preset.scanSpeed + preset.beatPulse * 6 + preset.audio.rms * 3;

                // Move scan line
                preset.scanY += speed;
                if (preset.scanY > p.height + 40) {
                    preset.scanY = -40;
                }

                // Add trail
                preset.trails.push({ y: preset.scanY, alpha: 180 });

                // Second scan line from beat
                if (preset.secondScan >= 0) {
                    preset.secondScan += speed * 1.3;
                    if (preset.secondScan > p.height + 40) {
                        preset.secondScan = -1;
                    } else {
                        preset.trails.push({ y: preset.secondScan, alpha: 140, magenta: true });
                    }
                }

                // Draw trails
                for (let i = preset.trails.length - 1; i >= 0; i--) {
                    const t = preset.trails[i];
                    t.alpha -= 6;
                    if (t.alpha <= 0) {
                        preset.trails.splice(i, 1);
                        continue;
                    }
                    if (t.magenta) {
                        p.stroke(255, 0, 255, t.alpha * 0.3);
                    } else {
                        p.stroke(0, 255, 255, t.alpha * 0.3);
                    }
                    p.strokeWeight(1);
                    p.line(0, t.y, p.width, t.y);
                }

                // Main scan line glow layers
                const drawScan = (y, r, g, b) => {
                    // Wide dim glow
                    p.stroke(r, g, b, 30);
                    p.strokeWeight(30);
                    p.line(0, y, p.width, y);
                    // Medium glow
                    p.stroke(r, g, b, 80);
                    p.strokeWeight(8);
                    p.line(0, y, p.width, y);
                    // Bright core
                    p.stroke(r, g, b, 220);
                    p.strokeWeight(2);
                    p.line(0, y, p.width, y);
                    // White center
                    p.stroke(255, 255, 255, 180);
                    p.strokeWeight(1);
                    p.line(0, y, p.width, y);
                };

                drawScan(preset.scanY, 0, 255, 255);

                if (preset.secondScan >= 0) {
                    drawScan(preset.secondScan, 255, 0, 255);
                }

                // Reveal flash near scan line
                const revealH = 60;
                p.noStroke();
                for (let dy = -revealH; dy < revealH; dy += 4) {
                    const dist = Math.abs(dy);
                    const a = p.map(dist, 0, revealH, 25, 0);
                    p.fill(0, 255, 255, a);
                    p.rect(0, preset.scanY + dy, p.width, 3);
                }

                // Beat flash
                if (preset.beatPulse > 0.3) {
                    preset.secondScan = -20;
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
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX.presets['scan-line'] = ScanLinePreset;
})();
