const getSelectedText = () => {
  // Return the selected text
  return window.getSelection().toString();
}

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
}

const displayLoadingMessage = (loadingMessage) => {
  const status = document.getElementById("status");

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

const main = async () => {
  let displayIntervalId = 0;
  let content = "";

  try {
    let userPrompt = "";
    let userPromptChunks = [];
    let task = "";
    let loadingMessage = "";

    document.getElementById("content").textContent = "";
    document.getElementById("status").textContent = "";
    document.getElementById("run").disabled = true;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Get the selected text
    if (userPrompt = (await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: getSelectedText }))[0].result) {
      task = "translate";
      loadingMessage = chrome.i18n.getMessage("popup_translating");
    } else {
      // If no text is selected, get the whole text of the page
      task = "summarize";
      loadingMessage = chrome.i18n.getMessage("popup_summarizing");
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["lib/Readability.min.js"] });
      userPrompt = (await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: getWholeText }))[0].result;
    }

    displayIntervalId = setInterval(displayLoadingMessage, 500, loadingMessage);

    // Split the user prompt
    userPromptChunks = await chrome.runtime.sendMessage({ message: "chunk", task: task, userPrompt: userPrompt });
    console.log(userPromptChunks);

    for (const userPromptChunk of userPromptChunks) {
      // Generate content
      const response = await chrome.runtime.sendMessage({ message: "generate", task: task, userPrompt: userPromptChunk });
      console.log(response);

      if (response.ok) {
        if (response.body.content) {
          // A normal response was returned
          content += `${response.body.content[0].text}\n\n`;
          const div = document.createElement("div");
          div.textContent = content;
          document.getElementById("content").innerHTML = marked.parse(div.innerHTML);

          // Scroll to the bottom of the page
          window.scrollTo(0, document.body.scrollHeight);
        } else {
          // The expected response was not returned
          content = chrome.i18n.getMessage("popup_unexpected_response");
          break;
        }
      } else {
        // A response error occurred
        content = `Error: ${response.status}\n\n${response.body.error.message}`;
        break;
      }
    }
  } catch (error) {
    content = chrome.i18n.getMessage("popup_miscellaneous_error");
    console.log(error);
  } finally {
    if (displayIntervalId) {
      clearInterval(displayIntervalId);
    }

    document.getElementById("status").textContent = "";
    document.getElementById("run").disabled = false;
    const div = document.createElement("div");
    div.textContent = content;
    document.getElementById("content").innerHTML = marked.parse(div.innerHTML);
  }
};

const initialize = () => {
  // Disable links when converting from Markdown to HTML
  marked.use({ renderer: { link: (_href, _title, text) => text } });

  // Set the text of elements with the data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = chrome.i18n.getMessage(element.getAttribute("data-i18n"));
  });

  main();
}

document.addEventListener("DOMContentLoaded", initialize);
document.getElementById("run").addEventListener("click", main);
document.getElementById("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
