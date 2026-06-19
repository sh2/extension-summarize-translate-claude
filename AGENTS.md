# AGENTS.md

## Project overview

Cross-browser extension (Chrome, Firefox, Edge) that uses the Anthropic Claude API to summarize and translate web pages. It also supports YouTube caption summarization, image/PDF summarization, follow-up questions, custom actions, and streaming LLM output.

- **Platform:** Chrome Extension Manifest V3
- **Language:** Vanilla JavaScript (ES modules) — no TypeScript, no bundler, no framework
- **API backend:** Anthropic Claude API
- **Version source:** `extension/manifest.json` and `firefox/manifest.json`

## Core rules

- `generateContent()` and `streamGenerateContent()` in `extension/utils.js` are the only entry points for LLM calls.
- Keep changes inside `extension/` unless the task is specifically about `firefox/` manifests or the translation helper scripts in `utils/`.
- Do not edit files in `extension/lib/`.
- Always use block braces `{}` for control statements such as `if`, `else`, `for`, and `while` (brace-less single-line statements like `if (cond) return;` are strictly prohibited). This is a manual convention; ESLint does not currently enforce it.

## Task routing

- Popup UI, page extraction, image/PDF input: `extension/popup.html` and `extension/popup.js`
- Results tab, follow-up conversation, streaming display: `extension/results.html` and `extension/results.js`
- Options UI, API key, model/language settings: `extension/options.html` and `extension/options.js`
- Background logic, API calls, caching, keyboard shortcut: `extension/service-worker.js`
- Claude API logic, shared utilities, error handling, theme helpers: `extension/utils.js`
- Dropdown templates: `extension/templates.html`
- Localized strings: `extension/_locales/*/messages.json`
- Firefox-specific changes: `firefox/manifest.json`

## Validation

- After code changes, run `npm run lint` and fix relevant errors before finishing.
- When updating the extension version, update both `extension/manifest.json` and `firefox/manifest.json`.

## Notes

- `firefox/` only contains a manifest override; the extension source lives under `extension/`.
- `extension/manifest.json` defines the unpacked extension structure, permissions, and content scripts.
- Claude model IDs are mapped in `getModelId()` inside `extension/utils.js`. Update that mapping (and `DEFAULT_LANGUAGE_MODEL` if needed) when adding support for new Claude models. The Anthropic API version header is also set in `extension/utils.js`.

## Custom error codes (1000+)

Defined in `extension/utils.js`. Used internally when API calls fail before receiving an HTTP status.

| Code | Meaning |
| --- | --- |
| 1000 | Network error (fetch failed) |

## Updating vendored libraries

The files under `extension/lib/` are third-party libraries. Do not edit them in place. When updating, replace them with the latest minified builds downloaded from jsDelivr.

Current vendored files:

| File | Package | jsDelivr URL template |
| --- | --- | --- |
| `extension/lib/Readability.min.js` | `@mozilla/readability` | `https://cdn.jsdelivr.net/npm/@mozilla/readability@<version>/Readability.min.js` |
| `extension/lib/marked.umd.min.js` | `marked` | `https://cdn.jsdelivr.net/npm/marked@<version>/lib/marked.umd.min.js` |
| `extension/lib/purify.min.js` | `dompurify` | `https://cdn.jsdelivr.net/npm/dompurify@<version>/dist/purify.min.js` |

Steps to update:

1. Check the latest version on npm or GitHub for each package listed above.
2. Download the minified build for the new version from the jsDelivr URL template, preserving the exact file names under `extension/lib/`.
3. Do not modify the downloaded file contents.
4. Run `npm run lint` after replacing the files.
5. Verify the version strings in the file headers (e.g. `/npm/@mozilla/readability@0.6.0/Readability.js`, `marked@18.0.5`, `DOMPurify 3.4.11`).
