# Changelog

## [1.0.5](https://github.com/rajankarmakar/quick-snippet-generator/releases/tag/v1.0.5) — 2026-03-11

### 🐛 Bug Fixes

- upgrade CI to Node 24, update action versions ([`84cf643`](https://github.com/rajankarmakar/quick-snippet-generator/commit/84cf643))
- pin vsce to 2.22.0 for node compatibility ([`af34a9a`](https://github.com/rajankarmakar/quick-snippet-generator/commit/af34a9a))
- bump node version to 20 in CI ([`e14d40b`](https://github.com/rajankarmakar/quick-snippet-generator/commit/e14d40b))

### 🔧 Chores

- release: v1.0.4 ([`bcf48b6`](https://github.com/rajankarmakar/quick-snippet-generator/commit/bcf48b6))


## [1.0.3](https://github.com/rajankarmakar/quick-snippet-generator/releases/tag/v1.0.3) — 2026-03-11

### 🔧 Chores

- release.js file ([`7241d58`](https://github.com/rajankarmakar/quick-snippet-generator/commit/7241d58))


## [1.0.2](https://github.com/rajankarmakar/quick-snippet-generator/releases/tag/v1.0.2) — 2026-03-11

### 📝 Documentation

- update release docs ([`9724793`](https://github.com/rajankarmakar/quick-snippet-generator/commit/9724793))


## [1.0.1](https://github.com/rajankarmakar/quick-snippet-generator/releases/tag/v1.0.1) — 2026-03-11

### 🐛 Bug Fixes

- update docs ([`74ea323`](https://github.com/rajankarmakar/quick-snippet-generator/commit/74ea323))

### 📝 Documentation

- update release docs ([`a78e104`](https://github.com/rajankarmakar/quick-snippet-generator/commit/a78e104))

### 🔧 Chores

- release.js file ([`2f26fd7`](https://github.com/rajankarmakar/quick-snippet-generator/commit/2f26fd7))
- add auto release setup ([`78fdf36`](https://github.com/rajankarmakar/quick-snippet-generator/commit/78fdf36))

### 📦 Other

- Add how to gif ([`faf8684`](https://github.com/rajankarmakar/quick-snippet-generator/commit/faf8684))
- Fix template ([`00647d9`](https://github.com/rajankarmakar/quick-snippet-generator/commit/00647d9))
- Initial commit ([`e3914f4`](https://github.com/rajankarmakar/quick-snippet-generator/commit/e3914f4))


All notable changes to **Quick Snippet Generator** will be documented in this file.

## [1.0.0] - 2026-03-11

### Added
- Save selected code as a user snippet via right-click context menu
- 3-step guided input for snippet name, prefix, and description
- Visual webview editor for adding placeholders with live preview
- Language-aware saving (JS → `javascript.json`, Python → `python.json`, etc.)
- Duplicate snippet detection with overwrite confirmation
- Quick-open link to the saved snippets file after saving
- Support for 25+ languages including JS, TS, Python, HTML, CSS, Go, Rust, and more
