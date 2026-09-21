# 品質改善取り込み計画 2026-09-21（第2回）

本ドキュメントは `extension-summarize-translate-claude`（Claude版）に対し、
`extension-summarize-translate-gemini`（Gemini版）で実装された更新を移植するための実装計画です。

状態: 実装済み（2026-09-21）。手動検証は §4.2 を参照。

本シリーズについて:

- Gemini版の更新は定期的に発生するため、取り込み計画は日付付きでシリーズ化する
- ファイル名の形式: `PORT_QUALITY_PLAN_YYYY-MM-DD.md`
- 第1回: [`PORT_QUALITY_PLAN_2026-08-02.md`](PORT_QUALITY_PLAN_2026-08-02.md)

前提:

- 第1回は「不具合修正・品質修正のみ」を対象とした（機能追加・UI改善・モデル追加は対象外）
- 第2回はユーザー判断により、Gemini版 `25bf686` の**新機能（書式付きコピー）も対象に含める**
- 対象は以下の 6 項目（ユーザー確定済み）

| # | 移植内容 | Gemini版コミット | 区分 |
| --- | --- | --- | --- |
| 1 | 質問ブロックの装飾をインライン `style` から CSS へ移行 | `25bf686` の一部 | 品質修正 |
| 2 | 書式付きコピー（`text/html` + `text/plain` の同時書き込み） | `25bf686` | 新機能 |
| 3 | ESLint `curly` ルールの追加 | `68df6db` の一部 | 品質修正 |
| 4 | AGENTS.md への規約追記 | `1a6d25f` / `68df6db` | 規約 |
| 5 | 調査ドキュメントの移植 | `c970053` / `e484ac5` / `70ec8fc` / `4c63e1e` | ドキュメント |
| 6 | README 冒頭のクロスブラウザ表記 | `13b7525` の一部 | ドキュメント |

参考リポジトリ:

- Claude版: `/nfs/git/extension-summarize-translate-claude`
- Gemini版: `/nfs/git/extension-summarize-translate-gemini`

---

## 1. 目的とスコープ

### 目的

- **#1**: 結果ページの質問ブロックが JavaScript からインライン `style` を設定しているため、
  Copy した HTML に `var()` と `rem` がそのまま載り、貼り付け先（Word など）で
  未定義値になる。装飾を `results.html` の CSS クラスへ移し、ペイロードから
  定義依存の値を排除する
- **#2**: Copy ボタンでコピーした内容を Gmail / Google Docs / Word などに貼り付けたとき、
  太字・見出し・リスト・コードブロックの書式を保持する。プレーンなテキスト先
  （メモ帳・VS Code など）には従来どおり Markdown 原文が貼り付く
- **#3**: AGENTS.md が定める「制御文には必ずブレースを付ける」規約を、
  ESLint の `curly` ルールで機械的に担保する
- **#4**: Gemini版で整備された開発規約（応答言語、Git コミット、CSS と JavaScript の責務分離、
  ランタイム依存の禁止、ドキュメント運用）を Claude版の AGENTS.md に反映する
- **#5**: #1 / #2 の設計根拠となる調査ドキュメントを Claude版にも置き、コードと
  AGENTS.md からの参照先を成立させる
- **#6**: README 冒頭の説明を、実際の対応ブラウザー（Chrome / Edge / Firefox）に合わせる

### スコープ外

- Gemini版の自動テスト（`test/` / `e2e/`）— Claude版にテスト基盤が存在しないため移植しない
- `exportTextToFile` の `.md` / `.html` 保存対応（Gemini版 Issue #50 の後半提案）— 今回は対象外
- Gemini版 `8402b63`（Gemini 3.8 Flash 追加）— モデル追加は対象外。Claude版は `371f588` で
  Claude Fable 5.1 を追加済み
- Gemini版 `13b7525` の Auto-fallback / HTTP 503 リトライ説明 — Claude版に該当機構がない
- Gemini版 AGENTS.md の `Test layout` / e2e / provider 検証の記述 — 対応する基盤がない
- Gemini版 AGENTS.md の `## Reference` 見出し再編 — Claude版はエラーコード体系が異なる（1000 のみ）
- `manifest.json` への権限追加 — 不要（調査ドキュメント §4 の結論どおり）

### 変更対象ファイル

| ファイル | 変更内容 |
| --- | --- |
| `extension/utils.js` | `buildClipboardHtml` / `copyContentToClipboard` を追加（#2） |
| `extension/popup.js` | `copyContentToClipboard` を import し、`copyContent` から呼び出す（#2） |
| `extension/results.js` | `copyContentToClipboard` を import し、`copyContent` から呼び出す（#2）／`appendQuestionToUi` を CSS クラス化（#1） |
| `extension/results.html` | `.conversation-question` を `<style>` に追加（#1） |
| `eslint.config.mjs` | `curly` ルールを追加（#3） |
| `AGENTS.md` | `Response language` / `Git commits` セクション追加、Core rules と Notes に追記（#4） |
| `README.md` | 冒頭のクロスブラウザ表記（#6） |
| `docs/archive/RESEARCH_HTML_CLIPBOARD_COPY.md` | 新規（#5） |
| `docs/archive/RESEARCH_WORD_HTML_PASTE.md` | 新規（#5） |
| `docs/archive/PORT_QUALITY_PLAN_2026-09-21.md` | 本ドキュメント（#5） |
| `extension/manifest.json` / `firefox/manifest.json` | バージョン 1.4.40（任意・最終工程） |

---

## 2. 現状分析

### 2.1 同期点

| 項目 | Gemini版 | Claude版 |
| --- | --- | --- |
| 最終同期 | `3e9d09c` Readability フォールバック（2026-08-22） | `fa2dc0f`（2026-08-29） |
| モデル追加 | `8402b63` Gemini 3.8 Flash（2026-09-05） | `371f588` Claude Fable 5.1（2026-09-05） |

両リポジトリに共通履歴はなく、Claude版は選択移植で追従している。
`3e9d09c` の移植内容は `getWholeText` の実装が完全一致することを確認済み。
したがって未取り込みは **Gemini版 2026-09-05 以降**のみであり、本計画はその範囲を対象とする。

### 2.2 コピー処理の現状

Claude版は `navigator.clipboard.writeText()` のみを使用しており、HTML は書き込んでいない。

| ファイル | 行 | 現状 |
| --- | --- | --- |
| `extension/popup.js` | 179 | `await navigator.clipboard.writeText(clipboardContent);` |
| `extension/results.js` | 167 | `await navigator.clipboard.writeText(clipboardContent);` |

プレーンテキストの組み立て（`result.responseContent` + 会話の各メッセージ）は
Gemini版と同一のため、`writeText()` の呼び出しだけを差し替えればよい。

### 2.3 質問ブロック装飾の現状

`extension/results.js` の `appendQuestionToUi`（112〜120行）が 4 つのインライン
`style` を設定している。

```javascript
const appendQuestionToUi = (question) => {
  const formattedQuestionDiv = document.createElement("div");
  formattedQuestionDiv.style.backgroundColor = "var(--nc-bg-3)";
  formattedQuestionDiv.style.borderRadius = "1rem";
  formattedQuestionDiv.style.margin = "1.5rem";
  formattedQuestionDiv.style.padding = "1rem 1rem .1rem";
  formattedQuestionDiv.innerHTML = convertMarkdownToHtml(question, true);
  document.getElementById("conversation").appendChild(formattedQuestionDiv);
};
```

`#conversation` はコピー対象の DOM そのものなので、このインライン `style` は
コピーした HTML に載る。貼り付け先には `css/new.min.css` も `:root` の
フォントサイズも存在しないため、`var(--nc-bg-3)` と `rem` が未定義値になる。

### 2.4 Gemini版との構造差（移植時に吸収する点）

| 箇所 | Gemini版 | Claude版での対応 |
| --- | --- | --- |
| `appendQuestionToUi` | 引数 `parts`（画像パート対応） | 引数 `question`（文字列）のため、クラス化のみ適用 |
| `buildClipboardHtml` | `.results-image-preview` ラッパーごと削除する分岐あり | Claude版に添付画像プレビューが存在しないため分岐は移植せず、`img[src^="data:"]` の除去のみ残す |
| `results.html` の `<style>` | 添付画像プレビュー用の規則あり | Claude版は空（メディアクエリのみ）のため `.conversation-question` だけを追加 |
| コードコメントの参照先 | `docs/RESEARCH_WORD_HTML_PASTE.md`（archive 移動後も古いパス） | 移植時は `docs/archive/RESEARCH_WORD_HTML_PASTE.md` に修正する |
| テスト | `test/dom/clipboard-copy.test.js` 等で固定 | テスト基盤がないため移植せず、4.2 の手動検証で代替 |

---

## 3. 実装内容

### 3.1 #1 質問ブロックの装飾を CSS へ移行（`25bf686` の一部）

#### `extension/results.html`

`<style>` 内のメディアクエリの直前に追加する。

```css
    .conversation-question {
      background-color: var(--nc-bg-3);
      border-radius: 1rem;
      margin: 1.5rem;
      padding: 1rem 1rem .1rem;
    }
```

#### `extension/results.js`（`appendQuestionToUi`）

`appendQuestionToUi` を以下のように変更する（`dir="auto"` の付与も Gemini版に合わせる）。

```javascript
const appendQuestionToUi = (question) => {
  const formattedQuestionDiv = document.createElement("div");

  // Presentation belongs to results.html: the conversation DOM is copied to the
  // clipboard as-is, and the paste target has neither the extension stylesheet nor its
  // root font size. See docs/archive/RESEARCH_WORD_HTML_PASTE.md.
  formattedQuestionDiv.className = "conversation-question";
  formattedQuestionDiv.setAttribute("dir", "auto");
  formattedQuestionDiv.innerHTML = convertMarkdownToHtml(question, true);
  document.getElementById("conversation").appendChild(formattedQuestionDiv);
};
```

ポイント:

- インライン `style` 4 行を削除し、`className` に置き換える
- `dir="auto"` を追加する（Gemini版と同じ。質問が RTL 言語の場合の表示改善）
- 呼び出し側（`results.js` 225行 / 428行）は変更しない

### 3.2 #2 書式付きコピー（`25bf686` の本体）

#### `extension/utils.js`

`UI helpers` セクションの末尾、`exportTextToFile` の直後（`// ── Claude API helpers ──`
の直前）に追加する。Clipboard API は副作用を伴うため `Pure utilities` には置かない。
内部ヘルパーを先、エクスポートする API を後に配置する（AGENTS.md の並び順規約）。

```javascript
// Collects the rendered fragment so that the copied HTML matches what is displayed.
// Inline (data URL) images are dropped so that the copied payload stays text only,
// matching the plain text copy. Images referenced by a URL are kept.
// Returns the wrapper element itself so that the dir attribute is preserved.
const buildClipboardHtml = (...roots) => {
  const container = document.createElement("div");
  container.setAttribute("dir", "auto");

  for (const root of roots) {
    if (!root) {
      continue;
    }

    // Move nodes out of a clone so that the live DOM is left untouched.
    for (const node of Array.from(root.cloneNode(true).childNodes)) {
      container.appendChild(node);
    }
  }

  // Drop inline (data URL) images so that the copied HTML stays text only.
  container.querySelectorAll('img[src^="data:"]').forEach((image) => {
    image.remove();
  });

  // Return the element itself: container.innerHTML would drop the dir attribute.
  return container;
};

// Writes plain text and rich HTML in one clipboard item. The text is always
// written so that pasting into a plain text editor keeps the current behavior.
export const copyContentToClipboard = async (text, ...roots) => {
  const clipboard = navigator.clipboard;
  const wrapper = buildClipboardHtml(...roots);
  const canWriteHtml = wrapper.innerHTML !== "" && typeof ClipboardItem !== "undefined" && typeof clipboard?.write === "function";

  if (!canWriteHtml) {
    await clipboard.writeText(text);
    return;
  }

  try {
    await clipboard.write([new ClipboardItem({
      "text/html": new Blob([wrapper.outerHTML], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" })
    })]);
  } catch (error) {
    // Expected on browsers without HTML clipboard support: fall back to text.
    console.log("Failed to copy HTML content. Falling back to plain text:", error);
    await clipboard.writeText(text);
  }
};
```

Gemini版との差分（意図的なもの）:

- `.results-image-preview` ラッパーを削除する分岐は移植しない（Claude版に添付画像プレビューが無い）
- コメントは Claude版の事情に合わせて調整し、参照先を `docs/archive/` に修正する

#### `extension/popup.js`

import に `copyContentToClipboard` を追加する。

```javascript
import {
  DEFAULT_LANGUAGE_MODEL,
  applyTheme,
  applyFontSize,
  loadTemplate,
  displayLoadingMessage,
  convertMarkdownToHtml,
  getResponseContent,
  exportTextToFile,
  copyContentToClipboard
} from "./utils.js";
```

`copyContent`（176行付近）の書き込みを差し替える。HTML の組み立てはクリックハンドラー内で
同期的に行い、user activation の失効による `NotAllowedError` を避ける。

```javascript
    // Copy the content to the clipboard
    await copyContentToClipboard(clipboardContent, document.getElementById("content"));
```

#### `extension/results.js`（`copyContent`）

import に `copyContentToClipboard` を追加し、`copyContent`（156行付近）を差し替える。
結果ページでは要約本文（`#content`）と会話（`#conversation`）の両方をコピー対象にする。

```javascript
    // Copy the content to the clipboard
    await copyContentToClipboard(
      clipboardContent,
      document.getElementById("content"),
      document.getElementById("conversation")
    );
```

ポイント:

- プレーンテキスト（`clipboardContent`）の組み立ては現状のまま変更しない
- `#page-source`（ページタイトル）は従来どおりコピー対象外
- `manifest.json` の権限追加は不要（調査ドキュメント §4）

### 3.3 #3 ESLint `curly` ルールの追加（`68df6db` の一部）

#### `eslint.config.mjs`

`@stylistic/lines-around-comment` の後に追加する。

```javascript
      "@stylistic/lines-around-comment": [
        "error",
        {
          beforeLineComment: true,
          allowBlockStart: true,
          allowObjectStart: true,
          allowArrayStart: true,
          allowClassStart: true
        }
      ],
      "curly": ["error", "all"]
```

#### `AGENTS.md`

Core rules のブレース規約から「手動運用のため ESLint では強制していない」旨の記述を削除し、
ルールで担保されることを明記する。

```text
- Always use block braces `{}` for control statements such as `if`, `else`, `for`, and `while`
  (brace-less single-line statements like `if (cond) return;` are strictly prohibited).
  This is enforced by the `curly` rule in `eslint.config.mjs`.
```

### 3.4 #4 AGENTS.md への規約追記（`1a6d25f` / `68df6db`）

`AGENTS.md` は英語で記述する（既存の Comment language 規約と同じ扱い）。

#### 追加 1: `## Response language`（Project overview の直後）

```markdown
## Response language

- Reply in the same language the user is using for the current request (English, Japanese, and so on).
- This applies to every kind of message: explanations, plans, status reports, questions asked back, and final summaries.
- It does not change the language of the code and documentation rules below: code, code comments, commit messages, and this file stay in English.
```

#### 追加 2: `## Git commits`（Validation の直後）

```markdown
## Git commits

- Never run `git commit` unless the user explicitly asks for a commit in the current task.
- Do not commit automatically after finishing a task, a plan step, or a validation run.
- Commit steps described in a plan document (for example "commit in two parts: `feat(...)` then `chore(...)`") are guidance for the user, not an authorization to commit.
- `git commit --amend`, `git rebase`, `git revert`, and `git push` follow the same rule: only on explicit instruction.
- When a task is complete, stop after the file changes and validation, then report what changed and leave the changes uncommitted.
- The user decides the commit granularity, message, and timing.
```

#### 追加 3: Core rules（`Do not edit files in extension/lib/` の直後）

```markdown
- Do not add runtime dependencies. The extension has no bundler and no build step, and `node_modules/` is not part of `extension/`, so third-party code must be vendored into `extension/lib/` as a browser-ready file and recorded in the vendored-libraries table below.
```

#### 追加 4: Core rules（ブレース規約の直後）

```markdown
- Keep UI presentation in CSS, not in JavaScript. The results page DOM (`#content`, `#conversation`) is copied to the clipboard as-is, so an inline `style` set from JavaScript is carried into the pasted HTML, where the extension stylesheet and root font size do not exist. Use the classes defined in the page's `<style>` block instead (see `docs/archive/RESEARCH_WORD_HTML_PASTE.md`).
```

#### 追加 5: Notes（既存の 2 項目の後）

```markdown
- Put new plan and research documents directly under `docs/`. Move them to `docs/archive/` once the work is complete, and update the references to them (`AGENTS.md` and other documents) in the same change.
```

### 3.5 #5 調査ドキュメントの移植

Gemini版 `docs/archive/` から以下を Claude版の `docs/archive/` にコピーする。
どちらも調査結果であり作業は完了済みのため、`docs/` 直下ではなく `docs/archive/` に置く
（3.4 の追加 5 のルールに合わせる）。

| 移植元（Gemini版） | 移植先（Claude版） | 調整内容 |
| --- | --- | --- |
| `docs/archive/RESEARCH_HTML_CLIPBOARD_COPY.md` | 同名 | 冒頭に Claude版向けの由来メモを追加。§7 の `Extension helpers` は Claude版の `UI helpers` に読み替え |
| `docs/archive/RESEARCH_WORD_HTML_PASTE.md` | 同名 | 冒頭に由来メモを追加。§6 のテストファイル参照は「4.2 の手動検証で代替」に置き換え |

Gemini版 `PLAN_HTML_CLIPBOARD_COPY.md` は移植しない（Gemini版の Issue 番号・テスト構成に
依存し、本ドキュメントが Claude版の計画として置き換わるため）。

由来メモの文面（両ファイル共通の形式）:

```markdown
> 本ドキュメントは Gemini版（`extension-summarize-translate-gemini`）の調査結果を
> Claude版へ移植したもの。Claude版の実装計画は
> [`PORT_QUALITY_PLAN_2026-09-21.md`](PORT_QUALITY_PLAN_2026-09-21.md) を参照。
```

### 3.6 #6 README 冒頭のクロスブラウザ表記（`13b7525` の一部）

`README.md` の 3 行目を変更する。

```markdown
Cross-browser extension (Chrome, Edge, Firefox) to summarize and translate web pages.
Uses Claude as the backend.
```

Gemini版 README の Auto-fallback / HTTP 503 リトライ / モデル表の記述は Claude版に
該当機構がないため移植しない。

---

## 4. 検証方法

### 4.1 静的検証

- `npm run lint` を実行し、`curly` ルール追加後にエラーが出ないことを確認する
  （`extension/` 配下にブレース無しの制御文が無いことは grep で確認済み）
- 新規追加した Markdown ファイル（本ドキュメント、調査ドキュメント 2 件）は
  VS Code の markdownlint 診断を確認する
- ロケールファイルは変更しないため、i18n キーの整合確認は不要

実装時に Chromium（Playwright）で `copyContentToClipboard` の出力を確認済み:

- `#content` / `#conversation` から `<h2>` / `<strong>` / `<code>` と
  `.conversation-question` を保持した HTML が生成され、ラッパーに `dir="auto"` が付く
- ペイロードに `var()` / `rem` / インライン `style` / data URL 画像が含まれない
- 空の root・`ClipboardItem` 非対応・`write()` 失敗の各ケースで
  プレーンテキストへフォールバックする（計 14/14 項目パス）

### 4.2 手動検証

拡張機能を再読み込みし、結果ページは開き直してから検証する（旧ペイロードの混入を避ける）。

| 項目 | 手順 | 期待結果 |
| --- | --- | --- |
| 表示の退行確認（#1） | 結果ページでフォローアップ質問を送信し、`results.html` の `.conversation-question` の計算値を確認 | `background-color` / `border-radius` / `margin` / `padding` が変更前と同じ |
| ペイロードの内容（#1） | 質問を含む状態で Copy し、`navigator.clipboard.write` に渡る HTML 文字列を確認 | `var()` / `rem` / インライン `style` が含まれない |
| 書式付き貼り付け（#2） | popup で要約 → Copy → Google Docs / Gmail に貼り付け | 見出し・太字・番号付きリスト・コードブロックの書式が保持される |
| プレーンテキスト貼り付け（#2） | 同じ内容を VS Code などのテキストエディターに貼り付け | 従来どおり Markdown 原文が貼り付く |
| 会話のコピー（#2） | 結果ページでフォローアップ質問後に Copy → 貼り付け | 要約本文と会話（質問・回答）が順に貼り付く |
| Word への貼り付け（#1 / #2） | 結果ページのコピー内容を Word に貼り付け | 質問と回答の区切りが読み取れる（装飾は Word の既定書式に委ねる） |
| フォールバック（#2） | `ClipboardItem` を無効化した状態（または `#content` / `#conversation` が空の状態）で Copy | プレーンテキストでコピーされ、ステータスに「コピーしました」が表示される |
| コピー失敗時（#2） | クリップボード権限を拒否した状態で Copy | ステータスが空のままで、コンソールに `console.log` の警告が出る（例外は投げない） |
| 規約の反映（#3 / #4） | `AGENTS.md` と `eslint.config.mjs` を読み、Gemini版と同等の記述になっていることを確認 | 追加 1〜5 と `curly` ルールが反映されている |

---

## 5. コミット分割案

Gemini版の粒度に合わせ、以下を提案する。実際の分割・メッセージ・時期はユーザーが決定する
（AGENTS.md の Git commits 規約）。

1. `fix(results): move question styling from JavaScript to CSS`
   - `extension/results.js` / `extension/results.html`
2. `feat(clipboard): preserve rich formatting when copying content`
   - `extension/utils.js` / `extension/popup.js` / `extension/results.js`
3. `chore(lint): enforce block braces with the curly rule`
   - `eslint.config.mjs` / `AGENTS.md`（ブレース規約の記述修正）
4. `docs: add clipboard copy research documents`
   - `docs/archive/RESEARCH_HTML_CLIPBOARD_COPY.md` /
     `docs/archive/RESEARCH_WORD_HTML_PASTE.md` /
     `docs/archive/PORT_QUALITY_PLAN_2026-09-21.md`
5. `docs: clarify project structure and development guidelines`
   - `AGENTS.md`
6. `docs: clarify cross-browser support`
   - `README.md`
7. （任意）`chore: bump version to 1.4.40 in manifest files`
   - `extension/manifest.json` / `firefox/manifest.json`

Gemini版 `25bf686` は 1 と 2 を 1 コミットにまとめている。Claude版では
「品質修正」と「新機能」を分けて記録するため 2 コミットを提案する。

---

## 6. リスクと注意点

- **#2**: `Clipboard.write()` と `text/html` 形式は Firefox 127 以降での対応。
  `firefox/manifest.json` に `strict_min_version` が無いため、それ以前の Firefox でも
  インストールされ得る。`canWriteHtml` 判定と `try/catch` によるプレーンテキスト
  フォールバックで吸収する
- **#2**: クリップボードの書き込みは transient user activation に依存する。HTML の
  組み立てはクリックハンドラー内で同期的に完了させ、`await` を挟んでから DOM を読まない
- **#2**: `wrapper.innerHTML !== ""` が false の場合（結果が空）はプレーンテキストへ落とす。
  このとき `text` は空文字になり得るが、従来の `writeText()` と同じ挙動
- **#2**: 貼り付け先では `css/new.min.css` が無いため、コードブロックの等幅・背景色は
  再現されない（調査ドキュメント §8 に既知の制約として記載済み）
- **#2**: `img[src^="data:"]` の除去は Claude版では現状対象が無い。Markdown 出力に
  data URL 画像が含まれた場合の肥大化を防ぐ保険として残す
- **#1**: `dir="auto"` の付与により質問ブロックの方向判定がブラウザー既定に変わる。
  日本語・英語では表示に影響しない
- **#1**: 装飾を CSS へ移すため、`results.html` を経由せず `#conversation` を生成する
  経路（存在しないが将来追加された場合）では装飾が付かなくなる。AGENTS.md の
  追加 4 がこの制約を明文化する
- **#3**: `curly` は既存コードに違反が無いことを grep で確認済みだが、`npm run lint` で
  最終確認する。違反が見つかった場合はルール追加コミット内で修正する
- **#4**: AGENTS.md は Claude版の実態に合わせて調整する。Gemini版の Test layout /
  e2e / provider 検証の記述は移植しない（スコープ外）
- **#5**: 調査ドキュメントの Gemini版 Issue 番号やテスト参照は由来情報として残しつつ、
  Claude版で成立しない参照は読み替える
- **検証**: Word の貼り付け結果は目視では判断しにくい。インデント値は Shift+F1
  （書式の詳細）で確認する。また、範囲選択コピーでペイロードを検証すると Chromium が
  ページの `<style>` を載せるため、必ず拡張機能の Copy ボタンで検証する
