import { expect, test } from 'claude-code/testing'

import { bannerSvg, chipOf, gearSvg, meterOf, routeLine, usageText } from './banner'

test('the desktop card draws the model, both rings with resets, the lock and dark mode', async () => {
  const svg = bannerSvg({ title: 'Opus · low', sub: 'locked: a switch re-reads 330k', locked: true, extra: false }, { label: 'Session', pct: 91, sub: 'resets in 12m' }, { label: 'Week', sub: 'loading…' }, 'Lifetime 1k tokens')
  expect(svg.startsWith('<svg')).toBe(true)
  for (const s of ['Opus · low', 'locked: a switch re-reads 330k', '91%', 'Session', 'resets in 12m', 'Week', 'loading…', '#e5484d', 'prefers-color-scheme: dark']) expect(svg).toContain(s)
  expect(bannerSvg({ title: '<b>', sub: 'x', locked: false, extra: true }, { label: 'S', pct: 0, sub: 'reset' }, { label: 'W', pct: 5, sub: '' }, 't')).toContain('&lt;b&gt;')
})

test('the gear drawing turns counter-clockwise opening and back closing, the row sliding from it', async () => {
  const open = gearSvg('open', 'high'), close = gearSvg('close', 'high')
  expect(open).toContain('rotate(0deg)}to{transform:rotate(-90deg)')
  expect(close).toContain('rotate(-90deg)}to{transform:rotate(0deg)')
  for (const s of ['Max effort:', '● high', 'xhigh', 'prefers-reduced-motion']) expect(open).toContain(s)
})
