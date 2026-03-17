# 104 Job Collector

> 自動攔截並收集 104 人力銀行職缺資料的 Chrome Extension + Local Server 工具組。

瀏覽 104 搜尋結果時，自動攔截 API 回應、清理資料、存入本地 SQLite 資料庫，並提供 RESTful API 進行查詢與統計分析。

## 功能特色

- **零操作收集** — 瀏覽 104 搜尋頁面時自動攔截，無需手動操作
- **智慧去重** — 以 `job_no` 為唯一鍵，重複職缺自動更新而非重複寫入
- **豐富查詢** — 支援關鍵字、技能、地區、薪資範圍等多條件篩選
- **統計分析** — 關鍵字分布、地區分布、熱門技能、薪資級距一覽
- **搜尋紀錄** — 自動記錄每次搜尋的上下文（關鍵字、頁數、筆數）
- **即時狀態** — Popup UI 顯示 Server 連線狀態與本次 Session 統計
- **安全攔截** — 所有攔截邏輯皆有 try-catch 保護，絕不影響 104 網站正常運作

## 架構流程

```
104.com.tw 搜尋頁面
       │
       ▼
┌─────────────────┐    postMessage    ┌─────────────┐   chrome.runtime   ┌──────────────┐
│  injected.js    │ ───────────────▶  │  content.js  │ ────────────────▶  │ background.js │
│  (MAIN world)   │                   │  (bridge)    │   .sendMessage     │ (Service      │
│  攔截 fetch/XHR │                   └─────────────┘                    │  Worker)      │
└─────────────────┘                                                      └──────┬───────┘
                                                                                │ HTTP POST
                                                                                ▼
                                                                     ┌──────────────────┐
┌──────────────┐         SQLite                                      │  Fastify Server   │
│   jobs.db    │ ◀──────────────────────────────────────────────────  │  localhost:3104   │
│  (WAL mode)  │                                                     └──────────────────┘
└──────────────┘
```

## Tech Stack

| 層級            | 技術                                   |
| --------------- | -------------------------------------- |
| Extension       | Chrome Manifest V3、Vanilla JavaScript |
| Server          | Node.js (ES Modules)、Fastify 5        |
| Database        | SQLite 3（better-sqlite3、WAL mode）   |
| Package Manager | pnpm                                   |

> 無需任何 build step — Extension 和 Server 皆為原生 JavaScript。

## 專案結構

```
Job_Collector/
├── extension/                  # Chrome Extension
│   ├── manifest.json           # MV3 設定
│   ├── background.js           # Service Worker：資料清理、轉發 Server
│   ├── content.js              # Content Script：bridge（MAIN ↔ Extension）
│   ├── injected.js             # MAIN world：攔截 fetch/XHR
│   ├── popup.html              # Popup UI
│   ├── popup.js                # Popup 邏輯
│   ├── popup.css               # Popup 樣式
│   └── icons/                  # Extension 圖示（16/48/128px）
│
└── server/                     # Local Server
    ├── package.json            # 專案設定與 scripts
    ├── src/
    │   ├── index.js            # Fastify 進入點（port 3104）
    │   ├── db.js               # SQLite 初始化、prepared statements
    │   ├── routes/
    │   │   ├── jobs.js         # POST/GET /api/jobs、GET /api/jobs/stats
    │   │   └── health.js       # GET /health
    │   └── utils/
    │       └── salary.js       # 薪資格式化與級距分類
    └── data/
        └── jobs.db             # SQLite 資料庫（自動建立、已 gitignore）
```

## 快速開始

### 前置需求

- **Node.js** 18+
- **pnpm**（`npm install -g pnpm`）
- **Google Chrome**

### 1. 啟動 Server

```bash
cd server
pnpm install
pnpm dev        # 開發模式（含 --watch 自動重啟）
```

Server 啟動後會監聽 `http://localhost:3104`。

### 2. 載入 Extension

1. 開啟 Chrome，前往 `chrome://extensions/`
2. 開啟右上角「開發人員模式」
3. 點擊「載入未封裝項目」
4. 選擇專案中的 `extension/` 資料夾

載入成功後，工具列會出現 104 Job Collector 圖示。

### 3. 開始收集

1. 前往 [104 人力銀行](https://www.104.com.tw/) 搜尋職缺
2. Extension 會自動攔截搜尋結果並送入本地資料庫
3. 點擊工具列圖示查看即時統計

## 使用手冊

### 日常使用流程

```
搜尋 104 職缺 → Extension 自動攔截 API 回應 → 資料清理 & 去重 → 存入 SQLite
```

你只需要正常瀏覽 104 搜尋結果頁面，每翻一頁，該頁的職缺資料就會自動被收集。

### Popup UI 說明

點擊工具列的 Extension 圖示會顯示：

| 元素            | 說明                        |
| --------------- | --------------------------- |
| 狀態燈（綠/紅） | Server 連線狀態             |
| Intercepted     | 本次 Session 攔截的總職缺數 |
| New             | 新增的職缺數                |
| Duplicate       | 重複（已更新）的職缺數      |
| Last Time       | 最後一次攔截時間            |
| Open Dashboard  | 開啟 `localhost:3104`       |

### API 使用說明

Server 提供以下 RESTful API：

#### `GET /health` — 健康檢查

```bash
curl http://localhost:3104/health
```

回應：

```json
{
  "status": "ok",
  "timestamp": "2026-03-17T10:00:00.000Z",
  "totalJobs": 450
}
```

#### `GET /api/jobs` — 查詢職缺

```bash
# 基本查詢（預設第 1 頁、每頁 20 筆）
curl http://localhost:3104/api/jobs

# 帶篩選條件
curl "http://localhost:3104/api/jobs?keyword=React&area=台北&salary_min=50000&sort=salary_low&order=DESC"
```

**查詢參數：**

| 參數         | 預設值       | 說明                                                                         |
| ------------ | ------------ | ---------------------------------------------------------------------------- |
| `page`       | 1            | 頁碼                                                                         |
| `limit`      | 20           | 每頁筆數（最大 100）                                                         |
| `keyword`    | —            | 搜尋職缺名稱、公司名稱、描述                                                 |
| `skills`     | —            | 篩選技能（子字串匹配）                                                       |
| `area`       | —            | 篩選地區                                                                     |
| `salary_min` | —            | 最低薪資門檻                                                                 |
| `sort`       | `created_at` | 排序欄位：`created_at`、`appear_date`、`salary_low`、`apply_cnt`、`job_name` |
| `order`      | `DESC`       | 排序方向：`ASC` 或 `DESC`                                                    |

回應：

```json
{
  "success": true,
  "data": [ { "job_no": "...", "job_name": "...", ... } ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 450,
    "totalPages": 23
  }
}
```

#### `GET /api/jobs/stats` — 統計資料

```bash
curl http://localhost:3104/api/jobs/stats
```

回應：

```json
{
  "success": true,
  "totalJobs": 450,
  "byKeyword": [{ "keyword": "React", "count": 320 }],
  "byArea": [{ "area": "台北市松山區", "count": 85 }],
  "topSkills": [{ "skill": "JavaScript", "count": 380 }],
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
```

#### `POST /api/jobs` — 寫入職缺（Extension 自動呼叫）

```bash
curl -X POST http://localhost:3104/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobs": [{ "jobNo": "12345678", "jobName": "前端工程師", ... }],
    "searchContext": {
      "keyword": "React",
      "area": "台北市",
      "page": 1,
      "totalPages": 10,
      "totalJobs": 200
    },
    "interceptedAt": "2026-03-17T10:00:00Z"
  }'
```

回應：

```json
{
  "success": true,
  "newCount": 15,
  "duplicateCount": 5,
  "totalInDB": 450
}
```

### 常見問題

**Q: Popup 顯示紅燈（Server is offline）？**
確認 Server 有在執行：

```bash
cd server && pnpm dev
```

**Q: 瀏覽 104 但沒有攔截到資料？**

- 確認你在搜尋結果頁面（URL 包含 `/jobs/search/`）
- 開啟 DevTools Console 確認是否有錯誤訊息
- 嘗試重新載入 Extension（`chrome://extensions/` → 點擊重新整理圖示）

**Q: 資料庫檔案在哪裡？**
`server/data/jobs.db`（SQLite 格式，可用任何 SQLite 工具開啟）

**Q: 如何清空所有資料？**
刪除 `server/data/jobs.db`，重啟 Server 會自動重建空資料庫。

**Q: 可以同時開多個 104 搜尋分頁嗎？**
可以。每個分頁的攔截資料都會獨立送到 Server，去重邏輯會自動處理。

## 開發相關

### 開發模式

```bash
cd server
pnpm dev    # 使用 node --watch 自動重啟
```

修改 `server/src/` 下的任何檔案後，Server 會自動重新啟動。

Extension 的修改則需到 `chrome://extensions/` 手動重新載入。

### 資料庫

- 位置：`server/data/jobs.db`
- 模式：WAL（Write-Ahead Logging），支援並行讀寫
- 資料表：`jobs`（職缺）、`search_logs`（搜尋紀錄）
- 已建立 6 個 index 加速查詢

### 正式啟動

```bash
cd server
pnpm start    # 不含 --watch
```
