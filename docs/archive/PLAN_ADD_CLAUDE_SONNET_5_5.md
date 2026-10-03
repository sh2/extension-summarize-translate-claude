# Claude Sonnet 5.5 追加と Claude Sonnet 4.5 削除の実装計画

## 背景・目的

Anthropic が Claude Sonnet 5.5（`claude-sonnet-5-5`）をリリースし、あわせて Claude Sonnet 4.5（`claude-sonnet-4-5-20250929`）が Deprecated になった。拡張機能のモデル選択ドロップダウンと API マッピングをこれに追随させる。

- **追加:** Claude Sonnet 5.5
- **削除:** Claude Sonnet 4.5（2026/9/30 Deprecated、2026/11/30 退役予定）

参照:

- <https://platform.claude.com/docs/en/models/overview>
- <https://platform.claude.com/docs/en/about-claude/model-deprecations>

## 確認結果

公式ドキュメントの Model status テーブルと収録済みモデルの照合結果。

| モデル | API ID | 状態 | 対応 |
| --- | --- | --- | --- |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 新規（Active） | 追加 |
| Claude Sonnet 4.5 | `claude-sonnet-4-5-20250929` | **Deprecated**（2026/9/30、2026/11/30 退役） | 削除 |
| Claude Fable 5.1 / 5 | `claude-fable-5-1` / `claude-fable-5` | Active | 維持 |
| Claude Opus 5.5 / 5 | `claude-opus-5-5` / `claude-opus-5` | Active | 維持 |
| Claude Opus 4.8 / 4.7 / 4.6 / 4.5 | `claude-opus-4-8` / `-4-7` / `-4-6` / `-4-5` | Active | 維持 |
| Claude Sonnet 5 | `claude-sonnet-5` | Active | 維持 |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | Active | 維持 |
| Claude Haiku 4.5 | `claude-haiku-4-5` | Active | 維持 |
| Claude Mythos 5.1 / 5 | `claude-mythos-5-1` / `claude-mythos-5` | Active（Project Glasswing 招待制） | 追加しない |
| Claude Mythos Preview | `claude-mythos-preview` | Deprecated（2026/6/9） | 元々未収録のため対応不要 |
| Claude Opus 4.1 / Opus 4 / Sonnet 4 | 各 ID | Retired | 元々未収録のため対応不要 |
| Claude 3 系（Opus 3、Sonnet 3.7 / 3.5 / 3、Haiku 3.5 / 3） | 各 ID | Retired | 元々未収録のため対応不要 |

**Deprecated 対応の対象は Claude Sonnet 4.5 のみ。** その他の収録済み 10 モデルはすべて Active のため維持する。

## 設計決定

| # | 項目 | 決定内容 |
| --- | --- | --- |
| 1 | `DEFAULT_LANGUAGE_MODEL` | `"4.5-haiku"` のまま変更しない（最速・最安を維持） |
| 2 | Sonnet 4.5 の削除 | Deprecated のため削除する。退役予定日（2026/11/30）を待たずに削除し、選択肢から外す |
| 3 | Sonnet 4.5 保存済みユーザーの扱い | 追加実装は不要。`templates.html` から `<option>` が消えると `<select>.value` への代入結果は空文字列になり、`options.js` / `popup.js` / `results.js` の既存フォールバック（「Set the default language model if the language model is not set」）が `DEFAULT_LANGUAGE_MODEL` を設定する。`options.js` の `INITIAL_OPTIONS` は元々 `DEFAULT_LANGUAGE_MODEL` を既定値に持つ |
| 4 | 並び順 | 5 系は Fable → Opus → Sonnet、各ファミリー内は新しい順。`"5.5-sonnet"` を `"5-opus"` の直後・`"5-sonnet"` の直前に挿入する |
| 5 | Legacy モデル | Anthropic がまだ利用可としているため維持 |
| 6 | Mythos 5.1 / 5 | 招待制のため追加しない |
| 7 | ロケール変更 | なし（モデル名は `templates.html` にハードコード、i18n 対象外） |
| 8 | README 変更 | なし（デフォルトモデル不変のため） |
| 9 | `anthropic-version` ヘッダー | `"2023-06-01"` のまま変更不要 |
| 10 | リクエストパラメータ | 変更なし。Opus 4.7 以降で非推奨の `temperature` / `top_p` / `top_k` は元々送信していない |
| 11 | manifest のバージョン | 変更しない（バージョン bump は別コミットで実施） |
| 12 | CHANGELOG | 変更しない（タグ単位でリリース時に追記する運用のため） |

## 変更内容

### 1. `extension/utils.js` — `getModelId()`

`modelMappings` に `"5.5-sonnet"` を追加し、`"4.5-sonnet"` を削除する。

```javascript
const modelMappings = {
  "5.1-fable": "claude-fable-5-1",
  "5-fable": "claude-fable-5",
  "5.5-opus": "claude-opus-5-5",
  "5-opus": "claude-opus-5",
  "5.5-sonnet": "claude-sonnet-5-5",
  "5-sonnet": "claude-sonnet-5",
  "4.8-opus": "claude-opus-4-8",
  "4.7-opus": "claude-opus-4-7",
  "4.6-opus": "claude-opus-4-6",
  "4.5-opus": "claude-opus-4-5",
  "4.6-sonnet": "claude-sonnet-4-6",
  "4.5-haiku": "claude-haiku-4-5"
};
```

### 2. `extension/templates.html` — `languageModelTemplate`

Claude Sonnet グループを以下のように更新する。

```html
<optgroup label="Claude Sonnet">
  <option value="5.5-sonnet">Claude Sonnet 5.5</option>
  <option value="5-sonnet">Claude Sonnet 5</option>
  <option value="4.6-sonnet">Claude Sonnet 4.6</option>
</optgroup>
```

## 検証手順

1. `npm run lint` がエラーなく通ること
2. ドロップダウンの選択肢と `modelMappings` のキーが過不足なく一致すること
3. 拡張機能を読み込み → Options ページ → モデルドロップダウンの Claude Sonnet グループに Claude Sonnet 5.5 が表示され、Claude Sonnet 4.5 が表示されないこと
4. Claude Sonnet 5.5 を選択してページ要約を実行し、API リクエストの `model` フィールドが `claude-sonnet-5-5` であること
5. 削除前の Claude Sonnet 4.5 が `chrome.storage.local` に残っている状態で popup / Options を開き、選択が Claude Haiku 4.5（既定値）にフォールバックすること
6. 既存モデル（例: Claude Haiku 4.5、Claude Opus 5.5）が引き続き選択・実行できること
