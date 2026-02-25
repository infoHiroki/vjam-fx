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
      'beginShape', 'endShape', 'vertex',
      'triangle', 'rectMode',
      'map',
    ];
    for (const m of methods) this[m] = noop;
    this.map = (v, s1, e1, s2, e2) => s2 + (v - s1) / (e1 - s1) * (e2 - s2);

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
