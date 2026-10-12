# 🌿 Clarity Content Engine
> **心理學社群與播客半自動化內容工作室**  
> **Human thinking → AI multiplication → Human approval → Multi-platform publishing**

專為 Betty 的正向心理學、釐清教練（Clarity Coaching）、高敏感（HSP）與邊界（Boundaries）個人品牌量身打造的 Agentic 內容產製與播客工作室。

---

## 📌 專案簡介 (Project Overview)

現代個人品牌經營者常面臨「靈感零碎、耗時改寫多平台格式、文獻查證繁瑣、AI 產出缺乏個人靈魂」的困境。

**Clarity Content Engine** 透過「半自動化管線 (Human-in-the-Loop Multi-Agent Architecture)」，將「教練個人洞見」與「心理學嚴謹學理」結合：
1. **輸入端 (Frictionless Input)**：出門在外手機隨手記，透過 Google 表單/試算表自動同步，或一鍵貼入 YouTube / 網頁連結。
2. **學理查證 (Academic Grounding & Search Verification)**：自動對齊 7 大心理學框架，並以 Google Search Grounding 逐條驗證 APA 文獻真偽，杜絕 AI 幻覺。
3. **靈魂注入 (Voice & Insight Interview)**：透過 5 道關鍵訪談提問融入教練真實體會；未補充處明確標記 `[VERIFY]`。
4. **母文章門禁 (12-Step Master Article & CLEAR Guard)**：生成 12 步結構母文章，經由 CLEAR 五維度品質與倫理審查，強制核准後方可解鎖衍生內容。
5. **多平台倍增 (Multiplication & Podcast Studio)**：
   - 🎙️ **播客錄音室**：3款標題、30秒開場 Hook、分段提綱、逐字講稿、Show Notes、NotebookLM 筆記。
   - 📱 **社群矩陣**：Instagram 7~9頁輪播（含視覺 Prompt）、Facebook 暖心長文、Threads 3姊妹篇、Blog SEO 專欄。
   - 📦 **單鍵匯出**：整合為乾淨 Markdown，支援本機或 Google Drive 同步資料夾。
   - 🔁 **回饋自學庫 (Learning Library)**：記錄社群成效數據與教練修訂筆記，越寫越貼近個人風格。

---

## ✨ 核心特色與五大工作模組

| 模組 | 功能與特色 |
|---|---|
| 💡 **靈感與學理研究 (Idea Inbox & Research)** | 支援純筆記、網頁與 YouTube 影片分析。自動對齊 CBT、ACT、Bowen、PERMA 等理論，並以 Google Search 驗證文獻真實性。 |
| ✍️ **洞見訪談與母文 (Interview & Master Writer)** | 5 道引導提問萃取真實經歷。12 步架構母文 + **CLEAR 門禁審查** (Complete, Clear, Evidence, Audience, Revise)，未處理 `[VERIFY]` 前後端自動鎖定。 |
| 🎙️ **播客錄音室 (Podcast Studio)** | 支援重點提綱模式與口播逐字稿，Show Notes 時間軸與查證文獻自動對齊，一鍵複製 Google NotebookLM 格式筆記。 |
| 📱 **社群多平台矩陣 (Social Multiplier)** | 自動調適各平台字數與排版規格（IG 輪播卡與 Canva/Imagen 生圖提示詞、FB 深度文、Threads 洞見/重構/練習三部曲、SEO Blog）。 |
| ⚙️ **設定、理論庫與自學庫 (Settings & Learning Library)** | 信任文獻清單管理、Google Form 手機靈感同步、成效分析萃取教練專屬寫作法則。 |

---

## 🏗️ 系統技術架構 (Architecture)

```
clarity-content-engine/
├── server/
│   ├── config/brand.json              # 品牌語氣、教練角色、核心承諾
│   ├── knowledge/                     # 7 大心理學實證框架知識庫
│   ├── services/
│   │   ├── gemini_service.js          # Google Gemini REST API 客戶端（支援 Search Grounding & YouTube）
│   │   ├── research_service.js        # 學理對齊與 Google Search 引用查證
│   │   ├── master_service.js          # 12 步母文章生成與 CLEAR 倫理門禁審查
│   │   ├── podcast_service.js         # 播客大綱、講稿、Show Notes 與 NotebookLM 筆記
│   │   ├── multiplier_service.js      # IG / FB / Threads / Blog 平台適配矩陣
│   │   ├── source_fetcher.js          # 網頁抽取、Jina Reader 轉譯與 YouTube 多模態支援
│   │   ├── inbox_sync.js              # Google Form / 試算表 CSV 手機靈感同步
│   │   ├── learning_service.js        # 成效數據萃取寫作優化建議
│   │   └── export_service.js          # 全集 Markdown 匯出與 Google Drive 整合
│   ├── routes/api.js                  # 完整 RESTful API 端點
│   ├── progress.js                    # 長任務進度追蹤與主題鎖定
│   ├── db.js                          # SQLite WASM (sql.js) 本機安全存儲
│   └── index.js                       # Express.js 後端服務 (Port 3002)
├── src/                               # Vite 前端 SPA (Port 5174)
│   ├── css/style.css                  # 現代毛玻璃溫暖教練風格設計系統
│   └── js/
│       ├── app.js                     # 狀態管理、導航與同步機制
│       ├── utils.js                   # XSS 安全過濾 (DOMPurify + Marked) 與格式化
│       └── components/                # 5 大功能分頁介面組件
├── mobile_inbox_setup.md              # 手機 Google 表單免連網同步設定指南
├── package.json
└── vite.config.js
```

---

## 🚀 快速啟動 (Quick Start)

### 1. 安裝相依套件
```bash
npm install
```

### 2. 同步啟動前後端服務
```bash
npm run dev
```
啟動完成後於瀏覽器開啟：
- **前端介面**：`http://localhost:5174`
- **後端 API**：`http://localhost:3002`

---

## 🔑 Gemini API Key 設定

- **自動繼承**：若本機已有同系列的 `clarity-coaching` 專案，系統啟動時會自動讀取既有金鑰，免除重填困擾。
- **手動設定**：亦可在右上角「⚙️ 設定與理論庫」中填入 Google AI Studio API Key 或設定環境變數 `GEMINI_API_KEY`。

---

## 🔒 隱私與本機優先原則 (Privacy & Local-First)

- 所有資料庫資料、訪談草稿、產出成果皆完整儲存於本地 `server/data/content_engine.db`。
- 不上傳使用者私密個資或個案資訊，嚴格恪守教練倫理與身心健康非診斷原則。
