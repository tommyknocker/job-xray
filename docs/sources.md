# Where job-xray gets response counters

HH hides counters in JSON and XHR shards, not in the visible SERP HTML. The extension reads **only what the page already loads** (InitialState + intercepted shards; optional same-origin `fetch` fallback).

## Page types

| Page | `detectPage()` | Primary InitialState | Network / fallback |
|------|----------------|----------------------|--------------------|
| Home | `home` | `recommendedVacancies.vacancies` | — |
| Search | `search` | `vacancySearchResult.vacancies` (often stale on SPA) | `/shards/vacancy/search`; hook + `maybeResolveSearchPageData` (HTML `/search/vacancy?page=`) |
| Vacancy | `vacancy` | `vacancyView.vacancyFull` | `/shards/vacancy/related_vacancies` (+ content-script fetch fallback) |
| Employer | `employer` | `employerChameleonVacancies.vacancies` («Подходящие» on «О компании») | `/shards/employerview/employer_vacancy_search` (hook, merge cache); `maybeResolveEmployerPageData` if cards stay unbadged |

Ignored on purpose: `employer_vacancy_search?getVacancyCount=true` (empty `vacancies`).

## SERP badges (search / home / employer)

1. Build a map: InitialState lists via `extractSearchVacancies()` **plus** merged entries in `searchShard.js` (`shardById`).
2. Match DOM: `[data-qa="vacancy-serp__vacancy"]`, id from `[data-qa="serp-item__title"]` href.
3. **Cache rules:** search shard responses **replace** cache; employer shard responses **merge**. Search page resets cache on SERP DOM signature change; employer resets cache on pager page index change only.

## Debugging

On hh.ru: `localStorage.setItem('job-xray-debug', '1')` then reload — `[job-xray]` logs in the console (fetch / resolve).
