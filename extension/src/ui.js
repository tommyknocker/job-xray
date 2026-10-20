import {
    CHIP,
    LEGEND_HELP,
    TOOLTIP,
    ageChipTooltip,
    autoRenewalTooltip,
    formatDateRu,
    formatDayMonthRu,
} from './copy.ru.js';
import { formatAge, formatCount, formatDisplayRate } from './metrics.js';

const STYLES = `
:host {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: visible;
  font-family: Inter, "Helvetica Neue", Arial, sans-serif;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  overflow: visible;
}
.chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.chip[aria-label] {
  cursor: help;
}
.ico {
  display: inline-flex;
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
}
.ico svg {
  display: block;
  width: 12px;
  height: 12px;
}
.tip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 6px);
  transform: translateX(-50%);
  z-index: 4;
  width: max-content;
  max-width: min(240px, 70vw);
  padding: 6px 8px;
  border-radius: 8px;
  background: #1d2939;
  color: #fff;
  font-size: 11px;
  line-height: 14px;
  font-weight: 500;
  letter-spacing: 0;
  text-align: center;
  white-space: normal;
  box-shadow: 0 8px 16px rgba(16, 24, 40, 0.18);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
.chip:hover,
.chip:focus-visible {
  z-index: 5;
}
.chip:hover .tip,
.chip:focus-visible .tip {
  opacity: 1;
  visibility: visible;
}
.good { background: #e7f6ee; color: #17643d; }
.mid { background: #fff3d0; color: #7a5600; }
.hot { background: #fde7e5; color: #9f1f16; }
.zombie { background: #eef0f3; color: #4b5565; }
.muted { background: #f2f4f7; color: #344054; font-weight: 500; }
.panel {
  padding: 8px 10px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e4e7ec;
  overflow: visible;
}
.caption-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
}
.caption {
  margin: 0;
  font-size: 11px;
  line-height: 14px;
  font-weight: 600;
  color: #667085;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.help {
  margin: 0;
  padding: 0;
  width: 16px;
  height: 16px;
  border: 1px solid #d0d5dd;
  border-radius: 50%;
  background: #fff;
  color: #667085;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  cursor: help;
  font-family: inherit;
}
.help:hover,
.help:focus-visible {
  border-color: #98a2b3;
  color: #344054;
}
`;

const SVG_NS = 'http://www.w3.org/2000/svg';

const ICONS = {
    eye: [
        { name: 'path', d: 'M1.5 8s2.6-4.5 6.5-4.5S14.5 8 14.5 8s-2.6 4.5-6.5 4.5S1.5 8 1.5 8Z' },
        { name: 'circle', cx: '8', cy: '8', r: '1.8' },
    ],
    calendar: [
        { name: 'rect', x: '2.25', y: '3.25', width: '11.5', height: '10.5', rx: '1.5' },
        { name: 'path', d: 'M2.25 6.5h11.5M5.25 2.25v2M10.75 2.25v2' },
    ],
    refresh: [
        { name: 'path', d: 'M13.2 8A5.2 5.2 0 1 1 11.6 3.7' },
        { name: 'path', d: 'M11 2.4h2.6V5' },
    ],
};

function svgNode(name, attrs) {
    const el = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, value);
    }
    return el;
}

function iconElement(name) {
    const parts = ICONS[name];
    if (!parts) {
        return null;
    }
    const svg = svgNode('svg', {
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '1.5',
        'aria-hidden': 'true',
    });
    if (name === 'refresh') {
        svg.setAttribute('stroke-linecap', 'round');
    }
    for (const part of parts) {
        const { name: tag, ...attrs } = part;
        svg.appendChild(svgNode(tag, attrs));
    }
    return svg;
}

function chip({ text, tone, icon, tooltip }) {
    const el = document.createElement('span');
    el.className = `chip ${tone}`;
    const markSvg = icon ? iconElement(icon) : null;
    if (markSvg) {
        const mark = document.createElement('span');
        mark.className = 'ico';
        mark.appendChild(markSvg);
        el.appendChild(mark);
    }
    const label = document.createElement('span');
    label.textContent = text;
    el.appendChild(label);
    if (tooltip) {
        el.setAttribute('aria-label', tooltip);
        const tip = document.createElement('span');
        tip.className = 'tip';
        tip.textContent = tooltip;
        el.appendChild(tip);
    }
    return el;
}

function pushAiChips(chips, signals) {
    const ai = signals.ai || {};
    if (ai.nra) {
        chips.push({ text: CHIP.aiReview, tone: 'mid', tooltip: TOOLTIP.aiReview });
    }
    if (ai.survey) {
        chips.push({ text: CHIP.aiSurvey, tone: 'mid', tooltip: TOOLTIP.aiSurvey });
    }
    if (ai.assistant) {
        chips.push({ text: CHIP.aiAssistant, tone: 'mid', tooltip: TOOLTIP.aiAssistant });
    }
    if (ai.callSummary) {
        chips.push({ text: CHIP.aiCall, tone: 'mid', tooltip: TOOLTIP.aiCall });
    }
    if (ai.invite) {
        chips.push({ text: CHIP.aiInvite, tone: 'mid', tooltip: TOOLTIP.aiInvite });
    }
}

export function chipsFor(signals, variant, options = {}) {
    const chips = [];
    if (signals.total != null) {
        chips.push({
            text: CHIP.responses(formatCount(signals.total), signals.countersUnstable),
            tone: signals.tone,
            tooltip: variant === 'search'
                ? `откликов (выдача hh.ru): ${formatCount(signals.total)}`
                : `откликов (страница вакансии): ${formatCount(signals.total)}`,
        });
    }
    const showViewers = signals.onlineViewers > 0 && !options.hideOnlineViewers;
    if (showViewers) {
        chips.push({
            text: CHIP.viewers(formatCount(signals.onlineViewers)),
            tone: 'muted',
            icon: 'eye',
            tooltip: TOOLTIP.viewers(signals.onlineViewers),
        });
    }
    const rate = formatDisplayRate(signals);
    if (rate) {
        chips.push({
            text: rate,
            tone: 'muted',
            tooltip: signals.perHour != null
                ? TOOLTIP.perHour(signals.perHour)
                : TOOLTIP.perDay(signals.perDay),
        });
    }
    const age = formatAge(signals.ageDays);
    if (age) {
        chips.push({
            text: age,
            tone: 'muted',
            tooltip: ageChipTooltip(signals),
        });
    }
    if (signals.unread != null) {
        chips.push({
            text: CHIP.unread(formatCount(signals.unread)),
            tone: signals.unread === 0 ? 'zombie' : 'muted',
            tooltip: TOOLTIP.unread(signals.unread),
        });
    }
    if (signals.autoRenewal) {
        chips.push({
            text: CHIP.autoRenewal,
            tone: 'muted',
            icon: 'refresh',
            tooltip: autoRenewalTooltip(signals),
        });
    } else if (signals.bumped) {
        chips.push({
            text: CHIP.bumped,
            tone: 'muted',
            tooltip: TOOLTIP.bumped,
        });
    }
    const until = formatDayMonthRu(signals.listingEndsAt);
    if (signals.listingDaysLeft != null && signals.listingDaysLeft < 0) {
        chips.push({
            text: CHIP.expired,
            tone: 'zombie',
            icon: 'calendar',
            tooltip: TOOLTIP.expired,
        });
    } else if (until) {
        chips.push({
            text: CHIP.until(until),
            tone: signals.listingDaysLeft != null && signals.listingDaysLeft < 3 ? 'mid' : 'muted',
            icon: 'calendar',
            tooltip: TOOLTIP.until(formatDateRu(signals.listingEndsAt)),
        });
    }
    if (variant === 'vacancy') {
        if (signals.tariff) {
            chips.push({
                text: signals.tariff,
                tone: 'muted',
                tooltip: `тариф размещения: ${signals.tariff}`,
            });
        }
        if (signals.boosted) {
            chips.push({ text: CHIP.boost, tone: 'hot', tooltip: TOOLTIP.boost });
        }
        pushAiChips(chips, signals);
        if (signals.hasTest) {
            chips.push({ text: CHIP.test, tone: 'muted', tooltip: TOOLTIP.test });
        }
        if (signals.letterRequired) {
            chips.push({ text: CHIP.letter, tone: 'muted', tooltip: TOOLTIP.letter });
        }
        if (signals.countersUnstable && signals.totalAlt != null) {
            chips.push({
                text: CHIP.altCounter(formatCount(signals.totalAlt)),
                tone: 'zombie',
                tooltip: `ещё один счётчик hh: ${formatCount(signals.totalAlt)}`,
            });
        }
    }
    return chips;
}

export function createBadge(signals, variant = 'search', options = {}) {
    const host = document.createElement('div');
    host.dataset.jobXray = signals.id;
    host.setAttribute('data-job-xray', signals.id);
    host.setAttribute('data-job-xray-surface', variant);
    host.style.setProperty('display', 'block', 'important');
    host.style.setProperty('width', '100%', 'important');
    host.style.setProperty('box-sizing', 'border-box', 'important');
    host.style.setProperty('margin-top', variant === 'vacancy' ? '16px' : '8px', 'important');
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = STYLES;
    shadow.appendChild(style);

    const wrap = document.createElement('div');
    if (variant === 'vacancy') {
        wrap.className = 'panel';
        const captionRow = document.createElement('div');
        captionRow.className = 'caption-row';
        const caption = document.createElement('p');
        caption.className = 'caption';
        caption.textContent = 'job-xray';
        const help = document.createElement('button');
        help.type = 'button';
        help.className = 'help';
        help.textContent = '?';
        help.setAttribute('aria-label', 'Справка по меткам job-xray');
        help.title = LEGEND_HELP;
        captionRow.append(caption, help);
        wrap.appendChild(captionRow);
    }

    const row = document.createElement('div');
    row.className = 'row';
    chipsFor(signals, variant, options).forEach((item) => {
        row.appendChild(chip(item));
    });
    wrap.appendChild(row);
    shadow.appendChild(wrap);

    return host;
}

export const SERP_CARD_SELECTOR = '[data-qa="vacancy-serp__vacancy"]';

export function closestSerpCard(node) {
    return node?.closest?.(SERP_CARD_SELECTOR) ?? null;
}

export function vacancyIdFromCard(article) {
    const title = article.querySelector('[data-qa="serp-item__title"]');
    const href = title?.getAttribute('href') || title?.href || '';
    const fromHref = href.match(/\/vacancy\/(\d+)/);
    if (fromHref) {
        return fromHref[1];
    }

    const withId = article.querySelector('[id]');
    if (withId && /^\d+$/.test(withId.id)) {
        return withId.id;
    }

    return null;
}

function findViewersNode(root, pattern) {
    const nodes = root.querySelectorAll('span, p');
    for (const node of nodes) {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (pattern.test(text) && node.children.length <= 3) {
            return node;
        }
    }
    return null;
}

function searchCardMountPoint(article) {
    const title = article.querySelector('[data-qa="serp-item__title"]');
    if (title) {
        const afterTitle = title.closest('h2, h3, h4') || title.parentElement || title;
        return { mode: 'after', ref: afterTitle };
    }

    const cardInner = [...article.querySelectorAll('[id]')].find((node) => /^\d+$/.test(node.id));
    if (cardInner) {
        return { mode: 'append', node: cardInner };
    }

    const response = article.querySelector(
        '[data-qa="vacancy-serp__vacancy-response"], [data-qa="serp-item__response"], a[data-qa*="response"]',
    );
    if (response?.parentElement) {
        return { mode: 'before', node: response.parentElement, ref: response };
    }

    const info = article.querySelector('[class*="vacancy-info--"]');
    if (info) {
        return { mode: 'append', node: info };
    }

    return { mode: 'append', node: article };
}

export function cardShowsHhViewers(root) {
    if (!root?.querySelectorAll) {
        return false;
    }
    const nodes = root.querySelectorAll('span, p');
    for (const node of nodes) {
        if (node.closest?.('[data-job-xray]')) {
            continue;
        }
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (/сейчас смотрят/i.test(text) || /сейчас эту вакансию/i.test(text)) {
            return true;
        }
    }
    return false;
}

export function mountOnSearchCard(article, signals) {
    if (article.querySelector('[data-job-xray]')) {
        return;
    }

    const badge = createBadge(signals, 'search', {
        hideOnlineViewers: cardShowsHhViewers(article),
    });
    const point = searchCardMountPoint(article);
    if (point.mode === 'after' && point.ref) {
        point.ref.insertAdjacentElement('afterend', badge);
        return;
    }
    if (point.mode === 'before' && point.ref) {
        point.node.insertBefore(badge, point.ref);
        return;
    }
    point.node.appendChild(badge);
}

function closestCard(node) {
    if (!node?.closest) {
        return null;
    }
    return node.closest('[class*="magritte-card"]')
        || node.closest('[data-qa="vacancy-body"]')
        || null;
}

function visibleNode(nodes) {
    return [...nodes].find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }) || nodes[0] || null;
}

export function mountOnVacancyPage(signals, doc = document) {
    const existing = doc.querySelector('[data-job-xray-surface="vacancy"]');
    if (existing) {
        if (existing.getAttribute('data-job-xray') === signals.id && doc.contains(existing)) {
            return;
        }
        existing.remove();
    }

    const badge = createBadge(signals, 'vacancy');
    const apply = visibleNode(doc.querySelectorAll('[data-qa="vacancy-response-link-top"]'));
    const heading = doc.querySelector('h1');
    const viewers = findViewersNode(doc, /сейчас эту вакансию/i);
    const card = closestCard(apply) || closestCard(heading) || closestCard(viewers);

    if (card) {
        card.insertAdjacentElement('afterend', badge);
        return;
    }
    if (heading) {
        heading.insertAdjacentElement('afterend', badge);
        return;
    }
    if (apply?.parentElement) {
        apply.parentElement.insertAdjacentElement('beforebegin', badge);
        return;
    }
    doc.body?.prepend(badge);
}
