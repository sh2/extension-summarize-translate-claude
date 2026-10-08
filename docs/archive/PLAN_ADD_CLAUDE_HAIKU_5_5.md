# Claude Haiku 5.5 追加とデフォルトモデル変更の実装計画

## 背景・目的

Anthropic が Claude Haiku 5.5（`claude-haiku-5-5`）をリリースした。拡張機能のモデル選択ドロップダウンと API マッピングをこれに追随させ、あわせてデフォルトモデルを Claude Haiku 4.5 から Claude Haiku 5.5 に変更する。

- **追加:** Claude Haiku 5.5
- **デフォルト変更:** `DEFAULT_LANGUAGE_MODEL` を `"4.5-haiku"` → `"5.5-haiku"`

参照:

- <https://platform.claude.com/docs/en/models/overview>
- <https://platform.claude.com/docs/en/about-claude/model-deprecations>

## 確認結果

公式ドキュメントの Model status テーブルと収録済みモデルの照合結果（2026-10-08 時点）。

| モデル | API ID | 状態 | 対応 |
| --- | --- | --- | --- |
| Claude Haiku 5.5 | `claude-haiku-5-5` | 新規（Active） | 追加 |
| Claude Haiku 4.5 | `claude-haiku-4-5` | Active（退役予定は 2026/10/15 以降） | 維持 |
| Claude Fable 5.1 / 5 | `claude-fable-5-1` / `claude-fable-5` | Active | 維持 |
| Claude Opus 5.5 / 5 | `claude-opus-5-5` / `claude-opus-5` | Active | 維持 |
| Claude Opus 4.8 / 4.7 / 4.6 / 4.5 | `claude-opus-4-8` / `-4-7` / `-4-6` / `-4-5` | Active | 維持 |
| Claude Sonnet 5.5 / 5 / 4.6 | `claude-sonnet-5-5` / `-5` / `-4-6` | Active | 維持 |
| Claude Sonnet 4.5 | `claude-sonnet-4-5-20250929` | Deprecated（2026/9/30） | 削除済み（前回の Sonnet 5.5 追加時） |
| Claude Mythos 5.1 / 5 | `claude-mythos-5-1` / `claude-mythos-5` | Active（Project Glasswing 招待制） | 追加しない |
| Claude Mythos Preview | `claude-mythos-preview` | Deprecated（2026/6/9） | 元々未収録のため対応不要 |
| Claude Opus 4.1 / Opus 4 / Sonnet 4 | 各 ID | Retired | 元々未収録のため対応不要 |
| Claude 3 系（Opus 3、Sonnet 3.7 / 3.5 / 3、Haiku 3.5 / 3） | 各 ID | Retired | 元々未収録のため対応不要 |

**本次の Deprecated 削除対象はなし。** 収録済みモデルはすべて Active。Claude Haiku 4.5 は Active のため維持する（退役予定日は 2026/10/15 以降とされるが、Deprecated 宣言は出ていない）。

## 設計決定

| # | 項目 | 決定内容 |
| --- | --- | --- |
| 1 | `DEFAULT_LANGUAGE_MODEL` | `"5.5-haiku"` に変更する（最速・最安の位置づけは Haiku 5.5 が継承） |
| 2 | Haiku 4.5 の扱い | Active のため維持。Deprecated 宣言後に削除する |
| 3 | 旧デフォルト保存済みユーザーの扱い | 追加実装不要。`"4.5-haiku"` は選択肢に残るため既存の保存値はそのまま有効 |
| 4 | 並び順 | 5 系は Fable → Opus → Sonnet → Haiku、各ファミリー内は新しい順。`"5.5-haiku"` を `"5-sonnet"` の直後・`"4.8-opus"` の直前に挿入する |
| 5 | Mythos 5.1 / 5 | 招待制のため追加しない |
| 6 | ロケール変更 | なし（モデル名は `templates.html` にハードコード、i18n 対象外） |
| 7 | README 変更 | デフォルトモデルの記述を Claude Haiku 5.5 に更新 |
| 8 | `anthropic-version` ヘッダー | `"2023-06-01"` のまま変更不要 |
| 9 | リクエストパラメータ | 変更なし。Opus 4.7 以降で非推奨の `temperature` / `top_p` / `top_k` は元々送信していない |
| 10 | manifest のバージョン | 変更しない（バージョン bump は別コミットで実施） |
| 11 | CHANGELOG | 変更しない（タグ単位でリリース時に追記する運用のため） |

## 変更内容

### 1. `extension/utils.js`

`DEFAULT_LANGUAGE_MODEL` を `"5.5-haiku"` に変更し、`getModelId()` の `modelMappings` に `"5.5-haiku"` を追加する。

```javascript
export const DEFAULT_LANGUAGE_MODEL = "5.5-haiku";
```

```javascript
const modelMappings = {
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
```

### 2. `extension/templates.html` — `languageModelTemplate`

Claude Haiku グループを以下のように更新する。

```html
<optgroup label="Claude Haiku">
  <option value="5.5-haiku">Claude Haiku 5.5</option>
  <option value="4.5-haiku">Claude Haiku 4.5</option>
</optgroup>
```

### 3. `README.md`

デフォルトモデルの記述を更新する。

```markdown
This extension uses Claude Haiku 5.5 by default.
```

## 検証手順

1. `npm run lint` がエラーなく通ること
2. ドロップダウンの選択肢と `modelMappings` のキーが過不足なく一致すること
3. 拡張機能を読み込み → Options ページ → モデルドロップダウンの Claude Haiku グループに Claude Haiku 5.5 が表示されること
4. 未設定の状態（初期値）でページ要約を実行し、API リクエストの `model` フィールドが `claude-haiku-5-5` であること
5. Claude Haiku 4.5 を明示選択した状態で引き続き動作すること（Active のため維持）
6. 既存モデル（例: Claude Opus 5.5、Claude Fable 5.1）が引き続き選択・実行できること
