import {
  Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type ChangeEvent, type FocusEvent, type KeyboardEvent,
} from 'react'
import {
  Button, IconCheckOutlineRegular, IconChevronDownOutlineRegular, IconChevronLeftOutlineRegular,
  IconChevronRightOutlineRegular, IconChevronUpOutlineRegular, IconCloseOutlineRegular,
  IconEditOutlineRegular, MarkdownText,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  QuestionNoteAnswer, QuestionNoteCarrier, QuestionNoteItem,
} from './carrier.ts'
import type {
  QuestionNoteDraftAnswer, QuestionNoteDraftBakedActions, QuestionNoteDraftState,
} from './draft-store.ts'
import type { QuestionNoteKey } from './locales.ts'
import { askSide, type SideAskTurn } from './side.ts'
import { cx } from './styles.ts'

/**
 * Enhanced question composer. It is a fork of the official generic question
 * flow with two additions:
 *
 * 1. Right-clicking an option selects it and opens a note input directly under
 *    that option. Left-click keeps its original meaning (select only).
 * 2. A side-question box lets the user invoke the host's `bc-ask` command while
 *    the question is pending, so they can ask the model before answering.
 */

/** Displayed feedback: dictionary keys translate at render; wire messages pass verbatim. */
type Feedback = { key: 'error.incomplete' | 'error.unanswered' | 'error.unavailable' | 'error.resubmit' | 'status.sent' } | { text: string }

/** One turn of the local side-question thread. */
interface SideTurn {
  id: string
  question: string
  pending: boolean
  answer?: string
  error?: string
}

/** Stable empty thread so switching to a question with no thread does not re-render-loop. */
const EMPTY_TURNS: SideTurn[] = []

/** Bounded per-question side thread: long card sessions must not grow without limit. */
const MAX_SIDE_TURNS = 20

/** Defensive stand-ins for a carrier that exposes an empty batch. */
const EMPTY_QUESTION: QuestionNoteItem = { id: '', question: '', options: [] }
const EMPTY_DRAFT: QuestionNoteDraftAnswer = { selected: [], notes: {}, custom: '', skipped: false }

/** A removed card can remain mounted until the composer seat updates. */
const REMOVED_CARD = {
  state: 'open', waitState: 'counting', countdown: undefined, channel: 'none', closed: true,
} as const

/** Join truthy class names without pulling in a runtime dependency. */
function cls(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

/**
 * Split the conventional recommendation suffix without changing the answer value.
 * @param label - Original option label returned if selected.
 * @returns Display label plus recommendation state.
 */
function parseRecommendedLabel(label: string): { label: string; recommended: boolean } {
  const suffix = /\s*(?:\((?:recommended|推荐)\)|（(?:recommended|推荐)）)\s*$/i
  return suffix.test(label)
    ? { label: label.replace(suffix, ''), recommended: true }
    : { label, recommended: false }
}

/** Only a marked first choice is an implicit draft; the user still submits it. */
function recommendedFirstOption(question: QuestionNoteItem): string | undefined {
  const label = question.options?.[0]?.label
  return label !== undefined && parseRecommendedLabel(label).recommended ? label : undefined
}

/** Accept persisted progress only when it still describes this question batch. */
function isQuestionDraftProgress(value: unknown, questionCount: number): value is QuestionNoteDraftProgressShape {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const progress = value as Record<string, unknown>
  if (typeof progress.index !== 'number' || !Number.isInteger(progress.index)
    || progress.index < 0 || progress.index >= questionCount
    || !Array.isArray(progress.drafts) || progress.drafts.length !== questionCount
    || (progress.wait !== undefined && progress.wait !== 'editing' && progress.wait !== 'waiting')) return false
  return progress.drafts.every((item: unknown) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return false
    const draft = item as Record<string, unknown>
    return Array.isArray(draft.selected) && draft.selected.every((label: unknown) => typeof label === 'string')
      && typeof draft.custom === 'string' && typeof draft.skipped === 'boolean'
      // The per-option note map: absent on drafts persisted before it existed.
      && (draft.notes === undefined || (typeof draft.notes === 'object' && draft.notes !== null && !Array.isArray(draft.notes)
        && Object.values(draft.notes as Record<string, unknown>).every(note => typeof note === 'string')))
  })
}

/** Persisted progress shape read from the store. */
interface QuestionNoteDraftProgressShape {
  index: number
  drafts: QuestionNoteDraftAnswer[]
  wait?: 'editing' | 'waiting'
}

/** Return whether a text-field key event belongs to an active IME composition. */
function isComposing(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  // keyCode 229 is the legacy IME-composition signal engines emit without isComposing.
  return event.nativeEvent.isComposing || Reflect.get(event.nativeEvent, 'keyCode') === 229
}

/**
 * Resolve the conversation session this card is mounted in. The chain slot
 * passes `sessionId` directly; `session` and the conversation DOM attribute are
 * fallbacks for older shells.
 * @param props - the composer props that may carry the session identity.
 * @param frame - the card root, used to find the closest conversation session.
 * @returns the session id, or an empty string when it cannot be resolved.
 */
function sessionIdOf(
  props: { sessionId?: string; session?: unknown },
  frame: HTMLElement | null,
  carrierSessionId?: string,
): string {
  // The carrier's own sessionId is the authoritative identity of this request.
  if (typeof carrierSessionId === 'string' && carrierSessionId !== '') return carrierSessionId
  if (typeof props.sessionId === 'string' && props.sessionId !== '') return props.sessionId
  const session = props.session as { sessionId?: unknown; id?: unknown } | undefined
  const fromSession = session?.sessionId ?? session?.id
  if (typeof fromSession === 'string' && fromSession !== '') return fromSession
  const host = frame?.closest('[data-conversation-session]')
  return host?.getAttribute('data-conversation-session') ?? ''
}

/** The free-text field: the optionless question's framed block or a row's inline column. */
interface AnswerFieldProps {
  /** Visual variant: a row's inline column or the optionless question's framed block. */
  variant: 'inline' | 'block'
  /** Current draft text. */
  value: string
  /** Empty-field prompt. */
  placeholder: string
  /** Accessible name for the field; defaults to the placeholder. */
  ariaLabel?: string
  /** Whether a submission in flight has frozen the field. */
  disabled: boolean
  /** Whether this field takes focus on mount. */
  autoFocus?: boolean
  /** Called when the field takes focus. */
  onFocus?: () => void
  /** Called with each edit of the draft. */
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  /** Called with each key press, before the browser's own handling. */
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

/**
 * Auto-growing free-text field: a textarea over a hidden mirror that owns the
 * height (same mechanism as the official composer; mirror and textarea MUST
 * share font, line-height, padding and wrapping rules).
 *
 * @param props - visual variant, draft text, and the field's event handlers.
 * @returns The mirrored auto-growing field.
 */
function AnswerField(props: AnswerFieldProps) {
  return (
    <div className={cls(cx.field, props.variant === 'inline' ? cx.customInline : cx.customBlock)}>
      <div aria-hidden className={cx.fieldMirror}>{`${props.value}\n`}</div>
      <textarea
        autoFocus={props.autoFocus}
        className={cx.fieldInput}
        value={props.value}
        disabled={props.disabled}
        rows={1}
        placeholder={props.placeholder}
        aria-label={props.ariaLabel ?? props.placeholder}
        onFocus={props.onFocus}
        onChange={props.onChange}
        onKeyDown={props.onKeyDown}
      />
    </div>
  )
}

/** Locale lookup the renderer passes to the component. */
type QuestionNoteT = (key: QuestionNoteKey, vars?: Record<string, string | number>) => string

/** Component props assembled by the Slot renderer for this registration. */
export interface QuestionNoteComposerProps {
  /** The chain-selected pending-question carrier. */
  matched: QuestionNoteCarrier
  /** Localized copy lookup bound to this plugin's dictionary namespace. */
  t: QuestionNoteT
  /** Selector hook over this registration's declared draft store. */
  useStore: <T,>(selector: (state: QuestionNoteDraftState) => T) => T
  /** The declared store's complete mutation API (draft argument already baked). */
  actions: QuestionNoteDraftBakedActions
  /** Conversation session id, passed by the composer chain slot. */
  sessionId?: string
  /** Conversation session snapshot, passed by the composer chain slot. */
  session?: unknown
}

/**
 * The enhanced question flow. Renders the carrier's current question and its
 * draft, reveals a note under a right-clicked option, and offers a side-ask
 * thread that never submits the answer itself.
 * @param props - the chain-matched carrier plus the framework standard kit.
 * @returns The enhanced question card.
 */
export function QuestionNoteComposer(props: QuestionNoteComposerProps) {
  return (
    <QuestionNoteFlow
      key={props.matched.key}
      pending={props.matched}
      t={props.t}
      useStore={props.useStore}
      actions={props.actions}
      sessionId={props.sessionId}
      session={props.session}
    />
  )
}

type QuestionNoteFlowProps = Omit<QuestionNoteComposerProps, 'matched'> & { pending: QuestionNoteCarrier }

function QuestionNoteFlow({ pending, t, useStore, actions, sessionId, session }: QuestionNoteFlowProps) {
  const questions = pending.questions
  // A read-only card built from a settled call's transcript: the same panel
  // over the recorded answers, with nothing left to submit.
  const review = pending.review
  const markdownLabels = useMemo(() => ({
    code: { copyLabel: t('copy'), copiedLabel: t('copied'), toolbarLabels: { codeLabel: t('codeBlock.title'), wrapLabel: t('codeBlock.wrap'), unwrapLabel: t('codeBlock.unwrap') } },
    footnotes: t('markdown.footnotes'),
  }), [t])
  const initialDrafts = useMemo<QuestionNoteDraftAnswer[]>(() => {
    // Recorded answers echo the question ids rather than their order.
    const recorded = new Map((review ?? []).map(answer => [answer.id, answer]))
    return questions.map((item) => {
      const answer = recorded.get(item.id)
      const custom = answer?.custom ?? ''
      const recommended = review === undefined ? recommendedFirstOption(item) : undefined
      return {
        selected: answer === undefined && recommended !== undefined ? [recommended] : [...answer?.selected ?? []],
        notes: {},
        custom,
        // A recorded answer with no selection and no custom text was skipped.
        skipped: answer !== undefined && answer.selected.length === 0 && custom === '',
      }
    })
  }, [questions, review])
  const stored = useStore(state => state.progressByRequest[pending.key])
  const validStored = isQuestionDraftProgress(stored, questions.length) ? stored : undefined
  // A review card renders the record itself, so a draft its live card left
  // behind can never surface as an answer; only the page position is restored.
  const storedProgress = review === undefined ? validStored : undefined
  const index = validStored?.index ?? 0
  const drafts = (storedProgress?.drafts ?? initialDrafts)
    .map(item => ({ ...item, notes: item.notes ?? {} }))
  const restoredWait = storedProgress?.wait
    ?? (storedProgress?.drafts.some((item, itemIndex) =>
      item.selected.length !== initialDrafts[itemIndex]?.selected.length
      || item.selected.some((label, labelIndex) => label !== initialDrafts[itemIndex]?.selected[labelIndex])
      || Object.values(item.notes ?? {}).some(note => note !== '') || item.custom !== '' || item.skipped) === true
      ? 'editing' : undefined)
  const [busy, setBusy] = useState<'answer' | 'cancel' | null>(null)
  const [error, setError] = useState<Feedback | null>(null)
  // The carrier owns the card lifecycle; subscribe directly (same data the
  // official keyed hook exposes, read through the carrier we already hold).
  const card = useSyncExternalStore(pending.subscribe, pending.snapshot) ?? REMOVED_CARD
  const canSubmit = card.channel !== 'none'
  // The answer surface freezes while a submission is in flight, and for good on
  // a review card: its call has already settled.
  const locked = busy !== null || review !== undefined
  // A waterfall submission is only "sent": the gateway drops an outcome that
  // arrives after another Client settled the event, without telling anyone.
  // The draft therefore survives until the projection closes the card, and a
  // card that flips to continued while a submission is in flight re-arms the
  // controls so the same draft can go through the Remote path.
  const sentVia = useRef<'waterfall' | null>(null)
  useEffect(() => {
    if (sentVia.current !== 'waterfall' || card.state !== 'continued') return
    sentVia.current = null
    setBusy(null)
    setError({ key: 'error.resubmit' })
  }, [card.state])
  useEffect(() => {
    if (card.closed) actions.clear(pending.key)
  }, [actions, card.closed, pending.key])
  useEffect(() => {
    actions.prune(pending.liveKeys())
  }, [pending])
  const waitDisposition = useRef<'editing' | 'waiting' | undefined>(restoredWait)
  useEffect(() => {
    if (waitDisposition.current === 'waiting') pending.takeTime()
    if (waitDisposition.current === 'editing') pending.engage()
  }, [pending])
  // The countdown belongs to the carrier, not to this component: the user can
  // close the panel and reopen it from the tool call row.
  const countdown = card.countdown
  // Collapsed to the header strip so the conversation above stays readable
  // while the user decides; answer drafts live in the Session store above.
  const [minimized, setMinimized] = useState(false)
  // The free-form textarea autofocuses on first presentation; re-expanding a
  // collapsed question must not steal focus from the expand toggle back into
  // the input, so focus is granted once per question index.
  const focusedQuestions = useRef(new Set<number>())
  const answerSurface = useRef<HTMLDivElement>(null)
  // Every navigation write stays in bounds and drafts mirrors questions 1:1.
  const question = questions[index] ?? EMPTY_QUESTION
  const draft = drafts[index] ?? EMPTY_DRAFT
  const hasOptions = (question.options?.length ?? 0) > 0
  const isLastQuestion = index === questions.length - 1

  // Right-click note state is per question: navigation starts with every note
  // folded, while the note text itself stays in the Session draft store.
  const [openNotes, setOpenNotes] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    setOpenNotes(new Set())
  }, [index, pending.key])

  // Side-question threads are keyed by pending request + question index: a
  // follow-up on one question never inherits another question's thread, and
  // navigating away and back restores the right history.
  const [sideThreads, setSideThreads] = useState<Record<string, SideTurn[]>>({})
  const [sideInput, setSideInput] = useState('')
  // Busy and error are per thread key: a request on one question must neither
  // disable another question's box nor surface its error there, and switching
  // questions keeps the request running in its originating thread.
  const [sideBusyKeys, setSideBusyKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [sideErrorByKey, setSideErrorByKey] = useState<Record<string, string>>({})
  const sideAborts = useRef(new Map<string, AbortController>())
  const threadRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const threadKey = `${String(pending.key)}:${String(index)}`
  const sideThread = sideThreads[threadKey] ?? EMPTY_TURNS
  const sideBusy = sideBusyKeys.has(threadKey)
  const sideError = sideErrorByKey[threadKey] ?? null
  useEffect(() => () => { for (const controller of sideAborts.current.values()) controller.abort() }, [])
  useEffect(() => {
    const element = threadRef.current
    if (element !== null) element.scrollTop = element.scrollHeight
  }, [sideThread])

  const markSideBusy = (key: string, busy: boolean): void => {
    setSideBusyKeys((current) => {
      if (current.has(key) === busy) return current
      const next = new Set(current)
      if (busy) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const setSideErrorFor = (key: string, message: string | null): void => {
    setSideErrorByKey((current) => {
      if (message === null) {
        if (current[key] === undefined) return current
        const next = { ...current }
        delete next[key]
        return next
      }
      return current[key] === message ? current : { ...current, [key]: message }
    })
  }

  const appendSideTurn = (key: string, turn: SideTurn): void => {
    setSideThreads((current) => ({
      ...current,
      // Keep the thread bounded: a long card session must not grow without limit.
      [key]: [...(current[key] ?? []), turn].slice(-MAX_SIDE_TURNS),
    }))
  }

  const updateSideTurn = (key: string, id: string, update: (turn: SideTurn) => SideTurn): void => {
    setSideThreads((current) => {
      const thread = current[key]
      if (thread === undefined || !thread.some(turn => turn.id === id)) return current
      return { ...current, [key]: thread.map(turn => turn.id === id ? update(turn) : turn) }
    })
  }

  /** Abort the in-flight side ask of one thread and settle its bubble. */
  const cancelSide = (key: string): void => {
    const controller = sideAborts.current.get(key)
    if (controller === undefined) return
    controller.abort()
    sideAborts.current.delete(key)
    markSideBusy(key, false)
    setSideThreads((current) => ({
      ...current,
      [key]: (current[key] ?? []).map(turn => turn.pending
        ? { ...turn, pending: false, error: t('side.cancelled') }
        : turn),
    }))
  }

  const replaceProgress = (nextIndex: number, nextDrafts: QuestionNoteDraftAnswer[]): void => {
    actions.replace(pending.key, {
      index: nextIndex,
      drafts: nextDrafts,
      ...(waitDisposition.current === undefined ? {} : { wait: waitDisposition.current }),
    })
  }

  const takeTime = (): void => {
    waitDisposition.current = 'waiting'
    pending.takeTime()
    replaceProgress(index, drafts)
  }

  const engage = (): void => {
    if (waitDisposition.current !== undefined) return
    waitDisposition.current = 'editing'
    pending.engage()
  }

  const focusAnswerSurface = (event: FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget)) pending.holdFocus()
  }

  const blurAnswerSurface = (event: FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget)) pending.releaseFocus()
  }

  // The side box sits outside the answer surface, so it mirrors that focus
  // handling: focusing it pauses the countdown (and blur resumes it), while
  // sending a side question engages the card for good.
  const focusSidePanel = (event: FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget)) pending.holdFocus()
  }

  const blurSidePanel = (event: FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget)) pending.releaseFocus()
  }

  useEffect(() => {
    const release = (): void => { pending.releaseFocus() }
    const refocus = (): void => {
      if (waitDisposition.current === 'editing') {
        pending.engage()
        return
      }
      if (answerSurface.current?.contains(document.activeElement) === true) pending.holdFocus()
    }
    const visibilityChanged = (): void => { if (document.hidden) release(); else refocus() }
    window.addEventListener('blur', release)
    window.addEventListener('focus', refocus)
    document.addEventListener('visibilitychange', visibilityChanged)
    return () => {
      release()
      window.removeEventListener('blur', release)
      window.removeEventListener('focus', refocus)
      document.removeEventListener('visibilitychange', visibilityChanged)
    }
  }, [pending])

  const dismissFlow = (): void => {
    // A tool-call-keyed panel only leaves the seat; nothing is sent and nothing
    // is persisted, and the tool call row brings it back.
    if (pending.dismissal === 'hide') {
      void pending.dismiss()
      return
    }
    if (!canSubmit) {
      setError({ key: 'error.unavailable' })
      return
    }
    setBusy('cancel')
    setError(null)
    sentVia.current = 'waterfall'
    void pending.dismiss()
      .catch((cause: unknown) => {
        sentVia.current = null
        setBusy(null)
        setError({ text: cause instanceof Error ? cause.message : String(cause) })
      })
  }

  const updateDraft = (
    update: (current: QuestionNoteDraftAnswer) => QuestionNoteDraftAnswer,
    nextIndex = index,
  ): void => {
    engage()
    const nextDrafts = drafts.map((item, itemIndex) => itemIndex === index ? update(item) : item)
    replaceProgress(nextIndex, nextDrafts)
    setError(null)
  }

  const choose = (label: string): void => {
    updateDraft((current) => {
      if (question.multiSelect === true) {
        const selected = current.selected.includes(label)
          ? current.selected.filter(item => item !== label)
          : [...current.selected, label]
        return { ...current, selected, skipped: false }
      }
      // Left-click keeps the official meaning: select only. The note input is
      // opened by right-click, never as a side effect of choosing. Keep the
      // existing notes: changing the selection must not erase them.
      return { ...current, selected: [label], custom: '', skipped: false }
    })
  }

  /**
   * Right-click action: ensure the option is selected, then open its note.
   * A note belongs to a selected option, so this keeps the submitted answer
   * and the note consistent without changing left-click semantics.
   * @param label - the right-clicked option label.
   */
  const openNote = (label: string): void => {
    if (locked) return
    updateDraft((current) => {
      const selected = question.multiSelect === true
        ? (current.selected.includes(label) ? current.selected : [...current.selected, label])
        : [label]
      return { ...current, selected, skipped: false }
    })
    setOpenNotes((current) => {
      const next = new Set(current)
      next.add(label)
      return next
    })
  }

  const answered = (item: QuestionNoteDraftAnswer): boolean =>
    item.selected.length > 0 || item.custom.trim() !== ''

  const completed = (item: QuestionNoteDraftAnswer): boolean => answered(item) || item.skipped

  const submitDrafts = (values: QuestionNoteDraftAnswer[]): void => {
    const missing = values.findIndex(item => !completed(item))
    if (missing >= 0) {
      replaceProgress(missing, values)
      setError({ key: 'error.incomplete' })
      return
    }
    if (!canSubmit) {
      setError({ key: 'error.unavailable' })
      return
    }
    // The selection travels with the per-option notes. `custom` carries them —
    // a single-select note plain, a multi-select note labelled `option: note`
    // per line so the model can attribute each note to its option — and a
    // bottom-row answer joins last. Notes typed under an option that was later
    // deselected are marked `(未选)` instead of being silently dropped.
    const answer: QuestionNoteAnswer = {
      answers: questions.map((item, itemIndex) => {
        const value = values[itemIndex] as QuestionNoteDraftAnswer
        if (value.skipped) return { id: item.id, selected: [] }
        const custom = value.custom.trim()
        const parts: string[] = []
        if (item.multiSelect === true) {
          for (const label of value.selected) {
            const note = (value.notes[label] ?? '').trim()
            if (note !== '') parts.push(`${label}: ${note}`)
          }
        } else {
          const note = (value.notes[value.selected[0] ?? ''] ?? '').trim()
          if (note !== '') parts.push(note)
        }
        for (const [label, rawNote] of Object.entries(value.notes)) {
          const note = rawNote.trim()
          if (note === '' || value.selected.includes(label)) continue
          parts.push(`(未选) ${label}: ${note}`)
        }
        if (custom !== '') parts.push(custom)
        const text = parts.join('\n')
        // Official semantics: a single-select custom answer replaces the
        // selection. A right-click note can leave both in the draft, so the
        // selection must be dropped here rather than trusted upstream.
        const keepSelection = item.multiSelect === true || custom === ''
        return {
          id: item.id,
          selected: keepSelection ? value.selected : [],
          ...(text === '' ? {} : { custom: text }),
        }
      }),
    }
    setBusy('answer')
    setError(null)
    // The external-store render can lag the carrier as a timed call continues.
    // Read the channel used by answer() in this same event turn.
    const channel = pending.snapshot().channel
    sentVia.current = channel === 'waterfall' ? 'waterfall' : null
    void pending.answer(answer)
      .then(() => {
        if (channel !== 'rpc') return
        sentVia.current = null
        setBusy(null)
        setError(null)
        void pending.dismiss().catch(() => { setError({ key: 'status.sent' }) })
      })
      .catch((cause: unknown) => {
        sentVia.current = null
        setBusy(null)
        setError({ text: cause instanceof Error ? cause.message : String(cause) })
      })
  }

  const continueFlow = (): void => {
    if (!answered(draft)) {
      setError({ key: 'error.unanswered' })
      return
    }
    if (index < questions.length - 1) {
      replaceProgress(index + 1, drafts)
      setError(null)
      return
    }
    submitDrafts(drafts)
  }

  // Each option's supplement note is stored under its own label: typing under
  // one option never touches another option's note, the selection, or the
  // bottom free-text answer.
  const noteDraft = (label: string, event: ChangeEvent<HTMLTextAreaElement>): void => {
    const value = event.target.value
    updateDraft(current => ({
      ...current,
      notes: { ...current.notes, [label]: value },
      skipped: false,
    }))
  }

  // The bottom free-text field keeps the official semantics: a single-select
  // custom answer replaces the selection, a multi-select one accompanies it.
  const draftCustom = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    const value = event.target.value
    updateDraft(current => ({
      ...current,
      selected: question.multiSelect === true ? current.selected : [],
      custom: value,
      skipped: false,
    }))
  }

  const continueFromCustom = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey || isComposing(event)) return
    event.preventDefault()
    continueFlow()
  }

  const skipQuestion = (): void => {
    engage()
    const nextDrafts = drafts.map((item, itemIndex) => itemIndex === index
      ? { selected: [], notes: {}, custom: '', skipped: true }
      : item)
    replaceProgress(index < questions.length - 1 ? index + 1 : index, nextDrafts)
    setError(null)
    if (index < questions.length - 1) {
      return
    }
    submitDrafts(nextDrafts)
  }

  /**
   * Send the side question through the host `bc-ask` command. The host runs a
   * read-only fork child, so this works while the question card is still
   * pending and the request can reuse the parent's prompt cache. The answer is
   * rendered in this card only; it never becomes part of the pending answer.
   */
  const sendSide = (): void => {
    const requestKey = threadKey
    // The controller map is the synchronous guard: state lags a fast double-click.
    if (locked || sideAborts.current.has(requestKey)) return
    const text = sideInput.trim()
    if (text === '') {
      setSideErrorFor(requestKey, t('side.empty'))
      return
    }
    const target = sessionIdOf({ sessionId, session }, frameRef.current, pending.sessionId)
    if (target === '') {
      setSideErrorFor(requestKey, t('side.noSession'))
      return
    }
    const id = `${String(Date.now())}-${Math.random().toString(36).slice(2)}`
    const history: SideAskTurn[] = (sideThreads[requestKey] ?? [])
      .filter(turn => !turn.pending && turn.answer !== undefined && turn.answer !== '')
      .map(turn => ({ question: turn.question, answer: turn.answer ?? '' }))
    const questionsContext = questions.map((item, itemIndex) => {
      const value = drafts[itemIndex] as QuestionNoteDraftAnswer
      return {
        title: item.question,
        header: item.header,
        detail: item.detail,
        multiSelect: item.multiSelect === true,
        options: item.options?.map(option => ({
          label: option.label,
          description: option.description,
        })),
        selected: value.selected,
        notes: value.notes,
        custom: value.custom,
        skipped: value.skipped,
      }
    })
    setSideInput('')
    setSideErrorFor(requestKey, null)
    // An in-flight side question means the user is still deciding: stop the
    // countdown until the card is answered instead of timing out mid-wait.
    engage()
    const controller = new AbortController()
    sideAborts.current.set(requestKey, controller)
    markSideBusy(requestKey, true)
    appendSideTurn(requestKey, { id, question: text, pending: true })
    void askSide(target, {
      question: text,
      questions: questionsContext,
      activeIndex: index,
      thread: history,
    }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        if (result.kind !== 'text') throw new Error(result.text !== '' ? result.text : t('side.failed'))
        const answer = result.text.trim()
        if (answer === '') throw new Error(t('side.failed'))
        updateSideTurn(requestKey, id, turn => ({ ...turn, pending: false, answer }))
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        const message = cause instanceof Error ? cause.message : String(cause)
        const hint = /busy|忙|占用/i.test(message) ? `\n${t('side.busyHint')}` : ''
        updateSideTurn(requestKey, id, turn => ({
          ...turn,
          pending: false,
          error: `${t('side.failed')}：${message}${hint}`,
        }))
      })
      .finally(() => {
        if (sideAborts.current.get(requestKey) !== controller) return
        sideAborts.current.delete(requestKey)
        markSideBusy(requestKey, false)
      })
  }

  const sideKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey || isComposing(event)) return
    event.preventDefault()
    sendSide()
  }

  return (
    <div ref={frameRef} className={cx.frame} data-question-key={pending.key} data-better-choice>
      <section
        className={cls(cx.card, minimized && cx.cardMinimized)}
        aria-labelledby={`question-${pending.key}-${String(index)}`}
      >
        <header className={cx.header}>
          <div className={cx.headingBlock}>
            {question.header !== undefined && <div className={cx.eyebrow}>{question.header}</div>}
            <h2 className={cx.title} id={`question-${pending.key}-${String(index)}`}>
              {question.question}
            </h2>
          </div>
          <div className={cx.headerActions}>
            {countdown !== undefined && card.waitState !== 'waiting' && card.waitState !== 'editing' && card.waitState !== 'continued' && (
              <span className={cx.waitStatus}>
                {t(countdown.running ? 'wait.countdown' : 'wait.paused', {
                  seconds: Math.ceil(countdown.remainingMs / 1000),
                })}
              </span>
            )}
            {countdown !== undefined && card.waitState !== 'waiting' && card.waitState !== 'editing' && card.waitState !== 'continued' && (
              <Button variant="outline" className={cx.waitButton} onClick={takeTime}>
                {t('wait.takeTime')}
              </Button>
            )}
            {card.state === 'continued' && <span className={cx.waitStatus}>{t('wait.continued')}</span>}
            {/* A held or frozen countdown says so; a request that never carried
                one waits silently, as the blocking question always has. */}
            {countdown !== undefined && (card.waitState === 'waiting' || card.waitState === 'editing') && (
              <span className={cx.waitStatus}>{t('wait.held')}</span>
            )}
            {review !== undefined && <span className={cx.waitStatus}>{t('review.status')}</span>}
            <button
              type="button" className={cx.iconButton}
              aria-label={t(minimized ? 'nav.maximize' : 'nav.minimize')}
              title={t(minimized ? 'nav.maximize' : 'nav.minimize')}
              aria-expanded={!minimized}
              disabled={busy !== null}
              onClick={() => { setMinimized(current => !current) }}
            >
              {minimized ? <IconChevronUpOutlineRegular /> : <IconChevronDownOutlineRegular />}
            </button>
            <button
              type="button" className={cx.iconButton}
              aria-label={t(pending.dismissal === 'hide' ? 'nav.close' : 'nav.cancel')}
              title={t(pending.dismissal === 'hide' ? 'nav.close' : 'nav.cancel')}
              disabled={busy !== null} onClick={dismissFlow}
            >
              <IconCloseOutlineRegular />
            </button>
          </div>
        </header>

        {!minimized && (
          <>
            <div
              ref={answerSurface}
              className={cx.body}
              data-question-scroll
              onFocusCapture={focusAnswerSurface}
              onBlurCapture={blurAnswerSurface}
            >
              {question.detail !== undefined && (
                <div className={cx.detail}><MarkdownText text={question.detail} labels={markdownLabels} /></div>
              )}
              <div className={cx.options} role={question.multiSelect === true ? 'group' : 'radiogroup'}>
                {(question.options ?? []).map((option, optionIndex) => {
                  const selected = draft.selected.includes(option.label)
                  const display = parseRecommendedLabel(option.label)
                  const note = draft.notes[option.label] ?? ''
                  // The note input is opened by right-click, not by selection.
                  const supplementHere = review === undefined && !locked && openNotes.has(option.label)
                  // The button paints only the label line; keep the description,
                  // recommendation and note state in its accessible name.
                  const accessibleName = [
                    display.label,
                    display.recommended ? t('option.recommended') : '',
                    option.description ?? '',
                    note !== '' ? t('note.affordance.filled') : '',
                  ].filter(part => part !== '').join('，')
                  return (
                    <Fragment key={`${option.label}-${String(optionIndex)}`}>
                      <button
                        type="button"
                        className={cls(
                          cx.option,
                          selected && question.multiSelect !== true && cx.optionSelected,
                          openNotes.has(option.label) && cx.optionNoteOpen,
                        )}
                        role={question.multiSelect === true ? 'checkbox' : 'radio'}
                        aria-checked={selected}
                        aria-label={accessibleName}
                        title={review === undefined ? t('note.affordance') : undefined}
                        disabled={locked}
                        onClick={() => { choose(option.label) }}
                        onContextMenu={(event) => {
                          // Only a live card can open a note; leave the native menu
                          // alone on a review or locked card, where this is a no-op.
                          if (review !== undefined || locked) return
                          event.preventDefault()
                          event.stopPropagation()
                          openNote(option.label)
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return
                          event.preventDefault()
                          submitDrafts(drafts)
                        }}
                      >
                        {question.multiSelect === true
                          ? (
                            <span className={cls(cx.checkbox, selected && cx.checkboxChecked)} aria-hidden="true">
                              {selected && <IconCheckOutlineRegular size={12} />}
                            </span>
                          )
                          : <span className={cx.number}>{optionIndex + 1}</span>}
                        <span className={cx.optionCopy}>
                          <span className={cx.optionLine}>
                            <span className={cx.optionLabel}>{display.label}</span>
                            {display.recommended && (
                              <span className={cx.badge}>{t('option.recommended')}</span>
                            )}
                            {option.description !== undefined && (
                              <span className={cx.description}>{option.description}</span>
                            )}
                          </span>
                        </span>
                        {review === undefined && (
                          <span className={cx.noteAffordance} aria-hidden="true">
                            {note !== '' && <span className={cx.noteDot} />}
                            <IconEditOutlineRegular size={11} />
                            {note !== '' ? t('note.affordance.filled') : t('note.affordance')}
                          </span>
                        )}
                      </button>
                      {supplementHere && (
                        <div className={cx.supplementRow} data-note-for={option.label}>
                          <AnswerField
                            variant="inline"
                            value={note}
                            disabled={locked}
                            autoFocus
                            placeholder={t('note.placeholder')}
                            onChange={(event) => { noteDraft(option.label, event) }}
                            onKeyDown={continueFromCustom}
                          />
                        </div>
                      )}
                    </Fragment>
                  )
                })}

                {review !== undefined && draft.skipped && (
                  <p className={cx.reviewNote}>{t('review.skipped')}</p>
                )}

                {/* The free-text row stays for questions with options as an
                    alternative answer; with a selection it now coexists with
                    the choice instead of replacing it. A review card keeps it
                    only when the recorded answer used it. */}
                {(review === undefined || draft.custom !== '') && (hasOptions
                  ? (
                    <div className={cls(cx.customRow, draft.custom !== '' && cx.customRowActive)}>
                      {question.multiSelect === true
                        ? (
                          <span
                            className={cls(cx.checkbox, draft.custom !== '' && cx.checkboxChecked)}
                            aria-hidden="true"
                          >
                            {draft.custom !== '' && <IconCheckOutlineRegular size={12} />}
                          </span>
                        )
                        : (
                          <span className={cx.number} aria-hidden="true">
                            <IconEditOutlineRegular size={12} />
                          </span>
                        )}
                      <AnswerField
                        variant="inline"
                        value={draft.custom}
                        disabled={locked}
                        placeholder={t('custom.placeholder')}
                        onChange={draftCustom}
                        onKeyDown={continueFromCustom}
                      />
                    </div>
                  )
                  : (
                    <AnswerField
                      // A missing countdown does not imply an indefinite request:
                      // a timed request can still be awaiting its claim's first frame.
                      autoFocus={canSubmit && countdown === undefined && !locked && !focusedQuestions.current.has(index)}
                      variant="block"
                      value={draft.custom}
                      disabled={locked}
                      placeholder={t('custom.placeholder')}
                      onFocus={() => { focusedQuestions.current.add(index) }}
                      onChange={draftCustom}
                      onKeyDown={continueFromCustom}
                    />
                  ))}
              </div>
            </div>

            {review === undefined && (
              <div
                className={cx.sideAsk}
                data-better-choice-side
                // The side box sits outside the focus-capturing answer surface:
                // without this, a timed card keeps counting (and can time out)
                // while the user reads or writes a side question.
                onFocusCapture={focusSidePanel}
                onBlurCapture={blurSidePanel}
              >
                <div className={cx.sideHeader}>
                  <span className={cx.sideTitle}>{t('side.title')}</span>
                  <span className={cx.sideHint}>{t('side.hint')}</span>
                </div>
                {sideThread.length > 0 && (
                  <div className={cx.thread} ref={threadRef} data-side-thread>
                    {sideThread.map(turn => (
                      <div className={cx.turn} key={turn.id}>
                        <div className={cx.questionBubble}>{turn.question}</div>
                        {turn.pending
                          ? <div className={cx.pendingAnswer}>{t('side.answering')}</div>
                          : turn.error !== undefined
                            ? <div className={cx.sideError}>{turn.error}</div>
                            : (
                              <div className={cx.answerBubble}>
                                <div className={cx.answerLabel}>{t('side.answer')}</div>
                                <MarkdownText text={turn.answer ?? ''} labels={markdownLabels} />
                              </div>
                            )}
                      </div>
                    ))}
                  </div>
                )}
                {sideError !== null && <div className={cx.sideError}>{sideError}</div>}
                <div className={cx.sideInputRow}>
                  <textarea
                    className={cx.sideTextarea}
                    rows={1}
                    value={sideInput}
                    disabled={sideBusy || locked}
                    placeholder={t('side.placeholder')}
                    aria-label={t('side.title')}
                    onChange={(event) => { setSideInput(event.target.value); setSideErrorFor(threadKey, null) }}
                    onKeyDown={sideKeyDown}
                  />
                  <Button
                    variant="outline"
                    disabled={sideBusy || locked || sideInput.trim() === ''}
                    onClick={sendSide}
                  >
                    {sideBusy ? t('side.answering') : t('side.send')}
                  </Button>
                  {sideBusy && (
                    <Button variant="outline" onClick={() => { cancelSide(threadKey) }}>
                      {t('side.cancel')}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <footer className={cx.footer}>
              <div className={cx.pager}>
                <button
                  type="button" className={cx.iconButton} aria-label={t('nav.prev')}
                  disabled={index === 0 || busy !== null}
                  onClick={() => { replaceProgress(index - 1, drafts); setError(null) }}
                >
                  <IconChevronLeftOutlineRegular />
                </button>
                <span className={cx.progress}>{index + 1} / {questions.length}</span>
                <button
                  type="button" className={cx.iconButton} aria-label={t('nav.next')}
                  disabled={isLastQuestion || busy !== null}
                  onClick={() => { replaceProgress(index + 1, drafts); setError(null) }}
                >
                  <IconChevronRightOutlineRegular />
                </button>
              </div>
              <div className={cx.feedback} role="status">
                {error === null ? null : 'key' in error ? t(error.key) : error.text}
              </div>
              {/* A review card has nothing to send: the pager alone walks the record. */}
              {review === undefined && (
                <div className={cx.footerActions}>
                  <Button variant="outline" disabled={busy !== null} onClick={skipQuestion}>
                    {t('action.skip')}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy !== null || !answered(draft) || (isLastQuestion && !canSubmit)}
                    onClick={continueFlow}
                  >
                    {busy === 'answer'
                      ? t('submitting')
                      : isLastQuestion ? t('submit') : t('action.next')}
                  </Button>
                </div>
              )}
            </footer>
          </>
        )}
      </section>
    </div>
  )
}
