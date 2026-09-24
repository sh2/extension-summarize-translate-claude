# Claude Opus 5.5 追加とモデル一覧の棚卸しの実装計画

## 背景・目的

Anthropic が Claude Opus 5.5（`claude-opus-5-5`）をリリースしたため、拡張機能のモデル選択ドロップダウンと API マッピングにこれを追加する。あわせて、公式ドキュメントのモデル一覧・非推奨（Deprecated）一覧と現在の収録モデルを突き合わせ、Deprecated になったモデルがあれば削除する。

参照:

- <https://platform.claude.com/docs/en/models/overview>
- <https://platform.claude.com/docs/en/about-claude/model-deprecations>

## 確認結果

公式ドキュメントの Model status テーブルと収録済みモデルの照合結果。

| モデル | API ID | 状態 | 対応 |
| --- | --- | --- | --- |
| Claude Opus 5.5 | `claude-opus-5-5` | 新規（Active） | 追加 |
| Claude Fable 5.1 | `claude-fable-5-1` | Active | 維持 |
| Claude Fable 5 | `claude-fable-5` | Active（Legacy） | 維持 |
| Claude Opus 5 | `claude-opus-5` | Active（Legacy） | 維持 |
| Claude Sonnet 5 | `claude-sonnet-5` | Active | 維持 |
| Claude Opus 4.8 / 4.7 / 4.6 / 4.5 | `claude-opus-4-8` / `-4-7` / `-4-6` / `-4-5` | Active（Legacy） | 維持 |
| Claude Sonnet 4.6 / 4.5 | `claude-sonnet-4-6` / `-4-5` | Active（Legacy） | 維持 |
| Claude Haiku 4.5 | `claude-haiku-4-5` | Active（Legacy） | 維持 |
| Claude Mythos 5.1 / 5 | `claude-mythos-5-1` / `claude-mythos-5` | Active（Project Glasswing 招待制） | 追加しない |
| Claude Mythos Preview | `claude-mythos-preview` | Deprecated（2026/6/9） | 元々未収録のため除去不要 |
| Claude Opus 4.1 | `claude-opus-4-1-20250805` | Retired（2026/8/5） | 元々未収録のため除去不要 |
| Claude Opus 4 / Claude Sonnet 4 | `claude-opus-4-20250514` / `claude-sonnet-4-20250514` | Retired（2026/6/15） | 元々未収録のため除去不要 |
| Claude 3 系（Opus 3、Sonnet 3.7 / 3.5 / 3、Haiku 3.5 / 3） | 各 ID | Retired | 元々未収録のため除去不要 |

**結論: 収録済みの 11 モデルはすべて Active であり、Deprecated になったモデルは存在しないため削除対象はなし。** 現在 Deprecated なのは `claude-mythos-preview` のみで、これは招待制のため元々収録していない。

## 設計決定

| # | 項目 | 決定内容 |
| --- | --- | --- |
| 1 | `DEFAULT_LANGUAGE_MODEL` | `"4.5-haiku"` のまま変更しない（最速・最安を維持） |
| 2 | Deprecated モデルの除去 | 収録済みモデルはすべて Active のため除去なし |
| 3 | Legacy モデル | Anthropic がまだ利用可としているため維持 |
| 4 | Mythos 5.1 / 5 | 招待制のため追加しない |
| 5 | ロケール変更 | なし（モデル名は `templates.html` にハードコード、i18n 対象外） |
| 6 | README 変更 | なし（デフォルトモデル不変のため） |
| 7 | `anthropic-version` ヘッダー | `"2023-06-01"` のまま変更不要 |
| 8 | リクエストパラメータ | 変更なし。Opus 4.7 以降で非推奨の `temperature` / `top_p` / `top_k` は元々送信していない |
| 9 | manifest のバージョン | 変更しない（バージョン bump は別コミットで実施） |

## 変更内容

### 1. `extension/utils.js` — `getModelId()`

`modelMappings` オブジェクトに 1 エントリを追加する。既存エントリの削除・変更はなし。並び順は現行世代（5 系）を Fable → Opus → Sonnet の順に置く既存規則に合わせ、`"5.5-opus"` を `"5-fable"` の直後・`"5-opus"` の直前に挿入する。

```javascript
const modelMappings = {
  "5.1-fable": "claude-fable-5-1",
  "5-fable": "claude-fable-5",
  "5.5-opus": "claude-opus-5-5",
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

`<select id="languageModel">` の Claude Opus グループの先頭に 1 行を追加する。

```html
<optgroup label="Claude Opus">
  <option value="5.5-opus">Claude Opus 5.5</option>
  <option value="5-opus">Claude Opus 5</option>
  <option value="4.8-opus">Claude Opus 4.8</option>
  <option value="4.7-opus">Claude Opus 4.7</option>
  <option value="4.6-opus">Claude Opus 4.6</option>
  <option value="4.5-opus">Claude Opus 4.5</option>
</optgroup>
```

## 検証手順

1. `npm run lint` がエラーなく通ること
2. 拡張機能を読み込み → Options ページ → モデルドロップダウンの Claude Opus グループに Claude Opus 5.5 が表示されること
3. Claude Opus 5.5 を選択してページ要約を実行し、API リクエストの `model` フィールドが `claude-opus-5-5` であること
4. 既存モデル（例: Claude Haiku 4.5、Claude Fable 5.1）が引き続き選択・実行できること
