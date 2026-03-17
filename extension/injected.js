// MAIN world script: intercept fetch/XHR for 104 job search API
(function () {
  'use strict';

  const TARGET_URL = '/jobs/search/api/jobs';

  function dispatch(data, url) {
    try {
      window.postMessage({
        type: '__JOB_COLLECTOR__',
        payload: {
          data,
          url,
          interceptedAt: new Date().toISOString(),
        },
      }, '*');
    } catch (e) {
      // silently ignore
    }
  }

  // Patch fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (url.includes(TARGET_URL)) {
        const clone = response.clone();
        clone.json().then((json) => dispatch(json, url)).catch(() => {});
      }
    } catch (e) {
      // never break the page
    }
    return response;
  };

  // Patch XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._jobCollectorUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    try {
      if (this._jobCollectorUrl && this._jobCollectorUrl.includes(TARGET_URL)) {
        this.addEventListener('load', function () {
          try {
            const json = JSON.parse(this.responseText);
            dispatch(json, this._jobCollectorUrl);
          } catch (e) {
            // ignore parse errors
          }
        });
      }
    } catch (e) {
      // never break the page
    }
    return originalSend.apply(this, args);
  };
})();
