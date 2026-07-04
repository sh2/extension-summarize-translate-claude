# Claude 版リファクタリング実装計画

本ドキュメントは `extension-summarize-translate-claude`（Claude 版）に対し、
`extension-summarize-translate-gemini`（Gemini 版）で進んだ **コード整理・構造化** を取り込み、
Claude 版の保守性を引き上げるための実装計画です。

前提:

- **ユーザー向け機能は追加しない**（Claude 版はメンテナンス専用）
- **挙動を変えない** リファクタリングのみ
- 既に `AGENTS.md` に整備した **Source file organization** と **Logging policy** を実コードへ反映する
- OpenAI 互換 / fallback / コンテキストメニュー強化 / 画像添付 / cloud sync など
  Gemini 版固有の機能層は持ち込まない

参考リポジトリ:

- Claude 版: `/home/taira/nfs/git/extension-summarize-translate-claude`
- Gemini 版: `/home/taira/nfs/git/extension-summarize-translate-gemini`

---

## 1. 目的とスコープ

### 目的

1. **ファイル構造の統一**: `AGENTS.md` の Source file organization に従い、
   各 JS ファイルを `Pure utilities` → `UI helpers` → `Button action handlers` →
   `Core async logic` → `Event listeners` の順に整理する。
2. **`utils.js` の責務分離**: `UI utilities` / `API utilities` / `File utilities` の
   章名を `AGENTS.md` の図語彙（`UI helpers` / `Claude API helpers`）へ寄せ、
   ファイル内の責務を明確にする。
3. **ログレベルの整備**: `AGENTS.md` の Logging policy に従い、
   `console.error` / `console.log` / `console.warn` / `console.debug` の使い分けを実コードへ反映する。
4. **UI 状態管理の小関数化**: `popup.js` / `results.js` の UI 状態操作を
   Gemini 版相当の小関数へ切り出し、変更点を局所化する。
5. **`options.js` のフォーム処理整理**: `INITIAL_OPTIONS` / `getOptionsFromForm` /
   `setOptionsToForm` の構造を Gemini 版へ寄せ、将来の項目追加に備える。

### スコープ外（持ち込まない）

- provider-agnostic な `parts` 会話形式（Anthropic 形式 `{ role, content }` を維持）
- OpenAI 互換 / Base URL / `optional_host_permissions`
- モデル自動フォールバック / retry 状態管理
- コンテキストメニュー + カスタムアクション 6 種
- フォローアップ時の画像添付
- オプション import/export / cloud sync
- `renderLinks` / `autoSave` / `openResultsInTab`
- ユーザー指定モデル ID / reasoning 設定

### 変更対象ファイル

- `extension/options.js`
- `extension/popup.js`
- `extension/results.js`
- `extension/service-worker.js`
- `extension/utils.js`

### 変更しないファイル

- `extension/lib/**`（編集禁止）
- `extension/manifest.json` / `firefox/manifest.json`（機能追加なし）
- `extension/*.html`（UI 変更なし）
- `extension/templates.html`（モデル一覧変更なし）
- `extension/_locales/**`（メッセージ変更なし）

---

## 2. 実装フェーズ

リスクが低く効果が高い順に実施する。各フェーズは独立して lint を通せる状態で完了させること。

### フェーズ 0: 準備・確認

- [ ] 作業ブランチを分ける（例: `refactor/structure-sync`）
- [ ] 現状の `npm run lint` が通ることを確認
- [ ] 手動で基本動作（要約 / 翻訳 / フォローアップ / オプション保存）を1回ずつ確認し、
      以降の各フェーズ終了時に同じ動作であることを担保する

### フェーズ 1: `utils.js` の章名・責務整理

**目標**: `AGENTS.md` の図語彙へ寄せる。**関数の中身は変えない**。

現状:

```text
// ── UI utilities ────────────────────────────────────────────────────────────
// ── API utilities ───────────────────────────────────────────────────────────
// ── File utilities ──────────────────────────────────────────────────────────
```

整理後:

```text
// ── UI helpers ──────────────────────────────────────────────────────────────
// ── Claude API helpers ──────────────────────────────────────────────────────
```

作業内容:

- [ ] `UI utilities` → `UI helpers` に改名
  - 対象: `applyTheme`, `applyFontSize`, `loadTemplate`, `displayLoadingMessage`,
    `convertMarkdownToHtml`
- [ ] `API utilities` → `Claude API helpers` に改名
  - 対象: `getModelId`, `generateContent`, `streamGenerateContent`, `getResponseContent`
  - 内部 helper（`tryParseJson` など）は exported API の直前に置く
- [ ] `File utilities` セクションは `UI helpers` の末尾へ統合
  - 対象: `exportTextToFile`
  - 理由: DOM 操作（`document.createElement("a")`）を含むため `Pure utilities` には置けず、
    Claude 版では独立した `Extension helpers` 層を設けないため
- [ ] ファイル先頭の `tryParseJson` は `Claude API helpers` セクションの先頭へ移動
  - 理由: `Pure utilities` 相当だが API 解析専用であり、API セクションの内部 helper として
    配置する方が依存方向が明確になる

完了条件:

- [ ] `npm run lint` が通る
- [ ] セクションコメントが `UI helpers` / `Claude API helpers` の2つのみ
- [ ] 関数の実装内容が変更されていない（diff でコメント行のみ移動）

### フェーズ 2: `options.js` の構造化

**目標**: `AGENTS.md` の章立てへ寄せる。**挙動は変えない**。

現状: セクションコメントなし、関数がほぼ時系列に並んでいる。

整理後の構成:

```text
import { ... } from "./utils.js";

// ── Pure utilities (no DOM access, no side effects) ────────────────────────

const INITIAL_OPTIONS = { ... };

// ── UI helpers ──────────────────────────────────────────────────────────────

const showStatusMessage = (message, duration) => { ... };
const getOptionsFromForm = (includeApiKey) => { ... };
const setOptionsToForm = async () => { ... };

// ── Button action handlers ──────────────────────────────────────────────────

const handleSaveClick = async () => { ... };

// ── Core async logic ────────────────────────────────────────────────────────

const saveOptions = async () => { ... };
const initialize = async () => { ... };

// ── Event listeners ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", initialize);
document.getElementById("save").addEventListener("click", handleSaveClick);
```

作業内容:

- [ ] `INITIAL_OPTIONS` を `Pure utilities` セクションへ配置
- [ ] `showStatusMessage`, `getOptionsFromForm`, `setOptionsToForm` を `UI helpers` へ
- [ ] `handleSaveClick` を `Button action handlers` セクションへ追加し、
      `saveOptions()` と保存完了メッセージ表示をここから呼ぶ
- [ ] `saveOptions`, `initialize` を `Core async logic` へ（`initialize` が最後）
- [ ] DOMContentLoaded / save の listener 登録を `Event listeners` セクションへ分離
- [ ] `Event listeners` セクションには listener registration のみを置く

完了条件:

- [ ] `npm run lint` が通る
- [ ] セクションコメントが挿入されている
- [ ] オプション保存 / 読み込み / テーマ・フォントサイズ反映が従来通り動く

### フェーズ 3: `popup.js` の構造化と UI 状態ヘルパー化

**目標**: 章立てを整え、UI 状態操作を小関数化する。

現状: 既にセクションコメントがあるが、`UI helpers` に `setPopupControlsEnabled` しかなく、
`main()` 内に DOM 操作が混在している。

整理後の構成:

```text
// ── Pure utilities (no DOM access, no side effects) ────────────────────────
const getLoadingMessage = (actionType, mediaType) => { ... };

// ── Content script injection utilities ──────────────────────────────────────
const getSelectedText = () => { ... };
const getWholeText = () => { ... };
const getTranscript = async () => { ... };

// ── UI helpers ──────────────────────────────────────────────────────────────
const setPopupControlsEnabled = (enabled) => { ... };
const showResultsLink = (show) => { ... };          // 新設: main() 内の style.display を集約
const renderStreamContent = (html) => { ... };      // 新設: streaming 表示更新を集約
const clearContentArea = () => { ... };             // 新設: content/status クリアを集約

// ── Button action handlers ──────────────────────────────────────────────────
const copyContent = async () => { ... };
const saveContent = () => { ... };

// ── Core async logic ────────────────────────────────────────────────────────
const extractTaskInformation = async () => { ... };
const main = async (useCache) => { ... };
const initialize = async () => { ... };

// ── Event listeners ─────────────────────────────────────────────────────────
```

作業内容:

- [ ] 既存セクションコメントを `AGENTS.md` の図語彙へ合わせる（既にほぼ一致）
- [ ] `main()` 内の `document.getElementById("content").textContent = ""` などは
      `clearContentArea()` へ切り出し
- [ ] `document.getElementById("results-link").style.display` の切替は
      `showResultsLink(show)` へ切り出し
- [ ] streaming 表示更新の `document.getElementById("content").innerHTML = ...` は
      `renderStreamContent(html)` へ切り出し
- [ ] `main()` の catch ブロックは `console.error` を維持（広域 flow の catch は policy 許容）
- [ ] `copyContent` の `console.error` を `console.log` へ変更
      （クリップボード権限拒否はユーザー環境起因のため policy 違反）

完了条件:

- [ ] `npm run lint` が通る
- [ ] `main()` 内の直接 DOM 操作が減り、helper 経由になっている
- [ ] 要約 / 翻訳 / streaming / キャッシュ利用 / 結果タブ表示 が従来通り動く

### フェーズ 4: `results.js` の構造化と UI 状態ヘルパー化

**目標**: 章立てを整え、フォローアップ送信状態・会話表示を小関数化する。
**画像添付は持ち込まない**。

現状: セクションコメントあり。`askQuestion()` 内に DOM 操作と状態管理が混在。

整理後の構成:

```text
// ── Pure utilities (no DOM access, no side effects) ────────────────────────
const validateConversation = (data) => { ... };
const extractTextFromMessage = (item) => { ... };
const isSuccessfulResponse = (response) => { ... };

// ── Tab state & notification ────────────────────────────────────────────────
const setResultControlsEnabled = (enabled) => { ... };  // 現状ここにあるが UI 操作なので UI helpers へ移動検討
const isResultTabActive = () => { ... };
const updateDocumentTitle = () => { ... };
const syncAttentionCue = () => { ... };
const beginWaitingForResult = () => { ... };
const completeWaitingForResult = () => { ... };

// ── UI helpers ──────────────────────────────────────────────────────────────
const appendQuestionToUi = (question) => { ... };
const appendAnswerPlaceholderToUi = () => { ... };
const updatePageSource = () => { ... };
const clearSendStatusMessage = () => { ... };   // 新設: askQuestion 内の status クリア集約
const startSendStatusMessage = () => { ... };   // 新設: setInterval 開始を集約

// ── Button action handlers ──────────────────────────────────────────────────
const clearConversation = async () => { ... };
const copyContent = async () => { ... };
const saveContent = () => { ... };

// ── Core async logic ────────────────────────────────────────────────────────
const askQuestion = async () => { ... };
const waitForResult = async () => { ... };
const initialize = async () => { ... };

// ── Event listeners ─────────────────────────────────────────────────────────
```

作業内容:

- [ ] `setResultControlsEnabled` を `Tab state & notification` から `UI helpers` へ移動
      （DOM 操作のみで状態計算を含まないため）
- [ ] `askQuestion()` 内の `document.getElementById("send-status")` 操作を
      `clearSendStatusMessage()` / `startSendStatusMessage()` へ切り出し
- [ ] `askQuestion()` 内の `document.getElementById("text").value = ""` なども
      必要に応じて helper 化
- [ ] `console.warn("API response was not successful:", response)` を `console.log` へ変更
      （API 失敗は expected outcome なので policy 違反）
- [ ] `askQuestion()` の広域 catch は `console.error` を維持
- [ ] `clearConversation` の `console.error` は維持
      （storage 基盤失敗は policy 上 error 扱い）
- [ ] `copyContent` の `console.error` は `console.log` へ変更
      （clipboard permission などのユーザー環境失敗は policy 上 log 扱い）

完了条件:

- [ ] `npm run lint` が通る
- [ ] フォローアップ送信 / streaming 表示 / 会話クリア / コピー / 保存 が従来通り動く
- [ ] `console.warn` が 0 件になる（policy の「currently none」と一致）

### フェーズ 5: `service-worker.js` の構造化

**目標**: 章立てを整える。**生成ロジックは変えない**。

現状: `Pure utilities` と `Core async logic` の2セクションのみ。

整理後の構成:

```text
import { ... } from "./utils.js";

// ── Pure utilities (no DOM access, no side effects) ────────────────────────
const getSystemPrompt = async (...) => { ... };

// ── Core async logic ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(...);
```

作業内容:

- [ ] 既存セクションコメントが `AGENTS.md` 図語彙と一致していることを確認
- [ ] `getSystemPrompt` が `Pure utilities` に置けるか確認
      （`chrome.storage.local.get` を呼んでおり副作用あり → 必要なら専用 helper セクションへ）
- [ ] `getSystemPrompt` が副作用を含む場合は `Specialized helpers` セクション
      （例: `System prompt construction`）へ分離
- [ ] 広域 catch の `console.error` は維持（policy 許容）
- [ ] API 失敗の `sendResponse(response)` 周辺で `console.error` を使っていないか確認
      （現状は使っていないはず）

完了条件:

- [ ] `npm run lint` が通る
- [ ] 生成 / キャッシュ更新 / keepalive 応答 が従来通り動く

### フェーズ 6: ログレベル最終確認

**目標**: 全ファイルの `console.*` が `AGENTS.md` の Logging policy に適合していることを確認。

作業内容:

- [ ] `grep -n "console\." extension/*.js` で全呼び出しを抽出
- [ ] 各呼び出しを policy に照らして分類
  - `console.error`: storage / tab / messaging / template 基盤失敗、広域 catch の内部失敗
  - `console.log`: API 失敗、ユーザー環境失敗（clipboard / Readability fallback / transcript）
  - `console.warn`: 現状 0 件であることを確認
  - `console.debug`: 現状 0 件であることを確認
- [ ] `popup.js` の `copyContent` が `console.log` になっていること（フェーズ3）
- [ ] `results.js` の `console.warn` が `console.log` になっていること（フェーズ4）
- [ ] `"Request:"` / `"Response:"` の `console.log` は維持（policy 許容）

完了条件:

- [ ] `console.warn` / `console.debug` が 0 件
- [ ] `console.error` が基盤失敗・広域 catch のみ
- [ ] `console.log` が API 失敗・ユーザー環境失敗・デバッグログのみ

---

## 3. ファイル別変更サマリ

| ファイル | フェーズ | 主な変更 | 挙動変更 |
| --- | --- | --- | --- |
| `extension/utils.js` | 1 | セクションコメント改名・統合、`tryParseJson` 移動 | なし |
| `extension/options.js` | 2 | セクションコメント挿入、関数並び替え | なし |
| `extension/popup.js` | 3 | UI helper 新設、`main()` の DOM 操作集約、`copyContent` の log レベル変更 | なし |
| `extension/results.js` | 4 | UI helper 新設、`askQuestion()` の状態操作集約、`console.warn` → `log` | なし |
| `extension/service-worker.js` | 5 | セクションコメント確認・必要なら専用 helper セクション分離 | なし |

---

## 4. 検証手順

各フェーズ終了時に以下を実施する。

### 静的検証

```sh
npm run lint
```

### 手動動作確認

1. **オプション保存**: API キー / モデル / 言語 / テーマ / フォントサイズ を保存し、再読み込みで復元される
2. **要約**: 一般ページを開いてアイコンクリック、要約が表示される
3. **翻訳**: テキスト選択してアイコンクリック、翻訳が表示される
4. **YouTube 字幕要約**: 字幕付き動画で要約が動く
5. **画像要約**: 画像ファイルを開いて要約が動く
6. **streaming**: オプションで streaming 有効化し、逐次表示される
7. **フォローアップ**: 結果タブで追加質問ができる
8. **会話クリア / コピー / 保存**: 結果タブの各ボタンが動く
9. **キャッシュ利用**: 同じ条件で2回目の生成がキャッシュから即座に返る

### 整合性確認

- [ ] `AGENTS.md` の Source file organization と実コードのセクションコメントが一致
- [ ] `AGENTS.md` の Logging policy と実コードの `console.*` が一致
- [ ] `console.warn` / `console.debug` が 0 件

---

## 5. リスクと対応

| リスク | 影響 | 対応 |
| --- | --- | --- |
| 関数の移動で依存順序が崩れる | 実行時エラー | 各フェーズで lint + 手動確認 |
| `console.log` 化でエラーが埋もれる | デバッグ困難化 | 広域 catch は `console.error` を維持 |
| helper 化で this 束縛が変わる | 挙動変化 | arrow function を維持し、`this` に依存しない |
| セクション移動で diff が大きくなる | レビュー困難 | フェーズ毎に commit を分ける |

---

## 6. 今後の拡張（今回はやらない）

本リファクタリング完了後、必要になれば以下を別計画で検討する。

- `options.js` へ `applyOptionsToForm()` 風の import 復元 helper 追加
- `popup.js` へ結果タブ管理 helper（`closeStaleResultTab` / `rememberResultTab`）追加
  （`openResultsInTab` 機能を入れる場合の前提）
- `utils.js` へ `Extension helpers` 層の新設
  （Base URL 正規化や host permission など、将来の拡張を見据えた場合のみ）

これらは機能追加に近いため、本計画の完了後に別途評価する。

---

## 7. 用語

- **Claude 版**: `extension-summarize-translate-claude`
- **Gemini 版**: `extension-summarize-translate-gemini`
- **章語彙**: `AGENTS.md` の Source file organization で定義されたセクション名の集合
- **広域 catch**: `main()` / `askQuestion()` / service-worker の生成 handler など、
  複数の操作をまとめて受け止める `catch` ブロック
