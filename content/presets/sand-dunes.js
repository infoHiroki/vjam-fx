(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SandDunesPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.gustPulse = 0;
        this.sandParticles = [];
        this.gustStreaks = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            const RES = 3;
            let gDunes, gSky;
            const NUM_DUNE_LAYERS = 7;
            const MAX_SAND = 120;
            let duneSeeds;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);

                const rw = Math.floor(p.width / RES);
                const rh = Math.floor(p.height / RES);
                gDunes = p.createGraphics(rw, rh);
                gDunes.colorMode(gDunes.HSB, 360, 100, 100, 100);
                gSky = p.createGraphics(rw, rh);
                gSky.colorMode(gSky.HSB, 360, 100, 100, 100);

                // Seed each dune layer with unique parameters
                duneSeeds = [];
                for (let i = 0; i < NUM_DUNE_LAYERS; i++) {
                    const depth = i / (NUM_DUNE_LAYERS - 1); // 0=far, 1=near
                    duneSeeds.push({
                        yBase: 0.22 + depth * 0.55,
                        amplitude: 0.04 + depth * 0.035,
                        freq1: 1.2 + i * 0.4,
                        freq2: 2.1 + i * 0.7,
                        freq3: 3.8 + i * 0.3,
                        speed: (0.12 + i * 0.06) * (i % 2 === 0 ? 1 : -0.7),
                        // Colors: far dunes cooler/lighter, near dunes warmer/darker
                        hue: 38 - depth * 12,
                        sat: 45 + depth * 20,
                        bri: 70 - depth * 20,
                        ridgeWidth: 0.6 + depth * 1.0,
                        shadowDepth: 0.3 + depth * 0.3,
                        phase: i * 1.7
                    });
                }

                // Initialize sand particles
                preset.sandParticles = [];
                for (let i = 0; i < MAX_SAND; i++) {
                    preset.sandParticles.push(preset._newSand(p));
                }
            };

            p.draw = () => {
                const t = p.frameCount * 0.006 * preset.params.speed;
                preset.beatPulse *= 0.91;
                preset.gustPulse *= 0.95;

                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;
                const wind = 1 + bass * 2 + preset.gustPulse * 2;

                const rw = gDunes.width;
                const rh = gDunes.height;

                // --- Sky layer ---
                gSky.clear();
                gSky.noStroke();
                const horizonY = rh * 0.30;
                const skySteps = 12;
                for (let i = 0; i < skySteps; i++) {
                    const frac = i / skySteps;
                    const y = frac * horizonY;
                    const h = horizonY / skySteps + 1;
                    // Deep indigo at top → warm amber at horizon
                    const hue = p.lerp(260, 30, frac * frac);
                    const sat = p.lerp(25, 50, frac);
                    const bri = p.lerp(6, 28, frac) + preset.beatPulse * 6;
                    gSky.fill(hue, sat, Math.min(100, bri), 80);
                    gSky.rect(0, y, rw, h);
                }
                // Horizon glow line
                const glowBri = 35 + preset.beatPulse * 15 + rms * 12;
                gSky.fill(35, 55, Math.min(100, glowBri), 40);
                gSky.rect(0, horizonY - 3, rw, 6);

                // --- Dune layers ---
                gDunes.clear();
                gDunes.noStroke();

                for (let layer = 0; layer < NUM_DUNE_LAYERS; layer++) {
                    const d = duneSeeds[layer];
                    const depth = layer / (NUM_DUNE_LAYERS - 1);
                    const yCenter = d.yBase * rh;
                    const amp = d.amplitude * rh * (1 + bass * 0.25);
                    const speed = d.speed * t;

                    const numPts = 24;
                    const points = [];

                    for (let i = 0; i <= numPts; i++) {
                        const frac = i / numPts;
                        const x = frac * rw;
                        // Multi-frequency dune shape for organic feel
                        const n1 = Math.sin(frac * d.freq1 * Math.PI * 2 + speed + d.phase) * amp;
                        const n2 = Math.sin(frac * d.freq2 * Math.PI * 2 + speed * 1.4 + d.phase * 0.7) * amp * 0.35;
                        const n3 = Math.sin(frac * d.freq3 * Math.PI * 2 + speed * 0.6 + d.phase * 1.3) * amp * 0.12;
                        // Beat adds ripple
                        const beatRipple = Math.sin(frac * 8 + t * 3) * amp * 0.08 * preset.beatPulse;
                        const y = yCenter + n1 + n2 + n3 + beatRipple;
                        points.push({ x, y });
                    }

                    // Shadow side of dune (darker fill below the ridge)
                    const shadowHue = d.hue + 5;
                    const shadowSat = d.sat + 10;
                    const shadowBri = d.bri * (1 - d.shadowDepth) + preset.beatPulse * 8;
                    const shadowAlpha = 55 + layer * 5;

                    gDunes.fill(shadowHue, Math.min(100, shadowSat), Math.min(100, shadowBri), shadowAlpha);
                    gDunes.beginShape();
                    gDunes.vertex(-2, rh + 2);
                    for (let i = 0; i < points.length; i++) {
                        if (i === 0 || i === points.length - 1) {
                            gDunes.curveVertex(points[i].x, points[i].y);
                            gDunes.curveVertex(points[i].x, points[i].y);
                        } else {
                            gDunes.curveVertex(points[i].x, points[i].y);
                        }
                    }
                    gDunes.vertex(rw + 2, rh + 2);
                    gDunes.endShape(gDunes.CLOSE);

                    // Lit side highlight - shifted sunlight from left
                    const litHue = d.hue - 4;
                    const litSat = d.sat - 10;
                    const litBri = d.bri + 18 + preset.beatPulse * 10 + mid * 8;
                    const litAlpha = 30 + layer * 3;

                    gDunes.fill(litHue, Math.max(0, litSat), Math.min(100, litBri), litAlpha);
                    gDunes.beginShape();
                    for (let i = 0; i < points.length; i++) {
                        // Shift the lit surface slightly upward and to the left for sunlight effect
                        const litY = points[i].y - amp * 0.15;
                        if (i === 0 || i === points.length - 1) {
                            gDunes.curveVertex(points[i].x, litY);
                            gDunes.curveVertex(points[i].x, litY);
                        } else {
                            gDunes.curveVertex(points[i].x, litY);
                        }
                    }
                    // Close at the original dune line (creating a thin lit strip)
                    for (let i = points.length - 1; i >= 0; i--) {
                        if (i === 0 || i === points.length - 1) {
                            gDunes.curveVertex(points[i].x, points[i].y);
                            gDunes.curveVertex(points[i].x, points[i].y);
                        } else {
                            gDunes.curveVertex(points[i].x, points[i].y);
                        }
                    }
                    gDunes.endShape(gDunes.CLOSE);

                    // Ridge crest line (bright, thin)
                    gDunes.noFill();
                    const ridgeAlpha = 30 + preset.beatPulse * 20 + treble * 12;
                    const ridgeBri = 85 + preset.beatPulse * 15;
                    gDunes.stroke(d.hue - 8, 20, Math.min(100, ridgeBri), Math.min(100, ridgeAlpha));
                    gDunes.strokeWeight(d.ridgeWidth);
                    gDunes.beginShape();
                    for (let i = 0; i < points.length; i++) {
                        if (i === 0 || i === points.length - 1) {
                            gDunes.curveVertex(points[i].x, points[i].y);
                            gDunes.curveVertex(points[i].x, points[i].y);
                        } else {
                            gDunes.curveVertex(points[i].x, points[i].y);
                        }
                    }
                    gDunes.endShape();
                    gDunes.noStroke();

                    // Ripple texture lines on dune face (wind-carved)
                    if (depth > 0.3) {
                        const rippleCount = 3 + Math.floor(depth * 4);
                        for (let r = 0; r < rippleCount; r++) {
                            const ripFrac = (r + 1) / (rippleCount + 1);
                            const ripAlpha = 12 + treble * 8 + preset.gustPulse * 10;
                            gDunes.stroke(d.hue + 3, d.sat * 0.5, Math.min(100, d.bri + 10), ripAlpha);
                            gDunes.strokeWeight(0.4 + depth * 0.3);
                            gDunes.noFill();
                            gDunes.beginShape();
                            for (let i = 0; i < points.length; i += 2) {
                                const ripY = points[i].y + ripFrac * amp * 0.8;
                                const waveOff = Math.sin(points[i].x * 0.05 + t * 2 + r) * 2;
                                if (i === 0) {
                                    gDunes.curveVertex(points[i].x, ripY + waveOff);
                                    gDunes.curveVertex(points[i].x, ripY + waveOff);
                                } else if (i >= points.length - 2) {
                                    gDunes.curveVertex(points[i].x, ripY + waveOff);
                                    gDunes.curveVertex(points[i].x, ripY + waveOff);
                                } else {
                                    gDunes.curveVertex(points[i].x, ripY + waveOff);
                                }
                            }
                            gDunes.endShape();
                            gDunes.noStroke();
                        }
                    }
                }

                // --- Compose to main canvas ---
                p.background(0);
                p.image(gSky, 0, 0, p.width, p.height);
                p.image(gDunes, 0, 0, p.width, p.height);

                // --- Heat shimmer (direct on main canvas for finer detail) ---
                p.noStroke();
                const shimmerY = p.height * 0.25;
                const shimmerCount = 6 + Math.floor(rms * 6);
                for (let i = 0; i < shimmerCount; i++) {
                    const sx = (p.noise(i * 0.5, t * 0.5) * 1.4 - 0.2) * p.width;
                    const sy = shimmerY + Math.sin(t * 3 + i * 1.5) * 8;
                    const sw = 20 + p.noise(i * 3, t) * 40;
                    const sh = 2 + Math.sin(t * 2 + i) * 1;
                    p.fill(35, 20, 60, 6 + preset.beatPulse * 4);
                    p.ellipse(sx, sy, sw, sh);
                }

                // --- Wind-blown sand particles (direct on main canvas) ---
                p.noStroke();
                for (let i = 0; i < preset.sandParticles.length; i++) {
                    const sp = preset.sandParticles[i];
                    sp.x += sp.vx * wind;
                    sp.y += sp.vy + Math.sin(p.frameCount * 0.04 + sp.phase) * sp.drift;
                    sp.life--;

                    const lifeFrac = sp.life / sp.maxLife;
                    // Ease in and out
                    const fadeIn = Math.min(1, (1 - lifeFrac) * 5);
                    const fadeOut = Math.min(1, lifeFrac * 4);
                    const alpha = fadeIn * fadeOut * (25 + rms * 20 + preset.gustPulse * 15);

                    if (alpha > 1) {
                        p.fill(sp.hue, sp.sat, sp.bri, alpha);
                        if (sp.type === 0) {
                            // Dot particle
                            p.circle(sp.x, sp.y, sp.size);
                        } else {
                            // Streak particle - wind trail
                            const trail = sp.vx * wind * 2;
                            p.strokeWeight(sp.size * 0.4);
                            p.stroke(sp.hue, sp.sat, sp.bri, alpha * 0.7);
                            p.line(sp.x, sp.y, sp.x - trail, sp.y - sp.vy * 1.5);
                            p.noStroke();
                        }
                    }

                    if (sp.life <= 0 || sp.x > p.width + 30 || sp.x < -30 || sp.y > p.height + 20) {
                        preset.sandParticles[i] = preset._newSand(p);
                    }
                }

                // --- Gust streaks (beat-triggered) ---
                for (let i = preset.gustStreaks.length - 1; i >= 0; i--) {
                    const gs = preset.gustStreaks[i];
                    gs.x += gs.vx * wind * 1.8;
                    gs.y += gs.vy;
                    gs.life--;

                    const lifeFrac = gs.life / gs.maxLife;
                    const alpha = lifeFrac * lifeFrac * 35;

                    if (alpha > 1) {
                        p.stroke(gs.hue, 35, 80, alpha);
                        p.strokeWeight(gs.weight);
                        const len = gs.vx * 5;
                        p.line(gs.x, gs.y, gs.x - len, gs.y - gs.vy * 2);
                    }

                    if (gs.life <= 0 || gs.x > p.width + 50) {
                        preset.gustStreaks.splice(i, 1);
                    }
                }
                p.noStroke();

                // --- Foreground atmospheric haze ---
                const hazeLevels = 3;
                for (let h = 0; h < hazeLevels; h++) {
                    const hFrac = h / hazeLevels;
                    const hy = p.height * (0.7 + hFrac * 0.1);
                    const hh = p.height * (0.3 - hFrac * 0.1);
                    const hazeAlpha = 4 + hFrac * 3 + preset.beatPulse * 5;
                    const hazeHue = 35 + hFrac * 5;
                    p.fill(hazeHue, 25, 45, hazeAlpha);
                    p.rect(0, hy, p.width, hh);
                }

                // --- Distant sun glow (upper left) ---
                const sunX = p.width * 0.2;
                const sunY = p.height * 0.12;
                const sunBri = 40 + preset.beatPulse * 15 + rms * 10;
                const sunSize = 80 + preset.beatPulse * 30;
                p.fill(40, 50, Math.min(100, sunBri), 8);
                p.ellipse(sunX, sunY, sunSize * 3, sunSize * 2);
                p.fill(38, 40, Math.min(100, sunBri + 15), 12);
                p.ellipse(sunX, sunY, sunSize * 1.5, sunSize);
                p.fill(35, 30, Math.min(100, sunBri + 25), 18);
                p.ellipse(sunX, sunY, sunSize * 0.6, sunSize * 0.5);
            };

            p.windowResized = () => {
                const rw = Math.floor(container.clientWidth / RES);
                const rh = Math.floor(container.clientHeight / RES);
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                gDunes.resizeCanvas(rw, rh);
                gSky.resizeCanvas(rw, rh);
            };
        }, container);
    }

    _newSand(p) {
        const fromLeft = Math.random() < 0.65;
        const type = Math.random() < 0.6 ? 0 : 1; // 0=dot, 1=streak
        return {
            x: fromLeft ? -5 : Math.random() * p.width,
            y: p.height * 0.25 + Math.random() * p.height * 0.75,
            vx: 0.4 + Math.random() * 2.0,
            vy: (Math.random() - 0.4) * 0.4,
            size: type === 0 ? (1 + Math.random() * 2.5) : (0.8 + Math.random() * 1.5),
            drift: 0.2 + Math.random() * 0.5,
            phase: Math.random() * Math.PI * 2,
            hue: 28 + Math.random() * 18,
            sat: 35 + Math.random() * 30,
            bri: 55 + Math.random() * 35,
            life: 150 + Math.random() * 200,
            maxLife: 150 + Math.random() * 200,
            type
        };
    }

    _spawnGust(p) {
        const count = 15 + Math.floor(Math.random() * 20);
        const yCenter = p.height * (0.3 + Math.random() * 0.45);
        const startX = Math.random() * p.width * 0.4;
        for (let i = 0; i < count; i++) {
            this.gustStreaks.push({
                x: startX + Math.random() * p.width * 0.3,
                y: yCenter + (Math.random() - 0.5) * p.height * 0.12,
                vx: 2.5 + Math.random() * 5,
                vy: (Math.random() - 0.5) * 0.6,
                hue: 30 + Math.random() * 12,
                weight: 0.5 + Math.random() * 1.2,
                life: 50 + Math.random() * 70,
                maxLife: 50 + Math.random() * 70
            });
        }
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        this.gustPulse = strength;
        if (this.p5 && this.gustStreaks.length < 60) {
            this._spawnGust(this.p5);
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['sand-dunes'] = SandDunesPreset;
})();
