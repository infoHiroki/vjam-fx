"""
Take Chrome Web Store screenshots with VJam FX extension loaded.
Requires: playwright (pip install playwright && playwright install chromium)
"""
import subprocess, time, os
from playwright.sync_api import sync_playwright

EXT_PATH = os.path.abspath(os.path.dirname(__file__) + '/..')
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), 'screenshots')
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# Chrome Web Store: 1280x800 or 640x400
WIDTH = 1280
HEIGHT = 800

def take_screenshots():
    with sync_playwright() as pw:
        # Launch Chrome with extension loaded
        context = pw.chromium.launch_persistent_context(
            user_data_dir='',
            headless=False,
            args=[
                f'--disable-extensions-except={EXT_PATH}',
                f'--load-extension={EXT_PATH}',
                '--no-first-run',
                '--disable-default-apps',
            ],
            viewport={'width': WIDTH, 'height': HEIGHT},
        )

        page = context.pages[0] if context.pages else context.new_page()

        # Get extension ID
        # Wait for service worker to register
        time.sleep(2)

        # Find extension ID from service workers
        bg_pages = context.service_workers
        ext_id = None
        for sw in bg_pages:
            if 'chrome-extension://' in sw.url:
                ext_id = sw.url.split('//')[1].split('/')[0]
                break

        if not ext_id:
            print("Could not find extension ID, trying background pages...")
            # Try background pages
            for bp in context.background_pages:
                if 'chrome-extension://' in bp.url:
                    ext_id = bp.url.split('//')[1].split('/')[0]
                    break

        print(f"Extension ID: {ext_id}")

        # Screenshot 1: Popup UI on a dark page
        page.goto('https://en.wikipedia.org/wiki/Visual_jockey')
        time.sleep(2)

        # Open popup as a page (Chrome extensions can't screenshot popups directly)
        popup_url = f'chrome-extension://{ext_id}/popup/popup.html'
        popup_page = context.new_page()
        popup_page.set_viewport_size({'width': 320, 'height': 700})
        popup_page.goto(popup_url)
        time.sleep(1)
        popup_page.screenshot(path=os.path.join(SCREENSHOTS_DIR, '01-popup-ui.png'))
        print("Screenshot 1: Popup UI")
        popup_page.close()

        # Screenshot 2: Wikipedia with effect description overlay
        page.goto('https://en.wikipedia.org/wiki/VJing')
        time.sleep(2)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, '02-wikipedia-page.png'))
        print("Screenshot 2: Wikipedia page (base)")

        # Screenshot 3: Dark themed site
        page.goto('https://soundcloud.com/discover')
        time.sleep(2)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, '03-soundcloud-page.png'))
        print("Screenshot 3: SoundCloud page (base)")

        # Screenshot 4: Google
        page.goto('https://www.google.com')
        time.sleep(2)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, '04-google-page.png'))
        print("Screenshot 4: Google page (base)")

        context.close()

    print(f"\nScreenshots saved to {SCREENSHOTS_DIR}/")
    print("Note: Effects cannot be auto-activated via Playwright (extension popup context).")
    print("For full screenshots with effects, load extension manually and capture.")

if __name__ == '__main__':
    take_screenshots()
