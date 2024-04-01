const restoreOptions = async () => {
  const options = await chrome.storage.local.get({
    languageModel: "haiku",
    apiKey: "",
    languageCode: "en",
    noTextAction: "summarize",
    noTextCustomPrompt: "",
    textAction: "translate",
    textCustomPrompt: ""
  });

  document.getElementById("languageModel").value = options.languageModel;
  document.getElementById("apiKey").value = options.apiKey;
  document.getElementById("languageCode").value = options.languageCode;
  document.querySelector(`input[name="noTextAction"][value="${options.noTextAction}"]`).checked = true;
  document.getElementById("noTextCustomPrompt").value = options.noTextCustomPrompt;
  document.querySelector(`input[name="textAction"][value="${options.textAction}"]`).checked = true;
  document.getElementById("textCustomPrompt").value = options.textCustomPrompt;
};

const saveOptions = async () => {
  const options = {
    languageModel: document.getElementById("languageModel").value,
    apiKey: document.getElementById("apiKey").value,
    languageCode: document.getElementById("languageCode").value,
    noTextAction: document.querySelector('input[name="noTextAction"]:checked').value,
    noTextCustomPrompt: document.getElementById("noTextCustomPrompt").value,
    textAction: document.querySelector('input[name="textAction"]:checked').value,
    textCustomPrompt: document.getElementById("textCustomPrompt").value
  };

  await chrome.storage.local.set(options);
  const status = document.getElementById("status");
  status.textContent = chrome.i18n.getMessage("options_saved");
  setTimeout(() => status.textContent = "", 1000);
};

const initialize = () => {
  // Set the text of elements with the data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = chrome.i18n.getMessage(element.getAttribute("data-i18n"));
  });

  restoreOptions();
};

document.addEventListener("DOMContentLoaded", initialize);
document.getElementById("save").addEventListener("click", saveOptions);
