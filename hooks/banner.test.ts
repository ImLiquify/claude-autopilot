import { expect, test } from 'claude-code/testing'

import { bannerSvg, chipOf, meterOf, routeLine, usageText } from './banner'

test('the desktop card draws the model, both rings with resets, the lock and dark mode', async () => {
  const svg = bannerSvg({ title: 'Opus · low', sub: 'locked: a switch re-reads 330k', locked: true, extra: false }, { label: 'Session', pct: 91, sub: 'resets in 12m' }, { label: 'Week', sub: 'loading…' }, 'Lifetime 1k tokens')
  expect(svg.startsWith('<svg')).toBe(true)
  for (const s of ['Opus · low', 'locked: a switch re-reads 330k', '91%', 'Session', 'resets in 12m', 'Week', 'loading…', '#e5484d', 'prefers-color-scheme: dark']) expect(svg).toContain(s)
  expect(bannerSvg({ title: '<b>', sub: 'x', locked: false, extra: true }, { label: 'S', pct: 0, sub: 'reset' }, { label: 'W', pct: 5, sub: '' }, 't')).toContain('&lt;b&gt;')
})
