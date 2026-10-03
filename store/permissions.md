# Chrome ウェブストア — プライバシーへの取り組み(権限の説明)

デベロッパー ダッシュボードの「プライバシーへの取り組み」タブに貼る文面(英語)。v1.1.0 の `manifest.json` に合わせてある。

v1.0.2 から増えた権限は `optional_host_permissions: ["<all_urls>"]` だけ。
使っているのは popup の **All tabs**(設定・チップ)だけで、ON にするクリックの中で `chrome.permissions.request` を 1 回出す(断られたら OFF のまま。`popup/popup.js`)。
許可があると、Service Worker がタブを切り替えた・開いたときに前のタブへ同じエフェクトを入れ、同じウィンドウで裏に回ったタブを止める(`background/service-worker.js` の `followTab` / `stopTab`)。

## 単一用途(Single purpose)

```text
VJam FX overlays music-reactive VJ visual effects on the web page you are viewing. It reads the sound of the video or music playing on the page to find the beat, and moves the visuals with it.
```

## 権限が必要な理由(Permission justification)

### activeTab

```text
Lets VJam FX draw its effects on the tab you are on, after you click the toolbar icon and turn it on. It does not touch other tabs.
```

### scripting

```text
Injects the effects engine (p5.js and the effect files packaged with the extension) into the current page, and passes it your commands from the popup (on/off, Next, Auto, blend, filters, opacity, scenes, text).
```

### webNavigation

```text
When you move to another page of the same site in a tab where VJam FX is on, VJam FX puts the same effects back on the new page.
```

### tabCapture

```text
Fallback for beat detection. VJam FX first reads the sound from the page's video or audio element; when the page does not allow that, it captures the tab's audio instead. Only the tab you turned VJam FX on in is captured, and the audio is analyzed on the device. It is never recorded, stored or sent.
```

### offscreen

```text
The captured tab audio is analyzed in an offscreen document, because a service worker cannot run the Web Audio API. Only the beat and loudness values go back to the page.
```

### storage

```text
Saves your settings, your 12 scenes and the list of effects that are too heavy for your computer in local storage, and which tabs have effects on in session storage. Nothing leaves the device.
```

### ホスト権限(Host permission)

ダッシュボードの欄は 1 つ。ホスト権限として数えられるのは 2 つ:

- `content_scripts`(`https://*/*` / `http://*/*`)の `content/audio-bridge.js` — v1.0.2 からある
- `optional_host_permissions: ["<all_urls>"]` — v1.1.0 で増えた(All tabs)

```text
1) A small content script (audio-bridge.js) runs on http and https pages. It only passes messages between the extension and its own effects engine on the page: beat data from the tab audio capture, start/stop of the capture, effects that are too heavy for the computer, and loading effect files. It does not read or change the page.

2) Access to all sites is optional. VJam FX asks for it only when you turn on "All tabs", and Chrome shows its permission prompt (if you decline, the option stays off). With it, VJam FX puts the same effects on the tab you switch to or open, and pauses them in tabs that go to the background. Without it, VJam FX runs only on the tab where you click its icon.
```

## リモートコード(Are you using remote code?)

**No** を選ぶ。

```text
No. All JavaScript, including p5.js and every effect, is packaged in the extension.
```

Text の飾り文字だけ Google Fonts の CSS とフォントを読み込む(`content/text-overlay.js`)。コード(JS / Wasm)ではない。

## データの使用(Data usage)

- 集めるデータ:どれにもチェックしない(何も集めない・送らない)
- 下の 3 つの宣言(第三者に売らない・単一用途と関係のない目的に使わない・信用力の判断に使わない)にはチェックを入れる
- プライバシー ポリシーの URL:https://infohiroki.github.io/vjam-fx/privacy-policy.html
