// Service Worker: clean intercepted data and POST to server

const SERVER_URL = 'http://localhost:3104';

const stats = {
  totalIntercepted: 0,
  totalNew: 0,
  totalDuplicate: 0,
  lastInterceptedAt: null,
  serverConnected: false,
  errors: [],
};

function addError(msg) {
  stats.errors.unshift(msg);
  if (stats.errors.length > 10) stats.errors.length = 10;
}

function cleanJob(raw) {
  return {
    jobNo: raw.jobNo || '',
    jobName: raw.jobName || '',
    custName: raw.custName || '',
    custNo: raw.custNo || '',
    coIndustry: raw.coIndustry || '',
    description: raw.description || raw.jobContent || '',
    jobAddrNoDesc: raw.jobAddrNoDesc || '',
    jobAddress: raw.jobAddress || '',
    salaryLow: raw.salaryLow ?? raw.salaryDesc?.s ?? null,
    salaryHigh: raw.salaryHigh ?? raw.salaryDesc?.e ?? null,
    link: raw.link || {},
    pcSkills: raw.tags?.pcSkill || raw.pcSkills || [],
    appearDate: raw.appearDate || '',
    applyCnt: raw.applyCnt ?? 0,
    period: raw.period ?? null,
    remoteWork: raw.remoteWork || '',
    employeeCount: raw.employeeCount || '',
    lat: raw.lat ?? null,
    lon: raw.lon ?? null,
    isApplied: raw.isApplied ? 1 : 0,
    isSaved: raw.isSaved ? 1 : 0,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JOBS_INTERCEPTED') {
    handleJobsIntercepted(message.payload).then(sendResponse).catch((err) => {
      addError(err.message);
      sendResponse({ success: false, error: err.message });
    });
    return true; // async sendResponse
  }

  if (message.type === 'GET_STATS') {
    sendResponse(stats);
    return false;
  }

  if (message.type === 'HEALTH_CHECK') {
    fetch(`${SERVER_URL}/health`)
      .then((r) => r.json())
      .then((data) => {
        stats.serverConnected = true;
        sendResponse({ connected: true, data });
      })
      .catch((err) => {
        stats.serverConnected = false;
        sendResponse({ connected: false, error: err.message });
      });
    return true;
  }
});

async function handleJobsIntercepted(payload) {
  const { data, url, interceptedAt } = payload;
  const jobsArray = data?.data || [];
  const metadata = data?.metadata || {};

  if (!Array.isArray(jobsArray) || jobsArray.length === 0) {
    return { success: false, error: 'No jobs in payload' };
  }

  const cleanedJobs = jobsArray.map(cleanJob);

  // Extract search context from URL params and metadata
  let searchContext = {};
  try {
    const urlObj = new URL(url, 'https://www.104.com.tw');
    searchContext = {
      keyword: urlObj.searchParams.get('keyword') || '',
      area: urlObj.searchParams.get('area') || '',
      page: parseInt(urlObj.searchParams.get('page') || '1', 10),
      totalPages: metadata.pagination?.lastPage || null,
      totalJobs: metadata.pagination?.total || null,
    };
  } catch {
    // fallback
  }

  const body = {
    jobs: cleanedJobs,
    searchContext,
    interceptedAt,
  };

  const response = await fetch(`${SERVER_URL}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (result.success) {
    stats.totalIntercepted += cleanedJobs.length;
    stats.totalNew += result.newCount || 0;
    stats.totalDuplicate += result.duplicateCount || 0;
    stats.lastInterceptedAt = interceptedAt;
    stats.serverConnected = true;
  } else {
    addError(result.error || 'Server returned failure');
  }

  return result;
}
