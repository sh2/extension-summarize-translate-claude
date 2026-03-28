/* globals Readability */

import {
  DEFAULT_LANGUAGE_MODEL,
  applyTheme,
  applyFontSize,
  loadTemplate,
  displayLoadingMessage,
  convertMarkdownToHtml,
  getResponseContent,
  exportTextToFile
} from "./utils.js";

let resultIndex = 0;
let content = "";

const copyContent = async () => {
  const operationStatus = document.getElementById("operation-status");
  let clipboardContent = `${content.replace(/\n+$/, "")}\n\n`;

  // Copy the content to the clipboard
  await navigator.clipboard.writeText(clipboardContent);

  // Display a message indicating that the content was copied
  operationStatus.textContent = chrome.i18n.getMessage("popup_copied");
  setTimeout(() => operationStatus.textContent = "", 1000);
};

const saveContent = async () => {
  const operationStatus = document.getElementById("operation-status");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Save the content to a text file
  exportTextToFile(`${tab.url}\n\n${content}`);

  // Display a message indicating that the content was saved
  operationStatus.textContent = chrome.i18n.getMessage("popup_saved");
  setTimeout(() => operationStatus.textContent = "", 1000);
};

const getSelectedText = () => {
  // Return the selected text
  return window.getSelection().toString();
};

const getWholeText = () => {
  // Return the whole text
  const documentClone = document.cloneNode(true);
  const article = new Readability(documentClone).parse();

  if (article) {
    return article.textContent;
  } else {
    console.log("Failed to parse the article. Using document.body.innerText instead.");
    return document.body.innerText;
  }
};

const getTranscript = async () => {
  const TRANSCRIPT_VARIANTS = [
    {
      RENDERER: "yt-section-list-renderer",
      SEGMENTS: "transcript-segment-view-model",
      TEXT: ".yt-core-attributed-string"
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

  // Helper: Wait for the transcript renderer and segments to be fully loaded
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

  // Main logic to get the transcript text
  const openButton = document.querySelector("ytd-video-description-transcript-section-renderer button");

  if (!openButton) {
    return "";
  }

  openButton.click();

  try {
    const { variant, segments } = await waitForTranscriptSegments();

    const transcriptTexts = Array.from(segments).map(segment => {
      const textElement = segment.querySelector(variant.TEXT);
      return textElement ? textElement.textContent.trim() : "";
    });

    return transcriptTexts.join("\n");
  } catch (error) {
    console.log(error);
    return "";
  }
};

const extractTaskInformation = async () => {
  let actionType = "";
  let mediaType = "";
  let taskInput = "";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Get the selected text
  try {
    taskInput = (await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getSelectedText
    }))[0].result;
  } catch (error) {
    console.log(error);
  }

  if (taskInput) {
    actionType = (await chrome.storage.local.get({ textAction: "translate" })).textAction;
    mediaType = "text";
  } else {
    // If no text is selected, get the whole text of the page
    actionType = (await chrome.storage.local.get({ noTextAction: "summarize" })).noTextAction;

    if (tab.url.startsWith("https://www.youtube.com/watch?")) {
      // If the page is a YouTube video, get the captions instead of the whole text
      mediaType = "captions";

      const displayIntervalId = setInterval(displayLoadingMessage, 500, "status", chrome.i18n.getMessage("popup_retrieving_captions"));

      try {
        taskInput = (await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: getTranscript,
        }))[0].result;
      } catch (error) {
        console.log(error);
      } finally {
        // Stop displaying the loading message
        clearInterval(displayIntervalId);
      }
    }

    if (!taskInput) {
      // Get the main text of the page using Readability.js
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

    if (!taskInput) {
      // If the whole text is empty, get the visible tab as an image
      mediaType = "image";
      taskInput = await (chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg" }));
    }
  }

  return { actionType, mediaType, taskInput };
};

const getLoadingMessage = (actionType, mediaType) => {
  let loadingMessage = "";

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

const main = async (useCache) => {
  let displayIntervalId = 0;
  let responseContent = "";

  // Clear the content
  content = "";

  // Increment the result index
  resultIndex = (await chrome.storage.session.get({ resultIndex: -1 })).resultIndex;
  resultIndex = (resultIndex + 1) % 10;
  await chrome.storage.session.set({ resultIndex: resultIndex });

  // Clear stale result to prevent results.html from picking up old data
  await chrome.storage.session.remove(`result_${resultIndex}`);

  try {
    const { apiKey, streaming } = await chrome.storage.local.get({ apiKey: "", streaming: false });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const languageModel = document.getElementById("languageModel").value;
    const languageCode = document.getElementById("languageCode").value;

    // Disable the buttons and input fields
    document.getElementById("content").textContent = "";
    document.getElementById("status").textContent = "";
    document.getElementById("run").disabled = true;
    document.getElementById("languageModel").disabled = true;
    document.getElementById("languageCode").disabled = true;
    document.getElementById("copy").disabled = true;
    document.getElementById("save").disabled = true;
    document.getElementById("results").disabled = true;

    // Extract the task information
    const { actionType, mediaType, taskInput } = await extractTaskInformation();

    // Display a loading message
    displayIntervalId = setInterval(displayLoadingMessage, 500, "status", getLoadingMessage(actionType, mediaType));

    // Check the cache
    const { responseCacheQueue } = await chrome.storage.session.get({ responseCacheQueue: [] });
    const cacheIdentifier = JSON.stringify({ actionType, mediaType, taskInput, languageModel, languageCode });
    const responseCache = responseCacheQueue.find(item => item.key === cacheIdentifier);

    if (useCache && responseCache) {
      // Use the cached response
      const { requestMediaType, requestSystemPrompt, requestApiContent, responseContent: cachedResponseContent } = responseCache.value;
      responseContent = cachedResponseContent;

      await chrome.storage.session.set({
        [`result_${resultIndex}`]: {
          requestMediaType,
          requestSystemPrompt,
          requestApiContent,
          responseContent: cachedResponseContent,
          url: tab.url
        }
      });
    } else {
      // Generate content
      const streamKey = `streamContent_${resultIndex}`;
      let streamIntervalId = 0;

      const responsePromise = chrome.runtime.sendMessage({
        message: "generate",
        actionType: actionType,
        mediaType: mediaType,
        taskInput: taskInput,
        languageModel: languageModel,
        languageCode: languageCode,
        streamKey: streamKey,
        resultIndex: resultIndex,
        url: tab.url
      });

      console.log("Request:", {
        actionType: actionType,
        mediaType: mediaType,
        taskInput: taskInput,
        languageModel: languageModel,
        languageCode: languageCode,
        streamKey: streamKey,
        resultIndex: resultIndex,
        url: tab.url
      });

      if (streaming) {
        // Stream the content
        streamIntervalId = setInterval(async () => {
          const streamContent = (await chrome.storage.session.get({ [streamKey]: "" }))[streamKey];

          if (streamContent) {
            document.getElementById("content").innerHTML = convertMarkdownToHtml(streamContent, false);
          }
        }, 1000);
      }

      // Display the "View Results" link if the response is not received within 5 seconds
      const timeoutId = setTimeout(() => { document.getElementById("results-link").style.display = "block"; }, 5000);

      // Wait for responsePromise
      const response = await responsePromise;
      console.log("Response:", response);
      responseContent = getResponseContent(response, Boolean(apiKey));

      // Clear the timeout for displaying the "View Results" link
      clearTimeout(timeoutId);
      document.getElementById("results-link").style.display = "none";

      // Stop streaming
      clearInterval(streamIntervalId);
    }

    content = responseContent;
  } catch (error) {
    content = chrome.i18n.getMessage("popup_miscellaneous_error");
    console.error(error);
  } finally {
    // Stop displaying the loading message
    clearInterval(displayIntervalId);

    // Convert the content from Markdown to HTML
    document.getElementById("content").innerHTML = convertMarkdownToHtml(content, false);

    // Enable the buttons and input fields
    document.getElementById("status").textContent = "";
    document.getElementById("run").disabled = false;
    document.getElementById("languageModel").disabled = false;
    document.getElementById("languageCode").disabled = false;
    document.getElementById("copy").disabled = false;
    document.getElementById("save").disabled = false;
    document.getElementById("results").disabled = false;
  }
};

const initialize = async () => {
  // Apply the theme
  applyTheme((await chrome.storage.local.get({ theme: "system" })).theme);

  // Apply font size
  applyFontSize((await chrome.storage.local.get({ fontSize: "medium" })).fontSize);

  // Load the language model template
  const languageModelTemplate = await loadTemplate("languageModelTemplate");
  document.getElementById("languageModelContainer").appendChild(languageModelTemplate);

  // Load the language code template
  const languageCodeTemplate = await loadTemplate("languageCodeTemplate");
  document.getElementById("languageCodeContainer").appendChild(languageCodeTemplate);

  // Set the text direction of the body
  document.body.setAttribute("dir", chrome.i18n.getMessage("@@bidi_dir"));

  // Set the text of elements with the data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = chrome.i18n.getMessage(element.getAttribute("data-i18n"));
  });

  // Restore the language model and language code from the local storage
  const { languageModel, languageCode } =
    await chrome.storage.local.get({ languageModel: DEFAULT_LANGUAGE_MODEL, languageCode: "en" });

  document.getElementById("languageModel").value = languageModel;
  document.getElementById("languageCode").value = languageCode;

  // Set the default language model if the language model is not set
  if (!document.getElementById("languageModel").value) {
    document.getElementById("languageModel").value = DEFAULT_LANGUAGE_MODEL;
  }

  main(true);
};

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
