import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const tapCode = readFileSync(resolve(__dirname, '../content/mse-tap.js'), 'utf-8');

function loadTap() {
  delete window.__vjamMse;
  eval(tapCode);
  return window.__vjamMse;
}

// タップは読み込み時の window.fetch を持つので、差し替えられる口を先に置く(外には出ない)
let fetchImpl;
const realFetch = window.fetch;
const realPlay = HTMLMediaElement.prototype.play;

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

// MPEG-TS:188 バイトのパケット。中身が短いときは adaptation field(stuffing)で埋める。payload が null なら adaptation field だけ
function tsPacket(pid, payload, pusi = false) {
  const pkt = new Uint8Array(188).fill(0xFF);
  pkt[0] = 0x47;
  pkt[1] = (pusi ? 0x40 : 0) | (pid >> 8);
  pkt[2] = pid & 0xFF;
  if (payload === null) {
    pkt[3] = 0x20; pkt[4] = 183; pkt[5] = 0;
    return pkt;
  }
  const room = 184 - payload.length;
  if (room === 0) {
    pkt[3] = 0x10;
  } else {
    pkt[3] = 0x30; pkt[4] = room - 1;
    if (room > 1) pkt[5] = 0x00;
  }
  pkt.set(payload, 188 - payload.length);
  return pkt;
}

// PSI(pointer_field + セクション + ダミーの CRC)
function psi(tableId, body) {
  const len = body.length + 4;
  return [0, tableId, 0xB0 | (len >> 8), len & 0xFF, ...body, 0, 0, 0, 0];
}
function tsPat(pmtPid) {
  // 番組 0(NIT)→ 番組 1
  return psi(0x00, [0, 1, 0xC1, 0, 0, 0, 0, 0xE0, 0x10, 0, 1, 0xE0 | (pmtPid >> 8), pmtPid & 0xFF]);
}
function tsPmt(streams) {
  const info = [0x05, 0x04, 0x48, 0x44, 0x4D, 0x56];
  const es = [];
  for (const s of streams) {
    const d = s.desc || [];
    es.push(s.type, 0xE0 | (s.pid >> 8), s.pid & 0xFF, 0xF0 | (d.length >> 8), d.length & 0xFF, ...d);
  }
  return psi(0x02, [0, 1, 0xC1, 0, 0, 0xE1, 0x00, 0xF0, info.length, ...info, ...es]);
}
function pesHeader(streamId = 0xC0) {
  return [0, 0, 1, streamId, 0, 0, 0x80, 0x80, 5, 0x21, 0, 1, 0, 1]; // PTS だけ
}

const TS_PMT = 0x1000, TS_VIDEO = 0x100, TS_AUDIO = 0x101;

// 映像 + 音声(AAC)の TS と、そこから取り出せるはずの音声
function tsSegment(audioType = 0x0F) {
  const a1 = new Array(300).fill(0).map((_, i) => (i * 5 + 1) & 0xFF);
  const a2 = new Array(50).fill(0).map((_, i) => (i * 3 + 2) & 0xFF);
  const video = new Array(150).fill(0x55);
  const ts = bytes(
    tsPacket(TS_AUDIO, [9, 9, 9]),                       // PMT より前 → 使わない
    tsPacket(0, tsPat(TS_PMT), true),
    tsPacket(TS_PMT, tsPmt([
      { type: 0x1B, pid: TS_VIDEO, desc: [0x28, 4, 1, 2, 3, 4] },
      { type: audioType, pid: TS_AUDIO, desc: [0x0A, 4, 0x65, 0x6E, 0x67, 0] },
    ]), true),
    tsPacket(TS_AUDIO, [7, 7, 7, 7]),                    // 前の区切りの PES の続き → 使わない
    tsPacket(TS_VIDEO, [...pesHeader(0xE0), ...video], true),
    tsPacket(TS_AUDIO, [...pesHeader(), ...a1.slice(0, 170)], true), // ちょうど 184 バイト(adaptation field なし)
    tsPacket(TS_AUDIO, null),                            // adaptation field だけ
    tsPacket(TS_AUDIO, a1.slice(170)),                   // stuffing あり
    tsPacket(TS_VIDEO, video),
    tsPacket(TS_AUDIO, [...pesHeader(), ...a2], true),
  );
  return { ts, audio: bytes(a1, a2) };
}

const enc = s => new TextEncoder().encode(s);

// メディア要素。paused / currentTime / currentSrc / 表示サイズは el.st と引数で決める(jsdom は再生できない)
function fakeMedia({ tag = 'video', src = '', w = 640, h = 360, paused = false, inDom = true } = {}) {
  const el = document.createElement(tag);
  el.st = { src, paused, time: 0 };
  Object.defineProperty(el, 'paused', { get: () => el.st.paused });
  Object.defineProperty(el, 'currentTime', { get: () => el.st.time });
  Object.defineProperty(el, 'currentSrc', { get: () => el.st.src });
  el.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, width: w, height: h, right: w, bottom: h });
  if (inDom) document.body.appendChild(el);
  return el;
}

// 5 秒の 120 BPM キック。どのデータも同じ音として返す
function fakeAudioBuffer() {
  const sr = 44100, n = sr * 5, ch = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr, since = t % 0.5;
    ch[i] = 0.8 * Math.exp(-since / 0.05) * Math.sin(2 * Math.PI * 55 * t) + 0.02 * Math.sin(2 * Math.PI * 3000 * t);
  }
  return { sampleRate: sr, length: n, getChannelData: () => ch };
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
    fetchImpl = () => Promise.reject(new Error('no network in tests'));
    window.fetch = (...args) => fetchImpl(...args);
    HTMLMediaElement.prototype.play = function() { return Promise.resolve(); }; // jsdom は再生できない
    lib = loadTap()._lib;
  });

  afterEach(() => {
    delete window.__vjamMse;
    window.fetch = realFetch;
    HTMLMediaElement.prototype.play = realPlay;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('install', () => {
    it('exposes only frameAt / media / stats / _lib on window.__vjamMse', () => {
      expect(Object.keys(window.__vjamMse).sort()).toEqual(['_lib', 'frameAt', 'media', 'stats']);
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
      const muxed = new FakeMediaSource().addSourceBuffer('video/mp4; codecs="avc1.4d401f, mp4a.40.2"');
      expect(muxed.appendBuffer).toBe(FakeSourceBuffer.prototype.appendBuffer);
    });

    it('hooks audio-only video/mp4 (Twitch)', async () => {
      const sb = new FakeMediaSource().addSourceBuffer('video/mp4;codecs="mp4a.40.2"');
      sb.appendBuffer(bytes(mp4Init(44100), mp4Segment(0).all));
      await flush();
      expect(decodes.length).toBe(1);
      expect(window.__vjamMse.frameAt(2)).not.toBeNull();
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

  describe('audio type', () => {
    it('treats audio/* as audio', () => {
      expect(lib.isAudioType('audio/mp4; codecs="mp4a.40.2"')).toBe(true);
      expect(lib.isAudioType('audio/webm; codecs="opus"')).toBe(true);
      expect(lib.isAudioType('audio/mpeg')).toBe(true);
    });

    it('treats audio-only codecs as audio even in video/* (Twitch)', () => {
      for (const c of ['mp4a.40.2', 'opus', 'Opus', 'vorbis', 'flac', 'fLaC', 'ac-3', 'ec-3', 'mp3']) {
        expect(lib.isAudioType(`video/mp4;codecs="${c}"`)).toBe(true);
      }
      expect(lib.isAudioType('video/mp4; codecs="mp4a.40.2, opus"')).toBe(true);
      expect(lib.isAudioType('video/mp4;codecs=mp4a.40.5')).toBe(true);
    });

    it('does not treat video or muxed types as audio', () => {
      expect(lib.isAudioType('video/mp4; codecs="avc1.4d401f"')).toBe(false);
      expect(lib.isAudioType('video/mp4; codecs="avc1.4d401f,mp4a.40.2"')).toBe(false);
      expect(lib.isAudioType('video/webm; codecs="vp9, opus"')).toBe(false);
      expect(lib.isAudioType('video/mp4; codecs="mp4av"')).toBe(false);
      expect(lib.isAudioType('video/mp4; codecs=""')).toBe(false);
      expect(lib.isAudioType('video/mp4')).toBe(false);
      expect(lib.isAudioType('')).toBe(false);
      expect(lib.isAudioType(undefined)).toBe(false);
    });
  });

  describe('media()', () => {
    const media = () => window.__vjamMse.media();

    it('returns null when nothing is playing', () => {
      expect(media()).toBeNull();
      fakeMedia({ paused: true });
      expect(media()).toBeNull();
    });

    it('picks the playing media with the largest area', () => {
      fakeMedia({ w: 320, h: 180 });                   // 広告
      const main = fakeMedia({ w: 1280, h: 720 });
      fakeMedia({ w: 1920, h: 1080, paused: true });   // 一時停止中
      fakeMedia({ tag: 'audio', w: 300, h: 54 });
      expect(media()).toBe(main);
    });

    it('skips media with zero width or height (dummy players)', () => {
      fakeMedia({ w: 0, h: 360 });
      fakeMedia({ w: 640, h: 0 });
      expect(media()).toBeNull();
      const small = fakeMedia({ w: 2, h: 2 });
      expect(media()).toBe(small);
    });

    it('returns playing audio that is not in the DOM (new Audio() on SoundCloud)', () => {
      const a = fakeMedia({ tag: 'audio', src: 'blob:https://soundcloud.test/1', w: 0, h: 0, inDom: false });
      expect(media()).toBeNull(); // play() されていなければ知らない
      a.play();
      expect(media()).toBe(a);
    });

    it('prefers playing media in the DOM over media outside it', () => {
      const a = fakeMedia({ tag: 'audio', w: 0, h: 0, inDom: false });
      a.play();
      const v = fakeMedia({ w: 320, h: 180 });
      expect(media()).toBe(v);
      v.st.paused = true;
      expect(media()).toBe(a);
    });

    it('picks the last played among media outside the DOM', () => {
      const a = fakeMedia({ tag: 'audio', inDom: false }), b = fakeMedia({ tag: 'audio', inDom: false });
      a.play();
      b.play();
      expect(media()).toBe(b);
      a.play();
      expect(media()).toBe(a);
    });

    it('forgets media outside the DOM once it pauses or ends', () => {
      const a = fakeMedia({ tag: 'audio', inDom: false });
      a.play();
      a.st.paused = true;
      a.dispatchEvent(new Event('pause'));
      a.st.paused = false; // play() を通らずに戻っても候補にしない
      expect(media()).toBeNull();
      a.play();
      expect(media()).toBe(a);
      a.dispatchEvent(new Event('ended'));
      expect(media()).toBeNull();
    });

    it('drops media outside the DOM that is paused without a pause event (play() rejected)', () => {
      const a = fakeMedia({ tag: 'audio', inDom: false });
      a.play();
      a.st.paused = true;
      expect(media()).toBeNull();
      a.st.paused = false;
      expect(media()).toBeNull();
    });

    it('does not fall back to a zero-size <video> in the DOM', () => {
      const dummy = fakeMedia({ w: 0, h: 0 });
      dummy.play();
      expect(media()).toBeNull();
    });

    it('falls back to a playing <audio> in the DOM even at zero size (no controls)', () => {
      fakeMedia({ tag: 'audio', w: 0, h: 0, paused: true });
      expect(media()).toBeNull();
      const hidden = fakeMedia({ tag: 'audio', w: 0, h: 0 });
      fakeMedia({ tag: 'audio', w: 0, h: 0 });
      fakeMedia({ w: 0, h: 360 }); // ダミーの <video> は 0 サイズのまま除く
      expect(media()).toBe(hidden);
    });

    it('orders: largest playing media → playing <audio> in the DOM → played media outside the DOM', () => {
      const outside = fakeMedia({ tag: 'audio', inDom: false });
      outside.play();
      expect(media()).toBe(outside);
      const hidden = fakeMedia({ tag: 'audio', w: 0, h: 0 });
      expect(media()).toBe(hidden);
      const v = fakeMedia({ w: 320, h: 180 });
      expect(media()).toBe(v);
      v.st.paused = true;
      expect(media()).toBe(hidden);
      hidden.st.paused = true;
      expect(media()).toBe(outside);
    });

    it('passes play() through to the original', () => {
      const orig = vi.fn(() => 'played');
      HTMLMediaElement.prototype.play = orig;
      loadTap();
      const a = fakeMedia({ tag: 'audio', inDom: false });
      expect(a.play()).toBe('played');
      expect(orig).toHaveBeenCalledTimes(1);
      expect(orig.mock.contexts[0]).toBe(a);
    });
  });

  describe('m3u8', () => {
    const base = 'https://cdn.test/v/master.m3u8';

    it('uses the audio rendition of a master playlist (DEFAULT=YES first)', () => {
      const text = [
        '#EXTM3U',
        '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub",NAME="en",URI="subs/en.m3u8"',
        '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="commentary",DEFAULT=NO,URI="audio/commentary.m3u8"',
        '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",DEFAULT=YES,AUTOSELECT=YES,URI="audio/en.m3u8"',
        '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Deutsch",DEFAULT=NO,URI="audio/de.m3u8"',
        '#EXT-X-STREAM-INF:BANDWIDTH=800000,CODECS="avc1.4d401f,mp4a.40.2",AUDIO="aud"',
        'video/720.m3u8',
      ].join('\n');
      expect(lib.parsePlaylist(text, base)).toEqual({ master: true, url: 'https://cdn.test/v/audio/en.m3u8' });
    });

    it('uses the lowest-bandwidth variant when there is no audio rendition URI', () => {
      const text = [
        '#EXTM3U',
        '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="main",DEFAULT=YES', // URI なし = 音声はバリアントの中
        '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"',
        'hi/index.m3u8',
        '#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=100,URI="iframe.m3u8"',
        '#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=416x234',
        '',
        '/lo/index.m3u8',
        '#EXT-X-STREAM-INF:BANDWIDTH=1200000',
        'https://other.test/mid.m3u8',
      ].join('\r\n');
      expect(lib.parsePlaylist(text, base)).toEqual({ master: true, url: 'https://cdn.test/lo/index.m3u8' });
    });

    it('reads a media playlist (EXTINF, MAP, BYTERANGE, relative URLs)', () => {
      const text = [
        '#EXTM3U',
        '#EXT-X-VERSION:7',
        '#EXT-X-TARGETDURATION:7',
        '#EXT-X-PLAYLIST-TYPE:VOD',
        '#EXT-X-MAP:URI="init.mp4"',
        '#EXTINF:6.25,',
        'seg0.m4s',
        '#EXTINF:5.5,title',
        '../other/seg1.m4s',
        '#EXT-X-DISCONTINUITY',
        '#EXT-X-MAP:URI="https://cdn2.test/all.mp4",BYTERANGE="720@0"',
        '#EXTINF:4,',
        '#EXT-X-BYTERANGE:1000@720',
        'https://cdn2.test/all.mp4',
        '#EXTINF:4,',
        '#EXT-X-BYTERANGE:2000',
        'https://cdn2.test/all.mp4',
        '#EXT-X-ENDLIST',
      ].join('\n');
      const pl = lib.parsePlaylist(text, 'https://cdn.test/v/audio/en.m3u8');
      expect(pl.master).toBe(false);
      expect(pl.live).toBe(false);
      expect(pl.encrypted).toBe(false);
      const init1 = { uri: 'https://cdn.test/v/audio/init.mp4', range: null };
      const init2 = { uri: 'https://cdn2.test/all.mp4', range: [0, 720] };
      expect(pl.segs).toEqual([
        { uri: 'https://cdn.test/v/audio/seg0.m4s', start: 0, dur: 6.25, range: null, map: init1 },
        { uri: 'https://cdn.test/v/other/seg1.m4s', start: 6.25, dur: 5.5, range: null, map: init1 },
        { uri: 'https://cdn2.test/all.mp4', start: 11.75, dur: 4, range: [720, 1000], map: init2 },
        { uri: 'https://cdn2.test/all.mp4', start: 15.75, dur: 4, range: [1720, 2000], map: init2 },
      ]);
    });

    it('flags live playlists (no EXT-X-ENDLIST)', () => {
      const pl = lib.parsePlaylist('#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:100\n#EXTINF:2,\nlive100.ts\n#EXTINF:2,\nlive101.ts\n', base);
      expect(pl.live).toBe(true);
      expect(pl.segs.map(s => s.uri)).toEqual(['https://cdn.test/v/live100.ts', 'https://cdn.test/v/live101.ts']);
    });

    it('flags encrypted playlists', () => {
      const aes = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:4,\na.ts\n#EXT-X-ENDLIST';
      expect(lib.parsePlaylist(aes, base).encrypted).toBe(true);
      const none = '#EXTM3U\n#EXT-X-KEY:METHOD=NONE\n#EXTINF:4,\na.ts\n#EXT-X-ENDLIST';
      expect(lib.parsePlaylist(none, base).encrypted).toBe(false);
    });

    it('returns null for something that is not a playlist', () => {
      expect(lib.parsePlaylist('<html></html>', base)).toBeNull();
      expect(lib.parsePlaylist('', base)).toBeNull();
      expect(lib.parsePlaylist('﻿#EXTM3U\n#EXTINF:1,\na.ts\n#EXT-X-ENDLIST', base).segs.length).toBe(1);
    });
  });

  describe('segment window', () => {
    const segs = new Array(10).fill(0).map((_, i) => ({ start: i * 4, dur: 4 }));

    // 取る順番(取ったものは次から要らない)
    function order(t, needed = () => true) {
      const done = new Set(), out = [];
      for (;;) {
        const i = lib.pickSegment(segs, t, s => !done.has(s) && needed(s));
        if (i < 0) return out;
        done.add(segs[i]);
        out.push(i);
      }
    }

    it('takes only segments overlapping [t - 2, t + 15], from the current one', () => {
      expect(order(0)).toEqual([0, 1, 2, 3]);
      expect(order(9)).toEqual([2, 3, 4, 5, 1]);
      expect(order(30)).toEqual([7, 8, 9]);
      expect(order(100)).toEqual([]);
    });

    it('skips segments that are not needed', () => {
      expect(order(9, s => s.start !== 12)).toEqual([2, 4, 5, 1]);
    });
  });

  describe('MPEG-TS audio', () => {
    it('joins the audio PES payloads (PAT → PMT → audio PID, PES header, adaptation field)', () => {
      const { ts, audio } = tsSegment();
      expect(same(lib.tsAudio(ts), audio)).toBe(true);
    });

    it('accepts MP3 audio streams', () => {
      for (const type of [0x03, 0x04]) {
        const { ts, audio } = tsSegment(type);
        expect(same(lib.tsAudio(ts), audio)).toBe(true);
      }
    });

    it('skips a PES whose header is broken', () => {
      const { ts, audio } = tsSegment();
      const broken = tsPacket(TS_AUDIO, [0, 0, 2, 0xC0, 0, 0, 0x80, 0x80, 5, 0x21, 0, 1, 0, 1, 8, 8, 8], true);
      const tail = tsPacket(TS_AUDIO, [6, 6, 6]); // 壊れた PES の続き
      expect(same(lib.tsAudio(bytes(ts, broken, tail)), audio)).toBe(true);
    });

    it('resyncs after garbage', () => {
      const { ts, audio } = tsSegment();
      expect(same(lib.tsAudio(bytes([1, 2, 3], ts)), audio)).toBe(true);
    });

    it('returns null without an audio stream', () => {
      const ts = bytes(
        tsPacket(0, tsPat(TS_PMT), true),
        tsPacket(TS_PMT, tsPmt([{ type: 0x1B, pid: TS_VIDEO }]), true),
        tsPacket(TS_VIDEO, [...pesHeader(0xE0), 1, 2, 3], true),
      );
      expect(lib.tsAudio(ts)).toBeNull();
      expect(lib.tsAudio(new Uint8Array(0))).toBeNull();
    });
  });

  describe('standard HLS', () => {
    const MASTER = 'https://cdn.test/v/master.m3u8';
    const AUDIO_PL = 'https://cdn.test/v/audio/en.m3u8';
    const INIT = 'https://cdn.test/v/audio/init.mp4';
    const seg = i => `https://cdn.test/v/audio/s${i}.m4s`;
    let clock, calls, files, decodes, tap;

    const settle = async () => { for (let i = 0; i < 40; i++) await new Promise(r => setTimeout(r, 0)); };

    // 偽のサーバ(fetch のモック)。Range には 206 で答える。値が関数ならそれが返す Response
    function serve(f) {
      files = f;
      fetchImpl = (url, opts = {}) => {
        const range = opts.headers && opts.headers.Range;
        calls.push(range ? `${url} ${range}` : url);
        const body = files[url];
        if (body === undefined) return Promise.resolve(new Response('', { status: 404 }));
        if (typeof body === 'function') return Promise.resolve(body(opts));
        const b = typeof body === 'string' ? enc(body) : body;
        if (!range) return Promise.resolve(new Response(b));
        const [, s, e] = /bytes=(\d+)-(\d+)/.exec(range);
        return Promise.resolve(new Response(b.slice(+s, +e + 1), { status: 206 }));
      };
    }

    // master → 音声の再生リスト(fMP4、4 秒 × n 本)
    function vodFiles(n = 10) {
      const f = {
        [MASTER]: '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="en",DEFAULT=YES,URI="audio/en.m3u8"\n' +
          '#EXT-X-STREAM-INF:BANDWIDTH=900000,AUDIO="a"\nvideo/720.m3u8\n',
        [INIT]: mp4Init(44100),
      };
      let pl = '#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXT-X-MAP:URI="init.mp4"\n';
      for (let i = 0; i < n; i++) {
        pl += `#EXTINF:4.0,\ns${i}.m4s\n`;
        f[seg(i)] = mp4Segment(i * 4 * 44100).all;
      }
      f[AUDIO_PL] = pl + '#EXT-X-ENDLIST\n';
      return f;
    }

    const fetchedSegs = () => calls.filter(c => /\.m4s/.test(c)).map(c => +/s(\d+)\.m4s/.exec(c)[1]);

    // エンジンの音声ループ 1 回(時計を進めて frameAt)
    function engineTick(m, ms = 600) {
      clock += ms;
      return tap.frameAt(m.currentTime);
    }

    beforeEach(() => {
      calls = []; decodes = []; clock = 1e6;
      vi.spyOn(Date, 'now').mockImplementation(() => clock);
      window.OfflineAudioContext = class {
        decodeAudioData(buf) {
          decodes.push(new Uint8Array(buf));
          return Promise.resolve(fakeAudioBuffer());
        }
      };
      tap = loadTap();
    });

    afterEach(() => {
      delete window.OfflineAudioContext;
      delete window.MediaSource;
    });

    it('does not fetch while the engine is not calling frameAt', async () => {
      serve(vodFiles());
      const v = fakeMedia({ src: MASTER });
      await settle();
      clock += 10000;
      await settle();
      expect(calls).toEqual([]);
      tap.frameAt(0);              // エンジンが使い始めた
      expect(calls).toEqual([MASTER]);
      clock += 2500;               // VJam FX OFF / 音声 OFF:frameAt が止まった
      await settle();
      expect(calls).toEqual([MASTER]);
      engineTick(v);               // 再開
      await settle();
      expect(calls.slice(0, 3)).toEqual([MASTER, AUDIO_PL, INIT]);
      expect(fetchedSegs()).toEqual([0, 1, 2, 3]);
    });

    it('does not fetch while the media is paused', async () => {
      serve(vodFiles());
      fakeMedia({ src: MASTER, paused: true });
      tap.frameAt(0);
      await settle();
      expect(calls).toEqual([]);
    });

    it('follows master → audio playlist and decodes init + segment', async () => {
      serve(vodFiles());
      fakeMedia({ src: MASTER });
      tap.frameAt(0);
      await settle();
      expect(calls).toEqual([MASTER, AUDIO_PL, INIT, seg(0), seg(1), seg(2), seg(3)]); // init は 1 回だけ
      expect(decodes.length).toBe(4);
      expect(same(decodes[0], bytes(mp4Init(44100), mp4Segment(0).all))).toBe(true);
      expect(tap.frameAt(2)).not.toBeNull();
      expect(tap.stats.hlsSegments).toBe(4);
      const size = u => (typeof files[u] === 'string' ? enc(files[u]) : files[u]).length;
      expect(tap.stats.hlsBytes).toBe(calls.reduce((n, u) => n + size(u), 0));
    });

    it('fetches one request at a time', async () => {
      const f = vodFiles();
      let release;
      f[seg(0)] = () => new Promise(r => { release = () => r(new Response(mp4Segment(0).all)); });
      serve(f);
      const v = fakeMedia({ src: MASTER });
      tap.frameAt(0);
      await settle();
      engineTick(v);
      engineTick(v);
      await settle();
      expect(fetchedSegs()).toEqual([0]);
      release();
      await settle();
      expect(fetchedSegs()).toEqual([0, 1, 2, 3]);
    });

    it('does not fetch segments outside [t - 2, t + 15]', async () => {
      serve(vodFiles());
      const v = fakeMedia({ src: MASTER });
      tap.frameAt(0);
      await settle();
      expect(fetchedSegs()).toEqual([0, 1, 2, 3]);
      v.st.time = 30; // シーク
      engineTick(v);
      await settle();
      expect(fetchedSegs()).toEqual([0, 1, 2, 3, 7, 8, 9]);
      v.st.time = 31;
      engineTick(v);
      await settle();
      expect(fetchedSegs()).toEqual([0, 1, 2, 3, 7, 8, 9]); // 取った区切りは取り直さない
      expect(tap.frameAt(31)).not.toBeNull();
    });

    it('decodes only the audio of TS segments', async () => {
      const { ts, audio } = tsSegment();
      const src = 'https://cdn.test/hls/stream.m3u8';
      serve({
        [src]: '#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\na.ts\n#EXTINF:4,\nb.ts\n#EXT-X-ENDLIST\n',
        'https://cdn.test/hls/a.ts': ts,
        'https://cdn.test/hls/b.ts': ts,
      });
      fakeMedia({ src });
      tap.frameAt(0);
      await settle();
      expect(calls).toEqual([src, 'https://cdn.test/hls/a.ts', 'https://cdn.test/hls/b.ts']);
      expect(decodes.length).toBe(2);
      expect(same(decodes[0], audio)).toBe(true);
      expect(tap.frameAt(5)).not.toBeNull();
    });

    it('fetches EXT-X-BYTERANGE segments with Range requests', async () => {
      const init = mp4Init(44100), s0 = mp4Segment(0).all, s1 = mp4Segment(4 * 44100).all;
      const file = bytes(init, s0, s1), u = 'https://cdn.test/br/media.mp4';
      const src = 'https://cdn.test/br/index.m3u8';
      serve({
        [src]: `#EXTM3U\n#EXT-X-MAP:URI="media.mp4",BYTERANGE="${init.length}@0"\n` +
          `#EXTINF:4,\n#EXT-X-BYTERANGE:${s0.length}@${init.length}\nmedia.mp4\n` +
          `#EXTINF:4,\n#EXT-X-BYTERANGE:${s1.length}\nmedia.mp4\n#EXT-X-ENDLIST\n`,
        [u]: file,
      });
      fakeMedia({ src });
      tap.frameAt(0);
      await settle();
      expect(calls).toEqual([
        src,
        `${u} bytes=0-${init.length - 1}`,
        `${u} bytes=${init.length}-${init.length + s0.length - 1}`,
        `${u} bytes=${init.length + s0.length}-${file.length - 1}`,
      ]);
      expect(same(decodes[1], bytes(init, s1))).toBe(true);
    });

    it('gives up byte-range segments when the server ignores Range (no whole-file download)', async () => {
      const src = 'https://cdn.test/br/index.m3u8', u = 'https://cdn.test/br/media.mp4';
      serve({
        [src]: '#EXTM3U\n#EXTINF:4,\n#EXT-X-BYTERANGE:100@0\nmedia.mp4\n#EXTINF:4,\n#EXT-X-BYTERANGE:100\nmedia.mp4\n#EXT-X-ENDLIST\n',
        [u]: () => new Response(new Uint8Array(1e6)), // 200 で丸ごと
      });
      const v = fakeMedia({ src });
      tap.frameAt(0);
      await settle();
      expect(calls).toEqual([src, `${u} bytes=0-99`, `${u} bytes=100-199`]);
      expect(tap.stats.lastErr).toMatch(/byte range/);
      expect(tap.stats.hlsBytes).toBe(enc(files[src]).length);
      engineTick(v);
      await settle();
      expect(calls.length).toBe(3); // 失敗した区切りは取り直さない
    });

    it('probes URLs that do not look like HLS with the first 64 bytes', async () => {
      const src = 'https://media.test/play?id=5';
      serve({
        [src]: '#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXTINF:4,\nhttps://media.test/seg/a.ts\n#EXT-X-ENDLIST\n',
        'https://media.test/seg/a.ts': tsSegment().ts,
      });
      fakeMedia({ src });
      tap.frameAt(0);
      await settle();
      expect(calls).toEqual([`${src} bytes=0-63`, src, 'https://media.test/seg/a.ts']);
      expect(decodes.length).toBe(1);
    });

    it('does not download a progressive mp4', async () => {
      const src = 'https://media.test/movie.mp4';
      let pulled = 0, cancelled = false;
      serve({
        // Range を無視して丸ごと返すサーバ(終わらない)
        [src]: () => new Response(new ReadableStream({
          pull(c) { pulled++; c.enqueue(bytes(box('ftyp', [0x69, 0x73, 0x6F, 0x6D], [0, 0, 2, 0]), new Array(65536).fill(0))); },
          cancel() { cancelled = true; },
        })),
      });
      const v = fakeMedia({ src });
      tap.frameAt(0);
      await settle();
      expect(calls).toEqual([`${src} bytes=0-63`]);
      expect(pulled).toBeLessThan(5);
      expect(cancelled).toBe(true); // 読むのをやめて通信も切る
      expect(tap.stats.lastErr).toMatch(/not HLS/);
      engineTick(v);
      await settle();
      expect(calls.length).toBe(1);
      expect(tap.stats.hlsSegments).toBe(0);
    });

    it('does not fetch segments of live playlists', async () => {
      const src = 'https://cdn.test/live/index.m3u8';
      serve({
        [src]: '#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXTINF:2,\na.ts\n#EXTINF:2,\nb.ts\n',
        'https://cdn.test/live/a.ts': tsSegment().ts,
      });
      const v = fakeMedia({ src });
      tap.frameAt(0);
      await settle();
      engineTick(v);
      await settle();
      expect(calls).toEqual([src]);
      expect(tap.stats.lastErr).toMatch(/live/);
    });

    it('drops the analysis and starts over when the src changes', async () => {
      serve(vodFiles());
      const v = fakeMedia({ src: MASTER });
      tap.frameAt(0);
      await settle();
      expect(tap.frameAt(2)).not.toBeNull();
      const next = 'https://cdn.test/w/index.m3u8';
      v.st.src = next; // 次の動画
      clock += 600;
      expect(tap.frameAt(2)).toBeNull();
      expect(calls[calls.length - 1]).toBe(next);
    });

    it('drops MSE data when a standard HLS video takes over', async () => {
      window.MediaSource = class {
        addSourceBuffer() { return { timestampOffset: 0, appendBuffer() {}, abort() {}, remove() {} }; }
      };
      tap = loadTap();
      new window.MediaSource().addSourceBuffer('audio/webm; codecs="opus"').appendBuffer(bytes(webmInit(), webmCluster(0)));
      await settle();
      expect(tap.frameAt(2)).not.toBeNull();
      serve({});
      fakeMedia({ src: MASTER });
      clock += 600;
      expect(tap.frameAt(2)).toBeNull();
      expect(calls).toEqual([MASTER]);
    });

    it('stops and drops its data when the media switches to MediaSource (blob:)', async () => {
      serve(vodFiles());
      const v = fakeMedia({ src: MASTER });
      tap.frameAt(0);
      await settle();
      const n = calls.length;
      v.st.src = 'blob:https://cdn.test/1';
      clock += 600;
      expect(tap.frameAt(2)).toBeNull();
      v.st.time = 30;
      engineTick(v);
      await settle();
      expect(calls.length).toBe(n);
    });

    it('drops a segment that arrives after the src changed', async () => {
      const f = vodFiles();
      let release;
      f[seg(0)] = () => new Promise(r => { release = () => r(new Response(mp4Segment(0).all)); });
      serve(f);
      const v = fakeMedia({ src: MASTER });
      tap.frameAt(0);
      await settle();
      expect(release).toBeTypeOf('function');
      v.st.src = 'https://cdn.test/w/index.m3u8';
      engineTick(v);
      release();
      await settle();
      expect(decodes.length).toBe(0);
      expect(tap.frameAt(2)).toBeNull();
    });
  });
});
