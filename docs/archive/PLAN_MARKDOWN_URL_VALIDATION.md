# Markdown URLプロトコルバリデーション実装計画

本ドキュメントは `extension-summarize-translate-claude`（Claude版）に対し、
`extension-summarize-translate-gemini`（Gemini版）で実装された **Markdown URLプロトコルバリデーション** を移植するための実装計画です。

前提:

- **セキュリティ対応のみ** を目的とし、機能追加は行わない
- Gemini版の `069ed30` コミットで追加されたXSS対策を Claude版の `extension/utils.js` に適用する
- Claude版ではリンク無効化ロジックが既に存在するため、その整合性を取りながらURLバリデーションを追加する

参考リポジトリ:

- Claude版: `/home/taira/nfs/git/extension-summarize-translate-claude`
- Gemini版: `/home/taira/nfs/git/extension-summarize-translate-gemini`

---

## 1. 目的とスコープ

### 目的

LLMが生成したMarkdownテキストに含まれるURLが `javascript:` や `data:` 等の危険なプロトコルを持つ場合、
`DOMPurify.sanitize()` だけでは不十分なケースがあるため、
明示的に `http:` / `https:` のみを許可するURLプロトコルバリデーションを追加し、XSS攻撃を防止する。

### スコープ外

- リンクの有効化/無効化の切り替え機能（Gemini版の `links` パラメータ）
- 新規タブでのリンクオープン属性（`target="_blank" rel="noopener noreferrer"`）の追加
- その他のMarkdownレンダリング改善

### 変更対象ファイル

| ファイル | 変更内容 |
| --- | --- |
| `extension/utils.js` | URLプロトコルバリデーション関数を追加し、`convertMarkdownToHtml` 内で適用 |

---

## 2. 現状分析

### 2.1 Claude版の現状

`extension/utils.js` の `convertMarkdownToHtml` 関数（68行目〜）:

```javascript
export const convertMarkdownToHtml = (content, breaks) => {
  // Disable links when converting from Markdown to HTML
  marked.use({ renderer: { link: ({ text }) => text } });

  const markdownDiv = document.createElement("div");
  markdownDiv.textContent = content;
  const htmlDiv = document.createElement("div");
  htmlDiv.innerHTML = DOMPurify.sanitize(marked.parse(markdownDiv.innerHTML, { breaks: breaks }));

  // Replace the HTML entities with the original characters in the code blocks
  htmlDiv.querySelectorAll("code").forEach(codeBlock => {
    codeBlock.innerHTML = codeBlock.innerHTML
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");
  });

  return htmlDiv.innerHTML;
};
```

**問題点:**

1. **リンク無効化は `marked` のレンダラー設定のみ**: `marked.use({ renderer: { link: ({ text }) => text } })` でリンクはテキスト化されるが、**画像（`img` タグ）は無効化されていない**
2. **多層防御の欠如**: DOMPurifyはデフォルトで `javascript:` を `href`/`src` から除去するが、将来のバイパスや設定変更に備え、URLプロトコルを明示的に検証する層がない
3. **`data:` URLの扱い**: DOMPurifyは `img[src]` の `data:` URLを許可する設定があり得るため、明示的な除外が必要

### 2.2 Gemini版の実装

Gemini版では以下の3つの関数が追加されている:

```javascript
const allowedMarkdownUrlProtocols = new Set(["http:", "https:"]);

const isAllowedMarkdownUrl = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  try {
    const url = new URL(trimmedValue);
    return allowedMarkdownUrlProtocols.has(url.protocol);
  } catch {
    return false;
  }
};

const removeUnsafeMarkdownUrls = (container) => {
  container.querySelectorAll("a[href], img[src]").forEach((element) => {
    const attributeName = element.tagName === "A" ? "href" : "src";
    const attributeValue = element.getAttribute(attributeName);

    if (!isAllowedMarkdownUrl(attributeValue)) {
      element.removeAttribute(attributeName);
    }
  });
};
```

そして `convertMarkdownToHtml` 内で `DOMPurify.sanitize()` の直後に `removeUnsafeMarkdownUrls(htmlDiv)` を呼び出している。

---

## 3. 実装内容

### 3.1 追加する関数

`extension/utils.js` の `UI helpers` セクションに以下を追加:

```javascript
const allowedMarkdownUrlProtocols = new Set(["http:", "https:"]);

const isAllowedMarkdownUrl = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  try {
    const url = new URL(trimmedValue);
    return allowedMarkdownUrlProtocols.has(url.protocol);
  } catch {
    return false;
  }
};

const removeUnsafeMarkdownUrls = (container) => {
  container.querySelectorAll("a[href], img[src]").forEach((element) => {
    const attributeName = element.tagName === "A" ? "href" : "src";
    const attributeValue = element.getAttribute(attributeName);

    if (!isAllowedMarkdownUrl(attributeValue)) {
      element.removeAttribute(attributeName);
    }
  });
};
```

**配置場所の検討:**

- `allowedMarkdownUrlProtocols` と `isAllowedMarkdownUrl` は **Pure utilities** に分類可能（副作用なし、引数のみに依存）
- `removeUnsafeMarkdownUrls` はDOM操作を行うため **UI helpers** に分類すべき
- ただし、これらは密接に関連しているため、同一セクションにまとめて配置することも検討

**推奨配置:** `convertMarkdownToHtml` の直前に配置（`UI helpers` セクション内）

### 3.2 `convertMarkdownToHtml` の修正

```javascript
export const convertMarkdownToHtml = (content, breaks) => {
  // Disable links when converting from Markdown to HTML
  marked.use({ renderer: { link: ({ text }) => text } });

  const markdownDiv = document.createElement("div");
  markdownDiv.textContent = content;
  const htmlDiv = document.createElement("div");
  htmlDiv.innerHTML = DOMPurify.sanitize(marked.parse(markdownDiv.innerHTML, { breaks: breaks }));

  removeUnsafeMarkdownUrls(htmlDiv);  // ← 追加

  // Replace the HTML entities with the original characters in the code blocks
  htmlDiv.querySelectorAll("code").forEach(codeBlock => {
    codeBlock.innerHTML = codeBlock.innerHTML
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");
  });

  return htmlDiv.innerHTML;
};
```

**変更点:**

- `DOMPurify.sanitize()` の直後に `removeUnsafeMarkdownUrls(htmlDiv)` を追加
- これにより、DOMPurifyを通過した後でも危険なURLを持つ `a[href]` と `img[src]` の属性が除去される

---

## 4. セキュリティ上の考慮事項

### 4.1 防御対象

| 脅威 | 対策 |
| --- | --- |
| `javascript:` プロトコルによるXSS | `http:` / `https:` のみ許可 |
| `data:` URLによるXSS（SVG等） | `http:` / `https:` のみ許可 |
| `file:` / `ftp:` 等のローカルファイルアクセス | `http:` / `https:` のみ許可 |
| 空文字列やnullによる予期しない動作 | 型チェックと空文字チェックで除外 |
| 相対URLの解釈による予期しない動作 | `new URL()` で絶対URLとして解釈、失敗時は除去 |

### 4.2 多層防御

```text
[入力] → [marked.parse] → [DOMPurify.sanitize] → [removeUnsafeMarkdownUrls] → [出力]
         (Markdown→HTML)   (既知の危険要素除去)      (プロトコル検証)
```

1. **marked**: MarkdownをHTMLに変換（この段階では危険なURLが含まれる可能性あり）
2. **DOMPurify**: 既知のXSSベクター（`<script>`, `onclick` 等）を除去
3. **removeUnsafeMarkdownUrls**: URLプロトコルを明示的に検証（DOMPurifyを通過したものを捕捉）

### 4.3 影響範囲

- **リンク**: Claude版では既に `marked` の設定でリンクがテキスト化されるため、`a[href]` の除去は**実質的に影響なし**
- **画像**: `img[src]` の除去は**有効**。LLMが生成したMarkdownに危険な画像URLが含まれる場合に防御可能

---

## 5. テスト計画

### 5.1 手動テスト項目

| # | 入力 | 期待結果 |
| --- | --- | --- |
| 1 | `[link](https://example.com)` | リンクはテキスト化される（現状維持） |
| 2 | `![img](https://example.com/image.png)` | 画像が表示される |
| 3 | `![img](javascript:alert(1))` | `src` 属性が除去され、画像が表示されない |
| 4 | `![img](data:image/svg+xml;base64,...)` | `src` 属性が除去され、画像が表示されない |
| 5 | `[link](javascript:alert(1))` | リンクはテキスト化される（現状維持） |
| 6 | 空のURL `![img]()` | `src` 属性が除去される |

### 5.2 確認対象ページ

- ポップアップ (`popup.html`) の要約/翻訳結果表示
- 結果ページ (`results.html`) の要約/翻訳結果表示、フォローアップ会話表示

---

## 6. 実装手順

1. `extension/utils.js` の `convertMarkdownToHtml` 関数の直前に、URLバリデーション関連の3つの関数を追加
2. `convertMarkdownToHtml` 内の `DOMPurify.sanitize()` の直後に `removeUnsafeMarkdownUrls(htmlDiv)` を追加
3. `npm run lint` を実行し、エラーがないことを確認
4. 手動テストで上記テスト項目を確認

---

## 7. 完了条件

- [ ] `allowedMarkdownUrlProtocols`, `isAllowedMarkdownUrl`, `removeUnsafeMarkdownUrls` の3関数が追加されている
- [ ] `convertMarkdownToHtml` 内で `removeUnsafeMarkdownUrls` が呼び出されている
- [ ] `npm run lint` がエラーなく完了する
- [ ] 危険なプロトコルを持つ画像URLが除去されることを手動で確認

---

## 8. 備考

### Gemini版との差異

| 項目 | Gemini版 | Claude版（本計画） |
| --- | --- | --- |
| リンクの有効/無効切り替え | `links` パラメータで制御 | 常に無効（現状維持） |
| 新規タブでのリンクオープン | `target="_blank" rel="noopener noreferrer"` を追加 | 追加しない（機能追加のため） |
| リンクのプロトコル検証 | `a[href]` も検証 | `a[href]` も検証（ただし既にテキスト化済み） |

### 参考コミット

- Gemini版: `069ed30` — feat: implement URL protocol validation for markdown links and images
