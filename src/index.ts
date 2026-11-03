/**
 * Host half of dsh-better-choice.
 *
 * The question UI lives in the browser half. This half only owns the side
 * question command: a direct, one-shot model call that does not start a child
 * agent and therefore cannot deadlock behind the pending `ask_user_question`.
 */

/** Cordis plugin name of the host row. */
export const name = 'better-choice'

/** Host services: the command registry and the provider-neutral LLM runtime. */
export const inject = ['commands', 'llm']

/**
 * Character budget for the conversation prefix forwarded to the side model.
 *
 * The prefix is the session's own derived history, not a re-rendered digest:
 * keeping it byte-identical to the main request is what lets the provider
 * reuse its prompt cache. Only very long sessions are trimmed.
 */
const HISTORY_LIMIT = 120_000

/** Maximum output tokens for a side answer. */
const MAX_TOKENS = 700

/** Command name registered on the host. */
const COMMAND = 'bc-ask'

/** The client's serialized side-question request. */
interface SideAskPayload {
  question?: unknown
  card?: {
    title?: unknown
    header?: unknown
    detail?: unknown
    options?: unknown
    selected?: unknown
    notes?: unknown
    custom?: unknown
  }
}

/** One derived model message. */
interface DerivedMessage {
  role?: string
  content?: unknown
  [key: string]: unknown
}

/** Whether a message block is an unpaired assistant tool call. */
function hasToolCall(message: DerivedMessage): boolean {
  if (!Array.isArray(message.content)) return false
  return message.content.some((block) => {
    if (typeof block !== 'object' || block === null) return false
    return (block as Record<string, unknown>).type === 'tool-call'
  })
}

/**
 * The live session's derived history, made protocol-safe for a new user turn.
 *
 * A pending `ask_user_question` leaves the history ending in an assistant
 * tool-call with no tool result yet. A normal user message cannot follow that,
 * so the unfinished tail is removed. Earlier history is left untouched, which
 * keeps the cacheable prefix identical to the main conversation.
 */
function conversationHistory(agent: { session?: { deriveMessages?: () => unknown[] } }): DerivedMessage[] {
  let source: unknown[]
  try {
    source = agent.session?.deriveMessages?.() ?? []
  } catch {
    return []
  }
  const messages = source.filter(
    (message): message is DerivedMessage => typeof message === 'object' && message !== null,
  )
  while (messages.length > 0) {
    const last = messages[messages.length - 1]
    if (last.role === 'tool' || (last.role === 'assistant' && hasToolCall(last))) {
      messages.pop()
      continue
    }
    break
  }
  return messages
}

/**
 * Keep the newest part of a long history within the character budget, without
 * starting on a dangling tool result or assistant tool call.
 */
function trimHistory(messages: DerivedMessage[]): DerivedMessage[] {
  let used = 0
  let first = messages.length
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const size = JSON.stringify(messages[index]).length
    if (first < messages.length && used + size > HISTORY_LIMIT) break
    used += size
    first = index
  }
  while (first < messages.length) {
    const role = messages[first].role
    if (role === 'tool' || (role === 'assistant' && hasToolCall(messages[first]))) {
      first += 1
      continue
    }
    break
  }
  return messages.slice(first)
}

/** Render the option list with descriptions and the user's current leaning. */
function renderCard(card: NonNullable<SideAskPayload['card']>): string {
  const lines: string[] = []
  const title = typeof card.title === 'string' ? card.title.trim() : ''
  const header = typeof card.header === 'string' ? card.header.trim() : ''
  const detail = typeof card.detail === 'string' ? card.detail.trim() : ''
  if (header !== '') lines.push(`分类：${header}`)
  if (title !== '') lines.push(`问题：${title}`)
  if (detail !== '') lines.push(`补充说明：${detail}`)
  const options = Array.isArray(card.options) ? card.options : []
  if (options.length > 0) {
    lines.push('选项：')
    options.forEach((option, index) => {
      if (typeof option !== 'object' || option === null) return
      const record = option as Record<string, unknown>
      const label = typeof record.label === 'string' ? record.label : ''
      const description = typeof record.description === 'string' ? record.description.trim() : ''
      if (label === '') return
      lines.push(`${String(index + 1)}. ${label}${description === '' ? '' : ` —— ${description}`}`)
    })
  }
  const selected = Array.isArray(card.selected)
    ? card.selected.filter((item): item is string => typeof item === 'string')
    : []
  if (selected.length > 0) lines.push(`当前已选：${selected.join('、')}`)
  const notes = typeof card.notes === 'object' && card.notes !== null
    ? card.notes as Record<string, unknown>
    : {}
  const noteLines = Object.entries(notes)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '')
    .map(([label, note]) => `${label}：${note.trim()}`)
  if (noteLines.length > 0) lines.push(`用户补充：${noteLines.join('；')}`)
  const custom = typeof card.custom === 'string' ? card.custom.trim() : ''
  if (custom !== '') lines.push(`用户自由输入：${custom}`)
  return lines.join('\n')
}

/** Build the side-question instruction appended after the conversation prefix. */
function buildPrompt(payload: SideAskPayload): string {
  const question = typeof payload.question === 'string' ? payload.question.trim() : ''
  const card = payload.card === undefined ? '' : renderCard(payload.card)
  return [
    '【旁问模式】',
    '用户正在回答下面的待决问题，暂时不能提交，于是先向你提一个旁问。上面的对话就是当前会话的真实上下文。',
    '请直接回答旁问，要求：',
    '- 基于已发生的对话、问题、选项和用户当前的补充来回答，不要只复述卡片。',
    '- 简洁准确，通常 1-4 句，不要重复问题。',
    '- 不要替用户做选择，不要继续原任务，不要调用任何工具。',
    '- 信息确实不足时明确指出缺少什么，不要编造。',
    card === '' ? '' : `\n【问题卡片】\n${card}`,
    `\n【用户的旁问】\n${question}`,
  ].filter(part => part !== '').join('\n')
}

/** Read one complete text answer from the provider-neutral stream. */
async function streamText(
  stream: AsyncIterable<Record<string, unknown>>,
): Promise<string> {
  let text = ''
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
      text += chunk.text
      continue
    }
    if (chunk.type === 'finish') {
      const reason = chunk.reason
      if (reason === 'error' || chunk.kind === 'error') {
        const failure = chunk.failure as { message?: unknown } | undefined
        throw new Error(typeof failure?.message === 'string' ? failure.message : '模型调用失败')
      }
      continue
    }
    if (chunk.kind === 'error') {
      const failure = chunk.failure as { message?: unknown } | undefined
      throw new Error(typeof failure?.message === 'string' ? failure.message : '模型调用失败')
    }
  }
  return text.trim()
}

/** Minimal shape of the host agent supplied to a command handler. */
interface CommandAgent {
  options?: { provider?: string; model?: string; reasoningEffort?: string }
  session?: {
    deriveMessages?: () => unknown[]
    requestHeader?: () => { tools?: unknown[] } | undefined
    toolHistory?: () => unknown
  }
}

/** Minimal shape of the host plugin context used here. */
interface HostContext {
  commands: {
    register: (definition: {
      name: string
      description: string
      input?: { hint?: string }
      handler: (invocation: {
        agent: CommandAgent
        rawInput: string
        signal: AbortSignal
      }) => Promise<{ kind: string; text: string }>
    }) => void
  }
  llm: {
    stream: (options: Record<string, unknown>) => AsyncIterable<Record<string, unknown>>
  }
}

/**
 * Register the side-question command.
 * @param ctx - host root context.
 */
export function apply(ctx: HostContext): void {
  ctx.commands.register({
    name: COMMAND,
    description: 'Answer a side question for the pending question card',
    input: { hint: '<json>' },
    async handler({ agent, rawInput, signal }) {
      let payload: SideAskPayload
      try {
        payload = JSON.parse(rawInput.trim()) as SideAskPayload
      } catch {
        return { kind: 'error', text: '旁问请求格式无效' }
      }
      const question = typeof payload.question === 'string' ? payload.question.trim() : ''
      if (question === '') return { kind: 'error', text: '旁问内容为空' }

      const provider = agent.options?.provider ?? ''
      const model = agent.options?.model ?? ''
      if (provider === '' || model === '') {
        return { kind: 'error', text: '当前会话没有可用的模型路由' }
      }
      signal.throwIfAborted()
      try {
        const history = trimHistory(conversationHistory(agent))
        // Match the main request envelope as far as the command handler can
        // see it. The provider caches the request prefix, so reusing the
        // session's own tool declarations and history avoids invalidating the
        // already-warm prefix.
        const header = agent.session?.requestHeader?.()
        const tools = Array.isArray(header?.tools) && header.tools.length > 0 ? header.tools : undefined
        const toolHistory = agent.session?.toolHistory?.()
        const text = await streamText(ctx.llm.stream({
          provider,
          model,
          ...agent.options?.reasoningEffort === undefined
            ? {}
            : { reasoningEffort: agent.options.reasoningEffort },
          ...tools === undefined ? {} : { tools },
          ...toolHistory === undefined ? {} : { toolHistory },
          maxTokens: MAX_TOKENS,
          // Reuse the session's own derived messages as the prefix. We only
          // append; the session log itself is never touched, so the main
          // conversation's cacheable prefix stays intact.
          messages: [
            ...history,
            {
              role: 'user',
              content: [{ type: 'text', text: buildPrompt(payload) }],
            },
          ],
        }))
        if (text === '') return { kind: 'error', text: '模型没有返回内容' }
        return { kind: 'success', text }
      } catch (error) {
        return {
          kind: 'error',
          text: error instanceof Error ? error.message : String(error),
        }
      }
    },
  })
}
