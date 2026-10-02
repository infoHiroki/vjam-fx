import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseReactivity, parseSeedReview } from './vjam-json.mjs';

const read = f => JSON.parse(readFileSync(resolve(__dirname, f), 'utf8'));

describe('preset-audio-reactivity.md', () => {
  const md = `# p5 Preset Audio Reactivity 一覧 (auto-generated)

**生成日**: 2026-05-01

## 詳細表

| # | preset | bass | mid | treble | rms | strength | beat | isBeat | onBeat | カテゴリ |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | \`sonar-ping\` | 5 | 5 | 5 | 8 |  |  |  | ✓ | FFT + beat |
| 2 | \`moire\` | 3 | 3 | 4 | 1 | 1 | 2 | 1 | ✓ | FFT + beat |
| 3 | \`3d-textures\` |  |  |  |  |  |  |  |  | static (no audio) |

その後の文
`;

  it('表を 1 本ずつにする(空欄は 0、onBeat は ✓)', () => {
    const r = parseReactivity(md);
    expect(r.generated).toBe('2026-05-01');
    expect(Object.keys(r.presets)).toEqual(['3d-textures', 'moire', 'sonar-ping']);
    expect(r.presets['sonar-ping']).toEqual({ bass: 5, mid: 5, treble: 5, rms: 8, strength: 0, beat: 0, isBeat: 0, onBeat: true, category: 'FFT + beat' });
    expect(r.presets.moire).toMatchObject({ strength: 1, beat: 2, isBeat: 1 });
    expect(r.presets['3d-textures']).toMatchObject({ bass: 0, onBeat: false, category: 'static (no audio)' });
  });

  it('見出しが無ければ throw', () => {
    expect(() => parseReactivity('# no table')).toThrow();
  });

  it('置いてある vjam-reactivity.json は 1 本ずつ数が入っている', () => {
    const j = read('vjam-reactivity.json');
    expect(Object.keys(j.presets).length).toBeGreaterThan(300);
    for (const v of Object.values(j.presets)) {
      for (const k of ['bass', 'mid', 'treble', 'rms', 'strength', 'beat', 'isBeat']) expect(Number.isInteger(v[k])).toBe(true);
      expect(typeof v.onBeat).toBe('boolean');
    }
  });
});

describe('seed-review.md', () => {
  const md = `## レビュー進捗

### 採用 (5 件)
- 3d-bubble, 3d-cube
- analog-wave, audio-mesh,
- lava-lamp

### 改善 (0 件)
(なし)
`;

  it('「採用」の名前を拾う', () => {
    expect(parseSeedReview(md)).toEqual(['3d-bubble', '3d-cube', 'analog-wave', 'audio-mesh', 'lava-lamp']);
  });

  it('件数が合わなければ throw', () => {
    expect(() => parseSeedReview(md.replace('5 件', '6 件'))).toThrow();
    expect(() => parseSeedReview('### ボツ')).toThrow();
  });

  it('置いてある vjam-review.json は採用 50 件', () => {
    const j = read('vjam-review.json');
    expect(j.adopted).toHaveLength(50);
    expect(new Set(j.adopted).size).toBe(50);
  });
});
