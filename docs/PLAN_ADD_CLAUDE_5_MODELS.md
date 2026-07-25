# Claude 5 系モデル（Fable 5 / Opus 5 / Sonnet 5）追加の実装計画

## 背景・目的

Anthropic が 2026 年 6 月 9 日に Claude Fable 5・Claude Opus 5・Claude Sonnet 5 をリリースしたため、拡張機能のモデル選択ドロップダウンと API マッピングにこれらを追加する。

参照: <https://platform.claude.com/docs/en/about-claude/models/overview>

## 確認結果

| モデル | API ID | 状態 | 対応 |
| --- | --- | --- | --- |
| Claude Fable 5 | `claude-fable-5` | 新規 (2026/6/9 GA) | 追加 |
| Claude Opus 5 | `claude-opus-5` | 新規 | 追加 |
| Claude Sonnet 5 | `claude-sonnet-5` | 新規 | 追加 |
| Claude Mythos 5 | `claude-mythos-5` | 招待制 (Project Glasswing) | 追加しない |
| Claude Haiku 4.5 | `claude-haiku-4-5` | 現行 | 変更なし |
| Claude Opus 4.8 / 4.7 / 4.6 / 4.5 | 各 ID | Legacy（利用可） | 維持 |
| Claude Sonnet 4.6 / 4.5 | 各 ID | Legacy（利用可） | 維持 |
| Claude Opus 4.1 | `claude-opus-4-1-20250805` | Deprecated (2026/8/5 退役) | 元々未収録のため除去不要 |

## 設計決定

| # | 項目 | 決定内容 |
| --- | --- | --- |
| 1 | `DEFAULT_LANGUAGE_MODEL` | `"4.5-haiku"` のまま変更しない（最速・最安を維持） |
| 2 | Mythos 5 | 招待制のため追加しない |
| 3 | Legacy モデル | Anthropic がまだ利用可としているため維持 |
| 4 | Deprecated モデルの除去 | Opus 4.1 は元々未収録のため除去不要 |
| 5 | ロケール変更 | なし（モデル名は `templates.html` にハードコード、i18n 対象外） |
| 6 | README 変更 | なし（デフォルトモデル不変のため） |
| 7 | `anthropic-version` ヘッダー | `"2023-06-01"` のまま変更不要 |

## 変更内容

### 1. `extension/utils.js` — `getModelId()`

`modelMappings` オブジェクトに 3 エントリを追加する。既存エントリの削除・変更はなし。

```javascript
const modelMappings = {
  "5-fable": "claude-fable-5",
  "5-opus": "claude-opus-5",
  "5-sonnet": "claude-sonnet-5",
  "4.8-opus": "claude-opus-4-8",
  "4.7-opus": "claude-opus-4-7",
  "4.6-opus": "claude-opus-4-6",
  "4.5-opus": "claude-opus-4-5",
  "4.6-sonnet": "claude-sonnet-4-6",
  "4.5-sonnet": "claude-sonnet-4-5",
  "4.5-haiku": "claude-haiku-4-5"
};
```

### 2. `extension/templates.html` — `languageModelTemplate`

`<select id="languageModel">` を以下のように更新する。

```html
<select id="languageModel">
  <optgroup label="Claude Fable">
    <option value="5-fable">Claude Fable 5</option>
  </optgroup>
  <optgroup label="Claude Opus">
    <option value="5-opus">Claude Opus 5</option>
    <option value="4.8-opus">Claude Opus 4.8</option>
    <option value="4.7-opus">Claude Opus 4.7</option>
    <option value="4.6-opus">Claude Opus 4.6</option>
    <option value="4.5-opus">Claude Opus 4.5</option>
  </optgroup>
  <optgroup label="Claude Sonnet">
    <option value="5-sonnet">Claude Sonnet 5</option>
    <option value="4.6-sonnet">Claude Sonnet 4.6</option>
    <option value="4.5-sonnet">Claude Sonnet 4.5</option>
  </optgroup>
  <optgroup label="Claude Haiku">
    <option value="4.5-haiku">Claude Haiku 4.5</option>
  </optgroup>
</select>
```

## 検証手順

1. `npm run lint` がエラーなく通ること
2. 拡張機能を読み込み → Options ページ → モデルドロップダウンに Fable 5 / Opus 5 / Sonnet 5 が表示されること
3. 各新モデルを選択してページ要約を実行し、API リクエストの `model` フィールドが正しい ID であることを確認
