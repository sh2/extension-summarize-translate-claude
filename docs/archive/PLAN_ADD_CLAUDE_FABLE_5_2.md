# Claude Fable 5.2 追加と Adaptive Thinking 出力対応の実装計画

## 背景・目的

Anthropic が Claude Fable 5.2（`claude-fable-5-2`）をリリースしたため、拡張機能のモデル選択ドロップダウンと API マッピングにこれを追加する。あわせて、Claude Fable 5.2 を含む Claude 5 系モデルで常時有効な Adaptive Thinking のレスポンス／ストリーミング出力形式（`thinking` コンテンツブロック、`thinking_delta`、`signature_delta`）を正しく処理できるよう、レスポンス解析・ストリーミング処理を改修する。

また、公式ドキュメントのモデル一覧・非推奨（Deprecated）一覧と現在の収録モデルを突き合わせ、Deprecated になったモデルがあれば削除する。

参照:

- <https://platform.claude.com/docs/en/about-claude/pricing>
- <https://platform.claude.com/docs/en/models/overview>
- <https://platform.claude.com/docs/en/models/fable-5-2/overview>
- <https://platform.claude.com/docs/en/about-claude/model-deprecations>
- <https://platform.claude.com/docs/en/build-with-claude/thinking>

## 確認結果

公式ドキュメントのモデル一覧・Model deprecations テーブルと収録済みモデルの照合結果（2026-11-14 時点）。

| モデル | API ID | 状態 | 対応 |
| --- | --- | --- | --- |
| Claude Fable 5.2 | `claude-fable-5-2` | 新規（Active） | 追加 |
| Claude Fable 5.1 / 5 | `claude-fable-5-1` / `claude-fable-5` | Active | 維持 |
| Claude Opus 5.5 / 5 | `claude-opus-5-5` / `claude-opus-5` | Active | 維持 |
| Claude Opus 4.8 / 4.7 / 4.6 / 4.5 | `claude-opus-4-8` / `-4-7` / `-4-6` / `-4-5` | Active | 維持 |
| Claude Sonnet 5.5 / 5 / 4.6 | `claude-sonnet-5-5` / `-5` / `-4-6` | Active | 維持 |
| Claude Haiku 5.5 / 4.5 | `claude-haiku-5-5` / `-4-5` | Active | 維持 |
| Claude Mythos 5.2 / 5.1 / 5 | `claude-mythos-5-2` / `-5-1` / `-5` | Active（要認証） | 追加しない |
| Claude Mythos Preview | `claude-mythos-preview` | Deprecated（2026/6/9） | 元々未収録のため対応不要 |
| Claude Sonnet 4.5 | `claude-sonnet-4-5-20250929` | Deprecated（2026/9/30） | 削除済みのため対応不要 |
| Claude Opus 4.1 / Opus 4 / Sonnet 4 | 各 ID | Retired | 元々未収録のため対応不要 |
| Claude 3 系（Opus 3、Sonnet 3.7 / 3.5 / 3、Haiku 3.5 / 3） | 各 ID | Retired | 元々未収録のため対応不要 |

**今回の Deprecated 削除対象はなし。** 収録済みの 13 モデルはすべて Active のため維持する。

## Adaptive Thinking 出力に関する確認事項

Claude Fable 5.2（および Claude 5 系モデル）では Adaptive Thinking がデフォルトで有効（`display` の既定値は `"omitted"`）であり、思考が行われた場合のレスポンスには `text` ブロックの前に `thinking` ブロックが含まれる。

- **ストリーミング時:** `content_block_delta` イベントとして `thinking_delta` や `signature_delta` が先に配信され、これらには `delta.text` が存在しない。従来の `content += json.delta.text` では `"undefined"` が連結されるため、`json.delta?.type === "text_delta"` のみを受け取るよう修正する。
- **非ストリーミング時:** `response.body.content` 配列の先頭（インデックス `0`）が `{ type: "thinking", ... }` になる場合がある。`response.body.content[0]` の固定参照をやめ、`type === "text"` のブロックを検索して取得・検証するよう修正する。

## 設計決定

| # | 項目 | 決定内容 |
| --- | --- | --- |
| 1 | `DEFAULT_LANGUAGE_MODEL` | `"5.5-haiku"` のまま変更しない（最速・最安を維持） |
| 2 | Deprecated モデルの削除 | 収録済み 13 モデルはすべて Active のため削除なし（Sonnet 4.5 は削除済み） |
| 3 | 並び順 | 5 系は Fable → Opus → Sonnet → Haiku、各ファミリー内は新しい順。`"5.2-fable"` を `modelMappings` および `<optgroup label="Claude Fable">` の先頭（`"5.1-fable"` の直前）に配置する |
| 4 | Mythos 5.2 / 5.1 / 5 | 使用しないため追加しない |
| 5 | Adaptive Thinking 出力対応 | `streamGenerateContent()` は `text_delta` のみ連結し、`getResponseContent()` と `isSuccessfulResponse()` は `content` 配列から `type === "text"` のブロックを検索する |
| 6 | ベンダーライブラリ（`extension/lib/`） | 今回は更新しない |
| 7 | ロケール / README / manifest / CHANGELOG | 変更しない（バージョン bump と CHANGELOG 更新はリリース時に実施） |
| 8 | `anthropic-version` ヘッダー / Sampling パラメータ | `"2023-06-01"` のまま変更不要。`temperature` / `top_p` / `top_k` も元々未送信 |

## 変更内容

### 1. `extension/utils.js`

#### `getModelId()`

`modelMappings` の先頭に `"5.2-fable": "claude-fable-5-2"` を追加する。

```javascript
export const getModelId = (languageModel) => {
  const modelMappings = {
    "5.2-fable": "claude-fable-5-2",
    "5.1-fable": "claude-fable-5-1",
    "5-fable": "claude-fable-5",
    "5.5-opus": "claude-opus-5-5",
    "5-opus": "claude-opus-5",
    "5.5-sonnet": "claude-sonnet-5-5",
    "5-sonnet": "claude-sonnet-5",
    "5.5-haiku": "claude-haiku-5-5",
    "4.8-opus": "claude-opus-4-8",
    "4.7-opus": "claude-opus-4-7",
    "4.6-opus": "claude-opus-4-6",
    "4.5-opus": "claude-opus-4-5",
    "4.6-sonnet": "claude-sonnet-4-6",
    "4.5-haiku": "claude-haiku-4-5"
  };

  return modelMappings[languageModel];
};
```

#### `streamGenerateContent()`

`content_block_delta` イベント処理で `json.delta?.type === "text_delta"` のみ連結・保存する。

```javascript
            } else if (event === "content_block_delta") {
              // Get the delta of the content and concatenate it
              const json = JSON.parse(data);

              if (json.delta?.type === "text_delta") {
                content += json.delta.text;

                // Set the stream content to session storage
                await chrome.storage.session.set({ [streamKey]: content });
              }
            }
```

#### `getResponseContent()`

`response.body.content` 配列から `type === "text"` のブロックを検索してテキストを取得する。

```javascript
export const getResponseContent = (response, hasApiKey) => {
  let responseContent;

  if (response.ok) {
    const textBlock = Array.isArray(response.body?.content)
      ? response.body.content.find(block => block.type === "text")
      : null;

    if (textBlock && typeof textBlock.text === "string") {
      // A normal response was returned
      responseContent = textBlock.text;
    } else {
      // The expected response was not returned
      responseContent = chrome.i18n.getMessage("response_unexpected_response");
    }
  } else {
```

### 2. `extension/templates.html` — `languageModelTemplate`

`Claude Fable` グループの先頭に `<option value="5.2-fable">Claude Fable 5.2</option>` を追加する。

```html
    <optgroup label="Claude Fable">
      <option value="5.2-fable">Claude Fable 5.2</option>
      <option value="5.1-fable">Claude Fable 5.1</option>
      <option value="5-fable">Claude Fable 5</option>
    </optgroup>
```

### 3. `extension/results.js` — `isSuccessfulResponse()`

`response.body.content` 配列から `type === "text"` のブロックを検索して有効な応答かを判定する。

```javascript
const isSuccessfulResponse = (response) => {
  if (!response || !response.ok || !Array.isArray(response.body?.content)) {
    return false;
  }

  const contentBlock = response.body.content.find(block => block.type === "text");
  return typeof contentBlock?.text === "string" && contentBlock.text.length > 0;
};
```

## 検証手順

1. `npm run lint` がエラーなく通ること
2. `extension/templates.html` の `<option>` 一覧と `extension/utils.js` の `modelMappings` のキーが過不足なく一致すること
3. 拡張機能を読み込み → Options / Popup → モデルドロップダウンの `Claude Fable` グループ先頭に `Claude Fable 5.2` が表示されること
4. `Claude Fable 5.2` を選択して非ストリーミング・ストリーミングそれぞれでページ要約や追加質問を実行し、API リクエストの `model` フィールドが `claude-fable-5-2` であり、思考ブロックを含む応答でも `"undefined"` の混入やエラー表示にならず本文のみが正しく表示されること
5. 既存モデル（例: `Claude Haiku 5.5`、`Claude Opus 5.5`）が引き続き選択・実行できること
