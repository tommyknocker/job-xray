import {
    extractInitialStateFromHtml,
    extractVacancyPage,
} from './parser.js';
import {
    ingestVacancyMetrics,
    searchSignalsById,
    searchShardCacheSize,
} from './searchShard.js';
import {
    mountOnNegotiationItem,
    NEGOTIATION_ITEM_SELECTOR,
    vacancyIdFromNegotiationItem,
} from './ui.js';

const MAX_VACANCY_FETCHES_PER_PASS = 12;
const FETCH_GAP_MS = 120;

const inFlight = new Set();
const failedIds = new Set();
let resolvePass = 0;

function negotiationsDebug(...args) {
    try {
        if (globalThis.localStorage?.getItem('job-xray-debug') === '1') {
            console.log('[job-xray]', ...args);
        }
    } catch {
        // ignore
    }
}

export function negotiationVacancyIdsFromDom() {
    return [...document.querySelectorAll(NEGOTIATION_ITEM_SELECTOR)]
        .map((item) => vacancyIdFromNegotiationItem(item))
        .filter(Boolean);
}

export function countUnbadgedNegotiationItems() {
    return [...document.querySelectorAll(NEGOTIATION_ITEM_SELECTOR)]
        .filter((item) => !item.querySelector('[data-job-xray]')).length;
}

export function applyNegotiationBadges(state) {
    const byId = searchSignalsById(state ?? {});

    document.querySelectorAll(NEGOTIATION_ITEM_SELECTOR).forEach((item) => {
        const signals = byId.get(vacancyIdFromNegotiationItem(item));
        mountOnNegotiationItem(item, signals?.total != null ? signals : null);
    });
}

async function fetchVacancyMetrics(vacancyId) {
    const url = new URL(`/vacancy/${vacancyId}`, location.origin);
    negotiationsDebug('negotiations fetch', url.toString());
    const response = await fetch(url.toString(), { credentials: 'include' });
    if (!response.ok) {
        negotiationsDebug('negotiations fetch failed', vacancyId, response.status);
        return null;
    }
    const html = await response.text();
    const pageState = extractInitialStateFromHtml(html);
    const item = extractVacancyPage(pageState);
    if (!item || item.id !== vacancyId) {
        return null;
    }
    return item;
}

function idsNeedingMetrics(state) {
    const byId = searchSignalsById(state ?? {});
  return negotiationVacancyIdsFromDom().filter((id) => {
        if (byId.get(id)?.total != null) {
            return false;
        }
        if (inFlight.has(id) || failedIds.has(id)) {
            return false;
        }
        return true;
    });
}

export function resetNegotiationResolveCache() {
    inFlight.clear();
    failedIds.clear();
    resolvePass = 0;
}

export function maybeResolveNegotiationVacancyData(state, onResolved) {
    const pending = idsNeedingMetrics(state);
    if (pending.length === 0) {
        return;
    }

    const pass = resolvePass + 1;
    resolvePass = pass;
    const batch = pending.slice(0, MAX_VACANCY_FETCHES_PER_PASS);

    (async () => {
        for (const id of batch) {
            if (pass !== resolvePass) {
                return;
            }
            inFlight.add(id);
            try {
                const item = await fetchVacancyMetrics(id);
                if (item) {
                    ingestVacancyMetrics(item);
                } else {
                    failedIds.add(id);
                }
            } catch (error) {
                failedIds.add(id);
                negotiationsDebug('negotiations resolve error', id, error);
            } finally {
                inFlight.delete(id);
            }
            if (FETCH_GAP_MS > 0) {
                await new Promise((resolve) => window.setTimeout(resolve, FETCH_GAP_MS));
            }
        }
        if (pass === resolvePass && searchShardCacheSize() > 0) {
            onResolved?.();
        }
    })();
}
