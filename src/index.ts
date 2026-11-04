/**
 * Host half of dsh-better-choice.
 *
 * The side question is answered by a `fork` subagent: the child inherits the
 * parent's system prompt, tool declarations, and the completed-turn prefix, so
 * the request prefix is byte-identical to the parent's last cacheable request.
 * The only added input is one trailing user message. Tools are blocked at
 * execution time by a guard; they are never filtered out of the declarations,
 * because removing them would change the cached prefix.
 */
import { randomUUID } from 'node:crypto'

/** Cordis plugin name. */
export const name = 'better-choice'

/** Services this host half needs. `tools` is only used for the execution guard. */
export const inject = ['commands', 'subagents', 'tools']

/** Host command invoked by the card's side-question box. */
const COMMAND = 'bc-ask'

/** Upper bound for one side answer. Thinking tokens share this budget. */
const MAX_TOKENS = 32_000

/** A side question that never settles must not keep a child alive forever. */
const TIMEOUT_MS = 30 * 60_000

/** Denial returned to a side child that tries to execute a tool. */
const DENY = '旁问只允许文字回答，禁止执行任何工具。'

interface SideAskOption {
  label?: unknown
  description?: unknown
}

interface SideAskCard {
  title?: unknown
  header?: unknown
  detail?: unknown
  multiSelect?: unknown
  options?: unknown
  selected?: unknown
  notes?: unknown
  custom?: unknown
  skipped?: unknown
}

interface SideAskTurn {
  question?: unknown
  answer?: unknown
}

interface SideAskPayload {
  question?: unknown
  questions?: unknown
  activeIndex?: unknown
  thread?: unknown
  /** Older clients sent one card instead of the full batch. */
  card?: unknown
}

interface AgentLike {
  id?: string
  options?: {
    provider?: string
    model?: string
    reasoningEffort?: string
    maxTokens?: number
  }
  session?: {
    id?: string
    header?: { id?: string }
  }
}

interface SubagentProvider {
  inheritsParentContext?: boolean
}

interface ActivationResult {
  stopReason: string
  output: readonly { type: string; text?: string }[]
}

interface Activation {
  childId?: string
  result: Promise<ActivationResult>
  dispose(): Promise<void>
}

interface StartActivationSpec {
  provider: string
  label: string
  childId: string
  request: {
    parent: AgentLike
    agentOptions?: { maxTokens?: number }
    prompt: readonly { type: 'text'; text: string }[]
  }
  signal: AbortSignal
  delivery: 'caller'
}

interface CommandInvocation {
  agent?: AgentLike
  rawInput: string
  signal: AbortSignal
}

interface CommandDefinition {
  name: string
  description: string
  input?: { hint?: string }
  recordInput?: boolean
  handler(invocation: CommandInvocation): Promise<{ kind: string; text: string }>
}

interface HostContext {
  commands: { register(definition: CommandDefinition): void }
  subagents: {
    getProvider(name: string): SubagentProvider | undefined
    startActivation?(spec: StartActivationSpec): Promise<Activation>
  }
  tools: {
    guard(
      guard: (exec: { agent?: AgentLike; name?: string; arguments?: unknown }) => string | undefined,
    ): () => void | Promise<void>
  }
  on?: (
    event: 'agent/created',
    handler: (payload: { agent?: AgentLike }) => void,
  ) => () => void
  effect?: (setup: () => (() => void | Promise<void>)) => void
  logger?: { warn(...values: unknown[]): void }
}

/** Child ids that are currently owned by a side question; used by the guard. */
const ownedIds = new Set<string>()

/** Agents/sessions already claimed for a side question. */
const ownedObjects = new WeakSet<object>()

/** Whether a tool call belongs to an in-flight side child. */
function isSideChild(agent: AgentLike | undefined): boolean {
  if (agent === undefined || agent === null) return false
  if (ownedObjects.has(agent)) return true
  if (agent.session !== undefined && ownedObjects.has(agent.session)) return true
  const id = typeof agent.id === 'string'
    ? agent.id
    : agent.session?.id ?? agent.session?.header?.id
  return typeof id === 'string' && ownedIds.has(id)
}

/** Read a trimmed string without accepting non-string JSON values. */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Parse the command's JSON payload. */
function parsePayload(raw: string): SideAskPayload | undefined {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
    return value as SideAskPayload
  } catch {
    return undefined
  }
}

/** Keep only the option fields the prompt renderer understands. */
function optionsOf(value: unknown): { label: string; description?: string }[] {
  if (!Array.isArray(value)) return []
  const options: { label: string; description?: string }[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const option = item as SideAskOption
    const label = textOf(option.label)
    if (label === '') continue
    const description = textOf(option.description)
    options.push(description === '' ? { label } : { label, description })
  }
  return options
}

/** Keep only string-to-string notes. */
function notesOf(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const notes: Record<string, string> = {}
  for (const [label, note] of Object.entries(value)) {
    const text = textOf(note)
    if (text !== '') notes[label] = text
  }
  return notes
}

/** Keep only string labels. */
function labelsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(label => typeof label === 'string' && label.trim() !== '' ? [label] : [])
}

/** Normalize one card from the wire. */
function normalizeCard(value: unknown): SideAskCard | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const card = value as SideAskCard
  return {
    title: textOf(card.title),
    header: textOf(card.header),
    detail: textOf(card.detail),
    multiSelect: card.multiSelect === true,
    options: optionsOf(card.options),
    selected: labelsOf(card.selected),
    notes: notesOf(card.notes),
    custom: textOf(card.custom),
    skipped: card.skipped === true,
  }
}

/** Render one question card, marking the active question when there are several. */
function renderCard(card: SideAskCard, position: number, total: number, active: boolean): string {
  const lines: string[] = [`【问题 ${String(position + 1)}/${String(total)}】${active ? '（当前正在看）' : ''}`]
  const header = textOf(card.header)
  const title = textOf(card.title)
  const detail = textOf(card.detail)
  const selected = labelsOf(card.selected)
  const notes = notesOf(card.notes)
  const options = optionsOf(card.options)
  if (header !== '') lines.push(`分组：${header}`)
  if (title !== '') lines.push(`标题：${title}`)
  if (detail !== '') lines.push(`说明：${detail}`)
  lines.push(`类型：${card.multiSelect === true ? '多选' : '单选'}`)
  if (options.length > 0) {
    lines.push('选项：')
    for (const option of options) {
      const marker = selected.includes(option.label) ? '[已选]' : '[未选]'
      const description = option.description === undefined ? '' : `：${option.description}`
      const note = notes[option.label]
      lines.push(`- ${marker} ${option.label}${description}${note === undefined ? '' : `（备注：${note}）`}`)
    }
  } else if (selected.length > 0) {
    lines.push(`已选：${selected.join('、')}`)
  }
  // Notes under an unknown option still matter; mark them so the model does not
  // mistake them for a selection (the submit path uses the same `(未选)` marker).
  const known = new Set(options.map(option => option.label))
  for (const [label, note] of Object.entries(notes)) {
    if (known.has(label)) continue
    lines.push(`- [备注] ${label}：${note}`)
  }
  const custom = textOf(card.custom)
  if (custom !== '') lines.push(`自定义输入：${custom}`)
  if (card.skipped === true) lines.push('状态：用户暂时跳过了这道题')
  return lines.join('\n')
}

/** Render the previous side-question turns so follow-ups keep their context. */
function renderThread(value: unknown): string {
  if (!Array.isArray(value)) return ''
  const turns: string[] = []
  let position = 0
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const turn = item as SideAskTurn
    const question = textOf(turn.question)
    const answer = textOf(turn.answer)
    if (question === '' || answer === '') continue
    // Two lines per turn: number by the turn count, not by the line count.
    position += 1
    turns.push(`${String(position)}. 问：${question}`, `   答：${answer}`)
  }
  return turns.length === 0 ? '' : ['【之前的旁问】', ...turns].join('\n')
}

/** Build the only new input a side child receives. */
function buildPrompt(payload: SideAskPayload): string {
  const question = textOf(payload.question)
  const wireCards = Array.isArray(payload.questions)
    ? payload.questions
    : payload.card === undefined ? [] : [payload.card]
  // Keep each card's position in the wire batch: the client's activeIndex points
  // into that batch, and dropping an unusable entry must not shift the marker
  // onto a different question.
  const entries: { card: SideAskCard; position: number }[] = []
  for (const [position, card] of wireCards.entries()) {
    const normalized = normalizeCard(card)
    if (normalized !== undefined) entries.push({ card: normalized, position })
  }
  const requestedIndex = typeof payload.activeIndex === 'number' && Number.isInteger(payload.activeIndex)
    ? payload.activeIndex
    : 0
  const exact = entries.findIndex(entry => entry.position === requestedIndex)
  const activeIndex = entries.length === 0
    ? 0
    : exact >= 0 ? exact : Math.min(Math.max(requestedIndex, 0), entries.length - 1)
  const thread = renderThread(payload.thread)
  return [
    '【旁问模式】',
    '你正在回答用户的旁问，不是在回答待决问题。',
    '只输出文字回答，不要调用任何工具，不要替用户做选择，也不要继续原任务。',
    '请结合下面的问题卡片和之前的旁问回答用户。',
    '用户提到「刚才」「上一条」时，优先指【之前的旁问】，而不是主会话。',
    ...(entries.length === 0
      ? []
      : ['', '【待决问题】', ...entries.map((entry, index) => renderCard(entry.card, index, entries.length, index === activeIndex))]),
    ...(thread === '' ? [] : ['', thread]),
    '',
    '【用户的旁问】',
    question,
  ].join('\n')
}

/** Remove tool-call markup that some models emit as plain text. */
function sanitizeAnswer(text: string): string {
  return text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    .replace(/<function_call>[\s\S]*?<\/function_call>/gi, '')
    .trim()
}

/** One error response. */
function fail(text: string): { kind: 'error'; text: string } {
  return { kind: 'error', text }
}

/**
 * Answer one side question with a fork child.
 * @param ctx - host context.
 * @param invocation - command invocation carrying the parent agent and signal.
 */
async function handleSideAsk(
  ctx: HostContext,
  invocation: CommandInvocation,
): Promise<{ kind: string; text: string }> {
  const payload = parsePayload(invocation.rawInput)
  if (payload === undefined) return fail('旁问请求格式不正确。')
  const question = textOf(payload.question)
  if (question === '') return fail('请输入旁问内容。')
  const agent = invocation.agent
  if (agent === undefined || agent === null) return fail('旁问不可用：未找到当前会话。')
  if (invocation.signal.aborted) return fail('旁问已取消。')

  const provider = ctx.subagents.getProvider('fork')
  if (provider?.inheritsParentContext !== true) {
    return fail('旁问不可用：当前 DSH 版本没有可继承上下文的 fork 子代理。')
  }
  if (typeof ctx.subagents.startActivation !== 'function') {
    return fail('旁问不可用：当前 DSH 版本不支持 fork 子代理启动。')
  }

  const parentMax = agent.options?.maxTokens
  const maxTokens = typeof parentMax === 'number' && parentMax > 0
    ? Math.min(MAX_TOKENS, parentMax)
    : MAX_TOKENS
  const childId = randomUUID()
  ownedIds.add(childId)
  let childAgent: AgentLike | undefined
  const stopCreated = ctx.on?.('agent/created', ({ agent: created }) => {
    if (created?.id !== childId) return
    childAgent = created
    ownedObjects.add(created)
    if (created.session !== undefined) ownedObjects.add(created.session)
  })
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const signal = AbortSignal.any([invocation.signal, timeout])
  let activation: Activation | undefined
  let started = false
  try {
    activation = await ctx.subagents.startActivation({
      provider: 'fork',
      label: 'BC 旁问',
      childId,
      request: {
        parent: agent,
        agentOptions: { maxTokens },
        // One trailing user message is the only new input. A completed parent
        // turn is replayed by the fork provider; a pending tool-call turn is
        // not part of the seed, so the card context travels in this prompt.
        prompt: [{ type: 'text', text: buildPrompt(payload) }],
      },
      signal,
      delivery: 'caller',
    })
    started = true
    const result = await activation.result
    if (result.stopReason === 'aborted') return fail('旁问已取消。')
    const text = sanitizeAnswer(result.output
      .filter(block => block.type === 'text')
      .map(block => block.text ?? '')
      .join(''))
    if (result.stopReason !== 'completed') {
      const reason = result.stopReason === 'max-tokens'
        ? '旁问输出达到上限。'
        : `旁问未完成（${result.stopReason}）。`
      return fail(text === '' ? reason : `${reason}\n\n${text}`)
    }
    if (text === '') return fail('模型没有返回内容。')
    return { kind: 'success', text }
  } catch (error) {
    if (signal.aborted) return fail('旁问已取消。')
    const message = error instanceof Error ? error.message : String(error)
    return fail(`旁问失败：${message}`)
  } finally {
    stopCreated?.()
    if (started) {
      ownedIds.delete(childId)
      if (childAgent !== undefined) {
        ownedObjects.delete(childAgent)
        if (childAgent.session !== undefined) ownedObjects.delete(childAgent.session)
      }
      // `dispose` is idempotent; awaiting it here releases the child id and the
      // per-child guard even when the result resolved normally.
      await Promise.resolve(activation?.dispose()).catch(() => {})
    }
    // A start that threw may still have created the child: the upstream
    // `startLocal` materializes the agent before submitting, and its catch does
    // not dispose an already-established activation. Keep `childId` owned in
    // that case so the execution-time guard fails closed instead of letting the
    // untracked child run tools.
  }
}

/**
 * Register the side-question command and the execution-time tool guard.
 * @param ctx - host context.
 */
export function apply(ctx: HostContext): void {
  const releaseGuard = ctx.tools.guard(exec => isSideChild(exec.agent) ? DENY : undefined)
  ctx.effect?.(() => releaseGuard)
  ctx.commands.register({
    name: COMMAND,
    description: '向当前会话的 fork 子代理提出一个只读旁问。',
    input: { hint: '旁问内容（JSON，由问题卡自动生成）' },
    // The payload contains the whole pending card; never persist it in the
    // command log alongside the conversation.
    recordInput: false,
    handler: invocation => handleSideAsk(ctx, invocation),
  })
}
