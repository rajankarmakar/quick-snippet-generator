# Quick Snippet Generator

> Save any selected code as a reusable VS Code snippet — right from the context menu.

## Features

- ✂️ **Right-click to save** — Select code → Right-click → *Save as User Snippet*
- 🌐 **Language-aware** — Automatically saves to the correct snippet file (`javascript.json`, `python.json`, etc.)
- 📝 **Guided setup** — 3-step input for name, prefix (trigger word), and description
- 🔖 **Placeholder editor** — Visual UI to mark dynamic parts of your snippet as tab stops
- 👀 **Live preview** — See the final snippet body update in real time as you add placeholders
- ⚠️ **Duplicate detection** — Warns before overwriting an existing snippet
- 🔗 **Quick access** — Jump straight to the saved snippets file after saving

## How to Use

**1. Select your code**

Highlight any block of code in the editor.

**2. Right-click → Save as User Snippet**

The option appears in the context menu only when code is selected.

![Context menu](images/context-menu.png)

**3. Fill in the details**

| Step | Field | Example |
|------|-------|---------|
| 1 | Name | `Async Fetch Wrapper` |
| 2 | Prefix | `asyncfetch` |
| 3 | Description | `Fetch with async/await and error handling` |

**4. Add placeholders (optional)**

In the visual editor, click **+ Add Placeholder** and enter:
- **Text to replace** — the exact string in your code (e.g. `fetchData`)
- **Label** — the tab stop label (e.g. `functionName`)

This turns `fetchData` → `${1:functionName}` in the saved snippet.

**5. Save**

Click **💾 Save Snippet** and you're done. Type your prefix in any matching file to use it.

## Supported Languages

JavaScript, TypeScript, JSX, TSX, Python, HTML, CSS, JSON, Java, C, C++, C#, Go, Rust, PHP, Ruby, Swift, Kotlin, Shell, Markdown, XML, YAML, SQL, R, Dart, Vue, Svelte — and any other language VS Code supports (falls back to language ID).

## Requirements

- VS Code `1.74.0` or higher

## Extension Settings

This extension has no configurable settings.

## Known Issues

- Snippets files that use `//` comments (JSONC format) are stripped before parsing to avoid errors. Your existing snippets are preserved.

## Release Notes

### 1.0.0
Initial release of Quick Snippet Generator.

---

**Enjoy!** If you find this useful, please leave a ⭐ rating on the Marketplace.
