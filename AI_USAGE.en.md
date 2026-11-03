# AI Usage and Code Provenance

[简体中文](AI_USAGE.md) · [English](AI_USAGE.en.md)

This document describes how artificial intelligence (AI) was used in
`dsh-better-choice`, how the result was reviewed, where third-party code came from,
and the limits of the project's guarantees. It does not change any term of
[LICENSE](LICENSE) (MIT).

## 1. Summary

- The **source code and documentation were produced mainly with AI assistance**, with
  the project owner setting requirements, reviewing, and validating behavior.
- AI is not a copyright holder. The project is released under MIT; your rights and
  obligations are governed by MIT.
- The project comes with **no warranty**. AI-generated code may contain errors,
  omissions, or assumptions that do not fit your environment.
- Third-party copyrights and licenses are listed separately in [NOTICE.en.md](NOTICE.en.md)
  and are not changed by this project's MIT license.

## 2. Tools and models

- Environment: the DeepSeek Harness (DSH) coding agent.
- Model: `deepseek-flash` (DeepSeek).
- Workflow: the owner described requirements in natural language, reported defects,
  and confirmed behavior; the agent read DSH package interfaces, the official question
  composer, and reference plugin sources, then wrote or refactored code, docs, and
  tests, and verified them locally.

## 3. Scope of AI involvement

| Part | AI involvement | Notes |
| --- | --- | --- |
| `src/client/*` | High | Card enhancement, side thread, carrier matching, generated styles |
| `src/index.ts` | High | `bc-ask` command, history trimming, side prompt |
| `scripts/*` | High | esbuild pipeline and CSS prefix generation |
| `test/*.test.mjs` | High | Package manifest, artifacts, and host command tests |
| `README*.md` / `NOTICE*.md` / this file | High | Drafted by AI and updated with the code |
| Requirements, defect judgment, final tradeoffs | Human | Decided by the project owner |

No human rewrote every line. Review focused on **behavior**: reading key paths, running
tests, and exercising the card in a real DSH client.

## 4. What was and was not verified

Verified:

- `npm run build` and `npm run check` pass;
- all 6 `node:test` cases pass: package metadata and `files`, `dsh` manifest, client
  ModuleLoader envelope, host plugin exports, `bc-ask` streaming without mutating
  session history, and rejection of malformed/empty requests;
- in the DSH desktop Web GUI on Windows (`127.0.0.1:9260`), a real pending question was
  opened and a genuine right-click was dispatched through CDP
  `Input.dispatchMouseEvent` (`mousePressed` / `mouseReleased`):
  - option A became selected and its note field appeared below it;
  - after typing a note and submitting, the model replied with
    "选项A / 补充备注：测试备注-仅验证", proving the note was merged into `custom`
    and delivered;
- the side-ask box was present in the same card and its host `bc-ask` request returned
  streamed text.

Not fully verified:

- every DSH version, theme, zoom level, and multi-monitor setup;
- macOS and Linux clients;
- every branch of multi-select `(unselected)` marking, multi-question batches, and
  post-timeout continuation;
- the 120K-character trimming boundary in very long sessions;
- coexistence with another third-party plugin that claims the same composer slot.

## 5. Code provenance

- The question-card structure and styles are adapted from
  [`dsh-question-note`](https://github.com/buaaflyaway/dsh-question-note)
  (MIT, NedFlanders). The exact scope and full license text are in
  [NOTICE.en.md](NOTICE.en.md).
- The side-ask interaction was inspired by
  [`dsh-btw`](https://github.com/MichengAI/dsh-btw) (Apache-2.0). This project calls the
  host's `ctx.llm.stream` directly and does not copy its source code.
- DSH bundled packages were used only through public interfaces, types, and runtime
  behavior; **their source was not copied**.
- Git history records each change.

## 6. Data and privacy

- The plugin runs locally with **no telemetry, analytics, or third-party remote calls**.
- A side ask sends "existing session context + your question + the current card" to the
  **model provider configured for the current session**. It uses the same model channel
  as normal conversation and goes nowhere else.
- The plugin does not write session logs; side questions and answers live in page memory
  and disappear when the card is closed or the page is refreshed.
- Notes travel only with the normal `ask_user_question` answer; they are not uploaded
  separately.

## 7. Recommendations

1. Before production use, read `lib/client.js` and `lib/index.js` and confirm the
   behavior matches your expectations.
2. Run `npm test` and `npm run check`.
3. Keep `NOTICE.en.md` and `LICENSE` to satisfy the upstream MIT attribution.
4. If AI-generated code causes a problem, open an issue or PR; human fixes are welcome.

## 8. Disclaimer

The project is provided "as is", without any express or implied warranty, including
merchantability, fitness for a particular purpose, and non-infringement. The authors and
contributors are not liable for any direct or indirect loss caused by use of the
project. The complete terms are in [LICENSE](LICENSE).
