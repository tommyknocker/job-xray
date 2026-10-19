# Changelog

All notable changes to **job-xray** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Version numbers match `package.json`, extension manifests, and Git tags (`v*`). Website copy lives in [job-xray-site](https://github.com/tommyknocker/job-xray-site) (`data/changelog.php`).

## [Unreleased]

## [0.1.6] - 2026-10-19

### Added

- Employer page vacancies tab (`/employer/{id}?tab=VACANCIES`): badges from GET `/shards/employerview/employer_vacancy_search` (`employerVacancySearch.vacancies`).
- Employer pages: content-script fallback fetch for `employer_vacancy_search` when SERP cards have no badge data (same idea as search HTML resolve).
- `docs/sources.md`: where counters come from per page type (InitialState, shards, cache rules).

### Fixed

- Employer «О компании» tab: «Подходящие вакансии» stayed without badges when `getVacancyCount` shard returned an empty `vacancies` list (wiped cache) or when SERP cards appeared after the first shard (employer page no longer clears cache on every DOM change).
- Employer «Подходящие вакансии»: counters live in `employerChameleonVacancies` in InitialState (not only in `employer_vacancy_search` shard); badges also apply when Lux state is empty but shard cache is filled.

## [0.1.5] - 2026-10-18

### Added

- Homepage recommended vacancies (`nn.hh.ru/`, `hh.ru/`): same search badges from `recommendedVacancies` in `#HH-Lux-InitialState`. Cards there are `div[data-qa="vacancy-serp__vacancy"]`, not `article`.

## [0.1.4] - 2026-10-18

### Fixed

- Search **page 2+** (SPA pagination): hh often keeps the same URL and stale `#HH-Lux-InitialState`; badges now load from `/search/vacancy?page=N` HTML (XHR hook + content-script fetch), using the active pager link (`aria-current="true"`).
- Stop resolve/fetch loops that could freeze or crash the tab after pagination (ignore stale InitialState once shard data is applied; skip observer feedback from our own badges).
- Firefox build: duplicate top-level names in the bundled `content.js` (`listenerRegistered`, `MOUNT_RETRY_MS`, `STATE_ID`) — AMO validation errors.
- `npm run check`: parse the Firefox bundle with Acorn and detect duplicate top-level bindings across concatenated sources (CI on `main` / PRs).
- `npm run validate` + optional `pre-push` hook; release workflow runs `npm ci` before build; CI skips gitignored `data/` integration tests.

## [0.1.3] - 2026-10-18

### Added

- Vacancy page: badges on **«Вам подойдут эти вакансии»** — same metrics as search, from the `related_vacancies` shard (all loaded pages merged).

### Changed

- Search and recommendation cards: chips sit **under the title**, before experience / format tags (one layout everywhere).

### Fixed

- Capture `related_vacancies` in the page context (main-world hook); content-script `fetch` alone did not see hh.ru requests. Fallback fetch from the extension if the hook misses.

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

[0.1.6]: https://github.com/tommyknocker/job-xray/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/tommyknocker/job-xray/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/tommyknocker/job-xray/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/tommyknocker/job-xray/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/tommyknocker/job-xray/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/tommyknocker/job-xray/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/tommyknocker/job-xray/releases/tag/v0.1.0
