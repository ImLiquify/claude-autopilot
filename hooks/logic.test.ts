import { expect, test } from 'claude-code/testing'

import * as L from './logic'

test('changelog: bullets of every newer version, newest first, capped', async () => {
  const md = '# Changelog\n\n## 0.21.0 (2026-11-10)\n- A\n- B\n\n## v0.20.0\n* C\n\n## 0.19.0\n- D\n'
  expect(L.changesSince(md, '0.19.0')).toEqual(['A', 'B', 'C'])
  expect(L.changesSince(md, '0.21.0')).toEqual([])
  expect(L.changesSince(md, '0.0.1', 3)).toEqual(['A', 'B', '…and 2 more on GitHub'])
})

test('pinning: the autopilot source gets or loses a release tag, whatever form it was in', async () => {
  const git = '{\n  "x": { "autopilot@autopilot": true },\n  "extraKnownMarketplaces": {\n    "autopilot": {\n      "source": {\n        "source": "git",\n        "url": "https://github.com/ImLiquify/claude-autopilot.git"\n      }\n    }\n  }\n}'
  expect(L.pinnedTag(git)).toBeUndefined()
  const pinned = L.pinSource(git, 'v0.19.0')
  expect(JSON.parse(pinned).extraKnownMarketplaces.autopilot.source).toEqual({ source: 'github', repo: 'ImLiquify/claude-autopilot', ref: 'v0.19.0' })
  expect(JSON.parse(pinned).x).toEqual({ 'autopilot@autopilot': true })
  expect(L.pinnedTag(pinned)).toBe('v0.19.0')
  expect(L.pinnedTag(L.pinSource(pinned))).toBeUndefined()
  expect(L.pinSource('{}', 'v1')).toBe('{}')
})

test('routing table: each tier gets its model and effort', async () => {
  expect(L.routeFor('TRIVIAL')).toMatchObject({ family: 'sonnet', effort: 'low' })
  expect(L.routeFor('NORMAL')).toMatchObject({ family: 'sonnet', effort: 'medium' })
  expect(L.routeFor('HARD')).toMatchObject({ family: 'opus', effort: 'high' })
  expect(L.routeFor('HEAVY')).toMatchObject({ family: 'opus', effort: 'xhigh' })
  expect(L.parseTier('heavy')).toBe('HEAVY')
  expect(L.parseTier('?')).toBeUndefined()
})

test('the check names model and effort: every effort works on Opus, and Sonnet up to medium (above that is hard work: Opus)', async () => {
  for (const e of L.EFFORTS) expect(L.parseRoute(`OPUS ${e.toUpperCase()}`)).toMatchObject({ family: 'opus', effort: e })
  for (const e of ['low', 'medium'] as const) expect(L.parseRoute(`SONNET ${e.toUpperCase()}`)).toMatchObject({ family: 'sonnet', effort: e })
  expect(L.parseRoute('HARD')).toMatchObject({ family: 'opus', effort: 'high' })
  expect(L.parseRoute('?')).toBeUndefined()
})

test('max is always capped to xhigh; other efforts pass', async () => {
  expect(L.capEffort('max')).toBe('xhigh')
  expect(L.capEffort('low')).toBe('low')
  expect(L.capEffort(undefined)).toBe(undefined)
  expect(L.capEffort('xhigh', 'high')).toBe('high')
  expect(L.capEffort('max', 'medium')).toBe('medium')
  expect(L.capEffort('low', 'high')).toBe('low')
})

test('escalation steps up one rung: effort first, then Sonnet to Opus, never past Opus high', async () => {
  const r = (family: 'sonnet' | 'opus', effort: L.Effort) => ({ ...L.routeFor('NORMAL'), family, effort })
  expect(L.escalate(r('sonnet', 'low'), 'x')).toMatchObject({ family: 'sonnet', effort: 'high' }) // straight to high, no wrong answer in between
  expect(L.escalate(r('opus', 'medium'), 'x')).toMatchObject({ family: 'opus', effort: 'high' })
  expect(L.escalate(r('sonnet', 'high'), 'x')).toMatchObject({ family: 'opus', effort: 'high' })
  expect(L.escalate(r('opus', 'high'), 'x')).toBeNull()
})

test('model lock: above 30k chat tokens; escalation only under the cost cap', async () => {
  expect(L.isLocked(285_000)).toBe(true)
  expect(L.isLocked(10_000)).toBe(false)
  expect(L.canEscalate(undefined)).toBe(true)
  expect(L.canEscalate(40_000)).toBe(true)
  expect(L.canEscalate(285_000)).toBe(false)
})

test('stuck signals: a command failing twice, re-editing the same spot twice', async () => {
  const w = L.freshWatch()
  expect(L.stuckReason(w, { tool: 'Bash', ok: false, command: 'npm test' })).toBeUndefined()
  expect(L.stuckReason(w, { tool: 'Bash', ok: false, command: 'npm test' })).toBe('the same command failed twice')
  const e = (o: string, n: string) => L.stuckReason(w, { tool: 'Edit', ok: true, file: 'a.ts', oldText: o, newText: n })
  e('x', 'const value = computeTheThing(1)')
  e('const value = computeTheThing(1)', 'const value = computeTheThing(2)')
  expect(e('const value = computeTheThing(2)', 'const value = computeTheThing(3)')).toBe('it keeps re-editing the same spot')
})

test('usage: parse the endpoint, roll over at reset, read reset times', async () => {
  const u = L.parseUsage('{"five_hour":{"utilization":76.0,"resets_at":"2026-10-19T04:30:00+00:00"},"seven_day":{"utilization":74,"resets_at":"2026-10-22T06:00:00+00:00"},"seven_day_opus":null}')
  expect(u.five).toEqual({ pct: 76, resetsAt: '2026-10-19T04:30:00+00:00' })
  expect(u.week?.pct).toBe(74)
  const now = Date.parse('2026-10-19T02:00:00Z')
  expect(L.resetsIn(u.five!.resetsAt, now)).toBe('2h 30m')
  expect(L.resetsIn(u.week!.resetsAt, now)).toBe('3d 4h')
  expect(L.current(u.five, now)).toEqual(u.five)
  expect(L.current(u.five, Date.parse('2026-10-19T04:31:00Z'))).toEqual({ pct: 0 })
  expect(L.parseUsage('{"five_hour":null}')).toEqual({ five: undefined, week: undefined })
})


test("the app's hidden notes are split off; the typed request is what remains", async () => {
  const typed = 'Add a dark mode toggle to the settings page'
  const text = `<system-reminder>\nLinked sessions now (status)\n</system-reminder>\n<system-reminder>x</system-reminder>\n${typed}`
  const s = L.splitNotes(text)
  expect(s.body).toBe(typed)
  expect(s.head + s.body).toBe(text)
  expect(L.splitNotes(typed)).toEqual({ head: '', body: typed })
  expect(L.splitNotes('<task-notification>done</task-notification>').body).toBe('<task-notification>done</task-notification>')
})

test('usage readings: a newer window wins, the higher figure wins within one, and old readings show their age', async () => {
  const R = '2026-10-19T04:30:00+00:00', NEXT = '2026-10-19T09:30:00+00:00'
  expect(L.merge({ pct: 6, resetsAt: R, at: 2 }, { pct: 9, resetsAt: R, at: 1 })?.pct).toBe(9)
  expect(L.merge({ pct: 90, resetsAt: R }, { pct: 3, resetsAt: NEXT })?.pct).toBe(3)
  expect(L.merge({ pct: 84 }, { pct: 5, resetsAt: R })?.pct).toBe(5) // an old file without a reset time loses
  expect(L.merge(undefined, { pct: 5 })?.pct).toBe(5)
  expect(L.ago(1_000, 60_000)).toBe('')
  expect(L.ago(0, 120_000)).toBe(' · 2m ago')
  expect(L.ago(0, 7_200_000)).toBe(' · 2h ago')
  expect(L.ago(undefined, 7_200_000)).toBe('')
})

test('mentionsFile spots files the app passes as text', () => {
  expect(L.mentionsFile('[Image: source: C:\a\1.png]')).toBe(true)
  expect(L.mentionsFile('look at @notes.md')).toBe(true)
  expect(L.mentionsFile('open C:/xampp/htdocs/menu.html')).toBe(true)
  expect(L.mentionsFile('Now write a CSV export for the reports screen')).toBe(false)
})

test('todo: add, tick, untick, list and clear', () => {
  let r = L.todoCmd([], 'reply to Sam')
  r = L.todoCmd(r.list, 'ship the banner')
  r = L.todoCmd(r.list, 'done 1')
  expect(r.list).toEqual([{ text: 'reply to Sam', done: true }, { text: 'ship the banner', done: false }])
  expect(L.todoCmd(r.list, '').text).toBe('1. ☑ reply to Sam\n2. ☐ ship the banner')
  expect(L.todoCmd(r.list, 'done 9').text).toBe('There is no item 9.')
  expect(L.todoCmd(r.list, 'done 1').list[0]!.done).toBe(false)
  expect(L.todoCmd(r.list, 'clear').list).toEqual([{ text: 'ship the banner', done: false }])
})

test('Haiku only routes: a stray HAIKU answer runs on Sonnet low, and a route left on Haiku steps up to Sonnet', () => {
  expect(L.parseRoute('HAIKU LOW')).toMatchObject({ family: 'sonnet', effort: 'low' })
  expect(L.escalate({ family: 'haiku', effort: 'low', tier: 'TRIVIAL', reason: 'x' }, 'stuck')).toMatchObject({ family: 'sonnet', effort: 'medium' })
})

test('Claude can flag an open to-do for review; ticking it settles the flag', () => {
  const list = [{ text: 'Log book', done: false }, { text: 'Kiyas website', done: true }]
  const r = L.suggestDone(list, 1, 'the log book page is written and committed')
  expect(r.flagged).toBe('Log book')
  expect(r.list[0]).toEqual({ text: 'Log book', done: false, suggested: 'the log book page is written and committed' })
  expect(L.todoListText(r.list)).toBe('1. [ ] Log book (flagged, waiting for the user to review)\n2. [x] Kiyas website')
  expect(L.suggestDone(list, 2, 'x').flagged).toBeUndefined() // already ticked
  expect(L.suggestDone(list, 9, 'x').text).toContain('There is no item 9.')
  expect(L.todoCmd(r.list, 'done 1').list[0]).toEqual({ text: 'Log book', done: true })
})

test('newer: compares versions by number, never as text', () => {
  expect(L.newer('0.14.0', '0.13.3')).toBe(true)
  expect(L.newer('0.13.10', '0.13.9')).toBe(true)
  expect(L.newer('0.13.3', '0.13.3')).toBe(false)
  expect(L.newer('0.9.0', '0.13.3')).toBe(false)
  expect(L.newer('oops', '0.13.3')).toBe(false)
})

test('auto routing runs exactly the Haiku pick; a switch is priced at the model it goes to', () => {
  expect(L.parseRoute('OPUS MEDIUM')).toMatchObject({ family: 'opus', effort: 'medium' })
  expect(L.parseRoute('SONNET LOW')).toMatchObject({ family: 'sonnet', effort: 'low' })
  expect(L.canEscalate(120_000, 'claude-sonnet-5-5')).toBe(true) // $0.30
  expect(L.canEscalate(120_000, 'claude-opus-5-5')).toBe(false) // $0.60
})

test('follow-ups are carry-on words, not short messages', () => {
  for (const t of ['yes', 'ok do it', 'Go on!', 'yes please', 'thanks', 'sounds good', 'continue']) expect(L.isFollowUp(t)).toBe(true)
  for (const t of ['fix the auth bug', 'add dark mode', 'yes but make it red']) expect(L.isFollowUp(t)).toBe(false)
})

test('file mentions: Windows, macOS and Linux paths and @files; an email is not a file', () => {
  for (const t of ['see C:\\app\\main.ts', 'open /Users/me/app/main.ts', 'look at ~/code/x/main.py', 'check @notes.md', '[Image: source: x.png]']) expect(L.mentionsFile(t)).toBe(true)
  for (const t of ['mail name@mail.com about it', 'make it 1/2 the size', 'add dark mode']) expect(L.mentionsFile(t)).toBe(false)
})

test('home folder is detected on every system', () => {
  expect(L.isHome('C:\\Users\\Kaiser\\', 'C:/Users/Kaiser')).toBe(true)
  expect(L.isHome('/Users/me', '/Users/me')).toBe(true)
  expect(L.isHome('/home/me/project', '/home/me')).toBe(false)
})

test('stuck: the same error twice counts, even from a different command', () => {
  const w = L.freshWatch()
  expect(L.stuckReason(w, { tool: 'Bash', ok: false, command: 'npm test', error: 'FAIL src/date.test.ts\nExpected 29' })).toBeUndefined()
  expect(L.stuckReason(w, { tool: 'Bash', ok: false, command: 'npx jest date', error: 'FAIL src/date.test.ts\nExpected 29' })).toBe('the same error came back twice')
})

test('usage backoff doubles and stops at 10 minutes', () => {
  expect([1, 2, 3, 20].map(L.backoff)).toEqual([10_000, 20_000, 40_000, 600_000])
})

test('settings sizes: only a listed option counts, anything else is the default', () => {
  const long = L.CHOICES.find(c => c.key === 'longAt')!
  expect(L.choiceValue(long, 0)).toBe(0)
  expect(L.choiceValue(long, 150_000)).toBe(150_000)
  expect(L.choiceValue(long, 'junk')).toBe(100_000)
  expect(L.choiceValue(long, undefined)).toBe(100_000)
})

test('low effort only when it is the person\'s own setting; a "Sonnet high" answer is hard work, so it goes to Opus', () => {
  expect([L.floorEffort('low', 'medium'), L.floorEffort('low', 'low'), L.floorEffort('high', 'medium'), L.floorEffort('low', undefined)]).toEqual(['medium', 'low', 'high', 'medium'])
  expect(L.parseRoute('SONNET HIGH')).toMatchObject({ family: 'opus', effort: 'high' })
  expect(L.parseRoute('SONNET MEDIUM')).toMatchObject({ family: 'sonnet', effort: 'medium' })
})

test('limit warning: once at 80%, again at 95%, never twice for one window, and fresh in the next window', () => {
  const w = (pct: number, resetsAt = '2026-10-19T04:30:00Z') => ({ pct, resetsAt })
  expect(L.limitWarning(w(79), undefined)).toBeUndefined()
  expect(L.limitWarning({ pct: 90 }, undefined)).toBeUndefined() // no reset time: not a real reading
  const at80 = L.limitWarning(w(82), undefined)!
  expect(at80.level).toBe(80)
  expect(L.limitWarning(w(85, '2026-10-19T04:30:04Z'), at80.key)).toBeUndefined() // the same window, read seconds apart
  const at95 = L.limitWarning(w(96), at80.key)!
  expect(at95.level).toBe(95)
  expect(L.limitWarning(w(97), at95.key)).toBeUndefined()
  expect(L.limitWarning(w(81, '2026-10-19T09:30:00Z'), at95.key)?.level).toBe(80)
})

test('/why lists this chat\'s picks in plain words, and says so when there are none', () => {
  const rows: L.TraceRow[] = [
    { event: 'prompt', chat: 'other', routed: true, text: 'not mine' }, { event: 'routed', chat: 'other', route: null },
    { event: 'prompt', chat: 'abc', routed: true, text: 'fix the  typo' }, { event: 'routed', chat: 'abc', route: { family: 'sonnet', effort: 'medium', reason: 'quick task' } },
    { event: 'shorten', chat: 'abc', reason: '🗜️ Shortening this chat: new task' },
    { event: 'prompt', chat: 'abc', routed: true, text: 'plan it' }, { event: 'routed', chat: 'abc', route: null },
  ]
  expect(L.whyText(rows, 'abc')).toBe('"fix the typo" → Sonnet · medium (quick task)\nShortened the chat: Shortening this chat: new task\n"plan it" → your own model and effort')
  expect(L.whyText(rows, 'zzz')).toContain('No model picks')
})

test('a chat cools after an hour, and only a known last turn counts', () => {
  expect(L.isCold(0, L.COLD_AFTER_MS + 1)).toBe(true)
  expect(L.isCold(0, L.COLD_AFTER_MS / 2)).toBe(false)
  expect(L.isCold(undefined, L.COLD_AFTER_MS * 5)).toBe(false)
})

test('Keep going holds for 50k more of chat, and ends early if the chat shrank', async () => {
  expect(L.keepGoingHolds(160_000, undefined)).toBe(false)
  expect(L.keepGoingHolds(160_000, 150_000)).toBe(true)
  expect(L.keepGoingHolds(200_000, 150_000)).toBe(false)
  expect(L.keepGoingHolds(60_000, 150_000)).toBe(false)
})

test('hand-off: the check word, when a helper is worth it, the cost comparison and the pause', async () => {
  expect(L.parseHand('OPUS HIGH WORKER')).toBe('worker')
  expect(L.parseHand('opus medium expert SAME')).toBe('expert')
  expect(L.parseHand('OPUS MEDIUM SOLO')).toBe(undefined)
  expect(L.parseHand('OPUS MEDIUM')).toBe(undefined)
  // A cheaper helper is worth it from an Opus chat of any size; a same-model helper only when the chat is big.
  expect(L.worthHanding('worker', 0, 'opus')).toBe(true)
  expect(L.worthHanding('worker', 0, 'sonnet')).toBe(false)
  expect(L.worthHanding('expert', 10_000, 'opus')).toBe(false)
  expect(L.worthHanding('expert', 40_000, 'opus')).toBe(true)
  const u = { input_tokens: 0, output_tokens: 10_000, cache_read_input_tokens: 500_000, cache_creation_input_tokens: 50_000 }
  const near = (a: number, b: number) => expect(Math.abs(a - b) < 0.01).toBe(true)
  // Sonnet helper, 25 steps, 150k Opus chat: 0.40 for the helper plus 0.19 of the chat's own work, against 2.7 in the chat.
  const w = L.handResult(u, 'sonnet', 'opus', 25, 150_000)
  near(w.cost, 0.5875)
  expect(w.saved).toBeGreaterThan(1.5)
  // Opus helper: same prices, the saving is the re-reading alone, less the helper's start-up.
  const x = L.handResult(u, 'opus', 'opus', 25, 150_000)
  near(x.saved, 1.875 - 0.1 - 0.1875)
  // One step: the start-up is not paid back.
  expect(L.handResult({ ...u, cache_read_input_tokens: 0, output_tokens: 300 }, 'opus', 'opus', 1, 60_000).saved).toBeLessThan(0)
  let t: L.HandTally | undefined
  for (const s of [1, -0.2, -0.2, -0.2, -0.2]) t = L.tallyHand(t, s)
  expect(t!.paused).toBe(false) // the last five together still saved
  t = L.tallyHand(t, -0.3)
  expect(t!.paused).toBe(true)
  expect(t!.n).toBe(6)
})
