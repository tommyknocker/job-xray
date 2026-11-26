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

const renderedChipsByBadge = new WeakMap();

function updateBadge(badge, signals, variant, options) {
    const chips = chipsFor(signals, variant, options);
    const renderedChips = JSON.stringify(chips);
    if (badge.getAttribute('data-job-xray') !== signals.id) {
        badge.setAttribute('data-job-xray', signals.id);
    }
    if (renderedChipsByBadge.get(badge) !== renderedChips) {
        badge.shadowRoot.querySelector('.row').replaceChildren(...chips.map(chip));
        renderedChipsByBadge.set(badge, renderedChips);
    }
}

function createBadge(signals, variant, options) {
    const host = document.createElement('div');
    host.setAttribute('data-job-xray-surface', variant);
    host.style.setProperty('display', 'block', 'important');
    host.style.setProperty('width', '100%', 'important');
    host.style.setProperty('max-width', '100%', 'important');
    host.style.setProperty('min-width', '0', 'important');
    host.style.setProperty('box-sizing', 'border-box', 'important');
    host.style.setProperty('margin-top', variant === 'vacancy' ? '12px' : '8px', 'important');
    host.style.setProperty('margin-bottom', variant === 'vacancy' ? '0' : '0', 'important');
    host.style.setProperty('position', 'relative', 'important');
    host.style.setProperty('z-index', '0', 'important');
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
    wrap.appendChild(row);
    shadow.appendChild(wrap);

    updateBadge(host, signals, variant, options);
    return host;
}

export const SERP_CARD_SELECTOR = '[data-qa="vacancy-serp__vacancy"]';
export const NEGOTIATION_ITEM_SELECTOR = '[data-qa="negotiations-item"]';

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
        const heading = title.closest('h2, h3, h4') || title.parentElement;
        const ref = heading !== article && article.contains(heading) ? heading : title;
        return { mode: 'after', ref };
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
    const nodes = root.querySelectorAll('span, p, div, time, li');
    for (const node of nodes) {
        if (node.closest?.('[data-job-xray]')) {
            continue;
        }
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length > 220) {
            continue;
        }
        if (/сейчас смотрят/i.test(text) || /сейчас эту вакансию/i.test(text)) {
            return true;
        }
    }
    return false;
}

export function mountOnSearchCard(article, signals) {
    const existing = article.querySelector('[data-job-xray-surface="search"]');
    if (!signals) {
        if (existing && existing.getAttribute('data-job-xray') !== vacancyIdFromCard(article)) {
            existing.remove();
        }
        return;
    }

    const options = { hideOnlineViewers: signals.onlineViewers > 0 && cardShowsHhViewers(article) };
    if (existing) {
        updateBadge(existing, signals, 'search', options);
        return;
    }

    const badge = createBadge(signals, 'search', options);
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

export function vacancyIdFromNegotiationItem(item) {
    const vacancy = item?.querySelector?.('[data-qa="negotiations-item-vacancy"]');
    const href = vacancy?.getAttribute?.('href')
        || vacancy?.querySelector?.('a[href*="/vacancy/"]')?.getAttribute?.('href')
        || item?.querySelector?.('a[href*="/vacancy/"]')?.getAttribute?.('href')
        || '';
    const match = href.match(/\/vacancy\/(\d+)/);
    return match ? match[1] : null;
}

function negotiationItemMountPoint(item) {
    const vacancy = item.querySelector('[data-qa="negotiations-item-vacancy"]');
    const row = vacancy?.parentElement;
    if (row && row !== item) {
        return { mode: 'after', ref: row };
    }
    const company = item.querySelector('[data-qa="negotiations-item-company"]');
    if (company) {
        return { mode: 'after', ref: company };
    }
    return { mode: 'append', ref: item };
}

export function mountOnNegotiationItem(item, signals) {
    if (!item) {
        return;
    }
    const existing = item.querySelector('[data-job-xray-surface="search"]');
    if (!signals) {
        if (existing && existing.getAttribute('data-job-xray') !== vacancyIdFromNegotiationItem(item)) {
            existing.remove();
        }
        return;
    }
    if (existing) {
        updateBadge(existing, signals, 'search');
        return;
    }

    const badge = createBadge(signals, 'search');
    const point = negotiationItemMountPoint(item);
    if (point.mode === 'after' && point.ref?.insertAdjacentElement) {
        point.ref.insertAdjacentElement('afterend', badge);
        return;
    }
    point.ref?.appendChild?.(badge);
}

function closestCard(node) {
    if (!node?.closest) {
        return null;
    }
    return node.closest('[class*="magritte-card"]')
        || node.closest('[data-qa="vacancy-body"]')
        || null;
}

/**
 * Vacancy header slot: after the summary block (logged-in «Где работать / График /
 * Условия» or guest experience row), still inside the white card and before
 * «Откликнуться». Never after the outer card — actions often sit in a sibling noprint.
 */
export function pickVacancyMountTarget(doc = document) {
    const heading = doc.querySelector('h1, [data-qa="vacancy-title"]');
    const apply = pickHeaderApply(doc, heading);
    const article = heading?.closest?.('article') || apply?.closest?.('article');
    const card = closestCard(apply) || closestCard(heading);
    const headerRoot = vacancyHeaderRoot(heading, apply, card, article);
    const root = headerRoot || article || card || doc.body;
    const titleBox = root.querySelector?.('.vacancy-title')
        || heading?.closest?.('.vacancy-title')
        || (heading?.matches?.('[data-qa="vacancy-title"], #vacancy-title')
            ? heading.closest?.('[class*="magritte-v-spacing-container"], [class*="magritte-card"]')
            : null);

    const stackedTail = findStackedSummaryTail(heading);
    if (stackedTail) {
        return { mode: 'after', ref: stackedTail };
    }

    const metaBlock = findHeaderMetaBlock(root, titleBox, apply);
    if (metaBlock && metaBlock !== root) {
        return { mode: 'after', ref: metaBlock };
    }

    const topActions = findHeaderTopActions(apply, headerRoot);
    if (topActions && headerApplyButton(apply, topActions) && vacancyHeaderActions(topActions, heading, headerRoot)) {
        return { mode: 'before', ref: topActions };
    }

    const actions = headerActionsRef(apply);
    if (actions && headerApplyButton(apply, actions) && vacancyHeaderActions(actions, heading, headerRoot)) {
        return { mode: 'before', ref: actions };
    }

    const headerColumn = titleBox?.closest?.('[class*="magritte-v-spacing-container"]')
        || titleBox?.parentElement;
    if (headerColumn && root.contains?.(headerColumn)) {
        return { mode: 'append', ref: headerColumn };
    }

    if (titleBox && root.contains?.(titleBox)) {
        return { mode: 'after', ref: titleBox };
    }

    if (heading && article?.contains?.(heading)) {
        return { mode: 'after', ref: heading.closest?.('h2, h3, h4') || heading };
    }

    return { mode: 'prepend', ref: doc.body };
}

function isMagritteCard(el) {
    return Boolean(el && String(el.className || '').includes('magritte-card'));
}

/** Logged-in vacancy: title + «Где работать / График / Условия» as sibling cards. */
function findStackedSummaryTail(heading) {
    const titleCard = heading?.closest?.('[class*="magritte-card"]');
    if (!titleCard?.parentElement) {
        return null;
    }
    let conditionsCard = null;
    let sawWhere = false;
    let node = titleCard.nextElementSibling;
    while (node) {
        if (isVacancyBodyContent(node)) {
            break;
        }
        if (isMagritteCard(node)) {
            const text = normalizeVacancyText(node.textContent);
            if (/^Где работать/i.test(text) || (text.startsWith('Где работать') && text.length < 160)) {
                sawWhere = true;
                node = node.nextElementSibling;
                continue;
            }
            if (/^График/i.test(text) && sawWhere) {
                node = node.nextElementSibling;
                continue;
            }
            if ((/^Условия/i.test(text) || (/Условия/.test(text) && sawWhere)) && text.length < 400) {
                conditionsCard = node;
                node = node.nextElementSibling;
                continue;
            }
            if (conditionsCard) {
                break;
            }
            if (text.length > 500) {
                break;
            }
        }
        if (conditionsCard) {
            break;
        }
        node = node.nextElementSibling;
    }
    return conditionsCard;
}

function vacancyHeaderRoot(heading, apply, card, article) {
    const titleCard = heading?.closest?.('[class*="magritte-card"]');
    if (titleCard && findStackedSummaryTail(heading)) {
        const stack = titleCard.parentElement;
        return stack?.closest?.('article, [data-qa="main-content"], [class*="magritte-grid-column"]')
            || stack
            || titleCard;
    }
    return titleCard
        || heading?.closest?.('[class*="magritte-card"]')
        || apply?.closest?.('[class*="magritte-card"]')
        || card
        || article;
}

function findHeaderTopActions(apply, headerRoot) {
    const scopes = [headerRoot, apply?.closest?.('[class*="magritte-card"]')].filter(Boolean);
    for (const scope of scopes) {
        const top = scope.querySelector?.('[class*="vacancy-actions_magritte-vacancy-top"]');
        if (top && (!apply || top.contains(apply))) {
            return top;
        }
    }
    return null;
}

function headerActionsRef(apply) {
    return apply?.closest?.('.vacancy-actions, [class*="vacancy-actions"]') || null;
}

function headerApplyButton(apply, actions) {
    if (!actions || !apply) {
        return false;
    }
    if (inFixedActionBar(apply)) {
        return false;
    }
    return actions.contains(apply);
}

function vacancyHeaderActions(actions, heading, headerRoot) {
    if (headerRoot?.contains?.(actions)) {
        return true;
    }
    if (!heading?.getBoundingClientRect || !actions?.getBoundingClientRect) {
        return false;
    }
    const titleTop = heading.getBoundingClientRect().top;
    const actionsTop = actions.getBoundingClientRect().top;
    return actionsTop >= titleTop && actionsTop - titleTop < 720;
}

function findHeaderMetaBlock(root, titleBox, apply) {
    const branded = findBrandedSummaryBlock(root, apply);
    if (branded) {
        return branded;
    }

    if (!titleBox || !root.contains?.(titleBox)) {
        return null;
    }

    let sibling = titleBox.nextElementSibling;
    while (sibling) {
        if (apply && (sibling === apply || sibling.contains?.(apply))) {
            break;
        }
        if (looksLikeHeaderMetaBlock(sibling)) {
            return sibling;
        }
        sibling = sibling.nextElementSibling;
    }
    return null;
}

function findBrandedSummaryBlock(root, apply) {
    const labels = root.querySelectorAll?.('dt, th, span, p, div') || [];
    for (const label of labels) {
        const labelText = normalizeVacancyText(label.textContent);
        if (!/^Где работать/i.test(labelText) || labelText.length > 40) {
            continue;
        }
        const block = label.closest?.('div, section, dl, ul, table')
            || label.parentElement;
        if (!block || block === root) {
            continue;
        }
        if (apply && block.contains(apply)) {
            continue;
        }
        if (block.closest?.('[data-job-xray]')) {
            continue;
        }
        if (isVacancyBodyContent(block)) {
            continue;
        }
        const blockText = normalizeVacancyText(block.textContent);
        if (blockText.length < 20 || blockText.length > 1200) {
            continue;
        }
        if (/График/.test(blockText) && /Условия/.test(blockText)) {
            return block;
        }
    }

    let best = null;
    const nodes = root.querySelectorAll?.('div, section, dl') || [];
    for (const el of nodes) {
        if (apply && (el === apply || el.contains?.(apply))) {
            continue;
        }
        if (el.closest?.('[data-job-xray]')) {
            continue;
        }
        if (isVacancyBodyContent(el)) {
            continue;
        }
        const text = normalizeVacancyText(el.textContent);
        if (text.length < 25 || text.length > 1200) {
            continue;
        }
        if (!/Где работать/.test(text) || !/График/.test(text) || !/Условия/.test(text)) {
            continue;
        }
        if (!best || best.contains?.(el)) {
            best = el;
        }
    }
    return best;
}

function looksLikeHeaderMetaBlock(el) {
    if (!el?.querySelector) {
        return false;
    }
    return Boolean(
        el.querySelector('[data-qa="vacancy-experience"], [data-qa="vacancy-hiring-formats"], [data-qa="compensation-frequency-text"]')
        || String(el.className || '').includes('magritte-v-spacing-container'),
    );
}

function normalizeVacancyText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function isVacancyBodyContent(node) {
    return Boolean(node?.closest?.(
        '[data-qa="vacancy-description"], [data-qa="vacancy-address-with-map"], .vacancy-description',
    ));
}

function vacancyMountIsReady(point, doc = document) {
    if (!point?.ref) {
        return false;
    }
    return !(point.mode === 'prepend' && point.ref === doc.body);
}

function vacancyBadgeAtPoint(badge, point) {
    if (!badge || !point?.ref) {
        return false;
    }
    if (point.mode === 'before') {
        return badge.nextElementSibling === point.ref;
    }
    if (point.mode === 'after') {
        return badge.previousElementSibling === point.ref;
    }
    if (point.mode === 'append') {
        return badge.parentElement === point.ref;
    }
    if (point.mode === 'prepend') {
        return badge.parentElement === point.ref && badge === point.ref.firstElementChild;
    }
    return false;
}

function vacancyBadgeMisplaced(badge, point, doc = document) {
    if (!badge) {
        return true;
    }
    if (badge.parentElement === doc.body || badge.parentElement === doc.documentElement) {
        return true;
    }
    if (!vacancyMountIsReady(point, doc)) {
        return true;
    }
    const heading = doc.querySelector?.('h1, [data-qa="vacancy-title"]');
    if (heading?.getBoundingClientRect && badge.getBoundingClientRect) {
        const gap = badge.getBoundingClientRect().top - heading.getBoundingClientRect().top;
        if (gap > 720) {
            return true;
        }
    }
    return !vacancyBadgeAtPoint(badge, point);
}

function pickHeaderApply(doc, heading = doc.querySelector?.('h1, [data-qa="vacancy-title"]')) {
    const nodes = [...doc.querySelectorAll('[data-qa="vacancy-response-link-top"]')]
        .filter((node) => !inFixedActionBar(node));
    const visible = nodes.filter((node) => {
        if (typeof node.getBoundingClientRect !== 'function') {
            return true;
        }
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    });
    if (!heading || visible.length === 0) {
        return visible[0] || nodes[0] || null;
    }

    const titleCard = heading.closest?.('[class*="magritte-card"]');
    const stackParent = titleCard?.parentElement;
    const stackedHeader = stackParent && findStackedSummaryTail(heading);
    let best = null;
    let bestTop = Infinity;
    for (const node of visible) {
        const rel = heading.compareDocumentPosition(node);
        if (!(rel & 4)) {
            continue;
        }
        const nodeCard = node.closest?.('[class*="magritte-card"]');
        if (titleCard && nodeCard && titleCard !== nodeCard && !stackedHeader) {
            continue;
        }
        if (stackedHeader && stackParent && !stackParent.contains(node)) {
            continue;
        }
        if (isVacancyBodyContent(node)) {
            continue;
        }
        const top = node.getBoundingClientRect().top;
        if (top < bestTop) {
            bestTop = top;
            best = node;
        }
    }
    if (best) {
        return best;
    }

    best = null;
    bestTop = Infinity;
    for (const node of visible) {
        const rel = heading.compareDocumentPosition(node);
        if (!(rel & 4)) {
            continue;
        }
        const top = node.getBoundingClientRect().top;
        if (top < bestTop) {
            bestTop = top;
            best = node;
        }
    }
    if (best) {
        return best;
    }
    if (stackedHeader && stackParent) {
        const inStack = nodes.filter((node) => stackParent.contains(node));
        if (inStack.length) {
            return inStack[0];
        }
    }
    return visible[0] || nodes[0] || null;
}

function inFixedActionBar(node) {
    return Boolean(node?.closest?.('[data-qa="action-bar"], [class*="action-bar"]'));
}

function visibleNode(nodes) {
    return [...nodes].find((node) => {
        if (typeof node.getBoundingClientRect !== 'function') {
            return true;
        }
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }) || nodes[0] || null;
}

export function mountOnVacancyPage(signals, doc = document) {
    const point = pickVacancyMountTarget(doc);
    if (!vacancyMountIsReady(point, doc)) {
        doc.querySelector('[data-job-xray-surface="vacancy"]')?.remove();
        return;
    }

    const options = { hideOnlineViewers: signals.onlineViewers > 0 && cardShowsHhViewers(doc.body || doc) };
    const existing = doc.querySelector('[data-job-xray-surface="vacancy"]');
    if (existing) {
        updateBadge(existing, signals, 'vacancy', options);
        if (vacancyBadgeMisplaced(existing, point, doc)) {
            insertVacancyBadge(existing, point);
        }
        return;
    }

    const badge = createBadge(signals, 'vacancy', options);
    insertVacancyBadge(badge, point);
}

function insertVacancyBadge(badge, point) {
    if (point.mode === 'append' && point.ref?.appendChild) {
        point.ref.appendChild(badge);
        return;
    }
    if (point.mode === 'before' && point.ref?.parentElement?.insertBefore) {
        point.ref.parentElement.insertBefore(badge, point.ref);
        return;
    }
    if (point.mode === 'after' && point.ref?.insertAdjacentElement) {
        point.ref.insertAdjacentElement('afterend', badge);
        return;
    }
    if (point.mode === 'prepend' && point.ref?.prepend) {
        point.ref.prepend(badge);
    }
}
