# Ticket hunter — 雲端監測安裝（第一階段）／ Cloud monitor setup (phase 1)

> 第一階段目前支援：**PTT Drama-Ticket 板**、**OPENTIX 官方釋出**，以 Gmail 通知。
> AI 判讀、Gmail 通知信匯入、網頁儀表板、拓元／年代／寬宏仍在開發中。
>
> Phase 1 currently covers **PTT Drama-Ticket** and **OPENTIX official releases**, notifying by Gmail.
> AI reading, Gmail ingest, the web dashboard and tixCraft / ERA / KHAM are still in progress.

---

## 中文

### 安裝（約 5 分鐘）

1. 開一個新的 Google 試算表：<https://sheets.new>
2. 上方選單「擴充功能 → Apps Script」。
3. 刪掉編輯器裡 `程式碼.gs`（或 `Code.gs`）的內容，貼上 [`dist/TicketHunter.gs`](dist/TicketHunter.gs) 全文，按儲存（💾）。
4. （建議）左側「專案設定 ⚙️」→ 勾選「在編輯器中顯示『appsscript.json』資訊清單檔案」，回到編輯器打開 `appsscript.json`，換成 [`dist/appsscript.json`](dist/appsscript.json) 的內容後儲存。這會把時區設為臺北，並只要求必要的權限。
5. 回到試算表，**重新整理頁面**，上方會出現「🎫 Ticket hunter」選單。
6. 選單「① 初始化工作表」。第一次會要求授權：
   - 看到「Google 尚未驗證這個應用程式」是正常的（這是你自己的腳本）。按「進階」→「前往（不安全）」→「允許」。
   - 需要的權限：讀寫這份試算表、連線到外部網站、以你的名義寄信、管理這個腳本的觸發器、知道你的 Email（用來寄給你自己）。
7. 選單「② 寄測試信」，確認收得到。建議在手機 Gmail App 開啟通知。

### 設定要監測的活動

- **監測目標 Targets**：每列一個活動。
  - 啟用：打勾才會監測。
  - 關鍵字：逗號分隔。比對時不分大小寫、全形半形，也忽略符號，所以 `F.FOREVER` 也會命中「F✦FOREVER」「F FOREVER」。
  - 排除字：出現任一個就不通知。
  - 場次日期：例如 `11/28, 11/29`。文章若只寫了其他日期就略過；沒寫日期的文章仍會通知。
  - 官方網址：目前支援 OPENTIX 活動頁（`https://www.opentix.life/event/…`）。
  - 最高原價：載入票區時會自動填入；文章沒寫原價時，用它判斷是否高於原價。
- **票區 Zones**：選單「③ 載入官方票區」後，會列出每個場次的每個票區，用核取方塊勾選要監測的票區。輪椅席、輪椅陪同席預設不勾選。某個已勾選的票區出現剩餘張數，或張數比上次多，就會通知。
- **規則 Rules**：「同時出現就不通知」。例如 `青年, 視線遮蔽` 表示兩個詞都出現時才略過。
- **設定 Settings**：檢查頻率、靜音時段（例如 `01:00-07:00`）、失敗幾次才寄警告、每日執行時間上限、是否接受高於原價（以及最多高出幾 %）等。

範例列預設**不啟用**。想用「F.FOREVER 恆星之城」測試，把那一列的「啟用」打勾即可。PTT 上幾乎每天都有這個活動的售票文。

### 開始與停止

- 「▶ 開始監測」：建立每分鐘一次的觸發器。之後關掉電腦也會繼續跑。
- 「■ 停止監測」：移除觸發器。
- 「↻ 立即檢查一次」：不等排程，馬上檢查（無視靜音時段）。
- **狀態 Status** 分頁會顯示：是否監測中、目前的有效間隔、今日已用的執行時間、剩餘寄信額度，以及每個來源（雲端／本機）的最後檢查時間與失敗次數。
- **記錄 Log** 分頁會列出每一筆通知與略過的原因（例如「高於原價」「日期不符」）。

### 配額

免費 Gmail 帳號的觸發器每天總共只能執行 90 分鐘，每天最多寄信給 100 位收件人。程式會自行累計當天用掉的時間，快超過「每日執行時間上限」（預設 80 分鐘）時會自動放慢檢查頻率，並在「狀態」分頁顯示原因。設定靜音時段也能省下配額。

### 限制

- 第一次啟動時，只會判斷最近 60 分鐘內的 PTT 文章。
- 目前還沒有 AI 判讀，價格與日期靠文字規則。看不出價格時，預設仍會通知並加註「價格未判讀」。
- 本工具只負責通知，不會幫你購票或聯絡賣家。轉售詐騙常見，請勿先匯款給不認識的賣家。

---

## English

### Install (about 5 minutes)

1. Create a new Google Sheet: <https://sheets.new>
2. Menu **Extensions → Apps Script**.
3. Replace the content of `Code.gs` with all of [`dist/TicketHunter.gs`](dist/TicketHunter.gs) and save.
4. (Recommended) **Project Settings ⚙️** → tick *Show "appsscript.json" manifest file in editor*, then replace `appsscript.json` with [`dist/appsscript.json`](dist/appsscript.json). This sets the Taipei time zone and requests only the needed permissions.
5. Reload the sheet. A **🎫 Ticket hunter** menu appears.
6. Run **① Set up sheets** and authorize. "Google hasn't verified this app" is expected for your own script: **Advanced → Go to (unsafe) → Allow**.
7. Run **② Send test email** and turn on Gmail notifications on your phone.

### Configure

- **監測目標 Targets**: one row per event. Keywords are comma-separated and matched ignoring case, full/half width and symbols. Excluded words skip a post. Dates (`11/28, 11/29`) skip posts that only mention other dates. The official URL currently supports OPENTIX event pages.
- **票區 Zones**: after **③ Load official zones**, tick the zones to watch. Wheelchair zones start unticked. You are notified when a ticked zone has tickets, or more than at the last check.
- **規則 Rules**: skip a post when *all* listed words appear (e.g. `青年, 視線遮蔽`).
- **設定 Settings**: interval, quiet hours, failure-alert threshold, daily runtime budget, above-face-value policy, and more.

Example rows start **disabled**. To try it, tick *Enabled* on "F.FOREVER 恆星之城"; PTT has posts for it almost every day.

### Run

**▶ Start monitoring** installs a one-minute trigger, and it keeps running with your computer off. **■ Stop** removes it, and **↻ Check now** runs immediately. The **狀態 Status** tab shows each source, its last check and failures, plus today's runtime and email quota. The **記錄 Log** tab records every notification and every skip, with the reason.

### Quota and limits

Free Gmail accounts get 90 trigger-minutes and 100 email recipients per day. The script tracks its own runtime and slows down automatically before the daily budget (default 80 min) is used up. Price and date reading is rule-based until AI arrives; when the price can't be read, you are still notified, with a note. The tool only notifies you; it never buys tickets or contacts sellers.
