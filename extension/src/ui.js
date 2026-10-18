import { CHIP, LEGEND_HELP, badgeTooltipParts } from './copy.ru.js';
import { formatAge, formatCount, formatDisplayRate } from './metrics.js';

const STYLES = `
:host {
  display: block;
  width: 100%;
  min-width: 0;
  font-family: Inter, "Helvetica Neue", Arial, sans-serif;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  letter-spacing: 0.01em;
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

function chip(text, tone) {
    const el = document.createElement('span');
    el.className = `chip ${tone}`;
    el.textContent = text;
    return el;
}

export function chipsFor(signals, variant) {
    const chips = [];
    if (signals.total != null) {
        chips.push({
            text: CHIP.responses(formatCount(signals.total), signals.countersUnstable),
            tone: signals.tone,
        });
    }
    const rate = formatDisplayRate(signals);
    if (rate) {
        chips.push({ text: rate, tone: 'muted' });
    }
    const age = formatAge(signals.ageDays);
    if (age) {
        chips.push({ text: age, tone: 'muted' });
    }
    if (signals.unread != null) {
        chips.push({
            text: CHIP.unread(formatCount(signals.unread)),
            tone: signals.unread === 0 ? 'zombie' : 'muted',
        });
    }
    if (signals.bumped) {
        chips.push({ text: CHIP.bumped, tone: 'muted' });
    }
    if (variant === 'vacancy') {
        if (signals.tariff) {
            chips.push({ text: signals.tariff, tone: 'muted' });
        }
        if (signals.boosted) {
            chips.push({ text: CHIP.boost, tone: 'hot' });
        }
        if (signals.hasAi) {
            chips.push({ text: CHIP.aiReview, tone: 'mid' });
        }
        if (signals.hasTest) {
            chips.push({ text: CHIP.test, tone: 'muted' });
        }
        if (signals.letterRequired) {
            chips.push({ text: CHIP.letter, tone: 'muted' });
        }
        if (signals.countersUnstable && signals.totalAlt != null) {
            chips.push({
                text: CHIP.altCounter(formatCount(signals.totalAlt)),
                tone: 'zombie',
            });
        }
    }
    return chips;
}

export function createBadge(signals, variant = 'search') {
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
    chipsFor(signals, variant).forEach(({ text, tone }) => {
        row.appendChild(chip(text, tone));
    });
    wrap.appendChild(row);
    shadow.appendChild(wrap);

    host.title = badgeTooltipParts(signals, variant).join(' · ');

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

export function mountOnSearchCard(article, signals) {
    if (article.querySelector('[data-job-xray]')) {
        return;
    }

    const badge = createBadge(signals, 'search');
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
