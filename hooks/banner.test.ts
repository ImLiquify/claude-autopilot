import { expect, test } from 'claude-code/testing'

import { bannerSvg, chipOf, meterOf, miniCrab, miniMeter, miniTokens, routeLine, usageText } from './banner'

test('the minimized row: crab with the model, meters, lifetime tokens, each 24px tall', async () => {
  const crab = miniCrab('Opus · low', 'work')
  for (const s of ['Opus · low', 'class="slot"', 'class="tap"']) expect(crab).toContain(s)
  const meter = miniMeter({ label: '5-hour', pct: 91, sub: 'resets in 12m' })
  for (const s of ['5-hour', '91%', '#e5484d', 'height="24"']) expect(meter).toContain(s)
  expect(miniMeter({ label: 'Week', sub: 'loading…' })).toContain('…')
  const life = miniTokens('Lifetime 10.6B tokens')
  for (const s of ['>Lifetime<', '>10.6B tokens<']) expect(life).toContain(s)
})

test('eyes blink with a hidden lid, and every block sits on whole units', async () => {
  const svg = miniCrab('x', 'think')
  expect(svg).toContain('<rect opacity="0" class="lid"')
  expect(svg).not.toContain('scaleY')
  // The half-block eyes and dots must land on whole screen pixels at 125% (1.6px), or they round unevenly: that was the broken eye.
  const crab = svg.slice(svg.indexOf('crispEdges'), svg.indexOf('<text'))
  for (const [, n] of crab.matchAll(/ (?:x|y|width|height)="(-?[\d.]+)"/g)) expect(Math.abs(Number(n) / 1.6 - Math.round(Number(n) / 1.6)) < 1e-6).toBe(true)
  for (const s of ['height="4.8"', 'x="43.2"']) expect(svg).toContain(s) // the original 1.5-block eyes and half-step dots
})

test('the desktop card draws the model, both rings with resets, the lock and dark mode', async () => {
  const svg = bannerSvg({ title: 'Opus · low', sub: 'locked: a switch re-reads 330k', locked: true, extra: false }, { label: 'Session', pct: 91, sub: 'resets in 12m' }, { label: 'Week', sub: 'loading…' }, 'Lifetime 1k tokens')
  expect(svg.startsWith('<svg')).toBe(true)
  for (const s of ['Opus · low', 'locked: a switch re-reads 330k', '91%', 'Session', 'resets in 12m', 'Week', 'loading…', '#e5484d', 'prefers-color-scheme: dark']) expect(svg).toContain(s)
  expect(bannerSvg({ title: '<b>', sub: 'x', locked: false, extra: true }, { label: 'S', pct: 0, sub: 'reset' }, { label: 'W', pct: 5, sub: '' }, 't')).toContain('&lt;b&gt;')
})


