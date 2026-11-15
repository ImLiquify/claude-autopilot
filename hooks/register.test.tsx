import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import * as L from './logic'

const PLUGIN = 'autopilot'
const U = { input_tokens: 300, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 120, scroll: { offset: 0, bodyRows: 12 }, view: {} } as never } as const
const USAGE = (five: number) => `{"five_hour":{"utilization":${five},"resets_at":"2026-10-19T04:30:00+00:00"},"seven_day":{"utilization":74,"resets_at":"2026-10-22T06:00:00+00:00"}}`

type World = { turns?: number; seen?: { model: string; effort?: unknown }; tool: { result: string; text: string; isError: boolean }; ctx: number; answer: string; five: number; fetches: number; classified: number; down?: boolean; history: string[]; writes: string[]; commands: string[]; appended: string[]; submitted: string[]; graphRuns: string[]; cleanRuns: string[]; cleanOut: Record<string, unknown>; agents: string[]; hasGraph?: boolean; isRepo?: boolean; remote?: string; changelog?: string; handoffModel?: string; compactFocus?: string; store?: Record<string, unknown>; files: Record<string, string>; clock?: ReturnType<typeof mock.clock> }

async function boot($: Engine, on: On, w: Partial<World> = {}) {
  const world: World = { tool: { result: 'ok', text: 'ok', isError: false }, ctx: 1000, answer: 'NORMAL', five: 76, fetches: 0, classified: 0, history: [], writes: [], commands: [], appended: [], submitted: [], graphRuns: [], cleanRuns: [], cleanOut: {}, agents: [], hasGraph: true, files: {}, ...w }
  world.clock = mock.clock(on, { now: Date.parse('2026-10-19T02:00:00Z') })
  { // a store the test can change behind the mod's back, as another chat would
    const kv = (world.store ??= {})
    if (!('longAt' in kv) && !('long' in kv)) kv.longAt = 150_000 // these tests were written around "Later"; the default (100k) is checked in logic.test
    on('store.get', (_$, e) => ({ value: kv[e.key] }) as never)
    on('store.set', (_$, e) => ((kv[e.key] = e.value), { value: undefined }) as never)
  }
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: world.ctx, window: 200000 }, rateLimits: [] } }) as never)
  on('session.authorize', () => ({ value: { handle: 'h', kind: 'bearer' } }) as never)
  on('http.fetch', (_$, e) => String((e as { url?: string }).url).includes('raw.githubusercontent') ? { value: { status: world.remote ? 200 : 404, ok: !!world.remote, headers: {}, text: !world.remote ? '' : String((e as { url?: string }).url).endsWith('CHANGELOG.md') ? world.changelog ?? '' : `{"version":"${world.remote}"}` } } as never : (world.fetches++, { value: world.down ? { status: 429, ok: false, headers: {}, text: '' } : { status: 200, ok: true, headers: {}, text: USAGE(world.five) } }) as never)
  on('command.register', (_$, e) => ({ value: { command: e.name } }) as never)
  on('model.complete', (_$, e) => String(e.system).includes('handoff note')
    ? (world.handoffModel = e.model, { value: { isAnswered: true, text: 'TOPIC: Old login page\n## Done\n- built the login form', usage: U } }) as never
    : (world.classified++, { value: { isAnswered: true, text: world.answer, usage: U } }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('agent.register', (_$, e) => (world.agents.push(e.name), { value: { agent: `autopilot:${e.name}` } }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.log', () => ({ value: undefined }) as never)
  on('prompt.submit', (_$, e) => (world.submitted.push(e.text), { text: e.text }) as never)
  on('agent.spawn', (_$, e) => ({ model: e.model ?? 'x', agentId: 'a1' }) as never)
  on('session.start', () => ({ cwd: 'C:/demo' }) as never)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', () => ({ text: 'done' }) as never)
  on('session.turns', () => ({ value: world.turns ?? 3 }) as never)
  on('session.measure', (_$, e) => ({ changed: e.changed }) as never)
  on('session.messages', () => ({ value: world.history.map(text => ({ role: 'user', text, toolUses: [] })) }) as never)
  on('session.id', () => ({ value: 'old-session' }) as never)
  on('fs.write', (_$, e) => (world.writes.push(e.path), (world.files[e.path] = String((e as { text?: unknown }).text ?? (e as { content?: unknown }).content ?? '')), { value: undefined }) as never)
  on('fs.read', (_$, e) => ({ value: world.files[e.path] ?? Object.entries(world.files).find(([k]) => k.startsWith('*') && e.path.replace(/\\/g, '/').endsWith(k.slice(1)))?.[1] ?? (/plugin\.json$/.test(e.path) ? '{"version":"0.14.1"}' : undefined) }) as never)
  on('command.run', (_$, e) => (world.commands.push(e.command), { text: '' }) as never)
  on('session.compact', (_$, e) => (world.commands.push('compact'), (world.compactFocus = e.instructions), (world.ctx = 60_000), { messages: [{ role: 'user', text: 'summary', toolUses: [] }] }) as never)
  on('model.fork', () => (world.handoffModel = 'fork', { value: { isAnswered: true, text: 'TOPIC: Old login page\n## Done\n- built the login form', usage: U } }) as never)
  on('session.append', async (_$, e, next) => (world.appended.push(JSON.stringify(e.message)), next(e)))
  on('prompt.fill', () => ({ isFilled: true }) as never)
  on('session.cwd', () => ({ value: 'C:/xampp/htdocs/Demo' }) as never)
  on('fs.exists', (_$, e) => ({ value: /\.git$/.test(e.path) ? world.isRepo !== false : !!world.hasGraph }) as never)
  on('process.run', (_$, e) => {
    const clean = String(e.argv[1] ?? '').endsWith('clean.js')
    if (clean || e.argv[2] === 'uninstall') world.cleanRuns.push(e.argv.slice(clean ? 2 : 0).join(' '))
    else if (e.argv[0] !== 'node') world.graphRuns.push(`${e.argv.join(' ')} @ ${e.init?.cwd}`)
    return { value: { exitCode: 0, stdout: clean ? JSON.stringify(world.cleanOut[String(e.argv[2])] ?? {}) : '', stderr: '' } } as never
  })
  on('tool.call', () => world.tool as never)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'engine', scope: 'shared' }] }) as never)
  on('turn.step', async function* (_$, e) {
    world.seen = { model: e.model, effort: e.effort }
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [] } as never
  })
  await $.session.start({ source: 'startup', cwd: 'C:\\demo', surface: 'terminal', isInteractive: true } as never)
  last = world
  return world
}

let last: World
const say = ($: Engine, text: string, kind = 'composer') => $.prompt.submit({ text, origin: { kind }, wait: false } as never)
async function step($: Engine, effort = 'medium', model = 'claude-opus-5-5') {
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model, effort, messageCount: 1 } as never)) { /* drain */ }
  return last.seen!
}

test('Haiku picks model and effort; the run is exactly that pick', async ($, on) => {
  const w = await boot($, on, { answer: 'OPUS MEDIUM' })
  await say($, 'Review the subtle locking logic in the payment queue and tidy it')
  expect(await step($, 'max')).toEqual({ model: 'claude-opus-5-5', effort: 'medium' })
  w.answer = 'SONNET HIGH'
  await say($, 'Write tests for every endpoint in the users module please')
  // The chat's cache is on Opus: the effort follows the pick, the model does not move down mid-chat.
  expect(await step($, 'max')).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
})

test('a chat that starts on a routine job runs on Sonnet, and moves up when a later message needs Opus', async ($, on) => {
  const w = await boot($, on, { answer: 'SONNET MEDIUM' })
  await say($, 'Write tests for every endpoint in the users module please')
  expect(await step($, 'max')).toEqual({ model: 'claude-sonnet-5-5', effort: 'medium' })
  w.answer = 'OPUS HIGH'
  await say($, 'Plan the move of the billing service to the new queue')
  expect(await step($, 'max')).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
})

test('HEAVY prompt runs on Opus xhigh', async ($, on) => {
  await boot($, on, { answer: 'HEAVY' })
  await say($, 'Build a frame-by-frame WebGL particle animation for the landing page hero')
  expect(await step($, 'max')).toEqual({ model: 'claude-opus-5-5', effort: 'xhigh' })
})

test('max effort set later (or in another chat) caps a HEAVY route at high', async ($, on) => {
  const w = await boot($, on, { answer: 'HEAVY', store: {} })
  w.store!.maxEffort = 'high' // set in another chat after this one started
  await say($, 'Build a frame-by-frame WebGL particle animation for the landing page hero')
  expect(await step($, 'max')).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
})

test('NORMAL prompt runs on Sonnet medium; max is capped to xhigh even with routing off', async ($, on) => {
  await boot($, on, { answer: 'NORMAL' })
  await say($, 'Add a dark mode toggle to the settings page please')
  expect(await step($, 'max')).toEqual({ model: 'claude-sonnet-5-5', effort: 'medium' })
  await $.command.run({ command: 'route', args: 'off', origin: { kind: 'composer' } } as never)
  expect(await step($, 'max')).toEqual({ model: 'claude-opus-5-5', effort: 'xhigh' })
})

test('prefix override skips the check, short follow-ups are checked too, machine prompts are left alone', async ($, on) => {
  const w = await boot($, on, { answer: 'TRIVIAL' })
  await say($, '!opus rename this variable everywhere in the file')
  expect(await step($)).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
  expect(w.classified).toBe(0)
  await say($, 'yes go on')
  expect(w.classified).toBe(1)
  await say($, '<task-notification>done</task-notification> and some more text here')
  expect(w.classified).toBe(1)
})

test('search helpers go to Haiku; other helpers and named models keep theirs', async ($, on) => {
  await boot($, on)
  const spawn = async (a: object) => ((await $.agent.spawn({ description: 'd', prompt: 'x', ...a } as never)) as { model: string }).model
  expect(await spawn({ subagentType: 'Explore' })).toBe('claude-haiku-5-5')
  expect(await spawn({ subagentType: 'general-purpose' })).toBe('x')
  expect(await spawn({ subagentType: 'claude-code-guide' })).toBe('x')
  expect(await spawn({ subagentType: 'Explore', model: 'opus' })).toBe('opus')
})

test('escalation: the same command failing twice steps Sonnet medium up to Sonnet high', async ($, on) => {
  await boot($, on, { answer: 'NORMAL', tool: { result: 'fail', text: 'Error', isError: true } })
  await say($, 'Make the failing date parser tests pass please')
  await $.turn.start({ text: 'x', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  expect((await step($)).model).toBe('claude-sonnet-5-5')
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  expect(await step($, 'max')).toEqual({ model: 'claude-sonnet-5-5', effort: 'high' })
})

test('model lock: a long chat on Opus stays on Opus; effort still follows the task', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL', ctx: 160_000 })
  await say($, 'Check the claude-dashboard plugin for problems')
  expect(await step($)).toEqual({ model: 'claude-opus-5-5', effort: 'medium' })
  w.answer = 'TRIVIAL'
  await say($, 'What does the README say about the install command?')
  expect(await step($)).toEqual({ model: 'claude-opus-5-5', effort: 'medium' }) // low is not this person's own setting
})

test('model lock: a long Sonnet chat that needs Opus is shortened in place, then runs on Opus (no full cache re-write, no lost context)', async ($, on) => {
  const w = await boot($, on, { answer: 'SONNET MEDIUM', ctx: 125_000, history: ['Add the payments settings page'] })
  await say($, 'Add the payments settings page')
  expect((await step($, 'medium', 'claude-sonnet-5-5')).model).toBe('claude-sonnet-5-5')
  w.answer = 'OPUS HIGH'
  const r = await say($, 'Plan the architecture of the new payments service')
  expect(r).toMatchObject({ drop: expect.stringContaining('this chat was on Sonnet') })
  for (let i = 0; i < 50 && !w.submitted.includes('Plan the architecture of the new payments service'); i++) await w.clock!.advance(10)
  expect(w.commands).toEqual(['compact']) // same chat: never /clear
  expect(w.compactFocus).toContain('stated preferences')
  expect(await step($, 'max')).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
})

test('stuck mid-turn in a long chat: no pop-up to do it yourself, the next message shortens the chat and runs on Opus', async ($, on) => {
  const w = await boot($, on, { answer: 'SONNET HIGH', ctx: 145_000, history: ['Make the date parser tests pass'], tool: { result: 'fail', text: 'Error', isError: true } })
  await say($, 'Make the date parser tests pass')
  expect((await step($, 'high', 'claude-sonnet-5-5')).model).toBe('claude-sonnet-5-5')
  await $.turn.start({ text: 'x', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  expect((await step($, 'high', 'claude-sonnet-5-5')).model).toBe('claude-sonnet-5-5') // mid-turn: no 100k cache re-write
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'done', durationMs: 1, isAborted: false } as never)
  const r = await say($, 'ok try again')
  expect(r).toMatchObject({ drop: expect.stringContaining('this chat was on Sonnet') })
  for (let i = 0; i < 50 && !w.submitted.includes('ok try again'); i++) await w.clock!.advance(10)
  expect(w.commands).toEqual(['compact'])
  expect(await step($)).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
})

test('banner is live: the card is drawn and the numbers refresh every minute without typing', async ($, on) => {
  const w = await boot($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, ...BAND })
    expect(await ui.find({ key: 'banner' } as never)).toBeDefined()
    await ui.unmount()
  }
  const before = w.fetches
  await w.clock!.advance(30_000)
  expect(w.fetches).toBe(before + 1)
  await w.clock!.advance(15_000)
  expect(w.fetches).toBe(before + 1) // idle: the endpoint is read every 30 s
  await w.clock!.advance(15_000)
  expect(w.fetches).toBe(before + 2)
  w.down = true // the server says "too many requests": reads pause for two minutes
  await w.clock!.advance(30_000)
  const paused = w.fetches
  await w.clock!.advance(90_000)
  expect(w.fetches).toBe(paused)
})

test('each turn reads usage as it starts, the baseline for the chat share', async ($, on) => {
  const w = await boot($, on)
  const before = w.fetches
  await $.turn.start({ text: 'x', turnId: 't1' } as never)
  expect(w.fetches).toBeGreaterThan(before)
})

test('a new task in a long chat runs /compact with a short summary, never /clear, and the message continues', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL NEW', ctx: 150_000, history: ['Finish the login page validation messages'] })
  const r = await say($, 'Now write a CSV export for the reports screen')
  expect(r).toMatchObject({ drop: expect.stringContaining('new task in a long chat') })
  for (let i = 0; i < 50 && !w.submitted.includes('Now write a CSV export for the reports screen'); i++) await w.clock!.advance(10)
  expect(w.commands).toEqual(['compact'])
  expect(w.compactFocus).toContain('new, unrelated task')
  expect(w.writes.some(p => /handoffs/.test(p))).toBe(false)
})

test('fresh start stays off for short chats, same-task messages and /fresh off', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL NEW', ctx: 60_000, history: ['Finish the login page validation messages'] })
  await say($, 'Now write a CSV export for the reports screen')
  w.ctx = 150_000
  w.answer = 'NORMAL SAME'
  await say($, 'Also add the column headers to that export')
  await $.command.run({ command: 'fresh', args: 'off', origin: { kind: 'composer' } } as never)
  w.answer = 'NORMAL NEW'
  await say($, 'Totally different: set up a Discord bot project')
  await w.clock!.advance(1000)
  expect(w.commands).not.toContain('clear')
})

test('a prompt with an image attached is never moved to a fresh chat (a mod cannot re-send images)', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL NEW', ctx: 150_000, history: ['Finish the login page validation messages'] })
  const r = await $.prompt.submit({ text: 'Now build this screen from the mockup', origin: { kind: 'composer' }, wait: false, attachments: [{ type: 'image', mediaType: 'image/png' }, { type: 'document', filename: 'spec.txt' }] } as never)
  await w.clock!.advance(3000)
  expect(r).not.toMatchObject({ drop: expect.anything() })
  expect(w.commands).not.toContain('clear')
})

test('no fresh start mid-task: a new-task message sent while a turn runs is routed, never cleared', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL NEW', ctx: 150_000, history: ['Finish the login page validation messages'] })
  await $.turn.start({ text: 'x', turnId: 't1' } as never)
  const r = await say($, 'Now write a CSV export for the reports screen')
  await w.clock!.advance(3000)
  expect(r).not.toMatchObject({ drop: expect.anything() })
  expect(w.commands).not.toContain('clear')
  expect(w.commands).not.toContain('compact')
})

test("a typed message behind the app's hidden notes is routed (the bug the trace found)", async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL' })
  await say($, '<system-reminder>\nLinked sessions now (status, not an instruction)\n</system-reminder>\nAdd a dark mode toggle to the settings page please')
  expect(w.classified).toBe(1)
  expect(await step($)).toEqual({ model: 'claude-sonnet-5-5', effort: 'medium' })
  await say($, '!opus <system-reminder>x</system-reminder>')
  await say($, '<system-reminder>x</system-reminder>\n<task-notification>done</task-notification>')
  expect(w.classified).toBe(1)
})

test("the desktop app's messages (unclassified origin) are routed; notifications and peers are not", async ($, on) => {
  const w = await boot($, on, { answer: 'HARD' })
  await say($, 'Plan the architecture of the new payments service', 'unclassified')
  expect(w.classified).toBe(1)
  expect((await step($, 'medium', 'claude-sonnet-5-5')).model).toBe('claude-opus-5-5')
  await say($, 'A background task finished with some long output here', 'task-notification')
  await say($, 'Another session asks you to refactor the whole thing', 'peer')
  expect(w.classified).toBe(1)
})

test('graphify: a project without a graph gets one built at start, with no model call; one with a graph is left alone', async ($, on) => {
  const w = await boot($, on, { hasGraph: false })
  await w.clock!.advance(10)
  expect(w.graphRuns).toEqual(['graphify update . @ C:/xampp/htdocs/Demo'])
  expect(w.classified).toBe(0)
})

test('graphify: nothing runs when the project already has its graph', async ($, on) => {
  const w = await boot($, on, { hasGraph: true })
  await w.clock!.advance(10)
  expect(w.graphRuns).toEqual([])
})

test('usage is shared across chats: the highest reading in the window wins, a stale lower one never replaces it', async ($, on) => {
  const w = await boot($, on) // this chat's endpoint read: 76%
  await w.clock!.advance(5_000)
  const file = Object.keys(w.files).find(p => /usage\.json$/.test(p))!
  expect(JSON.parse(w.files[file]!).five.pct).toBe(76)
  // another chat spent more and read the endpoint 20 s after this one
  const t0 = Date.parse('2026-10-19T02:00:00Z')
  await w.clock!.advance(15_000)
  w.files[file] = JSON.stringify({ five: { pct: 90, resetsAt: '2026-10-19T04:30:00+00:00', at: t0 + 20_000 }, polledAt: t0 + 20_000 })
  w.five = 70 // a lagging figure: lower than what the other chat saw
  const before = w.fetches
  await w.clock!.advance(10_000) // 30 s since this chat's read, 10 s since the other's: no read needed
  expect(w.fetches).toBe(before)
  await w.clock!.advance(25_000) // now due: the endpoint answers 70, the shared 90 stands
  expect(w.fetches).toBe(before + 1)
  expect(JSON.parse(w.files[file]!).five.pct).toBe(90)
  expect(JSON.parse(w.files[file]!).five.at).toBe(t0 + 20_000) // its read time is kept, so the banner can say how old it is
})

test('an expensive chat waits for a new task: a correction stays, the next new task moves', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL SAME', ctx: 190_000, history: ['Swap the sweet and sour photo on the menu'] })
  await $.turn.start({ text: 'x', turnId: 't1' } as never)
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'done', durationMs: 1, isAborted: false } as never)
  const r = await say($, 'you did not change it, the one on the website is still the old photo')
  await w.clock!.advance(3000)
  expect(r).not.toMatchObject({ drop: expect.anything() })
  expect(w.commands).not.toContain('clear')
  w.answer = 'NORMAL NEW'
  const r2 = await say($, 'Now write a CSV export for the reports screen')
  expect(r2).toMatchObject({ drop: expect.stringContaining('new task in a long chat') })
})

test('a prompt naming an image the app attached as text stays in the chat', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL NEW', ctx: 150_000, history: ['Finish the login page validation messages'] })
  const r = await say($, 'Use this photo for the hero [Image: source: C:\Temp\images\1.png]')
  await w.clock!.advance(3000)
  expect(r).not.toMatchObject({ drop: expect.anything() })
  expect(w.commands).not.toContain('clear')
})

test('main replies never run on Haiku: a HAIKU answer runs on Sonnet low', async ($, on) => {
  await boot($, on, { answer: 'HAIKU LOW' })
  await say($, 'Fix the typo in the footer: Copyrigth')
  expect(await step($, 'low')).toEqual({ model: 'claude-sonnet-5-5', effort: 'low' })
})

test('Max effort is the only ceiling: Claude Code set to low does not hold a high pick down', async ($, on) => {
  await boot($, on, { store: { maxEffort: 'high' }, answer: 'OPUS HIGH' })
  await say($, 'Plan the new payments service')
  expect(await step($, 'low')).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
  await say($, '!extra Now the heaviest version')
  expect(await step($, 'low')).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
})

test('start size is per chat: a 95k first reply counts as 0k, so the model does not lock', async ($, on) => {
  const store: Record<string, unknown> = {}
  const w = await boot($, on, { store, turns: 1, answer: 'SONNET MEDIUM', ctx: 95_000 })
  await $.session.measure({ context: { tokens: 95_000, window: 200_000 }, rateLimits: [], changed: ['context'] } as never)
  expect(store.base).toBe(95_000)
  await say($, 'Add a settings page')
  expect(await step($)).toEqual({ model: 'claude-sonnet-5-5', effort: 'medium' })
  w.ctx = 120_000 // 25k of growth: still free
  w.answer = 'OPUS MEDIUM'
  await say($, 'Plan the billing rewrite')
  expect((await step($)).model).toBe('claude-opus-5-5')
})

test('a big first reply does not raise the start size: the smallest start seen is kept, so its extra counts as chat', async ($, on) => {
  const store: Record<string, unknown> = { base: 60_000 }
  const w = await boot($, on, { store, turns: 1, answer: 'OPUS MEDIUM', ctx: 110_000 })
  await $.session.measure({ context: { tokens: 110_000, window: 200_000 }, rateLimits: [], changed: ['context'] } as never)
  expect(store.base).toBe(60_000)
  await say($, 'Plan the billing rewrite')
  expect((await step($)).model).toBe('claude-opus-5-5')
  w.answer = 'SONNET MEDIUM'
  await say($, 'Add a settings page')
  expect((await step($)).model).toBe('claude-opus-5-5') // 50k of chat: locked, no switch that re-writes the cache
})

test('a reopened chat keeps the last measured start size', async ($, on) => {
  const store: Record<string, unknown> = { base: 60_000 }
  await boot($, on, { store, ctx: 120_000 })
  await $.session.measure({ context: { tokens: 120_000, window: 200_000 }, rateLimits: [], changed: ['context'] } as never)
  expect(store.base).toBe(60_000)
})

test('a cold cache frees the model: over an hour away it may leave Opus, under an hour it stays locked', async ($, on) => {
  const w = await boot($, on, { answer: 'OPUS HIGH', ctx: 45_000, history: ['Plan the rewrite'] })
  await say($, 'Plan the rewrite')
  await step($)
  w.ctx = 100_000 // 55k of chat: locked
  await $.turn.start({ text: 'x', turnId: 't1' } as never)
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'done', durationMs: 1, isAborted: false } as never)
  w.answer = 'SONNET LOW SAME'
  await w.clock!.advance(1_800_000)
  await say($, 'Rename the helper in that file')
  expect((await step($)).model).toBe('claude-opus-5-5')
  await w.clock!.advance(1_800_001 + 1_800_000)
  await say($, 'Rename the other helper as well')
  expect((await step($)).model).toBe('claude-sonnet-5-5')
})

test('a typed /compact frees the model for the next message, once', async ($, on) => {
  const w = await boot($, on, { answer: 'OPUS HIGH', ctx: 45_000, history: ['Plan the rewrite'] })
  await say($, 'Plan the rewrite')
  await step($)
  w.ctx = 100_000
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'x', toolUses: [] }] } as never)
  w.ctx = 100_000 // still past the lock after the summary
  w.answer = 'SONNET LOW SAME'
  await say($, 'Rename the helper in that file')
  expect((await step($)).model).toBe('claude-sonnet-5-5')
  w.answer = 'OPUS HIGH SAME'
  await say($, 'Rename the other helper as well')
  expect(await step($)).toEqual({ model: 'claude-sonnet-5-5', effort: 'high' })
})

test('moving up in a long chat shortens it in place, then runs on the new model', async ($, on) => {
  const w = await boot($, on, { answer: 'SONNET MEDIUM', history: ['Restart the dev server'] })
  await say($, 'Restart the dev server')
  expect((await step($)).model).toBe('claude-sonnet-5-5')
  w.answer = 'OPUS HIGH'
  w.ctx = 125_000 // 80k of chat: locked, so a switch would re-write it all
  const r = await say($, 'Now work out why the checkout total is wrong after a coupon')
  expect(r).toMatchObject({ drop: expect.stringContaining('this chat was on Sonnet') })
  for (let i = 0; i < 50 && !w.submitted.includes('Now work out why the checkout total is wrong after a coupon'); i++) await w.clock!.advance(10)
  expect(w.commands).toEqual(['compact'])
  expect(await step($, 'max')).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
})

test('coding team: three agent types are registered and /team hands the goal to the chat', async ($, on) => {
  const w = await boot($, on)
  for (let i = 0; i < 20 && w.agents.length < 3; i++) await w.clock!.advance(10) // set up in the background
  expect(w.agents.slice(0, 3)).toEqual(['builder', 'tester', 'reviewer'])
  const r = await $.command.run({ command: 'team', args: 'add a CSV export' } as never)
  expect((r as { text?: string }).text).toBe('Coding team started on: add a CSV export')
  await w.clock!.advance(400)
  expect(w.submitted.at(-1)).toContain('autopilot:reviewer with the goal')
  expect(w.submitted.at(-1)).toContain('add a CSV export')
})

test('to-dos: a card under the bar, opened with a click; a tick saves for every chat', async ($, on) => {
  const w = await boot($, on, { store: {} })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  expect((await ui.find({ type: 'Button', key: 'todo-bar' } as never))?.props.label).toBe('▸  To-Do List') // shown empty, so ＋ is always there
  expect(await ui.find({ type: 'Button', key: 'todo-add' } as never)).toBeDefined()
  await $.command.run({ command: 'todo', args: 'reply to Sam' } as never)
  expect((await ui.find({ type: 'Button', key: 'todo-bar' } as never))?.props.label).toBe('▸  To-Do List · 1 left')
  expect(await ui.find({ type: 'Button', key: 't0' } as never)).toBeUndefined() // collapsed
  await ui.press({ key: 'todo-bar' } as never)
  expect((await ui.find({ type: 'Button', key: 'todo-bar' } as never))?.props.label).toBe('▾  To-Do List')
  await ui.press({ key: 't0' } as never)
  expect((await ui.find({ type: 'Button', key: 't0' } as never))?.props.label).toBe('●')
  expect((await ui.find({ type: 'Text', text: /reply to Sam/ } as never))?.props.strikethrough).toBe(true)
  expect(w.store!.todos).toEqual([{ text: 'reply to Sam', done: true }])
  w.store!.todos = [{ text: 'reply to Sam', done: true }, { text: 'added in another chat', done: false }]
  await w.clock!.advance(5_000) // the 5 s tick picks up another chat's change
  expect((await ui.find({ type: 'Button', key: 't1' } as never))?.props.label).toBe('○')
  await ui.unmount()
})

test('Claude flags a to-do as done: the card opens with a dot and a reason, the person ticks it or says not yet', async ($, on) => {
  const w = await boot($, on, { store: { todos: [{ text: 'Log book', done: false }] } })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  const listed = await $.tool.call({ tool: 'mcp__autopilot__todo', action: 'list' } as never)
  expect(JSON.stringify(listed)).toContain('1. [ ] Log book')
  await $.tool.call({ tool: 'mcp__autopilot__todo', action: 'suggest_done', item: 1, why: 'the log book page is committed' } as never)
  expect(w.store!.todos).toEqual([{ text: 'Log book', done: false, suggested: 'the log book page is committed' }])
  expect(await ui.find({ type: 'Button', key: 'n0' } as never)).toBeDefined() // open, with Not yet
  await ui.press({ key: 'n0' } as never)
  expect(w.store!.todos).toEqual([{ text: 'Log book', done: false }])
  await ui.unmount()
})

test('the gear shows the effort buttons in the same row, with no drawing swapped in; picking one closes them', async ($, on) => {
  const w = await boot($, on, { store: {} })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await ui.press({ key: 'gear' } as never)
  expect(await ui.findAll({ type: 'Svg' } as never)).toHaveLength(1) // only the bar's card, nothing swapped in
  await ui.press({ key: 'high' } as never)
  expect(await ui.find({ type: 'Button', key: 'high' } as never)).toBeUndefined()
  expect(w.store!.maxEffort).toBe('high')
  await ui.unmount()
})

test('the switch turns Autopilot off: the card goes, prompts and steps are left alone, and it turns back on', async ($, on) => {
  const w = await boot($, on, { store: {}, answer: 'OPUS HIGH' })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await ui.press({ key: 'power' } as never)
  expect(w.store!.off).toBe(true)
  expect(await ui.findAll({ type: 'Svg' } as never)).toHaveLength(0) // the card is gone, the switch stays
  const before = w.classified
  await say($, 'Refactor the payment queue locking and add tests for it')
  expect(w.classified).toBe(before)
  expect(await step($, 'medium', 'claude-sonnet-5-5')).toEqual({ model: 'claude-sonnet-5-5', effort: 'medium' })
  await ui.press({ key: 'power' } as never)
  expect(w.store!.off).toBe(false)
  expect(await ui.findAll({ type: 'Svg' } as never)).toHaveLength(1)
  await ui.unmount()
})

test('a very long chat on the same task is shortened in place with /compact, never cleared, and the message continues', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL SAME', ctx: 250_000, history: ['Finish the login page validation messages'] })
  const r = await say($, 'Now make the error text red under each field')
  expect(r).toMatchObject({ drop: expect.stringContaining('passed 150k') })
  for (let i = 0; i < 50 && !w.submitted.includes('Now make the error text red under each field'); i++) await w.clock!.advance(10)
  expect(w.commands).toEqual(['compact'])
  expect(w.handoffModel).toBeUndefined() // no note: the chat keeps its own summary
})

test('the long-chat limit can be turned off in settings', async ($, on) => {
  const w = await boot($, on, { store: { long: 'off' }, answer: 'NORMAL SAME', ctx: 250_000, history: ['Finish the login page validation messages'] })
  const r = await say($, 'Now make the error text red under each field')
  await w.clock!.advance(1000)
  expect(r).not.toMatchObject({ drop: expect.anything() })
  expect(w.commands).not.toContain('clear')
})

test('settings: ⚙ beside ＋ opens a card of On/Off options and sizes, saved for every chat; reset puts the defaults back', async ($, on) => {
  const w = await boot($, on, { store: {} })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Button', key: 'p-ask-b' } as never)).toBeUndefined()
  await ui.press({ key: 'prefs' } as never)
  expect((await ui.find({ type: 'Button', key: 'p-ask-b' } as never))?.props.label).toBe('○ Off') // automatic by default
  expect((await ui.find({ type: 'Button', key: 'p-stepup-b' } as never))?.props.label).toBe('● On')
  await ui.press({ key: 'p-ask-b' } as never)
  expect(w.store!.ask).toBe('on')
  expect((await ui.find({ type: 'Button', key: 'longAt-150000' } as never))?.props.label).toBe('✓ Later')
  await ui.press({ key: 'longAt-0' } as never)
  expect(w.store!.longAt).toBe(0)
  expect((await ui.find({ type: 'Button', key: 'longAt-0' } as never))?.props.label).toBe('✓ Never')
  await ui.press({ key: 'p-route-b' } as never)
  expect(w.store!.mode).toBe('off')
  await ui.press({ key: 'reset-b' } as never)
  expect(w.store).toMatchObject({ ask: 'off', longAt: 100_000, mode: 'auto', maxEffort: 'xhigh' })
  await ui.press({ key: 'prefs-done' } as never)
  expect(await ui.find({ type: 'Button', key: 'p-ask-b' } as never)).toBeUndefined()
  await ui.unmount()
})

test('ask first: a card waits; Keep going sends the message here, nothing is compacted', async ($, on) => {
  const w = await boot($, on, { store: { ask: 'on' }, answer: 'NORMAL NEW', ctx: 150_000, history: ['Finish the login page validation messages'] })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  const r = await say($, 'Now write a CSV export for the reports screen')
  expect(r).toMatchObject({ drop: expect.stringContaining('suggests shortening') })
  await w.clock!.advance(1000)
  expect(w.commands).toEqual([])
  await ui.press({ key: 'keep' } as never)
  await w.clock!.advance(100)
  expect(w.submitted).toContain('Now write a CSV export for the reports screen')
  expect(w.commands).toEqual([])
  expect(await ui.find({ type: 'Button', key: 'keep' } as never)).toBeUndefined()
  await ui.unmount()
})

test('ask first also covers the move up: a Shorten card, nothing compacted; Keep going here runs it on Opus in this chat', async ($, on) => {
  const w = await boot($, on, { store: { ask: 'on' }, answer: 'SONNET MEDIUM', ctx: 125_000, history: ['Add the payments settings page'] })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await say($, 'Add the payments settings page')
  await step($, 'medium', 'claude-sonnet-5-5')
  w.answer = 'OPUS HIGH'
  const r = await say($, 'Plan the architecture of the new payments service')
  expect(r).toMatchObject({ drop: expect.stringContaining('suggests shortening') })
  await w.clock!.advance(1000)
  expect(w.commands).toEqual([])
  expect(await ui.find({ type: 'Text', text: /this chat was on Sonnet/ } as never)).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'fresh' } as never)).toMatchObject({ props: { label: 'Shorten' } })
  await ui.press({ key: 'keep' } as never)
  await w.clock!.advance(100)
  expect(w.submitted).toContain('Plan the architecture of the new payments service') // re-sent by the mod, so not routed again
  expect(w.commands).toEqual([])
  expect(await step($, 'max', 'claude-sonnet-5-5')).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
  await ui.unmount()
})

test('ask first, Shorten: the chat is compacted in place and the message continues', async ($, on) => {
  const w = await boot($, on, { store: { ask: 'on' }, answer: 'NORMAL SAME', ctx: 250_000, history: ['Finish the login page validation messages'] })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await say($, 'Now make the error text red under each field')
  await ui.press({ key: 'fresh' } as never)
  for (let i = 0; i < 50 && !w.submitted.includes('Now make the error text red under each field'); i++) await w.clock!.advance(10)
  expect(w.commands).toEqual(['compact'])
  await ui.unmount()
})

test('ask first, new task: Shorten compacts with the short summary', async ($, on) => {
  const w = await boot($, on, { store: { ask: 'on' }, answer: 'NORMAL NEW', ctx: 150_000, history: ['Finish the login page validation messages'] })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await say($, 'Now write a CSV export for the reports screen')
  await ui.press({ key: 'fresh' } as never)
  for (let i = 0; i < 50 && !w.submitted.includes('Now write a CSV export for the reports screen'); i++) await w.clock!.advance(10)
  expect(w.commands).toEqual(['compact'])
  expect(w.compactFocus).toContain('new, unrelated task')
  await ui.unmount()
})

test('settings sizes: a new-task fresh start set to Never stays in the chat', async ($, on) => {
  const w = await boot($, on, { store: { freshAt: 0 }, answer: 'NORMAL NEW', ctx: 150_000, history: ['Finish the login page validation messages'] })
  const r = await say($, 'Now write a CSV export for the reports screen')
  await w.clock!.advance(1000)
  expect(r).not.toMatchObject({ drop: expect.anything() })
  expect(w.commands).not.toContain('clear')
})

test('settings: search helpers keep their model and stuck turns stay put when those are off', async ($, on) => {
  await boot($, on, { store: { helpers: 'off', stepup: 'off' }, answer: 'NORMAL', tool: { result: 'fail', text: 'Error: date parser broke on leap years', isError: true } })
  expect(((await $.agent.spawn({ description: 'd', prompt: 'x', subagentType: 'Explore' } as never)) as { model: string }).model).toBe('x')
  await say($, 'Make the failing date parser tests pass please')
  await $.turn.start({ text: 'x', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  expect(await step($)).toEqual({ model: 'claude-sonnet-5-5', effort: 'medium' })
})

test('graphify: skipped in a folder that is not a repository and has no map', async ($, on) => {
  const w = await boot($, on, { hasGraph: false, isRepo: false })
  await w.clock!.advance(10)
  expect(w.graphRuns).toEqual([])
})

test('graphify: in a repository graphify-out/ goes in the local git ignore list', async ($, on) => {
  const exclude = 'C:\\xampp\\htdocs\\Demo\\.git\\info\\exclude' // the engine hands paths over in the system's own form
  const w = await boot($, on, { hasGraph: false, files: { [exclude]: '# local ignores\n' } })
  await w.clock!.advance(10)
  expect(w.graphRuns).toEqual(['graphify update . @ C:/xampp/htdocs/Demo'])
  expect(w.files[exclude]).toBe('# local ignores\ngraphify-out/\n')
})

test('update notice: a newer version on GitHub shows Update, which runs the plugin update; same version shows nothing', async ($, on) => {
  const w = await boot($, on, { store: {}, remote: '0.15.0' })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await w.clock!.advance(10)
  expect(await ui.find({ type: 'Text', text: /Autopilot 0\.15\.0 is out/ } as never)).toBeDefined()
  await ui.press({ key: 'do-update' } as never)
  expect(w.graphRuns.some(r => r.startsWith('claude plugin update autopilot@autopilot'))).toBe(true)
  expect(await ui.find({ type: 'Button', key: 'do-update' } as never)).toBeUndefined()
  await ui.unmount()
})

test('update notice: What\'s new lists the changelog since this version; a copy pinned to an old release is unpinned by Update', async ($, on) => {
  const settings = '{\n  "extraKnownMarketplaces": {\n    "autopilot": {\n      "source": {\n        "source": "github",\n        "repo": "ImLiquify/claude-autopilot",\n        "ref": "v0.14.0"\n      }\n    }\n  }\n}'
  const w = await boot($, on, { store: {}, remote: '0.15.0', changelog: '# Changelog\n\n## 0.15.0\n- Shows what changed\n\n## 0.14.1\n- Already installed\n', files: { '*/.claude/settings.json': settings } })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await w.clock!.advance(10)
  expect(await ui.find({ type: 'Text', text: /Shows what changed/ } as never)).toBeUndefined()
  await ui.press({ key: 'whats-new' } as never)
  expect(await ui.find({ type: 'Text', text: /Shows what changed/ } as never)).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Already installed/ } as never)).toBeUndefined()
  await ui.press({ key: 'do-update' } as never)
  const written = Object.entries(w.files).find(([k]) => !k.startsWith('*') && k.replace(/\\/g, '/').endsWith('.claude/settings.json'))?.[1] ?? ''
  expect(written).not.toContain('"ref"')
  expect(JSON.parse(written).extraKnownMarketplaces.autopilot.source).toEqual({ source: 'github', repo: 'ImLiquify/claude-autopilot' })
  expect(w.graphRuns.some(r => r.startsWith('claude plugin marketplace add ImLiquify/claude-autopilot'))).toBe(true)
  expect(w.graphRuns.some(r => r.startsWith('claude plugin update autopilot@autopilot'))).toBe(true)
  await ui.unmount()
})

test('plugins only when asked: other plugins\' skills are listed by name, start-up texts are cut, and the setting turns it off', async ($, on) => {
  on('prompt.attachment', (_$, e) => ({ text: (e as { text: string }).text }) as never)
  const w = await boot($, on)
  const listing = '- graphify: Use for any codebase question\n- agent-skills:build: Implement tasks incrementally\n- agent-skills:spec: Write a spec\n  more about spec\n- anthropic-skills:docs: Docs are the default\n- productivity:start'
  const r = await $.prompt.attachment({ type: 'skill_listing', text: listing, origin: { kind: 'engine' } } as never) as { text: string }
  expect(r.text).toContain('- graphify: Use for any codebase question')
  expect(r.text).toContain('- anthropic-skills:docs: Docs are the default')
  expect(r.text).toContain('- agent-skills: build, spec')
  expect(r.text).toContain('- productivity: start')
  expect(r.text).not.toContain('Implement tasks')
  expect(r.text).not.toContain('more about spec')
  const start = 'The user started this session without a folder.\n<EXTREMELY_IMPORTANT>\nYou have superpowers.\nlong text\n</EXTREMELY_IMPORTANT>'
  expect(await $.prompt.attachment({ type: 'hook_additional_context', text: start, origin: { kind: 'hook', event: 'SessionStart' } } as never)).toEqual({ text: 'The user started this session without a folder.' })
  expect(await $.prompt.attachment({ type: 'hook_success', text: 'PONYTAIL MODE ACTIVE — level: full\n\n# Ponytail\nrules\n\n## Levels\n\n| Level | Behavior |\n|-------|----------|\n| **full** | Default. |', origin: { kind: 'hook', event: 'SessionStart' } } as never)).toEqual({ text: null })
  w.store!.onDemand = 'off'
  expect(await $.prompt.attachment({ type: 'skill_listing', text: listing, origin: { kind: 'engine' } } as never)).toEqual({ text: listing })
})

test('no update notice when GitHub has the same version or updates are turned off', async ($, on) => {
  const w = await boot($, on, { store: { updates: 'off' }, remote: '0.15.0' })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await w.clock!.advance(10)
  expect(await ui.find({ type: 'Button', key: 'do-update' } as never)).toBeUndefined()
  await ui.unmount()
})

test('past 150k even "yes" moves, with no Haiku call', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL SAME', ctx: 400_000, history: ['Finish the login page validation messages'] })
  const before = w.classified
  const r = await say($, 'yes')
  expect(r).toMatchObject({ drop: expect.stringContaining('passed 150k') })
  expect(w.classified).toBe(before)
  for (let i = 0; i < 50 && !w.commands.includes('compact'); i++) await w.clock!.advance(10)
  expect(w.commands).toEqual(['compact'])
})

test('/why shows the pick for the last message; near a limit one warning is recorded for the window', async ($, on) => {
  const w = await boot($, on, { answer: 'OPUS MEDIUM', five: 85 })
  await say($, 'Rewrite the about section so it sounds more professional')
  for (let i = 0; i < 20; i++) await w.clock!.advance(10)
  const r = await $.command.run({ command: 'why', args: '' } as never)
  expect((r as { text: string }).text).toContain('"Rewrite the about section so it sounds more professional" → Opus · medium')
  expect(typeof w.store!['warned-five']).toBe('string')
})

test('no limit warning when it is turned off in settings', async ($, on) => {
  const w = await boot($, on, { store: { warn: 'off' }, five: 85 })
  for (let i = 0; i < 20; i++) await w.clock!.advance(10)
  expect(w.store!['warned-five']).toBeUndefined()
})

test('add-ons: graphify is offered once at first run and installed only on a press; Ponytail is never installed; Settings shows why each model was picked', async ($, on) => {
  const w = await boot($, on, { store: {}, hasGraph: false }) // graphify is not in ~/.local/bin
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await w.clock!.advance(10)
  expect((await ui.find({ type: 'Button', key: 'addons-yes' } as never))?.props.label).toBe('Install graphify')
  expect(w.graphRuns.some(r => r.includes('graphifyy'))).toBe(false)
  await ui.press({ key: 'addons-yes' } as never)
  expect(w.graphRuns.some(r => r.startsWith('uv tool install graphifyy'))).toBe(true)
  expect(w.graphRuns.some(r => r.includes('ponytail'))).toBe(false)
  expect(w.writes.some(p => /CLAUDE\.md$/.test(p))).toBe(false) // the rule goes in the system prompt, not the person's file
  expect(w.store!.addonsSeen).toBe(true)
  expect(await ui.find({ type: 'Button', key: 'addons-yes' } as never)).toBeUndefined()
  await ui.press({ key: 'prefs' } as never)
  await ui.press({ key: 'why-b' } as never)
  expect(await ui.find({ type: 'Text', text: /No model picks logged/ } as never)).toBeDefined()
  await ui.unmount()
})

test('Ponytail turned on shows a Turn off row that disables it only on a press', async ($, on) => {
  const w = await boot($, on, {})
  w.files['*/.claude/settings.json'] = '{"enabledPlugins":{"ponytail@ponytail": true}}'
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await ui.press({ key: 'prefs' } as never)
  for (let i = 0; i < 5; i++) await w.clock!.advance(10)
  expect(w.graphRuns.some(r => r.includes('ponytail'))).toBe(false)
  await ui.press({ key: 'ponytail-off' } as never)
  expect(w.graphRuns.some(r => r.startsWith('claude plugin disable ponytail@ponytail'))).toBe(true)
  await ui.unmount()
})

const compose = async ($: Engine, _on: On) => {
  return ((await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as never)) as { sections: { id: string; text: string; scope: string }[] }).sections
}

test('every chat gets the Lean code rule after the engine\'s prompt; the map rule only where a map exists', async ($, on) => {
  await boot($, on, { hasGraph: true })
  const s = await compose($, on)
  expect(s.map(x => x.id)).toEqual(['intro', 'autopilot:lean', 'autopilot:graph'])
  expect(s[1]!.scope).toBe('session')
  expect(s[1]!.text).toContain('Writing, advice, design and explanations')
})

test('no rules when Lean code is off and there is no map', async ($, on) => {
  await boot($, on, { store: { lean: 'off' }, hasGraph: false })
  expect((await compose($, on)).map(x => x.id)).toEqual(['intro'])
})

test('no map rule when CLAUDE.md already has one', async ($, on) => {
  const w = await boot($, on, { hasGraph: true, files: { ['*/.claude/CLAUDE.md']: '## graphify\nrules' } })
  expect((await compose($, on)).map(x => x.id)).toEqual(['intro', 'autopilot:lean'])
  void w
})

const endTurn = async ($: Engine, w: { clock?: { advance: (ms: number) => Promise<unknown> } }) => {
  await $.turn.start({ text: 'x', turnId: 't1' } as never)
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'done', durationMs: 1, isAborted: false } as never)
  for (let i = 0; i < 150; i++) await w.clock!.advance(10)
}

test('a long chat is shortened when the turn ends, with nothing re-sent; a chat that stays big is not shortened again', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL SAME', ctx: 200_000 })
  await endTurn($, w)
  expect(w.commands).toEqual(['compact'])
  expect(w.compactFocus).toContain('Keep everything')
  expect(w.submitted).toEqual([])
  w.ctx = 200_000 // the summary did not help
  await endTurn($, w)
  await endTurn($, w)
  expect(w.commands).toEqual(['compact'])
})

test('no end-of-turn shorten in a short chat, with "ask first" on, or when the turn was stopped', async ($, on) => {
  const w = await boot($, on, { store: { ask: 'on' }, answer: 'NORMAL SAME', ctx: 200_000 })
  await endTurn($, w)
  w.store!.ask = 'off'
  w.ctx = 100_000
  await endTurn($, w)
  w.ctx = 200_000
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: '', durationMs: 1, isAborted: true } as never)
  for (let i = 0; i < 150; i++) await w.clock!.advance(10)
  expect(w.commands).toEqual([])
})

test('minimize: Minimize leaves the crab and ring with an Expand button, remembered; Expand brings the full card back', async ($, on) => {
  const store: Record<string, unknown> = {}
  const w = await boot($, on, { store })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await w.clock!.advance(10)
  expect(await ui.find({ type: 'Button', key: 'expand' } as never)).toBeUndefined()
  await ui.press({ key: 'mini' } as never)
  expect(await ui.find({ type: 'Button', key: 'expand' } as never)).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'power' } as never)).toBeUndefined()
  expect(store.mini).toBe(true)
  await ui.press({ key: 'expand' } as never)
  expect(await ui.find({ type: 'Button', key: 'power' } as never)).toBeDefined()
  expect(store.mini).toBe(false)
  await ui.unmount()
})

test('Clean: scan shows findings, turn off runs only on a press, and delete asks first', async ($, on) => {
  const scan = { items: [
    { id: 'skill:shadcn', kind: 'skill', name: 'shadcn', reason: 'not used in 30 days', tokens: 125, pick: true },
    { id: 'plugin:old@mkt', kind: 'plugin', name: 'old', reason: 'not used in 30 days', tokens: 300, pick: true },
    { id: 'skill:impeccable', kind: 'skill', name: 'impeccable', reason: 'duplicate', tokens: 151, pick: false },
  ], notes: ['x runs on every chat'], names: ['shadcn'], claudeMd: '# rules' }
  const w = await boot($, on, { store: {}, cleanOut: { scan } })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await ui.press({ key: 'prefs' } as never)
  await ui.press({ key: 'clean-b' } as never)
  expect(w.cleanRuns).toEqual(['scan lean']) // plugins are listed by name only, so the scan counts names, not descriptions
  expect((await ui.find({ type: 'Button', key: 'off' } as never))?.props.label).toBe('Turn off 2') // the duplicate still in use is not ticked
  await ui.press({ key: 'off' } as never)
  expect(w.cleanRuns[1]).toBe('off ["skill:shadcn","plugin:old@mkt"]')
  expect(w.cleanRuns.some(r => r.startsWith('claude'))).toBe(false) // nothing deleted yet
  await ui.press({ key: 'del' } as never)
  expect(w.cleanRuns.slice(2)).toEqual(['claude plugin uninstall old@mkt', 'delete ["skill:shadcn","plugin:old@mkt"]'])
})

test('Clean: Keep turned off deletes nothing; /clean restore runs the undo', async ($, on) => {
  const w = await boot($, on, { store: {}, cleanOut: { scan: { items: [{ id: 'skill:a', kind: 'skill', name: 'a', reason: 'r', tokens: 1, pick: true }], notes: [], names: [], claudeMd: '' }, restore: { restored: 1 } } })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await ui.press({ key: 'prefs' } as never)
  await ui.press({ key: 'clean-b' } as never)
  await ui.press({ key: 'off' } as never)
  await ui.press({ key: 'keep' } as never)
  expect(w.cleanRuns).toEqual(['scan lean', 'off ["skill:a"]'])
  const r = await $.command.run({ command: 'clean', args: 'restore' } as never)
  expect(String((r as { text?: string }).text)).toContain('Turned back on: 1')
})

test('Clean: the full check shows this month\'s chats, suggests changes, and Fix with Claude hands them to the chat', async ($, on) => {
  const scan = { items: [], notes: ['The memory index M is about 3k tokens.'], names: [], claudeMd: '', stats: { chats: 10, start: 82_315, long: 6 } }
  const w = await boot($, on, { store: { longAt: 150_000 }, cleanOut: { scan } })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await ui.press({ key: 'prefs' } as never)
  await ui.press({ key: 'clean-b' } as never)
  expect(await ui.find({ type: 'Text', text: /about 82k tokens, and 6 went past 150k/ } as never)).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'off' } as never)).toBeFalsy() // nothing to turn off
  await ui.press({ key: 'fix' } as never)
  for (let i = 0; i < 20 && !w.submitted.length; i++) await w.clock!.advance(10)
  const sent = w.submitted.at(-1) ?? ''
  expect(sent).toContain('wait for my yes before changing anything')
  expect(sent).toContain('- The memory index M is about 3k tokens.')
  expect(sent).toContain('Set "Shorten a chat when it gets long" to Sooner') // 6 of 10 chats went long and shortening is set to Later
})

// ---------- Hand-off: long jobs go to a helper with its own small chat
const handUse = { input_tokens: 2000, output_tokens: 8000, cache_read_input_tokens: 600_000, cache_creation_input_tokens: 60_000 }
const helperRun = async ($: Engine, type: string, steps: number, usage: object) => {
  await $.agent.spawn({ description: 'd', prompt: 'x', subagentType: type } as never)
  for (let i = 0; i < steps; i++) for await (const _ of $.turn.step({ turnId: 'h1', index: i, model: 'claude-sonnet-5-5', effort: 'medium', messageCount: 1, agentId: 'a1' } as never)) { /* drain */ }
  await $.turn.complete({ turnId: 'h1', agentId: 'a1', reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, usage: { ...usage, model: 'claude-sonnet-5-5' } } as never)
}

test('hand-off: a long job in a big chat gets the helper note; a normal message, a small Opus-helper job and a message with files do not', async ($, on) => {
  const w = await boot($, on, { answer: 'OPUS HIGH WORKER', ctx: 140_000 })
  for (let i = 0; i < 20 && w.agents.length < 5; i++) await w.clock!.advance(10)
  expect(w.agents).toEqual(['builder', 'tester', 'reviewer', 'worker', 'expert'])
  await say($, 'Rename every component file in src to kebab-case and fix all the imports')
  expect(w.submitted.at(-1)).toContain('Spawn autopilot:worker')
  expect(w.submitted.at(-1)).toContain('Rename every component file')
  w.answer = 'OPUS MEDIUM SOLO'
  await say($, 'What do you think of the naming in this module, is it clear enough?')
  expect(w.submitted.at(-1)).not.toContain(L.HAND_MARK)
  w.answer = 'OPUS HIGH EXPERT'
  await say($, 'Audit the whole billing project for security problems and report')
  expect(w.submitted.at(-1)).toContain('Spawn autopilot:expert')
  await $.prompt.submit({ text: 'Compile all of these into one report', origin: { kind: 'composer' }, wait: false, attachments: [{ kind: 'image' }] } as never)
  expect(w.submitted.at(-1)).not.toContain(L.HAND_MARK)
})

test('hand-off: a small chat hands off to the cheaper worker only, and the setting turns it off', async ($, on) => {
  const w = await boot($, on, { answer: 'OPUS HIGH EXPERT', ctx: 50_000 })
  await say($, 'Audit the whole billing project for security problems and report')
  expect(w.submitted.at(-1)).not.toContain(L.HAND_MARK) // same model, small chat: nothing to save
  w.answer = 'OPUS HIGH WORKER'
  await say($, 'Build a complete snake game with menus, levels and a high score table')
  expect(w.submitted.at(-1)).toContain('Spawn autopilot:worker')
  w.store!.hand = 'off'
  await say($, 'Build a complete tetris game with menus, levels and a high score table')
  expect(w.submitted.at(-1)).not.toContain(L.HAND_MARK)
})

test('hand-off: each helper is measured against doing the work in the chat, and five losing ones pause hand-offs', async ($, on) => {
  const w = await boot($, on, { answer: 'OPUS HIGH WORKER', ctx: 140_000 })
  await say($, 'Rename every component file in src to kebab-case and fix all the imports')
  await step($)
  await helperRun($, 'autopilot:worker', 30, handUse)
  const t = w.store!.handTally as L.HandTally
  expect(t.n).toBe(1)
  expect(t.saved).toBeGreaterThan(1) // 30 steps not re-reading a 140k Opus chat, at Sonnet prices
  expect(t.paused).toBe(false)
  // Five one-step jobs: the helper's start-up is never paid back.
  for (let i = 0; i < 5; i++) await helperRun($, 'autopilot:worker', 1, { input_tokens: 100, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 10_000 })
  expect((w.store!.handTally as L.HandTally).paused).toBe(true)
  await say($, 'Convert every page in the docs folder from HTML to Markdown')
  expect(w.submitted.at(-1)).not.toContain(L.HAND_MARK)
})

test('/delegate hands the job to the chat with the helper note, once', async ($, on) => {
  const w = await boot($, on, { answer: 'OPUS HIGH WORKER', ctx: 140_000 })
  const r = await $.command.run({ command: 'delegate', args: 'sort the downloads folder by file type' } as never)
  expect((r as { text?: string }).text).toBe('Handing off: sort the downloads folder by file type')
  await w.clock!.advance(400)
  const sent = w.submitted.at(-1)!
  expect(sent).toContain('sort the downloads folder by file type')
  expect(sent.split(L.HAND_MARK).length).toBe(2)
})

test('shortening keeps the files the user gave', async ($, on) => {
  const w = await boot($, on, { ctx: 400_000 })
  await say($, 'Now write a CSV export for the reports screen')
  for (let i = 0; i < 50 && !w.compactFocus; i++) await w.clock!.advance(10)
  expect(w.compactFocus).toContain('every file, image or document the user gave or named')
})
