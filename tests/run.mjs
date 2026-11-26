import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

function mockVacancyClosest(self) {
    return (sel) => {
        const s = String(sel);
        if (s.includes('data-job-xray')) {
            return null;
        }
        if (s.includes('vacancy-description') || s.includes('vacancy-address-with-map')) {
            return null;
        }
        return self;
    };
}
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
    readInitialStateFromDocument,
    vacancyIdFromPath,
} from '../extension/src/parser.js';
import {
    ingestRelatedVacanciesPayload,
    mountRelatedVacancyCards,
    relatedVacancyCacheSize,
    resetRelatedVacancyCache,
} from '../extension/src/related.js';
import {
    ingestSearchVacanciesHtml,
    ingestSearchVacanciesShard,
    ingestVacancyMetrics,
    resetSearchShardCache,
    searchShardCacheSize,
    searchSignalsById,
} from '../extension/src/searchShard.js';
import { computeSignals, formatAge, formatPerDay, toneOf } from '../extension/src/metrics.js';
import { formatDayMonthRu, formatEveryDaysRu } from '../extension/src/copy.ru.js';
import { applyNegotiationBadges } from '../extension/src/negotiations.js';
import {
    cardShowsHhViewers,
    chipsFor,
    mountOnSearchCard,
    mountOnVacancyPage,
    pickVacancyMountTarget,
    vacancyIdFromCard,
    vacancyIdFromNegotiationItem,
} from '../extension/src/ui.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOW = new Date('2026-10-18T10:45:00+03:00');

const VACANCY_PAGE_FIXTURES = ['139588338', '139587109', '139549291'];

const APPLICANT_VACANCY_FIXTURES = [
    { file: 'page1.html', id: '139588338' },
    { file: 'page2.html', id: '139549291' },
    { file: 'page3.html', id: '139587109' },
];

function runApplicantVacancyHtmlFixtures() {
    for (const { file, id } of APPLICANT_VACANCY_FIXTURES) {
        const fixturePath = join(root, 'tests/fixtures', file);
        assert.ok(existsSync(fixturePath), `missing tests/fixtures/${file}`);
        const html = readFileSync(fixturePath, 'utf8');
        const state = extractInitialStateFromHtml(html);
        const item = extractVacancy(state, `/vacancy/${id}`);
        assert.equal(item?.id, id, `extractVacancy ${file}`);

        const { document, window } = parseHTML(html);
        globalThis.document = document;
        globalThis.window = window;

        const point = pickVacancyMountTarget(document);
        assert.notEqual(point.ref, document.body, `${file}: mount body fallback`);
        assert.equal(point.mode, 'after', `${file}: expected mount after Условия card`);
        const refText = normalizeVacancyText(point.ref?.textContent);
        assert.ok(/^Условия/i.test(refText), `${file}: mount ref should be Условия card, got ${refText.slice(0, 40)}`);

        document.querySelectorAll('[data-job-xray-surface="vacancy"]').forEach((node) => node.remove());
        mountOnVacancyPage(computeSignals(item), document);
        const badge = document.querySelector('[data-job-xray-surface="vacancy"]');
        assert.ok(badge, `${file}: badge missing`);
        assert.equal(badge.getAttribute('data-job-xray'), id);
        assert.equal(badge.previousElementSibling, point.ref, `${file}: badge not after Условия card`);
    }
}

function normalizeVacancyText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function runParttimeHtmlFixture() {
    const fixturePath = join(root, 'tests/fixtures', 'parttime.html');
    assert.ok(existsSync(fixturePath), 'missing tests/fixtures/parttime.html');
    const html = readFileSync(fixturePath, 'utf8');
    const state = extractInitialStateFromHtml(html);
    assert.equal(detectPage('/vacancies/podrabotka'), 'search');
    const items = extractSearchVacancies(state);
    assert.equal(items.length, 50);

    const { document, window } = parseHTML(html);
    globalThis.document = document;
    globalThis.window = window;

    resetSearchShardCache();
    const byId = searchSignalsById(state);
    assert.equal(byId.size, 50);

    document.querySelectorAll('[data-job-xray]').forEach((node) => node.remove());
    let mounted = 0;
    for (const article of document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]')) {
        const id = vacancyIdFromCard(article);
        const signals = byId.get(id);
        if (!signals) {
            continue;
        }
        mountOnSearchCard(article, signals);
        mounted += 1;
    }
    assert.equal(mounted, 50);
}

function runNegotiationsHtmlFixture() {
    const fixturePath = join(root, 'tests/fixtures', 'reviews.html');
    assert.ok(existsSync(fixturePath), 'missing tests/fixtures/reviews.html');
    const html = readFileSync(fixturePath, 'utf8');
    const state = extractInitialStateFromHtml(html);
    const suitable = extractSearchVacancies(state);
    assert.equal(suitable.length, 6, 'suitableVacancies in negotiations InitialState');
    assert.equal(detectPage('/applicant/negotiations'), 'negotiations');

    const { document, window } = parseHTML(html);
    globalThis.document = document;
    globalThis.window = window;

    resetSearchShardCache();
    const byId = searchSignalsById(state);
    assert.equal(byId.size, 6);

    document.querySelectorAll('[data-job-xray]').forEach((node) => node.remove());
    for (const article of document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]')) {
        const id = vacancyIdFromCard(article);
        const signals = byId.get(id);
        assert.ok(signals, `signals for suitable card ${id}`);
        mountOnSearchCard(article, signals);
    }
    assert.equal(document.querySelectorAll('[data-job-xray-surface="search"]').length, 6);

    const negoItem = document.querySelector('[data-qa="negotiations-item"]');
    const negoId = vacancyIdFromNegotiationItem(negoItem);
    assert.equal(negoId, '139549291');
    ingestVacancyMetrics({
        id: negoId,
        title: 'Tech Lead',
        total: 413,
        totalAlt: 412,
        unread: 5,
        publishedAt: NOW,
        createdAt: NOW,
        properties: [],
        source: 'vacancy',
    });
    applyNegotiationBadges(state);
    assert.ok(negoItem.querySelector('[data-job-xray]'), 'negotiation row badge');
}

function runVacancyPageHtmlFixtures() {
    for (const id of VACANCY_PAGE_FIXTURES) {
        const fixturePath = join(root, 'tests/fixtures', `vacancy-${id}.html`);
        assert.ok(existsSync(fixturePath), `missing tests/fixtures/vacancy-${id}.html`);
        const html = readFileSync(fixturePath, 'utf8');
        const state = extractInitialStateFromHtml(html);
        const item = extractVacancy(state, `/vacancy/${id}`);
        assert.equal(item?.id, id, `extractVacancy ${id}`);
        assert.ok(item.total > 0, `counters for ${id}`);

        const { document, window } = parseHTML(html);
        globalThis.document = document;
        globalThis.window = window;

        const point = pickVacancyMountTarget(document);
        assert.notEqual(point.ref, document.body, `${id}: mount fell back to body`);
        assert.notEqual(point.mode, 'prepend', `${id}: mount mode prepend`);

        document.querySelectorAll('[data-job-xray-surface="vacancy"]').forEach((node) => node.remove());
        mountOnVacancyPage(computeSignals(item), document);
        const badge = document.querySelector('[data-job-xray-surface="vacancy"]');
        assert.ok(badge, `${id}: vacancy badge not mounted`);
        assert.equal(badge.getAttribute('data-job-xray'), id);
        mountOnVacancyPage(computeSignals({ ...item, total: 41, totalAlt: 41 }), document);
        assert.ok(document.querySelector('[data-job-xray-surface="vacancy"]') === badge, 'reused vacancy badge');
        assert.match(badge.shadowRoot.querySelector('.row').textContent, /41 откл\./);

        const topActions = document.querySelector('[class*="vacancy-actions_magritte-vacancy-top"]');
        assert.ok(topActions, `${id}: expected header apply row in fixture HTML`);
        if (point.mode === 'before') {
            assert.equal(point.ref, topActions, `${id}: before non-header actions row`);
        }
    }
}

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
    assert.equal(extractVacancy(fxState, '/vacancy/202'), null);
    const mixedState = {
        ...fxState,
        vacancySearchResult: {
            vacancies: [{ vacancyId: '202', vacancyResponsesCount: 41 }],
        },
    };
    assert.equal(extractVacancy(mixedState, '/vacancy/202')?.total, 41);
    const fx = computeSignals(extractVacancy(fxState, '/vacancy/137961989'), NOW);
    assert.equal(fx.id, '137961989');
    assert.equal(fx.total, 447);
    assert.equal(fx.tariff, 'Стандарт плюс');
    assert.equal(fx.bumped, false);
    assert.ok(fx.autoRenewal);
    assert.equal(fx.autoRenewal.intervalMinutes, 4320);
    assert.equal(formatDayMonthRu(fx.listingEndsAt), '30.10');
    assert.equal(formatEveryDaysRu(4320), 'каждые 3 дня');
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
    assert.equal(pikSerp.onlineViewers, 3);
    assert.equal(pikSerp.bumped, true);
    assert.equal(pikSerp.autoRenewal, null);
    assert.equal(formatDayMonthRu(pikSerp.listingEndsAt), '25.10');
    const pikSearchChips = chipsFor(pikSerp, 'search');
    assert.ok(pikSearchChips.some((chip) => chip.icon === 'eye' && chip.text === '3'));
    assert.ok(pikSearchChips.some((chip) => chip.icon === 'calendar' && chip.text === 'до 25.10'));
    assert.ok(pikSearchChips.some((chip) => chip.text === 'подняли'));
    assert.ok(chipsFor(pikSerp, 'search', { hideOnlineViewers: true }).every((chip) => chip.icon !== 'eye'));

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
    assert.equal(freshSignals.onlineViewers, 51);
    assert.equal(formatDayMonthRu(freshSignals.listingEndsAt), '17.11');
    const freshRateChips = chipsFor(freshSignals, 'vacancy').map((chip) => chip.text);
    assert.ok(freshRateChips.some((text) => text.includes('/час')));
    assert.ok(!freshRateChips.some((text) => text.includes('/день')));
    assert.ok(freshRateChips.some((text) => text.includes('откл.')), 'vacancy panel shows responses');

    const templateLikeDoc = {
        getElementById: () => ({
            textContent: '',
            innerHTML: '',
            content: { textContent: JSON.stringify({ marker: 'template-content' }) },
        }),
    };
    assert.deepEqual(readInitialStateFromDocument(templateLikeDoc), { marker: 'template-content' });

    const innerHtmlOnlyDoc = {
        getElementById: () => ({
            textContent: '',
            innerHTML: '{"marker":"inner-html"}',
        }),
    };
    assert.deepEqual(readInitialStateFromDocument(innerHtmlOnlyDoc), { marker: 'inner-html' });

    const emptyTemplateDoc = {
        getElementById: () => ({
            textContent: '',
            innerHTML: '',
            content: { textContent: '' },
        }),
    };
    assert.equal(readInitialStateFromDocument(emptyTemplateDoc), null);

    const htmlFixture = readFileSync(join(root, 'tests/fixtures/vacancy-138579321.html'), 'utf8');
    const fromFile = extractInitialStateFromHtml(htmlFixture);
    const templateBody = htmlFixture.match(
        /<template[^>]*id="HH-Lux-InitialState"[^>]*>([\s\S]*?)<\/template>/i,
    )?.[1];
    assert.ok(templateBody);
    const liveTemplateDoc = {
        getElementById: () => ({
            textContent: '',
            innerHTML: templateBody,
            content: { textContent: '' },
        }),
    };
    const fromLiveTemplate = readInitialStateFromDocument(liveTemplateDoc);
    assert.ok(fromLiveTemplate);
    assert.equal(extractVacancyPage(fromLiveTemplate)?.total, extractVacancyPage(fromFile)?.total);

    const magritteCard = {
        name: 'card',
        querySelector: (sel) => (String(sel) === '.vacancy-title' ? titleBox : null),
        querySelectorAll: () => [],
    };
    const headerColumn = {
        name: 'header-column',
        className: 'magritte-v-spacing-container___x',
        parentElement: magritteCard,
    };
    const titleBox = {
        name: 'vacancy-title-box',
        parentElement: headerColumn,
        className: 'vacancy-title',
        closest: (sel) => (String(sel).includes('vacancy-title') ? titleBox : null),
    };
    const metaBlock = {
        name: 'meta-block',
        className: 'magritte-v-spacing-container___y',
        parentElement: headerColumn,
        querySelector: (sel) => (String(sel).includes('vacancy-experience') ? { name: 'exp' } : null),
    };
    metaBlock.closest = mockVacancyClosest(metaBlock);
    titleBox.nextElementSibling = metaBlock;
    const titleHeading = {
        name: 'h1',
        parentElement: titleBox,
        getBoundingClientRect: () => ({ width: 400, height: 40, top: 100 }),
        compareDocumentPosition: () => 4,
        closest: (sel) => {
            const s = String(sel);
            if (s.includes('vacancy-title')) {
                return titleBox;
            }
            if (s.includes('magritte-card')) {
                return magritteCard;
            }
            return null;
        },
    };
    const salaryEl = {
        name: 'salary',
        parentElement: titleBox,
        closest: (sel) => (String(sel).includes('vacancy-title') ? titleBox : null),
    };
    const actions = { name: 'actions', parentElement: headerColumn };
    const applyBtn = {
        getBoundingClientRect: () => ({ width: 200, height: 40, top: 450 }),
        compareDocumentPosition: () => 4,
        closest: (sel) => {
            const s = String(sel);
            if (s.includes('action-bar')) {
                return null;
            }
            if (s.includes('vacancy-actions')) {
                return actions;
            }
            if (s.includes('magritte-card')) {
                return magritteCard;
            }
            return null;
        },
        parentElement: actions,
    };
    titleBox.contains = (node) => node === titleBox || node === titleHeading || node === salaryEl;
    headerColumn.contains = (node) => titleBox.contains(node)
        || node === headerColumn
        || node === actions
        || node === applyBtn;
    headerColumn.contains = (node) => titleBox.contains(node)
        || node === metaBlock
        || node === headerColumn
        || node === actions
        || node === applyBtn;
    magritteCard.contains = (node) => headerColumn.contains(node) || node === magritteCard;
    const magritteDoc = {
        querySelectorAll: (sel) => (String(sel).includes('vacancy-response-link-top') ? [applyBtn] : []),
        querySelector: (sel) => {
            const s = String(sel);
            if (s.includes('vacancy-salary')) {
                return salaryEl;
            }
            if (s.includes('h1') || s.includes('vacancy-title')) {
                return titleHeading;
            }
            return null;
        },
        body: { name: 'body' },
    };
    const magritteMount = pickVacancyMountTarget(magritteDoc);
    assert.equal(magritteMount.mode, 'after');
    assert.equal(magritteMount.ref, metaBlock);
    assert.notEqual(magritteMount.ref, titleBox);

    const brandedSummary = {
        name: 'branded-summary',
        textContent: 'Где работать Волгоград График Полная занятость Условия Удалённо',
        contains: () => false,
    };
    brandedSummary.closest = mockVacancyClosest(brandedSummary);
    const compactCard = {
        name: 'compact-card',
        querySelector: () => null,
        querySelectorAll: (sel) => (
            String(sel) === 'div, section, dl' ? [brandedSummary] : []
        ),
        contains: (node) => node === brandedSummary || node === compactColumn || node === compactCard,
    };
    const compactColumn = { name: 'compact-column', parentElement: compactCard };
    const compactHeading = {
        name: 'h1',
        parentElement: compactColumn,
        getBoundingClientRect: () => ({ width: 400, height: 40, top: 100 }),
        compareDocumentPosition: () => 4,
        closest: (sel) => (String(sel).includes('magritte-card') ? compactCard : null),
    };
    const compactSalary = { name: 'salary', parentElement: compactColumn, closest: () => null };
    const compactApply = {
        getBoundingClientRect: () => ({ width: 200, height: 40, top: 450 }),
        compareDocumentPosition: () => 4,
        contains: (node) => node === compactApply,
        closest: (sel) => {
            const s = String(sel);
            if (s.includes('action-bar')) {
                return null;
            }
            if (s.includes('vacancy-actions')) {
                return null;
            }
            if (s.includes('magritte-card')) {
                return compactCard;
            }
            return null;
        },
        parentElement: compactColumn,
    };
    compactColumn.contains = (node) => node === compactColumn
        || node === compactHeading
        || node === compactSalary
        || node === compactApply;
    const compactDoc = {
        querySelectorAll: (sel) => (String(sel).includes('vacancy-response-link-top') ? [compactApply] : []),
        querySelector: (sel) => {
            const s = String(sel);
            if (s.includes('vacancy-salary')) {
                return compactSalary;
            }
            if (s.includes('h1') || s.includes('vacancy-title')) {
                return compactHeading;
            }
            return null;
        },
        body: { name: 'body' },
    };
    const compactMount = pickVacancyMountTarget(compactDoc);
    assert.equal(compactMount.mode, 'after');
    assert.equal(compactMount.ref, brandedSummary);

    const mapSection = { name: 'map', closest: () => mapSection };
    const bottomActions = {
        name: 'bottom-actions',
        contains: (node) => node === mapApply,
    };
    const headerActionsForDual = {
        name: 'header-actions',
        parentElement: headerColumn,
        getBoundingClientRect: () => ({ width: 200, height: 40, top: 450 }),
        contains: (node) => node === applyBtn,
    };
    applyBtn.closest = (sel) => {
        const s = String(sel);
        if (s.includes('action-bar')) {
            return null;
        }
        if (s.includes('vacancy-actions')) {
            return headerActionsForDual;
        }
        if (s.includes('magritte-card')) {
            return magritteCard;
        }
        return null;
    };
    const mapApply = {
        getBoundingClientRect: () => ({ width: 200, height: 40, top: 2200 }),
        compareDocumentPosition: () => 4,
        closest: (sel) => {
            const s = String(sel);
            if (s.includes('vacancy-address-with-map') || s.includes('vacancy-description')) {
                return mapSection;
            }
            if (s.includes('vacancy-actions')) {
                return bottomActions;
            }
            return null;
        },
        parentElement: bottomActions,
    };
    const dualApplyDoc = {
        querySelectorAll: (sel) => (
            String(sel).includes('vacancy-response-link-top') ? [mapApply, applyBtn] : []
        ),
        querySelector: (sel) => {
            const s = String(sel);
            if (s.includes('vacancy-salary')) {
                return salaryEl;
            }
            if (s.includes('h1') || s.includes('vacancy-title')) {
                return titleHeading;
            }
            return null;
        },
        body: { name: 'body' },
    };
    const dualApplyMount = pickVacancyMountTarget(dualApplyDoc);
    assert.equal(dualApplyMount.mode, 'after');
    assert.equal(dualApplyMount.ref, metaBlock);

    const actionsOnlyCard = {
        name: 'actions-only-card',
        querySelector: () => null,
        querySelectorAll: () => [],
        contains: (node) => node === actionsOnlyColumn
            || node === actionsOnlyCard
            || node === headerActionsForDual
            || node === applyBtn,
    };
    const actionsOnlyColumn = {
        name: 'actions-only-column',
        parentElement: actionsOnlyCard,
        contains: (node) => node === actionsOnlyColumn
            || node === actionsOnlyHeading
            || node === dualHeaderActions
            || node === applyBtn,
    };
    const actionsOnlyHeading = {
        name: 'h1',
        parentElement: actionsOnlyColumn,
        getBoundingClientRect: () => ({ width: 400, height: 40, top: 100 }),
        compareDocumentPosition: () => 4,
        closest: (sel) => (String(sel).includes('magritte-card') ? actionsOnlyCard : null),
    };
    const dualHeaderActions = {
        name: 'header-actions',
        parentElement: null,
        getBoundingClientRect: () => ({ width: 200, height: 40, top: 450 }),
        contains: (node) => node === applyBtn,
    };
    applyBtn.closest = (sel) => {
        const s = String(sel);
        if (s.includes('action-bar')) {
            return null;
        }
        if (s.includes('vacancy-actions')) {
            return dualHeaderActions;
        }
        if (s.includes('magritte-card')) {
            return actionsOnlyCard;
        }
        return null;
    };
    dualHeaderActions.parentElement = actionsOnlyColumn;
    applyBtn.parentElement = dualHeaderActions;
    const actionsOnlyDoc = {
        querySelectorAll: (sel) => (
            String(sel).includes('vacancy-response-link-top') ? [mapApply, applyBtn] : []
        ),
        querySelector: (sel) => {
            const s = String(sel);
            if (s.includes('h1') || s.includes('vacancy-title')) {
                return actionsOnlyHeading;
            }
            return null;
        },
        body: { name: 'body' },
    };
    const actionsOnlyMount = pickVacancyMountTarget(actionsOnlyDoc);
    assert.equal(actionsOnlyMount.mode, 'before');
    assert.equal(actionsOnlyMount.ref, dualHeaderActions);
    assert.notEqual(actionsOnlyMount.ref, bottomActions);

    const headingOnlyDoc = {
        querySelectorAll: () => [],
        querySelector: (sel) => {
            const s = String(sel);
            if (s === '.vacancy-title') {
                return null;
            }
            if (s.includes('h1') || s.includes('vacancy-title')) {
                return { name: 'h1' };
            }
            return null;
        },
        body: { name: 'body' },
    };
    const headingMount = pickVacancyMountTarget(headingOnlyDoc);
    assert.equal(headingMount.mode, 'prepend');
    assert.equal(headingMount.ref.name, 'body');

    const orphanCard = {
        name: 'orphan-card',
        querySelector: () => null,
        querySelectorAll: () => [],
        contains: () => false,
    };
    const cardOnlyDoc = {
        querySelectorAll: () => [],
        querySelector: () => null,
        body: { name: 'body' },
    };
    const cardOnlyApply = {
        getBoundingClientRect: () => ({ width: 200, height: 40 }),
        closest: (sel) => (String(sel).includes('magritte-card') ? orphanCard : null),
        parentElement: { name: 'card-parent' },
    };
    cardOnlyDoc.querySelectorAll = (sel) => (String(sel).includes('vacancy-response-link-top')
        ? [cardOnlyApply]
        : []);
    const cardOnlyMount = pickVacancyMountTarget(cardOnlyDoc);
    assert.equal(cardOnlyMount.mode, 'prepend');
    assert.equal(cardOnlyMount.ref.name, 'body');

    let staleRemoved = false;
    const staleBadge = {
        getAttribute: () => '139587109',
        remove: () => { staleRemoved = true; },
        parentElement: { name: 'body' },
    };
    mountOnVacancyPage({ id: '139587109', tone: 'good', ai: {} }, {
        body: { name: 'body' },
        contains: () => true,
        querySelector: (sel) => (String(sel).includes('job-xray-surface') ? staleBadge : null),
        querySelectorAll: () => [],
    });
    assert.equal(staleRemoved, true);

    const viewersRoot = {
        querySelectorAll: () => [
            { children: [], textContent: 'Опубликована 17.11.2026 · Сейчас смотрят 101 человек', closest: () => null },
        ],
    };
    runVacancyPageHtmlFixtures();
    runApplicantVacancyHtmlFixtures();
    runNegotiationsHtmlFixture();
    runParttimeHtmlFixture();

    assert.equal(cardShowsHhViewers(viewersRoot), true);
    const vacancyChips = chipsFor({
        id: '1',
        total: 10,
        onlineViewers: 9,
        ageDays: 1,
        tone: 'good',
        ai: {},
    }, 'vacancy', { hideOnlineViewers: true });
    assert.equal(vacancyChips.some((chip) => /смотрят|👁|глаз/i.test(chip.text) || chip.icon === 'eye'), false);

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
    const relatedSignals = computeSignals(related[0], NOW);
    assert.ok(relatedSignals.autoRenewal);
    assert.equal(relatedSignals.ai.nra, true);
    assert.equal(relatedSignals.ai.survey, true);
    assert.equal(relatedSignals.ai.assistant, true);
    assert.equal(relatedSignals.ai.callSummary, true);
    const relatedVacancyChips = chipsFor(relatedSignals, 'vacancy').map((chip) => chip.text);
    assert.ok(relatedVacancyChips.includes('автоподъём'));
    assert.ok(!relatedVacancyChips.includes('подняли'));
    assert.ok(relatedVacancyChips.includes('AI-разбор'));
    assert.ok(relatedVacancyChips.includes('AI-опрос'));
    assert.ok(relatedVacancyChips.includes('AI-ассистент'));
    assert.ok(relatedVacancyChips.includes('AI-звонок'));

    resetRelatedVacancyCache();
    ingestRelatedVacanciesPayload({ vacancies: [relatedShard.vacancies[0]] });
    assert.equal(relatedVacancyCacheSize(), 1);
    ingestRelatedVacanciesPayload({ vacancies: [relatedShard.vacancies[1]] });
    assert.equal(relatedVacancyCacheSize(), 2);

    const relatedPage = parseHTML(`
        <html><body>
            <article data-qa="vacancy-serp__vacancy">
                <a data-qa="serp-item__title" href="/vacancy/${related[0].id}">Standard card</a>
            </article>
            <article id="other-vacancy"><a href="/vacancy/${related[1].id}0">Different ID</a></article>
            <article data-qa="vacancy-serp__vacancy">
                <a href="/vacancy/${related[1].id}">Fallback card</a>
            </article>
        </body></html>
    `);
    globalThis.document = relatedPage.document;
    mountRelatedVacancyCards();
    const relatedBadges = [...document.querySelectorAll('[data-job-xray]')];
    assert.equal(relatedBadges.length, 2);
    assert.equal(document.querySelector('#other-vacancy [data-job-xray]'), null);
    ingestRelatedVacanciesPayload({
        vacancies: relatedShard.vacancies.map((item) => ({
            ...item,
            vacancyResponsesCount: 41,
            totalResponsesCount: 41,
        })),
    });
    mountRelatedVacancyCards();
    const updatedBadges = [...document.querySelectorAll('[data-job-xray]')];
    assert.equal(updatedBadges.length, relatedBadges.length);
    assert.ok(updatedBadges.every((badge, index) => badge === relatedBadges[index]), 'reused related badges');
    relatedBadges.forEach((badge) => {
        assert.match(badge.shadowRoot.querySelector('.row').textContent, /41 откл\./);
    });

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
    assert.equal(detectPage('/vacancies/podrabotka'), 'search');
    assert.equal(detectPage('/employer/4335309'), 'employer');
    assert.equal(employerIdFromPath('/employer/4335309'), '4335309');
    assert.equal(employerIdFromPath('/search/vacancy'), null);
    assert.equal(detectPage('/vacancy/137961989'), 'vacancy');
    assert.equal(detectPage('/applicant/negotiations'), 'negotiations');

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
    console.log('integration tests skipped (local data/ HTML snapshots unavailable)');
}

console.log(
    searchCount > 0
        ? `ok: ${searchCount} search vacancies, vacancy pages parsed`
        : 'ok: fixture tests passed',
);
