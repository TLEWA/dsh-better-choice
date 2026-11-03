# Changelog

All notable changes are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-04

First public release.

### Added

- Right-click an option to open a per-option supplement note; notes are kept per
  option for single- and multi-select and merged into the answer's `custom` text.
- Bottom-of-card side ask: ask the current model about the pending question and see a
  streamed, read-only answer without leaving the card.
- Side ask reuses the session's derived history, model route, tool declarations, and
  tool history, while never writing to the session, so the main prompt prefix and its
  cache stay intact.
- Chinese and English UI copy, following the DSH locale.

### Compatibility

- DSH client `0.2.0-rc` family (`^0.2.0-rc.1`).
- Node.js 20 or newer.

### Notes

- Generic choice cards only. Plan-review, approval, and other card types remain with
  the official composer.
- No telemetry, no remote endpoints, and no tool execution from the side ask.
