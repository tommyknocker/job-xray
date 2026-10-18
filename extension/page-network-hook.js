/**
 * Runs in the page (main) world. Posts related_vacancies JSON to the extension via postMessage.
 */
(function jobXrayPageNetworkHook() {
    const RELATED = /\/shards\/vacancy\/related_vacancies(?:\?|$|\/)/;
    const MESSAGE_TYPE = 'job-xray:related-vacancies';

    function emit(payload) {
        if (!payload || !Array.isArray(payload.vacancies)) {
            return;
        }
        window.postMessage({ type: MESSAGE_TYPE, payload }, '*');
    }

    function maybeEmit(url, text) {
        if (!RELATED.test(String(url)) || !text) {
            return;
        }
        try {
            emit(JSON.parse(text));
        } catch {
            // ignore
        }
    }

    if (typeof window.fetch === 'function') {
        const nativeFetch = window.fetch.bind(window);
        window.fetch = function hookedFetch(input, init) {
            const url = typeof input === 'string' ? input : input?.url;
            return nativeFetch(input, init).then((response) => {
                if (url && RELATED.test(url)) {
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
