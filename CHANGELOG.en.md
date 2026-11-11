# Changelog

All notable changes are documented here. This project follows
[Semantic Versioning](https://semver.org/).

[简体中文](CHANGELOG.md) · [English](CHANGELOG.en.md)

## [Unreleased]

### Fixed

- With a bottom custom answer typed in single-select, right-clicking an option now only opens
  its note field instead of re-selecting the option, so the card's checkmark matches what is
  submitted; the note travels as `(unselected)` and the custom answer remains the answer.

## [1.1.0] - 2026-11-11

- Adopt shared Codex PR review rules and repository-specific review guidance; preserve existing CI, human approval, and release behavior.

### Fixed

- Cancelling a side ask or hitting its 30-minute timeout now also stops and releases the published fork child; a result delivered before the cancellation is not overwritten, and the tool guard is lifted only after the child winds down.
- When `startActivation` throws after the child materialized, the reserved childId is released through the host's `drainChildren` instead of staying owned forever.
- Option notes are read from own properties only: labels such as `constructor` or `__proto__` no longer throw or surface prototype functions as notes.
- Multi-select questions now preselect every option carrying a recommendation marker, matching the official composer; single-select still preselects only the first.

### Compatibility

- Same DSH compatibility range (`0.2.x`); fold `[Unreleased]` into the next version at release time.

## [1.0.6] - 2026-11-09

### Changed

- Adopted the shared `TLEWA/dsh-plugin-ci` gate and release workflow; `ci / ci-ok` is now the only required check before merge.
- npm releases now use the `NPM_TOKEN` fallback inside the release workflow. No runtime, API, or user-visible behavior changes.

### Compatibility

- Same DSH compatibility range as 1.0.5 (`0.2.x`); verified by the CI Ubuntu/Windows × Node 20/22/24 matrix.

## [1.0.5] - 2026-11-06

### Fixed

- A single-select note is now submitted with its option label (for example
  `Plan B: roll out to 5% first`). It used to be plain text, so once a bottom custom answer
  replaced the selection (official semantics) the note had neither a label nor the
  "(未选)" marker and the model could not tell which option it belonged to. Single- and
  multi-select now share one labelling rule, matching the README example.
- A question with only an option note (no selection, no custom answer) is no longer
  treated as unanswered and can be submitted.
- The side-question box grows with its text up to six lines; it used to stay 36px tall
  and scroll horizontally.
- A plugin reload or upgrade no longer keeps the previous stylesheet: the sheet is
  reference-counted by mounted instances, refreshed in place on reload, and removed only
  by the last user. The side-ask bridge likewise clears only the instance that installed
  it.
- The side-ask failure fallback is localized; `side question failed` no longer leaks
  into the Chinese UI.

### Changed

- Answer shaping moved to React-free `src/client/answer.ts` with 8 new tests covering
  single/multi select, deselected notes, skipped and missing drafts (the client half had
  no tests before).
- Removed unused `sideActions` and `sideTextarea` classes plus 3 unused copy keys.
- Typing no longer rebuilds the drafts array or recomputes the restore disposition each
  render, and the question detail plus side answers skip Markdown re-parsing while their
  text is unchanged.

## [1.0.4] - 2026-11-06

### Fixed

- Right-clicking an option to open its note and then clicking another option left the
  first option's blue highlight in place, which looked like the click was ignored. A
  click (or a single-select right-click) that deselects an option now closes that
  option's note row too; the typed note stays in the draft and is still submitted as
  "(未选)" instead of being lost.
- A long side answer squeezed the choice area down to a sliver (39px measured). While a
  side thread exists the option list now keeps a floor of
  `min(200px, calc(min(66vh,560px) - 260px))`, the side panel yields height first and
  scrolls inside its own thread, and the card cap moves from `min(60vh,520px)` to
  `min(66vh,560px)`. Without a side thread the card geometry is unchanged.

### Compatibility

- Verified on a real DSH `0.2.2-rc.1` Web host: right-click notes, switching
  options, card layout with a long side answer, minimize, and custom answers
  replacing the selection.

## [1.0.3] - 2026-11-05

### Changed

- `package.json` now declares `engines.dsh: ">=0.2.0-rc.1 <0.3.0-0"`, stating the
  supported DSH version range explicitly. The DSH plugin marketplace and runtime use it
  to display and enforce compatible versions (without it, the market listed the plugin
  as compatible with every version).
- No runtime code change.
- The release workflow also uploads a version-free `dsh-better-choice.tgz` asset so
  `releases/latest/download/` links keep working.

### Compatibility

- Supports DSH `0.2.x` from `0.2.0-rc.1`; verified on a real `0.2.2-rc.1` web host.

## [1.0.2] - 2026-11-05

### Changed

- Development type-checking now runs against the real DSH `0.2.2-rc.1` client contract
  packages (`dsh-client-ui-renderer`, `dsh-client-ui-session`, `dsh-client-ui-slots`,
  `dsh-client-locale`, `dsh-client-ui-conversation`). The local ambient shims that
  shadowed the real types are gone; `types/client-env.d.ts` only pulls the types in.
  `npm run typecheck` now really surfaces slot and `PendingQuestion` contract changes.
- Added `@deepseek-ai/dsh-client-ui-renderer` and `@deepseek-ai/dsh-client-ui-session`
  (`^0.2.2-rc.1`) to devDependencies.

### Compatibility

- Verified on a real DSH `0.2.2-rc.1` web host: question card rendering, CDP right-click
  note, merging the note into the submitted answer, the fork side ask, and submitting /
  closing the card all work.
- Host commands, subagents, the tool guard, the slot chain and the `PendingQuestion`
  contract have no breaking changes in 0.2.2-rc.1. This release changes no client or host
  runtime code; peer dependencies stay at `^0.2.0-rc.1` (the whole `0.2.0-rc` family can
  install it).

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
