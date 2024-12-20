const checkNarrowScreen = () => {
  // Add the narrow class if the screen width is narrow
  if (document.getElementById("header").clientWidth < 640) {
    document.body.classList.add("narrow");
  } else {
    document.body.classList.remove("narrow");
  }
};

const restoreOptions = async () => {
  const options = await chrome.storage.local.get({
    apiKey: "",
    languageModel: "3-haiku",
    languageCode: "en",
    noTextAction: "summarize",
    noTextCustomPrompt: "",
    textAction: "translate",
    textCustomPrompt: ""
  });

  document.getElementById("apiKey").value = options.apiKey;
  document.getElementById("languageModel").value = options.languageModel;
  document.getElementById("languageCode").value = options.languageCode;
  document.querySelector(`input[name="noTextAction"][value="${options.noTextAction}"]`).checked = true;
  document.getElementById("noTextCustomPrompt").value = options.noTextCustomPrompt;
  document.querySelector(`input[name="textAction"][value="${options.textAction}"]`).checked = true;
  document.getElementById("textCustomPrompt").value = options.textCustomPrompt;

  // Set the default language model if the language model is not set
  if (!document.getElementById("languageModel").value) {
    document.getElementById("languageModel").value = "3-haiku";
  }
};

const saveOptions = async () => {
  const options = {
    apiKey: document.getElementById("apiKey").value,
    languageModel: document.getElementById("languageModel").value,
    languageCode: document.getElementById("languageCode").value,
    noTextAction: document.querySelector('input[name="noTextAction"]:checked').value,
    noTextCustomPrompt: document.getElementById("noTextCustomPrompt").value,
    textAction: document.querySelector('input[name="textAction"]:checked').value,
    textCustomPrompt: document.getElementById("textCustomPrompt").value
  };

  await chrome.storage.local.set(options);
  await chrome.storage.session.set({ taskCache: "", responseCache: {} });
  const status = document.getElementById("status");
  status.textContent = chrome.i18n.getMessage("options_saved");
  setTimeout(() => status.textContent = "", 1000);
};

const initialize = () => {
  // Check if the screen is narrow  
  checkNarrowScreen();

  // Set the text direction of the body
  document.body.setAttribute("dir", chrome.i18n.getMessage("@@bidi_dir"));

  // Set the text of elements with the data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = chrome.i18n.getMessage(element.getAttribute("data-i18n"));
  });

  restoreOptions();
};

document.addEventListener("DOMContentLoaded", initialize);
document.getElementById("save").addEventListener("click", saveOptions);
window.addEventListener("resize", checkNarrowScreen);
