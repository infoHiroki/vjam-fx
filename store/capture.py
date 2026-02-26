"""
Capture Chrome Web Store screenshots from promo.html
Each slide = 1280x800 PNG
"""
from playwright.sync_api import sync_playwright
import os

DIR = os.path.dirname(os.path.abspath(__file__))
HTML = f'file://{DIR}/promo.html'
OUT = os.path.join(DIR, 'screenshots')
os.makedirs(OUT, exist_ok=True)

SLIDES = [
    ('slide1', '01-hero.png'),
    ('slide2', '02-features.png'),
    ('slide3', '03-categories.png'),
    ('slide4', '04-privacy.png'),
]

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto(HTML)
    page.wait_for_load_state('networkidle')

    for slide_id, filename in SLIDES:
        # Hide all slides, show target
        page.evaluate('''(id) => {
            document.querySelectorAll('.slide').forEach(s => s.style.display = 'none');
            document.getElementById(id).style.display = 'flex';
        }''', slide_id)
        page.wait_for_timeout(200)
        page.screenshot(path=os.path.join(OUT, filename))
        print(f'OK: {filename}')

    browser.close()

print(f'\nAll screenshots saved to {OUT}/')
