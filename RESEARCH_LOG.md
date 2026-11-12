# Research and Work Log

> Durable record of reasoning and project history. This file may cover research, software, product, operations, creative work, or other projects; rename the title if useful, but keep this path if `AGENTS.md` refers to it.

## How to maintain this log

- Add entries in reverse chronological order or group by topic with dated subentries; use one convention consistently.
- Record decisions and reasoning that future contributors cannot reliably reconstruct from current files or version history.
- Link to relative paths, commits, source IDs, test outputs, and measurements. Avoid chat-only references such as internal message IDs.
- Separate evidence from interpretation. Preserve important rejected approaches and why they were rejected; distinguish these from options merely deferred.
- Do not copy long source documents into this log. Index them in `sources/INDEX.md` and summarize the relevant section.
- Add information progressively. A handoff should capture the current state before a conversation or contributor changes.

本檔採用**新到舊**排列。來源編號（S0xx）對應 `sources/INDEX.md`。

---

## 第一階段 1a 實作：Apps Script 雲端核心 — 2026-11-12

### Question or objective

先交付可以實際部署、端到端運作的雲端監測（PTT＋OPENTIX＋Gmail），再在上面加 AI 與其他來源。

### Analysis, implementation, or method

- **拆分：** 第一階段分成 1a（規則式核心，本次完成）與 1b（Gemini、Gmail 匯入、Web App 儀表板與設定精靈、其他官方平台）。理由：先讓使用者能部署實測，以真實資料校正配額與規則，再加上依賴外部 AI 的部分。
- **程式結構（A002）：** 純邏輯（解析、比對、排程、Email 內容）與 Google 服務呼叫分開，前者可以離線測試。檔名前的數字決定 Apps Script 的載入順序；`build.sh` 依序串成單一檔案，方便貼上安裝。
- **PTT：**
  - Atom feed 只有前幾行，所以只對關鍵字命中的文章用 `fetchAll` 抓全文。
  - 第一次執行只判斷 60 分鐘內的文章。已讀 ID 保留最近 400 筆。
  - 20 篇全是新文章時記一筆「可能漏看」。
  - 同賣家同標題（去掉分類、正規化後）在 N 小時內只通知一次，預設 12 小時。
- **規則式判斷（無 AI）：**
  - 判斷順序：標題分類（預設略過徵、求、公告、換票、代訂等）→「已售」→排除字→「同時出現」規則→日期（文章寫了日期且全部不在選定場次才略過）→價格。
  - 價格讀法：「原價／售價」欄位、自由書寫的「原價每張…降售每張…」、標題的 `4980+200`（視為加價）、`1680*2`（單價）、「原讓」。
  - 看不出價格時預設仍通知，並加註。
- **OPENTIX：** 勾選票區的剩餘張數「第一次看到且大於 0」或「比上次多」才通知；張數減少不通知。上次張數記錄所有票區，所以之後才勾選的票區不會因為張數一直沒變而誤報。
- **配額保護：** 每分鐘觸發都會耗時，因此估算模型為「剩餘分鐘 × 閒置成本 ＋ 剩餘非靜音分鐘 ÷ 間隔 × 額外成本 ≤ 剩餘預算」。閒置與執行的平均耗時取自當天的實際紀錄，每次觸發另加 250 ms 估計的啟動開銷（未實測）。
- **安全：** 依 `AGENTS.md` 規則，NUXT 解析器只接受資料語法；遇到函式呼叫、`new` 或未知名稱就丟錯，測試有涵蓋。
- **測試環境：** 這台 Mac 沒有 Node，改用 macOS 內建 JavaScriptCore（`osascript -l JavaScript`），執行器會優先使用 Node。整合測試用假的 SpreadsheetApp、UrlFetchApp、PropertiesService、MailApp、LockService、ScriptApp、Session。

### Evidence

- **已驗證：** `apps-script/tests/run-tests.sh` 42 項通過；故意加入一個失敗測試時，執行器回傳 exit 1 並列出 FAIL，證明會偵測失敗。
- **已驗證：** 真實樣本（A003）中，高雄場 5 個票區、臺北場 9 個票區；臺北輪椅席 11、輪椅陪同席 11；開演時間解析為 2027/01/02 19:30 與 2027/01/03 19:30。

### Limitations and unresolved issues

- 尚未在真正的 Apps Script 執行。工作表 API 行為、觸發器時間、執行時間與 Gmail 寄送都要實測。
- 規則式價格判讀會有誤判，例如文中有多個價格、或以「私訊」報價；1b 的 AI 判讀會改善。
- 停機超過 feed 範圍（約 20 篇）時，舊文章會漏看；目前只記錄提醒，還沒有補抓看板索引頁。

### Next direction

- 使用者依 `apps-script/SETUP.md` 部署實測（`STATE.md` 第 6、7 節）。

---

## Google 主機探測結果與雲端／本機路線定案 — 2026-11-12

### Question or objective

依使用者在自己的 Apps Script 執行 `probeSources()` 的結果（A001），決定每個來源走雲端或本機，以及預設監測頻率。

### Evidence

- **使用者提供（觀察到的執行輸出）：** 報告 `ticket-hunter-gas-probe/1`，`ranAt` 2026-11-12T14:15:38Z，總耗時 15.2 秒（含 14 次 0.5 秒間隔）。

| 來源 | HTTP | 耗時 ms | KB | 結果 |
|---|---|---|---|---|
| PTT Atom | 200 | 273 | 10.9 | ✅ 20 則 entry（前有 Cloudflare，但放行） |
| PTT 索引 | 200 | 808 | 23.9 | ✅ |
| PTT 文章 | 200 | 266 | 5.8 | ✅ |
| OPENTIX 活動頁 | 200 | 720 | 430.7 | ✅ `__NUXT__`，2 個 event，`remainingQuantity:22` |
| 年代首頁 | 200 | 1203 | 86.9 | ✅（較慢） |
| 寬宏首頁 | 200 | 1455 | 70.3 | ✅（較慢） |
| ibon 首頁 | 200 | 660 | 5.1 | ✅ 只是 SPA 外殼 |
| 遠大首頁 | 200 | 97 | 6.3 | ✅ 只是 SPA 外殼 |
| KKTIX 活動列表 | 403 | 97 | 5.9 | ❌ Cloudflare challenge |
| 拓元活動列表 | 200 | 761 | 474.7 | ✅ |
| 拓元場次頁 `26_forever` | 200 | 456 | 55.6 | ✅ 但標記可能只是比對到「場次」字樣，內容待確認 |
| Dcard 看板 API | 403 | 140 | 5.1 | ❌ Cloudflare challenge |
| Dcard 搜尋 API | 403 | 93 | 5.1 | ❌ Cloudflare challenge |
| 旋轉拍賣搜尋 | 403 | 106 | 5.8 | ❌ Cloudflare「Just a moment...」 |
| Threads 搜尋 | 200 | 1004 | 592.9 | ❌ 內容由 JavaScript 載入，HTML 中沒有搜尋字詞 |

- **觀察到（內建瀏覽器，2026-11-12 22:16 UTC+8）：** OPENTIX 臺北場總剩 22 = 輪椅席 **11** ＋輪椅陪同席 11。約 22:00 時輪椅席為 10，這段期間增加 1 張；一般票區仍為 0。

### Derived

- **路線定案：**
  - 雲端（Apps Script）：PTT（feed、索引、文章）、OPENTIX、拓元（列表與場次頁，格式待確認）、年代、寬宏。
  - 本機（擴充功能）：KKTIX、Dcard、旋轉拍賣、Threads、FB、IG。
  - 待確認：ibon、遠大。首頁可以存取，但剩餘票資料來自另外的介面，需要針對活動頁再測。
- **拓元差異：** 拓元場次頁從 Google 主機回 200，但先前從使用者家用 IP、不帶 cookie 時回 401。原因不明（假設：依 IP 或請求特徵判斷）。正式版要先確認回應中真的有場次表。
- **Dcard：** 使用者已決定納入（見上一則），但從 Google 主機被擋，**改為本機監測**，第二階段實作。
- **退票會回到剩餘張數：** 這次增加的雖然是輪椅席，但證明有票釋出時 `remainingQuantity` 會即時反映，支持以此欄位監測官方釋出的作法。
- **預設頻率：** 每輪典型組合為 PTT feed（約 0.3 秒）＋OPENTIX（約 0.7 秒）＋拓元（約 0.5 秒）＋新文章內文（每篇約 0.3 秒）。用 `UrlFetchApp.fetchAll` 平行抓取約 1–1.5 秒，低於每 1 分鐘方案的 3.75 秒預算。Gemini 只在關鍵字命中時才呼叫，頻率很低。
  - **決定：** 預設每 1 分鐘，加上**配額保護**。程式自行累計當日執行時間，預估會超過 90 分鐘時，自動把各來源頻率放慢（例如改為 2 分鐘），並在儀表板顯示原因；使用者也可以設靜音時段。
  - 年代、寬宏單次約 1.2–1.5 秒，加入多個這類來源時，配額保護會更早介入。

### Limitations and unresolved issues

- 只執行一次，耗時會隨時段與網站負載變動。
- 尚不知道每次觸發本身的固定開銷算進多少執行時間，正式版的配額保護會實測累計。

### Next direction

- 開始第一階段實作（雲端部分）。

---

## 反爬蟲規則與 Dcard 納入 — 2026-11-12

### Question or objective

使用者把 `AGENTS.md` 第 7 節的「不規避反爬蟲」改為「可規避反爬蟲」，並在對話中表示「可規避，可代解驗證碼」。另外決定納入 Dcard。

### Evidence

- **使用者提供（S002）：** 「好那加進來」（Dcard）；「可規避，可代解驗證碼」。
- **觀察到：** 使用者修改後的 `AGENTS.md` 第 7 節標題為「可規避反爬蟲」，但內文仍禁止輪換代理 IP、偽造瀏覽器指紋、建立多個帳號；第 1 節的 Special constraints 仍寫「不規避反爬蟲機制」。

### Decision or conclusion

- **Dcard 票券板納入來源**（S020）。
- **Claude（本專案目前的 AI 協作者）不會實作**驗證碼破解或代解（含串接打碼服務），也不會實作規避反機器人偵測的機制。這是 AI 自身的使用限制，不是使用者的決定。
- **改用的實作方式：**
  - Cloudflare 等 JavaScript 檢查交給使用者自己的真實瀏覽器處理。擴充功能在使用者的分頁中正常瀏覽，瀏覽器會照常通過這類檢查，不需要額外規避。
  - 遇到需要人工操作的驗證碼時，擴充功能暫停該來源，並寄信或在瀏覽器提醒使用者手動完成；完成後自動恢復監測。儀表板將該來源標為「等待人工驗證」。
- `AGENTS.md` 中使用者的修改原樣保留，未改回；第 1 節與第 7 節的前後矛盾**待使用者決定**怎麼寫。

### Limitations and unresolved issues

- KKTIX、拓元若頻繁出現人工驗證碼，本機監測會中斷，直到使用者處理完。實際發生頻率要等第二階段實測才知道。

---

## Apps Script 配額查證與 Google 主機探測腳本 — 2026-11-12

### Question or objective

1. 查證 Apps Script 配額，作為預設監測頻率的依據。
2. 準備一個讓使用者在自己的 Apps Script 執行的探測工具，確認從 Google 主機能否存取各來源。

### Evidence

- **觀察到（S010）：** 個人帳號的觸發器總執行時間 90 分鐘／天、網址擷取 20,000 次／天、寄信收件人 100／天；Workspace 帳號分別為 6 小時、100,000 次、1,500 人。頁面標示最後更新 2026-04-23。
- **已驗證（A001）：** `tools/gas-probe/probe.gs` 在 JavaScriptCore 中配合模擬服務執行，判斷邏輯正確。

### Analysis, implementation, or method

- **頻率預算（推導）：**
  - 每 1 分鐘：1440 次／天 → 每輪平均 ≤ 3.75 秒，抓取 ≤ 約 13.9 次。
  - 每 2 分鐘：720 次／天 → 每輪平均 ≤ 7.5 秒，抓取 ≤ 約 27 次。
  - 寄信上限 100／天 → 需要設計通知合併（同一輪多個命中合成一封），並預留失敗警告的額度。
- **探測腳本設計：**
  - 逐一 `UrlFetchApp.fetch`（不用 `fetchAll`），以便量每個網址的耗時；請求間隔 0.5 秒，共 15 個請求。
  - 判斷依據：HTTP 狀態、預期標記、Cloudflare challenge 字樣。
  - 只輸出摘要 JSON，不含網頁原文。
  - 不自訂 User-Agent，符合「不偽造身分」的原則。
- **安全決策：** 解析 OPENTIX 的 `__NUXT__` 時**不執行**網站下載的 JavaScript（不用 `eval` 或 `new Function`）。正式版的 Apps Script 會持有 Gmail 讀取權限，執行第三方程式碼等於把信箱交給該網站。正式版將改寫成只解析資料、不執行程式碼的解析器（把 IIFE 的參數代號對回實際值）。

### Decision or conclusion

- 預設頻率等探測結果的 `ms` 出來後再定。
- 正式版禁止執行來源網站的程式碼（已加入 `AGENTS.md` 第 7 節）。

### Next direction

- 使用者執行 `probeSources()` 並回報 JSON。

---

## 資料來源實測與測試活動選定 — 2026-11-12

### Question or objective

1. 選一個網路上幾乎每天都有轉售文的活動作為測試案例。
2. 確認各來源的資料格式、是否要登入，以及是否有反爬蟲機制，據此決定走雲端（Apps Script）或本機（擴充功能）。

### Context and importance

使用者已同意以內建瀏覽器唯讀、少量開啟公開頁面（S002）。

### Analysis, implementation, or method

- **測試環境：** 2026-11-12 約 21:45–22:10（UTC+8），在使用者 Mac 上的 Claude 內建瀏覽器中執行。網路為使用者家中的台灣 IP，**不是** Google 主機。
- **「不帶 cookie」測試：** 在頁面中以 `fetch(url, {credentials:'omit'})` 發出請求，模擬沒有瀏覽器 cookie 的伺服器端請求。這只能粗略預估 Apps Script 的結果，因為 IP 與 TLS 指紋都不同。
- **PTT 抽樣：** 依「上頁」連結連續抓取看板索引 30 頁，每頁間隔 0.7 秒。統計 `[售票]`、`[換售]`、`[讓票]`、`[轉售]` 開頭標題中的詞，看每個詞在幾天內出現。
- **未測試：** 沒有登入任何網站，也沒有測試 Facebook、Instagram、X（都需登入）。拓元的 Cookie 同意視窗未操作。

### Evidence（全部為「觀察到」）

**PTT Drama-Ticket（S005、S006）**
- Atom feed `https://www.ptt.cc/atom/Drama-Ticket.xml`：HTTP 200，`application/xml`，20 則 entry，涵蓋 19:22–21:45 約 2.4 小時。每則的 `content` 只有內文前幾行（66–202 字），要拿到完整價格與座位資訊需再抓文章頁。文章頁 HTTP 200，常見格式為「節目／地點／時間／位置／原價／售價／張數／交易方式」，也有不照格式自由書寫的。
- 索引 30 頁共 597 篇，涵蓋 11/06–11/12（另有置底公告）；其中 413 篇為售票類。每日售票類篇數依序為 15（11/06 只抓到部分）、86、77、45、59、60、71。
- 每日都有售票文的活動：F.FOREVER《恆星之城》，標題含「恆星之城」者 7 天共 28 篇，每天 1–6 篇。其他高量活動：K-WONDER（51 篇，出現在 6 天）、AAA（23 篇，6 天）、Stray Kids（12 篇，6 天）。

**OPENTIX（S004）**
- 頁面由伺服器端渲染（Nuxt），HTML 約 441 KB，`window.__NUXT__` 內含：
  - `venue`（場館）；
  - `events[]`，每場有 `id`、`startDateTime`（Unix 秒）、`quantity.remainingQuantity`；
  - `groupSections`，每個票區有 `name`、`price`、`quantity.remainingQuantity`。
- 原始 HTML 中這段資料是壓縮過的 IIFE（數值以參數代號表示），解析時需執行該 IIFE，或把參數代號對回實際值。
- 回應標頭：`via: 1.1 google`、`x-powered-by: Express`、`cache-control: public,no-cache,max-age=0,max-stale=60`。沒有 Cloudflare；不帶 cookie 請求 HTTP 200 且含 `__NUXT__`。
- 觀察到的剩餘張數（約 22:00）：
  - 高雄場（event `2108011743574269953`，2027-01-02 19:30）：全部 0，票區為 2800、2200、1600、輪椅席、800。
  - 臺北場（event `2108014315323695105`，2027-01-03 19:30）：總剩 21，全部是**輪椅席 10＋輪椅陪同席 11**；3600、2800、2200、1600、1200、800、「青年席位300元（原價1800）」皆為 0。
- 頁面上的退票規定：最遲在演出日 10 日前（不含演出日）辦理，手續費 10%。

**官方平台首頁或活動頁（S015、S019）**

| 平台 | 測試網址 | 不帶 cookie | 備註 |
|---|---|---|---|
| KKTIX | `kktix.com/events` | **403**，Cloudflare challenge | 瀏覽器正常顯示 |
| 拓元 | `tixcraft.com/activity` | 200，Apache，無 Cloudflare | 列表中有 F.FOREVER（`26_forever`） |
| 拓元 | `tixcraft.com/activity/game/26_forever` | **401**（23 bytes） | 帶瀏覽器 cookie 時 200，但顯示「目前無場次資訊」；cookie 中有 `tmpt` |
| ibon | `ticket.ibon.com.tw/` | 200，Cloudflare，無 challenge | 5 KB 的 SPA 外殼，資料介面未測 |
| 年代 | `ticket.com.tw/` | 200，無 Cloudflare | 伺服器端渲染（ASP.NET），89 KB |
| 寬宏 | `kham.com.tw/` | 200，無 Cloudflare | 伺服器端渲染（ASP.NET），72 KB |
| 遠大 | `ticketplus.com.tw/` | 200（Amazon S3） | 6 KB 的 SPA 外殼，資料介面未測 |

**社群與拍賣（S018、S020、S021、S022）**
- **Dcard**：票券看板代號為 `tickets`。`/service/api/v2/forums/tickets/posts?limit=30` 不帶 cookie回 200 JSON，30 篇涵蓋約 20.6 小時；搜尋 API `/service/api/v2/search/posts?query=…` 也回 200 JSON。前面有 Cloudflare，但沒有被 challenge。看板頁標示「每天有 31 篇文章」，其中有 F.FOREVER 讓票文。
- **旋轉拍賣**：搜尋頁不帶 cookie 回 200（Cloudflare，無 challenge）。「恆星之城」只有 4 筆，刊登於 14–20 天前，量很少。
- **Threads**：未登入時，搜尋「恆星之城 售票」（最新）顯示「查無結果」；搜尋「恆星之城」多為不相關貼文，只有 1 則相關。

### Derived

- **測試活動：** F.FOREVER《恆星之城》每天都有售票文，有制式格式也有自由書寫，而且常見低於原價的降售，正好可測試價格規則與 AI 判讀。演出日 11/28–29 之前約有兩週的測試期。之後的備援：AAA（12/5–6）、Stray Kids（12/12）。
- **OPENTIX：** 可用每個票區的 `remainingQuantity` 監測官方釋出，只抓一頁就能拿到所有場次與票區，很適合 Apps Script。輪椅席與輪椅陪同席應預設不勾選，否則臺北場現在就會誤報。
- **Chloe Chua 的退票期限：** 依頁面規定推算，高雄場（1/2）最後退票日為 12/23，臺北場（1/3）為 12/24。官方退票釋出應集中在這之前；退回的票何時重新開賣尚不清楚。
- **路線初判：**
  - 雲端候選：PTT、OPENTIX、年代、寬宏、Dcard、旋轉拍賣。
  - 只能本機：KKTIX、拓元、Threads、FB、IG。
  - 待測：ibon、遠大。
- **重複貼文：** 同一位賣家會每天重貼同一張票。依文章 ID 去重仍會重複通知，可考慮加上「相同作者＋相似內容 N 小時內只通知一次」的選項（提議）。

### What it does not establish

- 這些測試都是從使用者的台灣家用 IP 發出，**不代表 Google Apps Script 從 Google 主機也能存取**。PTT 先前就曾對雲端環境回 403（S001）。
- 年代、寬宏、ibon、遠大都只測了首頁，活動頁的剩餘票資料格式還不知道。
- KKTIX、拓元在本機擴充功能中能否穩定讀取，也還沒測。

### Decision or conclusion

- 第一個測試活動：F.FOREVER《恆星之城》（2026-11-28、29，臺北大巨蛋，拓元售票）。
- OPENTIX 解析方式：讀 `__NUXT__` 中的 `events[].groupSections[].quantity.remainingQuantity`。

### Next direction

- 寫一個最小的 Apps Script 探測函式，從 Google 主機實際抓 PTT Atom、PTT 文章頁、OPENTIX 活動頁、Dcard API、旋轉拍賣、年代、寬宏，記錄 HTTP 狀態，由使用者執行並回報。

---

## 使用者確認設計決策 — 2026-11-12

### Question or objective

AI 提出 10 題設計問題，使用者逐題回覆，作為開始寫程式前的定案依據。

### Context and importance

使用者要求「若有任何問題或建議或懷疑都先問過我，我回答完後，再開始執行整個程式碼撰寫」（S002）。

### Analysis, implementation, or method

使用者回覆（使用者提供，S002）：

| 題目 | AI 建議 | 使用者決定 |
|---|---|---|
| 架構 | Sheet＋Apps Script＋選用擴充功能 | 可以 |
| AI | 使用者自備 Gemini 免費金鑰，Chrome 內建 AI 備援 | 可以 |
| 「連續兩次不通過才通知」的意義 | (a) 抓取失敗門檻；(b) 有票需連續偵測 | 選 (a) |
| FB／Threads／IG 自動瀏覽 | 提供，預設關閉 | **預設開啟**，告知風險 |
| 高於原價的票 | 保留，預設關閉，附法規提醒，上限 X% | 好 |
| 通知管道 | Email，Telegram 選用 | 只要 Gmail |
| 範本 Sheet | 使用者雲端硬碟放公開範本 | 可以 |
| 官方平台 | OPENTIX＋KKTIX、拓元、ibon、年代、寬宏、遠大 | 好 |
| 實測許可 | 內建瀏覽器唯讀少量開啟公開頁 | 可以 |
| 語言與授權 | 繁中先行、公開、MIT | 繁中＋英文、公開、MIT |
| 測試案例 | Chloe Chua 兩場 | 改選每天都有網路轉售票的活動，以便快速測試 |

同日稍晚的追加回覆（使用者提供，S002）：專案名稱定為 **Ticket hunter**；在專案資料夾建立獨立 git repo（已執行）；Gmail 通知信匯入放進第一階段；失敗門檻預設 2；監測頻率在查證配額後於 1 分鐘與 2 分鐘之間決定。

### Evidence

- **Source type:** 使用者在對話中的回覆（S002）。
- **What it supports:** 上表各項決策。
- **What it does not establish:** 分階段順序（第一階段雲端、第二階段擴充功能）在原提問第 8 題中，但使用者只回覆了官方平台的部分，因此順序仍**待確認**。

### Decision or conclusion

- 命中通知立即寄出；失敗警告依門檻 N（推導自選 (a)）。
- 社群自動瀏覽預設開啟，與 AI 原建議不同；以使用者決定為準，實作時須在啟用前清楚揭露風險。

### Limitations and unresolved issues

- 見 `STATE.md` 第 9 節（專案名稱、階段順序、Gmail 匯入、預設頻率、N 預設值、git 設定）。

### Next direction

- 選測試活動並實測資料來源（`STATE.md` 第 6 節 P0）。

---

## 架構、AI 與監測方式選型 — 2026-11-12

### Question or objective

使用者要求的工具需同時滿足：Windows 與 macOS 皆可用、上 GitHub、引導使用者用 Google Apps Script 全天監測、可調頻率與靜音時段與失敗通知門檻、使用 AI 但不需付費 API、設定流程是「在程式裡的瀏覽器找到購票頁 → AI 擷取 → 核取方塊選場次與票區 → 檢視與編輯關鍵字及規則」、盡量全面涵蓋轉售平台、盡量雲端執行、提供儀表板顯示雲端與本機監控狀態、盡量不外包給外部網站、不要被反爬蟲限制（S002）。

### Context and importance

先前的 PTT Python 原型需要常開的機器，且無法涵蓋官方平台與社群媒體（S001）。

### Starting hypothesis / proposal

AI 提議：Google Sheet 範本＋Apps Script 負責雲端監測與儀表板；Chrome／Edge 擴充功能負責設定精靈與需要登入的平台。

### Analysis, implementation, or method

**跨平台與安裝：** Apps Script 在 Google 雲端執行；擴充功能在 Windows 與 macOS 的 Chrome／Edge 上表現相同。兩者都不需安裝 Python 或桌面程式，也避開未簽章 App 的系統警告（推導）。

**一鍵安裝：** 範本 Sheet 用 `/copy` 連結讓使用者建立副本，綁定的程式會一起複製。Web App 部署無法隨副本複製，需使用者手動「部署 → 新增部署」，擴充功能才能連線（推導；需實作時驗證）。

**設定精靈：** 擴充功能讀取使用者瀏覽器中已渲染的頁面，可處理 JavaScript 動態載入的售票頁。不裝擴充功能時，備案是在 Sheet 側邊欄貼上網址與整頁文字，交給 AI 擷取。

**AI 選項比較（使用者要求免付費、不要太笨）：**

| 選項 | 判斷力 | 使用者負擔 | 結論 |
|---|---|---|---|
| Gemini API 免費金鑰 | 強，中文佳 | 在 AI Studio 產生金鑰 | 主力（使用者同意） |
| Chrome 內建 AI（Gemini Nano） | 偏弱 | 無金鑰，但有硬體需求 | 擴充功能的離線備援 |
| 本機 Ollama | 中到強 | 安裝、模型好幾 GB | 不採用：違背懶人原則 |
| 其他免費 API（GitHub Models、Groq、OpenRouter） | 不一 | 另需帳號 | 未採用：多一個帳號 |

**AI 可靠性設計：** 關鍵字初篩 → AI 輸出結構化 JSON（賣或徵、場次、票區、價格、張數、標記）→ 確定性規則引擎決定是否通知。AI 失敗時退回關鍵字通知並加註。使用者也可用自然語言描述規則，例如「青年票又視線遮蔽的不要通知」，由 AI 轉成結構化規則後交使用者確認。

**各平台可行性（皆為假設或待實測）：**

| 平台 | 規劃方式 | 預期位置 |
|---|---|---|
| PTT Drama-Ticket | Atom feed 或看板網頁 | 雲端；被擋則改本機 |
| OPENTIX 等官方平台 | 頁面背後的 JSON | 待實測；拓元預期只能本機 |
| Facebook 社團 | FB 原生「所有貼文」通知＋擴充功能自動瀏覽 | 本機 |
| Threads、IG、X | 擴充功能看搜尋頁 | 本機 |
| 旋轉拍賣、Dcard | 搜尋頁 | 待實測 |
| Google 快訊、平台通知信 | Apps Script 讀 Gmail 後由 AI 過濾 | 雲端（選用） |

**Apps Script 配額考量（待查證，S010）：** AI 記憶中，免費帳號的觸發器每日總執行時間約 90 分鐘。若每分鐘執行一次（每天 1440 次），每次須約 3–4 秒以內。因此規劃平行抓取（`UrlFetchApp.fetchAll`）、靜音時段，並在儀表板顯示用量。

### Evidence

- **Source type:** AI 分析與 AI 自身知識；**尚未對照官方文件**。
- **Reference:** S002；待查證來源 S010–S017。
- **What it supports:** 選型理由與取捨。
- **What it does not establish:** 任何配額數字、免費額度、平台可存取性。這些都需實測或查官方文件。

### Alternatives considered

- **獨立桌面程式**（Electron 或 Python＋Playwright）：可內建瀏覽器，但較重，且有系統簽章警告。
- **VPS、Oracle Always Free、Fly.io、Railway、Render**：先前對話提出，可 24 小時執行，但需要使用者註冊、維運，有些要付費（S001）。
- **純通知服務**（Telegram bot）：使用者決定只用 Gmail。

### Rejected or deferred approaches

- **GitHub Actions 排程** — 捨棄：最短約 5 分鐘一次且常延遲，不適合搶票（AI 知識，待查證；S001 已提及）。
- **Google 快訊作為主要來源** — 捨棄：延遲長，也收錄不到 FB、Threads（推導）。可作為選用的 Gmail 匯入來源。
- **IFTTT、Zapier、Distill、Visualping、RSSHub 公共實例** — 捨棄：要註冊、外包給第三方，或需付費才能高頻率。
- **LINE Notify** — 捨棄：AI 記憶中已於 2025 年停止服務（待查證，S014）。
- **以驗證碼破解、代理 IP、指紋偽造繞過反爬蟲** — 捨棄：違反平台條款，可能觸法，也違反專案規則（`AGENTS.md` 第 7 節）。
- **自動購票** — 捨棄：同上。工具定位為只通知。

### Decision or conclusion

採用 Sheet＋Apps Script＋Chrome／Edge 擴充功能，Gemini 免費金鑰為主力 AI，通知只用 Gmail（使用者已確認）。

### Limitations and unresolved issues

- 各平台實際可存取性、Gemini 與 Apps Script 的現行額度，都尚未驗證。

### Next direction

- 查官方文件（S010–S017），並實測各來源。

---

## 先前對話：PTT 監控 Python 原型與 OPENTIX 存取問題 — 日期待確認（早於 2026-11-12）

### Question or objective

使用者沒買到 Chloe Chua 的演奏會票（使用者提供：2027-01-02 高雄市音樂館、2027-01-03 國家音樂廳，皆 19:30），想要自動監測網路上不高於原價的轉售票並盡快收到通知。

### Context and importance

這是本專案的起點。此段內容**僅來自使用者在 2026-11-12 貼上的先前對話節錄**（S001），不是完整的原始對話紀錄。

### Analysis, implementation, or method

依節錄內容（使用者提供，未獨立驗證）：
- 先前的 Claude 雲端工作階段在 `/home/user/ticket-watch/` 寫了 `ptt_watch.py`、`.env.example`、`README.md`、`test_ptt_watch.py`。
- 功能：約每 60 秒抓 PTT Drama-Ticket 最新 2 頁，標題或內文含關鍵字就推播 Telegram，附連結與內文前 300 字；略過 `[徵…]`、`[求…]`、`[公告]`；不重複通知；只用 Python 標準函式庫；連續失敗 10 次推播警告，恢復時再通知。
- 預設關鍵字：`chloe chua`、`chloe`、`chua`。節錄中建議補上中文藝名。
- 兩場都在 OPENTIX 販售：`https://www.opentix.life/event/2108010089152028673`（使用者提供）。

### Evidence

- **Source type:** 使用者貼上的對話節錄（S001）。
- **What it supports:** 原型曾存在及其設計。
- **What it does not establish:** 原型能在真實 PTT 或 Telegram 上運作。節錄寫明「離線測試通過，但還沒連到真正的 PTT 和 Telegram 試過」；該雲端環境連 PTT 得到 403，連 www.opentix.life 也被網路政策擋住。原型檔案本身目前**缺失**（S003）。

### Decision or conclusion

新專案改以 Apps Script（JavaScript）重寫 PTT 監測邏輯，不沿用 Python 原型（見上一則）。過濾 `[徵]`、`[求]`、`[公告]` 與連續失敗警告的設計會沿用。

### Limitations and unresolved issues

- 先前對話的日期、完整內容與原型檔案都缺失。

### Next direction

- 若使用者能從先前的雲端工作階段匯出原型檔案，放入 `sources/code-or-examples/` 並更新 S003。

---

## Entry Template (copy for a new item)

```markdown
## `[TOPIC / MILESTONE]` — `[YYYY-MM-DD]`

### Question or objective
### Context and importance
### Starting hypothesis / proposal
### Analysis, implementation, or method
### Evidence
### Alternatives considered
### Rejected or deferred approaches
### Decision or conclusion
### Limitations and unresolved issues
### Next direction
```
