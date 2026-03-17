// Content script (ISOLATED world): inject MAIN world script + bridge messages

// Inject injected.js into MAIN world
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Bridge: forward postMessage from MAIN world to background service worker
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== '__JOB_COLLECTOR__') return;

  chrome.runtime.sendMessage({
    type: 'JOBS_INTERCEPTED',
    payload: event.data.payload,
  });
});
