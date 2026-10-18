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
    perHour: (n) => `${n.toFixed(1)} в час`,
};

/** Shown on the “?” next to the job-xray caption (vacancy page). */
export const LEGEND_HELP = `Данные из JSON hh.ru на этой странице. Расширение никуда не отправляет.

Отклики — сколько всего откликов (цифра hh). Цвет: зелёный спокойнее, жёлтый средне, красный горячо, серый «зомби» (давно висит, неразобранных 0).

Неразобр. — неразобранные отклики у работодателя (только в выдаче, если hh отдал поле).

Сегодня / N д — сколько дней с даты создания вакансии, не с последнего «поднятия».

N/час — средний темп за время с публикации, если вакансии меньше суток (не экстраполяция на целый день).

N/день — средний темп откликов в день с даты создания (если вакансия старше суток).

Подняли — дата публикации заметно новее даты создания (вакансию поднимали в ленте).

Стандарт, Стандарт плюс, Оптимум, Премиум — тариф размещения у работодателя.

Буст — платное продвижение в выдаче. AI-разбор, тест, письмо — требования/опции отклика.

~ и «по другому счётчику» — hh показывает два разных счётчика откликов; основной с ~.`;

/** Tooltip lines are per surface (search vs vacancy); hh uses different counters in each payload. */
export function badgeTooltipParts(signals, variant) {
    const parts = [];
    if (signals.title) {
        parts.push(signals.title);
    }
    if (signals.total != null) {
        if (variant === 'search') {
            parts.push(`откликов (выдача hh.ru): ${signals.total}`);
            if (signals.countersUnstable && signals.totalAlt != null) {
                parts.push(`ещё счётчик в выдаче: ${signals.totalAlt}`);
            }
        } else {
            parts.push(`откликов (страница вакансии): ${signals.total}`);
            if (signals.countersUnstable && signals.totalAlt != null) {
                parts.push(`ещё счётчик на странице: ${signals.totalAlt}`);
            }
        }
    }
    if (signals.unread != null) {
        parts.push(TOOLTIP.unread(signals.unread));
    }
    if (signals.perHour != null) {
        parts.push(TOOLTIP.perHour(signals.perHour));
    } else if (signals.perDay != null) {
        parts.push(TOOLTIP.perDay(signals.perDay));
    }
    return parts;
}

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
