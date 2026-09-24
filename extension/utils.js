/* globals DOMPurify, marked */

export const DEFAULT_LANGUAGE_MODEL = "4.5-haiku";

// ── UI helpers ──────────────────────────────────────────────────────────────

export const applyTheme = (theme) => {
  if (theme === "light") {
    document.body.setAttribute("data-theme", "light");
  } else if (theme === "dark") {
    document.body.setAttribute("data-theme", "dark");
  } else {
    document.body.removeAttribute("data-theme");
  }
};

export const applyFontSize = (fontSize) => {
  if (fontSize === "large") {
    document.body.setAttribute("data-font-size", "large");
  } else if (fontSize === "small") {
    document.body.setAttribute("data-font-size", "small");
  } else {
    document.body.setAttribute("data-font-size", "medium");
  }
};

export const loadTemplate = async (templateId) => {
  try {
    const response = await fetch(chrome.runtime.getURL("templates.html"));

    if (response.ok) {
      const text = await response.text();
      const parser = new DOMParser();
      const document = parser.parseFromString(text, "text/html");
      const element = document.getElementById(templateId);

      if (element) {
        return element.content.cloneNode(true);
      } else {
        console.error(`Failed to find the template: ${templateId}`);
        return null;
      }
    } else {
      console.error(`Failed to load the template: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const displayLoadingMessage = (elementId, loadingMessage) => {
  const status = document.getElementById(elementId);

  switch (status.textContent) {
    case `${loadingMessage}.`:
      status.textContent = `${loadingMessage}..`;
      break;
    case `${loadingMessage}..`:
      status.textContent = `${loadingMessage}...`;
      break;
    default:
      status.textContent = `${loadingMessage}.`;
  }
};

const allowedUrlProtocols = new Set(["http:", "https:"]);

const isAllowedUrlProtocol = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  try {
    const url = new URL(trimmedValue);
    return allowedUrlProtocols.has(url.protocol);
  } catch {
    return false;
  }
};

const removeUnsafeMarkdownUrls = (container) => {
  container.querySelectorAll("a[href], img[src]").forEach((element) => {
    const attributeName = element.tagName === "A" ? "href" : "src";
    const attributeValue = element.getAttribute(attributeName);

    if (!isAllowedUrlProtocol(attributeValue)) {
      element.removeAttribute(attributeName);
    }
  });
};

// CJK emphasis fix: CommonMark flanking rules prevent emphasis delimiters `**`
// from parsing when they are adjacent to CJK characters and opening/closing
// brackets (e.g. `「」（）`), leaving them as literal text or mispaired.
const CJK_EMPHASIS_OPENER_PATTERN = /([^\s\p{P}\p{S}])(\*+)(?=[\p{Ps}\p{Pi}])/gu;
const CJK_EMPHASIS_CLOSER_PATTERN = /(?<=[\p{Pe}\p{Pf}])(\*+)([^\s\p{P}\p{S}])/gu;
const MARKDOWN_CODE_SEGMENT_PATTERN = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;

const fixCjkEmphasisDelimiters = (text) => {
  return text
    .replace(CJK_EMPHASIS_OPENER_PATTERN, "$1 $2")
    .replace(CJK_EMPHASIS_CLOSER_PATTERN, "$1 $2");
};

const fixCjkEmphasisOutsideCodeSegments = (text) => {
  return text
    .split(MARKDOWN_CODE_SEGMENT_PATTERN)
    .map((segment, index) => (index % 2 === 1 ? segment : fixCjkEmphasisDelimiters(segment)))
    .join("");
};

const hasUnmatchedEmphasisMarkers = (container) => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (!node.parentElement.closest("code, pre") && node.textContent.includes("**")) {
      return true;
    }

    node = walker.nextNode();
  }

  return false;
};

export const convertMarkdownToHtml = (content, breaks, fixEmphasis = false) => {
  // Disable links when converting from Markdown to HTML
  marked.use({ renderer: { link: ({ text }) => text } });

  const markdownDiv = document.createElement("div");
  markdownDiv.textContent = content;
  const htmlDiv = document.createElement("div");
  htmlDiv.innerHTML = DOMPurify.sanitize(marked.parse(markdownDiv.innerHTML, { breaks: breaks }));

  if (fixEmphasis && hasUnmatchedEmphasisMarkers(htmlDiv)) {
    // Re-parse from the fixed source (markdownDiv.innerHTML is HTML-escaped text).
    // CJK characters, brackets, and asterisks are not HTML-escaped, so the regexes
    // operate on the original text as-is.
    htmlDiv.innerHTML = DOMPurify.sanitize(
      marked.parse(fixCjkEmphasisOutsideCodeSegments(markdownDiv.innerHTML), { breaks: breaks })
    );
  }

  removeUnsafeMarkdownUrls(htmlDiv);

  // Replace the HTML entities with the original characters in the code blocks
  htmlDiv.querySelectorAll("code").forEach(codeBlock => {
    codeBlock.innerHTML = codeBlock.innerHTML
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");
  });

  return htmlDiv.innerHTML;
};

export const exportTextToFile = (text) => {
  const currentDate = new Date();
  const adjustedDate = new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000);
  const localDateTimeString = adjustedDate.toISOString().split(".")[0].replaceAll("T", "_").replaceAll(":", "-");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `claude-results_${localDateTimeString}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

// Builds the source attribution (page title and URL) that the Copy and Save actions
// share. Returning the plain text and the HTML fragment together keeps the two payloads
// from drifting apart, which is what made the copied text and the saved file differ.
// The text already ends with a blank line, and the fragment is null when there is
// nothing to attribute.
export const buildSourceHeader = (title, url) => {
  const lines = [];

  if (title) {
    lines.push(title);
  }

  if (url) {
    lines.push(url);
  }

  const text = lines.length > 0 ? `${lines.join("\n")}\n\n` : "";

  if (lines.length === 0) {
    return { text, fragment: null };
  }

  // The pasted HTML is rendered where the extension stylesheet does not exist, so the
  // markup carries semantics only: no class, no inline style, and the title is set
  // through textContent so that Markdown or HTML inside a page title stays literal.
  // See docs/archive/RESEARCH_WORD_HTML_PASTE.md.
  //
  // Both header elements carry dir="auto" so that the dir="auto" wrapper added by
  // copyContentToClipboard() skips them (auto directionality resolution ignores an
  // element that has a dir attribute) and keeps resolving the pasted block from the
  // body. Without it, a title that starts with a Latin character would turn an RTL body
  // into a left-aligned block.
  const fragment = document.createDocumentFragment();

  if (title) {
    // A bold paragraph instead of a heading: Word and Gmail render a heading far larger
    // than the surrounding text, which reads as oversized for a line of attribution.
    const titleElement = document.createElement("p");
    const titleText = document.createElement("strong");

    titleElement.setAttribute("dir", "auto");
    titleText.textContent = title;
    titleElement.appendChild(titleText);
    fragment.appendChild(titleElement);
  }

  if (url) {
    const urlElement = document.createElement("p");

    urlElement.setAttribute("dir", "auto");

    // Only http(s) becomes a link, matching the policy of removeUnsafeMarkdownUrls.
    // Other schemes (file:, view-source:, chrome-extension:) would leave a link that
    // only works on the sender's machine, so the URL stays plain text.
    if (isAllowedUrlProtocol(url)) {
      const anchor = document.createElement("a");
      anchor.setAttribute("href", url);
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
      anchor.textContent = url;
      urlElement.appendChild(anchor);
    } else {
      urlElement.textContent = url;
    }

    fragment.appendChild(urlElement);
  }

  return { text, fragment };
};

// Collects the rendered fragment so that the copied HTML matches what is displayed.
// Inline (data URL) images are dropped so that the copied payload stays text only,
// matching the plain text copy. Images referenced by a URL are kept.
const buildClipboardFragment = (...roots) => {
  const container = document.createElement("div");

  for (const root of roots) {
    if (!root) {
      continue;
    }

    // Move nodes out of a clone so that the live DOM is left untouched.
    for (const node of Array.from(root.cloneNode(true).childNodes)) {
      container.appendChild(node);
    }
  }

  // Drop inline (data URL) images so that the copied HTML stays text only.
  container.querySelectorAll('img[src^="data:"]').forEach((image) => {
    image.remove();
  });

  return container;
};

// Writes plain text and rich HTML in one clipboard item. The plain text is always written
// so that the copy still succeeds when HTML is unavailable or unsupported. `sourceFragment`
// is the fragment returned by buildSourceHeader() and is dropped when the rendered body is
// empty, so that a copy made before the result is displayed never pastes an
// attribution-only fragment.
export const copyContentToClipboard = async (text, sourceFragment, ...roots) => {
  const clipboard = navigator.clipboard;
  const body = buildClipboardFragment(...roots);
  const canWriteHtml = body.innerHTML !== "" && typeof ClipboardItem !== "undefined" && typeof clipboard?.write === "function";

  if (!canWriteHtml) {
    await clipboard.writeText(text);
    return;
  }

  // A single dir="auto" wrapper keeps the direction of RTL content in the pasted HTML.
  const container = document.createElement("div");
  container.setAttribute("dir", "auto");

  // Clone the fragment: appendChild moves a fragment's children out, and the caller may
  // still hold the fragment after the call.
  if (sourceFragment) {
    container.appendChild(sourceFragment.cloneNode(true));
  }

  for (const node of Array.from(body.childNodes)) {
    container.appendChild(node);
  }

  try {
    await clipboard.write([new ClipboardItem({
      "text/html": new Blob([container.outerHTML], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" })
    })]);
  } catch (error) {
    // Expected on browsers without HTML clipboard support: fall back to text.
    console.log("Failed to copy HTML content. Falling back to plain text:", error);
    await clipboard.writeText(text);
  }
};

// ── Claude API helpers ──────────────────────────────────────────────────────

const tryParseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
};

export const getModelId = (languageModel) => {
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

  return modelMappings[languageModel];
};

export const generateContent = async (apiKey, systemPrompt, apiContents, modelId) => {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 4096,
        system: systemPrompt,
        messages: apiContents
      })
    });

    return {
      ok: response.ok,
      status: response.status,
      body: tryParseJson(await response.text())
    };
  } catch (error) {
    return {
      ok: false,
      status: 1000,
      body: { error: { message: error.stack } }
    };
  }
};

export const streamGenerateContent = async (apiKey, systemPrompt, apiContents, modelId, streamKey) => {
  try {
    await chrome.storage.session.remove(streamKey);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 4096,
        system: systemPrompt,
        messages: apiContents,
        stream: true
      })
    });

    if (response.ok) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let content = "";
      let body = {};

      while (true) {
        const { value, done } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          while (lines.length >= 3) {
            const event = lines.shift().slice(7);
            const data = lines.shift().slice(6);
            lines.shift(); // empty line

            if (event === "message_start") {
              // Set the first metadata received to body
              body = JSON.parse(data).message;
            } else if (event === "message_delta") {
              // Set the delta of the metadata to body
              const json = JSON.parse(data);
              body.stop_reason = json.delta.stop_reason;
              body.stop_sequence = json.delta.stop_sequence;
              body.usage.output_tokens = json.usage.output_tokens;
            } else if (event === "content_block_delta") {
              // Get the delta of the content and concatenate it
              const json = JSON.parse(data);
              content += json.delta.text;

              // Set the stream content to session storage
              await chrome.storage.session.set({ [streamKey]: content });
            }
          }

          buffer = lines.join("\n");
        }

        if (done) {
          break;
        }
      }

      // Add the final result of content to body
      body.content = [{ type: "text", text: content }];

      return {
        ok: response.ok,
        status: response.status,
        body: body
      };
    } else {
      return {
        ok: response.ok,
        status: response.status,
        body: tryParseJson(await response.text())
      };
    }
  } catch (error) {
    return {
      ok: false,
      status: 1000,
      body: { error: { message: error.stack } }
    };
  }
};

export const getResponseContent = (response, hasApiKey) => {
  let responseContent;

  if (response.ok) {
    if (response.body.content) {
      // A normal response was returned
      responseContent = response.body.content[0].text;
    } else {
      // The expected response was not returned
      responseContent = chrome.i18n.getMessage("response_unexpected_response");
    }
  } else {
    // A response error occurred
    responseContent = `Error: ${response.status}\n\n${response.body.error.message}`;

    if (!hasApiKey) {
      // If the API Key is not set, add a message to prompt the user to set it
      responseContent += `\n\n${chrome.i18n.getMessage("response_no_apikey")}`;
    }
  }

  return responseContent;
};
