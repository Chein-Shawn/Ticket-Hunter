# Project State

> Read this first after `AGENTS.md`. Keep it current, compact, evidence-linked, and useful to a new contributor who has no access to prior chats.

## 1. Project Overview

- **Project:** Ticket hunter（使用者 2026-11-12 決定；本機資料夾為 `ticket monitor`）
- **Purpose:** 開源工具。監測官方售票平台的退票／釋出票，以及論壇、社群媒體上公開轉售的票；符合使用者設定（場次、票區、價格上限、排除規則）時，以 Email 通知使用者。
- **Motivation:** 使用者沒買到 Chloe Chua 2027 年 1 月在台兩場演奏會的票（使用者提供），希望在轉售訊息出現後盡快得知。之後擴大成給一般人用的通用工具。
- **Expected outputs:**
  1. 公開 GitHub repo（MIT 授權，README 繁中＋英文）。
  2. Google Sheet 範本＋Apps Script：雲端 24 小時監測、設定介面、Web App 儀表板。
  3. Chrome／Edge 擴充功能：設定精靈（在使用者瀏覽器中擷取活動頁資訊），以及需要登入的平台的本機監測。
- **Current phase:** 實作第一階段。雲端核心（第一階段前半，1a）已完成並通過離線測試，等使用者在真正的 Apps Script 部署實測。
- **Last known status:** 2026-11-12 完成第一階段前半（1a）：`apps-script/` 中的 Apps Script 可監測 PTT 與 OPENTIX，依規則過濾後以 Gmail 通知，並有失敗警告、靜音時段、配額保護與狀態分頁。離線測試 42 項全數通過；尚未在 Google 上實際執行。

## 2. Current System, Product, or Work Model

### Confirmed / in use

本專案尚無可執行的系統。以下是使用者在 2026-11-12 確認的設計決策（使用者提供；來源 S002）：

- **架構**：Google Sheet＋Apps Script（雲端）＋Chrome／Edge 擴充功能（本機）。
- **AI**：使用者自行申請 Google Gemini 免費 API 金鑰為主力，Chrome 內建 AI（Gemini Nano）為離線備援。
- **通知**：只用 Gmail（Apps Script 寄信），不做 Telegram。
- **失敗警告**：同一來源連續抓取失敗 N 次才寄警告信，N 可調，**預設 2**（使用者 2026-11-12 同意）。偵測到符合條件的票時立即通知，不等第二輪（推導：使用者選擇 (a) 而非 (b)）。
- **監測頻率預設值**：1 或 2 分鐘，查證 Apps Script 配額（S010）後再定（使用者同意此作法）。
- **Gmail 通知信匯入**：納入第一階段，做成選用功能，需額外授權 Gmail 讀取（使用者 2026-11-12 決定）。
- **版本控制**：專案資料夾為獨立 git repo，遠端 `origin` 為公開的 https://github.com/Chein-Shawn/Ticket-Hunter（2026-11-12 建立，MIT 授權，`LICENSE`）。
- **Facebook、Threads、IG**：擴充功能以使用者已登入的帳號、低頻率自動瀏覽，**預設開啟**，並在開啟前或初次設定時明確告知帳號風險。另外引導使用者開啟 FB 社團原生通知。
- **高於原價的票**：保留此選項，預設關閉；開啟時顯示台灣法規提醒，可設定「最多高出 X%」。
- **官方平台**：OPENTIX、KKTIX、拓元（tixCraft）、ibon、年代、寬宏、遠大（ticketplus）都要支援。實際可行程度待實測。
- **發布**：使用者願意在自己的 Google 雲端硬碟放公開範本 Sheet，README 提供「建立副本」連結。repo 公開，MIT 授權。
- **介面語言**：繁體中文＋英文。
- **實測許可**：可用內建瀏覽器唯讀、少量開啟 OPENTIX、PTT、Threads、旋轉拍賣等公開頁面以分析資料格式。Apps Script 需由使用者部署並回報結果。
- **測試案例**：做成通用工具。第一個測試活動**不用** Chloe Chua，改選網路上幾乎每天都有人轉售票的活動，以便快速驗證；Chloe Chua 兩場仍是實際使用目標。
  - 已選定（2026-11-12，依 PTT 7 天抽樣）：**F.FOREVER《恆星之城》**，2026-11-28、29 臺北大巨蛋，拓元售票。PTT 每天 1–6 篇售票文，Dcard 票券板也有。備援：AAA（12/5–6 高雄）、Stray Kids（12/12）。

### In progress

- **第一階段前半（1a），已完成程式、待實測**（`apps-script/`，安裝說明見 `apps-script/SETUP.md`）：
  - Google Sheet 工作表：狀態、監測目標、票區、規則、設定、記錄；選單操作（初始化、測試信、載入票區、開始／停止、立即檢查、重設）。
  - 每分鐘觸發器；各來源可設間隔；靜音時段；配額保護（依當日實際用量自動放慢，用完即暫停到午夜）。
  - PTT：Atom feed → 關鍵字初篩 → 抓命中文章全文 → 規則判斷（標題分類、已售、排除字、同時出現規則、日期、原價與售價）→ 同賣家重貼去重。
  - OPENTIX：安全解析 `__NUXT__`（不執行網站程式碼），勾選票區的剩餘張數「首次大於 0 或增加」就通知；輪椅席預設不勾；自動填入最高原價。
  - Gmail：同一輪的命中合併成一封；來源連續失敗 N 次寄警告，恢復時再通知。
- **第一階段後半（1b），未開始**：Gemini AI 判讀與自然語言規則、Gmail 通知信匯入、Web App 儀表板與設定精靈、拓元／年代／寬宏 adapter、ibon／遠大資料介面調查。

### Candidates / discussion only

- **分階段順序**（AI 提議；使用者已同意把 Gmail 匯入放進第一階段，但整體順序仍未明確回覆，**待確認**）：
  - 第一階段：Apps Script 雲端監測（PTT＋可從 Google 主機存取的官方平台與論壇＋選用的 Gmail 通知信匯入）、AI 判讀、規則引擎、Email 通知、Web App 儀表板、貼上頁面文字版的設定精靈。
  - 第二階段：擴充功能（設定精靈、FB／Threads／IG／KKTIX／拓元監測、回報心跳到儀表板）。
- **Dcard 票券板**（S020）：**已決定納入**（使用者 2026-11-12）。從 Google 主機回 403，改為本機監測（第二階段）。
- **旋轉拍賣**（S021）：量很少，且從 Google 主機回 403，列為本機低頻來源（第二階段）。
- **X**：未測。
- **來源路線（2026-11-12 依 Google 主機探測定案；見 `RESEARCH_LOG.md` 同日條目）：**
  - 雲端（第一階段）：PTT、OPENTIX、拓元（場次頁內容待確認）、年代、寬宏、Gmail 通知信匯入。
  - 本機（第二階段）：KKTIX、Dcard、旋轉拍賣、Threads、FB、IG。
  - 待確認：ibon、遠大（首頁可存取，剩餘票資料介面未測）。
- **預設監測頻率：** 每 1 分鐘，加上配額保護（預估當日執行時間會超過上限時自動放慢，並在儀表板顯示）。依據：探測結果中典型組合的平行抓取約 1–1.5 秒，低於 3.75 秒預算（推導）。

### Architecture or workflow

```
[使用者瀏覽器 + 擴充功能]
  設定精靈：開活動頁 → 「選定此活動」→ AI 擷取場次、票區、票價
         → 核取方塊選場次／票區、是否接受高於原價 → 檢視並編輯關鍵字與排除規則
         → 透過 Apps Script Web App（附權杖）寫入使用者的 Sheet
  本機監測：FB 社團、Threads、IG（登入後才看得到）→ 命中與心跳回報 Web App

[Google Sheet + Apps Script（使用者自己的副本）]
  每分鐘觸發 → 依各來源頻率與靜音時段決定是否執行
  → 抓取公開來源（PTT、官方平台 JSON）→ 關鍵字初篩 → Gemini 判讀（結構化 JSON）
  → 規則引擎（場次、票區、價格 ≤ 原價或 ≤ 原價×(1+X%)、排除組合如「青年＋視線遮蔽」）
  → Gmail 通知；連續失敗 N 次寄警告，恢復時通知
  → Web App 儀表板：雲端與本機各監控的最後檢查時間、結果、連續失敗次數、今日配額用量
```

### Known limitations

- 需要登入才看得到的平台（FB、Threads、IG）無法在雲端監測；電腦和瀏覽器沒開就會停（推導）。
- Apps Script 對免費帳號有每日觸發器執行總時數上限，每分鐘一次時每輪必須很短（待查證，S010）。
- 從 Google 主機發出的請求可能被部分網站封鎖或被 Cloudflare 擋下（假設，需實測）。
- 先前在 Claude 雲端環境中，PTT 回 403、www.opentix.life 被網路政策擋住（使用者提供，引述先前對話 S001）。這只代表該環境，不代表 Apps Script 或使用者電腦也會被擋。

## 3. Requirements and Constraints

| Requirement / constraint | Value or description | Scope | Status | Source / evidence |
|---|---|---|---|---|
| 作業系統 | Windows、macOS 皆可使用，不需安裝 Python 或桌面程式 | 全專案 | 使用者提供 | S002 |
| 費用 | 不要求付費 API 或付費服務 | 全專案 | 使用者提供 | S002 |
| 個資與手續 | 盡量少：Google 帳號、一把 Gemini 免費金鑰、選用的瀏覽器擴充功能 | 全專案 | 使用者提供（原則）；具體清單為推導 | S002 |
| 執行位置 | 盡量在雲端；盡量不外包給第三方網站 | 監測 | 使用者提供 | S002 |
| 監測頻率 | 使用者可調；Apps Script 最短每 1 分鐘 | 雲端監測 | 使用者提供（可調）；1 分鐘下限待查證 | S002、S010 |
| 靜音時段 | 使用者可設定不監測的時段 | 雲端與本機監測 | 使用者提供 | S002 |
| 失敗警告門檻 | 連續失敗 N 次才通知，N 可調，預設 2 | 各來源 | 使用者提供 | S002 |
| 命中通知 | 立即通知 | 各來源 | 推導（使用者選 (a)） | S002 |
| 場次與票區選擇 | 以核取方塊選擇，不要手動輸入 | 設定精靈 | 使用者提供 | S002 |
| 關鍵字與規則 | 使用者可增刪關鍵字、設定排除組合（例：青年＋視線遮蔽不通知） | 規則引擎 | 使用者提供 | S002 |
| 價格 | 預設只通知 ≤ 原價；可選擇接受高於原價（預設關，附法規提醒，上限 X%） | 規則引擎 | 使用者提供 | S002 |
| 通知管道 | 只用 Gmail | 通知 | 使用者提供 | S002 |
| 社群自動瀏覽 | 預設開啟，並告知風險 | 擴充功能 | 使用者提供 | S002 |
| 介面語言 | 繁中＋英文 | 全專案 | 使用者提供 | S002 |
| 授權 | 公開 repo，MIT | repo | 使用者提供 | S002 |
| 法規 | 只通知、不代購；台灣文創法對高於票面價轉售、以不正方法購票的規定 | 全專案 | 法條內容待查證 | S013 |
| 反爬蟲 | 使用者希望「可規避、可代解驗證碼」（2026-11-12）。**Claude 不實作**驗證碼破解或代解、反機器人偵測規避；實作採用：在使用者自己的瀏覽器中正常瀏覽，遇到驗證碼即通知使用者手動處理 | 全專案 | 使用者意向與 AI 實作範圍不一致，見 `RESEARCH_LOG.md` 同日條目 | S002 |

## 4. Verified Results

| Result | Evidence and method | Conditions / version | Limitations |
|---|---|---|---|
| 專案資料夾內容 | 觀察到：2026-11-12 執行 `ls -laR`，只有 `AGENTS.md`、`STATE.md`、`RESEARCH_LOG.md`、`sources/INDEX.md`（原為空白範本）與 `.DS_Store` | 本機 | 沒有任何程式碼或原始資料 |
| 專案資料夾有獨立 git repo | 觀察到：`git init -b main` 之後，`git rev-parse --show-toplevel` 指向本資料夾；已加入 `.gitignore`（`.DS_Store`、`.env`、`.clasp.json`、`node_modules/`） | 2026-11-12 | 尚無 commit；家目錄本身仍是另一個 git repo（使用者的事，非本專案範圍） |
| PTT Atom feed 存在且可用 | 觀察到：HTTP 200，`application/xml`，20 則 entry；`content` 只有內文前幾行（S006） | 2026-11-12，使用者家用 IP，內建瀏覽器 | 未從 Google 主機測試；完整內文需另抓文章頁 |
| OPENTIX 剩餘張數可由單頁 HTML 取得 | 觀察到：`window.__NUXT__` 中每場、每票區都有 `remainingQuantity`；不帶 cookie 回 200，無 Cloudflare（S004） | 同上 | 未從 Google 主機測試；原始 HTML 中是壓縮的 IIFE，需要解析策略 |
| Chloe Chua 兩場目前狀態 | 觀察到：高雄場全區 0；臺北場剩 21 全是輪椅席 10＋輪椅陪同席 11，一般票區 0（S004） | 2026-11-12 約 22:00（UTC+8） | 只是單一時間點 |
| 測試活動的每日轉售量 | 觀察到：PTT 索引 30 頁、7 天中，「恆星之城」標題 28 篇，每天 1–6 篇（S005） | 2026-11-06 至 11-12 | 只看標題，不含 FB、Threads |

| Apps Script 配額（個人 Gmail 帳號） | 觀察到：官方配額頁（S010，頁面標示最後更新 2026-04-23 UTC），2026-11-12 開啟 | 個人帳號／Workspace | 觸發器總執行時間 90 分鐘／天（Workspace 6 小時）；網址擷取 20,000 次／天（Workspace 100,000）；寄信收件人 100／天（Workspace 1,500）；觸發器 20 個／使用者／腳本；單次回應上限 50 MB |
| 探測腳本的判斷邏輯 | 已驗證：以 macOS JavaScriptCore（`osascript -l JavaScript`）載入 `tools/gas-probe/probe.gs`，搭配模擬的 `UrlFetchApp`、`Utilities` 執行 `probeSources()`；成功、Cloudflare challenge、401、Atom 計數、OPENTIX 摘要、Dcard JSON 解析的判斷皆正確，輸出不含網頁原文 | 2026-11-12，模擬回應 | 尚未在真正的 Apps Script 執行；網站的實際回應要等使用者執行 |

| 第一階段 1a 程式的離線行為 | 已驗證：`apps-script/tests/run-tests.sh`（macOS JavaScriptCore）42 項通過，包括：真實 PTT Atom 與 OPENTIX 樣本解析、價格／日期／規則判斷、配額保護、失敗警告；以及用假 Google 服務跑完整流程（初始化 → 載入 14 個票區、3 個輪椅區預設不勾 → PTT 命中寄信 → 不重複通知 → 張數增加才通知 → 連續 2 次失敗警告與恢復 → 靜音時段不抓取 → 用量記錄與大 JSON 切塊） | 2026-11-12，假服務 | 未在真正的 Apps Script 執行；工作表操作、觸發器時間與每次觸發的固定開銷（目前估 250 ms）都未實測 |
| 打包檔語法 | 已驗證：`apps-script/build.sh` 產生 `dist/TicketHunter.gs`（74,888 bytes），以 JavaScriptCore 載入無語法錯誤 | 2026-11-12 | 同上 |

**推導（頻率預算）：** 個人帳號、全天每 1 分鐘執行時，1440 次／天 → 每輪平均須 ≤ 3.75 秒、≤ 約 13 次抓取。每 2 分鐘時為 720 次 → ≤ 7.5 秒、≤ 約 27 次抓取。設靜音時段可等比例放寬。預設值等探測結果的各網址耗時（`ms`）出來後再定。

## 5. Current Hypotheses and Risks

- **已解決（2026-11-12，探測 A001）：** 從 Google 主機可存取 PTT、OPENTIX、拓元、年代、寬宏、ibon 與遠大首頁；KKTIX、Dcard、旋轉拍賣被 Cloudflare 擋（403）；Threads 內容由 JavaScript 載入，抓不到。
- **已解決（2026-11-12）：** PTT Atom feed 確實存在。OPENTIX 並非靠另外的 JSON 請求載入，而是伺服器端渲染，資料嵌在 HTML 的 `__NUXT__` 中。
- **部分支持：** OPENTIX 釋出的票會反映在 `remainingQuantity`。觀察到臺北場輪椅席在約 22:00 到 22:16 之間由 10 增為 11（S004）。一般票區的釋出尚未觀察到；Chloe Chua 兩場的退票期限推算為高雄 12/23、臺北 12/24，在此之前機會最高（假設）。
- **假設：** Gemini 免費額度足夠，因為只有關鍵字命中的文章才送 AI。驗證方式：查官方額度（S011），並在測試期間記錄每日呼叫次數。
- **風險：** Apps Script 每日觸發器時數上限。緩解：平行抓取、靜音時段、儀表板顯示用量；預設頻率（1 或 2 分鐘）待確認。
- **風險：** 多個使用者都從 Google 主機抓 PTT，可能讓 PTT 封鎖 Google IP。緩解：用輕量 feed、加隨機間隔；被擋時改走本機。
- **風險：** FB／IG／Threads 自動瀏覽可能觸發帳號驗證或限制；使用者已接受預設開啟並告知風險。
- **風險：** 拓元等平台防護嚴格，雲端大概無法存取（假設）。
- **風險：** 轉售詐騙常見。通知信應附防詐提醒（AI 提議，尚未定案）。
- **風險：** 免費 Gmail 帳號有每日寄信上限（待查證，S010）。

## 6. Current Tasks

- [x] **決定 git／repo 設定。** 證據：使用者同意（2026-11-12）；本資料夾已 `git init`，`git rev-parse --show-toplevel` 指向本資料夾。
- [ ] **P0 — 使用者實測第一階段 1a。** 依 `apps-script/SETUP.md` 安裝，啟用「F.FOREVER 恆星之城」與「蔡珂宜 Chloe Chua」範例列，執行測試信、載入票區、開始監測。完成條件：收到測試信；「狀態」分頁顯示 PTT 與 OPENTIX 正常；數小時內收到至少一封恆星之城的通知信，或在「記錄」分頁看到命中與略過紀錄；回報「今日執行時間」以校正配額估計。
- [ ] **P1 — 第一階段 1b。** 依序完成：Gemini 判讀（結構化 JSON，額度用完退回規則）、Gmail 通知信匯入、Web App 儀表板與設定精靈、拓元／年代／寬宏 adapter。完成條件：各項有離線測試，並經使用者實測。
- [x] **從 Google 主機實測各來源。** 證據：使用者執行 `tools/gas-probe/probe.gs` 的報告（2026-11-12T14:15:38Z），記錄於 `RESEARCH_LOG.md` 同日條目。
- [ ] **P1 — 補測年代、寬宏、ibon、遠大的活動頁格式。** 完成條件：各找一個販售中的活動，記下剩餘票資料的位置與格式（S015）。
- [x] **選定快速測試用的活動。** 證據：F.FOREVER《恆星之城》，PTT 7 天 28 篇、每天都有；見 `RESEARCH_LOG.md` 2026-11-12 實測條目。
- [x] **以內建瀏覽器實測各來源格式（第一輪）。** 證據：`RESEARCH_LOG.md` 2026-11-12 實測條目；S004–S006、S015、S019–S022。FB、IG、X 未測（需登入）。
- [ ] **P0 — 查證平台規格與法規。** 範圍：Apps Script 配額、Gemini 免費額度與資料使用條款、Chrome 內建 AI 的需求與擴充功能可用性、文創法相關條文、Manifest V3 限制。完成條件：每項在 `sources/INDEX.md` 有官方網址、查閱日期與重點，並同步更新本檔第 3、5 節。
- [ ] **P1 — 第一階段整體驗收。** 完成條件：使用者在自己的 Apps Script 觀察到 (1) 收到測試信；(2) 測試活動的新售票文在 2 個檢查週期內觸發通知；(3) 連續失敗 N 次寄警告、恢復時通知；(4) 靜音時段不執行；(5) 狀態分頁顯示各來源與今日用量。離線測試部分已完成（見第 4 節）。
- [ ] **P1 — 第二階段實作（擴充功能）。** 完成條件：在 Windows 和 macOS 的 Chrome 或 Edge 以未封裝方式載入；設定精靈能在測試活動頁擷取場次與票區並寫回 Sheet；本機監測命中後寄出通知；儀表板顯示本機監控在線或離線。
- [ ] **P2 — README（繁中＋英文）、範本 Sheet 發布說明、授權截圖教學。** 完成條件：新使用者照 README 從零完成設定（由使用者實際走一次確認）。
- [ ] **P2 — 設定 Chloe Chua 兩場的實際監測。** 完成條件：兩場設定寫入使用者的 Sheet，儀表板顯示運作中。

## 7. Immediate Next Step

**使用者動作：** 依 `apps-script/SETUP.md` 把 `apps-script/dist/TicketHunter.gs`（與 `dist/appsscript.json`）裝進一份新的 Google 試算表，勾選兩個範例目標，執行「② 寄測試信」「③ 載入官方票區」「▶ 開始監測」。幾小時後回報「狀態」分頁的內容、「記錄」分頁的通知與略過紀錄，以及有沒有收到通知信。

**AI 收到後：** 修正實測發現的問題，校正配額估計（每次觸發的固定開銷），再開始第一階段 1b（先做 Gemini 判讀）。

## 8. Important Files

| Relative path | What it contains | Current version / status |
|---|---|---|
| `AGENTS.md` | 給 AI 與協作者的穩定工作規則與專案特定規則 | 2026-11-12 填入專案內容 |
| `STATE.md` | 本檔：現況、需求、待辦、下一步 | 2026-11-12 |
| `RESEARCH_LOG.md` | 設計討論、決策、捨棄方案 | 2026-11-12 |
| `sources/INDEX.md` | 來源與待查證資料索引 | 2026-11-12 |

| `apps-script/src/*.gs` | 第一階段 Apps Script 原始碼（00 工具、01 語言、02 設定、03 排程／配額／健康、10 PTT、11 NUXT 解析、12 OPENTIX、20 比對規則、30 Email、40 狀態儲存、41 工作表、50 主流程與選單） | 2026-11-12，v0.1.0 |
| `apps-script/tests/` | 離線測試：`run-tests.sh`、`harness.js`、`*.test.js`、`fixtures/`（去識別化的 PTT Atom 與 OPENTIX 樣本） | 2026-11-12，42 項通過 |
| `apps-script/build.sh`、`apps-script/dist/` | 打包成單一檔案 `TicketHunter.gs` 與 `appsscript.json`，供使用者貼上 | 2026-11-12 |
| `apps-script/SETUP.md` | 安裝與使用說明（繁中＋英文） | 2026-11-12 |
| `apps-script/appsscript.json` | 時區 Asia/Taipei、V8、最小權限 | 2026-11-12 |
| `tools/gas-probe/probe.gs` | 一次性的 Apps Script 來源探測工具：`probeSources()` 對 15 個網址發出 GET，輸出 JSON 報告 | 2026-11-12，模擬測試通過；未在 Apps Script 實跑 |
| `.gitignore` | 排除 `.DS_Store`、`.env`、`.clasp.json`、`node_modules/` | 2026-11-12 |



## 9. Open Questions

1. 分階段順序（第一階段雲端，第二階段擴充功能）是否同意？這決定先交付什麼。
2. 先前的 PTT Python 原型（S003）若能取得，要保留為選用的本機執行器嗎？目前規劃是不保留，以 Apps Script 重寫。

已解決（2026-11-12）：GitHub repo 已建立為公開的 https://github.com/Chein-Shawn/Ticket-Hunter（MIT）；專案名稱定為 Ticket hunter；Gmail 匯入放進第一階段；失敗門檻預設 2；已建立獨立 git repo；預設頻率每 1 分鐘加配額保護；各來源雲端或本機路線已定案。

## 10. Last Updated

2026-11-12（UTC+8）— 由空白範本建立：寫入使用者確認的設計決策、需求、風險、待辦與下一步（S001、S002）。同日晚間以內建瀏覽器完成第一輪來源實測，選定測試活動，新增 S019–S022。之後查證 Apps Script 配額（S010），並新增探測腳本 `tools/gas-probe/probe.gs`。其餘官方文件（S011–S017）仍未查證。晚間收到使用者執行探測的結果，定案各來源的雲端或本機路線，預設頻率定為每 1 分鐘加配額保護；Dcard 改為本機。深夜完成第一階段 1a 程式與離線測試（42 項通過）。
