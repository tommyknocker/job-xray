import {
    detectPage,
    extractVacancy,
    readInitialStateFromDocument,
} from './parser.js';
import { computeSignals } from './metrics.js';
import {
    currentVacancyIdForPage,
    maybeFetchRelatedVacancies,
    mountRelatedVacancyCards,
    registerRelatedVacanciesListener,
    resetRelatedVacancyCache,
} from './related.js';
import {
    maybeResolveSearchPageData,
    registerSearchShardListener,
    resetSearchShardCache,
    searchSignalsById,
    serpDomSignature,
} from './searchShard.js';
import { mountOnSearchCard, mountOnVacancyPage, vacancyIdFromCard } from './ui.js';

const STATE_ID = 'HH-Lux-InitialState';

const SCAN_INTERVAL_MS = 2000;

let lastHref = '';
let lastSignature = '';
let lastSerpDomSignature = '';
let scanTimer = 0;
let hookedHistory = false;

function stateSignature(state) {
    if (!state) {
        return 'empty';
    }
    const search = state.vacancySearchResult;
    if (search?.vacancies) {
        const first = search.vacancies[0]?.vacancyId ?? '';
        return `search:${search.totalResults}:${search.vacancies.length}:${first}`;
    }
    const vacancyId = state.analyticsParams?.vacancyId
        ?? state.vacancyView?.vacancyFull?.vacancy?.vacancyId
        ?? '';
    return `vacancy:${vacancyId}`;
}

function applySearchBadges(state) {
    const byId = searchSignalsById(state);

    document.querySelectorAll('article[data-qa="vacancy-serp__vacancy"]').forEach((article) => {
        const id = vacancyIdFromCard(article);
        if (!id) {
            return;
        }
        const signals = byId.get(id);
        if (!signals) {
            return;
        }
        mountOnSearchCard(article, signals);
    });
}

function mountVacancy(state) {
    const item = extractVacancy(state, location.pathname);
    if (!item) {
        return;
    }
    mountOnVacancyPage(computeSignals(item));
}

function scan(force = false) {
    const page = detectPage(location.pathname);
    if (!page) {
        return;
    }

    const href = location.href;
    const hrefChanged = href !== lastHref;
    lastHref = href;

    if (hrefChanged) {
        document.querySelectorAll('[data-job-xray-surface="vacancy"]').forEach((node) => node.remove());
        resetRelatedVacancyCache();
        resetSearchShardCache();
        lastSerpDomSignature = '';
    }

    const state = readInitialStateFromDocument();
    const signature = stateSignature(state);
    if (force || hrefChanged || signature !== lastSignature) {
        lastSignature = signature;
    }

    if (!state) {
        return;
    }

    if (page === 'search') {
        const domSignature = serpDomSignature();
        if (domSignature !== lastSerpDomSignature) {
            lastSerpDomSignature = domSignature;
            resetSearchShardCache();
        }
        applySearchBadges(state);
        maybeResolveSearchPageData(state, () => {
            applySearchBadges(readInitialStateFromDocument() ?? state);
        });
        return;
    }
    if (page === 'vacancy') {
        const vacancyId = currentVacancyIdForPage(state);
        mountVacancy(state);
        mountRelatedVacancyCards(vacancyId);
        maybeFetchRelatedVacancies(state, () => {
            mountRelatedVacancyCards(vacancyId);
        });
    }
}

function mutationFromJobXray(mutations) {
    for (const mutation of mutations) {
        const target = mutation.target;
        if (target instanceof Element && target.closest('[data-job-xray]')) {
            return true;
        }
    }
    return false;
}

function requestScan() {
    if (scanTimer) {
        return;
    }
    scanTimer = window.setTimeout(() => {
        scanTimer = 0;
        scan();
    }, 150);
}

function hookHistory() {
    if (hookedHistory) {
        return;
    }
    hookedHistory = true;
    const wrap = (method) => {
        const original = history[method];
        history[method] = function hookedHistoryMethod(...args) {
            const result = original.apply(this, args);
            requestScan();
            return result;
        };
    };
    wrap('pushState');
    wrap('replaceState');
    window.addEventListener('popstate', requestScan);
}

function observeInitialState() {
    const attach = (el) => {
        if (!el || el.dataset.jobXrayStateObserved) {
            return;
        }
        el.dataset.jobXrayStateObserved = '1';
        new MutationObserver((mutations) => {
            if (!mutationFromJobXray(mutations)) {
                requestScan();
            }
        }).observe(el, { childList: true, characterData: true, subtree: true });
    };

    attach(document.getElementById(STATE_ID));
    new MutationObserver(() => {
        attach(document.getElementById(STATE_ID));
    }).observe(document.documentElement, { childList: true, subtree: true });
}

function observe() {
    const observer = new MutationObserver((mutations) => {
        if (mutationFromJobXray(mutations)) {
            return;
        }
        requestScan();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    observeInitialState();
    setInterval(() => scan(), SCAN_INTERVAL_MS);
}

registerRelatedVacanciesListener(() => {
    const state = readInitialStateFromDocument();
    mountRelatedVacancyCards(currentVacancyIdForPage(state));
});

registerSearchShardListener(() => {
    if (detectPage(location.pathname) !== 'search') {
        return;
    }
    const state = readInitialStateFromDocument();
    if (state) {
        applySearchBadges(state);
    }
});

hookHistory();
scan(true);
observe();
