(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NeonSignPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.signs = [];
  }

  setup(container) {
    this.destroy();
    this.signs = [];
    const preset = this;

    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);

        const colors = [
          [255, 20, 147],  // hot pink
          [0, 255, 255],   // cyan
          [255, 255, 0],   // yellow
          [0, 255, 100],   // green
          [255, 100, 0],   // orange
          [255, 0, 255],   // magenta
          [100, 100, 255], // blue
          [255, 50, 50],   // red
          [0, 255, 200],   // teal
          [255, 200, 50],  // gold
        ];

        const shapes = [
          'circle', 'arrow-right', 'arrow-down', 'star', 'diamond',
          'rect-border', 'double-circle', 'cross', 'zigzag',
          'heart', 'lightning', 'music-note', 'triangle',
          'hexagon', 'spiral-rect', 'brackets',
          // venue / nightlife
          'word-OPEN', 'word-BAR', 'word-LIVE', 'word-CLUB', 'word-DJ',
          'word-NEON', 'word-EXIT', 'word-HOT', 'word-24H',
          'word-DANCE', 'word-MUSIC', 'word-LOVE', 'word-PARTY', 'word-BEER',
          'word-DISCO', 'word-GIRLS', 'word-BOYS', 'word-CASH', 'word-FREE',
          'word-MOTEL', 'word-HOTEL', 'word-TAXI', 'word-PIZZA', 'word-DRUGS',
          'word-SAKE', 'word-SHOTS', 'word-VODKA', 'word-WHISKY', 'word-RUM',
          'word-ABSINTHE', 'word-TEQUILA', 'word-GIN', 'word-MEZCAL',
          // dirty / adult
          'word-XXX', 'word-SEX', 'word-NUDE', 'word-PORN', 'word-ADULT',
          'word-TOPLESS', 'word-PEEP', 'word-DILDO', 'word-EROTIC',
          'word-KINKY', 'word-FETISH', 'word-STRIPPER', 'word-ORGASM',
          'word-HORNY', 'word-SLUTTY', 'word-DIRTY', 'word-NASTY', 'word-FILTHY',
          // profanity / slang
          'word-FUCK', 'word-SHIT', 'word-DAMN', 'word-HELL', 'word-WASTED',
          'word-BITCH', 'word-ASS', 'word-CRAP', 'word-PISS', 'word-BOLLOCKS',
          'word-MOTHERFUCKER', 'word-BULLSHIT', 'word-WTF', 'word-FML', 'word-LMAO',
          'word-YOLO', 'word-BRUH', 'word-DOPE', 'word-LIT', 'word-SLAY',
          'word-SALTY', 'word-THICC', 'word-SIMP', 'word-GOAT', 'word-FIRE',
          'word-CAP', 'word-NO CAP', 'word-BASED', 'word-SUS', 'word-RATIO',
          'word-FLEX', 'word-VIBE', 'word-MOOD', 'word-BET', 'word-FADED',
          'word-BUSSIN', 'word-LOWKEY', 'word-DEADASS', 'word-HELLA', 'word-AF',
          // substances
          'word-DRUNK', 'word-HIGH', 'word-STONED', 'word-LOADED', 'word-WEED',
          'word-BLUNT', 'word-BAKED', 'word-TRIPPIN', 'word-BLAZED', 'word-ZOOTED',
          'word-EDIBLES', 'word-MOLLY', 'word-ACID', 'word-SHROOMS', 'word-DMT',
          // cities
          'word-TOKYO', 'word-OSAKA', 'word-VEGAS', 'word-NYC', 'word-LA',
          'word-BANGKOK', 'word-SEOUL', 'word-BERLIN', 'word-HAVANA',
          'word-IBIZA', 'word-MIAMI', 'word-DETROIT', 'word-COMPTON', 'word-BRONX',
          // street / outlaw
          'word-DANGER', 'word-WANTED', 'word-REBEL', 'word-OUTLAW', 'word-VICE',
          'word-TABOO', 'word-SIN', 'word-CHAOS', 'word-RIOT', 'word-ANARCHY',
          'word-PSYCHO', 'word-FREAK', 'word-MANIAC', 'word-SAVAGE', 'word-BEAST',
          'word-HUSTLER', 'word-PIMP', 'word-DEALER', 'word-GAMBLE', 'word-JACKPOT',
          'word-THUG', 'word-GANGSTA', 'word-OG', 'word-HOOD', 'word-TRAP',
          'word-GRIND', 'word-HUSTLE', 'word-PLUG', 'word-SCORE', 'word-HEIST',
          // body / ink
          'word-TATTOO', 'word-PIERCING', 'word-INK', 'word-RAZOR',
          'word-SCAR', 'word-BLOOD', 'word-SWEAT', 'word-TEARS', 'word-GUTS',
          // impact
          'word-BANG', 'word-BOOM', 'word-POW', 'word-FLASH', 'word-BURN',
          'word-VOODOO', 'word-KARMA', 'word-DEATH', 'word-SKULL', 'word-POISON',
          'word-RAGE', 'word-FURY', 'word-HAVOC', 'word-CARNAGE', 'word-MAYHEM',
          // phrases — street
          'word-NO SLEEP', 'word-STAY GOLD', 'word-GO HARD', 'word-ALL NIGHT',
          'word-GAME OVER', 'word-LAST CALL', 'word-ONE MORE', 'word-NO LIMIT',
          'word-BAD GIRLS', 'word-GOOD TIMES', 'word-CHEAP THRILL',
          'word-TOO FAST', 'word-SO WHAT', 'word-WHO CARES',
          'word-EAT ME', 'word-BITE ME', 'word-KISS ME', 'word-KILL ME',
          'word-NO GODS', 'word-NO MASTERS', 'word-BORN TO DIE',
          'word-LIVE FAST', 'word-DIE YOUNG', 'word-RIDE OR DIE',
          'word-COLD CASH', 'word-EASY MONEY', 'word-DIRTY MONEY',
          'word-COME IN', 'word-GET OUT', 'word-KEEP OUT', 'word-ENTER HERE',
          'word-RAW POWER', 'word-WILD CHILD',
          'word-AFTER DARK', 'word-MIDNIGHT', 'word-3AM', 'word-SUNRISE',
          // phrases — slang / vulgar
          'word-SEND NUDES', 'word-CASH ONLY', 'word-NO REFUNDS',
          'word-SHIT HAPPENS', 'word-NO FUCKS GIVEN', 'word-ZERO FUCKS',
          'word-TALK SHIT', 'word-GET HIT', 'word-PULL UP', 'word-SLIDE IN',
          'word-RUN IT BACK', 'word-SAY LESS', 'word-ON GOD', 'word-FR FR',
          'word-ITS GIVING', 'word-MAIN CHARACTER', 'word-NPC ENERGY',
          'word-CATCH THESE HANDS', 'word-BUILT DIFFERENT',
          'word-TRUST NO ONE', 'word-MONEY TALKS', 'word-THUG LIFE',
          'word-REAL ONES KNOW', 'word-STAY DANGEROUS',
          'word-EAT THE RICH', 'word-ACAB', 'word-RESIST', 'word-OCCUPY',
          'word-SMASH THE STATE', 'word-BURN IT DOWN', 'word-FUCK THE SYSTEM',
        ];

        const NUM_SIGNS = 50;

        for (let i = 0; i < NUM_SIGNS; i++) {
          const size = 25 + Math.random() * 80;
          preset.signs.push({
            x: Math.random() * p.width,
            y: Math.random() * p.height,
            size,
            shape: shapes[Math.floor(Math.random() * shapes.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: (Math.random() - 0.5) * 0.3,
            rotSpeed: (Math.random() - 0.5) * 0.002,
            driftX: (Math.random() - 0.5) * 0.2,
            driftY: (Math.random() - 0.5) * 0.15,
            flickerPhase: Math.random() * 100,
            flickerSpeed: 0.03 + Math.random() * 0.08,
            flickerType: Math.random() < 0.3 ? 'hard' : 'soft',
            darkTimer: 0,
            baseBright: 0.7 + Math.random() * 0.3,
            pulsePhase: Math.random() * Math.PI * 2,
          });
        }
      };

      p.draw = () => {
        p.background(0);
        preset.beatPulse *= 0.9;
        const bass = preset.audio.bass;

        for (const sign of preset.signs) {
          sign.x += sign.driftX;
          sign.y += sign.driftY;
          sign.rotation += sign.rotSpeed;

          // Wrap
          const margin = sign.size;
          if (sign.x < -margin) sign.x = p.width + margin;
          if (sign.x > p.width + margin) sign.x = -margin;
          if (sign.y < -margin) sign.y = p.height + margin;
          if (sign.y > p.height + margin) sign.y = -margin;

          // Dark period
          if (sign.darkTimer > 0) {
            sign.darkTimer--;
            if (sign.darkTimer > 3) continue;
          } else if (sign.flickerType === 'hard' && Math.random() < 0.005) {
            sign.darkTimer = 8 + Math.floor(Math.random() * 20);
          }

          // Flicker
          let flicker;
          if (sign.flickerType === 'hard') {
            flicker = Math.sin(p.frameCount * sign.flickerSpeed + sign.flickerPhase) > 0 ? 1 : 0.3;
          } else {
            flicker = 0.6 + 0.4 * Math.sin(p.frameCount * sign.flickerSpeed + sign.flickerPhase);
          }

          // Slow pulse
          const pulse = 0.85 + 0.15 * Math.sin(p.frameCount * 0.015 + sign.pulsePhase);

          let alpha = 140 + flicker * 80 * pulse * sign.baseBright;

          // Bass pulse: brighter
          alpha = Math.min(255, alpha + bass * 80 + preset.beatPulse * 60);

          const [r, g, b] = sign.color;
          const glowBoost = 1 + bass * 0.5 + preset.beatPulse * 0.3;

          p.push();
          p.translate(sign.x, sign.y);
          p.rotate(sign.rotation);

          // Glow layers (outer to inner)
          const layers = [
            { weight: 22 * glowBoost, a: alpha * 0.06 },
            { weight: 14 * glowBoost, a: alpha * 0.12 },
            { weight: 8, a: alpha * 0.3 },
            { weight: 4, a: alpha * 0.6 },
            { weight: 2, a: alpha * 0.95 },
          ];

          for (const layer of layers) {
            p.noFill();
            p.stroke(r, g, b, layer.a);
            p.strokeWeight(layer.weight);
            preset._drawShape(p, sign.shape, sign.size);
          }

          // Bright core (white-ish center)
          p.stroke(
            r + (255 - r) * 0.5,
            g + (255 - g) * 0.5,
            b + (255 - b) * 0.5,
            alpha * 0.4
          );
          p.strokeWeight(1.5);
          preset._drawShape(p, sign.shape, sign.size);

          p.pop();
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
      };
    }, container);
  }

  _drawShape(p, shape, s) {
    const hs = s / 2;

    // Word signs
    if (shape.startsWith('word-')) {
      const word = shape.substring(5);
      p.push();
      p.textFont('monospace');
      p.textSize(s * 0.6);
      p.textAlign(p.CENTER, p.CENTER);
      p.noFill();
      // Use stroke for text by drawing filled text
      const c = p.drawingContext;
      c.strokeText(word, 0, 0);
      p.pop();
      return;
    }

    switch (shape) {
      case 'circle':
        p.ellipse(0, 0, s, s);
        break;
      case 'double-circle':
        p.ellipse(0, 0, s, s);
        p.ellipse(0, 0, s * 0.6, s * 0.6);
        break;
      case 'triangle':
        p.triangle(0, -hs, -hs * 0.87, hs * 0.5, hs * 0.87, hs * 0.5);
        break;
      case 'arrow-right':
        p.line(-hs, 0, hs * 0.4, 0);
        p.line(hs * 0.1, -hs * 0.4, hs * 0.4, 0);
        p.line(hs * 0.1, hs * 0.4, hs * 0.4, 0);
        break;
      case 'arrow-down':
        p.line(0, -hs, 0, hs * 0.4);
        p.line(-hs * 0.4, hs * 0.1, 0, hs * 0.4);
        p.line(hs * 0.4, hs * 0.1, 0, hs * 0.4);
        break;
      case 'star': {
        p.beginShape();
        for (let i = 0; i < 5; i++) {
          const a1 = (p.TWO_PI * i) / 5 - p.HALF_PI;
          const a2 = a1 + p.TWO_PI / 10;
          p.vertex(Math.cos(a1) * hs, Math.sin(a1) * hs);
          p.vertex(Math.cos(a2) * hs * 0.4, Math.sin(a2) * hs * 0.4);
        }
        p.endShape(p.CLOSE);
        break;
      }
      case 'diamond':
        p.quad(0, -hs, hs * 0.6, 0, 0, hs, -hs * 0.6, 0);
        break;
      case 'rect-border':
        p.rect(-hs, -hs * 0.6, s, s * 0.6);
        p.rect(-hs * 0.85, -hs * 0.45, s * 0.85, s * 0.45);
        break;
      case 'cross':
        p.line(-hs, 0, hs, 0);
        p.line(0, -hs, 0, hs);
        break;
      case 'heart': {
        p.beginShape();
        for (let a = 0; a < p.TWO_PI; a += 0.1) {
          const r = hs * 0.5;
          const x = r * 16 * Math.pow(Math.sin(a), 3) / 16;
          const y = -r * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16;
          p.vertex(x, y);
        }
        p.endShape(p.CLOSE);
        break;
      }
      case 'lightning':
        p.beginShape();
        p.vertex(hs * 0.1, -hs);
        p.vertex(-hs * 0.2, -hs * 0.1);
        p.vertex(hs * 0.15, -hs * 0.05);
        p.vertex(-hs * 0.1, hs);
        p.vertex(hs * 0.25, hs * 0.1);
        p.vertex(-hs * 0.1, hs * 0.15);
        p.endShape();
        break;
      case 'music-note':
        p.ellipse(0, hs * 0.3, hs * 0.5, hs * 0.35);
        p.line(hs * 0.25, hs * 0.3, hs * 0.25, -hs * 0.5);
        p.line(hs * 0.25, -hs * 0.5, hs * 0.5, -hs * 0.65);
        break;
      case 'hexagon': {
        p.beginShape();
        for (let i = 0; i < 6; i++) {
          const a = (p.TWO_PI * i) / 6 - p.HALF_PI;
          p.vertex(Math.cos(a) * hs, Math.sin(a) * hs);
        }
        p.endShape(p.CLOSE);
        break;
      }
      case 'zigzag': {
        const steps = 5;
        p.beginShape();
        for (let i = 0; i <= steps; i++) {
          const x = -hs + (s / steps) * i;
          const y = (i % 2 === 0) ? -hs * 0.3 : hs * 0.3;
          p.vertex(x, y);
        }
        p.endShape();
        break;
      }
      case 'spiral-rect':
        p.rect(-hs, -hs, s, s);
        p.rect(-hs * 0.65, -hs * 0.65, s * 0.65, s * 0.65);
        p.rect(-hs * 0.3, -hs * 0.3, s * 0.3, s * 0.3);
        break;
      case 'brackets':
        // Left bracket
        p.line(-hs * 0.3, -hs * 0.5, -hs * 0.5, -hs * 0.5);
        p.line(-hs * 0.5, -hs * 0.5, -hs * 0.5, hs * 0.5);
        p.line(-hs * 0.5, hs * 0.5, -hs * 0.3, hs * 0.5);
        // Right bracket
        p.line(hs * 0.3, -hs * 0.5, hs * 0.5, -hs * 0.5);
        p.line(hs * 0.5, -hs * 0.5, hs * 0.5, hs * 0.5);
        p.line(hs * 0.5, hs * 0.5, hs * 0.3, hs * 0.5);
        break;
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
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['neon-sign'] = NeonSignPreset;
})();
