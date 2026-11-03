/**
 * Local structural types for the pending-question carrier the official
 * ui-user-questions client plugin owns. The carrier class is not exported by
 * that package (feature-plugin export discipline), so this plugin matches it
 * structurally: the chain-slot selector checks the exact method set the
 * composer calls, and every value crossing the boundary is treated as the
 * documented carrier contract. When the structure stops matching, the select
 * returns null and the official composer keeps the seat — the popup stays
 * usable and only this enhancement goes missing.
 */

/** One option the asker offered on a question. */
export interface QuestionNoteOption {
  label: string
  description?: string
}

/** A caller-declared presentation intent this plugin does not render. */
export interface QuestionNoteIntent {
  kind: string
  approve: string
  callId?: unknown
}

/** One question of the pending request. */
export interface QuestionNoteItem {
  id: string
  question: string
  detail?: string
  header?: string
  options?: QuestionNoteOption[]
  multiSelect?: boolean
  intent?: QuestionNoteIntent
}

/** One answered question as recorded in a settled call. */
export interface QuestionNoteAnswerItem {
  id: string
  selected: string[]
  custom?: string
}

/** One structured answer batch covering every question of the request. */
export interface QuestionNoteAnswer {
  answers: QuestionNoteAnswerItem[]
}

/** Reactive card state read by the mounted composer. */
export interface QuestionNoteCardSnapshot {
  /** Mirrors the projection row; `open` until the projection says otherwise. */
  readonly state: 'open' | 'continued'
  /** User-visible foreground wait presentation. */
  readonly waitState: 'counting' | 'focused' | 'editing' | 'waiting' | 'continued'
  /** Foreground countdown, absent for a request that carried no deadline. */
  readonly countdown: { readonly remainingMs: number; readonly running: boolean } | undefined
  /** Channel a submission would use right now. */
  readonly channel: 'waterfall' | 'rpc' | 'none'
  /** Set once the card left the registry. */
  readonly closed: boolean
}

/** The pending-question carrier contract this composer consumes. */
export interface QuestionNoteCarrier {
  /** Render identity and draft-store key. */
  readonly key: string
  /** The request's complete question batch. */
  readonly questions: readonly QuestionNoteItem[]
  /** Recorded answers of a settled call; present only on a read-only card. */
  readonly review: readonly QuestionNoteAnswerItem[] | undefined
  /** What closing the panel does: withdraw (`hide`) or end (`cancel`). */
  readonly dismissal: 'hide' | 'cancel'
  /** Subscribe to card state changes. */
  subscribe(listener: () => void): () => void
  /** Read the stable current card state. */
  snapshot(): QuestionNoteCardSnapshot
  /** Stop this Client's countdown indefinitely. */
  takeTime(): void
  /** Freeze a pristine countdown because the user started editing. */
  engage(now?: number): void
  /** Record focus even before the request arrives. */
  holdFocus(now?: number): void
  /** Resume a pristine countdown after the answer surface loses focus. */
  releaseFocus(now?: number): void
  /** Submit the whole answer batch through whichever channel is live. */
  answer(answer: QuestionNoteAnswer): Promise<void>
  /** Close the panel per its dismissal mode. */
  dismiss(): Promise<void>
  /** Draft-store keys still live in this Session. */
  liveKeys(): readonly string[]
}

/**
 * Whether the official composer would render this batch as a plan-review
 * decision card (a copy of the official planReviewOf narrowing). The
 * enhancement defers those requests to the official component.
 * @param questions - the request's whole question batch.
 * @returns true when the batch declares a renderable plan-review intent.
 */
export function isPlanReviewRequest(questions: readonly QuestionNoteItem[]): boolean {
  if (questions.length !== 1) return false
  const question = questions[0]
  if (question === undefined) return false
  const intent = question.intent
  if (intent?.kind !== 'plan-review' || question.detail === undefined) return false
  if (question.multiSelect === true) return false
  const options = question.options ?? []
  if (options.length > 2) return false
  return options.some(option => option.label === intent.approve)
}

/** Structural guard for the carrier method set this composer calls. */
export function isQuestionCarrier(value: unknown): value is QuestionNoteCarrier {
  if (typeof value !== 'object' || value === null) return false
  const carrier = value as Record<string, unknown>
  return typeof carrier.key === 'string'
    && Array.isArray(carrier.questions)
    && (carrier.review === undefined || Array.isArray(carrier.review))
    && (carrier.dismissal === 'hide' || carrier.dismissal === 'cancel')
    && typeof carrier.subscribe === 'function'
    && typeof carrier.snapshot === 'function'
    && typeof carrier.takeTime === 'function'
    && typeof carrier.engage === 'function'
    && typeof carrier.holdFocus === 'function'
    && typeof carrier.releaseFocus === 'function'
    && typeof carrier.answer === 'function'
    && typeof carrier.dismiss === 'function'
    && typeof carrier.liveKeys === 'function'
}

/**
 * Chain-slot selector: claim a generic pending-question carrier for this
 * composer and leave every other pending interaction (plan reviews, approval
 * cards, the normal composer) to its own registered entry.
 * @param owner - the chain entry's owner props, carrying the pending interaction.
 * @returns the carrier to render, or null to let the next selector run.
 */
export function selectQuestionCarrier(owner: { readonly pendingInteraction?: unknown }): QuestionNoteCarrier | null {
  const carrier = owner.pendingInteraction
  if (!isQuestionCarrier(carrier)) return null
  if (isPlanReviewRequest(carrier.questions)) return null
  return carrier
}
