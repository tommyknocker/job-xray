/**
 * Content script at document_start: inject page-world hook + relay postMessage to CustomEvents.
 */
(function jobXrayNetworkHookRelay() {
    const PAGE_HOOK = 'page-network-hook.js';
    const RELAY = [
        { message: 'job-xray:related-vacancies', event: 'job-xray-related' },
        { message: 'job-xray:search-vacancies', event: 'job-xray-search' },
        { message: 'job-xray:search-page-html', event: 'job-xray-search-page-html' },
    ];

    window.addEventListener('message', (event) => {
        if (event.source !== window) {
            return;
        }
        const route = RELAY.find((item) => item.message === event.data?.type);
        if (!route) {
            return;
        }
        window.dispatchEvent(new CustomEvent(route.event, { detail: event.data.payload }));
    });

    function injectPageHook() {
        const runtime = globalThis.chrome?.runtime ?? globalThis.browser?.runtime;
        if (!runtime?.getURL) {
            return;
        }
        const script = document.createElement('script');
        script.src = runtime.getURL(PAGE_HOOK);
        script.async = false;
        script.addEventListener('error', () => {
            console.error('job-xray: failed to load page-network-hook.js');
        });
        const parent = document.documentElement || document.head;
        if (!parent) {
            return;
        }
        parent.appendChild(script);
        script.addEventListener('load', () => script.remove(), { once: true });
    }

    if (document.documentElement) {
        injectPageHook();
    } else {
        document.addEventListener('DOMContentLoaded', injectPageHook, { once: true });
    }
})();
