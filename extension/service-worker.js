import {
  getModelId,
  generateContent,
  streamGenerateContent
} from "./utils.js";

const getSystemPrompt = async (actionType, mediaType, languageCode, taskInputLength) => {
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

  // Set the user-specified language
  languageNames["zz"] = (await chrome.storage.local.get({ userLanguage: "Turkish" })).userLanguage;

  const numItems = Math.min(10, 3 + Math.floor(taskInputLength / 2000));
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

  if (!systemPrompt) {
    systemPrompt = `Respond to the user in ${languageNames[languageCode]} that no custom action is set. ` +
      "Do not process any data user provided.";
  }

  return systemPrompt;
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    if (request.message === "generate") {
      // Generate content
      const { actionType, mediaType, taskInput, languageModel, languageCode, streamKey } = request;
      const { apiKey, streaming } = await chrome.storage.local.get({ apiKey: "", streaming: false });
      const modelId = getModelId(languageModel);

      const systemPrompt = await getSystemPrompt(
        actionType,
        mediaType,
        languageCode,
        taskInput.length
      );

      let apiContent = {};
      let response = null;

      if (mediaType === "image") {
        const [mediaInfo, mediaData] = taskInput.split(",");
        const mediaType = mediaInfo.split(":")[1].split(";")[0];

        apiContent = {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: mediaData
              }
            },
            {
              type: "text",
              text: "Here is the image."
            }
          ]
        };
      } else {
        apiContent = { role: "user", content: `Text: ${taskInput}` };
      }

      if (streaming) {
        response = await streamGenerateContent(apiKey, systemPrompt, [apiContent], modelId, streamKey);
      } else {
        response = await generateContent(apiKey, systemPrompt, [apiContent], modelId);
      }

      // Add the system prompt and the user input to the response
      response.requestMediaType = mediaType;
      response.requestSystemPrompt = systemPrompt;
      response.requestApiContent = apiContent;

      if (response.ok) {
        // Update the cache
        const { responseCacheQueue } = await chrome.storage.session.get({ responseCacheQueue: [] });
        const responseCacheKey = JSON.stringify({ actionType, mediaType, taskInput, languageModel, languageCode });

        const updatedQueue = responseCacheQueue
          .filter(item => item.key !== responseCacheKey)
          .concat({ key: responseCacheKey, value: response })
          .slice(-10);

        await chrome.storage.session.set({ responseCacheQueue: updatedQueue });
      }

      sendResponse(response);
    }
  })();

  return true;
});
