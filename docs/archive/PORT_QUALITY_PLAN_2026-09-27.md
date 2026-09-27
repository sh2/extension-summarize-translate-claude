# 品質改善取り込み計画 2026-09-27（第4回）

本ドキュメントは `extension-summarize-translate-claude`（Claude版）に対し、
`extension-summarize-translate-gemini`（Gemini版）で実装された更新を移植するための実装計画です。

状態: 実装済み（2026-09-27）。`npm run lint` はエラーなし。
本ドキュメントは作業完了後の 2026-09-27 に `docs/` から `docs/archive/` へ移動した。

本シリーズについて:

- Gemini版の更新は定期的に発生するため、取り込み計画は日付付きでシリーズ化する
- ファイル名の形式: `PORT_QUALITY_PLAN_YYYY-MM-DD.md`
- 第1回: [`PORT_QUALITY_PLAN_2026-08-02.md`](PORT_QUALITY_PLAN_2026-08-02.md)
- 第2回: [`PORT_QUALITY_PLAN_2026-09-21.md`](PORT_QUALITY_PLAN_2026-09-21.md)
- 第3回: [`PORT_QUALITY_PLAN_2026-09-23.md`](PORT_QUALITY_PLAN_2026-09-23.md)

前提:

- 第3回で Gemini版 `b3277dd`（コピー内容へのソースヘッダ付与）まで取り込み済みである
- 本第4回は `b3277dd` より後の差分のみを対象とする。移植は選択式で、
  provider 固有の変更（Gemini/OpenAI のモデルや設定）は対象外とする
- 対象は以下の 3 項目（ユーザー確定済み）

| # | 移植内容 | Gemini版コミット | 区分 |
| --- | --- | --- | --- |
| 1 | 翻訳ヘルパーの既定モデルを `gpt-6-luna` に更新 | `a6848cb` | 品質修正 |
| 2 | `AGENTS.md` に Changelog 運用規約を追加 | `c9d8b2e` | ドキュメント |
| 3 | Claude版 `CHANGELOG.md` を新規作成 | `c9d8b2e` | ドキュメント |

参考リポジトリ:

- Claude版: `/nfs/git/extension-summarize-translate-claude`
- Gemini版: `/nfs/git/extension-summarize-translate-gemini`

---

## 1. 目的とスコープ

### 目的

- **#1**: Gemini版が翻訳ヘルパーの既定 OpenAI モデルを `gpt-6-luna` に更新したのに合わせ、
  Claude版の `utils/translation/translate.js` も同一モデルへ揃える
- **#2**: Gemini版で追加された Changelog の運用規約を `AGENTS.md` に取り込み、
  リリースごとの変更履歴を維持する方針を Claude版にも導入する
- **#3**: 規約に従い、Claude版の annotated タグ履歴から `CHANGELOG.md` を新規作成する。
  Gemini版の `CHANGELOG.md` は Gemini版の履歴そのものであるため流用せず、
  ハッシュを持つ Claude版の 64 タグから生成する

### スコープ外

- Gemini版 `fd653d4`（v1.8.20）/ `d2ca760`（v1.8.19）のバージョン bump —
  Claude版は独自採番（現在 1.4.42）で、バージョン体系が異なる
- `a6848cb` の `README.md` / `extension/options.js` — Claude版は単一プロバイダーで、
  OpenAI 互換の既定モデル設定・互換性表を持たない
- `c9d8b2e` の `CHANGELOG.md` 本体のコピー — Gemini版のリリース履歴であり、
  内容は Claude版のタグから別途生成する
- Gemini版のテスト（`test/` / `e2e/`）— Claude版にテスト基盤が存在しない

### 変更対象ファイル

| ファイル | 変更内容 |
| --- | --- |
| `utils/translation/translate.js` | 既定モデルを `gpt-6-luna` に更新（#1） |
| `AGENTS.md` | `## Changelog` 節を追加（#2） |
| `CHANGELOG.md` | 新規作成（#3） |
| `docs/PORT_QUALITY_PLAN_2026-09-27.md` | 本ドキュメント（作業完了後に `docs/archive/` へ移動） |

バージョン bump は不要（`extension/` の挙動は変わらず、`utils/` は開発用ヘルパー）。

---

## 2. 現状分析

### 2.1 同期点

| 項目 | Gemini版 | Claude版 |
| --- | --- | --- |
| 最終同期 | `b3277dd`（2026-09-22） | `e42576e`（2026-09-23） |

両リポジトリに共通履歴はなく、Claude版は選択移植で追従している。
第3回で `buildSourceHeader` / `copyContentToClipboard` を含むソースヘッダ付与を
取り込み済みであり、本計画の作成時に両関数が Claude版と Gemini版で完全一致することを
確認した（差分ゼロ）。

したがって未取り込みは **Gemini版 `b3277dd` より後**の以下のみである。

| Gemini版コミット | 日付 | 内容 |
| --- | --- | --- |
| `fd653d4` | 2026-09-23 | v1.8.20 へ bump |
| `a6848cb` | 2026-09-24 | 既定 OpenAI モデルを GPT-6 へ更新 |
| `c9d8b2e` | 2026-09-26 | `CHANGELOG.md` 追加と Changelog 運用規約 |

`fd653d4` はバージョン体系が異なるため対象外。`a6848cb` / `c9d8b2e` を本計画で取り込む。

### 2.2 `utils/translation/translate.js` の現状

Claude版で `gpt-5.6-luna` を参照するのはこのファイルのみである（grep 確認済み）。
`extension/` 配下に OpenAI 設定は存在しないため、`a6848cb` のうち
`README.md` と `extension/options.js` は該当しない。

```js
const API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5.6-luna"; // ← gpt-6-luna へ
```

### 2.3 `AGENTS.md` と `CHANGELOG.md` の現状

- Claude版 `AGENTS.md` に Changelog の節はない
- Claude版 `CHANGELOG.md` は存在しない
- Claude版は annotated タグを 64 個持つ（`v0.9.1` 〜 `v1.4.42`）。
  うち 2 つは命名が揺れている（`1.4.25` は `v` なし、`v.1.4.34` は `v.` 付き）。
  時系列では `1.4.25` は v1.4.24 と v1.4.26 の間、`v.1.4.34` は v1.4.33 と v1.4.35 の間に入る

---

## 3. 実装内容

### 3.1 `utils/translation/translate.js`（#1）

Gemini版 `a6848cb` と同じくリテラルを 1 行だけ差し替える。

| 変更前 | 変更後 |
| --- | --- |
| `const MODEL = "gpt-5.6-luna";` | `const MODEL = "gpt-6-luna";` |

`MAX_RETRIES` / `DELAY_MS` / プロンプト等、他の定数は変更しない。

### 3.2 `AGENTS.md`（#2）

`## Git commits` 節の直後、`## Localization guidelines` 節の直前に `## Changelog` 節を追加する。
本文は Gemini版とほぼ同一とし、以下を規定する。

- `CHANGELOG.md` はリリース単位（コミット単位ではない）で英語記述とする
- annotated `vX.Y.Z` タグを情報源とし、1 タグ 1 エントリとする
- Keep a Changelog 形式 + Semantic Versioning
- `Added` / `Changed` / `Fixed` を基本とし、空セクションは省略する
- `feat` / `fix` / `style` のユーザー可視変更を収録し、`chore:` のバージョン bump と
  `docs:` は除外する
- コミット件名の写しではなく差分で裏取りする
- バージョン見出しと GitHub リリースへのリンク参照を付ける
- `MD024` 対策として `<!-- markdownlint-disable MD024 -->` を先頭に 1 回置く

### 3.3 `CHANGELOG.md`（#3）

3.2 の規約に従い、Claude版のタグ履歴から生成する。方針は以下のとおり。

- 新規ファイルのため、最初のタグ `0.9.1` から最新の `1.4.42` まで全 64 バージョンを収録する
- 各エントリはタグ間のコミットと `extension/` の差分を確認して記述する
- 見出しは `## [X.Y.Z] - YYYY-MM-DD`、`X.Y.Z <- 1.4.42` の順に降順で並べる
- ファイル末尾にタグへのリンク参照をまとめる。命名が揺れた 2 タグは
  見出しを `1.4.25` / `1.4.34` に正規化し、リンク先は実タグ名
  （`tag/1.4.25` / `tag/v.1.4.34`）とする
- 冒頭に coverage 文（最初のタグ `0.9.1` 以降を収録）と Markdownlint 無効化コメントを置く

---

## 4. 検証方法

### 4.1 静的検証

- `npm run lint` を実行し、`utils/translation/translate.js` と `AGENTS.md` に問題がないこと
- `npm run lint` は `CHANGELOG.md` を対象外とするため、Markdown は VS Code の
  Markdownlint 診断で `MD024` 以外の警告が出ないことを確認する
- `git for-each-ref refs/tags` のタグ数（64）と `CHANGELOG.md` の見出し数が一致することを確認する

### 4.2 実施記録

- `npm run lint`: エラーなし
- `CHANGELOG.md` の見出し数: 64（タグ数と一致）
- `utils/` 配下の `gpt-5.6-luna`: ヒットなし（`gpt-6-luna` のみ。本ドキュメントの記述は除く）
- `CHANGELOG.md` の見出し数とタグ数の一致: 64 / 64

---

## 5. コミット分割案

1. `feat(translation): update default model to gpt-6-luna`（#1）
2. `docs(changelog): add release history and maintenance guidelines`（#2 / #3、本ドキュメントを含む）

バージョン bump は行わない。

---

## 6. リスクと注意点

- `CHANGELOG.md` は 64 バージョン分の履歴を持つため、生成時に各タグの差分を確認する。
  コミット件名だけで判断せず、`extension/` の差分を見てユーザー可視の変更だけを記述する
- 命名が揺れたタグ `1.4.25` / `v.1.4.34` は、見出しとリンク先で表記が異なる。
  リンク切れを避けるため、リンク先は実タグ名のままとする
- `utils/translation/` は開発用ヘルパーであり、拡張機能の実行時挙動には影響しない

---

## 7. スコープ外・将来の検討

- Gemini版の `test/` / `e2e/` 基盤の移植（Claude版にテストが無いため継続して対象外）
- `.md` / `.html` 形式での保存やヘッダの ON/OFF 設定化（第3回からの継続検討事項）
- 翻訳ヘルパーの既定モデルは Gemini版と合わせて更新し続ける必要がある。
  次回以降も `utils/translation/translate.js` の `MODEL` を同期対象として確認する
