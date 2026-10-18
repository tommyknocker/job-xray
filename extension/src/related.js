import { extractRelatedVacanciesShard, vacancyIdFromPath } from './parser.js';
import { computeSignals } from './metrics.js';
import { mountOnSearchCard, vacancyIdFromCard } from './ui.js';

/** Merged across every related_vacancies?page=N response on the same vacancy page. */
const relatedById = new Map();
let relatedListenerRegistered = false;
let suitableHeading = null;
let hookSawPayload = false;
let apiFallbackStarted = false;

const RELATED_MOUNT_RETRY_MS = [0, 80, 250, 600];

function findSuitableHeading() {
    if (suitableHeading && document.contains(suitableHeading)) {
        return suitableHeading;
    }
    suitableHeading = null;

    const pattern = /подойдут эти вакансии|вам подойд|похожие вакансии/i;
    const nodes = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [data-qa]');
    for (const node of nodes) {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (!pattern.test(text)) {
            continue;
        }
        suitableHeading = node;
        return node;
    }
    return null;
}

function isMainVacancyArticle(article) {
    return Boolean(
        article.closest('[data-qa="vacancy-description"]')
        || article.closest('[data-qa="vacancy-view"]')
        || article.querySelector('[data-qa="vacancy-response-link-top"]'),
    );
}

/** Cards in the recommendation block (including pages appended after scroll). */
function isInRelatedBlock(node) {
    if (!node || isMainVacancyArticle(node)) {
        return false;
    }
    const heading = findSuitableHeading();
    if (!heading) {
        return !node.closest('[data-qa="vacancy-view"]');
    }
    const position = heading.compareDocumentPosition(node);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return true;
    }
    const block = heading.closest('section') || heading.parentElement;
    return Boolean(block && block.contains(node) && node !== heading);
}

function articleForVacancyId(id) {
    for (const link of document.querySelectorAll(`a[href*="/vacancy/${id}"]`)) {
        const article = link.closest('article[data-qa="vacancy-serp__vacancy"]')
            || link.closest('article')
            || link.closest('[class*="vacancy"]');
        if (article && isInRelatedBlock(article)) {
            return article;
        }
    }
    return null;
}

function hasSearchBadge(id) {
    return Boolean(document.querySelector(`[data-job-xray="${id}"][data-job-xray-surface="search"]`));
}

export function ingestRelatedVacanciesPayload(payload) {
    for (const item of extractRelatedVacanciesShard(payload)) {
        relatedById.set(item.id, computeSignals(item));
    }
}

export function resetRelatedVacancyCache() {
    relatedById.clear();
    suitableHeading = null;
    hookSawPayload = false;
    apiFallbackStarted = false;
}

async function fetchRelatedPage(vacancyId, searchSessionId, page) {
    const url = new URL('/shards/vacancy/related_vacancies', location.origin);
    url.searchParams.set('vacancyId', vacancyId);
    url.searchParams.set('page', String(page));
    url.searchParams.set('search_session_id', searchSessionId);
    url.searchParams.set('hhtmSourceLabel', 'suitable_vacancies');
    const response = await fetch(url.toString(), { credentials: 'include' });
    if (!response.ok) {
        return null;
    }
    return response.json();
}

/** If page-world hook missed requests, pull the same shard from the content script (cookies included). */
export function maybeFetchRelatedVacancies(state, onLoaded) {
    if (apiFallbackStarted) {
        return;
    }
    const vacancyId = currentVacancyIdForPage(state);
    const searchSessionId = state?.searchSessionId;
    if (!vacancyId || !searchSessionId) {
        return;
    }

    apiFallbackStarted = true;
    window.setTimeout(async () => {
        if (hookSawPayload && relatedById.size > 0) {
            return;
        }
        for (let page = 0; page < 12; page += 1) {
            try {
                const payload = await fetchRelatedPage(vacancyId, searchSessionId, page);
                if (!payload?.vacancies?.length) {
                    break;
                }
                ingestRelatedVacanciesPayload(payload);
                onLoaded();
                const totalPages = Number(payload.totalPages) || 1;
                if (page + 1 >= totalPages) {
                    break;
                }
            } catch {
                break;
            }
        }
    }, 1500);
}

/** @internal tests */
export function relatedVacancyCacheSize() {
    return relatedById.size;
}

export function mountRelatedVacancyCards(excludeVacancyId = '') {
    if (relatedById.size === 0) {
        return;
    }

    for (const [id, signals] of relatedById) {
        if (excludeVacancyId && id === excludeVacancyId) {
            continue;
        }
        if (hasSearchBadge(id)) {
            continue;
        }

        const article = articleForVacancyId(id);
        if (!article || article.querySelector('[data-job-xray]')) {
            continue;
        }
        mountOnSearchCard(article, signals);
    }

    document.querySelectorAll('article[data-qa="vacancy-serp__vacancy"]').forEach((article) => {
        if (!isInRelatedBlock(article)) {
            return;
        }
        const id = vacancyIdFromCard(article);
        if (!id || id === excludeVacancyId || article.querySelector('[data-job-xray]')) {
            return;
        }
        const signals = relatedById.get(id);
        if (signals) {
            mountOnSearchCard(article, signals);
        }
    });
}

function scheduleRelatedMount(callback) {
    for (const delay of RELATED_MOUNT_RETRY_MS) {
        window.setTimeout(callback, delay);
    }
}

export function currentVacancyIdForPage(state) {
    return vacancyIdFromPath(location.pathname)
        || String(state?.analyticsParams?.vacancyId ?? state?.vacancyView?.vacancyFull?.vacancy?.vacancyId ?? '');
}

export function registerRelatedVacanciesListener(onPayload) {
    if (relatedListenerRegistered) {
        return;
    }
    relatedListenerRegistered = true;
    window.addEventListener('job-xray-related', (event) => {
        hookSawPayload = true;
        ingestRelatedVacanciesPayload(event.detail);
        scheduleRelatedMount(onPayload);
    });
}
