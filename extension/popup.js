/* globals Readability */

import {
  DEFAULT_LANGUAGE_MODEL,
  applyTheme,
  applyFontSize,
  loadTemplate,
  displayLoadingMessage,
  convertMarkdownToHtml,
  getResponseContent,
  exportTextToFile,
  buildSourceHeader,
  copyContentToClipboard
} from "./utils.js";

let resultIndex = 0;
let content = "";
let pageUrl = "";
let pageTitle = "";

// ── Pure utilities (no DOM access, no side effects) ────────────────────────

const getLoadingMessage = (actionType, mediaType) => {
  let loadingMessage;

  if (actionType === "summarize") {
    if (mediaType === "captions") {
      loadingMessage = chrome.i18n.getMessage("popup_summarizing_captions");
    } else if (mediaType === "image") {
      loadingMessage = chrome.i18n.getMessage("popup_summarizing_image");
    } else {
      loadingMessage = chrome.i18n.getMessage("popup_summarizing");
    }
  } else if (actionType === "translate") {
    if (mediaType === "captions") {
      loadingMessage = chrome.i18n.getMessage("popup_translating_captions");
    } else if (mediaType === "image") {
      loadingMessage = chrome.i18n.getMessage("popup_translating_image");
    } else {
      loadingMessage = chrome.i18n.getMessage("popup_translating");
    }
  } else {
    loadingMessage = chrome.i18n.getMessage("popup_processing");
  }

  return loadingMessage;
};

// ── Content script injection utilities ──────────────────────────────────────

const getSelectedText = () => {
  return window.getSelection().toString();
};

const getWholeText = () => {
  // Readability can return only a short fragment on comment-heavy pages
  // (e.g. Reddit). If the extracted text is too short (< 500 chars,
  // Readability's DEFAULT_CHAR_THRESHOLD), fall back to document.body.innerText
  // to avoid losing content.
  const documentClone = document.cloneNode(true);
  const article = new Readability(documentClone).parse();
  const extractedText = article?.textContent || "";

  // Use whitespace-collapsed length to match Readability's counting.
  const normalizedLength = extractedText.replace(/\s+/g, " ").trim().length;

  if (normalizedLength >= 500) {
    return extractedText;
  }

  console.log(`Failed to extract enough text (${normalizedLength} chars). Using document.body.innerText instead.`);
  return document.body?.innerText || "";
};

const getTranscript = async () => {
  const TRANSCRIPT_VARIANTS = [
    {
      RENDERER: "yt-section-list-renderer",
      SEGMENTS: "transcript-segment-view-model",
      TEXT: ".ytAttributedStringHost"
    },
    {
      RENDERER: "ytd-transcript-renderer",
      SEGMENTS: "ytd-transcript-segment-renderer",
      TEXT: "yt-formatted-string"
    }
  ];

  const getTranscriptElements = () => {
    for (const variant of TRANSCRIPT_VARIANTS) {
      const renderer = document.querySelector(variant.RENDERER);
      const segments = renderer ? renderer.querySelectorAll(variant.SEGMENTS) : [];

      if (segments.length > 0) {
        return { variant, segments };
      }
    }

    return null;
  };

  const waitForTranscriptSegments = async () => {
    let lastLength = 0;
    let matchCount = 0;

    for (let i = 0; i < 20; i++) {
      const transcriptElements = getTranscriptElements();
      const currentLength = transcriptElements ? transcriptElements.segments.length : 0;

      if (currentLength > 0 && currentLength === lastLength) {
        matchCount++;

        if (matchCount >= 2) {
          return transcriptElements;
        }
      } else {
        matchCount = 0;
      }

      lastLength = currentLength;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error("transcript segments not found within 10 seconds.");
  };

  const openButton = document.querySelector("ytd-video-description-transcript-section-renderer button");

  if (!openButton) {
    return "";
  }

  openButton.click();

  try {
    const { variant, segments } = await waitForTranscriptSegments();

    const transcriptTexts = Array.from(segments).map((segment) => {
      const textElement = segment.querySelector(variant.TEXT);
      return textElement ? textElement.textContent.trim() : "";
    });

    return transcriptTexts.join("\n");
  } catch (error) {
    console.log(error);
    return "";
  }
};

// ── UI helpers ──────────────────────────────────────────────────────────────

const setPopupControlsEnabled = (enabled) => {
  document.getElementById("run").disabled = !enabled;
  document.getElementById("languageModel").disabled = !enabled;
  document.getElementById("languageCode").disabled = !enabled;
  document.getElementById("copy").disabled = !enabled;
  document.getElementById("save").disabled = !enabled;
  document.getElementById("results").disabled = !enabled;
};

const clearContentArea = () => {
  document.getElementById("content").textContent = "";
  document.getElementById("status").textContent = "";
};

const showResultsLink = (show) => {
  document.getElementById("results-link").style.display = show ? "block" : "none";
};

const renderStreamContent = (streamContent) => {
  document.getElementById("content").innerHTML = convertMarkdownToHtml(streamContent, false);
};

// ── Button action handlers ──────────────────────────────────────────────────

const copyContent = async () => {
  try {
    const operationStatus = document.getElementById("operation-status");
    const { text, fragment } = buildSourceHeader(pageTitle, pageUrl);
    const clipboardContent = `${text}${content.replace(/\n+$/, "")}\n\n`;

    // Copy the content to the clipboard
    await copyContentToClipboard(clipboardContent, fragment, document.getElementById("content"));
    operationStatus.textContent = chrome.i18n.getMessage("popup_copied");

    setTimeout(() => {
      operationStatus.textContent = "";
    }, 1000);
  } catch (error) {
    console.log("Failed to copy content:", error);
  }
};

const saveContent = () => {
  const operationStatus = document.getElementById("operation-status");
  const { text } = buildSourceHeader(pageTitle, pageUrl);
  let fileContent = text;

  fileContent += `${content.replace(/\n+$/, "")}\n\n`;

  exportTextToFile(fileContent);
  operationStatus.textContent = chrome.i18n.getMessage("popup_saved");

  setTimeout(() => {
    operationStatus.textContent = "";
  }, 1000);
};

// ── Core async logic ────────────────────────────────────────────────────────

const extractTaskInformation = async () => {
  let actionType;
  let mediaType = "";
  let taskInput = "";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    taskInput = (await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getSelectedText
    }))[0].result;
  } catch (error) {
    console.log(error);
  }

  if (taskInput?.trim()) {
    actionType = (await chrome.storage.local.get({ textAction: "translate" })).textAction;
    mediaType = "text";
  } else {
    actionType = (await chrome.storage.local.get({ noTextAction: "summarize" })).noTextAction;

    if (tab.url.startsWith("https://www.youtube.com/watch?")) {
      mediaType = "captions";

      const displayIntervalId = setInterval(displayLoadingMessage, 500, "status", chrome.i18n.getMessage("popup_retrieving_captions"));

      try {
        taskInput = (await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: getTranscript
        }))[0].result;
      } catch (error) {
        console.log(error);
      } finally {
        clearInterval(displayIntervalId);
      }
    }

    if (!taskInput?.trim()) {
      mediaType = "text";

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["lib/Readability.min.js"]
        });

        taskInput = (await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: getWholeText
        }))[0].result;
      } catch (error) {
        console.log(error);
      }
    }

    if (!taskInput?.trim()) {
      mediaType = "image";
      taskInput = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg" });
    }
  }

  return { actionType, mediaType, taskInput, url: tab.url, title: tab.title };
};

const main = async (useCache) => {
  let displayIntervalId = 0;
  let responseContent;

  content = "";
  pageUrl = "";
  pageTitle = "";
  resultIndex = (await chrome.storage.session.get({ resultIndex: -1 })).resultIndex;
  resultIndex = (resultIndex + 1) % 10;
  await chrome.storage.session.set({ resultIndex: resultIndex });

  // Clear stale result and conversation to prevent results.html from picking up old data
  await chrome.storage.session.remove(`result_${resultIndex}`);
  await chrome.storage.session.remove(`conversation_${resultIndex}`);

  try {
    const { apiKey, streaming } = await chrome.storage.local.get({ apiKey: "", streaming: false });
    const languageModel = document.getElementById("languageModel").value;
    const languageCode = document.getElementById("languageCode").value;

    clearContentArea();
    setPopupControlsEnabled(false);

    const { actionType, mediaType, taskInput, url, title } = await extractTaskInformation();
    pageUrl = url;
    pageTitle = title;
    displayIntervalId = setInterval(displayLoadingMessage, 500, "status", getLoadingMessage(actionType, mediaType));

    const { responseCacheQueue } = await chrome.storage.session.get({ responseCacheQueue: [] });
    const cacheIdentifier = JSON.stringify({ actionType, mediaType, taskInput, languageModel, languageCode });
    const responseCache = responseCacheQueue.find((item) => item.key === cacheIdentifier);

    if (useCache && responseCache) {
      const { requestMediaType, requestSystemPrompt, requestApiContent, responseContent: cachedResponseContent } = responseCache.value;
      responseContent = cachedResponseContent;

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
    } else {
      const streamKey = `streamContent_${resultIndex}`;
      let streamIntervalId = 0;

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

      console.log("Request:", {
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

      if (streaming) {
        streamIntervalId = setInterval(async () => {
          const streamContent = (await chrome.storage.session.get({ [streamKey]: "" }))[streamKey];

          if (streamContent) {
            renderStreamContent(streamContent);
          }
        }, 1000);
      }

      const timeoutId = setTimeout(() => {
        showResultsLink(true);
      }, 5000);

      const response = await responsePromise;
      console.log("Response:", response);
      responseContent = getResponseContent(response, Boolean(apiKey));

      clearTimeout(timeoutId);
      showResultsLink(false);
      clearInterval(streamIntervalId);
    }

    content = responseContent;
  } catch (error) {
    content = chrome.i18n.getMessage("popup_miscellaneous_error");
    console.error(error);
  } finally {
    clearInterval(displayIntervalId);
    document.getElementById("content").innerHTML = convertMarkdownToHtml(content, false, true);
    document.getElementById("status").textContent = "";
    setPopupControlsEnabled(true);
  }
};

const initialize = async () => {
  applyTheme((await chrome.storage.local.get({ theme: "system" })).theme);
  applyFontSize((await chrome.storage.local.get({ fontSize: "medium" })).fontSize);

  const languageModelTemplate = await loadTemplate("languageModelTemplate");
  document.getElementById("languageModelContainer").appendChild(languageModelTemplate);

  const languageCodeTemplate = await loadTemplate("languageCodeTemplate");
  document.getElementById("languageCodeContainer").appendChild(languageCodeTemplate);

  document.body.setAttribute("dir", chrome.i18n.getMessage("@@bidi_dir"));

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = chrome.i18n.getMessage(element.getAttribute("data-i18n"));
  });

  const { languageModel, languageCode } = await chrome.storage.local.get({
    languageModel: DEFAULT_LANGUAGE_MODEL,
    languageCode: "en"
  });

  document.getElementById("languageModel").value = languageModel;
  document.getElementById("languageCode").value = languageCode;

  if (!document.getElementById("languageModel").value) {
    document.getElementById("languageModel").value = DEFAULT_LANGUAGE_MODEL;
  }

  main(true);
};

// ── Event listeners ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", initialize);

document.getElementById("run").addEventListener("click", () => {
  main(false);
});

document.getElementById("copy").addEventListener("click", copyContent);
document.getElementById("save").addEventListener("click", saveContent);

document.getElementById("results").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL(`results.html?i=${resultIndex}`) }, () => {
    window.close();
  });
});

document.getElementById("results-link").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL(`results.html?i=${resultIndex}`) }, () => {
    window.close();
  });
});

document.getElementById("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage(() => {
    window.close();
  });
});
