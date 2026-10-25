import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PLUGIN = 'autopilot'
const U = { input_tokens: 300, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 120, scroll: { offset: 0, bodyRows: 12 }, view: {} } as never } as const
const USAGE = (five: number) => `{"five_hour":{"utilization":${five},"resets_at":"2026-10-19T04:30:00+00:00"},"seven_day":{"utilization":74,"resets_at":"2026-10-22T06:00:00+00:00"}}`

type World = { seen?: { model: string; effort?: unknown }; tool: { result: string; text: string; isError: boolean }; ctx: number; answer: string; five: number; fetches: number; classified: number; down?: boolean; history: string[]; writes: string[]; commands: string[]; appended: string[]; submitted: string[]; graphRuns: string[]; agents: string[]; hasGraph?: boolean; remote?: string; handoffModel?: string; store?: Record<string, unknown>; files: Record<string, string>; clock?: ReturnType<typeof mock.clock> }

async function boot($: Engine, on: On, w: Partial<World> = {}) {
  const world: World = { tool: { result: 'ok', text: 'ok', isError: false }, ctx: 1000, answer: 'NORMAL', five: 76, fetches: 0, classified: 0, history: [], writes: [], commands: [], appended: [], submitted: [], graphRuns: [], agents: [], hasGraph: true, files: {}, ...w }
  world.clock = mock.clock(on, { now: Date.parse('2026-10-19T02:00:00Z') })
  if (!world.store) mock.store(on)
  else { // a store the test can change behind the mod's back, as another chat would
    const kv = world.store
    on('store.get', (_$, e) => ({ value: kv[e.key] }) as never)
    on('store.set', (_$, e) => ((kv[e.key] = e.value), { value: undefined }) as never)
  }
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: world.ctx, window: 200000 }, rateLimits: [] } }) as never)
  on('session.authorize', () => ({ value: { handle: 'h', kind: 'bearer' } }) as never)
  on('http.fetch', (_$, e) => String((e as { url?: string }).url).includes('raw.githubusercontent') ? { value: { status: world.remote ? 200 : 404, ok: !!world.remote, headers: {}, text: world.remote ? `{"version":"${world.remote}"}` : '' } } as never : (world.fetches++, { value: world.down ? { status: 429, ok: false, headers: {}, text: '' } : { status: 200, ok: true, headers: {}, text: USAGE(world.five) } }) as never)
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
  on('session.turns', () => ({ value: 3 }) as never)
  on('session.messages', () => ({ value: world.history.map(text => ({ role: 'user', text, toolUses: [] })) }) as never)
  on('session.id', () => ({ value: 'old-session' }) as never)
  on('fs.write', (_$, e) => (world.writes.push(e.path), (world.files[e.path] = String((e as { text?: unknown }).text ?? (e as { content?: unknown }).content ?? '')), { value: undefined }) as never)
  on('fs.read', (_$, e) => ({ value: world.files[e.path] ?? (/plugin\.json$/.test(e.path) ? '{"version":"0.14.1"}' : undefined) }) as never)
  on('command.run', (_$, e) => (world.commands.push(e.command), { text: '' }) as never)
  on('session.append', async (_$, e, next) => (world.appended.push(JSON.stringify(e.message)), next(e)))
  on('prompt.fill', () => ({ isFilled: true }) as never)
  on('session.cwd', () => ({ value: 'C:/xampp/htdocs/Demo' }) as never)
  on('fs.exists', () => ({ value: !!world.hasGraph }) as never)
  on('process.run', (_$, e) => (e.argv[0] === 'node' || world.graphRuns.push(`${e.argv.join(' ')} @ ${e.init?.cwd}`), { value: { exitCode: 0, stdout: '', stderr: '' } }) as never)
  on('tool.call', () => world.tool as never)
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

test('Haiku picks the effort; the model never drops below Opus', async ($, on) => {
  const w = await boot($, on, { answer: 'OPUS MEDIUM' })
  await say($, 'Review the subtle locking logic in the payment queue and tidy it')
  expect(await step($, 'max')).toEqual({ model: 'claude-opus-5-5', effort: 'medium' })
  w.answer = 'SONNET HIGH'
  await say($, 'Write tests for every endpoint in the users module please')
  expect(await step($, 'max')).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
})

test('HEAVY prompt runs on Opus xhigh', async ($, on) => {
  await boot($, on, { answer: 'HEAVY' })
  await say($, 'Build a frame-by-frame WebGL particle animation for the landing page hero')
  expect(await step($)).toEqual({ model: 'claude-opus-5-5', effort: 'xhigh' })
})

test('max effort set later (or in another chat) caps a HEAVY route at high', async ($, on) => {
  const w = await boot($, on, { answer: 'HEAVY', store: {} })
  w.store!.maxEffort = 'high' // set in another chat after this one started
  await say($, 'Build a frame-by-frame WebGL particle animation for the landing page hero')
  expect(await step($)).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
})

test('NORMAL prompt runs on Opus medium; max is capped to xhigh even with routing off', async ($, on) => {
  await boot($, on, { answer: 'NORMAL' })
  await say($, 'Add a dark mode toggle to the settings page please')
  expect(await step($, 'max')).toEqual({ model: 'claude-opus-5-5', effort: 'medium' })
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

test('helper subagents keep their own model (no Haiku downgrade)', async ($, on) => {
  await boot($, on)
  const r = await $.agent.spawn({ subagentType: 'Explore', description: 'find files', prompt: 'x' } as never)
  expect((r as { model: string }).model).toBe('x')
})

test('escalation: the same command failing twice steps Opus medium up to Opus high', async ($, on) => {
  await boot($, on, { answer: 'NORMAL', tool: { result: 'fail', text: 'Error', isError: true } })
  await say($, 'Make the failing date parser tests pass please')
  await $.turn.start({ text: 'x', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  expect((await step($)).model).toBe('claude-opus-5-5')
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  expect(await step($, 'max')).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
})

test('model lock: a 330k chat on Opus stays on Opus; effort still follows the task', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL', ctx: 375_000 })
  await say($, 'Check the claude-dashboard plugin for problems')
  expect(await step($)).toEqual({ model: 'claude-opus-5-5', effort: 'medium' })
  w.answer = 'TRIVIAL'
  await say($, 'What does the README say about the install command?')
  expect(await step($)).toEqual({ model: 'claude-opus-5-5', effort: 'low' })
})

test('model lock: a long Sonnet chat moves up to Opus', async ($, on) => {
  await boot($, on, { answer: 'HARD', ctx: 245_000 })
  await say($, 'Plan the architecture of the new payments service')
  expect((await step($, 'medium', 'claude-sonnet-5-5')).model).toBe('claude-opus-5-5')
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

test('fresh start: a new task in a long chat saves a note, clears to a fresh chat and re-sends the message', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL NEW', ctx: 150_000, history: ['Finish the login page validation messages'] })
  const r = await say($, 'Now write a CSV export for the reports screen')
  expect(r).toMatchObject({ drop: expect.stringContaining('fresh chat') })
  for (let i = 0; i < 50 && !w.submitted.includes('Now write a CSV export for the reports screen'); i++) await w.clock!.advance(10)
  expect(w.writes.some(p => /handoffs[\\/].*old-login-page\.md$/.test(p))).toBe(true)
  expect(w.commands).toContain('clear')
  expect(w.appended.some(a => a.includes('Handoff note from the previous chat') && a.includes('claude --resume old-session'))).toBe(true)
  expect(w.submitted).toContain('Now write a CSV export for the reports screen')
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
  expect(await step($)).toEqual({ model: 'claude-opus-5-5', effort: 'medium' })
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
  expect(r2).toMatchObject({ drop: expect.stringContaining('fresh chat') })
})

test('a prompt naming an image the app attached as text stays in the chat', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL NEW', ctx: 150_000, history: ['Finish the login page validation messages'] })
  const r = await say($, 'Use this photo for the hero [Image: source: C:\Temp\images\1.png]')
  await w.clock!.advance(3000)
  expect(r).not.toMatchObject({ drop: expect.anything() })
  expect(w.commands).not.toContain('clear')
})

test('even the simplest prompts (Haiku says HAIKU LOW) run on Opus, at low', async ($, on) => {
  await boot($, on, { answer: 'HAIKU LOW' })
  await say($, 'Fix the typo in the footer: Copyrigth')
  expect(await step($)).toEqual({ model: 'claude-opus-5-5', effort: 'low' })
})

test('coding team: three agent types are registered and /team hands the goal to the chat', async ($, on) => {
  const w = await boot($, on)
  for (let i = 0; i < 20 && w.agents.length < 3; i++) await w.clock!.advance(10) // set up in the background
  expect(w.agents).toEqual(['builder', 'tester', 'reviewer'])
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

test('a very long chat starts fresh even on the same task, with Sonnet writing the note', async ($, on) => {
  const w = await boot($, on, { answer: 'NORMAL SAME', ctx: 250_000, history: ['Finish the login page validation messages'] })
  const r = await say($, 'Now make the error text red under each field')
  expect(r).toMatchObject({ drop: expect.stringContaining('passed 150k') })
  expect(w.handoffModel).toBe('claude-sonnet-5-5')
})

test('the long-chat limit can be turned off in settings', async ($, on) => {
  const w = await boot($, on, { store: { long: 'off' }, answer: 'NORMAL SAME', ctx: 250_000, history: ['Finish the login page validation messages'] })
  const r = await say($, 'Now make the error text red under each field')
  await w.clock!.advance(1000)
  expect(r).not.toMatchObject({ drop: expect.anything() })
  expect(w.commands).not.toContain('clear')
})

test('settings: ⚙ beside ＋ opens a card of On/Off options saved for every chat', async ($, on) => {
  const w = await boot($, on, { store: {} })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Button', key: 'p-long-b' } as never)).toBeUndefined()
  await ui.press({ key: 'prefs' } as never)
  expect((await ui.find({ type: 'Button', key: 'p-long-b' } as never))?.props.label).toBe('● On')
  await ui.press({ key: 'p-long-b' } as never)
  expect(w.store!.long).toBe('off')
  expect((await ui.find({ type: 'Button', key: 'p-long-b' } as never))?.props.label).toBe('○ Off')
  await ui.press({ key: 'p-route-b' } as never)
  expect(w.store!.mode).toBe('off')
  await ui.press({ key: 'prefs-done' } as never)
  expect(await ui.find({ type: 'Button', key: 'p-long-b' } as never)).toBeUndefined()
  await ui.unmount()
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
  expect(w.handoffModel).toBe('claude-sonnet-5-5')
})
