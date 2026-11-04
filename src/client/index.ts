/**
 * Browser half of dsh-better-choice. It registers an enhanced
 * `ask_user_question` composer into the conversation-declared composer chain.
 * Chain selectors run in ascending priority order, so this entry's -10 runs
 * before the official entry (default 0) and claims generic pending-question
 * carriers; plan-review cards and every other pending interaction fall through
 * to their own registered entries.
 *
 * The side-question box talks to this plugin's own host command `bc-ask`,
 * which starts a read-only fork child and renders its answer inside the
 * question card. The answer never becomes part of the submitted answer and
 * never writes back into the parent conversation.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createQuestionNoteDraftStore } from './draft-store.ts'
import { QuestionNoteComposer } from './composer.tsx'
import { selectQuestionCarrier } from './carrier.ts'
import { en, zh, type QuestionNoteKey } from './locales.ts'
import { setSideAskService, type SideAskInput, type SideAskService } from './side.ts'
import { STYLES } from './styles.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The enhanced question composer's copy. */
    'better-choice': QuestionNoteKey
  }
}

/** Required services: slots, locale, and the remote command bridge. */
export const inject = ['slots', 'locale', 'remote', 'remote.commands']

/** Dictionary namespace owned by this plugin. */
const NS = 'better-choice'

/** Chain election order: the official composer sits at the default 0. */
const CHAIN_PRIORITY = -10

/** The `commands` namespace mounted on the client remote root. */
interface CommandsRemote {
  execute: (
    agentId: string,
    line: string,
    submittedAttachments: readonly unknown[],
    signal?: AbortSignal,
  ) => Promise<{
    ok: boolean
    error?: { code?: string; message?: string }
    value?: { result?: { kind?: string; text?: string } }
  }>
}

/** The subset of the client remote root this bridge uses. */
interface SideAskRemote {
  commands: CommandsRemote
}

/** Put the generated component CSS into the document exactly once per load. */
function installStyles(): () => void {
  const existing = document.getElementById('dsh-better-choice-styles')
  if (existing !== null) return () => {}
  const style = document.createElement('style')
  style.id = 'dsh-better-choice-styles'
  style.textContent = STYLES
  document.head.appendChild(style)
  return () => style.remove()
}

/** Build the `bc-ask` bridge over the remote commands namespace. */
function createSideAskService(remote: SideAskRemote): SideAskService {
  return {
    async ask(sessionId: string, input: SideAskInput, signal?: AbortSignal) {
      const line = `/bc-ask ${JSON.stringify(input)}`
      // `execute` is a method of the mounted `commands` service: (agentId, line,
      // submittedAttachments, signal) — the agent id is the conversation target.
      const response = await remote.commands.execute(sessionId, line, [], signal)
      if (!response.ok) {
        throw new Error(response.error?.message ?? 'side question failed')
      }
      const result = response.value?.result
      const kind = typeof result?.kind === 'string' ? result.kind : 'error'
      const text = typeof result?.text === 'string' ? result.text : ''
      if (kind === 'success' || kind === 'text') return { kind: 'text', text }
      throw new Error(text !== '' ? text : 'side question failed')
    },
  }
}

/**
 * Client plugin body: install styles, register dictionaries, connect the side
 * question bridge, and register the enhanced composer.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(installStyles, 'dsh-better-choice: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-better-choice: dictionaries')

  const remote = ctx.get('remote') as SideAskRemote | undefined
  if (remote !== undefined && remote !== null) {
    const service = createSideAskService(remote)
    setSideAskService(service)
    ctx.effect(() => () => setSideAskService(null), 'dsh-better-choice: side-ask bridge')
  }

  const draftStore = createQuestionNoteDraftStore()
  ctx.effect(() => ctx.slots.inject('conversation.composer', () => ctx.slots.register(
    {
      name: 'conversation.composer',
      priority: CHAIN_PRIORITY,
      select: selectQuestionCarrier,
      locale: NS,
      store: draftStore,
    },
    QuestionNoteComposer,
  )), 'dsh-better-choice: composer')
}
