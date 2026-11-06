import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// Vendored copy of dsh-question-note's composer.module.css (MIT, NedFlanders).
// Kept in-tree so the build does not depend on an external checkout.
const ref = fileURLToPath(new URL('./upstream-composer.module.css', import.meta.url))
let css = fs.readFileSync(ref, 'utf8')

// Namespace every local class selector so the sheet cannot collide with the host.
const names = new Set()
css = css.replace(/\.([A-Za-z][\w-]*)/g, (_, name) => {
  names.add(name)
  return `.bc_${name}`
})

const extra = `

/* ===== dsh-better-choice additions ===== */

/* Right-click affordance on an option row. */
.noteAffordance {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  padding-left: 8px;
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
  font-weight: 400;
  line-height: 18px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 120ms ease;
}

.option:hover .bc_noteAffordance,
.optionNoteOpen .bc_noteAffordance {
  opacity: 1;
}

.optionNoteOpen {
  border-color: var(--dsw-alias-state-business-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.noteDot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--dsw-alias-state-business-primary);
}

.supplementRow {
  position: relative;
}

.supplementRow .bc_fieldInput {
  min-height: 24px;
}

/* ===== side question (btw-like) ===== */

/* The card is capped at min(60vh, 520px) and .body ships with
   min-height: 0, so a long side answer used to win the height fight: the
   option list collapsed to ~39px while the thread kept its 230px. While a
   side thread exists, floor the choices and let the side panel yield height
   first (its thread scrolls inside). min() keeps short viewports usable. */
.bodyBeside {
  /* The floor is bounded by the card's own cap: 200px when the card is tall
     enough, less on short viewports, so header/footer can never be pushed
     out of the card. ~260px is the fixed chrome (header, footer, threaded
     side panel minimum, gaps). */
  min-height: min(200px, calc(min(66vh, 560px) - 260px));
}

/* A taller cap only for the live card: with the choice area floored at 200px
   the side thread would otherwise be squeezed to ~69px and become unreadable
   itself. The :not(.cardMinimized) guard keeps the collapsed card untouched. */
.card:not(.cardMinimized) {
  max-height: min(66vh, 560px);
}

.sideAsk {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  margin: 10px 12px 0;
  padding: 10px 0 0;
  border-top: 1px solid var(--dsw-alias-border-l2);
}

/* Only once a side answer exists does the panel compete for height: it then
   shrinks before the choices and scrolls its thread. Without this class the
   empty input row keeps its old size. */
.sideAskThreaded {
  flex: 0 1 auto;
  min-height: 118px;
  overflow: hidden;
}

.sideHeader,
.sideInputRow,
.sideError {
  flex-shrink: 0;
}

.sideHeader {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.sideTitle {
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.sideHint {
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
  line-height: 16px;
  text-align: right;
}

.thread {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 auto;
  min-height: 0;
  max-height: 230px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
}

.turn {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.questionBubble {
  align-self: flex-end;
  max-width: 88%;
  padding: 6px 10px;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
  word-break: break-word;
}

.answerBubble {
  align-self: stretch;
  padding: 2px 2px 2px 10px;
  border-left: 2px solid var(--dsw-alias-state-business-primary);
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  word-break: break-word;
}

.answerLabel {
  margin-bottom: 2px;
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
  line-height: 16px;
}

.pendingAnswer {
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 20px;
}

.sideInputRow {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.sideTextarea {
  flex: 1;
  min-width: 0;
  min-height: 36px;
  max-height: 120px;
  resize: none;
  box-sizing: border-box;
  padding: 7px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md);
  outline: none;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-primary);
  caret-color: var(--dsw-alias-state-business-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
}

.sideTextarea::placeholder {
  color: var(--dsw-alias-label-caption);
}

.sideTextarea:focus {
  border-color: var(--dsw-alias-state-business-primary);
}

.sideTextarea:disabled {
  color: var(--dsw-alias-label-dimmed);
}

.sideError {
  color: var(--dsw-alias-state-error-primary);
  font-size: 11px;
  line-height: 16px;
}

.sideActions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
`

const extraClean = extra.replace(/\.bc_/g, '.')
const extraPrefixed = extraClean.replace(/\.([A-Za-z][\w-]*)/g, (_, name) => {
  names.add(name)
  return `.bc_${name}`
})

css += extraPrefixed

const map = {}
for (const name of names) map[name] = `bc_${name}`

const out = `/** Generated by scripts/gen-css.mjs — do not edit by hand. */
export const STYLES = ${JSON.stringify(css)};

export const cx = ${JSON.stringify(map, null, 2)} as const;
`
fs.writeFileSync('src/client/styles.ts', out)
console.log(`wrote styles.ts: ${names.size} classes, ${css.length} bytes`)
