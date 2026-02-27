(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class RetroArcadePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.aliens = [];
        this.bullets = [];
        this.explosions = [];
        this.alienDir = 1;
        this.alienPhase = 0;
        this.alienFrame = 0;
        this.alienDropTimer = 0;
        this.score = 0;
        this.shipX = 0.5; // normalized 0-1
        this.shipDir = 1;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        // Initialize alien grid
        preset.aliens = [];
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 11; col++) {
                preset.aliens.push({ row, col, alive: true, deathTimer: 0 });
            }
        }
        preset.bullets = [];
        preset.explosions = [];
        preset.score = 0;
        preset.alienDir = 1;
        preset.alienPhase = 0;
        preset.alienFrame = 0;
        preset.shipX = 0.5;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 4;

            // Pixel sprite definitions (each row is one line of the sprite)
            // Invader type 1 (top rows) — squid style 8x8
            const squid1 = [
                [0,0,0,1,1,0,0,0],
                [0,0,1,1,1,1,0,0],
                [0,1,1,1,1,1,1,0],
                [1,1,0,1,1,0,1,1],
                [1,1,1,1,1,1,1,1],
                [0,0,1,0,0,1,0,0],
                [0,1,0,1,1,0,1,0],
                [1,0,1,0,0,1,0,1],
            ];
            const squid2 = [
                [0,0,0,1,1,0,0,0],
                [0,0,1,1,1,1,0,0],
                [0,1,1,1,1,1,1,0],
                [1,1,0,1,1,0,1,1],
                [1,1,1,1,1,1,1,1],
                [0,1,0,0,0,0,1,0],
                [1,0,0,1,1,0,0,1],
                [0,1,1,0,0,1,1,0],
            ];

            // Invader type 2 (middle rows) — crab style 11x8
            const crab1 = [
                [0,0,1,0,0,0,0,0,1,0,0],
                [0,0,0,1,0,0,0,1,0,0,0],
                [0,0,1,1,1,1,1,1,1,0,0],
                [0,1,1,0,1,1,1,0,1,1,0],
                [1,1,1,1,1,1,1,1,1,1,1],
                [1,0,1,1,1,1,1,1,1,0,1],
                [1,0,1,0,0,0,0,0,1,0,1],
                [0,0,0,1,1,0,1,1,0,0,0],
            ];
            const crab2 = [
                [0,0,1,0,0,0,0,0,1,0,0],
                [1,0,0,1,0,0,0,1,0,0,1],
                [1,0,1,1,1,1,1,1,1,0,1],
                [1,1,1,0,1,1,1,0,1,1,1],
                [1,1,1,1,1,1,1,1,1,1,1],
                [0,1,1,1,1,1,1,1,1,1,0],
                [0,0,1,0,0,0,0,0,1,0,0],
                [0,1,0,0,0,0,0,0,0,1,0],
            ];

            // Invader type 3 (bottom rows) — octopus style 12x8
            const octo1 = [
                [0,0,0,0,1,1,1,1,0,0,0,0],
                [0,1,1,1,1,1,1,1,1,1,1,0],
                [1,1,1,1,1,1,1,1,1,1,1,1],
                [1,1,1,0,0,1,1,0,0,1,1,1],
                [1,1,1,1,1,1,1,1,1,1,1,1],
                [0,0,0,1,1,0,0,1,1,0,0,0],
                [0,0,1,1,0,1,1,0,1,1,0,0],
                [1,1,0,0,0,0,0,0,0,0,1,1],
            ];
            const octo2 = [
                [0,0,0,0,1,1,1,1,0,0,0,0],
                [0,1,1,1,1,1,1,1,1,1,1,0],
                [1,1,1,1,1,1,1,1,1,1,1,1],
                [1,1,1,0,0,1,1,0,0,1,1,1],
                [1,1,1,1,1,1,1,1,1,1,1,1],
                [0,0,1,1,1,0,0,1,1,1,0,0],
                [0,1,1,0,0,1,1,0,0,1,1,0],
                [0,0,1,1,0,0,0,0,1,1,0,0],
            ];

            // Player ship 13x8
            const shipSprite = [
                [0,0,0,0,0,0,1,0,0,0,0,0,0],
                [0,0,0,0,0,1,1,1,0,0,0,0,0],
                [0,0,0,0,0,1,1,1,0,0,0,0,0],
                [0,1,1,1,1,1,1,1,1,1,1,1,0],
                [1,1,1,1,1,1,1,1,1,1,1,1,1],
                [1,1,1,1,1,1,1,1,1,1,1,1,1],
                [1,1,1,1,1,1,1,1,1,1,1,1,1],
                [1,1,1,1,1,1,1,1,1,1,1,1,1],
            ];

            // Explosion sprite 13x7
            const explosionSprite = [
                [0,0,1,0,0,0,1,0,0,0,1,0,0],
                [0,0,0,1,0,0,0,0,0,1,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0],
                [1,1,0,0,0,0,0,0,0,0,0,1,1],
                [0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,1,0,0,0,0,0,1,0,0,0],
                [0,0,1,0,0,0,1,0,0,0,1,0,0],
            ];

            const drawSprite = (x, y, sprite, pixSize, hue, sat, bri, alpha) => {
                pg.noStroke();
                pg.fill(hue, sat, bri, alpha);
                const rows = sprite.length;
                const cols = sprite[0].length;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        if (sprite[r][c]) {
                            pg.rect(
                                Math.floor(x + c * pixSize),
                                Math.floor(y + r * pixSize),
                                Math.ceil(pixSize),
                                Math.ceil(pixSize)
                            );
                        }
                    }
                }
            };

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.colorMode(pg.HSB, 360, 100, 100, 100);
                pg.noSmooth();
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;

                const w = pg.width;
                const h = pg.height;

                pg.background(0);

                // Pixel size for sprites
                const pixSize = Math.max(1, Math.floor(Math.min(w, h) * 0.006));
                const alienGapX = pixSize * 16;
                const alienGapY = pixSize * 12;
                const gridW = 11 * alienGapX;
                const startX = (w - gridW) / 2 + alienGapX * 0.5;
                const baseY = h * 0.08;

                // Move alien formation
                preset.alienPhase += 0.012 * speed;
                const moveAmount = Math.sin(preset.alienPhase) * (w * 0.12);

                // Animate alien frame (toggle every ~30 frames)
                if (p.frameCount % 30 === 0) {
                    preset.alienFrame = 1 - preset.alienFrame;
                }

                // Draw aliens
                const aliveAliens = [];
                for (const alien of preset.aliens) {
                    if (!alien.alive) {
                        // Death explosion animation
                        if (alien.deathTimer > 0) {
                            alien.deathTimer--;
                            const ax = startX + alien.col * alienGapX + moveAmount;
                            const ay = baseY + alien.row * alienGapY;
                            const alpha = (alien.deathTimer / 15) * 90;
                            drawSprite(ax - pixSize * 2, ay - pixSize, explosionSprite, pixSize, 0, 0, 100, alpha);
                        }
                        continue;
                    }
                    aliveAliens.push(alien);

                    const ax = startX + alien.col * alienGapX + moveAmount;
                    const ay = baseY + alien.row * alienGapY;

                    // Choose sprite by row type
                    let sprite;
                    let hue, sat, bri;
                    if (alien.row === 0) {
                        // Top row — squid (white)
                        sprite = preset.alienFrame === 0 ? squid1 : squid2;
                        hue = 0; sat = 0; bri = 100;
                    } else if (alien.row <= 2) {
                        // Middle rows — crab (green)
                        sprite = preset.alienFrame === 0 ? crab1 : crab2;
                        hue = 120; sat = 70; bri = 90;
                    } else {
                        // Bottom rows — octopus (green, slightly different shade)
                        sprite = preset.alienFrame === 0 ? octo1 : octo2;
                        hue = 130; sat = 60; bri = 85;
                    }

                    drawSprite(ax, ay, sprite, pixSize, hue, sat, bri, 95);
                }

                // Player ship
                preset.shipX += 0.003 * speed * preset.shipDir;
                if (preset.shipX > 0.85 || preset.shipX < 0.15) {
                    preset.shipDir *= -1;
                }
                const shipPxW = shipSprite[0].length * pixSize;
                const shipPxH = shipSprite.length * pixSize;
                const playerX = w * preset.shipX - shipPxW / 2;
                const playerY = h * 0.9 - shipPxH;
                const shipCenterX = playerX + shipPxW / 2;

                // Ship — classic green
                drawSprite(playerX, playerY, shipSprite, pixSize, 120, 80, 95, 95);

                // Bullets
                for (let i = preset.bullets.length - 1; i >= 0; i--) {
                    const b = preset.bullets[i];
                    b.y -= 2.5 * speed;
                    if (b.y < 0) {
                        preset.bullets.splice(i, 1);
                        continue;
                    }

                    // Draw bullet (small rect, red/white)
                    pg.noStroke();
                    pg.fill(0, 90, 95, 95); // red bullets
                    pg.rect(Math.floor(b.x), Math.floor(b.y), pixSize, pixSize * 3);

                    // Collision with aliens
                    for (const alien of aliveAliens) {
                        if (!alien.alive) continue;
                        const ax = startX + alien.col * alienGapX + moveAmount;
                        const ay = baseY + alien.row * alienGapY;
                        const aw = (alien.row === 0 ? 8 : (alien.row <= 2 ? 11 : 12)) * pixSize;
                        const ah = 8 * pixSize;
                        if (b.x + pixSize > ax && b.x < ax + aw &&
                            b.y < ay + ah && b.y + pixSize * 3 > ay) {
                            alien.alive = false;
                            alien.deathTimer = 15;
                            preset.bullets.splice(i, 1);
                            preset.score += (alien.row === 0 ? 30 : (alien.row <= 2 ? 20 : 10));
                            // Particle explosion
                            for (let e = 0; e < 6; e++) {
                                const angle = (e / 6) * Math.PI * 2;
                                preset.explosions.push({
                                    x: ax + aw / 2,
                                    y: ay + ah / 2,
                                    vx: Math.cos(angle) * (1 + Math.random()),
                                    vy: Math.sin(angle) * (1 + Math.random()),
                                    life: 20,
                                });
                            }
                            break;
                        }
                    }
                }

                // Explosion particles
                for (let i = preset.explosions.length - 1; i >= 0; i--) {
                    const ex = preset.explosions[i];
                    ex.x += ex.vx;
                    ex.y += ex.vy;
                    ex.life--;
                    if (ex.life <= 0) {
                        preset.explosions.splice(i, 1);
                        continue;
                    }
                    const alpha = (ex.life / 20) * 90;
                    pg.noStroke();
                    pg.fill(0, 0, 100, alpha);
                    pg.rect(Math.floor(ex.x), Math.floor(ex.y), pixSize, pixSize);
                }

                // Autonomous bullet firing (every ~45 frames without audio)
                if (p.frameCount % 45 === 0 && preset.beatPulse < 0.1) {
                    preset.bullets.push({
                        x: shipCenterX,
                        y: playerY,
                    });
                }

                // Respawn aliens if all dead
                if (aliveAliens.length === 0) {
                    for (const alien of preset.aliens) {
                        alien.alive = true;
                        alien.deathTimer = 0;
                    }
                }

                // Score display — pixel style
                pg.fill(0, 0, 90, 70);
                pg.noStroke();
                pg.textSize(Math.max(4, pixSize * 3));
                pg.textAlign(pg.LEFT, pg.TOP);
                pg.text('SCORE ' + preset.score, pixSize * 2, pixSize * 2);

                // Ground line
                pg.stroke(120, 70, 80, 50);
                pg.strokeWeight(1);
                pg.line(0, h * 0.94, w, h * 0.94);

                // Beat screen flash
                if (pulse > 0.3) {
                    pg.noStroke();
                    pg.fill(0, 0, 100, pulse * 8);
                    pg.rect(0, 0, w, h);
                }

                // Cap bullets
                if (preset.bullets.length > 20) preset.bullets.splice(0, 5);
                if (preset.explosions.length > 60) preset.explosions.splice(0, 20);

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.colorMode(pg.HSB, 360, 100, 100, 100);
                pg.noSmooth();
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
        if (!this.p5) return;
        const w = this.p5.width / 4; // RES=4
        const shipPxW = 13 * Math.max(1, Math.floor(Math.min(w, this.p5.height / 4) * 0.006));
        const shipCenterX = w * this.shipX;
        const shipY = (this.p5.height / 4) * 0.9 - 8 * Math.max(1, Math.floor(Math.min(w, this.p5.height / 4) * 0.006));

        // Fire bullets from ship on beat
        const count = strength > 0.7 ? 3 : 1;
        for (let i = 0; i < count; i++) {
            this.bullets.push({
                x: shipCenterX + (i - Math.floor(count / 2)) * 3,
                y: shipY,
            });
        }
        if (this.bullets.length > 20) this.bullets.splice(0, 5);
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['retro-arcade'] = RetroArcadePreset;
})();
