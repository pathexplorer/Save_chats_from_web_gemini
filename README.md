# Save_chats_from_web_gemini

One-click export of Gemini conversations to Markdown. Works as of May 2026.

## Quick install (Tampermonkey — recommended)

1. Install the **[Tampermonkey](https://www.tampermonkey.net/)** extension for Firefox.
2. Create a new userscript and paste the entire content of `geminy_chat_exporter.js`.
3. **Done** — the script now auto-injects on every Gemini chat page.

## Usage

### Single chat (manual)
- Open any Gemini conversation.
- Press **`Ctrl+Shift+X`** (the floating blue **📥 Export Chat** button does the same thing).
- The script scrolls to the top, waits for all messages to load, then downloads a `.md` file.
- The filename is the chat title, automatically sanitised (no `?`, `:`, `|`, etc.).

### Batch export (Zipper mode)
1. **Configure Firefox:** Settings → Downloads → set a folder and **uncheck** "Always ask you where to save files".
2. On any Gemini chat page click the **🤖 Zipper: OFF** button (it turns green **Zipper: ON**).
   The setting is remembered across tabs.
3. Go to the Gemini homepage, middle-click every conversation in the sidebar.
   Each background tab will **auto-export** without any keystrokes.
4. When finished, click **🤖 Zipper: ON** to disable it.

## Keyboard shortcut

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+X` | Export current chat (same as clicking the 📥 button) |

> ⚠️ `Ctrl+Shift+E` is deliberately **not used** — it conflicts with Firefox's DevTools Network tab.

## Features

- Converts rich formatting to **GitHub-Flavoured Markdown** (headings, tables, lists, code blocks, quotes, links).
- **Auto-scroll** loads the entire conversation before exporting — no manual scrolling needed.
- **Smart filename** extracted from the sidebar or page title, with illegal characters removed.
- **Toast notifications** instead of intrusive `alert()` popups.
- **Zipper mode** for one-click batch processing of dozens of chats.

## Current pitfalls

- Does **not** support saving image attachments in questions.

## Manual fallback (without Tampermonkey)

If you prefer not to install Tampermonkey:
1. Open a conversation and manually scroll to the top.
2. Open DevTools (`F12`) → Console tab.
3. Type `allow pasting`, paste the code, press Enter.
4. Click the floating blue **📥 Export Chat** button.
