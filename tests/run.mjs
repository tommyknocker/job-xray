import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractInitialStateFromHtml, extractSearchVacancies, extractVacancy, extractVacancyPage, normalizeSearchVacancy, normalizeResponseTotals, vacancyIdFromPath } from '../extension/src/parser.js';
import { computeSignals, formatAge, formatPerDay, toneOf } from '../extension/src/metrics.js';
import { chipsFor } from '../extension/src/ui.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOW = new Date('2026-10-18T10:45:00+03:00');

function loadHtmlState(name) {
    const html = readFileSync(join(root, 'data', name), 'utf8');
    const state = extractInitialStateFromHtml(html);
    assert.ok(state, `state from ${name}`);
    return state;
}

function loadVacancy(id) {
    const state = loadHtmlState(`${id}.html`);
    const item = extractVacancyPage(state);
    assert.ok(item, `vacancy ${id}`);
    return computeSignals(item, NOW);
}

const searchState = loadHtmlState('search_php.html');
const search = extractSearchVacancies(searchState);
assert.equal(search.length, 50);

const byId = new Map(search.map((item) => [item.id, computeSignals(item, NOW)]));

const metrosetInSearch = [...byId.values()].find((item) => item.title.includes('Fullstack-разработчик') && item.total > 2000);
assert.ok(byId.get('138567663'));
assert.equal(byId.get('138567663').total, 175);
assert.equal(byId.get('138567663').unread, 12);
assert.equal(byId.get('93135640').unread, 26);
assert.equal(byId.get('136083468').unread, 0);
assert.equal(byId.get('136083468').tone, 'zombie');

const litofer = loadVacancy('138363266');
assert.equal(litofer.total, 1500);
assert.equal(litofer.tone, 'hot');
assert.equal(litofer.letterRequired, true);
assert.ok(litofer.perDay > 200);

const metroset = loadVacancy('138399571');
assert.equal(metroset.total, 2099);
assert.equal(metroset.tone, 'hot');
assert.equal(metroset.tariff, 'Стандарт');

const vasiliev = loadVacancy('137760396');
assert.equal(vasiliev.tone, 'good');
assert.ok(vasiliev.perDay < 20);

const ekapusta = loadVacancy('136083468');
assert.equal(ekapusta.hasAi, true);
assert.equal(ekapusta.hasTest, true);
assert.equal(ekapusta.tariff, 'Премиум');
assert.equal(ekapusta.bumped, true);
assert.ok(ekapusta.countersUnstable);

const perpetum = loadVacancy('138498660');
assert.equal(perpetum.boosted, true);
assert.equal(perpetum.hasAi, true);

assert.equal(toneOf({ total: 200, perDay: 20, ageDays: 5, unread: 10 }), 'good');
assert.equal(toneOf({ total: 2099, perDay: 374, ageDays: 5.6, unread: 700 }), 'hot');
assert.equal(toneOf({ total: 1977, perDay: 29, ageDays: 69, unread: 0 }), 'zombie');
assert.equal(formatAge(0.4), 'сегодня');
assert.equal(formatAge(978), '2,7 г');
assert.equal(formatPerDay(14.2), '14/день');

const zombieChips = chipsFor(byId.get('136083468'), 'search').map((chip) => chip.text);
assert.ok(zombieChips[0].includes('откл.'));
assert.ok(zombieChips.some((text) => text.includes('неразобр.')));
assert.ok(zombieChips.includes('подняли'));

assert.ok(metrosetInSearch === undefined || metrosetInSearch.total > 1000);

const fxState = JSON.parse(readFileSync(join(root, 'tests/fixtures/vacancy-137961989.json'), 'utf8'));
const fx = computeSignals(extractVacancy(fxState, '/vacancy/137961989'), NOW);
assert.equal(fx.id, '137961989');
assert.equal(fx.total, 447);
assert.equal(fx.tariff, 'Стандарт плюс');
assert.equal(fx.bumped, true);
assert.equal(vacancyIdFromPath('/vacancy/137961989'), '137961989');
assert.equal(extractVacancy(searchState, '/vacancy/138567663')?.id, '138567663');

const dualSearch = JSON.parse(readFileSync(join(root, 'tests/fixtures/search-dual-counters.json'), 'utf8'));
const dualItem = computeSignals(extractSearchVacancies(dualSearch)[0], NOW);
assert.equal(dualItem.total, 861);
assert.equal(dualItem.totalAlt, 1750);
assert.ok(dualItem.countersUnstable);

const pikSearchItem = JSON.parse(readFileSync(join(root, 'tests/fixtures/pik-136655566-search-item.json'), 'utf8'));
const pikSerp = computeSignals(normalizeSearchVacancy(pikSearchItem), NOW);
assert.equal(pikSerp.total, 1940);
assert.equal(pikSerp.unread, 636);
assert.equal(pikSerp.totalAlt, 1940);
assert.equal(pikSerp.countersUnstable, false);

const pikExtra = JSON.parse(readFileSync(join(root, 'tests/fixtures/pik-136655566-vacancy-extra.json'), 'utf8'));
const pikPage = computeSignals({
    id: '136655566',
    title: 'Backend PHP',
    ...normalizeResponseTotals(pikExtra.vacancyResponsesCount, pikExtra.totalResponsesCount),
    unread: null,
    createdAt: new Date('2025-08-26T10:00:00+03:00'),
    publishedAt: new Date('2026-10-01T10:00:00+03:00'),
    properties: [],
    source: 'vacancy',
}, NOW);
assert.equal(pikPage.total, 861);
assert.equal(pikPage.totalAlt, 1750);
assert.ok(pikPage.countersUnstable);

const freshState = extractInitialStateFromHtml(
    readFileSync(join(root, 'tests/fixtures/vacancy-138579321.html'), 'utf8'),
);
assert.ok(freshState, 'vacancy-138579321.html');
const freshSignals = computeSignals(
    extractVacancyPage(freshState),
    new Date('2026-10-18T15:10:00+03:00'),
);
assert.equal(freshSignals.total, 103);
assert.ok(freshSignals.perHour != null && freshSignals.perHour < 200);
assert.equal(freshSignals.perDay, null);
const freshRateChips = chipsFor(freshSignals, 'vacancy').map((chip) => chip.text);
assert.ok(freshRateChips.some((text) => text.includes('/час')));
assert.ok(!freshRateChips.some((text) => text.includes('/день')));

console.log(`ok: ${search.length} search vacancies, vacancy pages parsed`);
