import {
  DEFAULT_LANGUAGE_MODEL,
  applyTheme,
  applyFontSize,
  loadTemplate
} from "./utils.js";

const INITIAL_OPTIONS = {
  apiKey: "",
  languageModel: DEFAULT_LANGUAGE_MODEL,
  languageCode: "en",
  userLanguage: "Turkish",
  noTextAction: "summarize",
  noTextCustomPrompt: "",
  textAction: "translate",
  textCustomPrompt: "",
  streaming: false,
  theme: "system",
  fontSize: "medium"
};

const showStatusMessage = (message, duration) => {
  const status = document.getElementById("status");
  status.textContent = message;

  setTimeout(() => {
    if (status.textContent === message) {
      status.textContent = "";
    }
  }, duration);
};

const getOptionsFromForm = (includeApiKey) => {
  const options = {
    version: chrome.runtime.getManifest().version,
    languageModel: document.getElementById("languageModel").value,
    languageCode: document.getElementById("languageCode").value,
    userLanguage: document.getElementById("userLanguage").value,
    noTextAction: document.querySelector('input[name="noTextAction"]:checked').value,
    noTextCustomPrompt: document.getElementById("noTextCustomPrompt").value,
    textAction: document.querySelector('input[name="textAction"]:checked').value,
    textCustomPrompt: document.getElementById("textCustomPrompt").value,
    streaming: document.getElementById("streaming").checked,
    theme: document.getElementById("theme").value,
    fontSize: document.getElementById("fontSize").value
  };

  if (includeApiKey) {
    options.apiKey = document.getElementById("apiKey").value;
  }

  return options;
};

const setOptionsToForm = async () => {
  const options = await chrome.storage.local.get(INITIAL_OPTIONS);

  document.getElementById("apiKey").value = options.apiKey;
  document.getElementById("languageModel").value = options.languageModel;
  document.getElementById("languageCode").value = options.languageCode;
  document.getElementById("userLanguage").value = options.userLanguage;
  document.querySelector(`input[name="noTextAction"][value="${options.noTextAction}"]`).checked = true;
  document.getElementById("noTextCustomPrompt").value = options.noTextCustomPrompt;
  document.querySelector(`input[name="textAction"][value="${options.textAction}"]`).checked = true;
  document.getElementById("textCustomPrompt").value = options.textCustomPrompt;
  document.getElementById("streaming").checked = options.streaming;
  document.getElementById("theme").value = options.theme;
  document.getElementById("fontSize").value = options.fontSize;

  // Set the default language model if the language model is not set
  if (!document.getElementById("languageModel").value) {
    document.getElementById("languageModel").value = DEFAULT_LANGUAGE_MODEL;
  }
};

const saveOptions = async () => {
  const options = getOptionsFromForm(true);

  await chrome.storage.local.set(options);
  await chrome.storage.session.set({ responseCacheQueue: [] });
  applyTheme((await chrome.storage.local.get({ theme: "system" })).theme);
  applyFontSize((await chrome.storage.local.get({ fontSize: "medium" })).fontSize);
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

  setOptionsToForm();
};

document.addEventListener("DOMContentLoaded", initialize);

document.getElementById("save").addEventListener("click", async () => {
  await saveOptions();
  showStatusMessage(chrome.i18n.getMessage("options_saved"), 1000);
});
