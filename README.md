# job-xray

[Website](https://jobxray.ru) · [Source](https://github.com/tommyknocker/job-xray) · [Changelog](CHANGELOG.md) · [Latest release](https://github.com/tommyknocker/job-xray/releases/latest)

[![Chrome](https://img.shields.io/badge/Chrome-Chromium-4285F4?logo=googlechrome&logoColor=white)](https://github.com/tommyknocker/job-xray/releases/latest/download/job-xray-chromium.zip)
[![Edge](https://img.shields.io/badge/Edge-Chromium-0078D7?logo=microsoftedge&logoColor=white)](https://github.com/tommyknocker/job-xray/releases/latest/download/job-xray-chromium.zip)
[![Opera](https://img.shields.io/badge/Opera-Chromium-FF1B2D?logo=opera&logoColor=white)](https://github.com/tommyknocker/job-xray/releases/latest/download/job-xray-chromium.zip)
[![Firefox](https://img.shields.io/badge/Firefox-Gecko-FF7139?logo=firefoxbrowser&logoColor=white)](https://github.com/tommyknocker/job-xray/releases/latest/download/job-xray-firefox.xpi)
[![Release](https://img.shields.io/github/v/release/tommyknocker/job-xray)](https://github.com/tommyknocker/job-xray/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Browser extension that surfaces hidden response counters on hh.ru.

On the homepage, search results, and vacancy pages it reads `#HH-Lux-InitialState` and renders badges: total responses, unread queue (search and homepage), responses per day, age from creation date, and a “bumped” flag when publication is newer than creation. Badge labels are Russian (`extension/src/copy.ru.js`); repo docs and source comments are English.

## Download

These URLs always point at the latest GitHub Release (`/releases/latest/download/…`). Asset names stay fixed, so a site can hardcode them.

| | URL |
|---|---|
| **Website** | https://jobxray.ru |
| **Chromium** (Chrome, Edge, Opera, Brave, Vivaldi, Yandex Browser) | https://github.com/tommyknocker/job-xray/releases/latest/download/job-xray-chromium.zip |
| **Firefox** | https://github.com/tommyknocker/job-xray/releases/latest/download/job-xray-firefox.xpi |
| **Checksums** | https://github.com/tommyknocker/job-xray/releases/latest/download/SHA256SUMS |
| **Source (this repo)** | https://github.com/tommyknocker/job-xray |
| **Source zip (`main`)** | https://github.com/tommyknocker/job-xray/archive/refs/heads/main.zip |

Safari needs a separate Xcode wrapper. Not built.

Firefox cannot load ES modules as `content_scripts`, so the release package is a single classic `content.js` bundle. Source stays modular under `extension/src/`.

## Install from source (Chrome / Edge / Opera)

1. Open `chrome://extensions/` (Edge: `edge://extensions/`, Opera: `opera://extensions/`)
2. Enable **Developer mode**
3. **Load unpacked** → `extension/`

`loader.js` is a classic content script that `import()`s `src/content.js`. Chrome still wraps declared content scripts as classic files, so `"type": "module"` in the manifest is not used.

## Install a built package

```bash
npm run build
```

Output lives in `dist/`:

- unpacked: `dist/chromium/`, `dist/firefox/`
- archives: versioned names plus stable aliases (`job-xray-chromium.zip`, `job-xray-firefox.xpi`)
- `dist/SHA256SUMS`

Load unpacked from `dist/<engine>/`, or install the zip/xpi.

Firefox: `about:debugging` → **This Firefox** → **Load Temporary Add-on** → `dist/firefox/manifest.json`.

## Tests and Firefox bundle check

Parser tests need a local `data/` folder with saved HTML snapshots (not in git).

```bash
npm test
```

`npm test` also runs `npm run check`: it simulates the Firefox concatenated `content.js` (classic script, no `import`) and fails on duplicate top-level names or syntax errors — the same class of issues AMO reports. `npm run build` runs the same check before writing `dist/`.

Before you push (or automatically via `git push` after `npm ci`), run **`npm run validate`**: `npm ci` deps present, fixture tests, Firefox bundle check, and release build — same as GitHub Actions. Full HTML regression tests need a local gitignored `data/` folder; CI skips them when `data/` is absent.

## GitHub releases

Tag `v0.1.5` (must match `package.json` version) and push. CI builds the packages and attaches them to the GitHub Release under the stable names above.

After tagging, add the same release notes to [job-xray-site](https://github.com/tommyknocker/job-xray-site) (`data/changelog.php`, `config/site.php`). See [CHANGELOG.md](CHANGELOG.md).
