import(chrome.runtime.getURL('src/content.js')).catch((error) => {
    console.error('job-xray: failed to load content module', error);
});
