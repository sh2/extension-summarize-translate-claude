# 結果ページに元ページタイトルを表示する実装計画

## 背景・目的

現在の結果ページ（`extension/results.html`）には、どのページを要約・翻訳した結果なのかが表示されていません。複数のページを要約した場合、結果タブを切り替えたときに内容を特定するのが困難です。

この計画では、結果ページに元ページのタイトルを表示し、ブラウザのタブタイトル（`document.title`）にも反映させることを目的とします。

姉妹プロダクトである Gemini 版（`extension-summarize-translate-gemini`）で同等の機能が既に_shipされており、本計画はその_ship済み挙動（コミット `bec5e9c`）に合わせるものです。Gemini 版では計画段階で `results_source_page` という i18n ラベルの追加を検討していましたが、最終的に_shipしたコードではラベルを削除し、タイトル文のみを表示しています。本計画でもその方針に従います。

## 設計決定の要約

インタビューとコードベース調査により、以下の設計を決定しました。

| # | 項目 | 決定内容 |
| --- | --- | --- |
| 1 | ラベル表示 | なし。タイトル文のみ表示（`results_source_page` i18n キーは追加しない） |
| 2 | タイトル取得元 | `chrome.tabs.query` の `tab.title`（`extractTaskInformation` 内で既に取得済み） |
| 3 | 表示位置 | `#content`（要約本文）の直前 |
| 4 | ソース要素の構造 | `#content` の上に独立した `<p id="page-source">`（ラベル用 span は持たない） |
| 5 | リンク化 | しない（既存タブフォーカスには `tabs` 権限が必要なため、`activeTab` 権限の範囲内に留める） |
| 6 | タイトル未取得時 | ソース要素を非表示。`document.title` は `results_title` のまま |
| 7 | `document.title` の形式 | `${title} - ${results_title}`（`resultBaseTitle` モジュール変数で管理。`●`/`…` キューは `resultBaseTitle` ベースで維持） |
| 8 | ソース要素のスタイル | `color: var(--nc-tx-2)` + `opacity: 0.85`、`margin: 0 0 1rem 0`、`dir="auto"`。フォントサイズは変更しない |
| 9 | `Copy` への反映 | しない（現状維持） |
| 10 | `Save` への反映 | 含める。ファイル先頭に `title` 行→`url` 行→空行→本文（ラベルなし）。ポップアップの Save・結果ページの Save ともに |
| 11 | ストリーミング中の表示 | 本文は現行どおり逐次表示。タイトルは `result` オブジェクト取得後（完了後）に表示 |
| 12 | `autoSave` | Claude 版には存在しないため関連変更は不要 |
| 13 | i18n 変更 | なし（ラベルなしのため） |
| 14 | `manifest` 変更 | なし（権限追加・バージョン bump なし） |

## 変更ファイル一覧

1. `extension/popup.js`
2. `extension/service-worker.js`
3. `extension/results.html`
4. `extension/results.js`

変更しないファイル:

- `extension/_locales/*/messages.json`（ラベルを追加しないため）
- `extension/manifest.json` / `firefox/manifest.json`（権限追加・バージョン bump なし）
- `extension/popup.html`（ポップアップにはタイトル表示を追加しない。タイトルは結果ページの表示と保存ファイルのみ）
- `extension/css/common.css`（スタイルは `results.html` のインラインスタイルで定義）

## Claude 版特有の注意点

Gemini 版のコード例をそのまま転用できない箇所です。本計画のコード例はすべて Claude 版の構造に合わせてあります。

- `extractTaskInformation()` は引数を取らない（Gemini 版は `triggerAction` を受け取る）。
- 会話履歴のアイテム構造が `{ role, content }`（文字列）で、テキスト抽出は `extractTextFromMessage(item)` を使う（Gemini 版は `extractTextFromParts(item?.parts)`）。
- `result` / キャッシュオブジェクトは `requestMediaType` と `requestSystemPrompt` を持つ（結果ページのフォローアップ質問で使用）。`title` 追加時にこれらを取りこぼさないこと。
- `autoSave` 機能が存在しないため、Gemini 版の `didGenerate` フラグや `saveContent()` 呼び出しの try/catch ラッパなどは不要。
- ポップアップの `saveContent` は現状 `async` で `chrome.tabs.query` を呼んでいるが、`pageUrl` / `pageTitle` モジュール変数化により `await` が不要になるため `async` を外す。あわせて Gemini 版の_shipコード（`bec5e9c`）に合わせて try/catch も外す。元の try/catch が主に防いでいたのは `chrome.tabs.query` の reject（タブ消失時）だが、今回の変更でその呼び出し自体を削除するため防御対象が消滅する。残る可能性のある throw 要因は `result.responseContent` が未定義のときの `.replace`（セッションストレージ破損時）だが、これは `copyContent`（`results.js:137`）や Markdown 描画（`results.js:377`）と同じ既存リスクで本機能の持ち込みではなく、旧 try/catch も `console.error` のみでユーザー復帰処理はなかったため、外してもユーザー可視挙動は実質不変である。

## 詳細な実装手順

### 1. `extension/popup.js`

#### 1.1 モジュールレベル変数を追加

既存の `content` の近くに、ソースメタデータ用の変数を追加します。これにより `saveContent` が `chrome.tabs.query` を再呼び出しせずに済みます。

```js
let resultIndex = 0;
let content = "";
let pageUrl = "";
let pageTitle = "";
```

#### 1.2 `extractTaskInformation` で URL とタイトルを返す

既に `const [tab] = await chrome.tabs.query(...)` でタブ情報を取得しているため、`tab.url` と `tab.title` も返り値に追加します。

```js
return { actionType, mediaType, taskInput, url: tab.url, title: tab.title };
```

#### 1.3 `main` 内で重複する `chrome.tabs.query` を削除し、戻り値の `url` / `title` を使う

`main()` の先頭で `content` と一緒に `pageUrl` / `pageTitle` をリセットします。抽出処理が途中で例外になった場合に前回実行の古い値が残り、失敗後の手動 Save で誤ったヘッダが保存されるのを防ぎます。

```js
// Clear the content and source metadata
content = "";
pageUrl = "";
pageTitle = "";
```

`main()` 内の `const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });` は削除します（`tab` は `tab.url` のためにのみ使われており、`extractTaskInformation` 側で取得済みのため重複します）。

`extractTaskInformation()` の戻り値から `url` / `title` を取り出し、モジュール変数に保存します。

```js
const { actionType, mediaType, taskInput, url, title } = await extractTaskInformation();
pageUrl = url;
pageTitle = title;
```

#### 1.4 キャッシュヒット時の `result` オブジェクトに `title` を追加

Claude 版のキャッシュヒット時の `result` オブジェクトは `requestMediaType` と `requestSystemPrompt` を持つため、これらを保持したまま `title` を追加します。

```js
await chrome.storage.session.set({
  [`result_${resultIndex}`]: {
    requestMediaType,
    requestSystemPrompt,
    requestApiContent,
    responseContent: cachedResponseContent,
    url,
    title
  }
});
```

#### 1.5 サービスワーカーへのメッセージに `title` を追加

```js
const responsePromise = chrome.runtime.sendMessage({
  message: "generate",
  actionType,
  mediaType,
  taskInput,
  languageModel,
  languageCode,
  streamKey,
  resultIndex,
  url,
  title
});
```

同様に `console.log("Request:", { ... })` の内容にも `title` を追加します（任意だが、整合性のため推奨）。

#### 1.6 ポップアップの `saveContent` を修正

`chrome.tabs.query` を呼ばずモジュール変数 `pageUrl` / `pageTitle` を使うようにし、ファイル先頭にタイトルと URL のヘッダを付けます。`await` が不要になるため `async` を外し、Gemini 版の_shipコードに合わせて try/catch も外します。

```js
const saveContent = () => {
  const operationStatus = document.getElementById("operation-status");
  const headerLines = [];

  if (pageTitle) {
    headerLines.push(pageTitle);
  }

  if (pageUrl) {
    headerLines.push(pageUrl);
  }

  let fileContent = "";

  if (headerLines.length > 0) {
    fileContent += `${headerLines.join("\n")}\n\n`;
  }

  fileContent += `${content.replace(/\n+$/, "")}\n\n`;

  exportTextToFile(fileContent);
  operationStatus.textContent = chrome.i18n.getMessage("popup_saved");

  setTimeout(() => {
    operationStatus.textContent = "";
  }, 1000);
};
```

`Save` ボタンのリスナは `addEventListener("click", saveContent)` のままでよく、戻り値の Promise を待たない既存の呼び出し方と互換です。

### 2. `extension/service-worker.js`

#### 2.1 メッセージから `title` を受け取る

```js
const { actionType, mediaType, taskInput, languageModel, languageCode, streamKey, resultIndex, url, title } = request;
```

#### 2.2 保存する `result` オブジェクトに `title` を追加

`requestMediaType` / `requestSystemPrompt` を保持したまま `title` を追加します。

```js
await chrome.storage.session.set({
  [`result_${resultIndex}`]: {
    requestMediaType: mediaType,
    requestSystemPrompt: systemPrompt,
    requestApiContent: apiContent,
    responseContent: responseContent,
    url: url,
    title: title
  }
});
```

### 3. `extension/results.html`

`#content` の直前に、ソース表示用の要素を追加します。初期状態は非表示にしておき、JavaScript でタイトルが存在する場合に表示します。ラベル用の span は置かず、タイトル文のみを入れます。

```html
<p id="page-source" dir="auto" style="display: none; color: var(--nc-tx-2); opacity: 0.85; margin: 0 0 1rem 0;">
  <span id="page-source-title"></span>
</p>

<p id="content" dir="auto"></p>
```

`dir="auto"` により、RTL（右から左）言語のタイトルも適切に表示されます。

### 4. `extension/results.js`

#### 4.1 ページタイトル表示用の変数を追加

既存のモジュールレベル変数の近くに、以下を追加します。初期値を `results_title` としておくことで、結果取得前の待機状態でも `document.title` が空文字ベースにならず、現行の動作を維持できます。

```js
let resultBaseTitle = chrome.i18n.getMessage("results_title");
```

#### 4.2 `updateDocumentTitle` を修正

`chrome.i18n.getMessage("results_title")` を直接使うのではなく、`resultBaseTitle` を参照するようにします。

```js
const updateDocumentTitle = () => {
  if (resultViewStatus === RESULT_VIEW_STATUS.UNREAD) {
    document.title = `● ${resultBaseTitle}`;
  } else if (resultViewStatus === RESULT_VIEW_STATUS.WAITING) {
    document.title = `… ${resultBaseTitle}`;
  } else {
    document.title = resultBaseTitle;
  }
};
```

#### 4.3 `updatePageSource` を追加

ソース要素の表示制御を行う関数を、他の UI ヘルパーの近くに追加します。

```js
const updatePageSource = () => {
  const pageSourceElement = document.getElementById("page-source");
  const pageSourceTitleElement = document.getElementById("page-source-title");

  if (result.title) {
    pageSourceTitleElement.textContent = result.title;
    pageSourceElement.style.display = "block";
  } else {
    pageSourceTitleElement.textContent = "";
    pageSourceElement.style.display = "none";
  }
};
```

`textContent` を使用することで、タイトルに含まれる HTML タグがそのまま表示されるのを防ぎます。

#### 4.4 `saveContent` を修正

ファイル保存時に、タイトルと URL を先頭に含めます。Claude 版の会話アイテムは `{ role, content }` 構造で `extractTextFromMessage(item)` でテキストを抽出するため、Gemini 版の `extractTextFromParts` ではなくこちらを使います。ポップアップの `saveContent` と同様に、Gemini 版の_shipコードに合わせて try/catch を外します。

```js
const saveContent = () => {
  const operationStatus = document.getElementById("operation-status");
  const headerLines = [];

  if (result.title) {
    headerLines.push(result.title);
  }

  if (result.url) {
    headerLines.push(result.url);
  }

  let fileContent = "";

  if (headerLines.length > 0) {
    fileContent += `${headerLines.join("\n")}\n\n`;
  }

  fileContent += `${result.responseContent.replace(/\n+$/, "")}\n\n`;

  for (const item of conversation) {
    const text = extractTextFromMessage(item);

    if (text) {
      fileContent += `${text.replace(/\n+$/, "")}\n\n`;
    }
  }

  exportTextToFile(fileContent);
  operationStatus.textContent = chrome.i18n.getMessage("results_saved");

  setTimeout(() => {
    operationStatus.textContent = "";
  }, 1000);
};
```

`Copy` は変更しません（現状の `result.responseContent` + 会話履歴のまま）。

#### 4.5 `initialize` 内で `resultBaseTitle` を設定し、ソースを表示

`if (!result) { ... }` ブロックの後（結果が確定した直後）、かつ Markdown→HTML 変換の前に、以下を挿入します。

```js
const baseTitle = chrome.i18n.getMessage("results_title");
resultBaseTitle = result.title ? `${result.title} - ${baseTitle}` : baseTitle;
updateDocumentTitle();
updatePageSource();
```

`resultBaseTitle` は初期値として既に `results_title` が設定されているため、結果取得前の待機状態（`… Results - ...`）や未読状態（`● Results - ...`）では現行の動作が維持されます。結果取得後、タイトルが存在すれば「ページタイトル - Results - Summarize and Translate with Claude」の形式に更新されます。

## スタイル詳細

`#page-source` のスタイルは以下の通りです（`results.html` のインラインスタイル）。

- `display: none`（初期状態、タイトルがあれば JavaScript で `block` に変更）
- `color: var(--nc-tx-2)`（テーマに応じたやや薄いテキスト色）
- `opacity: 0.85`（さらに控えめに）
- `margin: 0 0 1rem 0`（本文との間隔）
- `dir="auto"`（RTL 言語対応）

フォントサイズは変更しません（ユーザー指定を尊重）。

## 動作確認項目

実装後、以下を確認します。

1. 通常のウェブページを要約・翻訳したとき、結果ページにタイトル文が表示される。
2. ブラウザのタブタイトルが「ページタイトル - Results - Summarize and Translate with Claude」の形式になる。
3. タイトルが取得できない場合（`result.title` が undefined / 空文字）、ソース表示が非表示になり、`document.title` は元のままになる。
4. ストリーミング時は本文が逐次表示され、タイトルは生成完了後に表示される。
5. 結果ページの `Save` ボタンで保存したファイルの先頭にタイトルと URL が含まれる（タイトル行→URL 行→空行→本文）。
6. ポップアップの `Save` ボタンで保存したファイルにもタイトルと URL が同じ形式で含まれる。
7. `Copy` ボタンの内容は変更前と同じ（タイトル・URL なし）。
8. キャッシュから復元した結果でも、現在のタブのタイトルが表示される（`popup.js` がリクエスト時に `title` を上書き保存するため）。
9. フォローアップ質問が従来どおり動作する（`requestMediaType` / `requestSystemPrompt` が取りこぼされていないこと）。
10. `npm run lint` がエラーなく通る。
11. キャッシュヒットで実行した（同じページ・同じ設定で2回目を実行した）状態でポップアップの `Save` を押すと、保存ファイルに現在のタブのタイトルと URL が含まれる（キャッシュの内容は前回のタイトルではなく現在のタブのものになる）。ポップアップの `Save` は一時的なモジュール変数 `pageTitle`/`pageUrl` に依存し、結果ページの `Save` は永続化済みの `result` オブジェクトに依存する別経路のため、キャッシュヒット経路を明示的に確認する。
12. **実行失敗後に前回のメタデータが Save に混入しない（stale metadata 回帰）**:
    1. 任意のページで要約を成功させ、`pageTitle`/`pageUrl` にタイトルA・URLAが設定された状態にする。
    2. コンテンツスクリプトの注入が失敗するページ（例: `chrome://` 系ページやスクリプト注入制限のある内部ページ）で再度実行し、抽出段階（`extractTaskInformation`、`popup.js` の `main` 内）で失敗させる。
    3. ポップアップの `Save` を押す。
    4. 保存ファイルの先頭に前回のタイトルA・URLAが混入しないことを確認する（`main` 冒頭のクリアによりヘッダなし、本文はエラーメッセージのみになる）。
13. **結果タブを背後に置いたまま生成完了させたときの `document.title` 状態遷移（`●`/`…` キュー維持）**:
    1. ポップアップから要約を実行し、結果リンクを開いて結果タブを表示する（生成中は `… Results - Summarize and Translate with Claude` が表示される）。
    2. 結果タブから別のタブへフォーカスを移し、結果タブを背後に置く。
    3. 生成が完了するのを待つ（結果タブは背景のまま）。`waitForResult`→`completeWaitingForResult` が `UNREAD` に遷移する。
    4. 結果タブの `document.title` が `● ページタイトル - Results - Summarize and Translate with Claude` になっていることを確認する（未読キュー `●` がページタイトル付きの `resultBaseTitle` で維持される）。
    5. 結果タブにフォーカスを戻すと `●` が消え、`ページタイトル - Results - Summarize and Translate with Claude` になることを確認する（`syncAttentionCue` による UNREAD→IDLE 遷移）。

## 注意事項・エッジケース

### 古いキャッシュ結果

セッションストレージに既存の `result_${index}` オブジェクト（`title` フィールドなし）が残っている場合、`result.title` が falsy となり、ソース表示は非表示になります。これは想定されたフォールバック動作です。

### `chrome://extensions/` などの内部ページ

`tab.title` は取得できますが、コンテンツスクリプトの注入や `captureVisibleTab` が制限されるため、要約・翻訳そのものが失敗する可能性があります。これは本機能とは別の既存の制約で、タイトル表示機能自体には影響しません。

### セキュリティ

`tab.title` は `textContent` を使って DOM に挿入します。これにより、タイトルに悪意のある HTML/JS が含まれていた場合でも、コードとして実行されることを防ぎます。

### 権限

本実装では既存の `activeTab` 権限の範囲内で `chrome.tabs.query` を使用して `tab.title` を取得します。新たな権限は必要ありません。そのため `manifest.json` / `firefox/manifest.json` は変更しません。

## 実装後の検証

変更後は必ず以下を実行してください。

```bash
npm run lint
```

`eslint` のエラーが出た場合は、本計画のコード例に従いつつ、既存コードのスタイル（制御文には必ずブレース `{}` を使用するなど、`AGENTS.md` の規約）に合わせて修正します。

## 実装後のドキュメント移動

実装が完了したら、本ファイルを `docs/archive/PLAN_SHOW_ORIGINAL_TITLE.md` へ移動します（Gemini 版の運用に準拠）。`docs/archive/` には既に `REFACTOR_PLAN.md` が置かれており、同じ運用に従います。
