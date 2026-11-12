import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * Bundle the pure answer module for node: it is authored in TypeScript for the
 * browser half but has no runtime dependency, so esbuild is the cheapest way to
 * test the wire shape the host will receive.
 */
async function loadAnswer() {
  const result = await build({
    entryPoints: [join(root, 'src/client/answer.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    logLevel: 'silent',
  })
  const code = result.outputFiles[0].text
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

const { hasAnswer, mergeAnswer, mergeAnswers, noteSelectionFor, recommendedOptions } = await loadAnswer()

const single = { id: 'q1', question: 'Pick one', options: [{ label: 'A' }, { label: 'B' }] }
const multi = { id: 'q2', question: 'Pick many', multiSelect: true, options: [{ label: 'A' }, { label: 'B' }] }

function draft(overrides = {}) {
  return { selected: [], notes: {}, custom: '', skipped: false, ...overrides }
}

test('hasAnswer accepts a selection, custom text, or a note alone', () => {
  assert.equal(hasAnswer(draft()), false)
  assert.equal(hasAnswer(draft({ selected: ['A'] })), true)
  assert.equal(hasAnswer(draft({ custom: 'own answer' })), true)
  assert.equal(hasAnswer(draft({ notes: { A: 'note only' } })), true)
  assert.equal(hasAnswer(draft({ notes: { A: '   ' } })), false)
})

test('a selected note travels as bare text without repeating its label', () => {
  const answer = mergeAnswer(draft({ selected: ['B'], notes: { B: '先灰度 5%' } }), single)
  assert.deepEqual(answer, { id: 'q1', selected: ['B'], custom: '先灰度 5%' })
})

test('the settled reply bubble shows a selected option once', () => {
  // The host renders the settled answer as
  // [...selected, ...(custom ? [custom] : [])].join(', ') in
  // ui-user-questions.client.js; a labeled selected note rendered "B, B: note".
  const answer = mergeAnswer(draft({ selected: ['B'], notes: { B: '先灰度 5%' } }), single)
  const bubble = [...answer.selected, ...(answer.custom ? [answer.custom] : [])].join(', ')
  assert.equal(bubble, 'B, 先灰度 5%')
})

test('a single-select custom answer drops the selection and marks the leftover note', () => {
  const answer = mergeAnswer(draft({ selected: ['B'], notes: { B: 'note' }, custom: '自己来' }), single)
  assert.deepEqual(answer, { id: 'q1', selected: [], custom: '(未选) B: note\n自己来' })
})

test('a multi-select note keeps the selection and labels deselected notes', () => {
  const answer = mergeAnswer(
    draft({ selected: ['B', 'A'], notes: { A: 'first', B: '', C: 'third' }, custom: 'and this' }),
    multi,
  )
  assert.deepEqual(answer, {
    id: 'q2',
    selected: ['B', 'A'],
    custom: 'first\n(未选) C: third\nand this',
  })
})

test('notes follow the selection order, then the remaining options', () => {
  const answer = mergeAnswer(draft({ selected: ['B', 'A'], notes: { A: 'x', B: 'y' } }), multi)
  assert.equal(answer.custom, 'y\nx')
})

test('a skipped draft answers with nothing selected and no custom text', () => {
  const answer = mergeAnswer(draft({ selected: ['A'], notes: { A: 'x' }, skipped: true }), single)
  assert.deepEqual(answer, { id: 'q1', selected: [] })
})

test('a missing draft answers as an empty selection instead of crashing', () => {
  assert.deepEqual(mergeAnswer(undefined, single), { id: 'q1', selected: [] })
})

test('mergeAnswers keeps the request order and ids', () => {
  const batch = mergeAnswers([draft({ selected: ['A'] }), draft({ custom: 'x' })], [single, multi])
  assert.deepEqual(batch.answers, [
    { id: 'q1', selected: ['A'] },
    { id: 'q2', selected: [], custom: 'x' },
  ])
})

test('option labels that collide with Object.prototype keys stay plain notes', () => {
  const proto = {
    id: 'q-proto',
    question: 'Pick a key',
    options: [{ label: 'constructor' }, { label: 'toString' }],
  }
  assert.equal(hasAnswer(draft({ selected: ['constructor'] })), true)
  // Reading the prototype key on a plain object used to return the prototype
  // function, and the trim() in mergeAnswer threw.
  assert.deepEqual(mergeAnswer(draft({ selected: ['constructor'] }), proto), {
    id: 'q-proto',
    selected: ['constructor'],
  })
  assert.equal(
    mergeAnswer(draft({ selected: ['constructor'], notes: JSON.parse('{"constructor": "own"}') }), proto).custom,
    'own',
  )
  assert.equal(
    mergeAnswer(draft({ notes: JSON.parse('{"__proto__": "proto note"}') }), proto).custom,
    '(未选) __proto__: proto note',
  )
})

test('a right-click keeps the single-select custom answer instead of re-selecting', () => {
  // The bottom custom answer replaces a single-select selection (official
  // semantics), and mergeAnswer drops the selection on the wire. Right-click
  // must not show a checkmark the submission will not send.
  const current = draft({ selected: [], custom: '自己来' })
  assert.deepEqual(noteSelectionFor(current, 'B', single), [])
  const answer = mergeAnswer(
    draft({ selected: noteSelectionFor(current, 'B', single), notes: { B: '补充' }, custom: current.custom }),
    single,
  )
  assert.deepEqual(answer, { id: 'q1', selected: [], custom: '(未选) B: 补充\n自己来' })
})

test('a right-click selects the option when the single-select custom answer is empty', () => {
  assert.deepEqual(noteSelectionFor(draft(), 'B', single), ['B'])
  assert.deepEqual(noteSelectionFor(draft({ selected: ['A'], custom: '   ' }), 'B', single), ['B'])
})

test('a right-click coexists with a multi-select custom answer', () => {
  const current = draft({ selected: ['A'], custom: 'and this' })
  assert.deepEqual(noteSelectionFor(current, 'B', multi), ['A', 'B'])
  // Already selected: the selection order is untouched.
  assert.deepEqual(noteSelectionFor(draft({ selected: ['B', 'A'] }), 'B', multi), ['B', 'A'])
})

test('recommended markers preselect every marked option only for multi-select', () => {
  const marked = {
    id: 'q-rec',
    question: 'Pick',
    multiSelect: true,
    options: [{ label: 'A (recommended)' }, { label: 'B（推荐）' }, { label: 'C' }],
  }
  assert.deepEqual(recommendedOptions(marked), ['A (recommended)', 'B（推荐）'])
  assert.deepEqual(recommendedOptions({ ...marked, multiSelect: false }), ['A (recommended)'])
  assert.deepEqual(recommendedOptions({ id: 'q', question: 'Pick', options: [{ label: 'A' }] }), [])
  assert.deepEqual(recommendedOptions({ id: 'q', question: 'Pick' }), [])
})
