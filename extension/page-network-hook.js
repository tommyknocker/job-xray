/**
 * Runs in the page (main) world. Posts shard JSON / SERP HTML to the extension via postMessage.
 */
(function jobXrayPageNetworkHook() {
    const ROUTES = [
        {
            re: /\/shards\/vacancy\/related_vacancies(?:\?|$|\/)/,
            type: 'job-xray:related-vacancies',
            valid: (payload) => Array.isArray(payload?.vacancies),
        },
        {
            re: /\/shards\/vacancy\/search(?:\?|$|\/)/,
            type: 'job-xray:search-vacancies',
            valid: (payload) => {
                const list = payload?.vacancySearchResult?.vacancies;
                return Array.isArray(list) && list.length > 0;
            },
        },
        {
            re: /\/shards\/employerview\/employer_vacancy_search(?:\?|$|\/)/,
            type: 'job-xray:search-vacancies',
            valid: (payload, url) => {
                if (String(url).includes('getVacancyCount=true')) {
                    return false;
                }
                const list = payload?.employerVacancySearch?.vacancies;
                return Array.isArray(list) && list.length > 0;
            },
        },
    ];

    function isSearchPaginationHtml(url) {
        const raw = String(url);
        if (!/\/search\/vacancy/.test(raw) || !/[?&]page=\d+/.test(raw)) {
            return false;
        }
        try {
            const { pathname } = new URL(raw, location.origin);
            return pathname === '/search/vacancy' || pathname.endsWith('/search/vacancy');
        } catch {
            return true;
        }
    }

    function routeForUrl(url) {
        return ROUTES.find((route) => route.re.test(String(url)));
    }

    function emit(route, payload, url) {
        if (!route?.valid(payload, url)) {
            return;
        }
        window.postMessage({ type: route.type, payload }, '*');
    }

    function maybeEmit(url, text) {
        if (!text) {
            return;
        }
        const rawUrl = String(url);
        if (isSearchPaginationHtml(rawUrl)) {
            window.postMessage({
                type: 'job-xray:search-page-html',
                payload: { url: rawUrl, html: text },
            }, '*');
            return;
        }
        const route = routeForUrl(rawUrl);
        if (!route) {
            return;
        }
        try {
            emit(route, JSON.parse(text), rawUrl);
        } catch {
            // ignore
        }
    }

    if (typeof window.fetch === 'function') {
        const nativeFetch = window.fetch.bind(window);
        window.fetch = function hookedFetch(input, init) {
            const url = typeof input === 'string' ? input : input?.url;
            const route = routeForUrl(url);
            const trackHtml = isSearchPaginationHtml(url);
            return nativeFetch(input, init).then((response) => {
                if (route || trackHtml) {
                    const clone = response.clone();
                    clone.text().then((text) => maybeEmit(url, text)).catch(() => {});
                }
                return response;
            });
        };
    }

    if (typeof XMLHttpRequest !== 'undefined') {
        const { open, send } = XMLHttpRequest.prototype;
        XMLHttpRequest.prototype.open = function hookedOpen(method, url, ...rest) {
            this.__jobXrayUrl = url;
            return open.call(this, method, url, ...rest);
        };
        XMLHttpRequest.prototype.send = function hookedSend(...args) {
            this.addEventListener('load', function onLoad() {
                const body = this.responseType === '' || this.responseType === 'text'
                    ? this.responseText
                    : null;
                maybeEmit(this.__jobXrayUrl, body);
            });
            return send.apply(this, args);
        };
    }
})();
