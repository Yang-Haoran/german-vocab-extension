# Screenshot Guide

Before making this repository public or using it in an Ausbildung application, add a few screenshots to make the project understandable at first glance.

Recommended screenshots:

1. **Translation popup**
   - Select a German word in an article.
   - Show the Chinese translation, base form, explanation, pronunciation button, and save button.

2. **Local vocabulary notebook**
   - Show saved words, source context, pronunciation button, and sync status.

3. **Cloud sync settings**
   - Show the options page with cloud sync enabled.
   - Hide or blur API secrets before adding screenshots.

4. **Telegram review message**
   - Show one review message sent by the bot.
   - Hide personal chat identifiers if visible.

Suggested folder:

```text
docs/images/
  translation-popup.png
  vocabulary-notebook.png
  cloud-sync-settings.png
  telegram-review.png
```

Then reference them from `README.md` like this:

```markdown
![Translation popup](docs/images/translation-popup.png)
```

Security reminder:

- Never show Gemini API keys.
- Never show Telegram Bot tokens.
- Never show `API_SECRET`.
- Do not show private VPS passwords or deployment secrets.
