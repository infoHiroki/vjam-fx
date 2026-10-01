import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const tapCode = readFileSync(resolve(__dirname, '../content/mse-tap.js'), 'utf-8');

function loadTap() {
  delete window.__vjamMse;
  eval(tapCode);
  return window.__vjamMse;
}

// ---- byte builders ----

function bytes(...parts) {
  const flat = [];
  for (const p of parts) for (const v of p) flat.push(v);
  return new Uint8Array(flat);
}

function uintBytes(v, len) {
  const out = new Array(len);
  for (let i = len - 1; i >= 0; i--) { out[i] = v % 256; v = Math.floor(v / 256); }
  return out;
}

// WebM (EBML)
function ebmlSize(n) {
  if (n < 0x7F) return [0x80 | n];
  if (n < 0x3FFF) return [0x40 | (n >> 8), n & 0xFF];
  return [0x10, ...uintBytes(n, 3)];
}
const UNKNOWN_SIZE = [0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];

function el(id, payload, size) {
  return bytes(id, size || ebmlSize(payload.length), payload);
}

function webmInit(scale = 1000000) {
  const header = el([0x1A, 0x45, 0xDF, 0xA3], el([0x42, 0x82], [0x77, 0x65, 0x62, 0x6D])); // DocType "webm"
  const info = el([0x15, 0x49, 0xA9, 0x66], el([0x2A, 0xD7, 0xB1], uintBytes(scale, 3)));
  const tracks = el([0x16, 0x54, 0xAE, 0x6B], el([0xAE], [0xD7, 0x81, 0x01]));
  return bytes(header, [0x18, 0x53, 0x80, 0x67], UNKNOWN_SIZE, info, tracks);
}

function webmCluster(tc, blockLen = 40, opts = {}) {
  const block = new Array(blockLen).fill(0).map((_, i) => (i * 7 + tc) & 0x7F);
  const children = bytes(
    opts.crcFirst ? el([0xBF], [1, 2, 3, 4]) : [],
    opts.noTimecode ? [] : el([0xE7], uintBytes(tc, tc > 0xFFFF ? 3 : 2)),
    el([0xA3], block),
  );
  return el([0x1F, 0x43, 0xB6, 0x75], children, opts.unknownSize ? UNKNOWN_SIZE : undefined);
}

// MP4 (ISO BMFF)
function box(type, ...payload) {
  const body = bytes(...payload);
  return bytes(uintBytes(8 + body.length, 4), [...type].map(c => c.charCodeAt(0)), body);
}
function fullBox(type, version, ...payload) {
  return box(type, [version, 0, 0, 0], ...payload);
}
function mp4Init(timescale = 44100, mdhdVersion = 0) {
  const mdhd = mdhdVersion === 1
    ? fullBox('mdhd', 1, new Array(16).fill(0), uintBytes(timescale, 4), new Array(8).fill(0), [0x55, 0xC4, 0, 0])
    : fullBox('mdhd', 0, new Array(8).fill(0), uintBytes(timescale, 4), new Array(4).fill(0), [0x55, 0xC4, 0, 0]);
  const hdlr = fullBox('hdlr', 0, [0, 0, 0, 0], [0x73, 0x6F, 0x75, 0x6E], new Array(13).fill(0));
  return bytes(
    box('ftyp', [0x69, 0x73, 0x6F, 0x36], [0, 0, 0, 1]),
    box('moov', box('mvhd', new Array(100).fill(0)), box('trak', box('tkhd', new Array(84).fill(0)), box('mdia', mdhd, hdlr))),
  );
}
function mp4Segment(decodeTime, tfdtVersion = 1, mdatLen = 60) {
  const tfdt = tfdtVersion === 1 ? fullBox('tfdt', 1, uintBytes(decodeTime, 8)) : fullBox('tfdt', 0, uintBytes(decodeTime, 4));
  const moof = box('moof', fullBox('mfhd', 0, [0, 0, 0, 1]), box('traf', fullBox('tfhd', 0, [0, 0, 0, 1]), tfdt));
  const mdat = box('mdat', new Array(mdatLen).fill(0).map((_, i) => (i * 13 + decodeTime) & 0xFF));
  return { moof, mdat, all: bytes(moof, mdat) };
}

function chunks(b, sizes) {
  const out = [];
  let p = 0, k = 0;
  while (p < b.length) {
    const n = sizes[k++ % sizes.length];
    out.push(b.slice(p, p + n));
    p += n;
  }
  return out;
}

function pushAll(splitter, parts) {
  const out = [];
  for (const p of parts) out.push(...splitter.push(p));
  return out;
}

function same(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ---- synthetic audio ----

function prng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// bpm のオンセット列(拍が bin の間に来るときは 2 つに分ける)+ ノイズ
function synthOnsets(bpm, n, seed, hop = 0.02) {
  const rnd = prng(seed);
  const o = new Array(n).fill(0).map(() => 0.15 * rnd());
  const P = 60 / bpm / hop;
  for (let q = rnd() * P; q < n; q += P) {
    const f = Math.floor(q), fr = q - f;
    if (f < n) o[f] += 1 - fr;
    if (f + 1 < n) o[f + 1] += fr;
  }
  return o;
}

// bpm でキックが鳴る 20ms ごとの音量(addEnvelope にそのまま渡せる形)
function kickEnvelope(bpm, seconds, seed = 1, hop = 0.02) {
  const rnd = prng(seed);
  const env = [];
  const period = 60 / bpm;
  for (let k = 0; k * hop < seconds; k++) {
    const t = k * hop;
    const since = t - Math.floor(t / period) * period;
    const kick = Math.exp(-since / 0.06);
    const bass = 0.02 + 0.5 * kick + 0.01 * rnd();
    const mid = 0.05 + 0.02 * rnd();
    const treble = 0.03 + 0.02 * rnd();
    env.push({ rms: 0.1 + 0.3 * kick, bass, mid, treble });
  }
  return env;
}

// frameAt を 15Hz(エンジンの音声ループと同じ)で呼んでビートの時刻を集める
function run(analyzer, from, to, fps = 15) {
  const beats = [];
  let last = null;
  for (let t = from; t <= to + 1e-9; t += 1 / fps) {
    const f = analyzer.frameAt(t);
    if (f && f.beat) beats.push(t);
    if (f) last = f;
  }
  return { beats, last };
}

describe('mse-tap', () => {
  let lib;

  beforeEach(() => {
    lib = loadTap()._lib;
  });

  afterEach(() => {
    delete window.__vjamMse;
  });

  describe('install', () => {
    it('exposes only frameAt / stats / _lib on window.__vjamMse', () => {
      expect(Object.keys(window.__vjamMse).sort()).toEqual(['_lib', 'frameAt', 'stats']);
    });

    it('does not throw without MediaSource (Chrome-less env) and returns null', () => {
      expect(window.MediaSource).toBeUndefined();
      expect(window.__vjamMse.frameAt(1)).toBeNull();
    });

    it('does not reinstall when already present', () => {
      const first = window.__vjamMse;
      eval(tapCode);
      expect(window.__vjamMse).toBe(first);
    });
  });

  describe('EBML vint', () => {
    it('reads 1-byte sizes', () => {
      expect(lib.vint(new Uint8Array([0x81]), 0)).toEqual({ len: 1, value: 1, unknown: false });
      expect(lib.vint(new Uint8Array([0x80]), 0)).toEqual({ len: 1, value: 0, unknown: false });
    });

    it('reads multi-byte sizes', () => {
      expect(lib.vint(new Uint8Array([0x40, 0x02]), 0)).toEqual({ len: 2, value: 2, unknown: false });
      expect(lib.vint(new Uint8Array([0x20, 0x01, 0x00]), 0)).toEqual({ len: 3, value: 256, unknown: false });
      expect(lib.vint(new Uint8Array([0x10, 0x01, 0x02, 0x03]), 0).value).toBe(0x010203);
    });

    it('reads at an offset', () => {
      expect(lib.vint(new Uint8Array([0x00, 0x00, 0x83]), 2)).toEqual({ len: 1, value: 3, unknown: false });
    });

    it('flags all-ones values as unknown size', () => {
      expect(lib.vint(new Uint8Array(UNKNOWN_SIZE), 0)).toEqual({ len: 8, value: Math.pow(2, 56) - 1, unknown: true });
      expect(lib.vint(new Uint8Array([0xFF]), 0).unknown).toBe(true);
      expect(lib.vint(new Uint8Array([0x7F, 0xFF]), 0).unknown).toBe(true);
      expect(lib.vint(new Uint8Array([0x7F, 0xFE]), 0).unknown).toBe(false);
    });

    it('returns null for truncated or invalid input', () => {
      expect(lib.vint(new Uint8Array([0x40]), 0)).toBeNull();
      expect(lib.vint(new Uint8Array([0x00, 0xFF]), 0)).toBeNull();
      expect(lib.vint(new Uint8Array([]), 0)).toBeNull();
    });
  });

  describe('WebM timecode', () => {
    it('reads the cluster Timecode', () => {
      expect(lib.clusterTimecode(webmCluster(12345))).toBe(12345);
      expect(lib.clusterTimecode(webmCluster(0))).toBe(0);
      expect(lib.clusterTimecode(webmCluster(3600000))).toBe(3600000);
    });

    it('skips elements before the Timecode', () => {
      expect(lib.clusterTimecode(webmCluster(500, 40, { crcFirst: true }))).toBe(500);
    });

    it('returns NaN without a Timecode', () => {
      expect(lib.clusterTimecode(webmCluster(500, 40, { noTimecode: true }))).toBeNaN();
    });

    it('reads TimecodeScale from init (default 1ms)', () => {
      expect(lib.timecodeScale(webmInit(1000000))).toBe(1000000);
      expect(lib.timecodeScale(webmInit(500000))).toBe(500000);
      expect(lib.timecodeScale(el([0x1A, 0x45, 0xDF, 0xA3], [0x42, 0x82, 0x80]))).toBe(1000000);
    });
  });

  describe('WebM cluster splitting', () => {
    const init = webmInit();
    const c1 = webmCluster(0, 50), c2 = webmCluster(5000, 70), c3 = webmCluster(10000, 30);

    it('splits init + clusters from one append', () => {
      const out = lib.createWebmSplitter().push(bytes(init, c1, c2, c3));
      expect(out.map(s => s.time)).toEqual([0, 5, 10]);
      expect(same(out[1].data, bytes(init, c2))).toBe(true);
    });

    it('joins clusters cut at arbitrary points', () => {
      for (const sizes of [[1], [7], [13, 100], [333], [4, 9, 61]]) {
        const out = pushAll(lib.createWebmSplitter(), chunks(bytes(init, c1, c2, c3), sizes));
        expect(out.map(s => s.time)).toEqual([0, 5, 10]);
        expect(same(out[2].data, bytes(init, c3))).toBe(true);
      }
    });

    it('handles an init that arrives in pieces before the clusters', () => {
      const sp = lib.createWebmSplitter();
      expect(pushAll(sp, chunks(init, [10]))).toEqual([]);
      const out = pushAll(sp, [c1, c2]);
      expect(out.map(s => s.time)).toEqual([0, 5]);
      expect(same(out[0].data, bytes(init, c1))).toBe(true);
    });

    it('uses TimecodeScale', () => {
      const out = lib.createWebmSplitter().push(bytes(webmInit(500000), webmCluster(4000)));
      expect(out[0].time).toBe(2);
    });

    it('drops a half cluster when a new cluster starts (restream)', () => {
      const sp = lib.createWebmSplitter();
      sp.push(init);
      expect(sp.push(c1.slice(0, 30))).toEqual([]);
      const out = sp.push(c2);
      expect(out.map(s => s.time)).toEqual([5]);
      expect(sp.resyncs).toBe(1);
    });

    it('drops the partial data on reset (abort)', () => {
      const sp = lib.createWebmSplitter();
      sp.push(init);
      sp.push(c1.slice(0, 30));
      sp.reset();
      expect(sp.push(c1.slice(30))).toEqual([]);
      expect(sp.push(c2).map(s => s.time)).toEqual([5]);
    });

    it('takes a new init (quality switch) and keeps going', () => {
      const sp = lib.createWebmSplitter();
      sp.push(bytes(init, c1));
      const init2 = webmInit(500000);
      const out = sp.push(bytes(init2, webmCluster(20000)));
      expect(out.map(s => s.time)).toEqual([10]);
      expect(same(out[0].data.slice(0, init2.length), init2)).toBe(true);
    });

    it('ends unknown-size clusters at the next cluster', () => {
      const u1 = webmCluster(0, 50, { unknownSize: true }), u2 = webmCluster(5000, 50, { unknownSize: true });
      const sp = lib.createWebmSplitter();
      expect(sp.push(bytes(init, u1)).map(s => s.time)).toEqual([]);
      expect(sp.push(u2).map(s => s.time)).toEqual([0]);
      expect(sp.resyncs).toBe(0);
      const out = lib.createWebmSplitter().push(bytes(init, u1, u2, c3));
      expect(out.map(s => s.time)).toEqual([0, 5, 10]);
    });

    it('skips garbage before a cluster', () => {
      const sp = lib.createWebmSplitter();
      sp.push(bytes(init, c1));
      const out = sp.push(bytes([1, 2, 3, 4, 5], c2));
      expect(out.map(s => s.time)).toEqual([5]);
      expect(sp.resyncs).toBe(1);
    });

    it('waits for the init before emitting clusters', () => {
      const sp = lib.createWebmSplitter();
      expect(sp.push(c1)).toEqual([]);
    });
  });

  describe('MP4 (fMP4) box splitting', () => {
    const init = mp4Init(44100);
    const s1 = mp4Segment(0), s2 = mp4Segment(441000), s3 = mp4Segment(882000, 0);

    it('reads timescale from mdhd (v0 / v1)', () => {
      const moov0 = mp4Init(48000, 0).slice(box('ftyp', [0, 0, 0, 0], [0, 0, 0, 0]).length);
      const moov1 = mp4Init(44100, 1).slice(box('ftyp', [0, 0, 0, 0], [0, 0, 0, 0]).length);
      expect(lib.mp4Timescale(moov0)).toBe(48000);
      expect(lib.mp4Timescale(moov1)).toBe(44100);
    });

    it('reads tfdt (v0 / v1)', () => {
      expect(lib.tfdtTime(mp4Segment(123456, 0).moof)).toBe(123456);
      expect(lib.tfdtTime(mp4Segment(Math.pow(2, 40), 1).moof)).toBe(Math.pow(2, 40));
      expect(lib.tfdtTime(box('moof', box('mfhd', [0, 0, 0, 0, 0, 0, 0, 1])))).toBeNaN();
    });

    it('starts each segment at tfdt / timescale (not buffered diff)', () => {
      const out = lib.createMp4Splitter().push(bytes(init, s1.all, s2.all, s3.all));
      expect(out.map(s => s.time)).toEqual([0, 10, 20]);
      expect(same(out[1].data, bytes(init, s2.moof, s2.mdat))).toBe(true);
    });

    it('reassembles boxes cut at arbitrary points', () => {
      for (const sizes of [[1], [5], [17, 200], [64], [3, 11, 97]]) {
        const out = pushAll(lib.createMp4Splitter(), chunks(bytes(init, s1.all, s2.all, s3.all), sizes));
        expect(out.map(s => s.time)).toEqual([0, 10, 20]);
        expect(same(out[2].data, bytes(init, s3.moof, s3.mdat))).toBe(true);
      }
    });

    it('accepts styp / sidx between segments', () => {
      const styp = box('styp', [0x6D, 0x73, 0x64, 0x68], [0, 0, 0, 0]);
      const sidx = fullBox('sidx', 0, new Array(24).fill(0));
      const out = lib.createMp4Splitter().push(bytes(init, styp, sidx, s1.all, styp, s2.all));
      expect(out.map(s => s.time)).toEqual([0, 10]);
    });

    it('handles 64-bit largesize boxes', () => {
      const payload = new Array(40).fill(9);
      const mdat64 = bytes([0, 0, 0, 1], [0x6D, 0x64, 0x61, 0x74], uintBytes(16 + payload.length, 8), payload);
      const out = lib.createMp4Splitter().push(bytes(init, s2.moof, mdat64));
      expect(out.map(s => s.time)).toEqual([10]);
      expect(same(out[0].data, bytes(init, s2.moof, mdat64))).toBe(true);
    });

    it('drops a half segment when a new segment starts (restream)', () => {
      const sp = lib.createMp4Splitter();
      sp.push(init);
      expect(sp.push(s1.all.slice(0, s1.all.length - 10))).toEqual([]);
      const out = sp.push(s2.all);
      expect(out.map(s => s.time)).toEqual([10]);
      expect(sp.resyncs).toBe(1);
    });

    it('drops the partial data on reset (abort)', () => {
      const sp = lib.createMp4Splitter();
      sp.push(init);
      sp.push(s1.all.slice(0, 20));
      sp.reset();
      sp.push(s1.all.slice(20));
      expect(sp.push(s2.all).map(s => s.time)).toEqual([10]);
    });

    it('recovers from garbage', () => {
      const sp = lib.createMp4Splitter();
      sp.push(init);
      const out = sp.push(bytes([0, 0, 0, 3, 0xFF, 0xFE, 0x01, 0x02, 9, 9], s2.all));
      expect(out.map(s => s.time)).toEqual([10]);
      expect(sp.resyncs).toBeGreaterThan(0);
    });

    it('does not loop forever on a broken moof header', () => {
      const sp = lib.createMp4Splitter();
      sp.push(init);
      const broken = bytes([0, 0, 0, 2], [0x6D, 0x6F, 0x6F, 0x66], [1, 2, 3]);
      expect(sp.push(broken)).toEqual([]);
      expect(sp.push(s2.all).map(s => s.time)).toEqual([10]);
    });

    it('waits for the init before emitting segments', () => {
      expect(lib.createMp4Splitter().push(s1.all)).toEqual([]);
    });
  });

  describe('band envelope', () => {
    it('makes one 20ms bin per hop and separates bass / treble', () => {
      const sr = 44100, n = sr; // 1 秒
      const low = new Float32Array(n), high = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        low[i] = 0.5 * Math.sin(2 * Math.PI * 60 * i / sr);
        high[i] = 0.5 * Math.sin(2 * Math.PI * 8000 * i / sr);
      }
      const a = lib.bandEnvelope(low, sr, 0.02), b = lib.bandEnvelope(high, sr, 0.02);
      expect(a.length).toBe(Math.ceil(n / Math.round(sr * 0.02)));
      const mid = 25;
      expect(a[mid].rms).toBeCloseTo(0.5 / Math.SQRT2, 1);
      expect(a[mid].bass).toBeGreaterThan(a[mid].treble * 5);
      expect(b[mid].treble).toBeGreaterThan(b[mid].bass * 5);
    });
  });

  describe('tempo estimation', () => {
    const N = 601; // ±6 秒

    it('finds 124 BPM within ±1', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const g = lib.estimateTempo(synthOnsets(124, N, seed), 0.02);
        expect(Math.abs(60 / g.period - 124)).toBeLessThanOrEqual(1);
      }
    });

    it('finds 90 BPM within ±1', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const g = lib.estimateTempo(synthOnsets(90, N, seed), 0.02);
        expect(Math.abs(60 / g.period - 90)).toBeLessThanOrEqual(1);
      }
    });

    it('finds 174 BPM as 174 or 87', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const bpm = 60 / lib.estimateTempo(synthOnsets(174, N, seed), 0.02).period;
        expect(Math.min(Math.abs(bpm - 174), Math.abs(bpm - 87))).toBeLessThanOrEqual(1);
      }
    });

    it('puts the grid on the beats', () => {
      const o = new Array(N).fill(0);
      for (let i = 7; i < N; i += 25) o[i] = 1; // 120 BPM, 拍は 7 bin 目から
      const g = lib.estimateTempo(o, 0.02);
      expect(60 / g.period).toBeCloseTo(120, 0);
      const ph = g.phase / 0.02;
      expect(Math.abs(ph - 7)).toBeLessThanOrEqual(1);
      expect(g.conf).toBeGreaterThan(0.08);
    });

    it('returns null for silence', () => {
      expect(lib.estimateTempo(new Array(N).fill(0), 0.02)).toBeNull();
    });
  });

  describe('grid crossing', () => {
    const grid = { anchor: 0.1, period: 0.5 };

    it('returns the grid line inside (t0, t1]', () => {
      expect(lib.gridLineIn(grid, 0.55, 0.65)).toBeCloseTo(0.6);
      expect(lib.gridLineIn(grid, 0.5, 0.6)).toBeCloseTo(0.6);
      expect(lib.gridLineIn(grid, 0.6, 0.7)).toBeNaN();
      expect(lib.gridLineIn(grid, 0.65, 1.05)).toBeNaN();
    });

    it('returns the last line when several are crossed', () => {
      expect(lib.gridLineIn(grid, 0.0, 1.2)).toBeCloseTo(1.1);
    });
  });

  describe('beat firing', () => {
    let an;

    beforeEach(() => {
      an = lib.createAnalyzer();
      an.addEnvelope(0, kickEnvelope(120, 40));
    });

    it('returns null where there is no data', () => {
      expect(an.frameAt(100)).toBeNull();
      expect(an.frameAt(NaN)).toBeNull();
      expect(an.frameAt(undefined)).toBeNull();
    });

    it('returns levels and BPM', () => {
      const { last } = run(an, 5, 12);
      expect(last.bpm).toBeGreaterThan(119);
      expect(last.bpm).toBeLessThan(121);
      for (const k of ['rms', 'bass', 'mid', 'treble', 'strength']) {
        expect(last[k]).toBeGreaterThanOrEqual(0);
        expect(last[k]).toBeLessThanOrEqual(1);
      }
    });

    it('fires once per grid line', () => {
      const { beats } = run(an, 8, 18);
      expect(beats.length).toBeGreaterThanOrEqual(19);
      expect(beats.length).toBeLessThanOrEqual(21);
      for (let i = 1; i < beats.length; i++) {
        expect(beats[i] - beats[i - 1]).toBeGreaterThan(0.4);
        expect(beats[i] - beats[i - 1]).toBeLessThan(0.6);
      }
    });

    it('fires close to the kick', () => {
      const { beats } = run(an, 8, 18, 60);
      for (const t of beats) {
        const off = t - Math.round(t / 0.5) * 0.5;
        expect(off).toBeGreaterThanOrEqual(-0.03);
        expect(off).toBeLessThan(0.06);
      }
    });

    it('does not fire twice for the same time', () => {
      run(an, 8, 10);
      let t = 10.48;
      while (!an.frameAt(t).beat) t += 0.01;
      expect(an.frameAt(t).beat).toBe(false);
    });

    it('does not fire on seeks', () => {
      run(an, 8, 10);
      expect(an.frameAt(25.49).beat).toBe(false);   // 先へ跳ぶ(拍を何本も跨ぐ)
      expect(an.frameAt(25.52).beat).toBe(true);    // 次の拍から
      expect(an.frameAt(12.99).beat).toBe(false);   // 戻る
      expect(an.frameAt(13.01).beat).toBe(true);
    });

    it('keeps the strength decaying after a beat', () => {
      run(an, 8, 9.9);
      let t = 9.95, f;
      while (!(f = an.frameAt(t)).beat) t += 0.01;
      expect(f.strength).toBeGreaterThan(0.3);
      expect(an.frameAt(t + 0.1).strength).toBeLessThan(f.strength);
      expect(an.frameAt(t + 0.25).strength).toBe(0);
    });

    it('drops data on removeRange / reset', () => {
      an.removeRange(0, 10);
      expect(an.frameAt(5)).toBeNull();
      expect(an.frameAt(15)).not.toBeNull();
      an.reset();
      expect(an.frameAt(15)).toBeNull();
      expect(an.size()).toBe(0);
    });

    it('falls back to onset thresholds when there is no tempo', () => {
      // 拍の間隔が 2 秒より長くバラバラ = テンポが取れない
      const hits = [6.3, 8.6, 11.02, 13.5];
      const env = new Array(1000).fill(0).map(() => ({ rms: 0.1, bass: 0.02, mid: 0.05, treble: 0.03 }));
      for (const at of hits) env[Math.round(at / 0.02)] = { rms: 0.4, bass: 0.6, mid: 0.05, treble: 0.03 };
      const a2 = lib.createAnalyzer();
      a2.addEnvelope(0, env);
      const { beats } = run(a2, 5, 15);
      expect(a2.mode).toBe('onset');
      expect(beats.length).toBe(hits.length);
      beats.forEach((t, k) => expect(t - hits[k]).toBeGreaterThan(-0.011));
      beats.forEach((t, k) => expect(t - hits[k]).toBeLessThan(0.1));
    });
  });

  describe('MediaSource hook', () => {
    let decodes, FakeSourceBuffer, FakeMediaSource;

    // 5 秒の 120 BPM キック。どのデータも同じ音として返す
    function fakeAudioBuffer() {
      const sr = 44100, n = sr * 5, ch = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / sr, since = t % 0.5;
        ch[i] = 0.8 * Math.exp(-since / 0.05) * Math.sin(2 * Math.PI * 55 * t) + 0.02 * Math.sin(2 * Math.PI * 3000 * t);
      }
      return { sampleRate: sr, length: n, getChannelData: () => ch };
    }

    const flush = () => new Promise(r => setTimeout(r, 0));

    beforeEach(() => {
      decodes = [];
      // テストごとに作り直す(prototype のパッチが重ならないように)
      FakeSourceBuffer = class {
        constructor(type) { this.type = type; this.timestampOffset = 0; this.appended = []; this.calls = []; }
        appendBuffer(data) { this.appended.push(data); }
        abort() { this.calls.push('abort'); }
        remove(s, e) { this.calls.push(['remove', s, e]); }
        changeType(t) { this.calls.push(['changeType', t]); }
      };
      FakeMediaSource = class {
        addSourceBuffer(type) { return new FakeSourceBuffer(type); }
      };
      window.MediaSource = FakeMediaSource;
      window.OfflineAudioContext = class {
        decodeAudioData(buf) {
          decodes.push(new Uint8Array(buf));
          return Promise.resolve(fakeAudioBuffer());
        }
      };
      lib = loadTap()._lib;
    });

    afterEach(() => {
      delete window.MediaSource;
      delete window.OfflineAudioContext;
    });

    it('passes the original data through untouched', () => {
      const sb = new FakeMediaSource().addSourceBuffer('audio/webm; codecs="opus"');
      const data = bytes(webmInit(), webmCluster(0));
      const copy = data.slice();
      sb.appendBuffer(data);
      expect(sb.appended[0]).toBe(data);
      expect(same(data, copy)).toBe(true);
    });

    it('decodes init + cluster and serves frames at the playback time', async () => {
      const sb = new FakeMediaSource().addSourceBuffer('audio/webm; codecs="opus"');
      sb.appendBuffer(bytes(webmInit(), webmCluster(0)));
      await flush();
      expect(decodes.length).toBe(1);
      expect(same(decodes[0], bytes(webmInit(), webmCluster(0)))).toBe(true);
      expect(window.__vjamMse.frameAt(2)).not.toBeNull();
      expect(window.__vjamMse.frameAt(6)).toBeNull();
      expect(window.__vjamMse.stats.decoded).toBe(1);
    });

    it('adds timestampOffset to the start', async () => {
      const sb = new FakeMediaSource().addSourceBuffer('audio/mp4; codecs="mp4a.40.2"');
      sb.timestampOffset = 30;
      sb.appendBuffer(bytes(mp4Init(44100), mp4Segment(441000).all));
      await flush();
      expect(window.__vjamMse.frameAt(39)).toBeNull();
      expect(window.__vjamMse.frameAt(42)).not.toBeNull();
    });

    it('does not hook video SourceBuffers', () => {
      const sb = new FakeMediaSource().addSourceBuffer('video/webm; codecs="vp9"');
      expect(sb.appendBuffer).toBe(FakeSourceBuffer.prototype.appendBuffer);
    });

    it('resets the analysis when the video switches (new audio SourceBuffer)', async () => {
      const sb = new FakeMediaSource().addSourceBuffer('audio/webm; codecs="opus"');
      sb.appendBuffer(bytes(webmInit(), webmCluster(0)));
      await flush();
      expect(window.__vjamMse.frameAt(2)).not.toBeNull();
      new FakeMediaSource().addSourceBuffer('audio/webm; codecs="opus"');
      expect(window.__vjamMse.frameAt(2)).toBeNull();
    });

    it('drops decodes that finish after the video switched', async () => {
      const sb = new FakeMediaSource().addSourceBuffer('audio/webm; codecs="opus"');
      sb.appendBuffer(bytes(webmInit(), webmCluster(0)));
      new FakeMediaSource().addSourceBuffer('audio/webm; codecs="opus"');
      await flush();
      expect(window.__vjamMse.frameAt(2)).toBeNull();
    });

    it('drops the partial cluster on abort', async () => {
      const sb = new FakeMediaSource().addSourceBuffer('audio/webm; codecs="opus"');
      const c = webmCluster(0);
      sb.appendBuffer(webmInit());
      sb.appendBuffer(c.slice(0, 20));
      sb.abort();
      sb.appendBuffer(c.slice(20));
      await flush();
      expect(decodes.length).toBe(0);
      expect(sb.calls).toEqual(['abort']);
    });

    it('forgets removed ranges', async () => {
      const sb = new FakeMediaSource().addSourceBuffer('audio/webm; codecs="opus"');
      sb.appendBuffer(bytes(webmInit(), webmCluster(0)));
      await flush();
      sb.remove(0, Infinity);
      expect(window.__vjamMse.frameAt(2)).toBeNull();
      expect(sb.calls).toEqual([['remove', 0, Infinity]]);
    });

    it('follows changeType (webm → mp4)', async () => {
      const sb = new FakeMediaSource().addSourceBuffer('audio/webm; codecs="opus"');
      sb.changeType('audio/mp4; codecs="mp4a.40.2"');
      sb.appendBuffer(bytes(mp4Init(44100), mp4Segment(0).all));
      await flush();
      expect(decodes.length).toBe(1);
      expect(sb.calls).toEqual([['changeType', 'audio/mp4; codecs="mp4a.40.2"']]);
    });

    it('counts decode failures without throwing', async () => {
      window.OfflineAudioContext.prototype.decodeAudioData = () => Promise.reject(new Error('bad'));
      const sb = new FakeMediaSource().addSourceBuffer('audio/webm; codecs="opus"');
      sb.appendBuffer(bytes(webmInit(), webmCluster(0)));
      await flush();
      expect(window.__vjamMse.stats.failed).toBe(1);
      expect(window.__vjamMse.frameAt(2)).toBeNull();
    });

    it('detects the beat of the decoded audio', async () => {
      const sb = new FakeMediaSource().addSourceBuffer('audio/webm; codecs="opus"');
      sb.appendBuffer(webmInit());
      for (let k = 0; k < 6; k++) sb.appendBuffer(webmCluster(k * 5000));
      await flush();
      const { beats, last } = run({ frameAt: window.__vjamMse.frameAt }, 8, 18);
      expect(window.__vjamMse.stats.mode).toBe('grid');
      expect(window.__vjamMse.stats.bpm).toBe(last.bpm);
      expect(last.bpm).toBeGreaterThan(119);
      expect(last.bpm).toBeLessThan(121);
      expect(beats.length).toBeGreaterThanOrEqual(19);
      expect(beats.length).toBeLessThanOrEqual(21);
    });
  });
});
