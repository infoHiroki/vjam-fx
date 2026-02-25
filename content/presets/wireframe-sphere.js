(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class WireframeSpherePreset extends BasePreset {
        constructor() {
            super();
            this.params = { radius: 200, detail: 16, speed: 0.005 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.rotX = 0;
            this.rotY = 0;
        }

        setup(container) {
            this.destroy();
            const preset = this;

            this.p5 = new p5((p) => {
                p.setup = () => {
                    const w = container.clientWidth || 300;
                    const h = container.clientHeight || 150;
                    p.createCanvas(w, h);
                    p.pixelDensity(1);
                    p.background(0);
                };

                p.draw = () => {
                    // Fade trail
                    p.fill(0, 0, 0, 30);
                    p.noStroke();
                    p.rect(0, 0, p.width, p.height);

                    const cx = p.width / 2;
                    const cy = p.height / 2;
                    const r = preset.params.radius * (1 + preset.beatPulse * 0.25);
                    const detail = preset.params.detail;

                    preset.rotY += preset.params.speed * (1 + preset.audio.rms * 3);
                    preset.rotX += preset.params.speed * 0.6;

                    const cosRX = Math.cos(preset.rotX);
                    const sinRX = Math.sin(preset.rotX);
                    const cosRY = Math.cos(preset.rotY);
                    const sinRY = Math.sin(preset.rotY);

                    // Project a 3D point to 2D
                    const project = (x, y, z) => {
                        // Rotate Y
                        const x1 = x * cosRY - z * sinRY;
                        const z1 = x * sinRY + z * cosRY;
                        // Rotate X
                        const y1 = y * cosRX - z1 * sinRX;
                        const z2 = y * sinRX + z1 * cosRX;
                        return { x: cx + x1, y: cy + y1, z: z2 };
                    };

                    const greenBase = 80 + preset.audio.rms * 175;
                    p.strokeWeight(1);

                    // Latitude lines
                    for (let i = 1; i < detail; i++) {
                        const phi = (i / detail) * Math.PI;
                        const sinP = Math.sin(phi);
                        const cosP = Math.cos(phi);
                        const steps = detail * 2;
                        let prev = null;
                        for (let j = 0; j <= steps; j++) {
                            const theta = (j / steps) * Math.PI * 2;
                            const px = r * sinP * Math.cos(theta);
                            const py = r * cosP;
                            const pz = r * sinP * Math.sin(theta);
                            const pt = project(px, py, pz);
                            if (prev) {
                                const alpha = p.map(pt.z, -r, r, 40, 200);
                                p.stroke(0, greenBase, 0, alpha);
                                p.line(prev.x, prev.y, pt.x, pt.y);
                            }
                            prev = pt;
                        }
                    }

                    // Longitude lines
                    for (let j = 0; j < detail; j++) {
                        const theta = (j / detail) * Math.PI * 2;
                        const cosT = Math.cos(theta);
                        const sinT = Math.sin(theta);
                        const steps = detail * 2;
                        let prev = null;
                        for (let i = 0; i <= steps; i++) {
                            const phi = (i / steps) * Math.PI;
                            const px = r * Math.sin(phi) * cosT;
                            const py = r * Math.cos(phi);
                            const pz = r * Math.sin(phi) * sinT;
                            const pt = project(px, py, pz);
                            if (prev) {
                                const alpha = p.map(pt.z, -r, r, 40, 200);
                                p.stroke(0, greenBase, 0, alpha);
                                p.line(prev.x, prev.y, pt.x, pt.y);
                            }
                            prev = pt;
                        }
                    }

                    preset.beatPulse *= 0.92;
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

    window.VJamFX.presets['wireframe-sphere'] = WireframeSpherePreset;
})();
