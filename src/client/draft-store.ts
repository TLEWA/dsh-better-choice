/**
 * Session-scoped draft state for the enhanced question composer. Same shape
 * and semantics as the official `question` draft store, under its own
 * persistence key so the two composers can never overwrite each other's
 * drafts. The Slot registry owns store instances; this module exports only
 * the factory so a plugin reload cannot reuse a module-global handle.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** One in-progress answer, including an explicit skip. */
export interface QuestionNoteDraftAnswer {
  /** Offered labels currently selected. */
  selected: string[]
  /** Supplement note per option label: every option owns its own note, never shared or moved. */
  notes: Record<string, string>
  /** The bottom free-text "other" answer; official semantics (replaces a single-select selection). */
  custom: string
  /** Whether the user explicitly skipped this question. */
  skipped: boolean
}

/** Navigation and answer drafts for one pending request. */
export interface QuestionNoteDraftProgress {
  /** Current question index. */
  index: number
  /** One draft per question, in request order. */
  drafts: QuestionNoteDraftAnswer[]
  /** Local indefinite-wait choice restored with the draft. */
  wait?: 'editing' | 'waiting'
}

/** Persisted draft state of one store handle. */
export interface QuestionNoteDraftState {
  progressByRequest: Record<string, QuestionNoteDraftProgress>
}

/** Declared store mutations; the complete write API the composer uses. */
export type QuestionNoteDraftActions = {
  replace: (draft: QuestionNoteDraftState, requestKey: string, progress: QuestionNoteDraftProgress) => void
  clear: (draft: QuestionNoteDraftState, requestKey: string) => void
  prune: (draft: QuestionNoteDraftState, keep: readonly string[]) => void
}

/** The store handle shape the Slot registry carries to the component. */
export type QuestionNoteStoreHandle = EngineStoreHandle<QuestionNoteDraftState, QuestionNoteDraftActions>

/**
 * Declare the enhanced question composer's Session store.
 * @returns a persisted store handle whose instance is owned by the Slot registry.
 */
export function createQuestionNoteDraftStore(): QuestionNoteStoreHandle {
  return defineStore({
    init: (): QuestionNoteDraftState => ({ progressByRequest: {} }),
    persist: 'dsh.better-choice.drafts.v1',
    actions: {
      replace: (draft, requestKey, progress) => {
        draft.progressByRequest[requestKey] = progress
      },
      clear: (draft, requestKey) => {
        draft.progressByRequest = Object.fromEntries(
          Object.entries(draft.progressByRequest).filter(([key]) => key !== requestKey),
        )
      },
      prune: (draft, keep) => {
        const live = new Set(keep)
        draft.progressByRequest = Object.fromEntries(
          Object.entries(draft.progressByRequest).filter(([key]) => live.has(key)),
        )
      },
    },
  })
}

