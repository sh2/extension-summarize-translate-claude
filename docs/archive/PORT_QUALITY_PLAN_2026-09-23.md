# 品質改善取り込み計画 2026-09-23（第3回）

本ドキュメントは `extension-summarize-translate-claude`（Claude版）に対し、
`extension-summarize-translate-gemini`（Gemini版）で実装された更新を移植するための実装計画です。

状態: 実装済み（2026-09-23）。`npm run lint` はエラーなし。手動検証は 4.3 を参照（14 項目すべて完了）。
バージョン更新（3.5）は未実施。`docs/archive/` への移動は完了。
本ドキュメントは作業完了後の 2026-09-23 に `docs/` から移動した。

本シリーズについて:

- Gemini版の更新は定期的に発生するため、取り込み計画は日付付きでシリーズ化する
- ファイル名の形式: `PORT_QUALITY_PLAN_YYYY-MM-DD.md`
- 第1回: [`PORT_QUALITY_PLAN_2026-08-02.md`](PORT_QUALITY_PLAN_2026-08-02.md)
- 第2回: [`PORT_QUALITY_PLAN_2026-09-21.md`](PORT_QUALITY_PLAN_2026-09-21.md)

前提:

- 第1回・第2回は「不具合修正・品質修正のみ」を基本とし、第2回では例外的に
  書式付きコピー（新機能）をユーザー判断で対象に含めた
- 第3回はユーザー判断により、Gemini版 `b3277dd` の**新機能（コピー内容へのソースヘッダ付与）
  ごと対象に含める**
- 対象は以下の 2 項目（ユーザー確定済み）

| # | 移植内容 | Gemini版コミット | 区分 |
| --- | --- | --- | --- |
| 1 | Copy / Save の出力にタイトル + URL のヘッダを付与し、`buildSourceHeader` に一本化 | `b3277dd` | 新機能 |
| 2 | 上記に付随するリファクタ（`dir="auto"` の移設、ヘルパー改名、変数シャドーイング回避） | `b3277dd` | 品質修正 |

参考リポジトリ:

- Claude版: `/nfs/git/extension-summarize-translate-claude`
- Gemini版: `/nfs/git/extension-summarize-translate-gemini`

---

## 1. 目的とスコープ

### 目的

- **#1**: Copy ボタンでコピーした内容に、Save ボタンで保存する `.txt` と同じく
  「タイトル + URL + 本文」を含める。貼り付け先で要約の出典が失われないようにし、
  Copy と Save の出力差をなくす（Gemini版 Issue #50 の追加要望に対応するもの）
- **#2**: 上記を成立させるための付随変更。とくに `dir="auto"` ラッパーの方向解決が
  ヘッダ先頭の文字で決まってしまう問題（RTL 本文が LTR 寄せに崩れる）への対策を同時に取り込む。
  あわせて Save の 2 か所に重複しているヘッダ組み立てを共通化し、
  「片方だけ更新される」という今回の不一致の原因そのものを除去する

### スコープ外

- Gemini版のテスト（`test/dom/source-header.test.js` の新規追加、
  `test/dom/clipboard-copy.test.js` の第2引数 `null` 挿入と 5 ケース追加）—
  Claude版にテスト基盤が存在しないため移植しない（検証方法は第4章参照）
- `.results-image-preview` ラッパーを削除する分岐 — Claude版に添付画像プレビューが存在しない
- Gemini版 `docs/archive/PLAN_COPY_SOURCE_HEADER.md` の移植 — Gemini版の Issue 番号と
  テスト構成に依存し、本ドキュメントが Claude版の計画として置き換わるため
- `#page-source` への URL 表示（画面とコピー内容の一致）、ヘッダの ON/OFF 設定化、
  `.md` / `.html` 形式での保存 — 第7章で扱う
- `exportTextToFile` の保存内容の変更 — 現行と同一を維持する（3.2・3.3 参照）
- Gemini版 `d2ca760` / `fd653d4`（v1.8.19 / v1.8.20）、`314bf7e`（計画ドキュメント追加）—
  Claude版は独自採番（次は 1.4.41）で、計画は本ドキュメントが担う

### 変更対象ファイル

| ファイル | 変更内容 |
| --- | --- |
| `extension/utils.js` | `buildSourceHeader` を追加、`copyContentToClipboard` に第2引数を追加、内部ヘルパーを改名（#1 / #2） |
| `extension/popup.js` | `copyContent` にヘッダを追加、`saveContent` を `buildSourceHeader` に置換（#1） |
| `extension/results.js` | 同上（会話ループの変数名も調整）（#1 / #2） |
| `docs/archive/PORT_QUALITY_PLAN_2026-09-23.md` | 本ドキュメント（作業完了後に `docs/` から移動） |
| `extension/manifest.json` / `firefox/manifest.json` | バージョン 1.4.41（任意・最終工程） |

---

## 2. 現状分析

### 2.1 同期点

| 項目 | Gemini版 | Claude版 |
| --- | --- | --- |
| 最終同期 | `68df6db` docs: clarify project structure…（2026-09-21） | `41c5d64`（2026-09-21） |

両リポジトリに共通履歴はなく、Claude版は選択移植で追従している。
`68df6db` の移植内容は Claude版 `41c5d64` として取り込み済みで、
`eslint.config.mjs` の `test/` / `e2e/` ブロックは基盤が無いため除外、
`curly` ルールは `78380f9` で別途導入済み。

したがって未取り込みは **Gemini版 `68df6db` 以降**のみであり、本計画はその範囲を対象とする。
`68df6db..HEAD` の差分のうち `extension/` を変更するのは `b3277dd` のみで、
残りの `314bf7e` / `d2ca760` / `fd653d4` はドキュメント追加とバージョン bump である。

### 2.2 Copy と Save の現状（変更前）

行番号は本計画の実装前のファイルに対応する（2.3・3.1.1 も同じ）。

| 操作 | 実装 | 出力 |
| --- | --- | --- |
| Copy（popup） | `extension/popup.js` の `copyContent`（175〜188行） | 本文のみ |
| Copy（結果ページ） | `extension/results.js` の `copyContent`（157〜184行） | `result.responseContent` + 会話のみ |
| Save（popup） | `extension/popup.js` の `saveContent`（192〜211行） | `pageTitle` + `pageUrl` + 本文 |
| Save（結果ページ） | `extension/results.js` の `saveContent`（187〜216行） | `result.title` + `result.url` + 本文 |

「タイトルがあれば追加、URL があれば追加、`\n\n` で本文と連結」という組み立ては
Save の 2 か所（popup / results）に重複して存在し、Copy 側には存在しない。
Gemini版で Copy と Save の内容が食い違っていた原因は、この重複した実装が
片方にしか適用されていなかったことである。Claude版は同じ構造をそのまま持っているため、
同じ不一致が残っている。

### 2.3 参照できる値

- 結果ページ: `result.title` / `result.url` は既に `saveContent`（191〜196行）で使用中
- popup: `pageTitle` / `pageUrl`（`popup.js` 17〜18行で宣言、312〜313行で設定）は
  既に `saveContent`（196〜201行）で使用中
- 会話の本文抽出は Claude版では `extractTextFromMessage(item)`（`results.js` 49行）を使う。
  Gemini版の `extractTextFromParts(item?.parts)` とは異なる（`{ role, content }` 形式のため）

### 2.4 `dir="auto"` ラッパーの方向解決（#2 の核心）

#### 2.4.1 コピーされる HTML の包含関係

`copyContentToClipboard` はヘッダ断片と本文のノードを 1 つの `dir="auto"` の `div` に
入れる。ヘッダと本文は**兄弟**（同じ親を持つ並列の子）で、どちらかがどちらかの中に
入ることはない。3.1.4 のとおり、ヘッダ → 本文の順に追加する。

```html
<div dir="auto">                                  ← ラッパー（方向を決める主体）
  <p dir="auto"><strong>タイトル</strong></p>      ← ヘッダ1
  <p dir="auto"><a href="https://…">URL</a></p>    ← ヘッダ2
  <h2>本文の見出し</h2>                             ← 本文（#content の中身）
  <p>本文…</p>
  <div class="conversation-question">…</div>       ← 本文（#conversation の中身）
</div>
```

#### 2.4.2 ラッパーが必要な理由

`dir` はその要素の基底方向（base direction）を決める。基底方向は次の 3 つに効く。

- ブロックの寄せ（左寄せ / 右寄せ）
- 方向を持たない中立文字（スペース・句読点）の扱い
- テキストの並び順

貼り付け先（Gmail / Word / Google ドキュメント）には拡張機能のスタイルシートも
元ページの `dir` も存在しない。そこでラッパーに `dir="auto"` を付け、
「この塊の方向は中身から判断すること」を指示している。

#### 2.4.3 仕様のアルゴリズムと「読み飛ばし」

HTML Standard 3.2.6.4 の auto directionality は、おおむね次のとおり。

> 要素の子孫を tree order で走査し、最初に見つかった「強い方向の文字」
> （双方向文字型 L / AL / R）で方向を決める。ただし走査では、次の要素の
> **部分木をスキップする**: `bdi` / `script` / `style` / `textarea` /
> **`dir` 属性が未指定でない（Undefined 状態でない）要素**

MDN の `dir` の説明も同じで、「`auto` は `<bdi>` / `<script>` / `<style>` /
`<textarea>` および**有効な `dir` 属性を持つ要素をスキップして**、最初の強い方向の
文字を使う」としている。

したがって「ヘッダを読み飛ばす」とは、
**ラッパーの方向を決めるときの文字の走査対象からヘッダの部分木が外れる**という意味である。
ヘッダが表示されなくなるわけではない。ヘッダ自身の方向はヘッダ要素の `dir="auto"` が
別途決める（タイトルがラテン文字なら LTR で左寄せ、アラビア語なら RTL で右寄せ）。

強い方向の文字が 1 つも見つからない場合、方向は `ltr` にフォールバックする。

#### 2.4.4 3 パターンの比較

| パターン | ラッパーが最初に採用する文字 | 結果 |
| --- | --- | --- |
| A. 現行（ヘッダなし） | 本文の先頭 | 本文に合った方向（RTL 本文なら右寄せ） |
| B. ヘッダあり・`dir` なし | タイトルの先頭 | タイトルに引きずられ、RTL 本文が左寄せに崩れる |
| C. ヘッダあり・`dir="auto"` あり（決定 10） | 本文の先頭（ヘッダはスキップ） | 本文に合った方向。A と同じ |

```html
<!-- B: 問題が起きる形 -->
<div dir="auto">
  <p><strong>Wikipedia - ويكيبيديا</strong></p>   ← 走査は tree order なので最初はここ
  <p><a href="https://…">…</a></p>
  <p>هذا ملخص المقالة…</p>                        ← 本文まで到達しない
</div>

<!-- C: 対策後 -->
<div dir="auto">
  <p dir="auto">…</p>        ← 部分木ごとスキップ
  <p dir="auto">…</p>        ← 部分木ごとスキップ
  <p>هذا ملخص المقالة…</p>   ← ここが最初の候補 → RTL
</div>
```

#### 2.4.5 本文側を `div[dir="auto"]` で包む案が効かない理由

ヘッダに `dir` を付ける代わりに本文を `<div dir="auto">` で包む案は成立しない。
走査は tree order で進み、`dir` を持つ部分木はスキップされるため、
B と同じくタイトルが先にヒットし、本文に到達する前に方向が確定してしまう。
Gemini版の計画書でも「走査順が変わらないため無効」と記録されている。

#### 2.4.6 副作用（許容するトレードオフ）

ヘッダに `dir="auto"` を付けると、ヘッダは自分自身の内容で方向を決める。
RTL 文書では次のようになる。

| 要素 | 方向 | 表示 |
| --- | --- | --- |
| 本文 | RTL | 右寄せ |
| タイトル（アラビア語） | RTL | 右寄せ |
| URL（ラテン文字） | LTR | **左寄せ** |

URL 行だけ左寄せになるのは、URL 自身がラテン文字である以上 `dir=auto` として正しい挙動である。
右寄せに揃えるには独自の bidi 判定ロジックが必要になり、「仕様に任せる」方針から
外れるため許容する（決定 10、Gemini版 決定 16）。

#### 2.4.7 結論

Gemini版は B を実機で再現し（タイトル `Wikipedia - ويكيبيديا` + アラビア語本文で
本文が左寄せになる）、C で解決している。Claude版も同じ構造になるため、
ヘッダ導入と同時にこの対策が必要である。

### 2.5 Gemini版との構造差（移植時に吸収する点）

| 箇所 | Gemini版 | Claude版での対応 |
| --- | --- | --- |
| `buildClipboardFragment` の添付プレビュー除去 | `.results-image-preview` ラッパーごと削除する分岐あり | Claude版に添付画像プレビューが存在しないため分岐は移植せず、`img[src^="data:"]` の除去のみ残す |
| 会話の本文抽出 | `extractTextFromParts(item?.parts)` | `extractTextFromMessage(item)` に読み替える |
| `results.js` の実変数名 | `result.responseContent` など | 同じ。ループ内の `text` は `conversationText` に改名する（3.3） |
| テスト | `test/dom/source-header.test.js` 等で固定 | テスト基盤がないため移植せず、4.2 の手動検証で代替 |

---

## 3. 実装内容

### 3.1 `extension/utils.js`（#2 の土台）

#### 3.1.1 内部ヘルパーの改名

`UI helpers` セクションに定義されている以下の 2 つを改名する。
`buildSourceHeader` がヘッダの URL をリンク化する際にも同じ述語を使うため、
「Markdown 専用」ではない名前に揃える（Gemini版 `b3277dd` と同じ）。

| 変更前（現行） | 変更後 |
| --- | --- |
| `allowedMarkdownUrlProtocols`（68行） | `allowedUrlProtocols` |
| `isAllowedMarkdownUrl`（70行） | `isAllowedUrlProtocol` |

`isAllowedMarkdownUrl` を呼んでいる `removeUnsafeMarkdownUrls`（94行）も
新しい名前に更新する。ロジックは変更しない。

#### 3.1.2 `buildSourceHeader` の追加

`UI helpers` セクションの `exportTextToFile` の直後（内部ヘルパー `buildClipboardFragment`
の前）に追加する。プレーンテキストと HTML 断片を同時に返し、両者が構造的にずれないようにする。

```javascript
// Builds the source attribution (page title and URL) that the Copy and Save actions
// share. Returning the plain text and the HTML fragment together keeps the two payloads
// from drifting apart, which is what made the copied text and the saved file differ.
// The text already ends with a blank line, and the fragment is null when there is
// nothing to attribute.
export const buildSourceHeader = (title, url) => {
  const lines = [];

  if (title) {
    lines.push(title);
  }

  if (url) {
    lines.push(url);
  }

  const text = lines.length > 0 ? `${lines.join("\n")}\n\n` : "";

  if (lines.length === 0) {
    return { text, fragment: null };
  }

  // The pasted HTML is rendered where the extension stylesheet does not exist, so the
  // markup carries semantics only: no class, no inline style, and the title is set
  // through textContent so that Markdown or HTML inside a page title stays literal.
  // See docs/archive/RESEARCH_WORD_HTML_PASTE.md.
  //
  // Both header elements carry dir="auto" so that the dir="auto" wrapper added by
  // copyContentToClipboard() skips them (auto directionality resolution ignores an
  // element that has a dir attribute) and keeps resolving the pasted block from the
  // body. Without it, a title that starts with a Latin character would turn an RTL body
  // into a left-aligned block.
  const fragment = document.createDocumentFragment();

  if (title) {
    // A bold paragraph instead of a heading: Word and Gmail render a heading far larger
    // than the surrounding text, which reads as oversized for a line of attribution.
    const titleElement = document.createElement("p");
    const titleText = document.createElement("strong");

    titleElement.setAttribute("dir", "auto");
    titleText.textContent = title;
    titleElement.appendChild(titleText);
    fragment.appendChild(titleElement);
  }

  if (url) {
    const urlElement = document.createElement("p");

    urlElement.setAttribute("dir", "auto");

    // Only http(s) becomes a link, matching the policy of removeUnsafeMarkdownUrls.
    // Other schemes (file:, view-source:, chrome-extension:) would leave a link that
    // only works on the sender's machine, so the URL stays plain text.
    if (isAllowedUrlProtocol(url)) {
      const anchor = document.createElement("a");
      anchor.setAttribute("href", url);
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
      anchor.textContent = url;
      urlElement.appendChild(anchor);
    } else {
      urlElement.textContent = url;
    }

    fragment.appendChild(urlElement);
  }

  return { text, fragment };
};
```

`DocumentFragment` を使うのは、貼り付け先の HTML に余分なラッパー要素を増やさないため。

#### 3.1.3 `buildClipboardHtml` → `buildClipboardFragment`（`dir` の移設）

`dir="auto"` の設定を断片側から外し、呼び出し側でヘッダと本文をまとめて
1 つのラッパーに入れる形に変える。関数名も実体（要素ではなく断片の入れ物）に合わせて改名する。

```javascript
// Collects the rendered fragment so that the copied HTML matches what is displayed.
// Inline (data URL) images are dropped so that the copied payload stays text only,
// matching the plain text copy. Images referenced by a URL are kept.
const buildClipboardFragment = (...roots) => {
  const container = document.createElement("div");

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

  return container;
};
```

現行の末尾コメント `// Return the element itself: container.innerHTML would drop the dir attribute.`
は、この container が `dir` を持たなくなるため削除する。

#### 3.1.4 `copyContentToClipboard`

第 2 引数にヘッダ断片を追加する。変更点は次の 5 つ。それ以外（クローンの作成、
添付プレビューの除去、`ClipboardItem` のキーと Blob の MIME タイプの対応、
`catch` での `writeText` フォールバック）は現行どおり。

1. 第2引数 `sourceFragment` を追加する。`null` なら従来と同じ HTML になる
2. `buildClipboardFragment` へ改名し、`dir="auto"` の設定を外す
3. 本文が空のときはヘッダがあっても `writeText` のみ（既存ガードを維持する）
4. ラッパーへヘッダ → 本文の順に追加する
5. 冒頭コメントから `keeps the current behavior` を外し、「HTML が使えない環境でも
   プレーンテキストでコピーを成立させる」という説明に変える（テキスト自体にヘッダが入るため）

```javascript
// Writes plain text and rich HTML in one clipboard item. The plain text is always written
// so that the copy still succeeds when HTML is unavailable or unsupported. `sourceFragment`
// is the fragment returned by buildSourceHeader() and is dropped when the rendered body is
// empty, so that a copy made before the result is displayed never pastes an
// attribution-only fragment.
export const copyContentToClipboard = async (text, sourceFragment, ...roots) => {
  const clipboard = navigator.clipboard;
  const body = buildClipboardFragment(...roots);
  const canWriteHtml = body.innerHTML !== "" && typeof ClipboardItem !== "undefined" && typeof clipboard?.write === "function";

  if (!canWriteHtml) {
    await clipboard.writeText(text);
    return;
  }

  // A single dir="auto" wrapper keeps the direction of RTL content in the pasted HTML.
  const container = document.createElement("div");
  container.setAttribute("dir", "auto");

  // Clone the fragment: appendChild moves a fragment's children out, and the caller may
  // still hold the fragment after the call.
  if (sourceFragment) {
    container.appendChild(sourceFragment.cloneNode(true));
  }

  for (const node of Array.from(body.childNodes)) {
    container.appendChild(node);
  }

  try {
    await clipboard.write([new ClipboardItem({
      "text/html": new Blob([container.outerHTML], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" })
    })]);
  } catch (error) {
    // Expected on browsers without HTML clipboard support: fall back to text.
    console.log("Failed to copy HTML content. Falling back to plain text:", error);
    await clipboard.writeText(text);
  }
};
```

### 3.2 `extension/popup.js`（#1）

import に `buildSourceHeader` を追加する。

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
  buildSourceHeader,
  copyContentToClipboard
} from "./utils.js";
```

#### `copyContent`（popup）

```javascript
const copyContent = async () => {
  try {
    const operationStatus = document.getElementById("operation-status");
    const { text, fragment } = buildSourceHeader(pageTitle, pageUrl);
    const clipboardContent = `${text}${content.replace(/\n+$/, "")}\n\n`;

    // Copy the content to the clipboard
    await copyContentToClipboard(clipboardContent, fragment, document.getElementById("content"));
    operationStatus.textContent = chrome.i18n.getMessage("popup_copied");

    setTimeout(() => {
      operationStatus.textContent = "";
    }, 1000);
  } catch (error) {
    console.log("Failed to copy content:", error);
  }
};
```

ポイント:

- ヘッダの DOM 組み立てはクリックハンドラー内で同期的に行い、
  user activation の失効による `NotAllowedError` を避ける（第2回と同じ制約）
- 変更前は `const clipboardContent` だったが、`text` を前置するため同じ位置で組み立てる

#### `saveContent`（popup）

`headerLines` の宣言と 2 つの `if`、連結ブロックを `buildSourceHeader` に置き換える。
出力は変更前と同一（タイトル → URL → 空行 → 本文）になる。

```javascript
const saveContent = () => {
  const operationStatus = document.getElementById("operation-status");
  const { text } = buildSourceHeader(pageTitle, pageUrl);
  let fileContent = text;

  fileContent += `${content.replace(/\n+$/, "")}\n\n`;

  exportTextToFile(fileContent);
  operationStatus.textContent = chrome.i18n.getMessage("popup_saved");

  setTimeout(() => {
    operationStatus.textContent = "";
  }, 1000);
};
```

### 3.3 `extension/results.js`（#1 / #2）

import に `buildSourceHeader` を追加し、`copyContent` と `saveContent` を更新する。
あわせて会話ループの `const text` を `conversationText` に改名する。
`buildSourceHeader` の戻り値を `{ text }` / `{ text, fragment }` として受け取るため、
そのままだとブロックスコープのシャドーイングになり可読性を損なう
（Claude版の ESLint に `no-shadow` は無いが、Gemini版に合わせて改名する）。

#### `copyContent`（results）

```javascript
const copyContent = async () => {
  try {
    const operationStatus = document.getElementById("operation-status");
    const { text, fragment } = buildSourceHeader(result.title, result.url);
    let clipboardContent = `${text}${result.responseContent.replace(/\n+$/, "")}\n\n`;

    for (const item of conversation) {
      const conversationText = extractTextFromMessage(item);

      if (conversationText) {
        clipboardContent += `${conversationText.replace(/\n+$/, "")}\n\n`;
      }
    }

    // Copy the content to the clipboard
    await copyContentToClipboard(
      clipboardContent,
      fragment,
      document.getElementById("content"),
      document.getElementById("conversation")
    );

    operationStatus.textContent = chrome.i18n.getMessage("results_copied");

    setTimeout(() => {
      operationStatus.textContent = "";
    }, 1000);
  } catch (error) {
    console.log("Failed to copy content:", error);
  }
};
```

#### `saveContent`（results）

```javascript
const saveContent = () => {
  const operationStatus = document.getElementById("operation-status");
  const { text } = buildSourceHeader(result.title, result.url);
  let fileContent = text;

  fileContent += `${result.responseContent.replace(/\n+$/, "")}\n\n`;

  for (const item of conversation) {
    const conversationText = extractTextFromMessage(item);

    if (conversationText) {
      fileContent += `${conversationText.replace(/\n+$/, "")}\n\n`;
    }
  }

  exportTextToFile(fileContent);
  operationStatus.textContent = chrome.i18n.getMessage("results_saved");

  setTimeout(() => {
    operationStatus.textContent = "";
  }, 1000);
};
```

`.txt` の内容は変更前と同一（タイトル → URL → 空行 → 本文）。

### 3.4 設計上の決定

| # | 決定 | 理由 |
| --- | --- | --- |
| 1 | タイトルと URL を Copy にも含める | 貼り付け先で出典が失われない。Save と一致し、「同じ結果を外に出す操作で内容が違う」状態を解消する |
| 2 | 順序はタイトル → URL → 本文（Save と同一） | コピーとファイルの差をなくす |
| 3 | ヘッダは `buildSourceHeader` に一本化し、テキストと HTML 断片を同時に返す | 今回の不一致の原因が Save 2 か所への重複実装だったため、構造的に同期を保証する |
| 4 | `text/html` はタイトルを太字段落（`<p><strong>`）、URL を `<a>` を含む段落にする（リンクにするのは http(s) のときだけ。決定 7） | 貼り付け先で意味が立つ。Gemini版は `h1` → `h2` → 太字段落と変遷し、見出しは大きすぎると判断して太字段落に落ち着いた。同じ結果を採る |
| 5 | インライン `style` と `class` を付けない | 貼り付け先に拡張機能のスタイルシートが無く、付けたスタイルはペイロードに持ち込まれるだけ（`AGENTS.md` の Core rules） |
| 6 | タイトルは `textContent` で設定する | ページタイトルに含まれ得る Markdown 記法や HTML をそのまま表示し、断片を壊さない |
| 7 | URL を `<a>` にするのは http(s) のときだけ（テキストとしては常に残す） | `file:` / `view-source:` / `chrome-extension:` などをリンクにしても受け手には壊れたリンクになるだけ。`removeUnsafeMarkdownUrls` の既存方針と基準を揃える |
| 8 | `copyContentToClipboard` の第2引数にヘッダ断片を追加する | 本文が空のときにヘッダだけの HTML を書かない現行の `canWriteHtml` ガード（3.1.4 の変更 3）を維持するため。`roots` に混ぜると本文の有無を判別できない |
| 9 | 本文が空なら、テキストもヘッダのみになる | 呼び出し側に分岐を増やさない。描画前の短い窓ではタイトルと URL だけがコピーされる（現行は空文字）。壊れた HTML を書かない点は変わらない |
| 10 | ヘッダ要素に `dir="auto"` を付ける | 2.4.3 の仕様どおりラッパーがヘッダを走査せず、従来と同じ本文基準の解決になる。Gemini版が実機でこのリスクを再現して採用した対策 |
| 11 | i18n キーは追加しない | ヘッダはタイトルと URL のみでラベル文字列を含まないため、15 ロケールの更新が不要 |
| 12 | 画面上の `#page-source` は変更しない | popup にはヘッダ表示自体が無く、結果ページはタイトルのみ。コピー内容は「文書のヘッダ」であり UI の複製ではない |
| 13 | Save の出力内容は変更しない | 既存利用者の `.txt` の中身を変えない。共通化するのはヘッダ組み立てのロジックのみ |
| 14 | `sourceFragment` の型ガードは入れない | 要素が渡された場合に「黙って無視する」動作になり、静かな劣化を検出できなくなる。呼び出し側 2 か所を同一変更で更新し、4.2 の書式確認で検証する |
| 15 | `isAllowedMarkdownUrl` を `isAllowedUrlProtocol` に改名する | ヘッダの URL にも同じ述語を使うため。ロジックは変更しない |

### 3.5 バージョン更新（任意・最終工程）

`extension/manifest.json` と `firefox/manifest.json` を 1.4.40 → 1.4.41 に更新する。
本計画の実装時点では更新せず、リリース時に別途行ってもよい。

---

## 4. 検証方法

### 4.1 静的検証

- `npm run lint` を実行し、エラーが出ないことを確認する
- 改名した `isAllowedMarkdownUrl` / `allowedMarkdownUrlProtocols` の参照漏れが無いことを
  grep で確認する（`extension/` 配下のみで使われている）
- `buildClipboardHtml` の参照漏れが無いことを grep で確認する
- 本ドキュメントは VS Code の markdownlint 診断を確認する
- ロケールファイルは変更しないため、i18n キーの整合確認は不要

### 4.2 手動検証

拡張機能を再読み込みし、結果ページは開き直してから検証する（旧ペイロードの混入を避ける）。
Word / Gmail の貼り付け結果は目視では判断しにくいため、
インデントや見出しの有無は Shift+F1（書式の詳細）で確認する。

| # | 手順 | 期待結果 |
| --- | --- | --- |
| 1 | 結果ページで要約を Copy し、Gmail の下書きに貼り付け | タイトル（太字）・URL（リンク）・本文の順に貼り付き、太字・番号付きリストなどの書式も保持される |
| 2 | 同じ内容を Google ドキュメント / Word に貼り付け | 同上。タイトルが本文より極端に大きくならない（太字段落であることの確認） |
| 3 | 同じ内容をテキストエディターに貼り付け | 1 行目にタイトル、2 行目に URL、3 行目が空行、以降が Markdown 原文 |
| 4 | 結果ページで Save し、変更前の `.txt` と比較 | 内容が同一（タイトル + URL + 空行 + 本文）。**回帰確認の主項目** |
| 5 | フォローアップ質問を 1 往復追加してから Copy | ヘッダは先頭に 1 回だけ入り、以降は 本文 → 質問 → 回答 の順 |
| 6 | popup で Copy し、popup の Save ファイルと比較 | 内容が一致する（タイトル + URL + 空行 + 本文） |
| 7 | popup で Copy し、Gmail の下書きに貼り付け | 太字・リンクが保持される。**`popup.js` の呼び出し側の更新漏れを検出できる確認**（テキスト比較の 6 では検出できない） |
| 8 | 結果が未描画の状態で Copy | プレーンテキストのみがコピーされ、HTML は書かれない。例外が出ない |
| 9 | クリップボード権限を拒否した状態で Copy | ステータスが空のままで、コンソールに `console.log` が出る（例外は投げない） |
| 10 | アラビア語など RTL のページを RTL 言語で要約して Copy | 貼り付け先で本文が右寄せ（RTL）のまま保たれる |
| 11 | `<title>` がラテン文字始まりで本文が RTL のページ（例: 英語ページを要約言語アラビア語で要約）を Copy | 本文が右寄せ（RTL）のまま保たれる。タイトルと URL は `dir="auto"` により左寄せになる（想定どおり）。**決定 10 の対策の確認項目** |
| 12 | 非 http(s)（`file://`）のページで Copy | URL 行はテキストで入り、リンクにはならない（決定 7） |
| 13 | 長いタイトル / 長い URL のページで Copy | 例外なくコピーでき、貼り付け先で折り返される |
| 14 | Firefox で 1・3・6・7 を実施 | 同じ結果（書式付きコピーとリンク化が Firefox でも成立する） |

検証の優先順位（実施時の目安）: 4（Save の回帰）→ 1・6（Copy の内容）→ 7（popup の取りこぼし検出）→
11（RTL 対策）。11 は条件が揃わない場合はローカル HTML で代替する
（`<title>` をラテン文字始まりにし、本文が RTL になるよう要約言語をアラビア語にする）。

### 4.3 実施記録

静的検証（4.1）: `npm run lint` はエラーなし。改名した `isAllowedMarkdownUrl` /
`allowedMarkdownUrlProtocols` と `buildClipboardHtml` の参照は残っていない（grep で確認）。
本ドキュメントは VS Code の markdownlint 診断でもエラーなし。
あわせて、実装した `buildSourceHeader` / `copyContentToClipboard` を jsdom で実行し、
ヘッダのテキスト・マークアップ・要素順、空入力（`""` / `null` / `undefined`）、非 http(s) URL、
タイトル内 HTML のリテラル扱い、`style` / `class` を付けないこと、元 DOM の不変性、
断片の非破壊性、空本文ガード、data URL 画像の除去まで **36/36** の確認が通ることを確かめた。
（Node 24 + 兄弟リポジトリの `jsdom` を借りた使い捨てスクリプトで、リポジトリには追加していない。）

手動検証は 4.2 の表に対応する。

| 日付 | # | 実施内容 | 結果 |
| --- | --- | --- | --- |
| 2026-09-23 | 1 | Gmail の下書きに貼り付け | OK。タイトル `Pricing - Claude Platform Docs` が本文と同程度の大きさの太字で先頭に入り、次行の URL が青・下線付きのリンクとして貼り付いた。以降に本文の段落（`Anthropicのモデルと機能の価格体系は…`）が続き、太字と番号付きリスト 1〜3 のインデントも保持された。順序はタイトル → URL → 本文で期待どおり（太字段落を採用した決定 4 の確認を兼ねる） |
| 2026-09-23 | 2 | Word に貼り付け | OK。タイトルは太字で本文と同程度の大きさに収まり、見出しスタイルは付かなかった（決定 4 のトレードオフとして想定どおり）。URL は青・下線付きのリンク。本文の太字と番号付きリスト 1〜3 のハンギングインデントも保持された。Google ドキュメントは未実施 |
| 2026-09-23 | 3 | テキストエディター（Mery）に貼り付け | OK。1 行目にタイトル、2 行目に URL、3 行目が空行、4 行目以降に `**` 記法と `1.` `2.` `3.` の Markdown 原文。プレーンテキスト（`text/plain`）がそのまま使われ、Save の `.txt` と同じ並び |
| 2026-09-23 | 4 | 結果ページで Save した `.txt` | OK（**回帰確認の主項目**）。`claude-results_2026-09-23_10-51-18.txt` の内容はタイトル → URL → 空行 → 本文（Markdown 原文）で、#3 のテキスト貼り付けと完全に一致。`buildSourceHeader` は旧実装の `headerLines.join("\n") + "\n\n"` と同形の文字列を返すため、保存内容に変化はない |
| 2026-09-23 | 5 | フォローアップ質問を 1 往復追加してから Copy → Word に貼り付け | OK。ヘッダ（タイトル + URL）は先頭に 1 回だけで、以降は 本文 → 質問 `Opus は値下げされましたか？` → 回答（箇条書き 4 項目を含む）の順。質問ブロックの装飾（背景色・角丸）は貼り付け先に拡張機能のスタイルシートが無いため付かないが、これは決定 5 および第2回の #1 で想定したとおりで、区切りは段落で読み取れる |
| 2026-09-23 | 6 | popup で Copy → popup の Save ファイルと比較 | OK。`claude-results_2026-09-23_11-08-55.txt` はタイトル → URL → 空行 → 本文（Markdown 原文）で、#4 の結果ページの Save と同一の並び。popup の Copy のプレーンテキストも同じ組み立て（3.2 のとおり共通実装で、残る差分は `pageTitle` / `pageUrl` と `result.title` / `result.url` の値のみ） |
| 2026-09-23 | 7 | popup で Copy → リッチ貼り付け | OK（**リスク 1 の検出項目**、貼り付け先は Gmail ではなく Word で代替）。ヘッダが先頭に入り、タイトルが太字、URL が青・下線付きのリンク、本文の太字と番号付きリスト 1〜3 も保持された。ヘッダが入り、かつ HTML が書かれている（書式が生きている）ことから、`popup.js` の呼び出し側も更新済みで**更新漏れは発生していない** |
| 2026-09-23 | 8 | 結果が未描画の状態で Copy | OK。結果ページの結果を「本文が空の `result`」に差し替えて再現した（手順は下記）。`write()` は呼ばれず `writeText()` のみが呼ばれ、例外もなく「コピーしました」が表示された。コピーされたテキストは `"Empty body test\nhttps://example.com/\n\n\n\n"` で、決定 9 のとおりヘッダのみ（本文が空でも付く `\n\n` の分だけ末尾の空行が増えるが、Gemini版と同一の挙動） |
| 2026-09-23 | 9 | 書き込み権限を拒否した状態で Copy（結果ページ） | OK。`navigator.clipboard.write` / `writeText` を `NotAllowedError` で拒否するよう上書きして Copy を実行した。`Failed to copy HTML content. Falling back to plain text: NotAllowedError: Write permission denied.`（`utils.js` の `catch`、`console.log`）に続けて `Failed to copy content: NotAllowedError: Write permission denied.`（`results.js` の `catch`、`console.log`）が出力され、ステータスは空のまま、未処理の Promise 拒否も出なかった。リッチ経路の失敗は内部でフォールバックされ、最終的な `writeText` まで失敗したときだけ呼び出し元へ伝わることを確認 |
| 2026-09-23 | 10 | アラビア語版 Wikipedia をアラビア語で要約して Copy → Gmail | OK。ヘッダ（タイトル `جوجل - ويكيبيديا` + URL）が先頭に入り、本文と番号付きリストは右寄せ（RTL）のまま保たれた。タイトルも右寄せ。URL 行のみ左寄せになるが、決定 10 の `dir="auto"` により URL がラテン文字で LTR に解決されるため想定どおり |
| 2026-09-23 | 11 | 英語ページ（`https://en.wikipedia.org/wiki/Google`）を要約言語アラビア語で要約して Copy → Gmail | OK（**決定 10 の確認項目**）。`<title>` が `Google - Wikipedia` とラテン文字始まり、本文がアラビア語（RTL）という 2 条件が揃った状態で、**本文と番号付きリストは右寄せ（RTL）のまま保たれた**。ブロック全体が LTR に反転していないため、ヘッダ要素の `dir="auto"` によりラッパーがヘッダを走査せず、本文で方向を解決していることが確認できた。タイトルと URL は `dir="auto"` により左寄せ（想定どおり、決定 10。Gemini版 決定 16） |
| 2026-09-23 | 12 | 非 http(s)（`file://`）のページで Copy → Gmail | OK（決定 7）。URL 行は青・下線にならず**プレーンテキストとして貼り付いた**。テキストとしては URL が残るため出典情報は失われない。#13 と同じページで同時に確認した |
| 2026-09-23 | 13 | 長いタイトル / 長い URL のページで Copy → Gmail | OK。タイトルは 7 行、URL は 5 行に折り返され、例外なく一つのメッセージとして貼り付いた。貼り付け先のレイアウトを壊しておらず、折り返しの見た目は許容範囲内 |
| 2026-09-23 | 14 | Firefox で結果ページの Copy → Gmail / テキストエディターに貼り付け | OK。**Gmail（リッチ）**: タイトルが太字、URL が青・下線付きのリンク、本文の太字（`GPT-6 Sol` / `GPT-6 Luna` / `性能を高めた` / `API料金を50%引き下げた`）と番号付きリストの構造も保持された。**テキストエディター（Mery）**: 1 行目にタイトル、2 行目に URL、3 行目が空行、4 行目以降に `**` 記法と `1.` `2.` `3.` の Markdown 原文。同じクリップボードから 2 通りの表現が取り出せており、書式付きコピー・リンク化・プレーンテキスト貼り付けのすべてが Firefox でも成立することを確認した。確認したのは 4.2 の 1・3 相当で、popup 側（6・7 相当）と Android Firefox は未実施 |

表の補足を以下に示す。

#### #8 の再現手順（結果ページの DevTools Console）

```javascript
// 1. 本文が空の結果を書き込んでからリロードする
const i = new URLSearchParams(location.search).get("i");
await chrome.storage.session.set({
  [`result_${i}`]: { title: "Empty body test", url: "https://example.com/", responseContent: "" }
});
await chrome.storage.session.remove(`conversation_${i}`);
location.reload();

// 2. リロード後にフックを仕込んでから Copy を 1 回押す
for (const name of ["write", "writeText"]) {
  const original = navigator.clipboard[name].bind(navigator.clipboard);
  Object.defineProperty(navigator.clipboard, name, {
    configurable: true,
    value: (...args) => {
      console.log(`${name}() called`, args, new Error().stack);
      return original(...args);
    }
  });
}
```

結果待ちの期間は `setResultControlsEnabled(false)` で Copy が無効化されるため（`results.js` 97〜104行）、
「`result` はあるが本文が空」という状態を人為的に作っている。
popup 側は `#run` を押すまで `setPopupControlsEnabled(false)` が呼ばれないため、
**Run を押さずに Copy** すれば同じガードを通せる。

呼び出し回数の確認: 観測フックで `writeText()` が 2 回記録された事例があったが、
スタックトレース付きで再測定し、**1 クリックにつき 1 回**だけ呼ばれることを確認した。
呼び出し連鎖は `copyContent`（`results.js` 173行）→ `copyContentToClipboard`（`utils.js` 286行）
→ `writeText()` の単一経路で、ラッパーの入れ子も無い。先の 2 回は Copy の複数回クリックによるもの。

#### #9 の再現方法

ブラウザーの設定（`chrome://settings` のクリップボード）ではなく、結果ページの DevTools Console で
書き込み系を上書きして再現した。拡張機能ページは Site settings の対象になりにくく、
`manifest.json` も `clipboardWrite` を宣言していないため、設定 UI での再現は確実でない。
また `navigator.clipboard.writeText()` は document が非フォーカスのだけでも失敗するため、
エラー経路の確認には上書きのほうが適している。

```javascript
for (const name of ["write", "writeText"]) {
  Object.defineProperty(navigator.clipboard, name, {
    configurable: true,
    value: () => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError"))
  });
}
```

#### 観察: 強調として成立せず `**` が残るケース

**#10** の出力で、本文に `**` がリテラルで残っていた（`**جوجل شركة **تكنولوجيا …` の形。利用者が確認済み）。
実際の `convertMarkdownToHtml`（vendored の `marked` + `DOMPurify`）で成立・不成立の境界を確かめた。

| 入力の形 | 結果 |
| --- | --- |
| `**جوجل شركة تكنولوجيا.**`（開き・閉じとも妥当） | `<strong>` になる |
| `**جوجل شركة **تكنولوجيا`（**閉じ側の直前に空白**） | **`**` がリテラルで残る** |
| `料金を**50%**引き下げた。`（**閉じ側の直前が句読点で、直後が句読点・空白でない**） | **`**` がリテラルで残る** |
| `** جوجل شركة** …`（開き側の直後に空白） | `**` がリテラルで残る |

CommonMark の flanking 規則により、強調として成立しない形がそのまま残るためである。
`fixEmphasis` の CJK 修正は「CJK 文字・括弧に隣接する `**`」だけを対象とするため、これらの形は救えない。

同じ入力に対する出力は **Claude版と Gemini版で完全に一致**し、
`convertMarkdownToHtml` は本移植で変更していない（`utils.js` の差分はヘッダ生成と断片の組み立てのみ）ため、
**退行ではなく Gemini版と共通の既存挙動**である（第7章にも記載）。

#### #12・#13 の補足

どちらもローカル HTML（`file:///C:/Users/taira/Downloads/long.html#long-…`）で確認した。
そのページの本文は「タイトル」「本文」というプレースホルダーだけだったため、要約本文は
モデルからの追加情報要求（`## 申し訳ございません` 以下の説明）になったが、
ヘッダ（タイトル + URL）の検証には影響しない。この本文見出しは本文側の `<h2>` であり、
ヘッダのタイトルを太字段落にした決定 4 とは別のもの。

#### #3・#14 の補足（テキストエディターに `**` が見える理由）

テキストエディターに `**` が見えるのは、`text/plain` に **Markdown 原文をそのまま入れて
いるため**で期待どおりである（#3 と同じ）。同じクリップボードから `text/html` を取り出した
Gmail では、`**` の代わりに太字が付いている。

実施した Copy の経路: #1〜#5・#8〜#14 は結果ページ（#14 は Firefox）、#6・#7 は
Chrome の popup の Copy を使用した。

残りの検証項目: なし（4.2 の 14 項目はそれぞれ 1 回以上実施）。
ただし #2 の Google ドキュメント、#14 の popup 側（6・7 相当）と Android Firefox は未実施
（各項目の行を参照）。

---

## 5. コミット分割案

Gemini版 `b3277dd` は 1 コミットだが、Claude版では「新機能」と「付随する品質修正」を
分けて記録する案を提示する。実際の分割・メッセージ・時期はユーザーが決定する
（`AGENTS.md` の Git commits 規約）。

1. `refactor(clipboard): rename URL protocol helpers`（任意）
   - `extension/utils.js`（`isAllowedUrlProtocol` / `allowedUrlProtocols` への改名のみ）
2. `feat(clipboard): add source headers to copied content`
   - `extension/utils.js` / `extension/popup.js` / `extension/results.js`
3. `docs: add quality improvement porting plan for 2026-09-23`
   - `docs/archive/PORT_QUALITY_PLAN_2026-09-23.md`
4. （任意）`chore: bump extension version to 1.4.41`
   - `extension/manifest.json` / `firefox/manifest.json`

1 と 2 は同一コミットにまとめてもよい（Gemini版は 1 コミット）。
本ドキュメントは 2026-09-23 に `docs/archive/` へ移動済み（`AGENTS.md` の Notes 規約）。
本ドキュメントを参照している既存の文書は無いため、あわせて更新した参照元も無い。

---

## 6. リスクと注意点

| # | リスク | 影響 | 対策 |
| --- | --- | --- | --- |
| 1 | 署名変更（第2引数）の更新漏れ | 静かな劣化。popup の旧形式は本文が空扱いになり HTML が書かれず（書式・リンクが失われ、テキストは同じに見える）、results の旧形式は `#content` がヘッダ枠に入り、ヘッダを含まない HTML が書かれる | 自動テストが無いため 4.2 の 7（popup の書式確認）と 1・6 で確認する。型ガードは決定 14 のとおり入れない |
| 2 | ヘッダ追加による RTL 本文の LTR 化 | アラビア語などの貼り付けで本文が左寄せに崩れる | ヘッダ要素に `dir="auto"` を付与（決定 10）。4.2 の 10・11 で確認する |
| 3 | タイトルが貼り付け先で大きすぎる | 見た目 | 太字段落（`<p><strong>`）を採用（決定 4）。4.2 の 2 で確認する。見出しスタイルは失われるのがトレードオフ |
| 4 | 描画前に Copy するとヘッダのみのテキストになる | 微小 | 空 HTML を書かないガードを維持する。現行（空文字）からの差異として許容する（決定 9） |
| 5 | `locale` の変更が無いことの確認 | — | ヘッダにラベル文字列を含めないため 15 ロケールの更新が不要（決定 11） |
| 6 | 貼り付け先で URL 行だけ左寄せになる（RTL ページ） | 見た目 | 各行が自分の内容に合った方向になるのは `dir=auto` の意味どおり（Gemini版も許容と判断）。過剰な対策はしない |
| 7 | `manifest.json` の権限追加 | — | 不要。Clipboard API は既存権限の範囲で動作する |
| 8 | Firefox 127 以前で書式が失われる | 軽微 | 既存の `canWriteHtml` 判定と `writeText` フォールバックで吸収する（第2回から変更なし） |

---

## 7. スコープ外・将来の検討

- 結果ページの `#page-source` に URL を表示する（画面とコピー内容の一致）
- タイトル / URL を含めるかどうかの設定化（options UI と 15 ロケール分のキー追加が必要）
- `.md` / `.html` 形式での保存
- コピー内容のプレビュー UI
- **強調として成立しない `**` がリテラルで残るケース**（4.3 の #10 で確認）
  — 閉じ側の直前に空白がある形（`**جوجل شركة **تكنولوجيا …`）や、閉じ側の直前が句読点で直後が
  句読点・空白でない形（`料金を**50%**引き下げた。`）では、CommonMark の flanking 規則により
  強調にならず `**` がそのまま残る。`fixEmphasis` の CJK 修正は対象外のため救えない。
  Claude版と Gemini版で出力は一致し、共通の既存挙動である。
  修正するなら「閉じ側の直前の空白を除去する」などの正規化を CJK 修正と同じ層に追加する形が候補。
  ただしモデル出力の揺れにどこまで寄り添うかは別途判断が必要
- Gemini版のテスト（`test/`）と e2e（`e2e/`）基盤の導入 — 導入できればリスク 1 を
  自動検出できるようになるため、別途検討する価値がある

---

## 8. ロールバック

変更は `extension/utils.js` / `extension/popup.js` / `extension/results.js` と本ドキュメントに
限られる。マニフェスト・ロケール・保存形式・権限には触れないため、`git revert` で
「Copy が本文のみ」の状態へ戻せる。
