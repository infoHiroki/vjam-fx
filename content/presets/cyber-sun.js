(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CyberSunPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.rayRotation = 0;
    }

    setup(container) {
        this.destroy();
        this.rayRotation = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
            };

            p.draw = () => {
                // Background gradient: dark navy to slightly purple at top
                p.background(5, 5, 15);
                preset.beatPulse *= 0.92;

                // Faint atmosphere gradient
                p.noStroke();
                for (let y = 0; y < p.height * 0.6; y += 4) {
                    const t = y / (p.height * 0.6);
                    p.fill(30 + t * 10, 5, 40 - t * 20, 15);
                    p.rect(0, y, p.width, 4);
                }

                const cx = p.width / 2;
                const sunY = p.height * 0.3;
                const sunR = Math.min(p.width, p.height) * 0.15;

                // Light rays (behind sun)
                preset.rayRotation += 0.003 + preset.audio.mid * 0.005;
                const numRays = 16;
                const rayBrightness = 120 + preset.beatPulse * 135;

                p.push();
                p.translate(cx, sunY);
                p.rotate(preset.rayRotation);

                for (let i = 0; i < numRays; i++) {
                    const angle = (p.TWO_PI * i) / numRays;
                    const rayLen = sunR * 3 + preset.audio.bass * sunR * 2;
                    const rayWidth = 0.08 + preset.beatPulse * 0.04;

                    // Ray glow
                    p.fill(255, 150, 50, rayBrightness * 0.15);
                    p.beginShape();
                    p.vertex(0, 0);
                    p.vertex(
                        Math.cos(angle - rayWidth) * rayLen,
                        Math.sin(angle - rayWidth) * rayLen
                    );
                    p.vertex(
                        Math.cos(angle + rayWidth) * rayLen,
                        Math.sin(angle + rayWidth) * rayLen
                    );
                    p.endShape(p.CLOSE);

                    // Ray core
                    p.fill(255, 200, 100, rayBrightness * 0.08);
                    const coreWidth = rayWidth * 0.4;
                    p.beginShape();
                    p.vertex(0, 0);
                    p.vertex(
                        Math.cos(angle - coreWidth) * rayLen * 0.8,
                        Math.sin(angle - coreWidth) * rayLen * 0.8
                    );
                    p.vertex(
                        Math.cos(angle + coreWidth) * rayLen * 0.8,
                        Math.sin(angle + coreWidth) * rayLen * 0.8
                    );
                    p.endShape(p.CLOSE);
                }
                p.pop();

                // Sun gradient circles (outer to inner)
                const gradSteps = 12;
                for (let i = gradSteps; i >= 0; i--) {
                    const t = i / gradSteps;
                    const r = sunR * (0.3 + t * 0.7);
                    // Magenta core -> orange -> yellow edge
                    const cr = p.lerp(255, 255, t);
                    const cg = p.lerp(50, 220, t);
                    const cb = p.lerp(200, 50, t);
                    const ca = p.lerp(255, 130, t);
                    p.fill(cr, cg, cb, ca);
                    p.noStroke();
                    p.ellipse(cx, sunY, r * 2, r * 2);
                }

                // Sun bright core
                p.fill(255, 255, 255, 180 + preset.beatPulse * 75);
                p.ellipse(cx, sunY, sunR * 0.4, sunR * 0.4);

                // Horizontal lens flare
                const flareAlpha = 60 + preset.beatPulse * 80;
                p.stroke(255, 200, 150, flareAlpha);
                p.strokeWeight(2);
                p.line(cx - sunR * 2.5, sunY, cx + sunR * 2.5, sunY);
                p.stroke(255, 200, 150, flareAlpha * 0.4);
                p.strokeWeight(6);
                p.line(cx - sunR * 1.8, sunY, cx + sunR * 1.8, sunY);

                // Small lens flare dots
                p.noStroke();
                const flareDots = [
                    { offset: -1.5, size: 8, a: 0.5 },
                    { offset: 1.2, size: 6, a: 0.4 },
                    { offset: -2.0, size: 4, a: 0.3 },
                    { offset: 1.8, size: 10, a: 0.3 },
                ];
                for (const fd of flareDots) {
                    p.fill(255, 200, 255, flareAlpha * fd.a);
                    p.ellipse(cx + sunR * fd.offset, sunY, fd.size, fd.size);
                }

                // Bottom silhouette (simple dark buildings/mountains)
                p.fill(3, 3, 10);
                p.noStroke();
                const groundY = p.height * 0.75;
                p.beginShape();
                p.vertex(0, p.height);
                p.vertex(0, groundY + 20);
                // Jagged skyline
                const segs = 20;
                for (let i = 0; i <= segs; i++) {
                    const sx = (p.width * i) / segs;
                    const h = 10 + Math.abs(Math.sin(i * 1.7 + 0.5)) * 60
                        + Math.abs(Math.sin(i * 3.1)) * 30;
                    p.vertex(sx, groundY + 30 - h);
                }
                p.vertex(p.width, p.height);
                p.endShape(p.CLOSE);

                // Beat glow
                if (preset.beatPulse > 0.2) {
                    p.noStroke();
                    p.fill(255, 100, 200, preset.beatPulse * 20);
                    p.rect(0, 0, p.width, p.height);
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
window.VJamFX.presets['cyber-sun'] = CyberSunPreset;
})();
