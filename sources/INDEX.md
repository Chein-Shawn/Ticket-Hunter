# Source and Artifact Index

> Inventory of evidence and project materials. Use relative paths where a file is present in this workspace. This index does not replace the source itself.

## Status labels

- **Present:** file exists in `sources/` and its identity has been checked.
- **Linked:** source is available by a stable URL or external project location but is not copied here.
- **Missing:** expected or useful source is not currently available.
- **Needs review:** file exists but has not yet been inspected enough to rely on it.

補充：本專案另用 **Linked（未開啟）** 標示「網址來自使用者或 AI 記憶，尚未實際開啟確認」的來源。截至 2026-11-12，`sources/` 內除本檔外沒有其他檔案。

## Source inventory

### 對話與專案紀錄

| ID | Original title / filename | Type | Present path or stable URL | Purpose / related question | Useful location | Evidence status | Notes / rights / version |
|---|---|---|---|---|---|---|---|
| S001 | 先前 Claude Code 雲端工作階段的對話節錄（PTT 腳本、OPENTIX、24 小時方案） | Correspondence | 未存檔；只存在於 2026-11-12 本機工作階段中使用者貼上的文字 | 專案起源、PTT 原型設計、OPENTIX 網址、雲端環境被擋的紀錄 | 整段節錄 | Linked（僅節錄） | 使用者提供。原始對話日期與完整內容缺失；未取得匯出檔 |
| S002 | 2026-11-12 Claude Code 本機工作階段（設計提案與使用者逐題回覆） | Correspondence | 未存檔；Claude 桌面 App 的工作階段紀錄 | 所有設計決策（`STATE.md` 第 2、3 節） | 使用者對 10 題的回覆 | Linked | 決策已摘要於 `RESEARCH_LOG.md` 2026-11-12 條目 |
| S003 | `ptt_watch.py`、`.env.example`、`README.md`、`test_ptt_watch.py` | Code | 原位於先前雲端環境 `/home/user/ticket-watch/`，本機不可存取 | PTT 監測原型的邏輯參考 | — | **Missing** | 依 S001，離線測試通過，未經真實連線測試 |

### 監測目標與資料來源（實測對象）

| ID | Original title / filename | Type | Present path or stable URL | Purpose / related question | Useful location | Evidence status | Notes / rights / version |
|---|---|---|---|---|---|---|---|
| S004 | OPENTIX：蔡珂宜 Chloe Chua－2027亞洲巡迴音樂會台灣首演 | Web page | https://www.opentix.life/event/2108010089152028673 | 兩場的場次、票區、票價、剩餘張數；官方退票監測；退票規定 | HTML 中的 `window.__NUXT__` → `events[].groupSections[].quantity.remainingQuantity` | Linked（2026-11-12 開啟） | 不帶 cookie 回 200，無 Cloudflare；**Google 主機 200（720 ms，431 KB）**；觀察值見 `RESEARCH_LOG.md` 2026-11-12 各條目 |
| S005 | PTT Drama-Ticket 看板索引與文章頁 | Web page | https://www.ptt.cc/bbs/Drama-Ticket/index.html | 轉售文主要來源；挑選測試活動 | `.r-ent .title a`、`.date`、「上頁」連結；文章 `#main-content` | Linked（2026-11-12 開啟） | 從使用者家用 IP 回 200；**Google 主機：索引 200（808 ms）、文章 200（266 ms）**；先前 Claude 雲端環境回 403（S001） |
| S006 | PTT Drama-Ticket Atom feed | Feed | https://www.ptt.cc/atom/Drama-Ticket.xml | 輕量的雲端抓取方式 | 20 則 `<entry>`；`content` 只有內文前幾行 | Linked（2026-11-12 開啟） | 已確認存在（HTTP 200，`application/xml`）；**Google 主機 200（273 ms）** |
| S015 | 官方售票平台首頁：KKTIX、拓元、ibon、年代、寬宏、遠大 | Web pages | https://kktix.com/events 、https://tixcraft.com/activity 、https://ticket.ibon.com.tw/ 、https://ticket.com.tw/ 、https://kham.com.tw/ 、https://ticketplus.com.tw/ | 官方退票／釋出票監測的可行性 | 僅首頁或列表頁 | Linked（2026-11-12 開啟） | 不帶 cookie：KKTIX 403（Cloudflare）、拓元列表 200、ibon 200（SPA）、年代 200、寬宏 200、遠大 200（SPA）；**Google 主機**：KKTIX 403（Cloudflare），拓元、年代、寬宏、ibon、遠大皆 200；年代與寬宏約 1.2–1.5 秒；活動頁格式未測 |
| S019 | 拓元：F✦FOREVER 恆星之城・光年赴約・臺北 限定場演唱會 | Web page | https://tixcraft.com/activity/game/26_forever | 測試活動的官方頁 | 場次表 | Linked（2026-11-12 開啟） | 本機不帶 cookie 回 401；帶 cookie 回 200，顯示「目前無場次資訊」；**Google 主機 200（456 ms，56 KB）**，內容待確認 |
| S018 | Facebook 社團、Instagram、X | Web pages | — | 社群轉售來源 | — | Missing（未測，需登入） | 只會在本機擴充功能中、以使用者已登入的帳號讀取 |
| S020 | Dcard 票券看板 API | JSON API | https://www.dcard.tw/service/api/v2/forums/tickets/posts?limit=30 ；搜尋：`/service/api/v2/search/posts?query=…` | 轉售文來源（約每天 31 篇） | 欄位 `id`、`title`、`createdAt`、`forumAlias` 等 | Linked（2026-11-12 開啟） | 不帶 cookie 回 200 JSON（Cloudflare，無 challenge）；非公開文件化的介面，可能變動；**Google 主機 403（Cloudflare challenge）→ 改走本機** |
| S021 | 旋轉拍賣搜尋頁 | Web page | https://tw.carousell.com/search/<關鍵字> | 拍賣平台轉售 | 搜尋結果列表 | Linked（2026-11-12 開啟） | 本機不帶 cookie 回 200；**Google 主機 403（Cloudflare）**；測試活動只有 4 筆，量少 |
| S022 | Threads 搜尋頁 | Web page | https://www.threads.com/search?q=<關鍵字> | 社群轉售來源 | — | Linked（2026-11-12 開啟） | 未登入時結果幾乎不相關，「最新」排序查無結果，需登入；**Google 主機 200 但內容由 JavaScript 載入，HTML 中無結果** |

### 專案產出的工具

| ID | Original title / filename | Type | Present path or stable URL | Purpose / related question | Useful location | Evidence status | Notes / rights / version |
|---|---|---|---|---|---|---|---|
| A001 | `probe.gs` | Code (Apps Script) | `tools/gas-probe/probe.gs` | 從 Google 主機探測各來源能否存取 | `probeSources()`、`PROBE_TARGETS` | Present | 2026-11-12，模擬測試通過；同日由使用者在 Apps Script 實際執行成功（報告記於 `RESEARCH_LOG.md`）；只做 GET，不執行網站的程式碼；預定 MIT 授權 |
| A002 | Ticket hunter Apps Script 原始碼 v0.1.0 | Code (Apps Script) | `apps-script/src/` | 第一階段 1a 雲端監測 | 見 `STATE.md` 第 8 節 | Present | 2026-11-12；離線測試通過，未在 Google 實跑；MIT |
| A003 | 離線測試與測試樣本 | Code + data | `apps-script/tests/` | 回歸測試 | `fixtures/ptt_atom_20261112.xml`（取自 S006，2026-11-12 22:22，作者帳號換成 userN、聯絡 ID 遮蔽）；`fixtures/opentix_chloe_20261112.html`（取自 S004，同時間，只保留 `<title>` 與 `__NUXT__` 腳本） | Present | 衍生資料，原始回應未保存 |
| A004 | 安裝說明與打包檔 | Docs + build | `apps-script/SETUP.md`、`apps-script/build.sh`、`apps-script/dist/` | 使用者安裝 | — | Present | 2026-11-12 |

### 平台規格、法規與官方文件（待查證）

| ID | Original title / filename | Type | Present path or stable URL | Purpose / related question | Useful location | Evidence status | Notes / rights / version |
|---|---|---|---|---|---|---|---|
| S007 | Claude Code 雲端環境網路存取文件 | Official doc | https://code.claude.com/docs/en/cloud-environments#network-access | 先前雲端環境被擋的原因（背景資料） | network access 章節 | Linked（未開啟） | 先前對話引用；本專案不依賴 |
| S010 | Google for Developers：「Google 服務的配額」（Apps Script） | Official doc | https://developers.google.com/apps-script/guides/services/quotas | 觸發器每日時數、UrlFetch 次數、寄信上限 | 「目前的配額」與「目前的限制」兩張表 | Linked（2026-11-12 開啟） | 頁面標示最後更新 2026-04-23 UTC。個人帳號：觸發器 90 分鐘／天、網址擷取 20,000 次／天、寄信收件人 100／天、觸發器 20 個／使用者／腳本、回應 50 MB／次。最短觸發間隔與單次執行時間上限本次未擷取，仍待查證 |
| S011 | Gemini API 免費額度與資料使用條款 | Official doc | 候選網址：https://ai.google.dev/gemini-api/docs/rate-limits ；定價與條款頁待確認 | 免費額度是否足夠；免費方案資料是否用於訓練 | 額度表、條款 | Linked（未開啟） | **待查證**；Google 會調整額度 |
| S012 | Chrome 內建 AI（Prompt API） | Official doc | 候選網址：https://developer.chrome.com/docs/ai/prompt-api | 擴充功能的離線 AI 備援：硬體需求、可用版本 | 需求章節 | Linked（未開啟） | **待查證** |
| S013 | 文化創意產業發展法（轉售票價與不正方法購票相關條文） | Law | 全國法規資料庫，網址待確認 | 高於原價選項的法規提醒；只通知不代購的依據 | AI 記憶為第 10 條之 1 | Missing | 條號與內容**待查證** |
| S014 | LINE Notify 終止服務公告 | Official notice | 網址待確認 | 排除 LINE Notify 的理由 | — | Missing | AI 記憶為 2025 年終止，**待查證**；使用者已決定只用 Gmail，影響小 |
| S016 | Threads API（關鍵字搜尋） | Official doc | 網址待確認 | 評估是否有免登入或官方方式讀取 Threads | — | Missing | 可能需要 Meta 開發者帳號與審核（假設） |
| S017 | Chrome Extensions Manifest V3（背景執行、alarms、host permissions） | Official doc | 候選網址：https://developer.chrome.com/docs/extensions | 擴充功能本機監測的可行性與限制 | alarms、service worker 章節 | Linked（未開啟） | **待查證** |

## Evidence notes

- 「先前 PTT 原型離線測試通過」→ 只有 S001 的文字敘述；原型檔案缺失（S003），無法重現。
- 「Chloe Chua 兩場的日期、地點、OPENTIX 網址」→ 已於 2026-11-12 開啟 S004 核對：2027-01-02 19:30 高雄市音樂館、2027-01-03 19:30 國家音樂廳。
- 「F.FOREVER《恆星之城》每天都有轉售文」→ S005 抽樣 7 天統計，見 `RESEARCH_LOG.md` 2026-11-12 實測條目。
- 所有設計決策 → S002，使用者提供，摘要於 `RESEARCH_LOG.md` 2026-11-12。
- 所有平台配額、免費額度、法條 → AI 記憶，待查證（S010–S017）。

## Missing sources to request or locate

| Source needed | Why it matters | Expected owner / location | Status / next action |
|---|---|---|---|
| PTT 原型程式（S003） | 可沿用過濾與重試邏輯；非必要 | 使用者的先前 Claude 雲端工作階段 | Missing — 若能匯出，放入 `sources/code-or-examples/ptt-prototype/` |
| 先前對話完整匯出（S001） | 確認日期與完整決策脈絡 | 使用者的 Claude 帳號 | Missing — 非必要；需要時請使用者匯出 |
| 年代、寬宏、ibon、遠大的活動頁剩餘票格式 | 決定解析方式 | 以內建瀏覽器開啟一個販售中的活動 | Missing |
| FB、IG、X 的實測（S018） | 本機擴充功能的解析方式 | 第二階段，在使用者已登入的瀏覽器中測試 | Missing |
| 官方文件查證（S010–S014、S016、S017） | 預設頻率、配額保護、AI 額度、法規提醒文字 | 官方網站 | Missing — 見 `STATE.md` 第 6 節 P0 |
| Apps Script 實際執行結果 | 驗證 Google 主機能否存取各來源 | 使用者在自己的 Apps Script 執行 | Missing — 第一階段程式完成後 |

## Citation conventions

- **Papers:** author(s), year, title, journal, DOI, local PDF filename, and page/figure/equation when used.
- **Technical documentation:** organization, document title, model/version, revision/date, URL or local path, relevant section/table.
- **Code:** relative path, function/class, version/commit, inputs, and relevant test or output.
- **Data and measurements:** original filename, collection date, units, conditions, calibration, processing method, and uncertainty if known.
- **Web or conversation sources:** stable URL or human-readable account/project/conversation/date; record what was actually accessible and mark exports/attachments that were not obtained as `Missing`.
- **Rights and privacy:** record license/permission and redistribution scope where known. Never assume that permission to use a source also permits publishing or redistributing it.

本專案補充：網頁實測紀錄須註明日期、存取位置（內建瀏覽器、Apps Script 或使用者電腦）、HTTP 狀態與觀察到的資料介面。不得儲存他人的個人資料（賣家帳號、聯絡方式），範例資料需去識別化。

## Suggested folders (create only when needed)

```text
sources/
├── INDEX.md
├── papers/
├── documentation/
├── data/
├── code-or-examples/
├── images-or-recordings/
└── correspondence-or-notes/
```

Do not create empty placeholder files to imply that a source exists. Keep original filenames when practical and never overwrite source originals.
