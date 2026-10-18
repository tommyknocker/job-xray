import {
    detectPage,
    extractSearchVacancies,
    extractVacancy,
    readInitialStateFromDocument,
} from './parser.js';
import { computeSignals } from './metrics.js';
import { mountOnSearchCard, mountOnVacancyPage, vacancyIdFromCard } from './ui.js';

const SCAN_INTERVAL_MS = 800;

let lastHref = '';
let lastSignature = '';
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

function mountSearch(state) {
    const byId = new Map(
        extractSearchVacancies(state)
            .map((item) => computeSignals(item))
            .map((item) => [item.id, item]),
    );

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
        mountSearch(state);
        return;
    }
    if (page === 'vacancy') {
        mountVacancy(state);
    }
}

function requestScan() {
    if (scanTimer) {
        return;
    }
    scanTimer = window.setTimeout(() => {
        scanTimer = 0;
        scan();
    }, 100);
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

function observe() {
    const observer = new MutationObserver(() => {
        requestScan();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(() => scan(), SCAN_INTERVAL_MS);
}

hookHistory();
scan(true);
observe();
