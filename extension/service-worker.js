const getModelId = (languageModel) => {
  const modelIds = {
    "3.5-sonnet": "claude-3-5-sonnet-20240620",
    opus: "claude-3-opus-20240229",
    sonnet: "claude-3-sonnet-20240229",
    haiku: "claude-3-haiku-20240307",
  };

  return modelIds[languageModel];
};

const getSystemPrompt = async (actionType, mediaType, languageCode, taskInuptLength) => {
  const languageNames = {
    en: "English",
    de: "German",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    pt_br: "Brazilian Portuguese",
    vi: "Vietnamese",
    ru: "Russian",
    ar: "Arabic",
    hi: "Hindi",
    bn: "Bengali",
    zh_cn: "Simplified Chinese",
    zh_tw: "Traditional Chinese",
    ja: "Japanese",
    ko: "Korean"
  };

  const numItems = Math.min(10, 3 + Math.floor(taskInuptLength / 2000));
  let systemPrompt = "";

  if (actionType === "summarize") {
    if (mediaType === "image") {
      systemPrompt = "Summarize the image as Markdown numbered list " +
        `in ${languageNames[languageCode]} and reply only with the list.\n` +
        "<example>\n1. First point.\n2. Second point.\n3. Third point.\n</example>";
    } else {
      systemPrompt = `Summarize the entire text as up to ${numItems}-item Markdown numbered list ` +
        `in ${languageNames[languageCode]} and reply only with the list.\n` +
        "<example>\n1. First point.\n2. Second point.\n3. Third point.\n</example>";
    }
  } else if (actionType === "translate") {
    if (mediaType === "image") {
      systemPrompt = `Translate the image into ${languageNames[languageCode]} ` +
        "and reply only with the translated result.";
    } else {
      systemPrompt = `Translate the entire text into ${languageNames[languageCode]} ` +
        "and reply only with the translated result.";
    }
  } else if (actionType === "noTextCustom") {
    systemPrompt = (await chrome.storage.local.get({ noTextCustomPrompt: "" })).noTextCustomPrompt;
  } else if (actionType === "textCustom") {
    systemPrompt = (await chrome.storage.local.get({ textCustomPrompt: "" })).textCustomPrompt;
  }

  return systemPrompt;
};

const getPrefill = (actionType, languageCode) => {
  const prefills = {
    summarize: {
      en: "Summary:",
      de: "Zusammenfassung:",
      es: "Resumen:",
      fr: "Résumé:",
      it: "Sommario:",
      pt_br: "Resumo:",
      vi: "Tóm tắt:",
      ru: "Резюме:",
      ar: "ملخص:",
      hi: "सारांश:",
      bn: "সারংশ:",
      zh_cn: "摘要:",
      zh_tw: "摘要:",
      ja: "要約:",
      ko: "요약:"
    },
    translate: {
      en: "Translation:",
      de: "Übersetzung:",
      es: "Traducción:",
      fr: "Traduction:",
      it: "Traduzione:",
      pt_br: "Tradução:",
      vi: "Dịch:",
      ru: "Перевод:",
      ar: "ترجمة:",
      hi: "अनुवाद:",
      bn: "অনুবাদ:",
      zh_cn: "翻译:",
      zh_tw: "翻譯:",
      ja: "翻訳:",
      ko: "번역:"
    }
  };

  if (actionType === "summarize" || actionType === "translate") {
    return prefills[actionType][languageCode];
  } else {
    return "";
  }
};

const getCharacterLimit = (modelId, actionType) => {
  // Limit on the number of characters handled at one time
  // so as not to exceed the maximum number of tokens sent and received by the API.
  // In Claude, the calculation is performed in the following way
  // Summarize: Number of characters equal to the maximum number of tokens in the context window
  // Translate: Number of characters equal to the maximum number of output tokens in the model
  // noTextCustom: The same as Summarize
  // textCustom: The same as Summarize
  const characterLimits = {
    "claude-3-5-sonnet-20240620": {
      summarize: 200000,
      translate: 4096,
      noTextCustom: 200000,
      textCustom: 200000
    },
    "claude-3-opus-20240229": {
      summarize: 200000,
      translate: 4096,
      noTextCustom: 200000,
      textCustom: 200000
    },
    "claude-3-sonnet-20240229": {
      summarize: 200000,
      translate: 4096,
      noTextCustom: 200000,
      textCustom: 200000
    },
    "claude-3-haiku-20240307": {
      summarize: 200000,
      translate: 4096,
      noTextCustom: 200000,
      textCustom: 200000
    }
  };

  return characterLimits[modelId][actionType];
};

const chunkText = (text, chunkSize) => {
  const chunks = [];
  // ।: U+0964 Devanagari Danda
  const sentenceBreaks = ["\n\n", "।", "。", "．", ".", "\n", " "];
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
      // Split the task input
      const { actionType, taskInput, languageModel } = request;
      const modelId = getModelId(languageModel);
      const chunkSize = getCharacterLimit(modelId, actionType);
      const taskInputChunks = chunkText(taskInput, chunkSize);
      sendResponse(taskInputChunks);
    } else if (request.message === "generate") {
      // Generate content
      await chrome.storage.session.set({ taskCache: "", responseCache: {} });
      const { actionType, mediaType, taskInput, languageModel, languageCode } = request;
      const { apiKey } = await chrome.storage.local.get({ apiKey: "" });
      const modelId = getModelId(languageModel);

      const systemPrompt = await getSystemPrompt(
        actionType,
        mediaType,
        languageCode,
        taskInput.length
      );

      const prefill = getPrefill(actionType, languageCode);
      let messages = [];

      if (mediaType === "image") {
        const [mediaInfo, mediaData] = taskInput.split(",");
        const mediaType = mediaInfo.split(":")[1].split(";")[0];

        messages.push({
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: mediaData
              },
            },
            {
              type: "text",
              text: "Here is the image."
            }
          ]
        });
      } else {
        messages.push({ role: "user", content: `Text: ${taskInput}` });
      }

      if (prefill) {
        messages.push({ role: "assistant", content: prefill });
      }

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
            messages: messages
          })
        });

        const responseData = {
          ok: response.ok,
          status: response.status,
          body: tryJsonParse(await response.text())
        };

        if (response.ok) {
          const taskData = JSON.stringify({ actionType, mediaType, taskInput, languageModel, languageCode });
          await chrome.storage.session.set({ taskCache: taskData, responseCache: responseData });
        }

        sendResponse(responseData);
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
