"""
V2: Dark-themed sites for better effect visibility.
"""
from playwright.sync_api import sync_playwright
import os, time

EXT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots')
os.makedirs(OUT, exist_ok=True)

def read_file(path):
    with open(os.path.join(EXT_PATH, path), 'r') as f:
        return f.read()

CORE_SCRIPTS = ['lib/p5.min.js', 'content/base-preset.js']

def inject_and_start(page, preset_names, blend='screen', filters=None):
    for s in CORE_SCRIPTS:
        page.evaluate(read_file(s))
    for name in preset_names:
        page.evaluate(read_file(f'content/presets/{name}.js'))
    page.evaluate(read_file('content/content.js'))

    page.evaluate(f'''() => {{
        const e = window._vjamFxEngine;
        if (!e) return;
        e.startPreset('{preset_names[0]}');
        e.setBlendMode('{blend}');
    }}''')
    for name in preset_names[1:]:
        page.evaluate(f'''() => {{
            if (window._vjamFxEngine) window._vjamFxEngine._addLayer('{name}');
        }}''')
    if filters:
        for f in filters:
            page.evaluate(f'''() => {{
                if (window._vjamFxEngine) window._vjamFxEngine.setFilter('{f}', true);
            }}''')
    # Let p5 render several frames
    time.sleep(3)

with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(
        user_data_dir='',
        headless=False,
        args=[
            f'--disable-extensions-except={EXT_PATH}',
            f'--load-extension={EXT_PATH}',
            '--no-first-run',
            '--disable-default-apps',
        ],
        viewport={'width': 1280, 'height': 800},
    )
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    time.sleep(2)

    # 2. Google (dark, works well with screen blend)
    page.goto('https://www.google.com')
    time.sleep(2)
    inject_and_start(page, ['wormhole', 'neon-frame'], 'screen', ['hue-rotate'])
    page.screenshot(path=os.path.join(OUT, '02-google-fx.png'))
    print('OK: 02-google-fx.png')

    # 3. Spotify Web (dark theme)
    page.goto('https://open.spotify.com')
    time.sleep(4)
    inject_and_start(page, ['aurora', 'starfield'], 'screen')
    page.screenshot(path=os.path.join(OUT, '03-spotify-fx.png'))
    print('OK: 03-spotify-fx.png')

    # 4. MDN Web Docs dark theme
    page.goto('https://developer.mozilla.org/en-US/')
    time.sleep(3)
    inject_and_start(page, ['kaleidoscope', 'portal-ring'], 'screen', ['saturate'])
    page.screenshot(path=os.path.join(OUT, '04-mdn-fx.png'))
    print('OK: 04-mdn-fx.png')

    # 5. Reddit dark
    page.goto('https://www.reddit.com')
    time.sleep(3)
    inject_and_start(page, ['helix-tunnel', 'northern-lights'], 'screen')
    page.screenshot(path=os.path.join(OUT, '05-reddit-fx.png'))
    print('OK: 05-reddit-fx.png')

    ctx.close()

print(f'\nDone! Screenshots in {OUT}/')
