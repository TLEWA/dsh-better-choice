/**
 * Bridge to the host's `bc-ask` command. The host answers with one direct
 * model call; no child agent and no parent-turn dependency is involved, so the
 * question card can stay pending while the side question is answered.
 */

/** One option as presented by the pending question card. */
export interface SideAskOption {
  label: string
  description?: string
}

/** The card state sent with a side question so the answer stays grounded. */
export interface SideAskCard {
  title?: string
  header?: string
  detail?: string
  options?: SideAskOption[]
  selected?: string[]
  notes?: Record<string, string>
  custom?: string
}

/** One side-question request. */
export interface SideAskInput {
  question: string
  card?: SideAskCard
}

/** One side-question answer returned by the host command. */
export interface SideAnswer {
  kind: string
  text: string
}

/** The subset of the remote-commands service this plugin uses. */
export interface SideAskService {
  ask(sessionId: string, input: SideAskInput, signal?: AbortSignal): Promise<SideAnswer>
}

let service: SideAskService | null = null

/**
 * Install the side-question backend for the mounted client plugin.
 * @param next - the backend, or null when the client plugin unloads.
 */
export function setSideAskService(next: SideAskService | null): void {
  service = next
}

/**
 * Ask the model a side question through the host `bc-ask` command.
 * @param sessionId - the conversation session the question card belongs to.
 * @param input - the side question plus the pending card's current context.
 * @param signal - aborts the command when the card unmounts.
 * @returns the host command's answer text.
 */
export async function askSide(
  sessionId: string,
  input: SideAskInput,
  signal?: AbortSignal,
): Promise<SideAnswer> {
  if (service === null) throw new Error('旁问后端尚未就绪')
  return service.ask(sessionId, input, signal)
}
