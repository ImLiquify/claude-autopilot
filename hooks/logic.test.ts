import { expect, test } from 'claude-code/testing'

import * as L from './logic'

test('routing table: each tier gets its model and effort', async () => {
  expect(L.routeFor('TRIVIAL')).toMatchObject({ family: 'sonnet', effort: 'low' })
  expect(L.routeFor('NORMAL')).toMatchObject({ family: 'sonnet', effort: 'medium' })
  expect(L.routeFor('HARD')).toMatchObject({ family: 'opus', effort: 'high' })
  expect(L.routeFor('HEAVY')).toMatchObject({ family: 'opus', effort: 'xhigh' })
  expect(L.parseTier('heavy')).toBe('HEAVY')
  expect(L.parseTier('?')).toBeUndefined()
})

test('Haiku names model and effort: every effort works on both models', async () => {
  for (const f of ['sonnet', 'opus'] as const)
    for (const e of L.EFFORTS) expect(L.parseRoute(`${f.toUpperCase()} ${e.toUpperCase()}`)).toMatchObject({ family: f, effort: e })
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
  expect(L.escalate(r('sonnet', 'low'), 'x')).toMatchObject({ family: 'sonnet', effort: 'medium' })
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

test('fresh-start trigger: size first, then the cost of one turn, with the window share as upper bound', async () => {
  expect(L.freshReason({ ctx: 160_000, window: 1_000_000 })).toBe('chat was 160k')
  expect(L.freshReason({ ctx: 149_000, window: 1_000_000 })).toBeUndefined()
  expect(L.freshReason({ ctx: 90_000, window: 1_000_000, turnPct: 2 })).toBe('one message used 2.0% of your 5-hour limit')
  expect(L.freshReason({ ctx: 90_000, window: 200_000 })).toBe('chat was 45% of the window')
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

test('Haiku: picked for the simplest jobs, always at low, and stuck steps it up to Sonnet medium', () => {
  expect(L.parseRoute('HAIKU LOW')).toMatchObject({ family: 'haiku', effort: 'low' })
  expect(L.escalate(L.parseRoute('HAIKU LOW')!, 'stuck')).toMatchObject({ family: 'sonnet', effort: 'medium' })
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

test('auto routing moves Haiku and Sonnet picks to Opus and keeps the effort', () => {
  expect(L.onOpus(L.parseRoute('HAIKU LOW')!)).toMatchObject({ family: 'opus', effort: 'low' })
  expect(L.onOpus(L.parseRoute('SONNET XHIGH')!)).toMatchObject({ family: 'opus', effort: 'xhigh' })
})
