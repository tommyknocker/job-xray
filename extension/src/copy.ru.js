/**
 * Russian strings shown on hh.ru (extension UI). Everything else in the repo is English.
 */

export const TARIFF_BY_PROPERTY = [
    ['HH_PREMIUM', 'Премиум'],
    ['HH_VP_OPTIMUM', 'Оптимум'],
    ['HH_STANDARD_PLUS', 'Стандарт плюс'],
    ['HH_STANDARD', 'Стандарт'],
];

export const CHIP = {
    responses: (count, unstable) => `${unstable ? '~' : ''}${count} откл.`,
    unread: (count) => `${count} неразобр.`,
    bumped: 'подняли',
    boost: 'буст',
    aiReview: 'AI-разбор',
    test: 'тест',
    letter: 'письмо',
    altCounter: (count) => `${count} по другому счётчику`,
};

export const TOOLTIP = {
    responses: (n) => `откликов: ${n}`,
    unread: (n) => `неразобранных: ${n}`,
    perDay: (n) => `${n.toFixed(1)} в день`,
};

export function formatPerDayRu(value) {
    if (value == null || Number.isNaN(value)) {
        return null;
    }
    if (value < 10) {
        return `${value.toFixed(1).replace('.', ',')}/день`;
    }
    return `${Math.round(value)}/день`;
}

export function formatAgeRu(days) {
    if (days == null || Number.isNaN(days)) {
        return null;
    }
    if (days < 1) {
        return 'сегодня';
    }
    if (days < 1.5) {
        return '1 д';
    }
    if (days >= 365) {
        return `${(days / 365).toFixed(1).replace('.', ',')} г`;
    }
    return `${Math.round(days)} д`;
}
