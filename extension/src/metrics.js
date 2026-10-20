import { TARIFF_BY_PROPERTY, formatAgeRu, formatPerDayRu } from './copy.ru.js';

const BOOST_PROPERTIES = new Set([
    'HH_CLICKME_BOOST',
    'HH_SEARCH_RESULTS_PREMIUM_POSITION',
    'HH_AUCTION',
]);

const numberFormat = new Intl.NumberFormat('ru-RU');

export function pickTariff(properties = [], label = null) {
    if (label) {
        return label;
    }
    for (const [type, name] of TARIFF_BY_PROPERTY) {
        if (properties.includes(type)) {
            return name;
        }
    }
    return null;
}

function daysBetween(from, to) {
    if (!from || !to) {
        return null;
    }
    return (to.getTime() - from.getTime()) / 86_400_000;
}

export function toneOf({ total, perDay, ageDays, unread }) {
    if (ageDays != null && ageDays > 60 && unread === 0) {
        return 'zombie';
    }
    if (ageDays != null && ageDays > 60) {
        if (perDay != null && perDay > 50) {
            return 'hot';
        }
        return 'mid';
    }
    if ((perDay != null && perDay > 150) || (total != null && total > 1000)) {
        return 'hot';
    }
    if ((perDay == null || perDay < 50) && (total == null || total < 400)) {
        return 'good';
    }
    return 'mid';
}

function inferAi(item) {
    const properties = item.properties || [];
    const fromItem = item.ai || {};
    return {
        nra: Boolean(fromItem.nra) || properties.includes('HH_NEURO_RESPONSE_ANALYZER'),
        survey: Boolean(fromItem.survey) || properties.includes('HH_NEURO_SURVEY'),
        assistant: Boolean(fromItem.assistant) || properties.includes('HH_AI_ASSISTANT'),
        callSummary: Boolean(fromItem.callSummary) || properties.includes('HH_NEURO_CALL_SUMMARY'),
        invite: Boolean(fromItem.invite),
    };
}

export function computeSignals(item, now = new Date()) {
    const ageDays = daysBetween(item.createdAt, now);
    const publishedDays = daysBetween(item.publishedAt, now);
    const properties = item.properties || [];
    const autoRenewal = item.autoRenewal
        || (properties.includes('HH_AUTO_RENEWAL')
            ? { intervalMinutes: null, nextAt: null }
            : null);
    const bumped = !autoRenewal && item.createdAt && item.publishedAt
        ? item.publishedAt.getTime() - item.createdAt.getTime() > 20 * 3_600_000
        : false;

    const safeAge = ageDays != null && ageDays > 0 ? Math.max(ageDays, 1 / 24) : null;
    const perDayForTone = item.total != null && safeAge != null ? item.total / safeAge : null;
    const perDay = item.total != null && ageDays != null && ageDays >= 1
        ? item.total / ageDays
        : null;
    const perHour = item.total != null && ageDays != null && ageDays > 0 && ageDays < 1
        ? item.total / (ageDays * 24)
        : null;
    const ai = inferAi(item);
    const totalAlt = item.totalAlt ?? null;
    const countersUnstable = totalAlt != null
        && item.total != null
        && Math.abs(item.total - totalAlt) > 20;
    const listingEndsAt = item.listingEndsAt instanceof Date ? item.listingEndsAt : null;
    const listingDaysLeft = daysBetween(now, listingEndsAt);
    const onlineViewers = Number.isFinite(item.onlineViewers) ? item.onlineViewers : null;

    return {
        ...item,
        ageDays,
        publishedDays,
        autoRenewal,
        bumped,
        perDay,
        perHour,
        perDayForTone,
        tone: toneOf({
            total: item.total,
            perDay: perDayForTone,
            ageDays,
            unread: item.unread,
        }),
        tariff: pickTariff(properties, item.tariffLabel),
        boosted: properties.some((type) => BOOST_PROPERTIES.has(type)),
        ai,
        hasAi: ai.nra || ai.survey || ai.assistant || ai.callSummary || ai.invite,
        listingEndsAt,
        listingDaysLeft,
        onlineViewers,
        countersUnstable,
    };
}

export function formatCount(value) {
    if (value == null || Number.isNaN(value)) {
        return '—';
    }
    return numberFormat.format(Math.round(value));
}

export function formatDisplayRate(signals) {
    if (signals.perHour != null) {
        return formatPerHourRu(signals.perHour);
    }
    if (signals.perDay != null) {
        return formatPerDayRu(signals.perDay);
    }
    return null;
}

function formatPerHourRu(value) {
    if (value == null || Number.isNaN(value)) {
        return null;
    }
    if (value < 10) {
        return `${value.toFixed(1).replace('.', ',')}/час`;
    }
    return `${Math.round(value)}/час`;
}

export const formatPerDay = formatPerDayRu;
export const formatAge = formatAgeRu;
