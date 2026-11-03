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

test('package metadata is publishable', async () => {
  assert.equal(packageJson.name, 'dsh-better-choice')
  assert.equal(packageJson.version, '1.0.0')
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
  const host = await import(pathToFileURL(join(root, 'lib/index.js')).href)
  assert.equal(host.name, 'better-choice')
  assert.deepEqual(host.inject, ['commands', 'llm'])
  assert.equal(typeof host.apply, 'function')
})

test('bc-ask streams a side answer without mutating the session', async () => {
  const host = await import(pathToFileURL(join(root, 'lib/index.js')).href)
  let registered
  const streamCalls = []
  const ctx = {
    commands: {
      register(definition) {
        registered = definition
      },
    },
    llm: {
      stream(options) {
        streamCalls.push(options)
        return (async function* () {
          yield { type: 'text-delta', text: 'Use option B. ' }
          yield { type: 'text-delta', text: 'It keeps the old endpoint.' }
          yield { type: 'finish', reason: 'stop' }
        })()
      },
    },
  }
  host.apply(ctx)
  assert.equal(registered?.name, 'bc-ask')

  const history = [
    { role: 'system', content: [{ type: 'text', text: 'system prompt' }] },
    { role: 'user', content: [{ type: 'text', text: 'earlier request' }] },
    {
      role: 'assistant',
      content: [{ type: 'tool-call', toolName: 'ask_user_question' }],
    },
  ]
  const tools = [{ name: 'read_file' }]
  const toolHistory = [{ name: 'read_file', calls: 1 }]
  const response = await registered.handler({
    agent: {
      options: { provider: 'deepseek', model: 'deepseek-chat', reasoningEffort: 'high' },
      session: {
        deriveMessages: () => history,
        requestHeader: () => ({ tools }),
        toolHistory: () => toolHistory,
      },
    },
    rawInput: JSON.stringify({
      question: 'Which option is safer?',
      card: {
        title: 'Pick a migration path',
        options: [{ label: 'Option A' }, { label: 'Option B' }],
        selected: ['Option B'],
        notes: { 'Option B': 'keep the old endpoint' },
      },
    }),
    signal: new AbortController().signal,
  })

  assert.equal(response.kind, 'success')
  assert.equal(response.text, 'Use option B. It keeps the old endpoint.')
  assert.equal(streamCalls.length, 1)

  const options = streamCalls[0]
  assert.equal(options.provider, 'deepseek')
  assert.equal(options.model, 'deepseek-chat')
  assert.equal(options.reasoningEffort, 'high')
  assert.equal(options.maxTokens, 700)
  assert.deepEqual(options.tools, tools)
  assert.deepEqual(options.toolHistory, toolHistory)
  assert.equal(options.messages.length, 3)
  assert.deepEqual(options.messages[0], history[0])
  assert.deepEqual(options.messages[1], history[1])
  const sideMessage = options.messages[2]
  assert.equal(sideMessage.role, 'user')
  assert.match(sideMessage.content[0].text, /Which option is safer\?/)
  assert.match(sideMessage.content[0].text, /Option B/)
  assert.match(sideMessage.content[0].text, /keep the old endpoint/)
  assert.equal(history.length, 3, 'session history must not be mutated')
})

test('bc-ask rejects malformed and empty requests', async () => {
  const host = await import(pathToFileURL(join(root, 'lib/index.js')).href)
  let registered
  host.apply({
    commands: { register(definition) { registered = definition } },
    llm: { stream() { throw new Error('must not be called') } },
  })
  const base = {
    agent: { options: { provider: 'p', model: 'm' }, session: { deriveMessages: () => [] } },
    signal: new AbortController().signal,
  }

  const malformed = await registered.handler({ ...base, rawInput: '{not json' })
  assert.equal(malformed.kind, 'error')

  const empty = await registered.handler({ ...base, rawInput: JSON.stringify({ question: '   ' }) })
  assert.equal(empty.kind, 'error')

  const noRoute = await registered.handler({
    ...base,
    agent: { options: {}, session: { deriveMessages: () => [] } },
    rawInput: JSON.stringify({ question: 'hello' }),
  })
  assert.equal(noRoute.kind, 'error')
})
