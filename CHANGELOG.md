# Changelog

<!-- markdownlint-disable MD024 -- Each version repeats the same section names. -->

All notable changes to this project are documented in this file.

The changelog covers every released version, starting from the first
tagged release, 0.9.1. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.44] - 2026-10-08

### Added

- Claude Haiku 5.5 is available as a language model option.

### Changed

- Claude Haiku 5.5 became the default language model, replacing Claude
  Haiku 4.5.

## [1.4.43] - 2026-10-04

### Added

- Claude Sonnet 5.5 is available as a language model option.

### Changed

- Claude Sonnet 4.5 was removed from the language model options, because
  Anthropic deprecated the model in favor of Claude Sonnet 5.5.
- A saved Claude Sonnet 4.5 selection falls back to the default model.

## [1.4.42] - 2026-09-24

### Added

- Claude Opus 5.5 is available as a language model option.

## [1.4.41] - 2026-09-23

### Added

- Copied and saved content now starts with the page title and URL, so a
  pasted summary keeps its source.

### Changed

- Header generation is shared by the popup and the results page through a
  single helper, so the clipboard copy and the saved file no longer drift
  apart.
- The source title is emitted as a bold paragraph instead of a heading, and
  right-to-left content keeps its direction in the pasted HTML.

## [1.4.40] - 2026-09-21

### Added

- Copy writes both plain text and HTML, so pasting into a rich text editor
  keeps the formatting of the result and the follow-up conversation.

### Fixed

- Question styling on the results page moved from inline JavaScript to the
  page stylesheet, so the copied HTML stays consistent.

## [1.4.39] - 2026-09-05

### Added

- Claude Fable 5.1 is available as a language model option.

## [1.4.38] - 2026-08-29

### Fixed

- Page text extraction falls back to `document.body.innerText` when
  Readability returns only a short fragment, avoiding content loss on
  comment-heavy pages such as Reddit threads.

## [1.4.37] - 2026-08-22

### Changed

- The popup header stays stable when the viewport width changes.
- Removed an unnecessary fixed width from the results page.

## [1.4.36] - 2026-08-20

### Changed

- The results page body width adapts to the viewport for responsive
  layouts.

## [1.4.35] - 2026-08-02

### Changed

- The built-in summary and translation prompts now spell out detailed
  output requirements for more consistent results.

### Fixed

- Emphasis with bracketed spans is parsed correctly in CJK text.
- A task input that contains only whitespace is treated as empty.
- Parentheses in the Japanese and Traditional Chinese locales use
  full-width characters consistently.

## [1.4.34] - 2026-07-25

### Added

- Claude 5 models are available in the language model dropdown.
- Markdown links with unsafe URL protocols are removed from rendered
  output.

### Changed

- Utility functions and UI helpers were refactored across the options,
  popup, and results pages.

## [1.4.33] - 2026-06-20

### Added

- The original page title is shown on the results page and used as the
  document title.

### Changed

- Vendored libraries (`Readability`, `marked`, and `DOMPurify`) were
  updated to their latest versions.
- The built-in prompts handle follow-up questions.

## [1.4.32] - 2026-06-14

### Added

- Claude Opus 4.8 is available as a language model option.
- `AGENTS.md` documents the project structure and conventions.

### Changed

- Popup and results handling, loading messages, and conversation
  validation were refactored.
- The ESLint configuration and scripts were modernized.

## [1.4.31] - 2026-05-03

### Changed

- Wording in the options and popup pages, the README, and the language
  model options was clarified.

## [1.4.30] - 2026-04-11

### Fixed

- Updated the YouTube transcript renderer selector for compatibility with
  the current page structure.

## [1.4.29] - 2026-04-04

### Changed

- Enabling and disabling controls in the popup and results pages was
  simplified.

## [1.4.28] - 2026-03-28

### Fixed

- The YouTube transcript renderer was updated for compatibility with
  YouTube's structure.

## [1.4.27] - 2026-03-14

### Changed

- Response handling and user feedback in the popup and results pages were
  improved, and the localization messages were updated.

## [1.4.26] - 2026-03-08

### Changed

- Loading message handling was simplified.
- Transcript retrieval now supports multiple renderer variants.

## [1.4.25] - 2026-02-21

### Added

- New language model options.

### Changed

- The default language model is defined by a single constant.

## [1.4.24] - 2026-01-17

### Changed

- Content handling and the `generateContent` / `streamGenerateContent`
  signatures were refactored for clarity.

### Fixed

- Transcript retrieval uses more robust selectors and error handling.

## [1.4.23] - 2025-12-30

### Added

- Claude Opus 4.5 is available as a language model option.

### Changed

- Protobuf-based transcript extraction was removed in favor of simpler
  caption retrieval.
- The unused max output tokens parameter was removed.

## [1.4.22] - 2025-11-02

### Fixed

- The question input stays selectable (read-only instead of disabled)
  while a response is being generated.

## [1.4.21] - 2025-10-30

### Added

- Pressing Ctrl/Cmd+Enter sends a follow-up question.

## [1.4.20] - 2025-10-17

### Added

- Claude Haiku 4.5 became the default language model.

### Fixed

- Conversation indexing and button enablement were made consistent.

## [1.4.19] - 2025-09-21

### Added

- Save buttons in the popup and on the results page.
- Image and PDF summarization is documented in the README.

### Changed

- References to the "Anthropic API key" were renamed to "Claude API key",
  and the localization messages were refreshed.

## [1.4.18] - 2025-09-15

### Fixed

- Streaming output uses a dedicated stream key and session storage entry.

## [1.4.17] - 2025-08-16

### Added

- Claude Opus 4.1 is available as a language model option.

## [1.4.16] - 2025-07-26

### Changed

- Removed unnecessary scroll-to-bottom behavior from the popup and results
  pages.

## [1.4.15] - 2025-06-29

### Changed

- Updated the Anthropic API link text and the YouTube caption client
  version.

## [1.4.14] - 2025-06-21

### Changed

- Claude 3.5 Haiku became the default language model.
- A loading message is shown while captions are retrieved.
- An API key prompt is shown when no key is configured.
- Localization messages were updated for clarity.

## [1.4.13] - 2025-06-16

### Added

- Protobuf-based YouTube caption extraction with an updated fetch flow.

## [1.4.12] - 2025-05-23

### Changed

- The options restore/save logic was consolidated and status messages were
  improved.
- Language model options and character limits were updated.

## [1.4.11] - 2025-04-29

### Added

- Font size options in the settings.

### Changed

- Layout is handled with responsive CSS instead of JavaScript screen-size
  checks.

## [1.4.10] - 2025-03-16

### Changed

- The options UI was improved for accessibility.
- The Markdown conversion utility was updated.

## [1.4.9] - 2025-02-26

### Added

- Claude 3.7 support with updated character limits.

## [1.4.8] - 2025-02-01

### Fixed

- Streaming response errors are handled and partial content is processed
  more reliably.

## [1.4.7] - 2025-01-27

### Added

- Copy buttons and status messages.

## [1.4.6] - 2025-01-26

### Added

- An option to stream the language model output.

## [1.4.5] - 2025-01-18

### Fixed

- Script execution errors during page extraction are handled.

## [1.4.4] - 2025-01-13

### Changed

- Reformatted the Russian locale messages for readability.

## [1.4.3] - 2025-01-13

### Added

- A theme selection option.

## [1.4.2] - 2025-01-04

### Fixed

- The response cache uses a queue for more reliable management.
- YouTube captions can be retrieved for the `zz` language code.

## [1.4.1] - 2024-12-31

### Added

- A user-specified language option.
- A translation helper for the store description.

## [1.4.0] - 2024-12-30

### Added

- Follow-up questions on the results page.
- A shared `utils.js` module and dropdown templates.
- `generateContent` for API calls.

### Changed

- The popup, options, and results pages were refactored to use modules and
  shared helpers.

## [1.3.3] - 2024-11-09

### Added

- Claude 3.5 Haiku is available as a language model option.
- Media type handling for image input.

## [1.3.2] - 2024-10-27

### Changed

- The language model options were consolidated.

## [1.3.1] - 2024-10-14

### Fixed

- YouTube mobile URLs are handled during page extraction.

## [1.3.0] - 2024-10-06

### Changed

- The popup, options, and results pages were updated for responsive
  design.

## [1.2.11] - 2024-09-28

### Added

- DOMPurify sanitizes dynamically rendered HTML.
- A Firefox manifest override.

## [1.2.10] - 2024-09-15

### Added

- A keyboard shortcut for the summarize/translate action.

## [1.2.9] - 2024-08-31

### Changed

- The translation input limit was raised to 8192 characters for Claude 3.5
  Sonnet.

## [1.2.8] - 2024-08-31

### Fixed

- Improved error logging in the popup and service worker.

## [1.2.7] - 2024-08-24

### Changed

- Updated the manifest and service worker for API changes.

## [1.2.6] - 2024-06-20

### Added

- Claude 3.5 Sonnet is available as a language model option.

## [1.2.5] - 2024-06-15

### Added

- Hindi and Bengali localization.

## [1.2.4] - 2024-06-14

### Added

- Arabic localization.
- Right-to-left layout support on the results page.

## [1.2.3] - 2024-06-11

### Added

- ESLint configuration.

### Changed

- Task information extraction and the results button handling were
  refactored.
- Cached task and response data are cleared before generating content.

## [1.2.2] - 2024-05-23

### Added

- Vietnamese localization.

## [1.2.1] - 2024-05-14

### Added

- Copy functionality on the results page.

## [1.2.0] - 2024-04-01

### Added

- Options to customize the summary and translation prompts.

## [1.1.0] - 2024-03-17

### Added

- Image summarization.
- Language selection in the popup.

## [1.0.0] - 2024-03-16

### Added

- YouTube video caption summarization.
- Localization for German, Spanish, French, Italian, Korean, Portuguese,
  Russian, Simplified Chinese, and Traditional Chinese.

## [0.9.3] - 2024-03-15

### Changed

- Updated the service worker prompt format.

## [0.9.2] - 2024-03-14

### Added

- Language model selection in the options page.

## [0.9.1] - 2024-03-11

### Added

- Initial release. Summarize or translate the current web page with the
  Anthropic Claude API.
- Popup UI, an options page for the API key, and UI localization for
  English and Japanese.

[1.4.44]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.44
[1.4.43]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.43
[1.4.42]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.42
[1.4.41]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.41
[1.4.40]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.40
[1.4.39]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.39
[1.4.38]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.38
[1.4.37]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.37
[1.4.36]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.36
[1.4.35]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.35
[1.4.34]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.34
[1.4.33]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.33
[1.4.32]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.32
[1.4.31]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.31
[1.4.30]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.30
[1.4.29]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.29
[1.4.28]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.28
[1.4.27]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.27
[1.4.26]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.26
[1.4.25]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.25
[1.4.24]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.24
[1.4.23]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.23
[1.4.22]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.22
[1.4.21]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.21
[1.4.20]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.20
[1.4.19]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.19
[1.4.18]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.18
[1.4.17]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.17
[1.4.16]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.16
[1.4.15]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.15
[1.4.14]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.14
[1.4.13]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.13
[1.4.12]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.12
[1.4.11]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.11
[1.4.10]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.10
[1.4.9]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.9
[1.4.8]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.8
[1.4.7]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.7
[1.4.6]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.6
[1.4.5]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.5
[1.4.4]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.4
[1.4.3]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.3
[1.4.2]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.2
[1.4.1]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.1
[1.4.0]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.4.0
[1.3.3]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.3.3
[1.3.2]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.3.2
[1.3.1]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.3.1
[1.3.0]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.3.0
[1.2.11]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.2.11
[1.2.10]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.2.10
[1.2.9]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.2.9
[1.2.8]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.2.8
[1.2.7]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.2.7
[1.2.6]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.2.6
[1.2.5]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.2.5
[1.2.4]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.2.4
[1.2.3]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.2.3
[1.2.2]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.2.2
[1.2.1]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.2.1
[1.2.0]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.2.0
[1.1.0]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.1.0
[1.0.0]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v1.0.0
[0.9.3]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v0.9.3
[0.9.2]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v0.9.2
[0.9.1]: https://github.com/sh2/extension-summarize-translate-claude/releases/tag/v0.9.1
