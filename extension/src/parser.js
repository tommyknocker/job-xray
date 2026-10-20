export const STATE_ID = 'HH-Lux-InitialState';

function unescapeHtml(raw) {
    return raw
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#x22;/gi, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function parseJsonPayload(raw) {
    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }

    try {
        return JSON.parse(trimmed);
    } catch {
        return JSON.parse(unescapeHtml(trimmed));
    }
}

function stripViewSourceInspectorHtml(html) {
    if (!html.includes('html-attribute-value')) {
        return html;
    }

    return unescapeHtml(
        html
            .replace(/<span class="html-[^"]*">/gi, '')
            .replace(/<\/span>/gi, ''),
    );
}

function extractJsonAfterMarker(html, marker = STATE_ID) {
    const idx = html.indexOf(marker);
    if (idx < 0) {
        return null;
    }

    const start = html.indexOf('{', idx);
    if (start < 0) {
        return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < html.length; i += 1) {
        const ch = html[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{') {
            depth += 1;
        } else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                try {
                    return parseJsonPayload(html.slice(start, i + 1));
                } catch {
                    return null;
                }
            }
        }
    }

    return null;
}

export function extractInitialStateFromHtml(html) {
    const templateMatch = html.match(
        /<template[^>]*id="HH-Lux-InitialState"[^>]*>([\s\S]*?)<\/template>/i,
    );
    if (templateMatch) {
        return parseJsonPayload(templateMatch[1]);
    }

    for (const candidate of [html, stripViewSourceInspectorHtml(html)]) {
        const fromMarker = extractJsonAfterMarker(candidate);
        if (fromMarker) {
            return fromMarker;
        }

        const nestedTemplate = candidate.match(
            /<template[^>]*id="HH-Lux-InitialState"[^>]*>([\s\S]*?)<\/template>/i,
        );
        if (nestedTemplate) {
            return parseJsonPayload(nestedTemplate[1]);
        }
    }

    return null;
}

export function normalizeResponseTotals(vacancyResponsesCount, totalResponsesCount) {
    const vrc = toInt(vacancyResponsesCount);
    const trc = toInt(totalResponsesCount);

    return {
        total: vrc ?? trc,
        totalAlt: trc,
    };
}

function rawStateFromElement(el) {
    const candidates = [
        el.content?.textContent,
        el.textContent,
        el.innerHTML,
    ];
    return candidates.find((value) => typeof value === 'string' && value.trim()) || '';
}

export function readInitialStateFromDocument(doc = document) {
    const el = doc.getElementById(STATE_ID);
    if (!el) {
        return null;
    }

    return parseJsonPayload(rawStateFromElement(el));
}

function toInt(value) {
    if (value == null || value === '') {
        return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export function parseIso(value) {
    if (!value) {
        return null;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'object') {
        if (typeof value.$ === 'string') {
            return parseIso(value.$);
        }
        if (typeof value['@timestamp'] === 'number') {
            return new Date(value['@timestamp'] * 1000);
        }
    }
    return null;
}

const HH_TARIFF_TYPES = new Set([
    'HH_PREMIUM',
    'HH_VP_OPTIMUM',
    'HH_STANDARD_PLUS',
    'HH_STANDARD',
]);

function flattenParams(node, acc = {}) {
    if (node == null) {
        return acc;
    }
    if (Array.isArray(node)) {
        node.forEach((item) => flattenParams(item, acc));
        return acc;
    }
    if (typeof node === 'object') {
        if (typeof node.key === 'string' && 'value' in node) {
            acc[node.key] = node.value;
            return acc;
        }
        Object.values(node).forEach((item) => flattenParams(item, acc));
    }
    return acc;
}

export function collectProperties(node, acc = []) {
    if (Array.isArray(node)) {
        node.forEach((item) => collectProperties(item, acc));
        return acc;
    }
    if (node && typeof node === 'object') {
        if (typeof node.propertyType === 'string') {
            acc.push({
                type: node.propertyType,
                start: parseIso(node.startTimeIso),
                end: parseIso(node.endTimeIso),
                params: flattenParams(node.parameters),
            });
            return acc;
        }
        Object.values(node).forEach((item) => collectProperties(item, acc));
    }
    return acc;
}

export function collectPropertyTypes(node, acc = []) {
    for (const item of collectProperties(node)) {
        acc.push(item.type);
    }
    return acc;
}

function autoRenewalFromProperties(props) {
    const match = props.find((item) => item.type === 'HH_AUTO_RENEWAL');
    if (!match) {
        return null;
    }
    return {
        intervalMinutes: toInt(match.params?.intervalMinutes),
        nextAt: parseIso(match.params?.nextActivationTimeIso),
    };
}

function listingEndsAtFrom(props, fallbackIso) {
    const fallback = parseIso(fallbackIso);
    if (fallback) {
        return fallback;
    }
    const tariff = props.find((item) => HH_TARIFF_TYPES.has(item.type) && item.end);
    if (tariff) {
        return tariff.end;
    }
    const hh = props.find((item) => item.type.startsWith('HH_') && item.end);
    return hh?.end ?? null;
}

function onlineViewersFromCounters(counters, id) {
    const row = counters?.[id];
    if (!row || typeof row !== 'object') {
        return null;
    }
    const excluding = toInt(row.excludingCurrent);
    if (excluding != null) {
        return excluding;
    }
    return toInt(row.includingCurrent);
}

function boolish(value) {
    return value === true || value === 'true';
}

export function normalizeSearchVacancy(raw) {
    const collected = collectProperties(raw.vacancyProperties);
    const properties = collected.map((item) => item.type);
    const auto = raw.autoResponse;
    const { total, totalAlt } = normalizeResponseTotals(
        raw.vacancyResponsesCount,
        raw.totalResponsesCount,
    );

    return {
        id: String(raw.vacancyId ?? ''),
        title: raw.name || '',
        total,
        totalAlt,
        unread: toInt(raw.responsesCount),
        createdAt: parseIso(raw.creationTime),
        publishedAt: parseIso(raw.publicationTime),
        properties,
        listingEndsAt: listingEndsAtFrom(collected),
        autoRenewal: autoRenewalFromProperties(collected),
        onlineViewers: toInt(raw.online_users_count),
        hasTest: boolish(raw.userTestPresent),
        letterRequired: boolish(raw['@responseLetterRequired']),
        autoResponse: boolish(auto?.acceptAutoResponse),
        source: 'search',
    };
}

function vacancyListFromState(state) {
    if (Array.isArray(state?.vacancySearchResult?.vacancies)) {
        return state.vacancySearchResult.vacancies;
    }
    if (Array.isArray(state?.recommendedVacancies?.vacancies)) {
        return state.recommendedVacancies.vacancies;
    }
    /** Employer «О компании» — «Подходящие вакансии» (SSR in InitialState). */
    if (Array.isArray(state?.employerChameleonVacancies?.vacancies)) {
        return state.employerChameleonVacancies.vacancies;
    }
    return [];
}

export function extractSearchVacancies(state) {
    return vacancyListFromState(state).map(normalizeSearchVacancy).filter((item) => item.id);
}

/** `/shards/vacancy/search` — SPA pagination on vacancy search. */
export function extractSearchVacanciesShard(payload) {
    const list = payload?.vacancySearchResult?.vacancies
        ?? payload?.employerVacancySearch?.vacancies
        ?? payload?.vacancies;
    if (!Array.isArray(list)) {
        return [];
    }

    return list.map(normalizeSearchVacancy).filter((item) => item.id);
}

/** `/shards/vacancy/related_vacancies` — «Вам подойдут эти вакансии» on vacancy page. */
export function extractRelatedVacanciesShard(payload) {
    if (!Array.isArray(payload?.vacancies)) {
        return [];
    }

    return payload.vacancies.map(normalizeSearchVacancy).filter((item) => item.id);
}

function vacancyIdFromState(state, vacancy) {
    return String(
        vacancy?.vacancyId
        ?? vacancy?.id
        ?? state?.analyticsParams?.vacancyId
        ?? '',
    );
}

export function extractVacancyPage(state) {
    const full = state?.vacancyView?.vacancyFull;
    const vacancy = full?.vacancy;
    if (!vacancy) {
        return null;
    }

    const id = vacancyIdFromState(state, vacancy);
    if (!id) {
        return null;
    }

    const extra = full.extraVacancyFields || {};
    const status = state.applicantVacancyResponseStatuses?.[id] || {};
    const shortVacancy = status.shortVacancy || {};
    const collected = collectProperties(vacancy.vacancyProperties);
    const shortCollected = collectProperties(shortVacancy.vacancyProperties);
    const properties = (collected.length ? collected : shortCollected).map((item) => item.type);
    const calc = vacancy.vacancyProperties?.calculatedStates?.HH || {};
    const { total, totalAlt } = normalizeResponseTotals(
        extra.vacancyResponsesCount,
        extra.totalResponsesCount,
    );
    const propsForMeta = collected.length ? collected : shortCollected;

    return {
        id,
        title: vacancy.name || '',
        total,
        totalAlt,
        unread: null,
        createdAt: parseIso(shortVacancy.creationTime),
        publishedAt: parseIso(vacancy.publicationTimeIso),
        properties,
        listingEndsAt: listingEndsAtFrom(propsForMeta, vacancy.validToTimeIso),
        autoRenewal: autoRenewalFromProperties(propsForMeta),
        onlineViewers: onlineViewersFromCounters(state.vacancyOnlineUsersCounters, id),
        tariffLabel: calc.translation || null,
        hasTest: boolish(status.test?.hasTests) || boolish(shortVacancy.userTestPresent),
        letterRequired: boolish(shortVacancy['@responseLetterRequired']),
        autoResponse: boolish(shortVacancy.autoResponse?.acceptAutoResponse),
        ai: {
            nra: boolish(state.hasNraProperty),
            survey: boolish(state.hasNeuroSurveyProperty),
            assistant: boolish(state.hasAiAssistantProperty),
            callSummary: boolish(state.hasCallSummaryProperty),
            invite: boolish(state.hasNeuroInviteProperty),
        },
        source: 'vacancy',
    };
}

export function vacancyIdFromPath(pathname) {
    const match = pathname.match(/\/vacancy\/(\d+)/);
    return match ? match[1] : null;
}

export function employerIdFromPath(pathname) {
    const match = pathname.match(/\/employer\/(\d+)/);
    return match ? match[1] : null;
}

export function detectPage(pathname) {
    if (/\/search\/vacancy/.test(pathname)) {
        return 'search';
    }
    if (/\/employer\/\d+/.test(pathname)) {
        return 'employer';
    }
    if (vacancyIdFromPath(pathname)) {
        return 'vacancy';
    }
    if (pathname === '/' || pathname === '') {
        return 'home';
    }
    return null;
}

export function extractVacancy(state, pathname = '') {
    const fromPage = extractVacancyPage(state);
    const urlId = vacancyIdFromPath(pathname);
    if (fromPage && (!urlId || fromPage.id === urlId)) {
        return fromPage;
    }
    if (!urlId) {
        return fromPage;
    }
    return extractSearchVacancies(state).find((item) => item.id === urlId) || fromPage;
}
