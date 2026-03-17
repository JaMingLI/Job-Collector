# 104 Job Collector — Project Specification

## 1. Project Overview

### 1.1 Purpose
一個 Chrome Extension + Local Server 的工具，用於在使用者正常瀏覽 104 人力銀行網站時，自動攔截職缺搜尋 API 的 response，將職缺資料收集並儲存到本地資料庫，方便後續查詢、篩選與分析。

### 1.2 核心運作流程
```
使用者在 104 搜尋職缺 → 瀏覽/滾動頁面
        ↓
Content Script 攔截 fetch/XHR response body
        ↓ chrome.runtime.sendMessage
Background Service Worker 接收 & 清洗資料
        ↓ HTTP POST
Local Server (Fastify) 接收、去重、儲存
        ↓
SQLite 持久化儲存
```

### 1.3 Tech Stack
| Layer              | Technology                        |
|--------------------|-----------------------------------|
| Extension          | Chrome Extension Manifest V3      |
| Extension Language | Vanilla JavaScript (no build step)|
| Local Server       | Node.js + Fastify                 |
| Database           | SQLite (via better-sqlite3)       |
| Package Manager    | pnpm                              |

---

## 2. Project Structure

```
job-collector/
├── README.md
├── extension/                    # Chrome Extension（不需 build，直接 load unpacked）
│   ├── manifest.json
│   ├── content.js                # 注入 104 頁面，攔截 API response
│   ├── background.js             # Service Worker，轉發資料到 local server
│   ├── popup.html                # Extension popup UI
│   ├── popup.js                  # Popup 互動邏輯
│   ├── popup.css                 # Popup 樣式
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
│
└── server/                       # Local Server
    ├── package.json
    ├── src/
    │   ├── index.js              # Server entry point
    │   ├── db.js                 # SQLite 初始化 & migration
    │   ├── routes/
    │   │   ├── jobs.js           # POST /api/jobs, GET /api/jobs, GET /api/jobs/stats
    │   │   └── health.js         # GET /health
    │   └── utils/
    │       └── salary.js         # 薪資解析 utility
    └── data/
        └── jobs.db               # SQLite database（gitignore）
```

---

## 3. Chrome Extension

### 3.1 manifest.json

```json
{
  "manifest_version": 3,
  "name": "104 Job Collector",
  "version": "1.0.0",
  "description": "攔截 104 職缺搜尋 API，自動收集職缺資料",
  "permissions": ["activeTab", "storage"],
  "host_permissions": ["https://www.104.com.tw/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.104.com.tw/jobs/search/*"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

**Key decisions:**
- `run_at: "document_start"` — content script 必須在頁面 JS 執行前注入，才能搶先 patch fetch/XHR
- 不需要 `webRequest` permission — 我們用 content script monkey-patch 策略，不依賴 webRequest API（MV3 的 webRequest 拿不到 response body）
- `host_permissions` 只針對 104 domain

### 3.2 content.js — API 攔截層

**職責：** 注入到 104 搜尋結果頁，monkey-patch `window.fetch` 和 `XMLHttpRequest`，攔截符合條件的 API response body。

**攔截目標 URL Pattern：**
```
https://www.104.com.tw/jobs/search/api/jobs?...
```
匹配邏輯：URL 包含 `/jobs/search/api/jobs`

**攔截策略 — Patch fetch：**
```javascript
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  if (url.includes('/jobs/search/api/jobs')) {
    const cloned = response.clone();  // clone 避免影響原始 consumer
    cloned.json().then((data) => forwardToBackground(url, data));
  }
  return response;
};
```

**攔截策略 — Patch XMLHttpRequest：**
```javascript
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, ...rest) {
  this._jobCollectorURL = url;
  return originalOpen.apply(this, [method, url, ...rest]);
};
// 在 send 時加 load event listener，讀取 responseText
```

**Forward 邏輯：**
- 驗證 `data.data` 存在且為 Array
- 透過 `chrome.runtime.sendMessage` 傳送到 background
- Message type: `JOBS_INTERCEPTED`
- Payload: `{ url, jobs: data.data, metadata: data.metadata, interceptedAt }`

**重要原則：**
- 所有攔截邏輯必須用 try-catch 包裹，絕對不能因為 extension 出錯而破壞 104 頁面正常運作
- `response.clone()` 是必要的，否則原始 response body 會被消耗掉

### 3.3 background.js — 資料轉發 & 狀態管理

**職責：**
1. 接收 content script 的 `JOBS_INTERCEPTED` message
2. 清洗/萃取職缺欄位
3. POST 到 local server
4. 維護 session 統計資料供 popup 顯示

**Message Handlers：**

| Message Type       | Action                                   | Response                              |
|--------------------|------------------------------------------|---------------------------------------|
| `JOBS_INTERCEPTED` | 清洗資料 → POST server → 更新 stats      | `{ success, newCount, duplicateCount }` |
| `GET_STATS`        | 回傳當前 session stats                    | `{ success, stats }`                  |
| `HEALTH_CHECK`     | GET /health 檢查 server 狀態              | `{ success, serverConnected }`        |

**清洗邏輯 — 從原始 job object 萃取的欄位：**

```javascript
{
  jobNo:           job.jobNo,            // String - 職缺唯一 ID（用於去重）
  jobName:         job.jobName,          // String - 職缺名稱
  custName:        job.custName,         // String - 公司名稱
  custNo:          job.custNo,           // String - 公司編號
  coIndustryDesc:  job.coIndustryDesc,   // String - 產業別描述
  description:     job.description,      // String - 職缺描述（truncated）
  jobAddrNoDesc:   job.jobAddrNoDesc,    // String - 工作地區（如「台北市松山區」）
  jobAddress:      job.jobAddress,       // String - 詳細地址
  salaryLow:       job.salaryLow,        // Number - 薪資下限（0 = 待遇面議）
  salaryHigh:      job.salaryHigh,       // Number - 薪資上限（9999999 = 以上）
  jobLink:         job.link?.job,        // String - 職缺頁面 URL
  custLink:        job.link?.cust,       // String - 公司頁面 URL
  pcSkills:        job.pcSkills.map(s => s.description),  // String[] - 技能標籤
  appearDate:      job.appearDate,       // String - 刊登日期 "YYYYMMDD"
  applyCnt:        job.applyCnt,         // Number - 應徵人數
  period:          job.period,           // Number - 經歷要求 code
  remoteWorkType:  job.remoteWorkType,   // Number - 遠端工作類型（0=無, 1=部分, 2=完全）
  employeeCount:   job.employeeCount,    // Number - 公司員工數
  lat:             job.lat,              // Number - 緯度
  lon:             job.lon,              // Number - 經度
  isApplied:       job.isApplied,        // Boolean - 是否已應徵
  isSave:          job.isSave,           // Boolean - 是否已收藏
}
```

**Search context（from metadata）：**
```javascript
{
  keyword:    metadata.filterQuery.keyword,    // "React"
  area:       metadata.filterQuery.area,       // ["6001001000", ...]
  page:       metadata.filterQuery.page,       // 12
  totalPages: metadata.pagination.lastPage,    // 57
  totalJobs:  metadata.pagination.total,       // 1130
}
```

**Server URL：** `http://localhost:3104`（Port 3104 取自 "104"）

**Stats 結構（in-memory，SW restart 會重置）：**
```javascript
{
  totalIntercepted: Number,    // 本次 session 攔截到的職缺總數
  totalNew: Number,            // 新增的（非重複）
  totalDuplicate: Number,      // 重複被跳過的
  lastInterceptedAt: String,   // ISO timestamp
  serverConnected: Boolean,    // server 是否正常
  errors: Array<{ time, message }>,  // 最近 10 筆錯誤
}
```

### 3.4 popup.html / popup.js — Extension UI

**功能需求：**
1. 顯示 server 連線狀態（綠燈/紅燈）
2. 顯示本次 session 統計：攔截數、新增數、重複數
3. 顯示最近一次攔截時間
4. 提供「開啟 Dashboard」按鈕（連到 `http://localhost:3104`）
5. 若 server 未連線，顯示提示訊息

**UI 風格：** 簡潔，寬度 320px，高度自適應。使用 104 品牌色 `#FF6600` 作為主色調。

---

## 4. Local Server

### 4.1 Server 基本配置

```javascript
// Fastify server
// Port: 3104
// CORS: 允許 chrome-extension:// origin
// Body size limit: 5MB（單次可能有 20 筆 job，每筆含 description）
```

### 4.2 API Endpoints

#### `GET /health`
Health check endpoint。

**Response:** `200`
```json
{
  "status": "ok",
  "timestamp": "2026-03-17T...",
  "totalJobs": 450
}
```

#### `POST /api/jobs`
接收 extension 攔截到的職缺資料。

**Request Body:**
```json
{
  "jobs": [
    {
      "jobNo": "9549570",
      "jobName": "前端工程師",
      "custName": "云智資訊股份有限公司",
      "custNo": "130000000102039",
      "coIndustryDesc": "其它軟體及網路相關業",
      "description": "...",
      "jobAddrNoDesc": "台北市松山區",
      "jobAddress": "台北市全區(依照公司規定分派)",
      "salaryLow": 0,
      "salaryHigh": 0,
      "jobLink": "https://www.104.com.tw/job/5oohu",
      "custLink": "https://www.104.com.tw/company/1a2x6bk61j",
      "pcSkills": ["Git", "HTML", "JavaScript", "CSS", "ReactJS"],
      "appearDate": "20260309",
      "applyCnt": 9,
      "period": 4,
      "remoteWorkType": 0,
      "employeeCount": 0,
      "lat": 25.0541591,
      "lon": 121.5638621,
      "isApplied": false,
      "isSave": false
    }
  ],
  "searchContext": {
    "keyword": "React",
    "area": ["6001001000", "6001002000"],
    "page": 12,
    "totalPages": 57,
    "totalJobs": 1130
  },
  "interceptedAt": "2026-03-16T13:08:29.000Z"
}
```

**處理邏輯：**
1. 遍歷 `jobs` 陣列
2. 對每筆 job，以 `jobNo` 查詢是否已存在
3. 若不存在 → INSERT（新增）
4. 若已存在 → UPDATE `updated_at`, `appear_date`, `apply_cnt` 等可能變動的欄位
5. 記錄 `search_keyword` 來源

**Response:** `200`
```json
{
  "success": true,
  "newCount": 15,
  "duplicateCount": 5,
  "totalInDB": 450
}
```

#### `GET /api/jobs`
查詢已收集的職缺。

**Query Parameters:**

| Param     | Type   | Default | Description                           |
|-----------|--------|---------|---------------------------------------|
| `page`    | Number | 1       | 頁碼                                  |
| `limit`   | Number | 50      | 每頁筆數                              |
| `keyword` | String | -       | 搜尋 jobName / custName / description |
| `skills`  | String | -       | 篩選技能（逗號分隔，如 `React,TypeScript`）|
| `area`    | String | -       | 篩選地區（如 `台北市松山區`）           |
| `salary_min` | Number | - | 薪資下限篩選 |
| `sort`    | String | `created_at` | 排序欄位 |
| `order`   | String | `DESC`  | 排序方向 |

**Response:** `200`
```json
{
  "success": true,
  "data": [ /* job objects */ ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 450,
    "totalPages": 9
  }
}
```

#### `GET /api/jobs/stats`
統計資料。

**Response:** `200`
```json
{
  "success": true,
  "stats": {
    "totalJobs": 450,
    "byKeyword": { "React": 320, "React Native": 130 },
    "byArea": { "台北市松山區": 85, "台北市中山區": 72 },
    "topSkills": [
      { "skill": "JavaScript", "count": 380 },
      { "skill": "React", "count": 320 },
      { "skill": "TypeScript", "count": 210 }
    ],
    "salaryDistribution": {
      "undisclosed": 180,
      "under40k": 30,
      "40k-60k": 120,
      "60k-80k": 80,
      "80k-100k": 25,
      "above100k": 15
    },
    "collectedSince": "2026-03-10T...",
    "lastUpdated": "2026-03-17T..."
  }
}
```

---

## 5. Database Schema

### 5.1 SQLite — `jobs` table

```sql
CREATE TABLE IF NOT EXISTS jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  job_no          TEXT    NOT NULL UNIQUE,          -- 104 職缺編號（去重 key）
  job_name        TEXT    NOT NULL,                 -- 職缺名稱
  cust_name       TEXT    NOT NULL,                 -- 公司名稱
  cust_no         TEXT,                             -- 公司編號
  co_industry     TEXT,                             -- 產業別
  description     TEXT,                             -- 職缺描述
  area            TEXT,                             -- 工作地區（如「台北市松山區」）
  address         TEXT,                             -- 詳細地址
  salary_low      INTEGER DEFAULT 0,               -- 薪資下限
  salary_high     INTEGER DEFAULT 0,               -- 薪資上限
  job_link        TEXT,                             -- 職缺頁面 URL
  cust_link       TEXT,                             -- 公司頁面 URL
  skills          TEXT,                             -- JSON array string: ["React","TypeScript"]
  appear_date     TEXT,                             -- 刊登日期 "YYYYMMDD"
  apply_cnt       INTEGER DEFAULT 0,               -- 應徵人數
  period          INTEGER DEFAULT 0,               -- 經歷要求 code
  remote_work     INTEGER DEFAULT 0,               -- 0=無, 1=部分, 2=完全
  employee_count  INTEGER DEFAULT 0,               -- 公司員工數
  lat             REAL,                             -- 緯度
  lon             REAL,                             -- 經度
  is_applied      INTEGER DEFAULT 0,               -- 是否已應徵 (boolean as int)
  is_saved        INTEGER DEFAULT 0,               -- 是否已收藏 (boolean as int)
  search_keyword  TEXT,                             -- 收集時的搜尋關鍵字
  created_at      TEXT    DEFAULT (datetime('now')),-- 首次收集時間
  updated_at      TEXT    DEFAULT (datetime('now')) -- 最後更新時間
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_job_no      ON jobs(job_no);
CREATE INDEX IF NOT EXISTS idx_jobs_keyword     ON jobs(search_keyword);
CREATE INDEX IF NOT EXISTS idx_jobs_area        ON jobs(area);
CREATE INDEX IF NOT EXISTS idx_jobs_salary      ON jobs(salary_low, salary_high);
CREATE INDEX IF NOT EXISTS idx_jobs_created     ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_appear_date ON jobs(appear_date);
```

### 5.2 `search_logs` table（Optional — 記錄每次攔截事件）

```sql
CREATE TABLE IF NOT EXISTS search_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword         TEXT,
  area            TEXT,     -- JSON array string
  page            INTEGER,
  total_pages     INTEGER,
  total_jobs      INTEGER,
  intercepted_count INTEGER,
  new_count       INTEGER,
  duplicate_count INTEGER,
  intercepted_at  TEXT
);
```

---

## 6. 104 API Reference

### 6.1 Endpoint
```
GET https://www.104.com.tw/jobs/search/api/jobs
```

### 6.2 Key Query Parameters
| Param       | Example                                        | Description        |
|-------------|------------------------------------------------|--------------------|
| `keyword`   | `React`                                        | 搜尋關鍵字          |
| `area`      | `6001001000,6001002000`                        | 地區代碼（逗號分隔） |
| `page`      | `12`                                           | 頁碼               |
| `pagesize`  | `20`                                           | 每頁筆數           |
| `order`     | `15`                                           | 排序方式           |
| `mode`      | `s`                                            | 搜尋模式           |
| `jobsource` | `index_s`                                      | 來源               |

### 6.3 Response Structure
```
{
  "data": [ ...jobs ],           // Array of job objects（每頁最多 20 筆）
  "metadata": {
    "pagination": {
      "count": 20,               // 本頁筆數
      "currentPage": 12,
      "lastPage": 57,            // 總頁數
      "total": 1130              // 職缺總數
    },
    "filterQuery": { ... }       // Echo back of query params
  }
}
```

### 6.4 Job Object 欄位說明（重要欄位）

| Field               | Type     | Description                                           |
|---------------------|----------|-------------------------------------------------------|
| `jobNo`             | String   | 職缺唯一 ID（如 `"9549570"`）— **去重用**              |
| `jobName`           | String   | 職缺名稱                                              |
| `custName`          | String   | 公司名稱                                              |
| `custNo`            | String   | 公司唯一 ID                                           |
| `coIndustryDesc`    | String   | 產業類別描述                                           |
| `description`       | String   | 職缺描述（truncated，非完整 JD）                       |
| `descSnippet`       | String   | 帶高亮 `[[[keyword]]]` 的描述片段                      |
| `jobAddrNoDesc`     | String   | 工作地區（如「台北市松山區」）                          |
| `jobAddress`        | String   | 詳細地址                                              |
| `salaryLow`         | Number   | 薪資下限（`0` = 待遇面議）                             |
| `salaryHigh`        | Number   | 薪資上限（`9999999` = 以上，`0` = 待遇面議）           |
| `link.job`          | String   | 職缺頁面完整 URL                                      |
| `link.cust`         | String   | 公司頁面完整 URL                                      |
| `pcSkills`          | Array    | `[{ code, description }]` — 技能標籤                  |
| `appearDate`        | String   | 刊登日期 `"YYYYMMDD"`                                 |
| `applyCnt`          | Number   | 累計應徵人數                                           |
| `period`            | Number   | 經歷要求（0=不拘, 1=1年以下, 2=1-3年, 3=3-5年, 4=5-10年, 5=10年以上）|
| `remoteWorkType`    | Number   | 遠端工作（0=無, 1=部分遠端, 2=完全遠端）               |
| `employeeCount`     | Number   | 公司員工人數（0=未提供）                               |
| `lat` / `lon`       | Number   | 經緯度座標                                            |
| `isApplied`         | Boolean  | 使用者是否已應徵此職缺                                 |
| `isSave`            | Boolean  | 使用者是否已收藏此職缺                                 |
| `tags`              | Object   | 公司福利標籤 (wf = welfare flag)                      |
| `jobCat`            | Array    | 職務類別代碼                                           |
| `hrBehaviorPR`      | Number   | HR 回覆率百分位數（0-1）                               |
| `interactionRecord` | Object   | HR 最近處理履歷/回覆的 timestamp                       |

### 6.5 薪資欄位解讀規則

| salaryLow | salaryHigh | 含義             |
|-----------|------------|------------------|
| 0         | 0          | 待遇面議          |
| 40000     | 9999999    | 40,000 以上（月薪）|
| 40000     | 60000      | 40,000 ~ 60,000   |
| 1000000   | 1500000    | 年薪 100萬~150萬（s10=60 時為年薪）|

> `s10` 欄位指示薪資類型：10=月薪, 50=月薪, 60=年薪

---

## 7. 關鍵實作注意事項

### 7.1 Content Script Injection Timing
`content.js` 必須在 `document_start` 注入，確保在 104 頁面自己的 JavaScript 執行 fetch 之前，我們的 monkey-patch 已經生效。如果用 `document_idle`（默認），可能會漏掉第一批 API call。

### 7.2 Response Clone
攔截 fetch response 時**必須**用 `response.clone()` 來讀取 body。原因是 Response body 是 ReadableStream，只能被消費一次。如果我們直接讀了 `.json()`，104 前端自己就讀不到了，頁面會壞掉。

### 7.3 Error Isolation
content script 內的所有攔截邏輯都必須包在 try-catch 裡。Extension 的 bug 不能影響 104 頁面的正常功能。這是最高優先級的原則。

### 7.4 去重策略
使用 `jobNo` 作為唯一鍵。同一個 jobNo 的職缺在不同頁面、不同搜尋條件下都可能出現。Server 端的 INSERT 使用 `INSERT OR IGNORE` 或先 SELECT 後決定 INSERT/UPDATE。

### 7.5 Server 未啟動時的行為
如果 local server 沒有啟動，background.js 的 fetch 會失敗。此時：
- 錯誤被 catch，記錄到 stats.errors
- stats.serverConnected 設為 false
- Popup 顯示紅燈 + 提示訊息
- **不** block 也 **不** retry — 資料就是遺失了（使用者重新滾動即可）

### 7.6 CORS 設定
Server 必須允許來自 Chrome Extension 的跨域請求：
```javascript
fastify.register(require('@fastify/cors'), {
  origin: true,  // 允許所有 origin（local tool，安全性不是問題）
});
```

### 7.7 Icons
Extension 需要 16x16、48x48、128x128 三個尺寸的 icon。可以用簡單的 SVG → PNG 產生，風格建議：橘色背景（#FF6600）+ 白色公事包或搜尋圖案。

---

## 8. Development & Usage Guide

### 8.1 啟動 Server
```bash
cd server
pnpm install
pnpm dev          # 啟動在 http://localhost:3104
```

### 8.2 載入 Extension
1. Chrome → `chrome://extensions/`
2. 開啟「開發人員模式」
3. 點擊「載入未封裝項目」
4. 選擇 `extension/` 資料夾

### 8.3 使用流程
1. 確認 local server 正在執行
2. 點擊 Extension icon，確認綠燈
3. 打開 104 搜尋頁面（如 `https://www.104.com.tw/jobs/search/?keyword=React`）
4. 正常瀏覽、滾動、翻頁 — 資料自動收集
5. Console 會顯示 `[Job Collector] ✅ 已收集 N 筆新職缺`

---

## 9. Future Enhancements (Out of MVP Scope)

以下功能不在 MVP 範圍內，但架構設計時應預留擴展空間：

1. **Web Dashboard** — Server 端提供一個 SPA（React），用於瀏覽、篩選、標記職缺
2. **自動標記** — 根據 skills 自動計算與使用者技能的匹配度
3. **通知機制** — 新收集到高匹配度職缺時發送 Chrome notification
4. **匯出功能** — 匯出為 CSV / Excel
5. **職缺詳細頁爬取** — 點擊收集按鈕時，進一步 fetch 該職缺的完整 JD 頁面
6. **多關鍵字管理** — 在 popup 中設定多組搜尋條件

---

## Appendix A: period (經歷) Code Mapping

| Code | Description  |
|------|-------------|
| 0    | 不拘（經歷不拘）|
| 1    | 1 年以下     |
| 2    | 1-3 年      |
| 3    | 3-5 年      |
| 4    | 5-10 年     |
| 5    | 10 年以上    |
| 6    | 未標示       |

## Appendix B: remoteWorkType Code Mapping

| Code | Description  |
|------|-------------|
| 0    | 不提供遠端工作 |
| 1    | 部分遠端     |
| 2    | 完全遠端     |
