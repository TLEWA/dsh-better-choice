import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

async function exists(relative) {
  try {
    await stat(join(root, relative))
    return true
  } catch {
    return false
  }
}

async function loadHost() {
  return import(pathToFileURL(join(root, 'lib/index.js')).href)
}

function makeAgent(overrides = {}) {
  let derived = 0
  const agent = {
    id: 'parent-agent',
    options: { provider: 'deepseek', model: 'deepseek-chat', reasoningEffort: 'high', maxTokens: 64_000 },
    session: {
      header: { id: 'parent-agent' },
      deriveMessages: () => {
        derived += 1
        return []
      },
    },
    ...overrides,
  }
  return { agent, derived: () => derived }
}

function makeHarness(result = { stopReason: 'completed', output: [{ type: 'text', text: 'Use option B.' }] }, { defer = false, failStart = false, drain = false, flat = false } = {}) {
  const activations = []
  const disposals = []
  const drainCalls = []
  let registered
  let guardFn
  let effectCleanup
  let startResolve
  let resolveResult
  const started = new Promise(resolve => { startResolve = resolve })
  const resultPromise = defer
    ? new Promise(resolve => { resolveResult = resolve })
    : Promise.resolve(result)
  const ctx = {
    commands: {
      register(definition) {
        registered = definition
      },
    },
    tools: {
      guard(fn) {
        guardFn = fn
        return () => { effectCleanup = 'guard-released' }
      },
    },
    effect(setup) {
      effectCleanup = setup()
    },
    subagents: {
      getProvider(name) {
        return name === 'fork' ? { inheritsParentContext: true } : undefined
      },
      async startActivation(spec) {
        activations.push(spec)
        startResolve()
        if (failStart) throw new Error('submit failed after materialize')
        return {
          result: resultPromise,
          async dispose() {
            disposals.push(spec.childId)
          },
        }
      },
      ...(flat
        ? {
            // 0.2.2-rc.2 exposes the named-subagent API; no drainChildren.
            resolveName() {},
            // Must never be used for a single failed child on a shared root.
            async drainDescendants(...args) {
              drainCalls.push({ parent: undefined, childIds: [], descendants: args })
            },
          }
        : {}),
      ...(drain
        ? {
            async drainChildren(parent, childIds) {
              drainCalls.push({ parent, childIds: [...childIds] })
            },
          }
        : {}),
    },
  }
  return {
    ctx,
    activations,
    disposals,
    drainCalls,
    started,
    resolve(value = result) { resolveResult?.(value) },
    get registered() { return registered },
    get guardFn() { return guardFn },
    get effectCleanup() { return effectCleanup },
  }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const payload = {
  question: 'Which option keeps the old endpoint?',
  activeIndex: 1,
  questions: [
    {
      title: 'Pick a migration path',
      header: 'Migration',
      detail: 'Choose how traffic moves.',
      options: [
        { label: 'Option A', description: 'Move everything at once' },
        { label: 'Option B', description: 'Keep the old endpoint' },
      ],
      selected: ['Option B'],
      notes: { 'Option A': 'too risky', 'Option B': 'keep the old endpoint' },
      custom: '',
    },
    {
      title: 'Rollback plan',
      header: 'Safety',
      multiSelect: true,
      options: [{ label: 'Keep a backup' }, { label: 'Skip rollback' }],
      selected: ['Keep a backup'],
      notes: { 'Skip rollback': 'not needed' },
      custom: 'test after deploy',
    },
  ],
  thread: [{ question: 'What does option B do?', answer: 'It keeps the old endpoint.' }],
}

test('package metadata is publishable', async () => {
  assert.equal(packageJson.name, 'dsh-better-choice')
  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/)
  assert.equal(packageJson.type, 'module')
  assert.equal(packageJson.main, 'lib/index.js')
  assert.equal(packageJson.license, 'MIT')
  assert.equal(packageJson.publishConfig?.access, 'public')
  assert.match(packageJson.description, /ask_user_question|question/i)
  assert.ok(Array.isArray(packageJson.keywords) && packageJson.keywords.length >= 8)
  assert.ok(Number(packageJson.engines?.node?.replace('>=', '')) >= 20)
  assert.match(packageJson.repository.url, /github\.com\/TLEWA\/dsh-better-choice/)
})

test('dsh manifest points at committed artifacts', async () => {
  assert.equal(packageJson.dsh?.manifestVersion, 1)
  assert.equal(packageJson.dsh?.bundle?.patch, './cordis.patch.yml')
  assert.equal(packageJson.dsh?.client?.platform, 'web')

  const inject = packageJson.dsh?.client?.inject ?? []
  for (const required of [
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-api-remotes',
  ]) {
    assert.ok(inject.includes(required), `missing client inject: ${required}`)
  }

  for (const file of [
    'lib/index.js',
    'lib/client.js',
    'cordis.patch.yml',
    'README.md',
    'README.en.md',
    'LICENSE',
    'NOTICE.md',
    'NOTICE.en.md',
    'assets/icon-180.png',
  ]) {
    assert.ok(await exists(file), `missing file: ${file}`)
  }

  const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /id:\s*better-choice/)
  assert.match(patch, /name:\s*'dsh-better-choice'/)
})

test('client artifact is a ModuleLoader module for this package', async () => {
  const client = await readFile(join(root, 'lib/client.js'), 'utf8')
  assert.match(client, /window\.__ModuleLoader__\.load\(/)
  assert.match(client, /id:\s*"dsh-better-choice"/)
  assert.match(client, /factory:\s*\(require\)\s*=>/)
  assert.match(client, /conversation\.composer/)
  assert.match(client, /bc-ask/)
})

test('host artifact exports a Cordis plugin', async () => {
  const host = await loadHost()
  assert.equal(host.name, 'better-choice')
  assert.deepEqual(host.inject, ['commands', 'subagents', 'tools'])
  assert.equal(typeof host.apply, 'function')
})

test('bc-ask starts one fork child with only a trailing user prompt', async () => {
  const host = await loadHost()
  const harness = makeHarness(undefined, { defer: true })
  const { agent, derived } = makeAgent()
  host.apply(harness.ctx)
  assert.equal(harness.registered?.name, 'bc-ask')
  assert.equal(harness.registered?.recordInput, false)
  assert.equal(typeof harness.effectCleanup, 'function')

  const pending = harness.registered.handler({
    agent,
    rawInput: JSON.stringify(payload),
    signal: new AbortController().signal,
  })
  await harness.started

  assert.equal(harness.activations.length, 1)
  const spec = harness.activations[0]
  assert.equal(spec.provider, 'fork')
  assert.equal(spec.delivery, 'caller')
  assert.match(spec.childId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  assert.equal(spec.request.parent, agent)
  assert.deepEqual(spec.request.agentOptions, { maxTokens: 32_000 })
  assert.equal(spec.request.prompt.length, 1)
  assert.equal(spec.request.prompt[0].type, 'text')
  assert.equal('tools' in spec.request, false)
  assert.equal('system' in spec.request, false)
  assert.equal('toolHistory' in spec.request, false)
  assert.equal(derived(), 0, 'the host must not project the parent session itself')

  const prompt = spec.request.prompt[0].text
  assert.match(prompt, /【旁问模式】/)
  assert.match(prompt, /【问题 1\/2】/)
  assert.match(prompt, /【问题 2\/2】（当前正在看）/)
  assert.match(prompt, /类型：多选/)
  assert.match(prompt, /\[已选\] Option B：Keep the old endpoint（备注：keep the old endpoint）/)
  assert.match(prompt, /\[未选\] Option A：Move everything at once（备注：too risky）/)
  assert.match(prompt, /\[已选\] Keep a backup/)
  assert.match(prompt, /\[未选\] Skip rollback（备注：not needed）/)
  assert.match(prompt, /自定义输入：test after deploy/)
  assert.match(prompt, /【之前的旁问】/)
  assert.match(prompt, /What does option B do\?/)
  assert.match(prompt, /It keeps the old endpoint\./)
  assert.match(prompt, /【用户的旁问】\nWhich option keeps the old endpoint\?/)

  assert.match(harness.guardFn({ agent: { id: spec.childId } }), /禁止执行任何工具/)
  assert.match(harness.guardFn({ agent: { session: { id: spec.childId } } }), /禁止执行任何工具/)
  assert.equal(harness.guardFn({ agent }), undefined)

  harness.resolve()
  // Wait for the handler to finish, then check the guard was released.
  const response = await pending
  assert.equal(response.kind, 'success')
  assert.equal(response.text, 'Use option B.')
  assert.deepEqual(harness.disposals, [spec.childId])
  assert.equal(harness.guardFn({ agent: { id: spec.childId } }), undefined)
  assert.equal(harness.guardFn({ agent }), undefined)
})

test('bc-ask uses the flat activation spec on 0.2.2-rc.2 hosts', async () => {
  const host = await loadHost()
  const harness = makeHarness(undefined, { flat: true })
  const { agent, derived } = makeAgent()
  host.apply(harness.ctx)

  const response = await harness.registered.handler({
    agent,
    rawInput: JSON.stringify({ question: 'which option?' }),
    signal: new AbortController().signal,
  })

  assert.equal(response.kind, 'success')
  assert.equal(response.text, 'Use option B.')
  const spec = harness.activations[0]
  assert.equal(spec.provider, 'fork')
  assert.equal(spec.delivery, 'caller')
  assert.equal(spec.parent, agent)
  assert.deepEqual(spec.agentOptions, { maxTokens: 32_000 })
  assert.equal(spec.prompt.length, 1)
  assert.equal(spec.prompt[0].type, 'text')
  assert.match(spec.prompt[0].text, /【旁问模式】/)
  // rc.2 flattens parent/prompt/agentOptions and has no nested request.
  assert.equal('request' in spec, false)
  // Omit name: concurrent side questions must not collide on a child name.
  assert.equal('name' in spec, false)
  assert.equal(derived(), 0, 'the host must not project the parent session itself')
  assert.deepEqual(harness.disposals, [spec.childId])
  assert.equal(harness.guardFn({ agent: { id: spec.childId } }), undefined)
})

test('bc-ask numbers consecutive side-question turns', async () => {
  const host = await loadHost()
  const harness = makeHarness()
  const { agent } = makeAgent()
  host.apply(harness.ctx)

  await harness.registered.handler({
    agent,
    rawInput: JSON.stringify({
      question: 'and now?',
      questions: [payload.questions[0]],
      thread: [
        { question: 'first', answer: 'one' },
        { question: 'second', answer: 'two' },
        { question: 'third', answer: 'three' },
      ],
    }),
    signal: new AbortController().signal,
  })

  const prompt = harness.activations[0].request.prompt[0].text
  assert.match(prompt, /1\. 问：first/)
  assert.match(prompt, /2\. 问：second/)
  assert.match(prompt, /3\. 问：third/)
  assert.doesNotMatch(prompt, /5\. 问：/)
})

test('bc-ask maps the active question by its original wire position', async () => {
  const host = await loadHost()
  const harness = makeHarness()
  const { agent } = makeAgent()
  host.apply(harness.ctx)

  await harness.registered.handler({
    agent,
    rawInput: JSON.stringify({
      question: 'which one?',
      activeIndex: 1,
      // The first entry is unusable, so the batch the model sees is [Alpha, Beta];
      // the client's activeIndex still points at Alpha on the wire.
      questions: ['junk', { title: 'Alpha' }, { title: 'Beta' }],
    }),
    signal: new AbortController().signal,
  })

  const prompt = harness.activations[0].request.prompt[0].text
  assert.match(prompt, /【问题 1\/2】（当前正在看）\n标题：Alpha/)
  assert.match(prompt, /【问题 2\/2】\n标题：Beta/)
})

test('bc-ask tells the model which question the user skipped', async () => {
  const host = await loadHost()
  const harness = makeHarness()
  const { agent } = makeAgent()
  host.apply(harness.ctx)

  await harness.registered.handler({
    agent,
    rawInput: JSON.stringify({
      question: 'why?',
      questions: [{ title: 'Skipped one', skipped: true }],
    }),
    signal: new AbortController().signal,
  })

  assert.match(
    harness.activations[0].request.prompt[0].text,
    /状态：用户暂时跳过了这道题/,
  )
})

test('bc-ask keeps a started-but-failed child guarded', async () => {
  const host = await loadHost()
  const harness = makeHarness(undefined, { failStart: true })
  const { agent } = makeAgent()
  host.apply(harness.ctx)

  const response = await harness.registered.handler({
    agent,
    rawInput: JSON.stringify({ question: 'why?' }),
    signal: new AbortController().signal,
  })

  assert.equal(response.kind, 'error')
  assert.match(response.text, /旁问失败/)
  const childId = harness.activations[0].childId
  // startLocal may have materialized the child before submit threw; the tool
  // guard must stay armed for it even though no activation came back.
  assert.match(harness.guardFn({ agent: { id: childId } }), /禁止执行任何工具/)
  assert.deepEqual(harness.disposals, [])
})

test('bc-ask keeps an rc.2 start failure guarded without draining the root', async () => {
  const host = await loadHost()
  const harness = makeHarness(undefined, { failStart: true, flat: true })
  const { agent } = makeAgent()
  host.apply(harness.ctx)

  const response = await harness.registered.handler({
    agent,
    rawInput: JSON.stringify({ question: 'why?' }),
    signal: new AbortController().signal,
  })

  assert.equal(response.kind, 'error')
  assert.match(response.text, /旁问失败/)
  const childId = harness.activations[0].childId
  // rc.2 has no per-child drain. drainDescendants would stop the shared root's
  // whole subtree, so the id must stay owned and the guard must fail closed.
  assert.match(harness.guardFn({ agent: { id: childId } }), /禁止执行任何工具/)
  assert.deepEqual(harness.disposals, [])
  assert.deepEqual(harness.drainCalls, [])
})

test('bc-ask reports incomplete, aborted, and empty child results', async () => {
  const host = await loadHost()
  const { agent } = makeAgent()

  const errorHarness = makeHarness({
    stopReason: 'error',
    output: [{ type: 'text', text: 'partial answer' }],
  })
  host.apply(errorHarness.ctx)
  const errorResponse = await errorHarness.registered.handler({
    agent,
    rawInput: JSON.stringify({ question: 'why?' }),
    signal: new AbortController().signal,
  })
  assert.equal(errorResponse.kind, 'error')
  assert.match(errorResponse.text, /未完成（error）/)
  assert.match(errorResponse.text, /partial answer/)

  const maxHarness = makeHarness({ stopReason: 'max-tokens', output: [] })
  host.apply(maxHarness.ctx)
  const maxResponse = await maxHarness.registered.handler({
    agent,
    rawInput: JSON.stringify({ question: 'why?' }),
    signal: new AbortController().signal,
  })
  assert.equal(maxResponse.kind, 'error')
  assert.match(maxResponse.text, /达到上限/)

  const emptyHarness = makeHarness({ stopReason: 'completed', output: [] })
  host.apply(emptyHarness.ctx)
  const emptyResponse = await emptyHarness.registered.handler({
    agent,
    rawInput: JSON.stringify({ question: 'why?' }),
    signal: new AbortController().signal,
  })
  assert.equal(emptyResponse.kind, 'error')
  assert.match(emptyResponse.text, /没有返回内容/)
})

test('bc-ask rejects missing fork support and pre-aborted invocations', async () => {
  const host = await loadHost()
  const { agent } = makeAgent()
  let registered
  let starts = 0
  host.apply({
    commands: { register(definition) { registered = definition } },
    tools: { guard() { return () => {} } },
    subagents: {
      getProvider() { return undefined },
      async startActivation() { starts += 1; throw new Error('must not start') },
    },
  })
  const noFork = await registered.handler({
    agent,
    rawInput: JSON.stringify({ question: 'hello' }),
    signal: new AbortController().signal,
  })
  assert.equal(noFork.kind, 'error')
  assert.match(noFork.text, /fork/)
  assert.equal(starts, 0)

  const harness = makeHarness()
  host.apply(harness.ctx)
  const aborted = await harness.registered.handler({
    agent,
    rawInput: JSON.stringify({ question: 'hello' }),
    signal: AbortSignal.abort(),
  })
  assert.equal(aborted.kind, 'error')
  assert.match(aborted.text, /取消/)
  assert.equal(harness.activations.length, 0)
})

test('bc-ask rejects malformed and empty requests', async () => {
  const host = await loadHost()
  const harness = makeHarness()
  const { agent } = makeAgent()
  host.apply(harness.ctx)
  const base = { agent, signal: new AbortController().signal }

  const malformed = await harness.registered.handler({ ...base, rawInput: '{not json' })
  assert.equal(malformed.kind, 'error')

  const empty = await harness.registered.handler({ ...base, rawInput: JSON.stringify({ question: '   ' }) })
  assert.equal(empty.kind, 'error')

  const noAgent = await harness.registered.handler({
    rawInput: JSON.stringify({ question: 'hello' }),
    signal: new AbortController().signal,
  })
  assert.equal(noAgent.kind, 'error')
  assert.equal(harness.activations.length, 0)
})

test('bc-ask stops waiting and releases the child when the invocation is cancelled', async () => {
  const host = await loadHost()
  const harness = makeHarness(undefined, { defer: true })
  const { agent } = makeAgent()
  host.apply(harness.ctx)
  const controller = new AbortController()

  const pending = harness.registered.handler({
    agent,
    rawInput: JSON.stringify({ question: 'why?' }),
    signal: controller.signal,
  })
  await harness.started
  const childId = harness.activations[0].childId
  assert.match(harness.guardFn({ agent: { id: childId } }), /禁止执行任何工具/)

  controller.abort()
  const response = await Promise.race([pending, delay(500).then(() => 'timeout')])
  assert.notEqual(response, 'timeout', 'the handler must stop waiting once the invocation aborts')
  assert.equal(response.kind, 'error')
  assert.match(response.text, /取消/)
  assert.deepEqual(harness.disposals, [childId])
  assert.equal(harness.guardFn({ agent: { id: childId } }), undefined)
})

test('bc-ask keeps a completed answer when cancellation arrives before it is consumed', async () => {
  const host = await loadHost()
  const harness = makeHarness(undefined, { defer: true })
  const { agent } = makeAgent()
  host.apply(harness.ctx)
  const controller = new AbortController()

  const pending = harness.registered.handler({
    agent,
    rawInput: JSON.stringify({ question: 'why?' }),
    signal: controller.signal,
  })
  await harness.started
  harness.resolve()
  controller.abort()

  const response = await pending
  assert.equal(response.kind, 'success')
  assert.equal(response.text, 'Use option B.')
  assert.deepEqual(harness.disposals, [harness.activations[0].childId])
})

test('bc-ask releases a child that materialized before startActivation threw', async () => {
  const host = await loadHost()
  const harness = makeHarness(undefined, { failStart: true, drain: true })
  const { agent } = makeAgent()
  host.apply(harness.ctx)

  const response = await harness.registered.handler({
    agent,
    rawInput: JSON.stringify({ question: 'why?' }),
    signal: new AbortController().signal,
  })

  assert.equal(response.kind, 'error')
  assert.match(response.text, /旁问失败/)
  const childId = harness.activations[0].childId
  // No activation handle came back, so dispose cannot reach the child; the
  // service-level drain must release the reserved child id instead.
  assert.deepEqual(harness.disposals, [])
  assert.equal(harness.drainCalls.length, 1)
  assert.equal(harness.drainCalls[0].parent, agent)
  assert.deepEqual(harness.drainCalls[0].childIds, [childId])
  assert.equal(harness.guardFn({ agent: { id: childId } }), undefined)
})

test('bc-ask never reads notes through Object.prototype', async () => {
  const host = await loadHost()
  const harness = makeHarness()
  const { agent } = makeAgent()
  host.apply(harness.ctx)

  await harness.registered.handler({
    agent,
    rawInput: JSON.stringify({
      question: 'which one?',
      questions: [{
        title: 'Prototype keys',
        options: [{ label: 'constructor' }, { label: 'toString' }],
        selected: ['constructor'],
      }],
    }),
    signal: new AbortController().signal,
  })

  const prompt = harness.activations[0].request.prompt[0].text
  assert.match(prompt, /\[已选\] constructor/)
  assert.doesNotMatch(prompt, /native code/)
  assert.doesNotMatch(prompt, /备注/)
})
