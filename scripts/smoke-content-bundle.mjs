import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

const VACANCY_ID = '101';

function vacancyList(total) {
    return { vacancies: [{ vacancyId: VACANCY_ID, vacancyResponsesCount: total }] };
}

function startContentScript(script, pathname, state, markup) {
    const { document, window } = parseHTML(`
        <html><body>
            <template id="HH-Lux-InitialState">${JSON.stringify(state)}</template>
            ${markup}
        </body></html>
    `);
    const events = new window.EventTarget();
    const timers = [];
    let scan;
    const context = {
        document,
        location: new URL(pathname, 'https://hh.ru'),
        history: { pushState() {}, replaceState() {} },
        MutationObserver: class { observe() {} },
        Element: window.Element,
        URL,
        URLSearchParams,
        addEventListener: events.addEventListener.bind(events),
        setTimeout: (callback) => timers.push(callback),
        setInterval: (callback) => { scan = callback; },
    };
    context.window = context;
    script.runInNewContext(context, { timeout: 5000 });

    return {
        document,
        scan,
        dispatch(name, detail) {
            events.dispatchEvent(new window.CustomEvent(name, { detail }));
            timers.splice(0).forEach((callback) => callback());
        },
    };
}

export function smokeContentBundle(script) {
    const search = startContentScript(
        script,
        '/search/vacancy',
        { vacancySearchResult: vacancyList(18) },
        `<article data-qa="vacancy-serp__vacancy">
            <h2><a data-qa="serp-item__title" href="/vacancy/${VACANCY_ID}">Developer</a></h2>
        </article>`,
    );
    const badge = search.document.querySelector(`[data-job-xray="${VACANCY_ID}"]`);
    assert.match(badge?.shadowRoot.querySelector('.row').textContent ?? '', /18 откл\./);

    search.dispatch('job-xray-search', { vacancySearchResult: vacancyList(41) });
    assert.match(badge.shadowRoot.querySelector('.row').textContent, /41 откл\./);
    assert.equal(search.document.querySelectorAll('[data-job-xray]').length, 1);

    search.document.querySelector('a').setAttribute('href', '/vacancy/202');
    search.scan();
    assert.equal(search.document.querySelector('[data-job-xray]'), null);

    const negotiations = startContentScript(
        script,
        '/applicant/negotiations',
        { suitableVacancies: vacancyList(23) },
        `<div data-qa="negotiations-item">
            <a data-qa="negotiations-item-vacancy" href="/vacancy/${VACANCY_ID}">Developer</a>
        </div>`,
    );
    const negotiationBadge = negotiations.document.querySelector(`[data-job-xray="${VACANCY_ID}"]`);
    assert.match(negotiationBadge?.shadowRoot.querySelector('.row').textContent ?? '', /23 откл\./);
}
