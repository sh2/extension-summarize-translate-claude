/* globals DOMPurify, marked */

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

export const convertMarkdownToHtml = (content, breaks) => {
  // Disable links when converting from Markdown to HTML
  marked.use({ renderer: { link: ({ text }) => text } });

  const markdownDiv = document.createElement("div");
  markdownDiv.textContent = content;
  const htmlDiv = document.createElement("div");
  htmlDiv.innerHTML = DOMPurify.sanitize(marked.parse(markdownDiv.innerHTML, { breaks: breaks }));

  // Replace the HTML entities with the original characters in the code blocks
  htmlDiv.querySelectorAll("code").forEach(codeBlock => {
    codeBlock.innerHTML = codeBlock.innerHTML
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");
  });

  return htmlDiv.innerHTML;
};

export const getModelId = (languageModel) => {
  const modelMappings = {
    "4.5-opus": "claude-opus-4-5",
    "4.1-opus": "claude-opus-4-1",
    "4-opus": "claude-opus-4-0",
    "4.5-sonnet": "claude-sonnet-4-5",
    "4-sonnet": "claude-sonnet-4-0",
    "4.5-haiku": "claude-haiku-4-5",
    "3-haiku": "claude-3-haiku-20240307"
  };

  return modelMappings[languageModel];
};

export const generateContent = async (apiKey, modelId, systemPrompt, apiContents) => {
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

export const streamGenerateContent = async (apiKey, modelId, systemPrompt, apiContents, streamKey) => {
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
