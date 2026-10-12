# Clarity Content Engine
### 心理學社群與播客半自動化內容工作室

> **Human thinking → AI multiplication → human approval → scheduled publishing**  
> 專為 Betty 的正向心理學、釐清教練（Clarity Coaching）、高敏感（HSP）與邊界（Boundaries）個人品牌打造的半自動化內容與播客引擎。

---

## ✨ 核心特色與工作流

| 模組 | 功能說明 |
|---|---|
| 💡 **Idea Inbox & Academic Research** | 隨手記錄靈感、網址或 YouTube 影片，自動啟動 **Research Agent** 對齊 7 大心理學實證理論（CBT、ACT、HSP SPS、Bowen 邊界論、PERMA 等），並提供規範學術引用出處與延伸閱讀。 |
| 🎙️ **Personal Insight Interview** | 透過 5 道關鍵引導問題萃取 Betty 親身經驗與教練敏銳度，確保文章擁有獨特靈魂，杜絕泛濫 AI 雞湯。 |
| 📝 **Master Article & CLEAR Guard** | 自動產出符合 12 步架構的母文章，並由 **CLEAR Guard Agent** 進行嚴格審核（Complete, Clear, Evidence, Audience, Revise），確保無診斷化定性、遵守身心健康倫理安全。 |
| 🎧 **Podcast Studio (播客錄音室)** | 產生 3 款候選標題（吸睛型/反思型/學理型）、30秒開場 Hook、**重點提綱模式 (Talking Points)**、**逐段口語講稿 (Full Script)** 與節目資訊欄 (Show Notes，含精確時間軸與心理學文獻)。 |
| ✨ **Google NotebookLM 專屬協同** | 一鍵匯出為 NotebookLM 最佳化結構筆記，上傳後可直接觸發 Google Audio Overview 雙人 AI 語音對話發想！ |
| 📱 **Social Multiplier (全平台矩陣)** | 母文章通過審核後一鍵倍增：**IG 7~9頁輪播卡**（含視覺/生圖 Prompt 與完整 Caption）、**FB 暖心對話長文**、**Threads 3 姊妹篇**（洞見/重構/練習）及 **Blog SEO 長文**。 |
| 🔒 **Local-First & 隱私安全** | 所有靈感、草稿、母文章與社群矩陣皆保存在本機 SQLite 資料庫中（`server/data/content_engine.db`），絕不外洩。 |

---

## 🏗️ 技術架構

```
clarity-content-engine/
├── server/
│   ├── config/brand.json              # 品牌語氣、核心承諾、免責聲明模板
│   ├── knowledge/                     # 7 大心理學實證框架知識庫 (JSON)
│   ├── services/
│   │   ├── gemini_service.js          # Google Gemini 2.5 Flash / Pro 調用客戶端
│   │   ├── research_service.js        # Prompt 1: 學理檢索與 Research Pack
│   │   ├── master_service.js          # Prompt 3: 12步母文章 + Prompt 4: CLEAR 審查門禁
│   │   ├── podcast_service.js         # 播客雙模式講稿 + Show Notes + NotebookLM 匯出
│   │   └── multiplier_service.js      # Prompt 5: IG 輪播、FB、Threads、Blog 矩陣
│   ├── routes/api.js                  # REST API 路由
│   ├── db.js                          # sql.js (SQLite WASM) 本機持久化存儲
│   └── index.js                       # Express.js 後端服務 (Port 3002)
├── src/                               # Vite 前端 (Vanilla JS SPA, Port 5174)
│   ├── css/style.css                  # 現代毛玻璃溫暖教練風格設計系統
│   └── js/
│       ├── app.js                     # 狀態管理與導航控制器
│       └── components/                # 5 大功能頁面組件
├── package.json
└── vite.config.js
```

---

## 🚀 快速啟動

### 1. 安裝相依套件（已預先安裝）
```bash
npm install
```

### 2. 同步啟動前後端服務
```bash
npm run dev
```
啟動後在瀏覽器開啟：**http://localhost:5174**

- 前端介面：`http://localhost:5174`
- 後端 API：`http://localhost:3002`

---

## 🔑 Gemini API Key 設定

- 系統已內建自動偵測功能：若您在隔壁的 `clarity-coaching` 專案中已經設定過 API Key，本系統會在啟動時**自動帶入**，無需重複輸入！
- 您也可以隨時在介面的 **⚙️ 設定與理論庫** 中直接輸入或更換。

---

## 💡 Google Pro & 手機端極簡協同工作流

1. **出門在外 / 隨手記錄**：
   在手機備忘錄或 Google Keep 記下一句話或貼上 YouTube 連結。
2. **每週選題 (週一)**：
   回到本系統貼上靈感，點擊 **「啟動 Research Agent」**，系統將自動比對心理學文獻並生成 Research Pack。
3. **注入靈魂 (週二)**：
   在 **「洞見訪談與母文」** 頁面，花 3~5 分鐘回答 5 個個人問題，一鍵產出 12 步母文章與 CLEAR 審查報告。
4. **錄製 Podcast (週三)**：
   核准母文章後進入 **「播客錄音室」**，可選提綱模式或逐段腳本進行錄音；或點擊「複製 NotebookLM 筆記」到 NotebookLM 先聽聽 AI 導讀！
5. **發布社群 (週四/五)**：
   進入 **「社群多平台矩陣」**，滑動預覽 IG 輪播每頁卡片、複製生圖 Prompt，或一鍵複製 FB 與 Threads 貼文進行排程發布。
