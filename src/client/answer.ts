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
 * Split the conventional recommendation suffix without changing the answer
 * value. The label keeps its marker so the submitted selection stays exactly
 * the option text the official composer uses.
 * @param label - original option label.
 * @returns display label plus recommendation state.
 */
export function parseRecommendedLabel(label: string): { label: string; recommended: boolean } {
  const suffix = /\s*(?:\((?:recommended|推荐)\)|（(?:recommended|推荐)）)\s*$/i
  return suffix.test(label)
    ? { label: label.replace(suffix, ''), recommended: true }
    : { label, recommended: false }
}

/**
 * Labels the official composer preselects: every marked option in a
 * multi-select question, but only a marked first option in single-select.
 * @param question - the question to inspect.
 * @returns labels to preselect, in option order.
 */
export function recommendedOptions(question: QuestionNoteItem): string[] {
  const labels = (question.options ?? []).map(option => option.label)
  return (question.multiSelect === true ? labels : labels.slice(0, 1))
    .filter(label => parseRecommendedLabel(label).recommended)
}

/**
 * Read one option's note without consulting `Object.prototype`. Option labels
 * are arbitrary user text, so a label such as `constructor` or `__proto__` must
 * not resolve to an inherited value.
 * @param notes - the question's per-label notes.
 * @param label - the option label to read.
 * @returns the note, or an empty string when the label has no own note.
 */
export function noteOf(notes: Record<string, string>, label: string): string {
  return Object.hasOwn(notes, label) ? notes[label] ?? '' : ''
}

/**
 * Whether a draft's bottom free-text answer replaces the option selection.
 * This is the official single-select rule: custom text is the answer, so the
 * selection is not submitted. Multi-select keeps both.
 * @param item - the question being answered.
 * @param custom - the raw bottom free-text answer.
 * @returns true when the selection must be dropped.
 */
function customReplacesSelection(item: QuestionNoteItem, custom: string): boolean {
  return item.multiSelect !== true && custom.trim() !== ''
}

/**
 * Selection implied by right-clicking an option to write its note. Single
 * select follows the same priority as the submission: a typed bottom answer
 * wins, so the option is not re-selected and the note travels as `(未选)`;
 * with no bottom answer the option becomes the selection. Multi-select notes
 * coexist with both the selection and the bottom answer, so they only add the
 * option. Sharing this rule with `mergeAnswer` keeps the visible checkmark and
 * the submitted selection from diverging.
 * @param draft - the question's current draft.
 * @param label - the right-clicked option label.
 * @param item - the question the draft answers.
 * @returns the selection the right-click should produce.
 */
export function noteSelectionFor(
  draft: QuestionNoteDraftAnswer,
  label: string,
  item: QuestionNoteItem,
): string[] {
  if (customReplacesSelection(item, draft.custom)) return []
  if (item.multiSelect !== true) return [label]
  return draft.selected.includes(label) ? draft.selected : [...draft.selected, label]
}

/**
 * Position of an option in the question, 1-based. The position is a stable way
 * to name an option inside `custom` without repeating its label.
 * @param item - the question that owns the option.
 * @param label - the option label to locate.
 * @returns the 1-based position, or 0 when the label is not in the option list.
 */
function optionPosition(item: QuestionNoteItem, label: string): number {
  const index = (item.options ?? []).findIndex(option => option.label === label)
  return index < 0 ? 0 : index + 1
}

/**
 * Shape one draft into its wire answer. A note under a single submitted
 * selection is sent as bare text: `selected` already names the option, and
 * repeating the label inside `custom` makes the host's reply bubble render the
 * option twice ("B, B: note"). When a multi-select submission carries more than
 * one selected option, a bare note could belong to any of them, so it is marked
 * with its question position ("选项 2: note"): that keeps attribution without
 * repeating the option label. A note whose option is not part of the submitted
 * selection is marked `(未选) label:`, which keeps attribution when a
 * single-select custom answer drops the selection. A single-select custom answer
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
  const keepSelection = !customReplacesSelection(item, value.custom)
  const parts: string[] = []
  const push = (label: string, note: string, selected: boolean): void => {
    if (note === '') return
    let prefix = ''
    if (!selected) {
      // A note outside the selection cannot rely on `selected` for attribution.
      prefix = label === '' ? '' : `${label}: `
    } else if (item.multiSelect === true && value.selected.length > 1) {
      // Several selected options: name the question position instead of
      // repeating a label the host bubble already renders from `selected`.
      const position = optionPosition(item, label)
      prefix = position > 0 ? `选项 ${position}: ` : label === '' ? '' : `${label}: `
    }
    parts.push(`${selected ? '' : '(未选) '}${prefix}${note}`)
  }
  for (const label of value.selected) push(label, noteOf(value.notes, label).trim(), keepSelection)
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
