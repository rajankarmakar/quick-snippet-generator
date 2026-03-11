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
    placeHolder: 'e.g. My Test Function',
    validateInput: function (v) {
      return (!v || !v.trim()) ? 'Name cannot be empty' : null;
    }
  });
  if (name === undefined) { return null; }

  const prefix = await vscode.window.showInputBox({
    title: 'Quick Snippet Generator (2/3) — Prefix',
    prompt: 'Enter the trigger prefix (what you type to insert the snippet)',
    placeHolder: 'e.g. myasync',
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
    placeHolder: 'e.g. Async arrow function with try/catch'
  });
  if (description === undefined) { return null; }

  return {
    name: name.trim(),
    prefix: prefix.trim(),
    description: description.trim()
  };
}

// ─── Webview HTML builder ─────────────────────────────────────────────────────
//
// ROOT CAUSE OF ORIGINAL BUG:
//   The HTML was built with a JS template literal (backtick string).
//   The embedded <script> block also used template literals internally.
//   Nested backticks inside a backtick string corrupt the outer string,
//   silently breaking all the webview JS so postMessage never fired.
//
// FIX:
//   Build EVERY part of the HTML and the embedded script using plain
//   string concatenation and array.join() — zero backticks anywhere.

function buildWebviewHtml(selectedText, snippetInfo) {

  function htmlEncode(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // JSON.stringify produces a safe JS string literal (with surrounding quotes)
  const jsTextLiteral = JSON.stringify(selectedText);

  // ── CSS (plain string, no backticks) ────────────────────────────────────────
  const css = [
    '* { box-sizing: border-box; margin: 0; padding: 0; }',
    'body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);',
    '       color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 24px; }',
    'h1 { font-size: 18px; margin-bottom: 4px; }',
    '.subtitle { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 22px; }',
    '.section { margin-bottom: 20px; }',
    'label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em;',
    '        color: var(--vscode-descriptionForeground); margin-bottom: 6px; }',
    '.code-area, .preview-code {',
    '  background: var(--vscode-editor-background);',
    '  border: 1px solid var(--vscode-input-border, #444); border-radius: 4px;',
    '  padding: 12px; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px;',
    '  line-height: 1.5; white-space: pre-wrap; word-break: break-all;',
    '  max-height: 180px; overflow: auto; color: var(--vscode-editor-foreground); }',
    'input[type="text"] {',
    '  width: 100%; background: var(--vscode-input-background);',
    '  border: 1px solid var(--vscode-input-border, #444); color: var(--vscode-input-foreground);',
    '  padding: 7px 10px; border-radius: 4px;',
    '  font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }',
    'input[type="text"]:focus {',
    '  outline: 1px solid var(--vscode-focusBorder, #007fd4);',
    '  border-color: var(--vscode-focusBorder, #007fd4); }',
    '.hint { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 6px; line-height: 1.6; }',
    '.hint code { background: var(--vscode-textCodeBlock-background, #1e1e1e); padding: 1px 5px; border-radius: 3px; }',
    '.ph-item { display: flex; align-items: center; gap: 8px; margin-bottom: 8px;',
    '           background: var(--vscode-editor-inactiveSelectionBackground, #2a2d2e);',
    '           padding: 8px 10px; border-radius: 4px; }',
    '.ph-item input { flex: 1; }',
    '.tab-num { font-size: 11px; color: var(--vscode-descriptionForeground); white-space: nowrap; min-width: 48px; }',
    '.rm-btn { background: none; border: none; color: var(--vscode-errorForeground, #f66);',
    '          cursor: pointer; font-size: 15px; line-height: 1; padding: 0 4px; }',
    '.add-btn { background: var(--vscode-button-secondaryBackground, #3a3d3e);',
    '           border: 1px solid transparent; color: var(--vscode-button-secondaryForeground, #ccc);',
    '           padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 6px; }',
    '.add-btn:hover { opacity: 0.85; }',
    '.actions { display: flex; gap: 10px; margin-top: 24px; }',
    '.btn-save { background: var(--vscode-button-background, #0078d4);',
    '            color: var(--vscode-button-foreground, #fff); border: none;',
    '            padding: 8px 22px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; }',
    '.btn-save:hover { opacity: 0.9; }',
    '.btn-cancel { background: transparent; border: 1px solid var(--vscode-input-border, #555);',
    '              color: var(--vscode-foreground); padding: 8px 22px;',
    '              border-radius: 4px; cursor: pointer; font-size: 13px; }'
  ].join('\n');

  // ── Script (plain string concat, ZERO backticks) ─────────────────────────
  const script = [
    '(function () {',
    '  var api = acquireVsCodeApi();',
    '  var originalText = ' + jsTextLiteral + ';',
    '  var placeholders = [];',
    '  var listEl    = document.getElementById("phList");',
    '  var previewEl = document.getElementById("preview");',
    '',
    '  function buildBody() {',
    '    var text = originalText;',
    '    for (var i = 0; i < placeholders.length; i++) {',
    '      var ph = placeholders[i];',
    '      if (!ph.find || ph.find.trim() === "") { continue; }',
    '      var label    = ph.label.trim() || ph.find.trim();',
    '      var tabStop  = "${" + (i + 1) + ":" + label + "}";',
    '      text = text.split(ph.find).join(tabStop);',
    '    }',
    '    text = text + "${0}";',
    '    return text.split("\\n");',
    '  }',
    '',
    '  function updatePreview() {',
    '    try { previewEl.textContent = buildBody().join("\\n"); }',
    '    catch (e) { previewEl.textContent = "Preview error: " + e.message; }',
    '  }',
    '',
    '  function renderList() {',
    '    listEl.innerHTML = "";',
    '    for (var i = 0; i < placeholders.length; i++) {',
    '      var ph   = placeholders[i];',
    '      var row  = document.createElement("div");',
    '      row.className = "ph-item";',
    '',
    '      var span = document.createElement("span");',
    '      span.className = "tab-num";',
    '      span.textContent = "Tab " + (i + 1);',
    '',
    '      var findIn = document.createElement("input");',
    '      findIn.type = "text";',
    '      findIn.placeholder = "Exact text to replace";',
    '      findIn.value = ph.find;',
    '      findIn.dataset.idx   = i;',
    '      findIn.dataset.field = "find";',
    '',
    '      var labelIn = document.createElement("input");',
    '      labelIn.type = "text";',
    '      labelIn.placeholder = "Label (e.g. funcName)";',
    '      labelIn.value = ph.label;',
    '      labelIn.dataset.idx   = i;',
    '      labelIn.dataset.field = "label";',
    '',
    '      var rmBtn = document.createElement("button");',
    '      rmBtn.className = "rm-btn";',
    '      rmBtn.textContent = "x";',
    '      rmBtn.dataset.idx = i;',
    '',
    '      row.appendChild(span);',
    '      row.appendChild(findIn);',
    '      row.appendChild(labelIn);',
    '      row.appendChild(rmBtn);',
    '      listEl.appendChild(row);',
    '    }',
    '    updatePreview();',
    '  }',
    '',
    '  document.getElementById("addBtn").addEventListener("click", function () {',
    '    placeholders.push({ find: "", label: "" });',
    '    renderList();',
    '  });',
    '',
    '  listEl.addEventListener("input", function (e) {',
    '    var idx   = parseInt(e.target.dataset.idx, 10);',
    '    var field = e.target.dataset.field;',
    '    if (!isNaN(idx) && field) {',
    '      placeholders[idx][field] = e.target.value;',
    '      updatePreview();',
    '    }',
    '  });',
    '',
    '  listEl.addEventListener("click", function (e) {',
    '    if (e.target.classList.contains("rm-btn")) {',
    '      placeholders.splice(parseInt(e.target.dataset.idx, 10), 1);',
    '      renderList();',
    '    }',
    '  });',
    '',
    '  document.getElementById("saveBtn").addEventListener("click", function () {',
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

  // ── Assemble HTML (plain concatenation, zero backticks) ──────────────────
  return (
    '<!DOCTYPE html>' +
    '<html lang="en"><head>' +
    '<meta charset="UTF-8"/>' +
    '<meta http-equiv="Content-Security-Policy"' +
    '  content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\';"/>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>' +
    '<title>Quick Snippet Generator</title>' +
    '<style>' + css + '</style>' +
    '</head><body>' +

    '<h1>&#9986;&#65039; Quick Snippet Generator</h1>' +
    '<p class="subtitle">' +
      'Snippet: <strong>' + htmlEncode(snippetInfo.name) + '</strong>' +
      ' &nbsp;|&nbsp; Prefix: <code>' + htmlEncode(snippetInfo.prefix) + '</code>' +
    '</p>' +

    '<div class="section"><label>Selected Code</label>' +
    '<div class="code-area">' + htmlEncode(selectedText) + '</div></div>' +

    '<div class="section">' +
    '<label>Placeholders <span style="text-transform:none;font-weight:normal">(optional)</span></label>' +
    '<p class="hint">Click <strong>+ Add Placeholder</strong>, type the exact text to replace' +
    ' and a label. It becomes a tab stop: <code>${1:label}</code></p>' +
    '<div id="phList"></div>' +
    '<button class="add-btn" id="addBtn">+ Add Placeholder</button>' +
    '</div>' +

    '<div class="section"><label>Snippet Preview</label>' +
    '<div class="preview-code" id="preview"></div></div>' +

    '<div class="actions">' +
    '<button class="btn-save" id="saveBtn">&#128190; Save Snippet</button>' +
    '<button class="btn-cancel" id="cancelBtn">Cancel</button>' +
    '</div>' +

    '<script>' + script + '<\/script>' +
    '</body></html>'
  );
}

// ─── Webview panel ────────────────────────────────────────────────────────────

function showPlaceholderPanel(context, selectedText, snippetInfo) {
  return new Promise(function (resolve) {
    var settled = false;
    function settle(result) {
      if (!settled) { settled = true; resolve(result); }
    }

    var panel = vscode.window.createWebviewPanel(
      'quickSnippetGenerator',
      'Quick Snippet — ' + snippetInfo.name,
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = buildWebviewHtml(selectedText, snippetInfo);

    panel.webview.onDidReceiveMessage(
      function (msg) {
        if (msg.command === 'save') {
          panel.dispose();
          settle({ body: msg.body, cancelled: false });
        } else if (msg.command === 'cancel') {
          panel.dispose();
          settle({ body: null, cancelled: true });
        }
      },
      undefined,
      context.subscriptions
    );

    panel.onDidDispose(function () {
      settle({ body: null, cancelled: true });
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

  const info = await collectSnippetInfo();
  if (!info) { return; }

  const result = await showPlaceholderPanel(context, selectedText, info);
  if (result.cancelled || !result.body) { return; }

  const snippets = readSnippets(filePath);

  if (snippets[info.name]) {
    const choice = await vscode.window.showWarningMessage(
      'A snippet named "' + info.name + '" already exists. Overwrite?',
      'Overwrite', 'Cancel'
    );
    if (choice !== 'Overwrite') { return; }
  }

  snippets[info.name] = {
    prefix: info.prefix,
    body: result.body,
    description: info.description || info.name
  };

  try {
    writeSnippets(filePath, snippets);
    const fileName = path.basename(filePath);
    const action = await vscode.window.showInformationMessage(
      'Snippet "' + info.name + '" saved to ' + fileName + '!',
      'Open Snippets File'
    );
    if (action === 'Open Snippets File') {
      const doc = await vscode.workspace.openTextDocument(filePath);
      vscode.window.showTextDocument(doc);
    }
  } catch (err) {
    vscode.window.showErrorMessage('Quick Snippet Generator: Save failed — ' + err.message);
  }
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
