const getModelId = (languageModel) => {
  const modelIds = {
    opus: "claude-3-opus-20240229",
    sonnet: "claude-3-sonnet-20240229",
    haiku: "claude-3-haiku-20240307",
  };

  return modelIds[languageModel];
}

const getSystemPrompt = (task, languageCode, userPromptLength) => {
  const languageNames = {
    en: "English",
    de: "German",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    pt_br: "Brazilian Portuguese",
    ru: "Russian",
    zh_cn: "Simplified Chinese",
    zh_tw: "Traditional Chinese",
    ja: "Japanese",
    ko: "Korean"
  };

  const numItems = Math.min(10, 3 + Math.floor(userPromptLength / 2000));

  if (task === "summarize") {
    return `Summarize the entire text as up to ${numItems}-item Markdown numbered list ` +
      `in ${languageNames[languageCode]} and reply only with the list.\n` +
      "Format:\n1. First point.\n2. Second point.\n3. Third point.";
  } else if (task === "translate") {
    return `Translate the entire text into ${languageNames[languageCode]} ` +
      "and reply only with the translated result.";
  } else {
    return "";
  }
};

const getCharacterLimit = (modelId, task) => {
  // Limit on the number of characters handled at one time
  // so as not to exceed the maximum number of tokens sent and received by the API.
  // In Claude, the calculation is performed in the following way
  // Summarize: Number of characters equal to the maximum number of tokens in the context window
  // Translate: Number of characters equal to the maximum number of output tokens in the model
  const characterLimits = {
    "claude-3-opus-20240229": {
      summarize: 200000,
      translate: 4096
    },
    "claude-3-sonnet-20240229": {
      summarize: 200000,
      translate: 4096
    },
    "claude-3-haiku-20240307": {
      summarize: 200000,
      translate: 4096
    }
  };

  return characterLimits[modelId][task];
};

const chunkText = (text, chunkSize) => {
  const chunks = [];
  const sentenceBreaks = ["\n\n", "。", "．", ".", "\n", " "];
  let remainingText = text.replace(/\r\n?/g, "\n");

  while (remainingText.length > chunkSize) {
    const currentChunk = remainingText.substring(0, chunkSize);
    let index = -1;

    // Look for sentence breaks at 80% of the chunk size or later
    for (const sentenceBreak of sentenceBreaks) {
      index = currentChunk.indexOf(sentenceBreak, Math.floor(chunkSize * 0.8));

      if (index !== -1) {
        index += sentenceBreak.length;
        break;
      }
    }

    if (index === -1) {
      index = chunkSize;
    }

    chunks.push(remainingText.substring(0, index));
    remainingText = remainingText.substring(index);
  }

  chunks.push(remainingText);
  return chunks;
};

const tryJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    if (request.message === "chunk") {
      // Split the user prompt
      const { languageModel } = await chrome.storage.local.get({ languageModel: "haiku" });
      const modelId = getModelId(languageModel);
      const userPromptChunks = chunkText(request.userPrompt, getCharacterLimit(modelId, request.task));
      sendResponse(userPromptChunks);
    } else if (request.message === "generate") {
      // Generate content
      const { languageModel, apiKey, languageCode } =
        await chrome.storage.local.get({ languageModel: "haiku", apiKey: "", languageCode: "en" });
      const modelId = getModelId(languageModel);
      const userPrompt = request.userPrompt;
      const systemPrompt = getSystemPrompt(request.task, languageCode, userPrompt.length);

      try {
        const response = await fetch(`https://api.anthropic.com/v1/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
            "x-api-key": apiKey
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }]
          })
        });

        sendResponse({
          ok: response.ok,
          status: response.status,
          body: tryJsonParse(await response.text())
        });
      } catch (error) {
        sendResponse({
          ok: false,
          status: 1000,
          body: { error: { message: error.stack } }
        });
      }
    }
  })();

  return true;
});
