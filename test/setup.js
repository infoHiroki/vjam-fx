/**
 * Test setup — Chrome API mock + p5.js mock + Web Audio API mock
 */

// Chrome Extension API mock
globalThis.chrome = {
  scripting: {
    executeScript: vi.fn().mockResolvedValue([]),
    insertCSS: vi.fn().mockResolvedValue([]),
  },
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com' }]),
    get: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com' }),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onUpdated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://fake-id/${path}`),
    sendMessage: vi.fn().mockResolvedValue({ state: null }),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  action: {
    setIcon: vi.fn(),
    setBadgeText: vi.fn(),
  },
  webNavigation: {
    onCompleted: { addListener: vi.fn() },
  },
};

// Minimal p5 mock for unit tests (presets create their own p5 instance)
globalThis.p5 = class p5Mock {
  constructor(sketch, container) {
    this._sketch = sketch;
    this._container = container;
    this.TWO_PI = Math.PI * 2;
    this.PI = Math.PI;
    this.HSB = 'hsb';
    this.CENTER = 'center';
    this.CLOSE = 'close';
    this.PIE = 'pie';
    this.width = 800;
    this.height = 600;
    this.frameCount = 0;

    // Stub drawing methods
    const noop = () => {};
    const methods = [
      'createCanvas', 'resizeCanvas', 'pixelDensity', 'colorMode',
      'background', 'fill', 'noFill', 'stroke', 'noStroke', 'strokeWeight',
      'push', 'pop', 'translate', 'rotate', 'scale',
      'circle', 'ellipse', 'rect', 'line', 'arc', 'point',
      'beginShape', 'endShape', 'vertex', 'curveVertex', 'bezierVertex',
      'triangle', 'rectMode', 'quad',
      'map', 'noise', 'noiseSeed', 'noiseDetail',
      'noSmooth', 'smooth', 'blendMode',
      'createGraphics', 'image', 'loadFont',
      'textFont', 'textSize', 'textAlign', 'text', 'textWidth',
      'strokeCap', 'strokeJoin',
      'lerp', 'constrain', 'dist', 'abs', 'floor', 'ceil', 'round',
      'sin', 'cos', 'tan', 'atan2', 'sqrt', 'pow', 'min', 'max',
      'color', 'lerpColor', 'red', 'green', 'blue', 'alpha', 'hue', 'saturation', 'brightness',
      'drawingContext',
    ];
    for (const m of methods) this[m] = noop;
    this.map = (v, s1, e1, s2, e2) => s2 + (v - s1) / (e1 - s1) * (e2 - s2);
    this.random = (a, b) => {
      if (a === undefined) return Math.random();
      if (b === undefined) return Math.random() * a;
      return a + Math.random() * (b - a);
    };
    this.noise = () => 0.5;
    this.constrain = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    this.lerp = (a, b, t) => a + (b - a) * t;
    this.dist = (x1, y1, x2, y2) => Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    this.abs = Math.abs;
    this.floor = Math.floor;
    this.ceil = Math.ceil;
    this.round = Math.round;
    this.sin = Math.sin;
    this.cos = Math.cos;
    this.tan = Math.tan;
    this.atan2 = Math.atan2;
    this.sqrt = Math.sqrt;
    this.pow = Math.pow;
    this.min = Math.min;
    this.max = Math.max;
    this.color = () => ({ levels: [0,0,0,255] });
    this.lerpColor = () => ({ levels: [128,128,128,255] });
    this.red = () => 0;
    this.green = () => 0;
    this.blue = () => 0;
    this.HALF_PI = Math.PI / 2;
    this.QUARTER_PI = Math.PI / 4;
    this.TAU = Math.PI * 2;
    this.SQUARE = 'square';
    this.ROUND = 'round';
    this.PROJECT = 'project';
    this.SCREEN = 'screen';
    this.ADD = 'add';
    this.BLEND = 'blend';
    this.LEFT = 'left';
    this.RIGHT = 'right';
    this.TOP = 'top';
    this.BOTTOM = 'bottom';
    // createGraphics returns a mock graphics context
    this.createGraphics = (w, h) => {
      const g = {};
      for (const m of methods) g[m] = noop;
      g.width = w || 800;
      g.height = h || 600;
      g.remove = noop;
      return g;
    };
    this.drawingContext = { setLineDash: noop, lineDashOffset: 0 };

    // Run sketch to capture setup/draw
    if (sketch) sketch(this);
    // Auto-call setup
    if (this.setup) this.setup();
  }

  remove() {}
};

// Web Audio API mock
class MockAnalyserNode {
  constructor() {
    this.fftSize = 2048;
    this.frequencyBinCount = 1024;
    this.smoothingTimeConstant = 0;
  }
  connect() {}
  disconnect() {}
  getFloatFrequencyData(arr) { arr.fill(-100); }
  getFloatTimeDomainData(arr) { arr.fill(0); }
}

class MockMediaStreamSource {
  connect() {}
  disconnect() {}
}

class MockAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.state = 'running';
  }
  createAnalyser() { return new MockAnalyserNode(); }
  createMediaStreamSource() { return new MockMediaStreamSource(); }
  resume() { this.state = 'running'; }
  close() { this.state = 'closed'; }
}

globalThis.AudioContext = MockAudioContext;
globalThis.window.AudioContext = MockAudioContext;

// Mock getUserMedia
if (!navigator.mediaDevices) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {},
    writable: true,
  });
}
navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
  getTracks: () => [{ stop: vi.fn() }],
});

// Performance.now mock (already available in jsdom, but ensure it exists)
if (!globalThis.performance) {
  globalThis.performance = { now: () => Date.now() };
}

// requestAnimationFrame / cancelAnimationFrame mock
let _rafId = 0;
globalThis.requestAnimationFrame = vi.fn((cb) => {
  return ++_rafId;
});
globalThis.cancelAnimationFrame = vi.fn();
