import {
  DEFAULT_LANGUAGE_MODEL,
  applyTheme,
  applyFontSize,
  loadTemplate,
  displayLoadingMessage,
  convertMarkdownToHtml,
  getModelId,
  generateContent,
  streamGenerateContent,
  getResponseContent,
  exportTextToFile
} from "./utils.js";

const RESULT_VIEW_STATUS = Object.freeze({
  IDLE: "idle",
  WAITING: "waiting",
  UNREAD: "unread"
});

const conversation = [];
let resultIndex = 0;
let result = {};
let resultViewStatus = RESULT_VIEW_STATUS.IDLE;

// ── Pure utilities (no DOM access, no side effects) ────────────────────────

const validateConversation = (data) => {
  if (!Array.isArray(data)) {
    return false;
  }

  if (data.length % 2 !== 0) {
    return false;
  }

  return data.every((item, index) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const expectedRole = index % 2 === 0 ? "user" : "assistant";
    return item.role === expectedRole && typeof item.content === "string";
  });
};

const extractTextFromMessage = (item) => {
  return item && typeof item.content === "string" ? item.content : "";
};

const isSuccessfulResponse = (response) => {
  if (!response || !response.ok) {
    return false;
  }

  const contentBlock = response.body?.content?.[0];
  return typeof contentBlock?.text === "string" && contentBlock.text.length > 0;
};

// ── Tab state & notification ────────────────────────────────────────────────

const setResultControlsEnabled = (enabled) => {
  document.getElementById("clear").disabled = !enabled;
  document.getElementById("copy").disabled = !enabled;
  document.getElementById("save").disabled = !enabled;
  document.getElementById("text").readOnly = !enabled;
  document.getElementById("languageModel").disabled = !enabled;
  document.getElementById("send").disabled = !enabled;
};

const isResultTabActive = () => document.visibilityState === "visible" && document.hasFocus();

const updateDocumentTitle = () => {
  const baseTitle = chrome.i18n.getMessage("results_title");

  if (resultViewStatus === RESULT_VIEW_STATUS.UNREAD) {
    document.title = `● ${baseTitle}`;
  } else if (resultViewStatus === RESULT_VIEW_STATUS.WAITING) {
    document.title = `… ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
};

const syncAttentionCue = () => {
  if (resultViewStatus === RESULT_VIEW_STATUS.UNREAD && isResultTabActive()) {
    resultViewStatus = RESULT_VIEW_STATUS.IDLE;
  }

  updateDocumentTitle();
};

const beginWaitingForResult = () => {
  resultViewStatus = RESULT_VIEW_STATUS.WAITING;
  updateDocumentTitle();
};

const completeWaitingForResult = () => {
  resultViewStatus = isResultTabActive() ? RESULT_VIEW_STATUS.IDLE : RESULT_VIEW_STATUS.UNREAD;
  updateDocumentTitle();
};

// ── UI helpers ──────────────────────────────────────────────────────────────

const appendQuestionToUi = (question) => {
  const formattedQuestionDiv = document.createElement("div");
  formattedQuestionDiv.style.backgroundColor = "var(--nc-bg-3)";
  formattedQuestionDiv.style.borderRadius = "1rem";
  formattedQuestionDiv.style.margin = "1.5rem";
  formattedQuestionDiv.style.padding = "1rem 1rem .1rem";
  formattedQuestionDiv.innerHTML = convertMarkdownToHtml(question, true);
  document.getElementById("conversation").appendChild(formattedQuestionDiv);
};

const appendAnswerPlaceholderToUi = () => {
  const formattedAnswerDiv = document.createElement("div");
  document.getElementById("conversation").appendChild(formattedAnswerDiv);
  return formattedAnswerDiv;
};

// ── Button action handlers ──────────────────────────────────────────────────

const clearConversation = async () => {
  document.getElementById("conversation").replaceChildren();
  conversation.length = 0;

  try {
    await chrome.storage.session.remove(`conversation_${resultIndex}`);
  } catch (error) {
    console.error("Failed to remove conversation from session storage:", error);
  }
};

const copyContent = async () => {
  try {
    const operationStatus = document.getElementById("operation-status");
    let clipboardContent = `${result.responseContent.replace(/\n+$/, "")}\n\n`;

    for (const item of conversation) {
      const text = extractTextFromMessage(item);

      if (text) {
        clipboardContent += `${text.replace(/\n+$/, "")}\n\n`;
      }
    }

    await navigator.clipboard.writeText(clipboardContent);
    operationStatus.textContent = chrome.i18n.getMessage("results_copied");

    setTimeout(() => {
      operationStatus.textContent = "";
    }, 1000);
  } catch (error) {
    console.error("Failed to copy content:", error);
  }
};

const saveContent = () => {
  try {
    const operationStatus = document.getElementById("operation-status");
    let content = `${result.responseContent.replace(/\n+$/, "")}\n\n`;

    for (const item of conversation) {
      const text = extractTextFromMessage(item);

      if (text) {
        content += `${text.replace(/\n+$/, "")}\n\n`;
      }
    }

    exportTextToFile(`${result.url}\n\n${content}`);
    operationStatus.textContent = chrome.i18n.getMessage("results_saved");

    setTimeout(() => {
      operationStatus.textContent = "";
    }, 1000);
  } catch (error) {
    console.error("Failed to save content:", error);
  }
};

// ── Core async logic ────────────────────────────────────────────────────────

const askQuestion = async () => {
  const question = document.getElementById("text").value.trim();

  if (!question) {
    return;
  }

  setResultControlsEnabled(false);
  let displayIntervalId = setInterval(displayLoadingMessage, 500, "send-status", chrome.i18n.getMessage("results_waiting_response"));
  appendQuestionToUi(question);
  document.getElementById("text").value = "";

  const formattedAnswerDiv = appendAnswerPlaceholderToUi();
  window.scrollTo(0, document.body.scrollHeight);
  let answer;
  let streamIntervalId = null;

  try {
    const { apiKey, streaming } = await chrome.storage.local.get({ apiKey: "", streaming: false });
    const languageModel = document.getElementById("languageModel").value;
    const modelId = getModelId(languageModel);

    const apiContents = [];
    apiContents.push(result.requestApiContent);
    apiContents.push({ role: "assistant", content: result.responseContent });
    apiContents.push(...conversation);
    apiContents.push({ role: "user", content: question });

    let response;

    if (streaming) {
      const streamKey = `streamContent_${resultIndex}`;
      const responsePromise = streamGenerateContent(apiKey, result.requestSystemPrompt, apiContents, modelId, streamKey);

      console.log("Request:", { apiContents, modelId, streamKey });

      streamIntervalId = setInterval(async () => {
        const streamContent = (await chrome.storage.session.get({ [streamKey]: "" }))[streamKey];

        if (streamContent) {
          formattedAnswerDiv.innerHTML = convertMarkdownToHtml(streamContent, false);
        }
      }, 1000);

      response = await responsePromise;
      clearInterval(streamIntervalId);
      streamIntervalId = null;
    } else {
      response = await generateContent(apiKey, result.requestSystemPrompt, apiContents, modelId);
    }

    console.log("Response:", response);
    answer = getResponseContent(response, Boolean(apiKey));
    formattedAnswerDiv.innerHTML = convertMarkdownToHtml(answer, false);

    if (isSuccessfulResponse(response)) {
      conversation.push({ role: "user", content: question });
      conversation.push({ role: "assistant", content: answer });

      try {
        await chrome.storage.session.set({ [`conversation_${resultIndex}`]: conversation });
      } catch (storageError) {
        console.error("Failed to save conversation to session storage:", storageError);
      }
    } else {
      console.warn("API response was not successful:", response);
    }
  } catch (error) {
    console.error("Failed to generate content:", error);

    if (streamIntervalId) {
      clearInterval(streamIntervalId);
    }

    formattedAnswerDiv.textContent = chrome.i18n.getMessage("response_unexpected_response");
  } finally {
    clearInterval(displayIntervalId);
    document.getElementById("send-status").textContent = "";
    setResultControlsEnabled(true);
    window.scrollTo(0, document.body.scrollHeight);
  }
};

const waitForResult = async (resultIndex) => {
  const { streaming } = await chrome.storage.local.get({ streaming: false });
  const streamKey = `streamContent_${resultIndex}`;
  const resultKey = `result_${resultIndex}`;
  const contentElement = document.getElementById("content");

  // Keepalive: periodically ping the service worker to prevent termination
  const keepaliveIntervalId = setInterval(async () => {
    try {
      await chrome.runtime.sendMessage({ message: "keepalive" });
    } catch {
      // Ignore errors during keepalive ping
    }
  }, 20000);

  // Streaming poll: show intermediate content while waiting
  let streamIntervalId = null;

  if (streaming) {
    streamIntervalId = setInterval(async () => {
      const streamContent = (await chrome.storage.session.get({ [streamKey]: "" }))[streamKey];

      if (streamContent && contentElement) {
        contentElement.innerHTML = convertMarkdownToHtml(streamContent, false);
      }
    }, 1000);
  }

  // Result poll: wait for the final result
  const result = await new Promise((resolve) => {
    const check = async () => {
      const storedResult = (await chrome.storage.session.get({ [resultKey]: "" }))[resultKey];

      if (storedResult) {
        resolve(storedResult);
      } else {
        setTimeout(check, 500);
      }
    };

    check();
  });

  // Stop the keepalive and streaming intervals
  clearInterval(keepaliveIntervalId);
  clearInterval(streamIntervalId);

  return result;
};

const initialize = async () => {
  // Apply the theme
  applyTheme((await chrome.storage.local.get({ theme: "system" })).theme);

  // Apply font size
  applyFontSize((await chrome.storage.local.get({ fontSize: "medium" })).fontSize);

  // Load the language model template
  const languageModelTemplate = await loadTemplate("languageModelTemplate");
  document.getElementById("languageModelContainer").appendChild(languageModelTemplate);

  // Set the text direction of the body
  document.body.setAttribute("dir", chrome.i18n.getMessage("@@bidi_dir"));

  // Set the text of elements with the data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = chrome.i18n.getMessage(element.getAttribute("data-i18n"));
  });

  // Restore the language model from the local storage
  const { languageModel } = await chrome.storage.local.get({ languageModel: DEFAULT_LANGUAGE_MODEL });
  document.getElementById("languageModel").value = languageModel;

  // Set the default language model if the language model is not set
  if (!document.getElementById("languageModel").value) {
    document.getElementById("languageModel").value = DEFAULT_LANGUAGE_MODEL;
  }

  // Restore the content from the session storage
  const urlParams = new URLSearchParams(window.location.search);
  resultIndex = urlParams.get("i");

  const sessionData = await chrome.storage.session.get({
    [`result_${resultIndex}`]: "",
    [`conversation_${resultIndex}`]: []
  });

  result = sessionData[`result_${resultIndex}`];

  if (!result) {
    // Disable the buttons and input fields while waiting
    setResultControlsEnabled(false);
    beginWaitingForResult();

    // Display a loading message while waiting for the result
    const displayIntervalId = setInterval(displayLoadingMessage, 500, "send-status", chrome.i18n.getMessage("results_waiting_for_result"));

    // Wait for the result to be available in the session storage
    result = await waitForResult(resultIndex);
    completeWaitingForResult();

    // Stop displaying the loading message
    clearInterval(displayIntervalId);
    document.getElementById("send-status").textContent = "";

    // Re-enable the buttons and input fields
    setResultControlsEnabled(true);
  }

  // Convert the content from Markdown to HTML
  document.getElementById("content").innerHTML = convertMarkdownToHtml(result.responseContent, false);

  // Restore the conversation from session storage if it exists and is valid
  const savedConversation = sessionData[`conversation_${resultIndex}`];

  if (validateConversation(savedConversation)) {
    conversation.length = 0;
    conversation.push(...savedConversation);

    for (let i = 0; i < savedConversation.length; i += 2) {
      const questionText = extractTextFromMessage(savedConversation[i]);
      const answerText = extractTextFromMessage(savedConversation[i + 1]);

      if (questionText) {
        appendQuestionToUi(questionText);
      }

      if (answerText) {
        const answerPlaceholder = appendAnswerPlaceholderToUi();
        answerPlaceholder.innerHTML = convertMarkdownToHtml(answerText, false);
      }
    }
  }
};

// ── Event listeners ─────────────────────────────────────────────────────────

window.addEventListener("focus", syncAttentionCue);
document.addEventListener("visibilitychange", syncAttentionCue);
document.addEventListener("DOMContentLoaded", initialize);
document.getElementById("clear").addEventListener("click", clearConversation);
document.getElementById("copy").addEventListener("click", copyContent);
document.getElementById("save").addEventListener("click", saveContent);
document.getElementById("send").addEventListener("click", askQuestion);

document.getElementById("text").addEventListener("keydown", (e) => {
  if (e.isComposing || e.key === "Process") {
    return;
  }

  // Check if Ctrl (or Cmd) + Enter is pressed
  if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key === "NumpadEnter")) {
    e.preventDefault();

    if (!document.getElementById("send").disabled) {
      askQuestion();
    }
  }
});
