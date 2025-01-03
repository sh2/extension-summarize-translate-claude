const tryParseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
};

export const adjustLayoutForScreenSize = () => {
  // Add the narrow class if the screen width is narrow
  if (document.getElementById("header").clientWidth < 640) {
    document.body.classList.add("narrow");
  } else {
    document.body.classList.remove("narrow");
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

export const getModelId = (languageModel, mediaType) => {
  const modelMappings = {
    "3.5-sonnet": "claude-3-5-sonnet-latest",
    "3.5-haiku": "claude-3-5-haiku-latest",
    "3-opus": "claude-3-opus-latest",
    "3-sonnet": "claude-3-sonnet-20240229",
    "3-haiku": "claude-3-haiku-20240307",
  };

  if (languageModel === "3.5-haiku" && mediaType === "image") {
    // Since Claude 3.5 Haiku does not support images, use Claude 3 Haiku instead.
    return "claude-3-haiku-20240307";
  } else {
    return modelMappings[languageModel];
  }
};

export const getMaxOutputTokens = (modelId) => {
  const maxOutputTokens = {
    "claude-3-5-sonnet-latest": 8192,
    "claude-3-5-haiku-latest": 8192,
    "claude-3-opus-latest": 4096,
    "claude-3-sonnet-20240229": 4096,
    "claude-3-haiku-20240307": 4096
  };

  return maxOutputTokens[modelId];
};

export const generateContent = async (apiKey, modelId, maxOutputTokens, systemPrompt, apiContents) => {
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
        max_tokens: maxOutputTokens,
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
