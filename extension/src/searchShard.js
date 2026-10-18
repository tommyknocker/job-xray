import {
    extractInitialStateFromHtml,
    extractSearchVacancies,
    extractSearchVacanciesShard,
} from './parser.js';
import { computeSignals } from './metrics.js';
import { SERP_CARD_SELECTOR, vacancyIdFromCard } from './ui.js';

const shardById = new Map();
let searchShardListenerRegistered = false;
let resolveTimer = 0;
let resolveInFlight = false;
let lastResolvedKey = '';
const failedResolveKeys = new Set();

const SEARCH_MOUNT_RETRY_MS = [0, 200];

function debug(...args) {
    try {
        if (globalThis.localStorage?.getItem('job-xray-debug') === '1') {
            console.log('[job-xray]', ...args);
        }
    } catch {
        // ignore
    }
}

export function ingestSearchVacanciesShard(payload) {
    for (const item of extractSearchVacanciesShard(payload)) {
        shardById.set(item.id, computeSignals(item));
    }
}

export function resetSearchShardCache() {
    shardById.clear();
    lastResolvedKey = '';
    failedResolveKeys.clear();
}

/** @internal tests */
export function searchShardCacheSize() {
    return shardById.size;
}

export function searchSignalsById(state) {
    const byId = new Map(
        extractSearchVacancies(state)
            .map((item) => computeSignals(item))
            .map((item) => [item.id, item]),
    );

    for (const [id, signals] of shardById) {
        byId.set(id, signals);
    }

    return byId;
}

export function serpDomSignature() {
    const ids = [...document.querySelectorAll(SERP_CARD_SELECTOR)]
        .slice(0, 3)
        .map((article) => vacancyIdFromCard(article))
        .filter(Boolean);
    return `${currentSerpPageIndexFromDom()}:${ids.join(',')}`;
}

export function countUnbadgedSerpCards() {
    return [...document.querySelectorAll(SERP_CARD_SELECTOR)]
        .filter((article) => !article.querySelector('[data-job-xray]')).length;
}

export function serpDomStateMismatch(state) {
    const domFirst = vacancyIdFromCard(
        document.querySelector(SERP_CARD_SELECTOR),
    );
    const stateFirst = extractSearchVacancies(state)[0]?.id;
    return Boolean(domFirst && stateFirst && domFirst !== stateFirst);
}

export function needsSearchPageResolve(state) {
    const unbadged = countUnbadgedSerpCards();
    if (unbadged === 0) {
        return false;
    }
    if (shardById.size > 0) {
        return unbadged > 0;
    }
    return unbadged > 0 || serpDomStateMismatch(state);
}

export function searchSessionIdFromDom(state) {
    if (state?.searchSessionId) {
        return String(state.searchSessionId);
    }
    const link = document.querySelector('a[href*="search_session_id="]');
    if (!link) {
        return '';
    }
    try {
        return new URL(link.href, location.origin).searchParams.get('search_session_id') || '';
    } catch {
        return '';
    }
}

/** hh pager: `page=0` in href is UI page 1; active link has `aria-current="true"`. */
export function currentSerpPageIndexFromDom() {
    const active = document.querySelector('a[data-qa="pager-page"][aria-current="true"]');
    if (active?.getAttribute('href')) {
        try {
            const page = new URL(active.getAttribute('href'), location.origin).searchParams.get('page');
            if (page != null && page !== '') {
                return Number(page) || 0;
            }
        } catch {
            // ignore
        }
    }

    const params = new URLSearchParams(location.search);
    if (params.has('page')) {
        return Number(params.get('page')) || 0;
    }
    return 0;
}

export function ingestSearchVacanciesHtml(html) {
    const state = extractInitialStateFromHtml(html);
    if (!state) {
        debug('search html: no InitialState parsed');
        return false;
    }
    shardById.clear();
    ingestSearchVacanciesShard(state);
    debug('search html: ingested', shardById.size, 'vacancies');
    return true;
}

async function fetchSearchVacancyHtml(pageIndex, sessionId) {
    const url = new URL('/search/vacancy', location.origin);
    const params = new URLSearchParams(location.search);
    params.set('page', String(pageIndex));
    params.set('search_session_id', sessionId);
    url.search = params.toString();
    debug('search fetch', url.toString());
    const response = await fetch(url.toString(), { credentials: 'include' });
    if (!response.ok) {
        debug('search fetch failed', response.status);
        return null;
    }
    return response.text();
}

function scheduleMount(callback) {
    for (const delay of SEARCH_MOUNT_RETRY_MS) {
        window.setTimeout(callback, delay);
    }
}

export function maybeResolveSearchPageData(state, onResolved) {
    if (!needsSearchPageResolve(state)) {
        return;
    }

    const pageIndex = currentSerpPageIndexFromDom();
    const sessionId = searchSessionIdFromDom(state);
    if (!sessionId) {
        debug('search resolve: no search_session_id');
        return;
    }

    const key = `${pageIndex}:${sessionId}:${serpDomSignature()}`;
    if (failedResolveKeys.has(key)) {
        return;
    }
    if (key === lastResolvedKey && shardById.size > 0) {
        onResolved?.();
        return;
    }

    if (resolveTimer) {
        window.clearTimeout(resolveTimer);
    }
    resolveTimer = window.setTimeout(async () => {
        resolveTimer = 0;
        if (resolveInFlight) {
            return;
        }
        resolveInFlight = true;
        try {
            const html = await fetchSearchVacancyHtml(pageIndex, sessionId);
            if (html && ingestSearchVacanciesHtml(html)) {
                lastResolvedKey = key;
                onResolved?.();
            } else {
                failedResolveKeys.add(key);
            }
        } catch (error) {
            debug('search resolve error', error);
            failedResolveKeys.add(key);
        } finally {
            resolveInFlight = false;
        }
    }, 300);
}

export function registerSearchShardListener(onPayload) {
    if (searchShardListenerRegistered) {
        return;
    }
    searchShardListenerRegistered = true;
    window.addEventListener('job-xray-search', (event) => {
        resetSearchShardCache();
        ingestSearchVacanciesShard(event.detail);
        scheduleMount(onPayload);
    });
    window.addEventListener('job-xray-search-page-html', (event) => {
        if (ingestSearchVacanciesHtml(event.detail?.html)) {
            scheduleMount(onPayload);
        }
    });
}
