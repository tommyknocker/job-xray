import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    detectPage,
    employerIdFromPath,
    extractInitialStateFromHtml,
    extractRelatedVacanciesShard,
    extractSearchVacancies,
    extractSearchVacanciesShard,
    extractVacancy,
    extractVacancyPage,
    normalizeResponseTotals,
    normalizeSearchVacancy,
    vacancyIdFromPath,
} from '../extension/src/parser.js';
import {
    ingestRelatedVacanciesPayload,
    relatedVacancyCacheSize,
    resetRelatedVacancyCache,
} from '../extension/src/related.js';
import {
    ingestSearchVacanciesHtml,
    ingestSearchVacanciesShard,
    resetSearchShardCache,
    searchShardCacheSize,
} from '../extension/src/searchShard.js';
import { computeSignals, formatAge, formatPerDay, toneOf } from '../extension/src/metrics.js';
import { chipsFor } from '../extension/src/ui.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOW = new Date('2026-10-18T10:45:00+03:00');

const INTEGRATION_MARKER = join(root, 'data', 'search_php.html');

function hasIntegrationData() {
    return existsSync(INTEGRATION_MARKER);
}

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

function runFixtureTests() {
    assert.equal(toneOf({ total: 200, perDay: 20, ageDays: 5, unread: 10 }), 'good');
    assert.equal(toneOf({ total: 2099, perDay: 374, ageDays: 5.6, unread: 700 }), 'hot');
    assert.equal(toneOf({ total: 1977, perDay: 29, ageDays: 69, unread: 0 }), 'zombie');
    assert.equal(formatAge(0.4), 'сегодня');
    assert.equal(formatAge(978), '2,7 г');
    assert.equal(formatPerDay(14.2), '14/день');

    const fxState = JSON.parse(
        readFileSync(join(root, 'tests/fixtures/vacancy-137961989.json'), 'utf8'),
    );
    const fx = computeSignals(extractVacancy(fxState, '/vacancy/137961989'), NOW);
    assert.equal(fx.id, '137961989');
    assert.equal(fx.total, 447);
    assert.equal(fx.tariff, 'Стандарт плюс');
    assert.equal(fx.bumped, true);
    assert.equal(vacancyIdFromPath('/vacancy/137961989'), '137961989');

    const dualSearch = JSON.parse(
        readFileSync(join(root, 'tests/fixtures/search-dual-counters.json'), 'utf8'),
    );
    const dualItem = computeSignals(extractSearchVacancies(dualSearch)[0], NOW);
    assert.equal(dualItem.total, 861);
    assert.equal(dualItem.totalAlt, 1750);
    assert.ok(dualItem.countersUnstable);

    const pikSearchItem = JSON.parse(
        readFileSync(join(root, 'tests/fixtures/pik-136655566-search-item.json'), 'utf8'),
    );
    const pikSerp = computeSignals(normalizeSearchVacancy(pikSearchItem), NOW);
    assert.equal(pikSerp.total, 1940);
    assert.equal(pikSerp.unread, 636);
    assert.equal(pikSerp.totalAlt, 1940);
    assert.equal(pikSerp.countersUnstable, false);

    const pikExtra = JSON.parse(
        readFileSync(join(root, 'tests/fixtures/pik-136655566-vacancy-extra.json'), 'utf8'),
    );
    const pikPage = computeSignals(
        {
            id: '136655566',
            title: 'Backend PHP',
            ...normalizeResponseTotals(pikExtra.vacancyResponsesCount, pikExtra.totalResponsesCount),
            unread: null,
            createdAt: new Date('2025-08-26T10:00:00+03:00'),
            publishedAt: new Date('2026-10-01T10:00:00+03:00'),
            properties: [],
            source: 'vacancy',
        },
        NOW,
    );
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

    const relatedShard = JSON.parse(
        readFileSync(join(root, 'tests/fixtures/related-vacancies.json'), 'utf8'),
    );
    const related = extractRelatedVacanciesShard(relatedShard);
    assert.equal(related.length, 2);
    assert.equal(related[0].id, '138308159');
    assert.equal(related[0].total, 193);
    assert.equal(related[1].id, '136119047');
    assert.equal(related[1].total, 253);
    assert.equal(related[1].unread, 132);
    assert.notEqual(related[1].total, related[1].unread);

    resetRelatedVacancyCache();
    ingestRelatedVacanciesPayload({ vacancies: [relatedShard.vacancies[0]] });
    assert.equal(relatedVacancyCacheSize(), 1);
    ingestRelatedVacanciesPayload({ vacancies: [relatedShard.vacancies[1]] });
    assert.equal(relatedVacancyCacheSize(), 2);

    const searchShard = JSON.parse(
        readFileSync(join(root, 'tests/fixtures/search-dual-counters.json'), 'utf8'),
    );
    const shardItems = extractSearchVacanciesShard(searchShard);
    assert.equal(shardItems.length, 1);
    assert.equal(shardItems[0].id, '136655566');
    resetSearchShardCache();
    ingestSearchVacanciesShard(searchShard);
    assert.equal(searchShardCacheSize(), 1);

    assert.equal(detectPage('/'), 'home');
    assert.equal(detectPage('/search/vacancy'), 'search');
    assert.equal(detectPage('/employer/4335309'), 'employer');
    assert.equal(employerIdFromPath('/employer/4335309'), '4335309');
    assert.equal(employerIdFromPath('/search/vacancy'), null);
    assert.equal(detectPage('/vacancy/137961989'), 'vacancy');
    assert.equal(detectPage('/applicant/negotiations'), null);

    const employerShard = JSON.parse(
        readFileSync(join(root, 'tests/fixtures/employer-vacancy-search.json'), 'utf8'),
    );
    const employerItems = extractSearchVacanciesShard(employerShard);
    assert.equal(employerItems.length, 2);
    assert.equal(employerItems[0].id, '138134718');
    assert.equal(employerItems[0].total, 363);
    assert.equal(employerItems[0].unread, 293);

    const chameleonState = JSON.parse(
        readFileSync(join(root, 'tests/fixtures/employer-chameleon-vacancies.json'), 'utf8'),
    );
    const chameleonItems = extractSearchVacancies(chameleonState);
    assert.equal(chameleonItems.length, 2);
    assert.equal(chameleonItems[0].id, '138614576');
    assert.equal(chameleonItems[0].total, 108);
    assert.equal(chameleonItems[0].unread, 15);

    const homeState = JSON.parse(
        readFileSync(join(root, 'tests/fixtures/index-recommended.json'), 'utf8'),
    );
    const homeItems = extractSearchVacancies(homeState);
    assert.equal(homeItems.length, 2);
    assert.equal(homeItems[0].id, '137961989');
    assert.equal(homeItems[0].total, 467);
    assert.equal(homeItems[0].unread, 448);
    assert.equal(homeItems[1].id, '138569363');
    assert.equal(homeItems[1].unread, 12);
}

function runIntegrationTests() {
    const searchState = loadHtmlState('search_php.html');
    const search = extractSearchVacancies(searchState);
    assert.equal(search.length, 50);

    const byId = new Map(search.map((item) => [item.id, computeSignals(item, NOW)]));

    const metrosetInSearch = [...byId.values()].find(
        (item) => item.title.includes('Fullstack-разработчик') && item.total > 2000,
    );
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

    const zombieChips = chipsFor(byId.get('136083468'), 'search').map((chip) => chip.text);
    assert.ok(zombieChips[0].includes('откл.'));
    assert.ok(zombieChips.some((text) => text.includes('неразобр.')));
    assert.ok(zombieChips.includes('подняли'));

    assert.ok(metrosetInSearch === undefined || metrosetInSearch.total > 1000);
    assert.equal(extractVacancy(searchState, '/vacancy/138567663')?.id, '138567663');

    const searchHtml = readFileSync(join(root, 'data', 'search_php.html'), 'utf8');
    resetSearchShardCache();
    assert.ok(ingestSearchVacanciesHtml(searchHtml));
    assert.equal(searchShardCacheSize(), 50);

    if (existsSync(join(root, 'data', 'test7.html'))) {
        const homeState = loadHtmlState('test7.html');
        const home = extractSearchVacancies(homeState);
        assert.equal(home.length, 6);
        assert.equal(home[0].id, '137961989');
        assert.equal(home[0].total, 467);
        assert.equal(home[0].unread, 448);
        assert.equal(detectPage('/'), 'home');
    }

    return search.length;
}

runFixtureTests();

const skipIntegration = process.env.CI === 'true' || process.env.SKIP_INTEGRATION === '1';

let searchCount = 0;
if (skipIntegration) {
    console.log('integration tests skipped (CI or SKIP_INTEGRATION=1)');
} else if (hasIntegrationData()) {
    searchCount = runIntegrationTests();
} else {
    console.error(
        'Missing local data/ HTML snapshots (gitignored). Either add data/search_php.html etc., or run with SKIP_INTEGRATION=1.',
    );
    process.exit(1);
}

console.log(
    searchCount > 0
        ? `ok: ${searchCount} search vacancies, vacancy pages parsed`
        : 'ok: fixture tests passed',
);
