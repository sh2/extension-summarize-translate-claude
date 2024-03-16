# extension-summarize-translate-claude

Chrome extension to summarize and translate web pages. Uses Claude as the backend.

## Setup

The following are instructions for manual installation, for development purposes.

1. Open 'Manage Extensions' page in Google Chrome browser.
2. Enable 'Developer mode'.
3. Click 'Load unpacked' and select `extension` directory.
4. Open 'Options' page and register the Anthropic API Key, then select the language.

You can obtain a Anthropic API Key from [Claude API \ Anthropic](https://www.anthropic.com/api).
This extension uses Claude 3 Haiku by default.

## Usage

### Summarize

Simply open a web page and click on the extension icon to summarize its content.

![Summarize](img/screenshot_summarize.png)

If a YouTube video has captions, this extension will summarize the captions.

![Summarize - YouTube](img/screenshot_youtube.png)

If you open an image file or a PDF file, this extension will summarize the currently displayed image.

![Summarize - Image](img/screenshot_image.png)

### Translate

Select the text you want to translate and click on the extension icon.

![Translate](img/screenshot_translate.png)

## License

MIT License  
Copyright (c) 2024 Sadao Hiratsuka
