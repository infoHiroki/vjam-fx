(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key 6 - Set B: 霧の層が横に流れる全面fill
class FogBankPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.swirlAngle = 0;
    }

    setup(container) {
        this.destroy();
        this.swirlAngle = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 4;
            const layers = [];
            const lights = [];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noSmooth();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.noStroke();

                // Multiple fog layers at different depths/speeds
                for (let i = 0; i < 8; i++) {
                    layers.push({
                        y: (i / 8) * pg.height,
                        speed: 0.15 + Math.random() * 0.6,
                        thickness: 25 + Math.random() * 35,
                        hue: 195 + Math.random() * 30,
                        depth: 0.3 + Math.random() * 0.7, // depth affects brightness
                        offset: Math.random() * 1000,
                        swirlSeed: Math.random() * 500,
                    });
                }

                // Light sources peeking through fog
                for (let i = 0; i < 3; i++) {
                    lights.push({
                        x: (0.2 + Math.random() * 0.6) * pg.width,
                        y: (0.15 + Math.random() * 0.7) * pg.height,
                        hue: 30 + Math.random() * 40, // warm yellows/oranges
                        size: 15 + Math.random() * 25,
                        pulse: Math.random() * 1000,
                        drift: Math.random() * 500,
                    });
                }
            };

            p.draw = () => {
                const t = p.frameCount * 0.005 * preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                // Beat causes swirl accumulation
                preset.swirlAngle += pulse * 0.15;
                preset.swirlAngle *= 0.98; // decay

                // Background — not fully black, slight deep blue
                pg.background(210, 15, 2, 100);

                // Bass thickens fog (increases layer thickness temporarily)
                const thicknessMult = 1 + bass * 0.8;

                // Draw fog layers from back to front (depth sorted)
                const sortedLayers = [...layers].sort((a, b) => a.depth - b.depth);

                for (const layer of sortedLayers) {
                    const step = 2;
                    const layerThick = layer.thickness * thicknessMult;

                    for (let x = 0; x < pg.width; x += step) {
                        const nx = x * 0.006 + t * layer.speed + layer.offset;
                        const swirlOff = Math.sin(preset.swirlAngle + x * 0.02 + layer.swirlSeed) * 5 * pulse;
                        const drift = pg.noise(nx, t * 0.25 + layer.offset * 0.1) * layerThick;
                        const yBase = layer.y + Math.sin(t * layer.speed * 0.8 + x * 0.008) * 12 + swirlOff;

                        // Multi-octave density
                        const d1 = pg.noise(nx * 1.5, yBase * 0.008 + t * 0.15);
                        const d2 = pg.noise(nx * 3, yBase * 0.015 + t * 0.3) * 0.4;
                        const density = d1 + d2;

                        const bri = density * 28 * layer.depth + bass * 18 + pulse * 12;
                        if (bri < 2) continue;

                        const sat = 8 + mid * 12;
                        const hue = layer.hue + Math.sin(t * 0.3 + x * 0.01) * 5;

                        // Main fog body
                        pg.fill(hue, sat, Math.min(50, bri), 30 + layer.depth * 10);
                        const h = step * 2 + density * step;
                        pg.rect(x, yBase + drift - layerThick * 0.5, step, h);

                        // Volumetric wisp detail
                        const wisp = pg.noise(nx * 4, yBase * 0.02, t * 0.35 + layer.offset);
                        if (wisp > 0.5) {
                            const wispBri = bri * 0.6 + treble * 15;
                            pg.fill(hue + 8, sat * 0.7, Math.min(55, wispBri), 18);
                            pg.rect(x, yBase + drift + (wisp - 0.5) * layerThick * 0.8, step, step);
                        }

                        // Treble highlights — bright wisps on top layer
                        if (treble > 0.2 && layer.depth > 0.6) {
                            const highlight = pg.noise(nx * 5, t * 0.5) * treble;
                            if (highlight > 0.15) {
                                pg.fill(hue - 10, 5, 60 + highlight * 40, 12 + treble * 15);
                                pg.rect(x, yBase + drift - layerThick * 0.3, step, step);
                            }
                        }
                    }
                }

                // Light sources peeking through
                for (const light of lights) {
                    const lx = light.x + Math.sin(t * 0.5 + light.drift) * 8;
                    const ly = light.y + Math.cos(t * 0.3 + light.drift) * 5;
                    const pulseMod = 1 + Math.sin(t * 2 + light.pulse) * 0.3 + pulse * 0.5;
                    const lightSize = light.size * pulseMod * (1 + bass * 0.3);
                    const lightBri = 25 + mid * 20 + pulse * 15;

                    // Soft glow halo
                    pg.fill(light.hue, 20, Math.min(40, lightBri * 0.5), 8);
                    pg.ellipse(lx, ly, lightSize * 2, lightSize * 1.5);
                    // Core
                    pg.fill(light.hue, 15, Math.min(55, lightBri), 12);
                    pg.ellipse(lx, ly, lightSize, lightSize * 0.7);
                    // Hot center
                    pg.fill(light.hue - 10, 8, Math.min(70, lightBri + 15), 10);
                    pg.ellipse(lx, ly, lightSize * 0.4, lightSize * 0.3);
                }

                // Beat swirl — momentary circular disturbance
                if (pulse > 0.1) {
                    const cx = pg.width * 0.5;
                    const cy = pg.height * 0.5;
                    pg.noFill();
                    pg.strokeWeight(1);
                    pg.stroke(210, 10, 30, pulse * 20);
                    const swirlSize = 20 + pulse * 40;
                    pg.arc(cx, cy, swirlSize, swirlSize,
                        preset.swirlAngle, preset.swirlAngle + p.PI * 1.2);
                    pg.noStroke();
                }

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.noStroke();
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
window.VJamFX.presets['fog-bank'] = FogBankPreset;
})();
