# Privacy Policy — VJam FX

**Last updated: February 28, 2026**

## What VJam FX Does

VJam FX is a Chrome extension that overlays visual effects on webpages. It captures audio directly from video/audio elements on the page to detect beats and sync visual effects to music — no microphone needed.

## Data Collection

**VJam FX collects no data.** Specifically:

- **No personal information** is collected, stored, or transmitted
- **No browsing history** is accessed or recorded
- **No analytics or tracking** of any kind
- **No cookies** are set
- **No third-party services** are used
- **No network requests** are made (except loading the extension's own files)

## Audio Capture

VJam FX uses two methods to capture audio for beat detection — **no microphone is required**:

1. **Video/Audio Element Capture** (primary): Uses `createMediaElementSource` to capture audio directly from `<video>` and `<audio>` elements on the page. This is completely silent — no recording indicator is shown.

2. **Tab Audio Capture** (fallback): If video element audio is unavailable (e.g., CORS/MSE restrictions), the extension falls back to capturing the tab's audio output via `tabCapture`. This may show a recording indicator in the browser.

In both cases:
- Audio is analyzed **entirely locally** in your browser using the Web Audio API
- Audio data is processed in real-time for beat detection and frequency analysis
- **No audio is recorded, stored, or transmitted** anywhere
- Audio capture is active only while effects are running

## Permissions

- **activeTab**: Allows the extension to inject visual effects into the current tab only when you click the extension icon. No access to other tabs.
- **scripting**: Required to inject the visual effects engine (p5.js canvas) into the webpage.
- **webNavigation**: Used to maintain visual effects when you navigate within a website.
- **tabCapture**: Used to capture tab audio for beat detection when video element audio is unavailable. Audio is processed locally only.
- **offscreen**: Required to create an offscreen document for processing tab audio capture data.
- **storage**: Used to save your scene configurations (preset selections, blend modes, filter settings) locally in your browser.

## Data Storage

VJam FX stores your effect settings and scene configurations (selected presets, blend mode, filter choices, saved scenes) locally in your browser's extension storage. This data never leaves your device.

## Changes

If this policy changes, the updated version will be included with the extension update.

## Contact

For questions about this privacy policy: vjam.contact@gmail.com
