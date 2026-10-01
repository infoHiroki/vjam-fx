"""
VJam FX の計測(元のページが分かるか・軽いか・音に反応するか)
  - 記事ページ(白・暗)の上でエフェクトを重ねた画面と元の画面の SSIM → recLight / recDark
  - CPU 4 倍スロットル下での p5 redraw 1 回の時間と実フレームレート → msPerFrame / fps
  - p5 キャンバスの画素をページ内でサンプリング: 無音 → 擬似音楽(120 BPM)での変化とビート同期 → energyGain など
usage(リポのルートから):
  python3 tools/bench/bench_fx.py fx [name ...]           content/presets
  python3 tools/bench/bench_fx.py candidates [name ...]   tools/bench/candidates
  python3 tools/bench/bench_fx.py combos [--reps a,b,c]   代表プリセット × filter × blend × 白・暗
  python3 tools/bench/bench_fx.py all                     上の 3 つを順に
名前を省くと全部。out/<set>/results.json にあるものは飛ばす(やり直すときは out/<set>/ を消す)
"""
import os, sys, json, time, threading, functools, http.server
from playwright.sync_api import sync_playwright
import numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
OUT_ROOT = os.path.join(HERE, 'out')
SETS = {'fx': os.path.join(REPO, 'content', 'presets'), 'candidates': os.path.join(HERE, 'candidates')}
VIEWPORT = {'width': 1280, 'height': 800}
THROTTLE = 4      # iPad 第 9 世代くらい
N_REPS = 4        # Filter / Blend を試す代表プリセットの数
THUMB = (640, 400)
FLASH_AREA = 0.05
# 必須条件の初期値。curate/logic.js の DEFAULT_THRESHOLDS と同じ(テストで揃っているか見る)
DEFAULT_THRESHOLDS = {"recLight": 0.6, "recDark": 0.6, "fps": 40, "ms": 8, "react": 0.35, "flash": 0.5}
COMBO_THUMB = (480, 300)


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


P5 = read(os.path.join(REPO, 'lib', 'p5.min.js'))
BASE = read(os.path.join(REPO, 'content', 'base-preset.js'))
ENGINE = read(os.path.join(REPO, 'content', 'content.js'))
HARNESS = read(os.path.join(HERE, 'site', 'harness.js'))
SAMPLER = read(os.path.join(HERE, 'site', 'sampler.js'))
FILTER_DEFS = json.loads(read(os.path.join(HERE, 'filters.json')))
BLENDS = FILTER_DEFS['blends']
# 'none' + 単体 8 種 + 複合(単体と同じ文字列は除く)。curate/logic.js の filterList と同じ順
FILTERS = ['none'] + list(FILTER_DEFS['single'].values())
FILTERS += [f for f in FILTER_DEFS['compound'] if f not in FILTERS]


# ---------- 画像 ----------

def gray(im):
    im = im.convert('L').resize((640, 400), Image.BILINEAR)
    return np.asarray(im, dtype=np.float64) / 255


def ssim(a, b):
    C1, C2 = 0.01 ** 2, 0.03 ** 2
    ma, mb = uniform_filter(a, 7), uniform_filter(b, 7)
    saa = uniform_filter(a * a, 7) - ma * ma; sbb = uniform_filter(b * b, 7) - mb * mb
    sab = uniform_filter(a * b, 7) - ma * mb
    return float((((2 * ma * mb + C1) * (2 * sab + C2)) / ((ma * ma + mb * mb + C1) * (saa + sbb + C2))).mean())


def shot(page):
    from io import BytesIO
    return Image.open(BytesIO(page.screenshot())).convert('RGB')


def save_thumb(im, path, size):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.resize(size, Image.BILINEAR).save(path, 'JPEG', quality=72)


def rec_of(page, base, n, gap, thumb_path=None, size=THUMB):
    """n 枚撮って元の画面との SSIM の平均。1 枚目をサムネイルに保存"""
    vals = []
    for k in range(n):
        time.sleep(gap)
        im = shot(page)
        if k == 0 and thumb_path:
            save_thumb(im, thumb_path, size)
        vals.append(ssim(base, gray(im)))
    return round(sum(vals) / len(vals), 3)


# ---------- 数字 ----------

def stats(samples):
    sil = [s for s in samples if s['m'] == 'silent'][3:]
    mus = [s for s in samples if s['m'] == 'music'][3:]
    if len(sil) < 5 or len(mus) < 10:
        return None
    mean = lambda xs: sum(xs) / len(xs)

    def fold(key):
        bins = [[] for _ in range(8)]
        for s in mus:
            bins[min(7, int(s['ph'] * 8))].append(s[key])
        curve = [mean(b) for b in bins if b]
        m = mean(curve)
        return (max(curve) - min(curve)) / (m + 0.02)

    covs = sorted(s['cov'] for s in mus)
    sec = max(0.5, (mus[-1]['t'] - mus[0]['t']) / 1000)
    lum_s, lum_m = mean([s['lum'] for s in sil]), mean([s['lum'] for s in mus])
    mot_s, mot_m = mean([s['diff'] for s in sil]), mean([s['diff'] for s in mus])
    return {
        'cov': round(mean(covs), 3), 'cov90': round(covs[int(0.9 * (len(covs) - 1))], 3),
        'lumSilent': round(lum_s, 3), 'lumMusic': round(lum_m, 3),
        'motionSilent': round(mot_s, 4), 'motionMusic': round(mot_m, 4),
        'energyGain': round((lum_m - lum_s) / (max(lum_m, lum_s) + 0.01), 3),
        'motionGain': round((mot_m - mot_s) / (max(mot_m, mot_s) + 0.002), 3),
        'beatLum': round(fold('lum'), 3), 'beatMotion': round(fold('diff'), 3),
        # 画面の 5% 以上がそろって明るくなった(輝度 +0.2 以上)フレームの数/秒。光過敏の目安で、ビートごとに光ると 2 前後
        'flash': round(sum(1 for s in mus if s['up'] >= FLASH_AREA and s['up'] >= 2 * s['down']) / sec, 2),
    }


def react(r):
    # curate/logic.js の reactScore と同じ
    return max(r['energyGain'], 0) + max(r['motionGain'], 0) + r['beatLum'] + r['beatMotion']


def passes(r, th=DEFAULT_THRESHOLDS):
    # curate/logic.js の presetChecks と同じ
    return ('cov' in r and 'error' not in r and not r.get('errors') and r['recLight'] >= th['recLight'] and r['recDark'] >= th['recDark']
            and r['fps'] >= th['fps'] and r['msPerFrame'] <= th['ms'] and react(r) >= th['react'] and r.get('flash', 0) <= th['flash'])


def load_json(path, default):
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    return default


def dump_json(obj, path):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
    os.replace(tmp, path)


# ---------- ブラウザ ----------

class Bench:
    def __init__(self, pw, url):
        self.pw, self.url, self.browser = pw, url, None
        self._open()
        page = self.ctx.new_page(); page.goto(self.url)
        self.base_img = {'light': shot(page)}
        page.evaluate("() => document.body.classList.add('dark')")
        self.base_img['dark'] = shot(page); page.close()
        self.base = {k: gray(v) for k, v in self.base_img.items()}

    def _open(self):
        if self.browser:
            try: self.browser.close()
            except Exception: pass
        self.browser = self.pw.chromium.launch(headless=True)
        self.ctx = self.browser.new_context(viewport=VIEWPORT)
        self.ctx.set_default_timeout(30000)

    def save_bases(self, out):
        for theme, im in self.base_img.items():
            save_thumb(im, os.path.join(out, f'_base_{theme}.jpg'), THUMB)

    def open_preset(self, src, name, errs):
        """記事ページにプリセットを 1 本載せ、擬似音声(無音)を流した状態の page を返す。ページのエラーは errs に溜める"""
        if not self.browser.is_connected():
            self._open()
        page = self.ctx.new_page()
        warns = []  # エンジンは setup の失敗を console.warn で出す
        page.on('pageerror', lambda e: errs.append(str(e)[:200]))
        page.on('console', lambda m: m.type in ('warning', 'error') and warns.append(m.text[:200]))
        page.goto(self.url)
        page.evaluate(P5); page.evaluate(BASE); page.evaluate(src); page.evaluate(ENGINE)
        ok = page.evaluate(f'''() => {{ const e = window._vjamFxEngine; e._fadeDuration = 0;
            e.startPreset({json.dumps(name)}); e.setBlendMode('screen'); return e.activeLayers.size; }}''')
        if not ok:
            close(page)
            raise RuntimeError('preset did not start: ' + ' / '.join(warns[:2]))
        page.evaluate(HARNESS)
        self.cdp = self.ctx.new_cdp_session(page)
        return page

    def throttle(self, on):
        self.cdp.send('Emulation.setCPUThrottlingRate', {'rate': THROTTLE if on else 1})


def close(page):
    try:
        page.close()
    except Exception:
        pass  # ブラウザごと落ちていたら次の open_preset で開き直す


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k): pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=os.path.join(HERE, 'site')))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{srv.server_address[1]}/article.html'


# ---------- プリセット ----------

def measure_preset(bench, src, name, out, errs):
    page = bench.open_preset(src, name, errs)
    try:
        page.evaluate(SAMPLER)
        bench.throttle(True)
        time.sleep(1.5)  # ウォームアップ(無音)
        page.evaluate('() => { window.__vjamBench.sampling = true; }')
        time.sleep(2.0)  # 無音
        page.evaluate('''() => { const L = [...window._vjamFxEngine.activeLayers.values()][0]; const p = L.preset.p5;
            const d = window.__d = { ms: 0, n: 0, f0: p.frameCount, t0: performance.now() };
            const orig = p.redraw.bind(p);
            p.redraw = function () { const t = performance.now(); try { return orig.apply(null, arguments); }
              finally { d.ms += performance.now() - t; d.n++; } };
            window.__p = p; window.__vjamBench.setMode('music'); }''')
        time.sleep(3.0)  # 音楽(6 拍)
        perf = page.evaluate('() => { const d = window.__d; return { ms: d.ms, n: d.n, frames: window.__p.frameCount - d.f0, sec: (performance.now() - d.t0) / 1000 }; }')
        samples = page.evaluate('() => { window.__vjamBench.sampling = false; return window.__vjamBench.samples; }')
        bench.throttle(False)
        # 白ページ(既定の screen は difference で描く)→ 暗いページ(screen)
        rec = {'light': rec_of(page, bench.base['light'], 3, 0.25, os.path.join(out, f'{name}_light.jpg'))}
        page.evaluate("() => { const H = window.__vjamBench; H.setTheme(true); H.setBlend('screen'); }")
        time.sleep(0.25)
        rec['dark'] = rec_of(page, bench.base['dark'], 3, 0.25, os.path.join(out, f'{name}_dark.jpg'))
        r = stats(samples) or {'error': 'too few samples'}
        r.update({'recLight': rec['light'], 'recDark': rec['dark'],
                  'msPerFrame': round(perf['ms'] / max(1, perf['n']), 2),
                  'fps': round(perf['frames'] / perf['sec'], 1), 'errors': errs[:3]})
        return r
    finally:
        close(page)


def run_presets(bench, set_name, names):
    src_dir, out = SETS[set_name], os.path.join(OUT_ROOT, set_name)
    os.makedirs(out, exist_ok=True)
    bench.save_bases(out)
    all_names = sorted(f[:-3] for f in os.listdir(src_dir) if f.endswith('.js'))
    explicit, names = bool(names), names or all_names
    path = os.path.join(out, 'results.json')
    results = load_json(path, {})
    for idx, name in enumerate(names):
        if name in results and not explicit:
            continue
        errs = []
        try:
            r = measure_preset(bench, read(os.path.join(src_dir, f'{name}.js')), name, out, errs)
        except Exception as ex:
            r = {'error': str(ex)[:200], 'errors': errs[:3]}
        results[name] = r
        print(f"[{set_name} {idx + 1}/{len(names)}] {name}: " + (
            f"rec={r['recLight']}/{r['recDark']} cov={r['cov']:.2f} ms={r['msPerFrame']} fps={r['fps']} "
            f"eGain={r['energyGain']} mGain={r['motionGain']} beatL={r['beatLum']} beatM={r['beatMotion']}"
            if 'cov' in r else f"ERR {r.get('error')} {r.get('errors')}"), flush=True)
        if (idx + 1) % 10 == 0:
            dump_json(results, path)
    dump_json(results, path)
    bad = sorted(k for k, v in results.items() if 'error' in v)
    print(f'[{set_name}] {len(results)} 本(error {len(bad)}: {", ".join(bad)})', flush=True)


# ---------- Filter / Blend ----------

def pick_reps(n=N_REPS):
    """FX の結果から、塗り・重さ・反応がばらける n 本(真ん中 1 本 + そこから遠い順)。
    filter / blend はデフォルトプールのプリセットに掛かるので、必須条件の初期値を満たすものから選ぶ(足りなければ全部から)"""
    res = load_json(os.path.join(OUT_ROOT, 'fx', 'results.json'), {})
    measured = {k: v for k, v in res.items() if 'cov' in v and 'error' not in v and v['cov'] >= 0.05}
    ok = {k: v for k, v in measured.items() if passes(v)}
    if len(ok) < n:
        ok = measured
    if len(ok) < n:
        raise SystemExit('fx の計測結果が足りない。先に `bench_fx.py fx` を回す')
    names = sorted(ok)

    def ranks(key):
        order = sorted(names, key=key)
        return {k: i / (len(order) - 1) for i, k in enumerate(order)}
    feats = [ranks(lambda k: ok[k]['cov']), ranks(lambda k: ok[k]['msPerFrame']), ranks(lambda k: react(ok[k]))]
    pt = {k: np.array([f[k] for f in feats]) for k in names}
    reps = [min(names, key=lambda k: np.linalg.norm(pt[k] - 0.5))]
    while len(reps) < n:
        reps.append(max((k for k in names if k not in reps), key=lambda k: min(np.linalg.norm(pt[k] - pt[r]) for r in reps)))
    return reps


def find_src(name):
    for d in SETS.values():
        p = os.path.join(d, f'{name}.js')
        if os.path.exists(p):
            return p
    raise SystemExit(f'preset not found: {name}')


def run_combos(bench, reps):
    out = os.path.join(OUT_ROOT, 'combos')
    os.makedirs(out, exist_ok=True)
    bench.save_bases(out)
    path = os.path.join(out, 'results.json')
    data = load_json(path, {})
    if data.get('filters') != FILTERS or data.get('blends') != BLENDS:
        data = {'filters': FILTERS, 'blends': BLENDS, 'reps': [], 'rows': []}
    total = len(BLENDS) * len(FILTERS) * 2
    for rep in reps:
        if rep in data['reps']:
            continue
        rows, errs = [], []
        try:
            page = bench.open_preset(read(find_src(rep)), rep, errs)
        except Exception as ex:
            print(f'[combos] {rep}: ERR {ex}', flush=True)
            continue
        try:
            page.evaluate("() => window.__vjamBench.setMode('music')")
            time.sleep(1.5)
            for theme in ('light', 'dark'):
                page.evaluate(f'() => window.__vjamBench.setTheme({json.dumps(theme == "dark")})')
                for blend in BLENDS:
                    for k, css in enumerate(FILTERS):
                        page.evaluate(f'''() => {{ const H = window.__vjamBench; H.setBlend({json.dumps(blend)});
                            H.setFilter({json.dumps(css)}); }}''')
                        bench.throttle(True)
                        f0 = page.evaluate('() => [window._vjamFxEngine.currentPreset.p5.frameCount, performance.now()]')
                        time.sleep(0.8)
                        f1 = page.evaluate('() => [window._vjamFxEngine.currentPreset.p5.frameCount, performance.now()]')
                        bench.throttle(False)
                        img = f'{rep}/{theme}-{blend}-{k:02d}.jpg'
                        rec = rec_of(page, bench.base[theme], 2, 0.15, os.path.join(out, img), COMBO_THUMB)
                        rows.append({'preset': rep, 'page': theme, 'blend': blend, 'filter': css, 'rec': rec,
                                     'fps': round((f1[0] - f0[0]) / ((f1[1] - f0[1]) / 1000), 1), 'img': img})
                        if len(rows) % 25 == 0:
                            print(f'[combos] {rep}: {len(rows)}/{total}', flush=True)
            data['rows'] += rows
            data['reps'].append(rep)
            dump_json(data, path)
            print(f'[combos] {rep}: done ({len(rows)} rows, errors={errs[:2]})', flush=True)
        except Exception as ex:
            print(f'[combos] {rep}: ERR {str(ex)[:200]}', flush=True)
        finally:
            close(page)
    dump_json(data, path)


def main():
    args = sys.argv[1:]
    if not args or args[0] not in ('fx', 'candidates', 'combos', 'all'):
        print(__doc__); sys.exit(1)
    cmd, rest = args[0], args[1:]
    srv, url = serve()
    try:
        with sync_playwright() as pw:
            bench = Bench(pw, url)
            if cmd in ('fx', 'candidates'):
                run_presets(bench, cmd, rest)
            if cmd == 'all':
                run_presets(bench, 'fx', [])
                run_presets(bench, 'candidates', [])
            if cmd in ('combos', 'all'):
                reps = rest[1].split(',') if len(rest) == 2 and rest[0] == '--reps' else pick_reps()
                print('[combos] reps: ' + ', '.join(reps), flush=True)
                run_combos(bench, reps)
            bench.browser.close()
    finally:
        srv.shutdown()


if __name__ == '__main__':
    main()
