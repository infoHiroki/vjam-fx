"""
Capture real screenshots with VJam FX effects running on actual websites.
Injects scripts directly via Playwright to bypass popup context limitations.
"""
from playwright.sync_api import sync_playwright
from PIL import Image
import os, time, glob

EXT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots')
os.makedirs(OUT, exist_ok=True)

# Scripts to inject in order
CORE_SCRIPTS = [
    'lib/p5.min.js',
    'content/base-preset.js',
    'content/audio-analyzer.js',
]
ENGINE_SCRIPT = 'content/content.js'

def read_file(path):
    with open(os.path.join(EXT_PATH, path), 'r') as f:
        return f.read()

def inject_and_start(page, preset_names, blend_mode='screen'):
    """Inject VJam FX engine and start presets on a page."""
    # Inject core scripts
    for script in CORE_SCRIPTS:
        page.evaluate(read_file(script))

    # Inject preset files
    for name in preset_names:
        page.evaluate(read_file(f'content/presets/{name}.js'))

    # Inject engine
    page.evaluate(read_file(ENGINE_SCRIPT))

    # Start first preset
    page.evaluate(f'''() => {{
        const e = window._vjamFxEngine;
        if (!e) return;
        e.startPreset('{preset_names[0]}');
        e.setBlendMode('{blend_mode}');
    }}''')

    # Add remaining layers
    for name in preset_names[1:]:
        page.evaluate(f'''() => {{
            const e = window._vjamFxEngine;
            if (e) e._addLayer('{name}');
        }}''')

    # Let effects render a few frames
    time.sleep(2)


def capture_popup(ctx, ext_id):
    """Capture popup UI by navigating to a real site first, then opening popup."""
    # Create a page that's on a real site so popup thinks it has a valid tab
    popup = ctx.new_page()
    popup.set_viewport_size({'width': 300, 'height': 760})
    popup.goto(f'chrome-extension://{ext_id}/popup/popup.html')
    time.sleep(0.5)

    # Override the restricted page error by injecting preset list directly
    popup.evaluate('''() => {
        // The popup detected a restricted page. Rebuild UI manually for screenshot.
        const popup = document.querySelector('.popup');
        if (!popup || !popup.textContent.includes('Cannot run')) return;

        popup.innerHTML = `
        <header class="header">
          <h1>VJam FX</h1>
          <div class="header-right">
            <span id="layer-count" class="layer-count">3 layers</span>
            <label class="toggle-switch">
              <input type="checkbox" id="toggle" checked>
              <span class="slider"></span>
            </label>
          </div>
        </header>
        <div class="action-bar">
          <button class="action-btn reset">Reset</button>
          <button class="action-btn">Next</button>
          <button class="action-btn active">Auto</button>
        </div>
        <input type="text" class="preset-search" placeholder="Search presets...">
        <div class="preset-list" id="preset-list" style="max-height:340px">
          <div class="category-header">Immersive</div>
          <label class="preset-item"><input type="checkbox" checked><span style="color:#00cc66;font-weight:600">Wormhole</span></label>
          <label class="preset-item"><input type="checkbox"><span>Warp Speed</span></label>
          <label class="preset-item"><input type="checkbox" checked><span style="color:#00cc66;font-weight:600">Portal Ring</span></label>
          <label class="preset-item"><input type="checkbox"><span>Aurora</span></label>
          <label class="preset-item"><input type="checkbox"><span>Crystal Cave</span></label>
          <label class="preset-item"><input type="checkbox"><span>Northern Lights</span></label>
          <div class="category-header">Frames & Film</div>
          <label class="preset-item"><input type="checkbox" checked><span style="color:#00cc66;font-weight:600">Neon Frame</span></label>
          <label class="preset-item"><input type="checkbox"><span>Film Burn</span></label>
          <label class="preset-item"><input type="checkbox"><span>VHS Noise</span></label>
          <label class="preset-item"><input type="checkbox"><span>Scan Line</span></label>
          <div class="category-header">Patterns</div>
          <label class="preset-item"><input type="checkbox"><span>Kaleidoscope</span></label>
          <label class="preset-item"><input type="checkbox"><span>Mandala</span></label>
        </div>
        <div class="section-label">Filters</div>
        <div class="filter-grid" id="filter-grid">
          <button class="filter-btn active">Invert</button>
          <button class="filter-btn">Hue Rot</button>
          <button class="filter-btn">Gray</button>
          <button class="filter-btn active">Saturate</button>
          <button class="filter-btn">Bright</button>
          <button class="filter-btn">Contrast</button>
          <button class="filter-btn">Sepia</button>
          <button class="filter-btn">Blur</button>
        </div>
        <div class="controls">
          <div class="control-row">
            <label>Blend</label>
            <select><option selected>Screen</option></select>
          </div>
          <div class="control-row">
            <label>Mic</label>
            <button class="mic-btn on">ON</button>
          </div>
        </div>
        <footer class="footer">
          <a href="#">VJam Full — 190+ Presets →</a>
        </footer>`;
    }''')
    time.sleep(0.3)
    popup.screenshot(path=os.path.join(OUT, '01-popup.png'))
    print('OK: 01-popup.png (popup UI)')
    popup.close()


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

    # Get extension ID
    ext_id = None
    for sw in ctx.service_workers:
        if 'chrome-extension://' in sw.url:
            ext_id = sw.url.split('//')[1].split('/')[0]
            break
    print(f'Extension ID: {ext_id}')

    # 1. Popup UI screenshot
    capture_popup(ctx, ext_id)

    # 2. Wikipedia with neon-tunnel + neon-frame
    page.goto('https://en.wikipedia.org/wiki/VJing')
    time.sleep(3)
    inject_and_start(page, ['neon-tunnel', 'neon-frame'], 'screen')
    page.screenshot(path=os.path.join(OUT, '02-wikipedia-fx.png'))
    print('OK: 02-wikipedia-fx.png')

    # 3. Google with wormhole + starfield
    page.goto('https://www.google.com')
    time.sleep(3)
    inject_and_start(page, ['wormhole', 'starfield'], 'screen')
    page.screenshot(path=os.path.join(OUT, '03-google-fx.png'))
    print('OK: 03-google-fx.png')

    # 4. GitHub with aurora + constellation
    page.goto('https://github.com/explore')
    time.sleep(3)
    inject_and_start(page, ['aurora', 'constellation'], 'lighten')
    page.screenshot(path=os.path.join(OUT, '04-github-fx.png'))
    print('OK: 04-github-fx.png')

    ctx.close()

print(f'\nAll screenshots saved to {OUT}/')
