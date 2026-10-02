import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pseudoLevels, parseTrace, createFeed, mergeUnread } from './audio.js';

const trace = (frames, extra = {}) => parseTrace({ name: 't', bpm: 124, fps: 30, frames, ...extra }, 'file');
// [rms, bass, mid, treble, beat, strength]
const f = (beat, v = 0.5) => [v, v, v, v, beat, v];

describe('擬似 120 BPM', () => {
  it('計測の harness.js と同じ式', () => {
    const src = readFileSync(resolve(__dirname, '../bench/site/harness.js'), 'utf8');
    for (const part of ['Math.exp(-ph * 8)', 'rms: 0.15 + 0.2 * env', 'bass: 0.3 + 0.7 * env',
      'mid: 0.4 + 0.2 * Math.sin(t * 3)', 'treble: 0.3 + 0.2 * Math.sin(t * 7)', 't % 0.5']) {
      expect(src).toContain(part);
    }
    const a = pseudoLevels(0);
    expect(a).toMatchObject({ bpm: 120, strength: 1, rms: 0.35, bass: 1, mid: 0.4, treble: 0.3 });
    expect(pseudoLevels(0.25).bass).toBeCloseTo(0.3 + 0.7 * Math.exp(-2));
  });

  it('0.5 秒ごとにビート。間引いて読んでも跨いだら true', () => {
    const feed = createFeed();
    expect(feed.advance(0).beat).toBe(true);
    expect(feed.advance(0.2).beat).toBe(false);
    expect(feed.advance(0.2).beat).toBe(false);
    expect(feed.advance(0.2).beat).toBe(true); // 0.6 秒
    expect(feed.advance(0).beat).toBe(false);
  });
});

describe('traces/*.json', () => {
  it('形を確かめる。名前・fps の既定', () => {
    expect(parseTrace(null)).toBe(null);
    expect(parseTrace({ frames: [] })).toBe(null);
    expect(parseTrace({ frames: [[1, 2, 3]] })).toBe(null);
    const t = parseTrace({ frames: [f(1), [1, 2], f(0)] }, 'house');
    expect(t).toMatchObject({ name: 'house', bpm: 0, fps: 30, source: '' });
    expect(t.frames).toHaveLength(2);
  });

  it('頭から fps で流し、値と BPM をエンジンの形で返す', () => {
    const t = trace([[0.1, 0.2, 0.3, 0.4, 1, 0.9], f(0, 0.6), f(0, 0.7)]);
    const feed = createFeed(t);
    expect(feed.advance(0)).toEqual({ beat: true, bpm: 124, strength: 0.9, rms: 0.1, bass: 0.2, mid: 0.3, treble: 0.4 });
    expect(feed.advance(1 / 30)).toMatchObject({ beat: false, bass: 0.6 });
    expect(feed.advance(1 / 30)).toMatchObject({ beat: false, bass: 0.7 });
  });

  it('終わったら頭に戻る', () => {
    const feed = createFeed(trace([f(1, 0.1), f(0, 0.2), f(0, 0.3)]));
    feed.advance(0);
    expect(feed.advance(2 / 30 + 1e-6)).toMatchObject({ beat: false, bass: 0.3 });
    expect(feed.advance(1 / 30)).toMatchObject({ beat: true, bass: 0.1 }); // 4 フレーム目 = 頭
  });

  it('間のフレームのビートを落とさない', () => {
    const feed = createFeed(trace([f(0), f(1), f(0), f(0), f(0)]));
    feed.advance(0);
    expect(feed.advance(3 / 30 + 1e-6).beat).toBe(true); // 1 フレーム目を跨いだ
    expect(feed.advance(1 / 30).beat).toBe(false);
  });

  it('一周以上飛んでも止まらない', () => {
    const feed = createFeed(trace([f(0), f(1)]));
    feed.advance(0);
    expect(feed.advance(100).beat).toBe(true);
  });
});

describe('エンジンに渡す', () => {
  it('まだ読まれていないビートは消さない', () => {
    expect(mergeUnread({ beat: true }, { beat: false, bass: 1 })).toEqual({ beat: true, bass: 1 });
    expect(mergeUnread(null, { beat: false })).toEqual({ beat: false });
    expect(mergeUnread({ beat: false }, { beat: true })).toEqual({ beat: true });
  });
});
