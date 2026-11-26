import {
    STATE_ID,
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
    currentSerpPageIndexFromDom,
    maybeResolveEmployerPageData,
    maybeResolveSearchPageData,
    registerSearchShardListener,
    resetSearchShardCache,
    searchSignalsById,
    serpDomSignature,
} from './searchShard.js';
import {
    applyNegotiationBadges,
    maybeResolveNegotiationVacancyData,
    resetNegotiationResolveCache,
} from './negotiations.js';
import {
    mountOnSearchCard,
    mountOnVacancyPage,
    SERP_CARD_SELECTOR,
    vacancyIdFromCard,
} from './ui.js';

const SCAN_INTERVAL_MS = 2000;

let lastHref = '';
let lastSerpDomSignature = '';
let lastEmployerSerpPage = null;
let scanTimer = 0;
let hookedHistory = false;

function applySearchBadges(state) {
    const byId = searchSignalsById(state);

    document.querySelectorAll(SERP_CARD_SELECTOR).forEach((article) => {
        mountOnSearchCard(article, byId.get(vacancyIdFromCard(article)));
    });
}

function mountVacancy(state) {
    const item = extractVacancy(state, location.pathname);
    if (!item) {
        return;
    }
    mountOnVacancyPage(computeSignals(item));
}

function scan() {
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
        resetNegotiationResolveCache();
        lastSerpDomSignature = '';
        lastEmployerSerpPage = null;
    }

    const state = readInitialStateFromDocument();

    if (page === 'search' || page === 'home' || page === 'employer' || page === 'negotiations') {
        if (page === 'search') {
            const domSignature = serpDomSignature();
            if (domSignature !== lastSerpDomSignature) {
                lastSerpDomSignature = domSignature;
                resetSearchShardCache();
            }
        } else if (page === 'employer') {
            const pageIndex = currentSerpPageIndexFromDom();
            if (lastEmployerSerpPage != null && pageIndex !== lastEmployerSerpPage) {
                resetSearchShardCache();
            }
            lastEmployerSerpPage = pageIndex;
        }
        applySearchBadges(state ?? {});
        if (page === 'negotiations' && state) {
            applyNegotiationBadges(state);
            maybeResolveNegotiationVacancyData(state, () => {
                const fresh = readInitialStateFromDocument() ?? state;
                applyNegotiationBadges(fresh);
            });
        }
        if (page === 'search' && state) {
            maybeResolveSearchPageData(state, () => {
                applySearchBadges(readInitialStateFromDocument() ?? state);
            });
        } else if (page === 'employer') {
            maybeResolveEmployerPageData(() => {
                applySearchBadges(readInitialStateFromDocument() ?? {});
            });
        }
        return;
    }

    if (!state) {
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
    const page = detectPage(location.pathname);
    if (page !== 'search' && page !== 'home' && page !== 'employer' && page !== 'negotiations') {
        return;
    }
    applySearchBadges(readInitialStateFromDocument() ?? {});
});

hookHistory();
scan();
observe();
