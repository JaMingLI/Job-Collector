document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const offlineMsg = document.getElementById('offlineMsg');
  const intercepted = document.getElementById('intercepted');
  const newJobs = document.getElementById('newJobs');
  const duplicates = document.getElementById('duplicates');
  const lastTime = document.getElementById('lastTime');
  const openDashboard = document.getElementById('openDashboard');

  // Health check
  chrome.runtime.sendMessage({ type: 'HEALTH_CHECK' }, (response) => {
    if (response?.connected) {
      statusDot.classList.add('online');
      statusText.textContent = `Server online (${response.data.totalJobs} jobs)`;
      offlineMsg.classList.remove('show');
    } else {
      statusDot.classList.add('offline');
      statusText.textContent = 'Server offline';
      offlineMsg.classList.add('show');
    }
  });

  // Get stats
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
    if (response) {
      intercepted.textContent = response.totalIntercepted || 0;
      newJobs.textContent = response.totalNew || 0;
      duplicates.textContent = response.totalDuplicate || 0;

      if (response.lastInterceptedAt) {
        const d = new Date(response.lastInterceptedAt);
        lastTime.textContent = `Last: ${d.toLocaleString('zh-TW')}`;
      }
    }
  });

  openDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3104' });
  });
});
