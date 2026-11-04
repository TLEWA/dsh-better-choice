# NOTICE / Third-party attributions

[简体中文](NOTICE.md) · [English](NOTICE.en.md)

`dsh-better-choice` (MIT) adapts the question-card component and styles from the
existing DSH plugin [`dsh-question-note`](https://github.com/buaaflyaway/dsh-question-note).
The copyright and license conditions below apply to the adapted portions; all other
code is copyright the `dsh-better-choice` contributors.

## dsh-question-note

- Author: NedFlanders
- Version: 0.3.0
- License: MIT
- Repository: https://github.com/buaaflyaway/dsh-question-note
- Reused scope:
  - question-card structure, option rendering, recommended-label parsing,
    countdown/wait states, free-form row, and submit flow
    (`src/client/composer.tsx` extends it with right-click notes and the side thread);
  - carrier recognition and draft-store approach (`src/client/carrier.ts`,
    `src/client/draft-store.ts`);
  - question-card styles (`scripts/gen-css.mjs` reads its `composer.module.css`,
    adds the `bc_` prefix, and generates `src/client/styles.ts`).

`dsh-question-note` is itself a port of DSH's official `QuestionComposer`. DeepSeek
Harness and its bundled packages remain copyright DeepSeek; this project integrates
through public interfaces and runtime behavior only and claims no copyright in them.

## dsh-btw

- Author: MichengAI
- License: Apache-2.0
- Repository: https://github.com/MichengAI/dsh-btw
- Relationship: the side-ask product interaction (a separate in-card question,
  read-only answers, no interruption of the main task) was inspired by it. This
  project's side ask is implemented with the host's public
  `ctx.subagents.startActivation` and the fork provider; it does not copy Btw's source
  code.

## AI assistance

The code and documentation were produced with AI assistance. See
[AI_USAGE.en.md](AI_USAGE.en.md) for scope, verification, and disclaimers.

---

### MIT License (dsh-question-note)

Copyright (c) 2026 NedFlanders

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
