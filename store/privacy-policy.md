# Privacy Policy — VJam FX

**Last updated: October 3, 2026**

## What VJam FX Does

VJam FX overlays visual effects on webpages. It is available as a Chrome extension and as a Safari extension for iPad and iPhone (the VJam FX app). It reads the audio of the video or music playing on the page to detect beats and sync the visual effects to the music — no microphone needed.

## Data Collection

**VJam FX collects no data.** Specifically:

- **No personal information** is collected, stored, or transmitted
- **No browsing history** is accessed or recorded
- **No analytics or tracking** of any kind
- **No cookies** are set
- **No third-party services** are used
- **Nothing is sent anywhere.** VJam FX has no server and never sends data to us or to anyone else. Apart from loading its own files, the only network requests it makes are in Safari, where it may download a video's audio segments again from the same address the page is already streaming the video from (see "Safari" below)

## Audio Capture

The audio is used only to find the beat and the loudness of the bass, mids and treble.

### Chrome

VJam FX uses two methods to capture audio for beat detection — **no microphone is required**:

1. **Video/Audio Element Capture** (primary): Uses `createMediaElementSource` to capture audio directly from `<video>` and `<audio>` elements on the page. This is completely silent — no recording indicator is shown.

2. **Tab Audio Capture** (fallback): If video element audio is unavailable (e.g., CORS/MSE restrictions), the extension falls back to capturing the tab's audio output via `tabCapture`. This may show a recording indicator in the browser.

### Safari (iPad and iPhone)

Safari does not let extensions capture a tab's audio, so the Safari version reads the audio data that the page itself plays — **no microphone is required**:

1. **Streaming video (MediaSource)**: When a page plays a video through Media Source Extensions, VJam FX reads a copy of the audio data that the page passes to Safari. The original data is passed on unchanged. So that the beat is ready when you turn the effects on, VJam FX keeps a copy of the most recent audio data (up to 8 MB) in the page's memory from when the page loads, on the websites you have allowed VJam FX to access. It is decoded and analyzed only while the effects are on, and it is discarded when you leave the page.

2. **Standard HLS video**: When a page plays a standard HLS stream (`.m3u8`) directly in the video element, VJam FX downloads the stream's audio segments again from the same address the video is played from, and reads them. It does this only while the effects are on and the video is playing. Live and encrypted streams are skipped.

### In all cases

- Audio is analyzed **entirely locally** on your device
- Audio data is processed in real-time for beat detection and frequency analysis
- **No audio is recorded, stored, or transmitted** anywhere. The analysis is kept only in the page's memory and is discarded when you leave the page

## Permissions

### Chrome

- **activeTab**: Allows the extension to inject visual effects into the current tab only when you click the extension icon. No access to other tabs.
- **scripting**: Required to inject the visual effects engine (p5.js canvas) into the webpage.
- **webNavigation**: Used to maintain visual effects when you navigate within a website.
- **tabCapture**: Used to capture tab audio for beat detection when video element audio is unavailable. Audio is processed locally only.
- **offscreen**: Required to create an offscreen document for processing tab audio capture data.
- **storage**: Used to save your scene configurations (preset selections, blend modes, filter settings) locally in your browser.

### Safari

- **activeTab**, **scripting**, **webNavigation**, **storage**: Same as Chrome. `tabCapture` and `offscreen` are not used.
- **Access to websites**: The Safari version runs a small script at the start of each page (`document_start`) so it can read the audio data of the video from the beginning (see "Safari" above). You choose which websites VJam FX can access in Settings › Apps › Safari › Extensions › VJam FX.
- The VJam FX app itself only shows how to turn on and use the extension. It collects nothing.

## Data Storage

VJam FX stores your effect settings and scene configurations (selected presets, blend mode, filter choices, saved scenes) and a list of effects that are too heavy for your device only in the extension's local storage on your device (`storage.local`). Which effects are on in each tab is kept in session storage and cleared when the browser closes. This data never leaves your device.

## Changes

If this policy changes, the updated version will be included with the extension update.

## Contact

For questions about this privacy policy: vjam.contact@gmail.com
