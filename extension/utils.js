const tryParseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
};

export const applyTheme = (theme) => {
  if (theme === "light") {
    document.body.setAttribute("data-theme", "light");
  } else if (theme === "dark") {
    document.body.setAttribute("data-theme", "dark");
  } else {
    document.body.removeAttribute("data-theme");
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

export const getModelId = (languageModel) => {
  const modelMappings = {
    "3.7-sonnet": "claude-3-7-sonnet-latest",
    "3.5-sonnet": "claude-3-5-sonnet-latest",
    "3.5-haiku": "claude-3-5-haiku-latest",
    "3-opus": "claude-3-opus-latest",
    "3-sonnet": "claude-3-sonnet-20240229",
    "3-haiku": "claude-3-haiku-20240307"
  };

  return modelMappings[languageModel];
};

export const getMaxOutputTokens = (modelId) => {
  const maxOutputTokens = {
    "claude-3-7-sonnet-latest": 8192,
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

export const streamGenerateContent = async (apiKey, modelId, maxOutputTokens, systemPrompt, apiContents) => {
  try {
    await chrome.storage.session.remove("streamContent");

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
              await chrome.storage.session.set({ streamContent: content });
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
