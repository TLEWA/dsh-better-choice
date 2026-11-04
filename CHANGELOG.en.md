# Changelog

All notable changes are documented here. This project follows
[Semantic Versioning](https://semver.org/).

[简体中文](CHANGELOG.md) · [English](CHANGELOG.en.md)

## [1.0.1] - 2026-11-04

### Fixed

- The side-ask box no longer lets a timed card keep counting while you read or write a
  side question: focus pauses the countdown, blur resumes it, and sending a side question
  moves the card to "waits for you". Previously the request could time out mid-wait, which
  left the card unsubmittable and closable only.
- Side-ask state is now per question rather than per card: busy/error/cancel no longer leak
  across questions, the new "Cancel side ask" button aborts an answer in flight, and each
  thread keeps at most 20 turns.
- The host numbers side-question thread turns consecutively (1, 2, 3 instead of 1, 3, 5),
  marks the active question by its original wire position, and tells the model when the
  user skipped a question.
- If `startActivation` throws after the fork child has been established, the child stays
  covered by the read-only guard instead of leaking out of it.
- Single-select answers with custom text now send an empty `selected`, matching the
  official composer.
- The option context menu is intercepted only when a note can actually be opened; the
  option's accessible name now includes its description, recommendation, and note state;
  an empty question batch falls back instead of crashing.
- The client's `RemoteCommands` type now models the real `remote.commands.execute` shape,
  and `@deepseek-ai/dsh-api-remotes` is declared as a peer dependency.

### Changed

- The side ask runs in a fork child (`ctx.subagents.startActivation` with
  `delivery: 'caller'`) instead of calling `ctx.llm.stream` directly. The fork seed ends
  at the parent's last completed `turn/end`, so it reuses the parent's completed-turn
  prefix and prompt cache without writing to the parent session.
- Every side ask is guarded at execution time: the child cannot call tools, and the
  parent call's `signal` plus a 30-minute watchdog cancel it. Output is capped at
  `min(32000, parent.maxTokens)`.
- The client sends all questions, the active index, notes, and the previous turns of the
  current side thread; the host renders them explicitly and tells the model that
  "刚才 / 上一条" refers to the side thread first.
- `bc-ask` registers with `recordInput: false`, so the parent's `command/run` no longer
  persists the question text.
- Added `tsconfig.json` and `npm run typecheck` (also run by `prepack`/`prepublishOnly`);
  the test suite grew to 12 cases.
- Docs describe the fork architecture, the read-only guard, the pause/engage countdown
  behavior, and the cache behavior.

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
