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
    const properties = collectPropertyTypes(vacancy.vacancyProperties);
    const calc = vacancy.vacancyProperties?.calculatedStates?.HH || {};
    const { total, totalAlt } = normalizeResponseTotals(
        extra.vacancyResponsesCount,
        extra.totalResponsesCount,
    );

    return {
        id,
        title: vacancy.name || '',
        total,
        totalAlt,
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
