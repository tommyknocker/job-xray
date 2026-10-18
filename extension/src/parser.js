const STATE_ID = 'HH-Lux-InitialState';

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

export function extractInitialStateFromHtml(html) {
    const match = html.match(
        /<template[^>]*id="HH-Lux-InitialState"[^>]*>([\s\S]*?)<\/template>/i,
    );
    if (!match) {
        return null;
    }

    return parseJsonPayload(match[1]);
}

export function readInitialStateFromDocument(doc = document) {
    const el = doc.getElementById(STATE_ID);
    if (!el) {
        return null;
    }

    const raw = el.innerHTML || el.textContent || '';
    return parseJsonPayload(raw);
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

export function collectPropertyTypes(node, acc = []) {
    if (Array.isArray(node)) {
        node.forEach((item) => collectPropertyTypes(item, acc));
        return acc;
    }
    if (node && typeof node === 'object') {
        if (typeof node.propertyType === 'string') {
            acc.push(node.propertyType);
        }
        Object.values(node).forEach((item) => collectPropertyTypes(item, acc));
    }
    return acc;
}

function boolish(value) {
    return value === true || value === 'true';
}

export function normalizeSearchVacancy(raw) {
    const properties = collectPropertyTypes(raw.vacancyProperties);
    const auto = raw.autoResponse;

    return {
        id: String(raw.vacancyId ?? ''),
        title: raw.name || '',
        total: toInt(raw.totalResponsesCount),
        unread: toInt(raw.responsesCount),
        createdAt: parseIso(raw.creationTime),
        publishedAt: parseIso(raw.publicationTime),
        properties,
        hasTest: boolish(raw.userTestPresent),
        letterRequired: boolish(raw['@responseLetterRequired']),
        autoResponse: boolish(auto?.acceptAutoResponse),
        source: 'search',
    };
}

export function extractSearchVacancies(state) {
    const list = state?.vacancySearchResult?.vacancies;
    if (!Array.isArray(list)) {
        return [];
    }

    return list.map(normalizeSearchVacancy).filter((item) => item.id);
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
    const properties = collectPropertyTypes(vacancy.vacancyProperties);
    const calc = vacancy.vacancyProperties?.calculatedStates?.HH || {};

    return {
        id,
        title: vacancy.name || '',
        total: toInt(extra.vacancyResponsesCount ?? extra.totalResponsesCount),
        totalAlt: toInt(extra.totalResponsesCount),
        unread: null,
        createdAt: parseIso(shortVacancy.creationTime),
        publishedAt: parseIso(vacancy.publicationTimeIso),
        properties,
        tariffLabel: calc.translation || null,
        hasTest: boolish(status.test?.hasTests) || boolish(shortVacancy.userTestPresent),
        letterRequired: boolish(shortVacancy['@responseLetterRequired']),
        autoResponse: boolish(shortVacancy.autoResponse?.acceptAutoResponse),
        ai: {
            nra: boolish(state.hasNraProperty),
            survey: boolish(state.hasNeuroSurveyProperty),
            assistant: boolish(state.hasAiAssistantProperty),
        },
        source: 'vacancy',
    };
}

export function vacancyIdFromPath(pathname) {
    const match = pathname.match(/\/vacancy\/(\d+)/);
    return match ? match[1] : null;
}

export function detectPage(pathname) {
    if (/\/search\/vacancy/.test(pathname)) {
        return 'search';
    }
    if (vacancyIdFromPath(pathname)) {
        return 'vacancy';
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
