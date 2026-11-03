# dsh-better-choice

<img src="https://raw.githubusercontent.com/TLEWA/dsh-better-choice/main/assets/icon-180.png" width="96" align="right" alt="Plugin icon" />

[![CI](https://github.com/TLEWA/dsh-better-choice/actions/workflows/ci.yml/badge.svg)](https://github.com/TLEWA/dsh-better-choice/actions/workflows/ci.yml)
[![Release](https://github.com/TLEWA/dsh-better-choice/actions/workflows/release.yml/badge.svg)](https://github.com/TLEWA/dsh-better-choice/releases)
[![npm version](https://img.shields.io/npm/v/dsh-better-choice.svg)](https://www.npmjs.com/package/dsh-better-choice)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[简体中文](README.md) · [English](README.en.md)

An enhancement for DeepSeek Harness's `ask_user_question` card:

- **Right-click an option to annotate it** — a note field opens directly under that
  option, and the note travels to the model with the selection, instead of forcing
  a paragraph into the free-form "other" row.
- **Ask a side question before choosing** — a side-ask box at the bottom of the card
  answers from the live conversation. The answer stays in the card: it is not
  submitted, does not touch the main conversation, and never chooses for you.

Left-click selection, skip, previous/next, countdown, and "answer slowly" all behave
exactly as before. Plan-review, approval, and other non-generic cards remain with the
official composer.

## Features

| Capability | Behavior |
| --- | --- |
| Right-click note | Right-clicking selects the option if needed and opens its note field; moving to the next question folds it and keeps the text |
| Per-option memory | Single- and multi-select keep one independent note per option; switching options never mixes drafts |
| Protocol unchanged | `selected` still carries the original labels; notes are merged into `custom`; no notes means the official payload, byte for byte |
| Notes on unselected options | In multi-select, a note on an unchecked option is marked `(unselected)` so the model can tell |
| Side ask with context | Uses the current session's model, history, tool declarations, and tool history |
| No interruption | Separate thread, multiple follow-ups; no session writes, so the main conversation's cacheable prefix stays intact |
| Read-only | The side ask calls no tools, does not resume the task, does not choose; capped at 700 output tokens |
| Official behavior kept | Left-click, free-form row, skip, paging, countdown, post-timeout continuation, and settled-answer review are untouched |

### Right-click notes

In single-select, right-clicking an option selects it and opens a note field below it.
The note does not replace the option; it is attached to it:

```json
{
  "answers": [
    {
      "id": "question-id",
      "selected": ["Option B"],
      "custom": "Option B: roll out to 5% first, watch for an hour, then ramp"
    }
  ]
}
```

In multi-select, each option gets its own note and each note becomes one line:

```text
Option A: keep the legacy endpoint
Option C: remove it next iteration
```

With no notes, the request is identical to stock DSH and no `custom` is added.

### Side ask

The bottom of the question card has a "ask first" box. Enter sends, Shift+Enter
inserts a newline. The answer streams into the card and you can ask follow-ups.
It uses the session's model and context, but:

- it does not start a child agent, so it cannot deadlock behind the pending
  `ask_user_question`;
- it never writes to the session, so the main conversation and its prompt-cache
  prefix are unchanged;
- it makes no tool calls, edits no files, and never submits the answer.

Good questions: "What is the production difference between these two options?",
"Which files would option B touch?", "Where did that conclusion come from?"
Then choose.

## Installation

Requires DSH 0.2.0-rc family (client packages `^0.2.0-rc.1`) and Node.js 20+.

### From npm (recommended)

1. Open **Plugins** in the sidebar → **Install plugin**;
2. Enter the package name:

   ```text
   dsh-better-choice
   ```

3. Hard-refresh after installation (`Ctrl+Shift+R`); restart the desktop app if the
   host half has not loaded.

Pin a version:

```text
dsh-better-choice@1.0.0
```

Equivalent CLI:

```powershell
dsh plugin --profile desktop add dsh-better-choice@1.0.0
```

### From GitHub

`lib/` is committed, so no local build is needed:

```text
https://github.com/TLEWA/dsh-better-choice
```

Pin a tag:

```text
https://github.com/TLEWA/dsh-better-choice#v1.0.0
```

Or install the release asset directly:

```text
https://github.com/TLEWA/dsh-better-choice/releases/download/v1.0.0/dsh-better-choice-1.0.0.tgz
```

Equivalent CLI:

```powershell
dsh plugin --profile desktop add github:TLEWA/dsh-better-choice#v1.0.0
```

### From source

```powershell
git clone https://github.com/TLEWA/dsh-better-choice.git
cd dsh-better-choice
npm install
npm run build
npm test
dsh plugin --profile desktop add .
```

Hard-refresh after installing or upgrading. If the host command `bc-ask` is not
registered, the side-ask box reports an error; restart the desktop app.

## Usage

1. Wait for a normal choice question from the model;
2. To add constraints: right-click an option, write the note, then submit normally;
3. To verify something first: ask in the bottom box, read the answer, then choose;
4. Both can be used together; side-ask content never enters the final answer.

On a trackpad, right-click is usually a two-finger tap. Devices without a right-click
can still answer normally with the left button; only the note field is unavailable.

## How it works

### Client: first in the official composer chain

The browser half registers into the `conversation.composer` chain at `priority: -10`
(the official entry is at 0), so it is asked first. Its selector recognizes a generic
`PendingQuestion` carrier structurally and returns `null` for anything else, which
falls through to the official composer.

The component is a port of the official generic question flow: card anatomy,
recommended-label parsing, countdown, free-form row, and submit logic are preserved.
Only the per-option note editor and the bottom side-ask thread are added. Styles are
derived from the official card CSS with a `bc_` prefix.

### Host: a read-only side-ask command

The side ask runs through this plugin's own `bc-ask` command. The client serializes the
question, the current card, and any notes; the host:

- takes `agent.session.deriveMessages()`, drops a trailing unpaired assistant tool-call
  or tool message (where a pending question leaves the history), and trims the oldest
  part only when the session is very long;
- reuses the session's provider / model / reasoningEffort, the request header's tool
  declarations, and `toolHistory()`, keeping the prefix as close to the main request as
  the command handler can see;
- appends one temporary user message and calls `ctx.llm.stream()`, reading text only;
- writes nothing to the session, creates no child agent, and calls no tools.

That is also why it does not use `/btw` or a forked child: the parent turn is blocked
on the pending question, so a child could wait forever for its turn. A direct LLM
stream has no such dependency.

Normal-length sessions therefore send the same prefix as the main request, allowing the
provider to reuse its prompt cache.

## Layout

```text
src/index.ts                 Host: bc-ask command, history trimming, prompt
src/client/index.ts          Client: styles, locales, slot registration, bridge
src/client/composer.tsx      Enhanced card: notes, side thread, submit assembly
src/client/carrier.ts        Structural PendingQuestion matching
src/client/draft-store.ts    Draft and note storage across renders
src/client/side.ts           Side-ask service interface
src/client/locales.ts        Chinese and English copy
src/client/styles.ts         Generated by scripts/gen-css.mjs
scripts/build.mjs            esbuild (client CJS envelope + host ESM)
scripts/gen-css.mjs          Generates prefixed CSS from the reference styles
scripts/upstream-composer.module.css  Vendored upstream MIT stylesheet
lib/                         Committed build output, installable as-is
cordis.patch.yml             Bundle patch inserting the host row
test/package.test.mjs        Package metadata, artifacts, manifest checks
```

## Development

```powershell
npm install
npm run build     # lib/index.js and lib/client.js
npm run check     # syntax check on the artifacts
npm test          # node:test
npm pack          # installable .tgz
```

`prepack` rebuilds, checks, and tests before packing. The client artifact is CJS inside
the `window.__ModuleLoader__` envelope; the host artifact is unbundled ESM.

## Compatibility

Implemented against the DSH `0.2.1-rc` family's composer slot and `PendingQuestion`
shape; peer dependencies are declared as `^0.2.0-rc.1`. If a DSH upgrade changes the
internal card structure:

- the enhanced card declines to claim it and the official card still works;
- the side ask depends on the host command and `ctx.llm.stream`; if those change it
  reports an error, but normal answering is unaffected.

## Known limitations

- Only generic choice cards are claimed; plan review and approval remain official.
- The side ask uses the current session's model; there is no separate model or
  reasoning-effort picker.
- The side ask is read-only: questions that need file reads or commands should be asked
  in the main conversation.
- Very long sessions are trimmed from the oldest end; the side ask sees the recent part.
- Devices without right-click cannot use notes, but left-click answering is unaffected.

## License and attribution

Released under [MIT](LICENSE). The question-card component structure and styles are
derived from [`dsh-question-note`](https://github.com/buaaflyaway/dsh-question-note)
(MIT, NedFlanders). The side-ask interaction was inspired by
[`dsh-btw`](https://github.com/MichengAI/dsh-btw) (Apache-2.0). See
[NOTICE.en.md](NOTICE.en.md) for the exact scope and license texts, and
[AI_USAGE.en.md](AI_USAGE.en.md) for AI involvement and verification boundaries.

DeepSeek Harness and its bundled packages remain copyright DeepSeek; this project's MIT
license does not change their terms.
