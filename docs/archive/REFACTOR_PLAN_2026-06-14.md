# リファクタリング計画：Claude 版拡張機能の内部動作・構造の Gemini 版への同期

本ドキュメントは、`extension-summarize-translate-claude`（Claude 版）と、そのメインプロダクトである `extension-summarize-translate-gemini`（Gemini 版）との間における内部設計およびアーキテクチャの差異を分析し、ユーザー向けの追加機能を増やすことなく、内部動作を Gemini 版と同等に引き上げるための具体的なリファクタリング手順をまとめたものです。

---

## 1. 目的とスコープ

### 目的

1. **会話履歴の保持**: Gemini 版で実装された `results.js` におけるセッションストレージ（`chrome.storage.session`）を用いた会話履歴の保存機能を移植します。データ形式は Anthropic API のメッセージオブジェクト形式に適合させます。
2. **古いセッションのクリーンアップ**: ポップアップから新しい生成（要約・翻訳）を開始する際に、`popup.js` 側で該当インデックスの古い会話履歴キャッシュをクリアするようにします。
3. **コード品質と堅牢性の向上**:
   - 非同期操作（`chrome.storage`、クリップボード API、ファイルエクスポート）周辺に try-catch ブロックによるエラーハンドリングを追加し、エラー発生時の耐性を高めます。
   - `// ── Pure utilities...` のような視覚的なコメントセクションヘッダーを導入し、ファイルの構造を整理します。
   - `results.js` の非同期ロジックから DOM 操作（吹き出しの追加など）を分離し、`appendQuestionToUi` や `appendAnswerPlaceholderToUi` などの専用ヘルパー関数に抽出して可読性を向上させます。
4. **スタイルルールの同期**: コードフォーマットを Gemini 版と揃えるため、`@stylistic` ESLint プラグインを導入し、ルール定義を同期します。

### スコープ

- **ユーザー向け機能は追加しません**。以下の Gemini 版機能はあくまで参考とし、今回は移植しません。
  - カスタムアクション 3 種とコンテキストメニュー
  - OpenAI API プロバイダー対応
  - `renderLinks` / `autoSave` 設定
  - ユーザー指定モデル（`zz` / `userModelId`）
- **変更対象ファイル**:
  - `package.json`
  - `eslint.config.mjs`
  - `extension/popup.js`
  - `extension/results.js`
  - `extension/service-worker.js`（セクションコメントのみ）
  - `extension/utils.js`（セクションコメントのみ）
- **変更しないファイル**:
  - `extension/lib/**`（プロジェクトルールにより編集禁止）
  - `extension/manifest.json` / `firefox/manifest.json`（今回の内部リファクタリングでは更新不要）

---

## 2. ファイルごとの変更詳細と差分

### A. package.json & eslint.config.mjs

Gemini 版と同じスタイル要件（空行、クォーテーションの種類、コメント前後の空行など）を適用するため、`@stylistic/eslint-plugin` を追加し、ESLint の設定ファイルを更新します。

#### `package.json` の変更内容

```diff
  "devDependencies": {
    "@eslint/js": "^10.0.1",
+   "@stylistic/eslint-plugin": "^5.10.0",
-   "eslint": "^10.3.0",
+   "eslint": "^10.4.1",
    "globals": "^17.6.0"
  }
```

#### `eslint.config.mjs` の変更内容

```diff
 import globals from "globals";
 import pluginJs from "@eslint/js";
+import stylistic from "@stylistic/eslint-plugin";

 export default [
+  {
+    ignores: ["extension/lib/**"]
+  },
-  pluginJs.configs.recommended,
-  {
-    ignores: ["extension/lib/**"]
-  },
+  pluginJs.configs.recommended,
  {
    languageOptions: {
      globals: {
@@ -25,8 +28,24 @@ export default [
      }
    }
  },
  {
+    plugins: {
+      "@stylistic": stylistic
+    },
    rules: {
-      "quotes": ["error", "double", { "avoidEscape": true }],
-      "semi": ["error", "always"]
+      "@stylistic/quotes": ["error", "double", { "avoidEscape": true }],
+      "@stylistic/semi": ["error", "always"],
+      "@stylistic/padding-line-between-statements": [
+        "error",
+        { blankLine: "always", prev: "*", next: "block-like" },
+        { blankLine: "always", prev: "block-like", next: "*" }
+      ],
+      "@stylistic/lines-around-comment": [
+        "error",
+        {
+          beforeLineComment: true,
+          allowBlockStart: true,
+          allowObjectStart: true,
+          allowArrayStart: true,
+          allowClassStart: true
+        }
+      ]
    }
  }
 ];
```

#### スタイル修正の対応

新ルール追加後、`npm run lint` を実行すると既存コードに多数の空行関連違反が発生する可能性があります。これらは空白・改行・セミコロン・クォートに関するものに限定して機械的に修正し、Lint がパスする状態にします。ロジック変更は行いません。

---

### B. extension/popup.js

新しいメッセージ生成を開始する際、古い結果の削除と同時に会話履歴 `conversation_${resultIndex}` も破棄するように変更します。また、コードのセクション分けコメントを付与し、非同期処理を try-catch で保護します。

#### セクション構成

```javascript
// ── Pure utilities (no DOM access, no side effects) ────────────────────────
// getLoadingMessage

// ── Content script injection utilities ──────────────────────────────────────
// getSelectedText, getWholeText, getTranscript

// ── UI helpers ──────────────────────────────────────────────────────────────
// setPopupControlsEnabled

// ── Button action handlers ──────────────────────────────────────────────────
// copyContent, saveContent

// ── Core async logic ────────────────────────────────────────────────────────
// extractTaskInformation, main

// ── Event listeners ─────────────────────────────────────────────────────────
```

#### 変更点

1. **`getLoadingMessage` の配置**  
   現在ファイル下部にある `getLoadingMessage` を「Pure utilities」セクションに移動します。

2. **`copyContent` / `saveContent` のエラーハンドリング**

```javascript
const copyContent = async () => {
  try {
    const operationStatus = document.getElementById("operation-status");
    const clipboardContent = `${content.replace(/\n+$/, "")}\n\n`;

    await navigator.clipboard.writeText(clipboardContent);
    operationStatus.textContent = chrome.i18n.getMessage("popup_copied");
    setTimeout(() => operationStatus.textContent = "", 1000);
  } catch (error) {
    console.error("Failed to copy content:", error);
  }
};

const saveContent = async () => {
  try {
    const operationStatus = document.getElementById("operation-status");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    exportTextToFile(`${tab.url}\n\n${content}`);
    operationStatus.textContent = chrome.i18n.getMessage("popup_saved");
    setTimeout(() => operationStatus.textContent = "", 1000);
  } catch (error) {
    console.error("Failed to save content:", error);
  }
};
```

1. **`main()` 冒頭のクリーンアップ**  
   `result_${resultIndex}` に加えて `conversation_${resultIndex}` も削除します。`streamContent_${resultIndex}` は Gemini 版と一致させるため削除しません。

```javascript
// Clear stale result and conversation to prevent results.html from picking up old data
await chrome.storage.session.remove(`result_${resultIndex}`);
await chrome.storage.session.remove(`conversation_${resultIndex}`);
```

1. **イベントリスナーセクションの追加**  
   ファイル末尾のイベントリスナー登録を `// ── Event listeners` セクションにまとめます。

---

### C. extension/results.js

本リファクタリングの中心となるファイルです。会話データ構造を Anthropic API のメッセージオブジェクト形式 `[{ role: "user", content: ... }, { role: "assistant", content: ... }]` に変更し、セッションストレージへの読み書きを統合します。

#### 主な追加・変更機能

1. **`validateConversation(data)`**: 復元されたセッションデータが正しい構造（偶数配列で role が `user` / `assistant` に交互に並び、`content` が文字列であるか）をチェックします。
2. **`extractTextFromMessage(item)`**: メッセージオブジェクトからテキストコンテンツを安全に抽出します。
3. **`isSuccessfulResponse(response)`**: API からのレスポンスが成功しているか（`response.ok` かつ先頭の content ブロックに実際のテキストが含まれているか）を確認します。
4. **`appendQuestionToUi(question)`** / **`appendAnswerPlaceholderToUi()`**: 非同期ロジックから DOM 操作を完全に分離します。

#### 変更後の `results.js` 全体イメージ

```javascript
import {
  DEFAULT_LANGUAGE_MODEL,
  applyTheme,
  applyFontSize,
  loadTemplate,
  displayLoadingMessage,
  convertMarkdownToHtml,
  getModelId,
  generateContent,
  streamGenerateContent,
  getResponseContent,
  exportTextToFile
} from "./utils.js";

const RESULT_VIEW_STATUS = Object.freeze({
  IDLE: "idle",
  WAITING: "waiting",
  UNREAD: "unread"
});

const conversation = [];
let resultIndex = 0;
let result = {};
let resultViewStatus = RESULT_VIEW_STATUS.IDLE;

// ── Pure utilities (no DOM access, no side effects) ────────────────────────

const validateConversation = (data) => {
  if (!Array.isArray(data)) {
    return false;
  }

  // Ensure we have pairs of user and assistant entries
  if (data.length % 2 !== 0) {
    return false;
  }

  return data.every((item, index) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const expectedRole = index % 2 === 0 ? "user" : "assistant";
    return item.role === expectedRole && typeof item.content === "string";
  });
};

const extractTextFromMessage = (item) => {
  return item && typeof item.content === "string" ? item.content : "";
};

const isSuccessfulResponse = (response) => {
  if (!response || !response.ok) {
    return false;
  }

  const contentBlock = response.body?.content?.[0];
  return typeof contentBlock?.text === "string" && contentBlock.text.length > 0;
};

// ── Tab state & notification ────────────────────────────────────────────────

const isResultTabActive = () => document.visibilityState === "visible" && document.hasFocus();

const updateDocumentTitle = () => {
  const baseTitle = chrome.i18n.getMessage("results_title");

  if (resultViewStatus === RESULT_VIEW_STATUS.UNREAD) {
    document.title = `● ${baseTitle}`;
  } else if (resultViewStatus === RESULT_VIEW_STATUS.WAITING) {
    document.title = `… ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
};

const syncAttentionCue = () => {
  if (resultViewStatus === RESULT_VIEW_STATUS.UNREAD && isResultTabActive()) {
    resultViewStatus = RESULT_VIEW_STATUS.IDLE;
  }

  updateDocumentTitle();
};

const beginWaitingForResult = () => {
  resultViewStatus = RESULT_VIEW_STATUS.WAITING;
  updateDocumentTitle();
};

const completeWaitingForResult = () => {
  resultViewStatus = isResultTabActive() ? RESULT_VIEW_STATUS.IDLE : RESULT_VIEW_STATUS.UNREAD;
  updateDocumentTitle();
};

// ── UI helpers ──────────────────────────────────────────────────────────────

const appendQuestionToUi = (question) => {
  const formattedQuestionDiv = document.createElement("div");
  formattedQuestionDiv.style.backgroundColor = "var(--nc-bg-3)";
  formattedQuestionDiv.style.borderRadius = "1rem";
  formattedQuestionDiv.style.margin = "1.5rem";
  formattedQuestionDiv.style.padding = "1rem 1rem .1rem";
  formattedQuestionDiv.innerHTML = convertMarkdownToHtml(question, true);
  document.getElementById("conversation").appendChild(formattedQuestionDiv);
};

const appendAnswerPlaceholderToUi = () => {
  const formattedAnswerDiv = document.createElement("div");
  document.getElementById("conversation").appendChild(formattedAnswerDiv);
  return formattedAnswerDiv;
};

const setResultControlsEnabled = (enabled) => {
  document.getElementById("clear").disabled = !enabled;
  document.getElementById("copy").disabled = !enabled;
  document.getElementById("save").disabled = !enabled;
  document.getElementById("text").readOnly = !enabled;
  document.getElementById("languageModel").disabled = !enabled;
  document.getElementById("send").disabled = !enabled;
};

// ── Button action handlers ──────────────────────────────────────────────────

const clearConversation = async () => {
  document.getElementById("conversation").replaceChildren();
  conversation.length = 0;

  try {
    await chrome.storage.session.remove(`conversation_${resultIndex}`);
  } catch (error) {
    console.error("Failed to remove conversation from session storage:", error);
  }
};

const copyContent = async () => {
  try {
    const operationStatus = document.getElementById("operation-status");
    let clipboardContent = `${result.responseContent.replace(/\n+$/, "")}\n\n`;

    for (const item of conversation) {
      const text = extractTextFromMessage(item);

      if (text) {
        clipboardContent += `${text.replace(/\n+$/, "")}\n\n`;
      }
    }

    await navigator.clipboard.writeText(clipboardContent);
    operationStatus.textContent = chrome.i18n.getMessage("results_copied");
    setTimeout(() => operationStatus.textContent = "", 1000);
  } catch (error) {
    console.error("Failed to copy content:", error);
  }
};

const saveContent = () => {
  try {
    const operationStatus = document.getElementById("operation-status");
    let content = `${result.responseContent.replace(/\n+$/, "")}\n\n`;

    for (const item of conversation) {
      const text = extractTextFromMessage(item);

      if (text) {
        content += `${text.replace(/\n+$/, "")}\n\n`;
      }
    }

    exportTextToFile(`${result.url}\n\n${content}`);
    operationStatus.textContent = chrome.i18n.getMessage("results_saved");
    setTimeout(() => operationStatus.textContent = "", 1000);
  } catch (error) {
    console.error("Failed to save content:", error);
  }
};

// ── Core async logic ────────────────────────────────────────────────────────

const askQuestion = async () => {
  const question = document.getElementById("text").value.trim();

  if (!question) {
    return;
  }

  setResultControlsEnabled(false);
  let displayIntervalId = setInterval(displayLoadingMessage, 500, "send-status", chrome.i18n.getMessage("results_waiting_response"));

  appendQuestionToUi(question);
  document.getElementById("text").value = "";

  const formattedAnswerDiv = appendAnswerPlaceholderToUi();
  window.scrollTo(0, document.body.scrollHeight);

  let answer;
  let streamIntervalId = null;

  try {
    const { apiKey, streaming } = await chrome.storage.local.get({ apiKey: "", streaming: false });
    const languageModel = document.getElementById("languageModel").value;
    const modelId = getModelId(languageModel);

    // Prepare the first question and answer
    const apiContents = [];
    apiContents.push(result.requestApiContent);
    apiContents.push({ role: "assistant", content: result.responseContent });

    // Add the previous questions and answers to the conversation
    apiContents.push(...conversation);

    // Add the new question to the conversation
    apiContents.push({ role: "user", content: question });

    let response;

    if (streaming) {
      const streamKey = `streamContent_${resultIndex}`;
      const responsePromise = streamGenerateContent(apiKey, result.requestSystemPrompt, apiContents, modelId, streamKey);

      console.log("Request:", { apiContents, modelId, streamKey });

      streamIntervalId = setInterval(async () => {
        const streamContent = (await chrome.storage.session.get({ [streamKey]: "" }))[streamKey];

        if (streamContent) {
          formattedAnswerDiv.innerHTML = convertMarkdownToHtml(streamContent, false);
        }
      }, 1000);

      response = await responsePromise;
      clearInterval(streamIntervalId);
      streamIntervalId = null;
    } else {
      response = await generateContent(apiKey, result.requestSystemPrompt, apiContents, modelId);
    }

    console.log("Response:", response);
    answer = getResponseContent(response, Boolean(apiKey));
    formattedAnswerDiv.innerHTML = convertMarkdownToHtml(answer, false);

    if (isSuccessfulResponse(response)) {
      conversation.push({ role: "user", content: question });
      conversation.push({ role: "assistant", content: answer });

      try {
        await chrome.storage.session.set({ [`conversation_${resultIndex}`]: conversation });
      } catch (storageError) {
        console.error("Failed to save conversation to session storage:", storageError);
      }
    } else {
      console.warn("API response was not successful:", response);
    }

  } catch (error) {
    console.error("Failed to generate content:", error);

    if (streamIntervalId) {
      clearInterval(streamIntervalId);
    }

    formattedAnswerDiv.textContent = chrome.i18n.getMessage("response_unexpected_response");
  } finally {
    clearInterval(displayIntervalId);
    document.getElementById("send-status").textContent = "";
    setResultControlsEnabled(true);
    window.scrollTo(0, document.body.scrollHeight);
  }
};

const waitForResult = async (resultIndex) => {
  const { streaming } = await chrome.storage.local.get({ streaming: false });
  const streamKey = `streamContent_${resultIndex}`;
  const resultKey = `result_${resultIndex}`;
  const contentElement = document.getElementById("content");

  // Keepalive: periodically ping the service worker to prevent termination
  const keepaliveIntervalId = setInterval(async () => {
    try {
      await chrome.runtime.sendMessage({ message: "keepalive" });
    } catch {
      // Ignore errors during keepalive ping
    }
  }, 20000);

  // Streaming poll: show intermediate content while waiting
  let streamIntervalId = null;

  if (streaming) {
    streamIntervalId = setInterval(async () => {
      const streamContent = (await chrome.storage.session.get({ [streamKey]: "" }))[streamKey];

      if (streamContent && contentElement) {
        contentElement.innerHTML = convertMarkdownToHtml(streamContent, false);
      }
    }, 1000);
  }

  // Result poll: wait for the final result
  const result = await new Promise((resolve) => {
    const check = async () => {
      const storedResult = (await chrome.storage.session.get({ [resultKey]: "" }))[resultKey];

      if (storedResult) {
        resolve(storedResult);
      } else {
        setTimeout(check, 500);
      }
    };

    check();
  });

  // Stop the keepalive and streaming intervals
  clearInterval(keepaliveIntervalId);
  clearInterval(streamIntervalId);

  return result;
};

const initialize = async () => {
  // Apply the theme
  applyTheme((await chrome.storage.local.get({ theme: "system" })).theme);

  // Apply font size
  applyFontSize((await chrome.storage.local.get({ fontSize: "medium" })).fontSize);

  // Load the language model template
  const languageModelTemplate = await loadTemplate("languageModelTemplate");
  document.getElementById("languageModelContainer").appendChild(languageModelTemplate);

  // Set the text direction of the body
  document.body.setAttribute("dir", chrome.i18n.getMessage("@@bidi_dir"));

  // Set the text of elements with the data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = chrome.i18n.getMessage(element.getAttribute("data-i18n"));
  });

  // Restore the language model from the local storage
  const { languageModel } = await chrome.storage.local.get({ languageModel: DEFAULT_LANGUAGE_MODEL });
  document.getElementById("languageModel").value = languageModel;

  // Set the default language model if the language model is not set
  if (!document.getElementById("languageModel").value) {
    document.getElementById("languageModel").value = DEFAULT_LANGUAGE_MODEL;
  }

  // Restore the content from the session storage
  const urlParams = new URLSearchParams(window.location.search);
  resultIndex = urlParams.get("i");

  const sessionData = await chrome.storage.session.get({
    [`result_${resultIndex}`]: "",
    [`conversation_${resultIndex}`]: []
  });

  result = sessionData[`result_${resultIndex}`];

  if (!result) {
    // Disable the buttons and input fields while waiting
    setResultControlsEnabled(false);
    beginWaitingForResult();

    // Display a loading message while waiting for the result
    const displayIntervalId = setInterval(displayLoadingMessage, 500, "send-status", chrome.i18n.getMessage("results_waiting_for_result"));

    // Wait for the result to be available in the session storage
    result = await waitForResult(resultIndex);
    completeWaitingForResult();

    // Stop displaying the loading message
    clearInterval(displayIntervalId);
    document.getElementById("send-status").textContent = "";

    // Re-enable the buttons and input fields
    setResultControlsEnabled(true);
  }

  // Convert the content from Markdown to HTML
  document.getElementById("content").innerHTML = convertMarkdownToHtml(result.responseContent, false);

  // Restore the conversation from session storage if it exists and is valid
  const savedConversation = sessionData[`conversation_${resultIndex}`];

  if (validateConversation(savedConversation)) {
    conversation.length = 0;
    conversation.push(...savedConversation);

    for (let i = 0; i < savedConversation.length; i += 2) {
      const questionText = extractTextFromMessage(savedConversation[i]);
      const answerText = extractTextFromMessage(savedConversation[i + 1]);

      if (questionText) {
        appendQuestionToUi(questionText);
      }

      if (answerText) {
        const answerPlaceholder = appendAnswerPlaceholderToUi();
        answerPlaceholder.innerHTML = convertMarkdownToHtml(answerText, false);
      }
    }
  }
};

// ── Event listeners ─────────────────────────────────────────────────────────

window.addEventListener("focus", syncAttentionCue);
document.addEventListener("visibilitychange", syncAttentionCue);
document.addEventListener("DOMContentLoaded", initialize);
document.getElementById("clear").addEventListener("click", clearConversation);
document.getElementById("copy").addEventListener("click", copyContent);
document.getElementById("save").addEventListener("click", saveContent);
document.getElementById("send").addEventListener("click", askQuestion);

document.getElementById("text").addEventListener("keydown", (e) => {
  if (e.isComposing || e.key === "Process") {
    return;
  }

  // Check if Ctrl (or Cmd) + Enter is pressed
  if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key === "NumpadEnter")) {
    e.preventDefault();

    if (!document.getElementById("send").disabled) {
      askQuestion();
    }
  }
});
```

#### 重要なポイント

- `conversation` 配列は Anthropic API 形式で保持されます。
- `askQuestion` 内で API レスポンスが成功した場合のみ `conversation` を更新し、セッションストレージに保存します。失敗時は UI にエラーメッセージを表示するだけで、履歴に追加しません。
- `finally` ブロックで `send-status` をクリアし、ローディング表示が残らないようにします。
- `convertMarkdownToHtml` は Claude 版で `renderLinks` 機能がないため、引数は `(content, breaks)` の 2 つのみとします。

---

### D. extension/service-worker.js & extension/utils.js

Gemini 版とファイル構造を揃えるため、以下のセクションコメントを追加します。ロジック変更は行いません。

#### `extension/service-worker.js`

```javascript
// ── Pure utilities (no DOM access, no side effects) ────────────────────────
// getSystemPrompt

// ── Core async logic ────────────────────────────────────────────────────────
// chrome.runtime.onMessage.addListener -> generate / keepalive
```

#### `extension/utils.js`

```javascript
// ── UI utilities ─────────────────────────────────────────────────────────
// applyTheme, applyFontSize, loadTemplate, displayLoadingMessage, convertMarkdownToHtml

// ── API utilities ─────────────────────────────────────────────────────────
// getModelId, generateContent, streamGenerateContent, getResponseContent

// ── File utilities ────────────────────────────────────────────────────────
// exportTextToFile
```

---

## 3. 検証および確認手順

1. `npm install` を実行し、`@stylistic` ESLint プラグインを含む開発依存関係を同期します。
2. `npm run lint` を実行して、コードスタイルに関するエラーが出ていないか確認し、必要に応じて修正します。
3. ローカルの Chrome ブラウザ等でパッケージ化されていない拡張機能として読み込み、動作確認を行います。
4. 会話履歴の保存・復元の検証項目：
   - 任意のページを要約します。
   - 「結果を表示」をクリックして `results.html` を開きます。
   - チャットで複数の追加質問・対話を行います。
   - `results.html` タブをリロードし、これまでの対話履歴が正しく復元され、デザイン崩れなく表示されるかを確認します。
   - 「クリア」ボタンをクリックし、セッションストレージ（`chrome.storage.session`）から会話履歴が削除されたことを確認します。
   - 再度ポップアップから新規に要約を実行した際、過去のインデックスの会話履歴が正常に破棄されていることを確認します。
5. エラーハンドリングの検証項目：
   - ネットワーク切断時や API エラー時に、コンソールに適切なエラーログが出力されることを確認します。
   - エラー発生後も `results.html` のコントロールが再有効化されることを確認します。

---

## 4. 今回あえて移植しない Gemini 版機能

ユーザー向け機能追加を避けるため、以下は今回の対象外とします。必要に応じて別途計画を立てて対応してください。

- カスタムアクション 3 種とコンテキストメニュー
- OpenAI API プロバイダー対応
- `renderLinks` / `autoSave` 設定
- ユーザー指定モデル（`zz` / `userModelId`）
