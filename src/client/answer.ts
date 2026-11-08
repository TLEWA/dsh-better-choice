/**
 * Pure answer-shaping logic for the enhanced question composer: what counts as
 * an answer, and how per-option notes join the submitted batch. Kept free of
 * React so node tests can pin the wire shape directly.
 */

import type { QuestionNoteAnswer, QuestionNoteAnswerItem, QuestionNoteItem } from './carrier.ts'
import type { QuestionNoteDraftAnswer } from './draft-store.ts'

/**
 * Whether a draft carries an answer the model can use: a selection, a bottom
 * free-text answer, or a note typed under any option. A note counts on its
 * own: deselecting an option must not turn the question back into "unanswered"
 * and strand the typed note.
 * @param draft - one question's draft.
 * @returns true when the draft can be submitted.
 */
export function hasAnswer(draft: QuestionNoteDraftAnswer): boolean {
  return draft.selected.length > 0
    || draft.custom.trim() !== ''
    || Object.values(draft.notes).some(note => note.trim() !== '')
}

/**
 * Shape one draft into its wire answer. A note always carries its option label
 * so the model can attribute it — including a single-select note, where the
 * label is the only thing tying the text to its option once a bottom free-text
 * answer replaces the selection. A note under an option that is not part of the
 * submitted selection is marked `(未选)`, and a single-select custom answer
 * drops the selection exactly like the official composer does.
 * @param value - the question's draft, if navigation restored one.
 * @param item - the question the draft answers.
 * @returns the answer item for this question.
 */
export function mergeAnswer(
  value: QuestionNoteDraftAnswer | undefined,
  item: QuestionNoteItem,
): QuestionNoteAnswerItem {
  if (value === undefined || value.skipped) return { id: item.id, selected: [] }
  const custom = value.custom.trim()
  // Official semantics: a single-select custom answer replaces the selection.
  const keepSelection = item.multiSelect === true || custom === ''
  const parts: string[] = []
  const push = (label: string, note: string, selected: boolean): void => {
    if (note === '') return
    const prefix = label === '' ? '' : `${label}: `
    parts.push(`${selected ? '' : '(未选) '}${prefix}${note}`)
  }
  for (const label of value.selected) push(label, (value.notes[label] ?? '').trim(), keepSelection)
  for (const [label, rawNote] of Object.entries(value.notes)) {
    if (value.selected.includes(label)) continue
    push(label, rawNote.trim(), false)
  }
  if (custom !== '') parts.push(custom)
  const text = parts.join('\n')
  return {
    id: item.id,
    selected: keepSelection ? value.selected : [],
    ...(text === '' ? {} : { custom: text }),
  }
}

/**
 * Shape the whole batch. Drafts mirror the question list 1:1; a missing draft
 * answers as "nothing selected" rather than crashing the submission.
 * @param values - one draft per question, in request order.
 * @param questions - the request's question list.
 * @returns the answer batch to hand to the carrier.
 */
export function mergeAnswers(
  values: readonly QuestionNoteDraftAnswer[],
  questions: readonly QuestionNoteItem[],
): QuestionNoteAnswer {
  return { answers: questions.map((item, index) => mergeAnswer(values[index], item)) }
}
