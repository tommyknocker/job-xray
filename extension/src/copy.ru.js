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
    viewers: (count) => String(count),
    until: (label) => `до ${label}`,
    expired: 'срок истёк',
    autoRenewal: 'автоподъём',
    bumped: 'подняли',
    boost: 'буст',
    aiReview: 'AI-разбор',
    aiSurvey: 'AI-опрос',
    aiAssistant: 'AI-ассистент',
    aiCall: 'AI-звонок',
    aiInvite: 'AI-инвайт',
    test: 'тест',
    letter: 'письмо',
    altCounter: (count) => `${count} по другому счётчику`,
};

export const TOOLTIP = {
    responses: (n) => `откликов: ${n}`,
    unread: (n) => `неразобранных: ${n}`,
    perDay: (n) => `${n.toFixed(1)} в день`,
    perHour: (n) => `${n.toFixed(1)} в час`,
    viewers: (n) => `сейчас смотрят: ${n}`,
    until: (date) => `размещение до ${date}`,
    expired: 'оплаченный срок размещения уже прошёл',
    autoRenewal: 'вакансию поднимают по расписанию hh',
    bumped: 'дату публикации поднимали (без автоподъёма в тарифе)',
    boost: 'платное продвижение в выдаче',
    aiReview: 'нейроразбор откликов',
    aiSurvey: 'нейроопрос при отклике',
    aiAssistant: 'AI-ассистент на вакансии',
    aiCall: 'саммари звонков нейросетью',
    aiInvite: 'нейроприглашения кандидатам',
    test: 'чтобы откликнуться, нужно пройти тест',
    letter: 'нужно сопроводительное письмо',
};

/** Shown on the “?” next to the job-xray caption (vacancy page). */
export const LEGEND_HELP = `Данные из JSON hh.ru на этой странице. Расширение никуда не отправляет.

Отклики — сколько всего откликов (цифра hh). Цвет: зелёный спокойнее, жёлтый средне, красный горячо, серый «зомби» (давно висит, неразобранных 0).

Неразобр. — неразобранные отклики у работодателя (только в выдаче, если hh отдал поле).

Сегодня / N д — сколько дней с даты создания вакансии, не с последнего «поднятия».

N/час — средний темп за время с публикации, если вакансии меньше суток (не экстраполяция на целый день).

N/день — средний темп откликов в день с даты создания (если вакансия старше суток).

Подняли — дату публикации поднимали вручную. Автоподъём — в тарифе стоит HH_AUTO_RENEWAL (интервал и ближайшая дата в подсказке).

До ДД.ММ — оплаченный срок размещения.

Иконка глаза — сколько человек смотрят вакансию сейчас (не дублируем, если hh уже пишет «Сейчас смотрят»).

Стандарт, Стандарт плюс, Оптимум, Премиум — тариф размещения у работодателя.

Буст — платное продвижение в выдаче. AI-разбор / опрос / ассистент / звонок — разные нейроопции. Тест, письмо — требования отклика.

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
    if (signals.onlineViewers > 0) {
        parts.push(TOOLTIP.viewers(signals.onlineViewers));
    }
    return parts;
}

const MOSCOW_DATE = {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
};

function moscowDateParts(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return null;
    }
    const parts = new Intl.DateTimeFormat('en-GB', MOSCOW_DATE).formatToParts(value);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (!byType.day || !byType.month || !byType.year) {
        return null;
    }
    return byType;
}

export function formatDateRu(value) {
    const parts = moscowDateParts(value);
    return parts ? `${parts.day}.${parts.month}.${parts.year}` : null;
}

export function formatDayMonthRu(value) {
    const parts = moscowDateParts(value);
    return parts ? `${parts.day}.${parts.month}` : null;
}

export function formatEveryDaysRu(minutes) {
    if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) {
        return null;
    }
    const days = minutes / 1440;
    if (Math.abs(days - Math.round(days)) < 0.02) {
        const count = Math.round(days);
        if (count === 1) {
            return 'каждый день';
        }
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod10 === 1 && mod100 !== 11) {
            return `каждые ${count} день`;
        }
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
            return `каждые ${count} дня`;
        }
        return `каждые ${count} дней`;
    }
    const hours = Math.round(minutes / 60);
    if (hours >= 1) {
        return `каждые ${hours} ч`;
    }
    return `каждые ${Math.round(minutes)} мин`;
}

export function ageChipTooltip(signals) {
    const created = formatDateRu(signals.createdAt);
    const published = formatDateRu(signals.publishedAt);
    const lines = [];
    if (created) {
        lines.push(`создана ${created}`);
    }
    if (published) {
        lines.push(`размещена ${published}`);
    }
    return lines.join(' · ') || 'возраст от даты создания, не от последнего поднятия';
}

export function autoRenewalTooltip(signals) {
    const parts = [TOOLTIP.autoRenewal];
    const every = formatEveryDaysRu(signals.autoRenewal?.intervalMinutes);
    if (every) {
        parts.push(every);
    }
    const next = formatDateRu(signals.autoRenewal?.nextAt);
    if (next) {
        parts.push(`следующий ${next}`);
    }
    return parts.join(' · ');
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
