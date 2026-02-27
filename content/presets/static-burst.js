(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class StaticBurstPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let gfx;
            let patternTimer = 0;
            let patternType = -1;
            let patternDuration = 0;
            let colorFlash = 0;
            let flashHue = 0;
            let nextPatternAt = 80;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                gfx = p.createGraphics(Math.ceil(p.width / 4), Math.ceil(p.height / 4));
                gfx.colorMode(gfx.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.01 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;

                const gw = gfx.width, gh = gfx.height;
                const cellSize = 3;
                const cols = Math.floor(gw / cellSize);
                const rows = Math.floor(gh / cellSize);

                // Pattern timing
                patternTimer++;
                if (patternTimer >= nextPatternAt) {
                    patternType = Math.floor(Math.random() * 4);
                    patternDuration = 12 + Math.floor(Math.random() * 10);
                    patternTimer = 0;
                    nextPatternAt = 60 + Math.floor(Math.random() * 80);
                    colorFlash = 0.6;
                    flashHue = Math.random() * 360;
                }

                const inPattern = patternType >= 0 && patternTimer < patternDuration;
                const patternFade = inPattern ? Math.sin((patternTimer / patternDuration) * Math.PI) : 0;

                // Draw noise grid on createGraphics
                gfx.noStroke();
                for (let cy = 0; cy < rows; cy++) {
                    for (let cx = 0; cx < cols; cx++) {
                        // Base noise
                        let bri = Math.random() * 80 + 10;

                        // Pattern overlay
                        if (inPattern && patternFade > 0.1) {
                            let patternVal = 0;
                            const fx = cx / cols, fy = cy / rows;

                            if (patternType === 0) {
                                // Concentric circles
                                const dx = fx - 0.5, dy = fy - 0.5;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                patternVal = (Math.sin(dist * 25 - t * 8) * 0.5 + 0.5);
                            } else if (patternType === 1) {
                                // Diagonal lines
                                patternVal = (Math.sin((fx + fy) * 20 - t * 5) * 0.5 + 0.5);
                            } else if (patternType === 2) {
                                // Horizontal bands
                                patternVal = (Math.sin(fy * 30 - t * 6) * 0.5 + 0.5);
                            } else {
                                // Checkerboard
                                const checkX = Math.floor(cx / 3) % 2;
                                const checkY = Math.floor(cy / 3) % 2;
                                patternVal = (checkX + checkY) % 2;
                            }

                            bri = bri * (1 - patternFade) + patternVal * 90 * patternFade;
                        }

                        // Audio reactivity
                        bri += bass * 15 * Math.random();

                        // Color: mostly gray, with color during pattern
                        let sat = 0;
                        let hue = 0;
                        if (colorFlash > 0.05) {
                            sat = colorFlash * 60 * patternFade;
                            hue = flashHue;
                        }

                        gfx.fill(hue, sat, Math.min(bri, 100), 95);
                        gfx.rect(cx * cellSize, cy * cellSize, cellSize, cellSize);
                    }
                }

                colorFlash *= 0.97;

                // Draw to main canvas
                p.image(gfx, 0, 0, p.width, p.height);

                // Scanlines overlay
                p.stroke(0, 0, 0, 12);
                p.strokeWeight(1);
                for (let sy = 0; sy < p.height; sy += 3) {
                    p.line(0, sy, p.width, sy);
                }

                // Screen edge glow
                p.noFill();
                p.stroke(0, 0, 50, 8);
                p.strokeWeight(20);
                p.rect(0, 0, p.width, p.height);

                // Occasional horizontal glitch line
                if (Math.random() < 0.03 + pulse * 0.1) {
                    const gy = Math.random() * p.height;
                    const gh2 = 2 + Math.random() * 6;
                    p.noStroke();
                    p.fill(0, 0, 90, 40);
                    p.rect(0, gy, p.width, gh2);
                }

                // CRT curvature hint (corner darkening)
                p.noStroke();
                const cornerR = Math.min(p.width, p.height) * 0.4;
                for (const [ax, ay] of [[0, 0], [p.width, 0], [0, p.height], [p.width, p.height]]) {
                    p.fill(0, 0, 0, 20);
                    p.ellipse(ax, ay, cornerR, cornerR);
                }

                // Beat: trigger pattern
                if (pulse > 0.5 && !inPattern) {
                    patternType = Math.floor(Math.random() * 4);
                    patternDuration = 10 + Math.floor(Math.random() * 8);
                    patternTimer = 0;
                    nextPatternAt = 40 + Math.floor(Math.random() * 60);
                    colorFlash = 1;
                    flashHue = Math.random() * 360;
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (gfx) gfx.remove();
                gfx = p.createGraphics(Math.ceil(p.width / 4), Math.ceil(p.height / 4));
                gfx.colorMode(gfx.HSB, 360, 100, 100, 100);
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
window.VJamFX.presets['static-burst'] = StaticBurstPreset;
})();
