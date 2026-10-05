# App Review への返信(2026-10、Guideline 2.1 Information Needed)

1.1.0(1)の初回審査で、実機の録画と次の 1〜6 を求められた(開発者アカウントの審査履歴が少ないため)。
App Store Connect の App Review のページで返信し、同じ文を「App Review に関する情報」のメモにも足す。

## 録画(人が iPad で撮る)
- 最新の iPadOS の実機で、画面収録(コントロールセンター → 画面収録)
- アプリを起動するところから始める:VJam FX アプリ → 設定でオンにする手順 → Safari で https://infohiroki.github.io/vjam-fx/demo/ → Play → ぁあ → VJam FX → スイッチ ON → エフェクトが音に合わせて動く → Next → Manual を開いてエフェクトを 1 つ選ぶ → OFF
- 1〜2 分。ログイン・課金・ユーザー投稿は無いので不要

## 返信の文(英語)

```text
Thank you for the review. Please find the screen recording attached (iPad, latest iPadOS). It starts by launching the app and shows the typical flow: turning on the Safari extension, opening a web page with music, turning VJam FX on, and the effects reacting to the beat.

1. Screen recording
Attached. The app has no account, login, purchase or user-generated content.

2. Purpose and target audience
VJam FX is a free Safari web extension that lays music-reactive VJ (video jockey) visuals over any web page. It is for people who listen to music or watch music videos in Safari and want a light show on their screen, for example at home or at a small party. It turns the page into a VJ stage without extra hardware, cables or a microphone: the visuals follow the beat of the sound that the page itself is playing.

3. How to set up and use the main features
- Open the VJam FX app once. It shows the steps below.
- Settings > Apps > Safari > Extensions > VJam FX: turn it on and set "All Websites" to "Allow".
- In Safari, open our test page https://infohiroki.github.io/vjam-fx/demo/ (an original drum loop, no third-party content) and tap Play. Any web page with a video or music also works.
- Tap the page menu button (AA) in the address bar, then VJam FX, and turn on the switch. Auto mode starts and the effects change with the beat. The panel shows the detected BPM.
- "Next" picks a new set of effects. "Manual" lets you choose effects, filters and blend modes, and save scenes.
- No login or sample files are needed.

4. External services
None for the core functionality. All effects (including the p5.js library) are packaged in the app, and the sound is analyzed on the device. The only network requests are: loading the audio segments of an HLS stream the page is already playing (from the same address, to read the beat), and Google Fonts when the user picks a decorative font in the optional Text feature. There are no analytics, ads, accounts or AI services. The support and privacy policy pages are hosted on GitHub Pages.

5. Regional differences
None. The app works the same in all regions where it is available.

6. Regulated industry / protected material
Not applicable. The app does not provide any third-party content. It only draws visual effects over pages the user opens in Safari, and does not record, store or redistribute their audio or video.
```
