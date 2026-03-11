'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Language map ─────────────────────────────────────────────────────────────

const LANGUAGE_MAP = {
  javascript: 'javascript',
  javascriptreact: 'javascriptreact',
  typescript: 'typescript',
  typescriptreact: 'typescriptreact',
  python: 'python',
  html: 'html',
  css: 'css',
  json: 'jsonc',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'csharp',
  go: 'go',
  rust: 'rust',
  php: 'php',
  ruby: 'ruby',
  swift: 'swift',
  kotlin: 'kotlin',
  shellscript: 'shellscript',
  markdown: 'markdown',
  xml: 'xml',
  yaml: 'yaml',
  sql: 'sql',
  r: 'r',
  dart: 'dart',
  vue: 'vue',
  svelte: 'svelte',
};

// ─── File helpers ─────────────────────────────────────────────────────────────

function getSnippetsDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || os.homedir(), 'Code', 'User', 'snippets');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'snippets');
  }
  return path.join(os.homedir(), '.config', 'Code', 'User', 'snippets');
}

function getSnippetFilePath(languageId) {
  const name = LANGUAGE_MAP[languageId] || languageId;
  return path.join(getSnippetsDir(), name + '.json');
}

function readSnippets(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const clean = raw
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      return JSON.parse(clean);
    }
  } catch (_) {
    vscode.window.showWarningMessage(
      'Quick Snippet Generator: Could not parse existing snippets file — new entry will be appended safely.'
    );
  }
  return {};
}

function writeSnippets(filePath, snippets) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(snippets, null, 2), 'utf8');
}

// ─── Input flow ───────────────────────────────────────────────────────────────

async function collectSnippetInfo() {
  const name = await vscode.window.showInputBox({
    title: 'Quick Snippet Generator (1/3) — Name',
    prompt: 'Enter a name for your snippet',
    placeHolder: 'e.g. My Custom Snippet',
    validateInput: function (v) {
      return (!v || !v.trim()) ? 'Name cannot be empty' : null;
    }
  });
  if (name === undefined) { return null; }

  const prefix = await vscode.window.showInputBox({
    title: 'Quick Snippet Generator (2/3) — Prefix',
    prompt: 'Enter the trigger prefix (what you type to insert the snippet)',
    placeHolder: 'e.g. mysnippet',
    value: name.trim().toLowerCase().replace(/\s+/g, '-'),
    validateInput: function (v) {
      if (!v || !v.trim()) { return 'Prefix cannot be empty'; }
      if (/\s/.test(v)) { return 'Prefix cannot contain spaces'; }
      return null;
    }
  });
  if (prefix === undefined) { return null; }

  const description = await vscode.window.showInputBox({
    title: 'Quick Snippet Generator (3/3) — Description',
    prompt: 'Enter a short description (optional)',
    placeHolder: 'e.g. This is my custom snippet'
  });
  if (description === undefined) { return null; }

  return {
    name: name.trim(),
    prefix: prefix.trim(),
    description: description.trim()
  };
}

// ─── Webview HTML ─────────────────────────────────────────────────────────────
// New placeholder UX:
//   - Code shown in a contenteditable div
//   - User clicks to place cursor inside the code
//   - User types an optional label, clicks "+ Add Placeholder at Cursor"
//   - A coloured chip is inserted at cursor position inline
//   - Each chip has an ✕ button to delete it (restores the word, renumbers tabs)
//   - buildBody() walks the DOM to produce the final snippet body array

function buildWebviewHtml(selectedText, snippetInfo) {

  function htmlEncode(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const jsTextLiteral = JSON.stringify(selectedText);

  const css = [
    '* { box-sizing: border-box; margin: 0; padding: 0; }',
    'body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);',
    '  color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 24px; }',
    'h1 { font-size: 18px; margin-bottom: 4px; }',
    '.subtitle { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 22px; }',
    '.section { margin-bottom: 20px; }',
    'label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em;',
    '  color: var(--vscode-descriptionForeground); margin-bottom: 6px; }',
    '#codeEditor {',
    '  background: var(--vscode-editor-background);',
    '  border: 1px solid var(--vscode-input-border, #444); border-radius: 4px;',
    '  padding: 12px; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px;',
    '  line-height: 1.8; white-space: pre-wrap; word-break: break-all;',
    '  min-height: 48px; max-height: 220px; overflow: auto;',
    '  color: var(--vscode-editor-foreground); outline: none; cursor: text; }',
    '#codeEditor:focus { border-color: var(--vscode-focusBorder, #007fd4); }',
    '.ph-chip {',
    '  display: inline-flex; align-items: center; gap: 2px;',
    '  background: var(--vscode-badge-background, #1f6feb);',
    '  color: var(--vscode-badge-foreground, #fff);',
    '  border-radius: 4px; padding: 1px 5px 1px 6px; font-size: 11px;',
    '  font-family: var(--vscode-editor-font-family, monospace);',
    '  user-select: none; vertical-align: middle; white-space: nowrap; line-height: 1.6; }',
    '.ph-chip-rm {',
    '  background: none; border: none; color: inherit; cursor: pointer;',
    '  font-size: 11px; padding: 0 1px; opacity: 0.75; line-height: 1; }',
    '.ph-chip-rm:hover { opacity: 1; }',
    '.preview-code {',
    '  background: var(--vscode-editor-background);',
    '  border: 1px solid var(--vscode-input-border, #444); border-radius: 4px;',
    '  padding: 12px; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px;',
    '  line-height: 1.5; white-space: pre-wrap; word-break: break-all;',
    '  max-height: 180px; overflow: auto; color: var(--vscode-editor-foreground); }',
    'input[type="text"] {',
    '  background: var(--vscode-input-background);',
    '  border: 1px solid var(--vscode-input-border, #444); color: var(--vscode-input-foreground);',
    '  padding: 5px 8px; border-radius: 4px;',
    '  font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }',
    'input[type="text"]:focus { outline: 1px solid var(--vscode-focusBorder, #007fd4);',
    '  border-color: var(--vscode-focusBorder, #007fd4); }',
    '.hint { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 8px; line-height: 1.6; }',
    '.toolbar { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }',
    '.toolbar label { text-transform: none; letter-spacing: 0; font-size: 12px; margin: 0; white-space: nowrap; }',
    '#labelInput { width: 130px; }',
    '.add-btn { background: var(--vscode-button-secondaryBackground, #3a3d3e);',
    '  border: 1px solid transparent; color: var(--vscode-button-secondaryForeground, #ccc);',
    '  padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; white-space: nowrap; }',
    '.add-btn:hover { opacity: 0.85; }',
    '.actions { display: flex; gap: 10px; margin-top: 24px; align-items: center; }',
    '.btn-save { background: var(--vscode-button-background, #0078d4);',
    '  color: var(--vscode-button-foreground, #fff); border: none;',
    '  padding: 8px 22px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; }',
    '.btn-save:hover { opacity: 0.9; }',
    '.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }',
    '.btn-cancel { background: transparent; border: 1px solid var(--vscode-input-border, #555);',
    '  color: var(--vscode-foreground); padding: 8px 22px;',
    '  border-radius: 4px; cursor: pointer; font-size: 13px; }',
    '.btn-cancel:hover { background: var(--vscode-list-hoverBackground); }',
    '#statusMsg { font-size: 12px; margin-left: 12px; }'
  ].join('\n');

  const script = [
    '(function () {',
    '  var api       = acquireVsCodeApi();',
    '  var editor    = document.getElementById("codeEditor");',
    '  var previewEl = document.getElementById("preview");',
    '  var saveBtn   = document.getElementById("saveBtn");',
    '  var labelIn   = document.getElementById("labelInput");',
    '  var statusMsg = document.getElementById("statusMsg");',
    '  var savedRange = null;',
    '',
    // Track cursor position whenever user interacts with the editor
    '  function saveRange() {',
    '    var sel = window.getSelection();',
    '    if (sel && sel.rangeCount > 0) {',
    '      var r = sel.getRangeAt(0);',
    '      if (editor.contains(r.commonAncestorContainer)) {',
    '        savedRange = r.cloneRange();',
    '      }',
    '    }',
    '  }',
    '  editor.addEventListener("mouseup", saveRange);',
    '  editor.addEventListener("keyup",   saveRange);',
    '  editor.addEventListener("click",   saveRange);',
    // Save range before label input steals focus
    '  labelIn.addEventListener("mousedown", function () { saveRange(); });',
    '',
    // Renumber all chips sequentially after any add/remove
    '  function renumberChips() {',
    '    var chips = editor.querySelectorAll(".ph-chip");',
    '    for (var i = 0; i < chips.length; i++) {',
    '      var lbl = chips[i].dataset.label;',
    '      chips[i].querySelector(".ph-text").textContent = "${" + (i + 1) + ":" + lbl + "}";',
    '    }',
    '    updatePreview();',
    '  }',
    '',
    // Create a placeholder chip element
    '  function makeChip(label) {',
    '    var chip = document.createElement("span");',
    '    chip.className       = "ph-chip";',
    '    chip.contentEditable = "false";',
    '    chip.dataset.label   = label;',
    '',
    '    var txt = document.createElement("span");',
    '    txt.className   = "ph-text";',
    '    txt.textContent = "${1:" + label + "}";',
    '',
    '    var rm = document.createElement("button");',
    '    rm.className   = "ph-chip-rm";',
    '    rm.textContent = "x";',
    '    rm.title       = "Remove placeholder";',
    '    rm.addEventListener("click", function (e) {',
    '      e.preventDefault();',
    '      e.stopPropagation();',
    '      chip.parentNode.removeChild(chip);',
    '      renumberChips();',
    '    });',
    '',
    '    chip.appendChild(txt);',
    '    chip.appendChild(rm);',
    '    return chip;',
    '  }',
    '',
    // Insert chip at saved cursor, or append at end
    '  document.getElementById("addBtn").addEventListener("click", function () {',
    '    var label = labelIn.value.trim() || "value";',
    '    var chip  = makeChip(label);',
    '',
    '    if (savedRange) {',
    '      var sel = window.getSelection();',
    '      savedRange.deleteContents();',
    '      savedRange.insertNode(chip);',
    '      savedRange.setStartAfter(chip);',
    '      savedRange.collapse(true);',
    '      sel.removeAllRanges();',
    '      sel.addRange(savedRange);',
    '      savedRange = savedRange.cloneRange();',
    '    } else {',
    '      editor.appendChild(chip);',
    '    }',
    '',
    '    labelIn.value = "";',
    '    renumberChips();',
    '    editor.focus();',
    '  });',
    '',
    // Walk the editor DOM to produce the snippet body array
    '  function buildBody() {',
    '    var result  = "";',
    '    var chipIdx = 0;',
    '    function walk(node) {',
    '      if (node.nodeType === 3) {',
    '        result += node.textContent;',
    '      } else if (node.nodeType === 1) {',
    '        if (node.classList && node.classList.contains("ph-chip")) {',
    '          chipIdx++;',
    '          result += "${" + chipIdx + ":" + (node.dataset.label || "value") + "}";',
    '        } else if (node.nodeName === "BR") {',
    '          result += "\\n";',
    '        } else {',
    '          for (var i = 0; i < node.childNodes.length; i++) { walk(node.childNodes[i]); }',
    '          if (node.nodeName === "DIV" || node.nodeName === "P") { result += "\\n"; }',
    '        }',
    '      }',
    '    }',
    '    for (var i = 0; i < editor.childNodes.length; i++) { walk(editor.childNodes[i]); }',
    '    result = result.replace(/\\n+$/, "");',
    '    result += "${0}";',
    '    return result.split("\\n");',
    '  }',
    '',
    '  function updatePreview() {',
    '    try { previewEl.textContent = buildBody().join("\\n"); }',
    '    catch (e) { previewEl.textContent = "Preview error: " + e.message; }',
    '  }',
    '',
    '  editor.addEventListener("input", updatePreview);',
    '',
    '  saveBtn.addEventListener("click", function () {',
    '    saveBtn.disabled = true;',
    '    statusMsg.textContent = "Saving...";',
    '    api.postMessage({ command: "save", body: buildBody() });',
    '  });',
    '',
    '  document.getElementById("cancelBtn").addEventListener("click", function () {',
    '    api.postMessage({ command: "cancel" });',
    '  });',
    '',
    '  updatePreview();',
    '})();'
  ].join('\n');

  return (
    '<!DOCTYPE html>' +
    '<html lang="en"><head>' +
    '<meta charset="UTF-8"/>' +
    '<meta http-equiv="Content-Security-Policy"' +
    ' content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\';"/>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>' +
    '<title>Quick Snippet Generator</title>' +
    '<style>' + css + '</style>' +
    '</head><body>' +

    '<h1>&#9986;&#65039; Quick Snippet Generator</h1>' +
    '<p class="subtitle">' +
    'Snippet: <strong>' + htmlEncode(snippetInfo.name) + '</strong>' +
    ' &nbsp;|&nbsp; Prefix: <code>' + htmlEncode(snippetInfo.prefix) + '</code>' +
    '</p>' +

    '<div class="section">' +
    '<label>Code Editor' +
    '<span style="text-transform:none;font-weight:normal;letter-spacing:0;margin-left:6px">' +
    '— click to place cursor, then click the button below to insert a placeholder</span>' +
    '</label>' +
    '<div id="codeEditor" contenteditable="true" spellcheck="false">' + htmlEncode(selectedText) + '</div>' +
    '<div class="toolbar">' +
    '  <label for="labelInput">Label:</label>' +
    '  <input type="text" id="labelInput" placeholder="e.g. funcName" />' +
    '  <button class="add-btn" id="addBtn">+ Add Placeholder at Cursor</button>' +
    '</div>' +
    '<p class="hint">&#x1F4CC; Click anywhere in the code to position your cursor, type an optional label, then click the button.' +
    ' Hit <strong>x</strong> on any chip to remove it. Tab stops are renumbered automatically.</p>' +
    '</div>' +

    '<div class="section"><label>Snippet Preview</label>' +
    '<div class="preview-code" id="preview"></div></div>' +

    '<div class="actions">' +
    '<button class="btn-save" id="saveBtn">&#128190; Save Snippet</button>' +
    '<button class="btn-cancel" id="cancelBtn">Cancel</button>' +
    '<span id="statusMsg"></span>' +
    '</div>' +

    '<script>' + script + '<\/script>' +
    '</body></html>'
  );
}

// ─── Webview panel ────────────────────────────────────────────────────────────
//
// FIX: The original code called panel.dispose() then settle() inside the
// message handler. dispose() synchronously fires onDidDispose which called
// settle({ cancelled:true }) first — so the save result was always discarded.
//
// Fix: Write the file INSIDE onDidReceiveMessage (before disposing),
// so the panel only handles UI. No more Promise-based resolve race.

function showPlaceholderPanel(context, selectedText, snippetInfo, filePath, snippetData) {
  return new Promise(function (resolve) {

    var panel = vscode.window.createWebviewPanel(
      'quickSnippetGenerator',
      'Quick Snippet — ' + snippetInfo.name,
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = buildWebviewHtml(selectedText, snippetInfo);

    var saveHandled = false;

    panel.webview.onDidReceiveMessage(
      function (msg) {
        if (msg.command === 'save' && !saveHandled) {
          saveHandled = true;

          // ── Write the file HERE before disposing ──────────────────────────
          // This avoids the dispose→onDidDispose→cancelled race condition.
          try {
            var existing = readSnippets(filePath);
            existing[snippetData.name] = {
              prefix: snippetData.prefix,
              body: msg.body,
              description: snippetData.description || snippetData.name
            };
            writeSnippets(filePath, existing);

            // Close panel AFTER successful write
            panel.dispose();

            var fileName = path.basename(filePath);
            vscode.window.showInformationMessage(
              'Snippet "' + snippetData.name + '" saved to ' + fileName + '!',
              'Open Snippets File'
            ).then(function (action) {
              if (action === 'Open Snippets File') {
                vscode.workspace.openTextDocument(filePath).then(function (doc) {
                  vscode.window.showTextDocument(doc);
                });
              }
            });

            resolve({ saved: true });

          } catch (err) {
            panel.dispose();
            vscode.window.showErrorMessage(
              'Quick Snippet Generator: Save failed — ' + err.message
            );
            resolve({ saved: false });
          }

        } else if (msg.command === 'cancel') {
          panel.dispose();
          resolve({ saved: false });
        }
      },
      undefined,
      context.subscriptions
    );

    // onDidDispose only fires if user manually closes the panel (X button)
    panel.onDidDispose(function () {
      if (!saveHandled) {
        resolve({ saved: false });
      }
    });
  });
}

// ─── Main command ─────────────────────────────────────────────────────────────

async function saveSnippetCommand(context) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('Quick Snippet Generator: No active editor.');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('Quick Snippet Generator: Select some code first.');
    return;
  }

  const selectedText = editor.document.getText(selection);
  const languageId   = editor.document.languageId;
  const filePath     = getSnippetFilePath(languageId);

  // Step 1-3: collect name, prefix, description
  const info = await collectSnippetInfo();
  if (!info) { return; }

  // Check for duplicate before opening webview
  const existing = readSnippets(filePath);
  if (existing[info.name]) {
    const choice = await vscode.window.showWarningMessage(
      'A snippet named "' + info.name + '" already exists. Overwrite it?',
      'Overwrite',
      'Cancel'
    );
    if (choice !== 'Overwrite') { return; }
  }

  // Step 4: open webview — file writing now happens inside the panel handler
  await showPlaceholderPanel(context, selectedText, info, filePath, info);
}

// ─── Extension entry points ───────────────────────────────────────────────────

function activate(context) {
  const cmd = vscode.commands.registerCommand(
    'snippetSaver.saveSnippet',
    function () { return saveSnippetCommand(context); }
  );
  context.subscriptions.push(cmd);
}

function deactivate() {}

module.exports = { activate, deactivate };
