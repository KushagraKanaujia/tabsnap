# ⚡ TabSnap

**A Chrome extension that picks a better tab to focus when you close the one you're on.**

[![Live demo](https://img.shields.io/badge/live_demo-kush--tabsnap.netlify.app-4caf50?logo=netlify&logoColor=white)](https://kush-tabsnap.netlify.app)
[![Download](https://img.shields.io/badge/download-tabsnap--v1.1.0.zip-blue?logo=googlechrome&logoColor=white)](https://github.com/KushagraKanaujia/tabsnap/releases/download/v1.1.0/tabsnap-v1.1.0.zip)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-orange)](manifest.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

## Try it in one click

- **See it without installing:** open the **[live demo](https://kush-tabsnap.netlify.app)**. It runs the extension's real strategy code on a pretend tab bar, so you can close tabs and compare where Chrome would send you with where TabSnap does.
- **Install it (about 30 seconds):**
  1. [Download `tabsnap-v1.1.0.zip`](https://github.com/KushagraKanaujia/tabsnap/releases/download/v1.1.0/tabsnap-v1.1.0.zip) and unzip it. You get a `tabsnap` folder.
  2. Open `chrome://extensions` and turn on **Developer mode** (top right).
  3. Click **Load unpacked** and pick the `tabsnap` folder. Click the ⚡ toolbar icon to choose a strategy.

Works in Chrome and other Chromium browsers (Edge, Brave, Arc). It is not on the Chrome Web Store yet.

## What it does

When you close the tab you're looking at, Chrome usually jumps to the tab on its right, even if you never used that tab. TabSnap steps in right after the close and focuses a tab chosen by one of three strategies:

| Strategy | Which tab gets focus |
| --- | --- |
| **Proximity** | The closed tab's neighbour. If both the left and right neighbour qualify, the one you used more recently. |
| **LRU** | The tab you used most recently, wherever it sits in the tab bar. |
| **Hybrid** (default) | Proximity, unless that neighbour hasn't been used for more than 5 minutes; then the most recently used tab. |

Closing a **background** tab never changes which tab you're on. The popup also shows how many times TabSnap changed the focus away from Chrome's own pick.

## How it works

- `strategies.js`: the three strategies as pure functions (no `chrome.*` calls). The service worker, the unit tests and the landing-page demo all use this same file.
- `background.js`: the MV3 service worker. It records when each tab was last activated (`chrome.storage.local`) and which tab is active in each window, with its index (`chrome.storage.session`, so it survives the worker going to sleep). When the active tab is closed it takes a snapshot of that state, waits ~50 ms for Chrome's default focus to land, then activates the strategy's pick if it differs.
- `popup.html` / `popup.js`: the settings popup. The chosen strategy syncs through your Chrome profile (`chrome.storage.sync`).

Permissions: `tabs` and `storage` only. No content scripts and no network requests.

### Fixed in v1.1.0

An end-to-end test in real Chrome (`tests/e2e.mjs`) found these issues in v1.0.0, and they are fixed here:

- Closing a background tab could steal focus from the tab you were on.
- Proximity compared the closed tab's old index against the already-shifted indices, so it always chose the right neighbour (the same as Chrome's default) and never broke ties by recent use.
- LRU could count Chrome's own default pick as "most recently used", so it often agreed with Chrome instead of going back to your previous tab.

## Tech stack

Chrome Extension Manifest V3 · plain JavaScript (no build step) · Node's built-in test runner · Puppeteer for end-to-end tests · landing page in plain HTML with [Pico CSS](https://picocss.com), deployed on Netlify.

## Run locally

```bash
git clone https://github.com/KushagraKanaujia/tabsnap.git
cd tabsnap
```

Then load the folder with **Load unpacked** in `chrome://extensions` (steps above). There is nothing to build.

Development commands (Node 18+):

```bash
npm test                         # unit tests for strategies.js
npm install                      # installs Puppeteer for the e2e test
npx puppeteer browsers install chrome
npm run test:e2e                 # loads the extension into Chrome for Testing and closes real tabs
npm run package                  # -> dist/tabsnap-v<version>.zip
npm run build:site               # -> site-dist/ (landing page + live demo)
```

To debug, open `chrome://extensions`, find TabSnap and click **Inspect views: service worker**. Each redirect logs `TabSnap: Focused tab <id> using <strategy> strategy`.

Icons are generated with `python3 generate_icons.py` (needs Pillow).

### Project structure

```
tabsnap/
├── manifest.json        # Extension manifest (V3)
├── background.js        # Service worker: tracks tabs, applies the strategy
├── strategies.js        # Pure strategy logic (shared by worker, tests, demo)
├── popup.html / .js     # Settings popup
├── icons/               # 16 / 48 / 128 px icons
├── site/                # Landing page + interactive demo (Netlify)
├── tests/               # Unit tests + Puppeteer end-to-end test
├── scripts/             # package.sh (release zip), build-site.sh
└── generate_icons.py
```

## Roadmap

- [ ] Exclude certain tabs from focus (e.g. pinned tabs)
- [ ] Per-window strategy override
- [ ] Customizable LRU timeout
- [ ] Tab-group awareness (stay within the group)
- [ ] Chrome Web Store listing

## Contributing

Issues and pull requests are welcome. For focus bugs, please include your Chrome version, the tab layout and which tab you closed. Run `npm test` (and ideally `npm run test:e2e`) before opening a PR.

## Credits

- [Pico CSS](https://github.com/picocss/pico) (MIT): styling for the landing page, loaded from jsDelivr.
- [Puppeteer](https://github.com/puppeteer/puppeteer) (Apache-2.0): end-to-end tests in Chrome for Testing.
- [Shields.io](https://shields.io) (CC0): README badges.

## License

[MIT](LICENSE)
