/**
 * Content script at document_start: inject page-world hook + relay postMessage to job-xray-related.
 */
(function jobXrayNetworkHookRelay() {
    const EVENT = 'job-xray-related';
    const MESSAGE_TYPE = 'job-xray:related-vacancies';
    const PAGE_HOOK = 'page-network-hook.js';

    window.addEventListener('message', (event) => {
        if (event.source !== window || event.data?.type !== MESSAGE_TYPE) {
            return;
        }
        window.dispatchEvent(new CustomEvent(EVENT, { detail: event.data.payload }));
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
