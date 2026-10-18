# Changelog

All notable changes to **job-xray** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Version numbers match `package.json`, extension manifests, and Git tags (`v*`). Website copy lives in [job-xray-site](https://github.com/tommyknocker/job-xray-site) (`data/changelog.php`).

## [0.1.2] - 2026-10-18

### Added

- Vacancy panel: **?** help next to the job-xray caption (legend for chips: tariffs, age, rates, tones, counters).

### Changed

- Response rate for listings younger than 24 hours: show **per hour** (`N/час`) instead of extrapolated **per day**, which misread on “сегодня” vacancies.

## [0.1.1] - 2026-10-18

### Fixed

- Firefox package: `strict_min_version` 140 (desktop) and 142 (Android) so `data_collection_permissions` matches AMO validation.

### Changed

- Tooltips label response counts by surface: search (SERP) vs vacancy page.
- Search cards prefer `vacancyResponsesCount` when hh includes it in SERP JSON (same priority as on the vacancy page); otherwise `totalResponsesCount` unchanged.

## [0.1.0] - 2026-10-18

### Added

- Badges on hh.ru search results: total responses, unread queue, responses per day, vacancy age, bumped flag.
- Vacancy page panel: tariff tier, search boost, AI screening, tests, required cover letter, alternate counter when hh exposes two totals.
- Competition tones: calm, medium, hot, and zombie (stale listing, empty unread queue).
- Age and per-day metrics from creation date, not last publication bump.
- Chromium and Firefox release packages via GitHub Actions (`job-xray-chromium.zip`, `job-xray-firefox.xpi`).
- Local-only processing: reads `#HH-Lux-InitialState` on open hh.ru pages; no backend or telemetry.

[0.1.2]: https://github.com/tommyknocker/job-xray/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/tommyknocker/job-xray/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/tommyknocker/job-xray/releases/tag/v0.1.0
