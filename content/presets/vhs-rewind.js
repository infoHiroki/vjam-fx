(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key W - Set E: VHS巻き戻しズーム（全面系・トンネル/ズーム）
class VhsRewindPreset extends BasePreset {
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
            const RES = 3;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                gfx = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                gfx.colorMode(gfx.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                const t = p.frameCount * 0.03 * preset.params.speed;
                const bass = preset.audio.bass;
                const w = gfx.width;
                const h = gfx.height;
                const cx = w / 2;
                const cy = h / 2;

                gfx.background(0, 0, 5, 30);

                // Zoom rectangles receding into center
                const rectCount = 12;
                for (let i = 0; i < rectCount; i++) {
                    const phase = (i / rectCount + t * 0.5) % 1;
                    const scale = phase * phase;
                    const rw = w * scale;
                    const rh = h * scale;

                    if (rw < 2) continue;

                    const hue = (i * 25 + t * 30) % 360;
                    const alpha = (1 - phase) * 50 + bass * 20;

                    gfx.noFill();
                    gfx.stroke(hue, 50, 70, alpha);
                    gfx.strokeWeight(1 + (1 - phase) * 2);
                    gfx.rectMode(gfx.CENTER);
                    gfx.rect(cx, cy, rw, rh);
                }

                // VHS tracking lines (horizontal noise bands)
                const trackCount = 3;
                for (let i = 0; i < trackCount; i++) {
                    const ty = ((i * h / trackCount) + t * h * 0.7) % h;
                    const bandH = 2 + Math.sin(t * 5 + i) * 1;
                    const shift = Math.sin(t * 8 + i * 3) * 5;

                    gfx.noStroke();
                    gfx.fill(0, 0, 40, 25);
                    gfx.rect(shift, ty, w, bandH);
                }

                // Static noise scattered
                const noiseCount = Math.floor(15 + bass * 20);
                for (let i = 0; i < noiseCount; i++) {
                    const nx = Math.random() * w;
                    const ny = Math.random() * h;
                    const ns = 1 + Math.random() * 2;
                    gfx.noStroke();
                    gfx.fill(0, 0, Math.random() * 60, 30);
                    gfx.rect(nx, ny, ns, 1);
                }

                // Scan line effect
                for (let y = 0; y < h; y += 3) {
                    gfx.stroke(0, 0, 0, 8);
                    gfx.strokeWeight(0.5);
                    gfx.line(0, y, w, y);
                }

                // Center VCR transport icon — cycles through modes
                // Icons: 0=rewind, 1=play, 2=fast-forward, 3=pause, 4=stop
                const iconIndex = Math.floor(p.frameCount * 0.008 * preset.params.speed) % 5;
                const showAlpha = 30 + Math.sin(p.frameCount * 0.05) * 10 + preset.beatPulse * 40;
                const iconSize = 8 + preset.beatPulse * 12 + Math.sin(p.frameCount * 0.03) * 2;
                const iconHue = (iconIndex * 60 + p.frameCount * 0.3) % 360;

                // Neon glow behind icon
                gfx.noStroke();
                gfx.fill(iconHue, 60, 80, showAlpha * 0.3);
                gfx.ellipse(cx, cy, iconSize * 3.5, iconSize * 3.5);
                gfx.fill(iconHue, 50, 90, showAlpha * 0.15);
                gfx.ellipse(cx, cy, iconSize * 5, iconSize * 5);

                gfx.fill(iconHue, 60, 95, showAlpha);
                gfx.noStroke();

                if (iconIndex === 0) {
                    // Rewind ◀◀
                    gfx.triangle(
                        cx - iconSize * 0.3, cy,
                        cx + iconSize * 0.3, cy - iconSize * 0.4,
                        cx + iconSize * 0.3, cy + iconSize * 0.4
                    );
                    gfx.triangle(
                        cx - iconSize, cy,
                        cx - iconSize * 0.4, cy - iconSize * 0.4,
                        cx - iconSize * 0.4, cy + iconSize * 0.4
                    );
                } else if (iconIndex === 1) {
                    // Play ▶
                    gfx.triangle(
                        cx - iconSize * 0.4, cy - iconSize * 0.5,
                        cx - iconSize * 0.4, cy + iconSize * 0.5,
                        cx + iconSize * 0.6, cy
                    );
                } else if (iconIndex === 2) {
                    // Fast-forward ▶▶
                    gfx.triangle(
                        cx - iconSize * 0.3, cy - iconSize * 0.4,
                        cx - iconSize * 0.3, cy + iconSize * 0.4,
                        cx + iconSize * 0.3, cy
                    );
                    gfx.triangle(
                        cx + iconSize * 0.4, cy - iconSize * 0.4,
                        cx + iconSize * 0.4, cy + iconSize * 0.4,
                        cx + iconSize, cy
                    );
                } else if (iconIndex === 3) {
                    // Pause ❚❚
                    const barW = iconSize * 0.22;
                    const barH = iconSize * 0.8;
                    gfx.rect(cx - iconSize * 0.35, cy - barH / 2, barW, barH);
                    gfx.rect(cx + iconSize * 0.13, cy - barH / 2, barW, barH);
                } else {
                    // Stop ■
                    const boxS = iconSize * 0.7;
                    gfx.rect(cx - boxS / 2, cy - boxS / 2, boxS, boxS);
                }

                p.image(gfx, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                gfx.resizeCanvas(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
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
window.VJamFX.presets['vhs-rewind'] = VhsRewindPreset;
})();
