// The banner above the prompt as one SVG card (desktop app): model chip, then two usage rings.
// Plain strings, theme-aware through prefers-color-scheme, zero tokens.

import type { ApView } from '../types'
import * as L from './logic'

export type Meter = { label: string; pct?: number; sub: string }
export type Chip = { title: string; sub: string; locked: boolean; extra: boolean }

const W = 730
const H = 72
const FONT = `font-family="Segoe UI Variable, Segoe UI, system-ui, -apple-system, sans-serif"`
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const tone = (p: number) => (p >= 85 ? '#e5484d' : p >= 65 ? '#f0a43a' : '#d97757')

const STYLE = `<style>
.card{fill:#fbfaf7;stroke:#e6e1d6}.t1{fill:#26241f}.t2{fill:#6f6b62}.trkf{fill:#ebe6dc}.div{stroke:#e6e1d6}.trk{stroke:#ebe6dc}
@media (prefers-color-scheme: dark){.card{fill:#262522;stroke:#38362f}.t1{fill:#efede7}.t2{fill:#a8a49a}.trkf{fill:#3a3833}.div{stroke:#38362f}.trk{stroke:#3a3833}}
.num{font-variant-numeric:tabular-nums}
.lid{animation:blink 4s infinite}
.bob{animation:bob 1.2s ease-in-out infinite}.tap{animation:tap .3s steps(1) infinite}
.d1,.d2,.d3{animation:dot 1.2s infinite}.d2{animation-delay:.2s}.d3{animation-delay:.4s}
@keyframes blink{0%,92%,100%{opacity:0}95%{opacity:1}}
@keyframes bob{50%{transform:translateY(-4px)}}
@keyframes tap{50%{transform:translateY(4px)}}
@keyframes dot{0%,100%{opacity:.2}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>`

// The pixel Claude mascot beside a laptop seen from the side, on an 18 x 8 grid. Idle: the lid is shut.
// Thinking: the lid is open and it watches the screen. Working: it crouches, looks at the screen and taps the keys.
// u is a whole number of pixels so every block draws the same size, and every block sits on whole units.
// Keep u (and x, y) multiples of 4: at 125% / 175% Windows scaling a 2px block is 2.5 / 3.5 screen pixels and
// the eyes and legs round unevenly; 4px is whole screen pixels at every scale. An SVG image can't query the scale.
export type Pose = 'idle' | 'think' | 'work'
type Px = [number, number, number, number][]
const BODY: Px = [[8, 0, 8, 6], [16, 2, 2, 2]]
const LEGS: Px = [[8, 6, 1, 2], [10, 6, 1, 2], [13, 6, 1, 2], [15, 6, 1, 2]]
// fine: the original (GitHub) eyes and dots on half blocks; crisp only when half a block is whole screen pixels (u = 3.2 at 125%).
const robot = (x: number, y: number, pose: Pose, u = 4, fine = false) => {
  const px = (list: Px, fill = '#d97757', cls = '') => list.map(([a, b, w, h]) => `<rect${cls && ` class="${cls}"`} x="${+(a * u).toFixed(2)}" y="${+(b * u).toFixed(2)}" width="${+(w * u).toFixed(2)}" height="${+(h * u).toFixed(2)}" fill="${fill}"/>`).join('')
  const open = pose !== 'idle', work = pose === 'work'
  // Base on the ground; the lid leans back from the hinge so its screen faces the crab, or lies shut on the base.
  const laptop = px([[2, 7, 5, 1], ...(open ? [[2, 6, 1, 1], [1, 5, 1, 1], [0, 4, 1, 1]] as Px : [[2, 6, 5, 1]] as Px)], '#8a867c')
  // Eyes slide toward the screen while it watches it.
  // A blink is a body-coloured lid flashing over each eye: the app's renderer squashed eyes scaled about their centre.
  const eyeAt: Px = fine ? (open ? [[9, 2, 1, 1.5], [12, 2, 1, 1.5]] : [[10, 1.5, 1, 1.5], [13, 1.5, 1, 1.5]])
    : open ? [[9, 2, 1, 2], [12, 2, 1, 2]] : [[10, 1, 1, 2], [13, 1, 1, 2]]
  const eyes = px(eyeAt, '#1f1e1b') + px(eyeAt, '#d97757', 'lid').replace(/<rect /g, '<rect opacity="0" ')
  // The arm by the laptop: level at rest, lowered to the keys while typing.
  const arm = work ? `<g class="tap">${px([[6, 4, 2, 1]])}</g>` : px([[6, 2, 2, 2]])
  const [d1, d2, d3, dy] = fine ? [13.5, 15, 16.5, -2.5] : [13, 15, 17, -2]
  const dots = pose === 'think' ? px([[d1, dy, 1, 1]], '#d97757', 'd1') + px([[d2, dy, 1, 1]], '#d97757', 'd2') + px([[d3, dy, 1, 1]], '#d97757', 'd3') : ''
  return `<g transform="translate(${x} ${y})" shape-rendering="crispEdges">${laptop}${px(LEGS)}
<g transform="translate(0 ${work ? u : 0})"><g class="${pose === 'think' ? 'bob' : ''}">${px(BODY)}${eyes}${arm}</g></g>${dots}</g>`
}

const lockIcon = (x: number, y: number) => `<g transform="translate(${x} ${y})" fill="none" stroke="#d97757" stroke-width="1.6" stroke-linecap="round">
<rect x="0.8" y="5" width="9.4" height="7.4" rx="2" fill="#d97757" stroke="none"/><path d="M2.8 5V3.4a2.7 2.7 0 0 1 5.4 0V5"/></g>`

// One usage row on a baseline: label, a thin bar, the percent right-aligned in tabular digits, then when it resets.
const bar = (y: number, m: Meter) => {
  const p = Math.max(0, Math.min(100, m.pct ?? 0))
  const fill = m.pct === undefined || p === 0 ? '' : `<rect x="432" y="${y - 8}" width="${Math.max(6, p).toFixed(1)}" height="6" rx="3" fill="${tone(p)}"/>`
  return `<text class="t2" x="334" y="${y}" font-size="12" font-weight="500" ${FONT}>${esc(m.label)}</text>
<rect class="trkf" x="432" y="${y - 8}" width="100" height="6" rx="3"/>${fill}
<text class="t1 num" x="574" y="${y}" text-anchor="end" font-size="12.5" font-weight="600" ${FONT}>${m.pct === undefined ? '…' : `${Math.round(p)}%`}</text>
<text class="t2 num" x="586" y="${y}" font-size="11.5" ${FONT}>${esc(clip(m.sub, 22))}</text>`
}

export const bannerSvg = (chip: Chip, session: Meter, week: Meter, tokens: string, pose: Pose = 'idle') => {
  const sub = chip.locked ? `${lockIcon(96, 39)}<text class="t2" x="111" y="50" font-size="12" ${FONT}>${esc(clip(chip.sub, 30))}</text>`
    : `<text class="t2" x="96" y="50" font-size="12" ${FONT}>${esc(clip(chip.sub, 32))}</text>`
  const titleW = Math.min(150, chip.title.length * 8.6)
  const extra = chip.extra ? `<rect x="${96 + titleW + 10}" y="19" width="76" height="18" rx="9" fill="#d97757" opacity=".14"/>
<text x="${96 + titleW + 48}" y="31.5" text-anchor="middle" font-size="11" font-weight="600" fill="#c2643f" ${FONT}>Extra effort</text>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${STYLE}
<rect class="card" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14"/>
${robot(12, 24, pose)}
<text class="t1" x="96" y="32" font-size="15" font-weight="600" letter-spacing="-0.15" ${FONT}>${esc(clip(chip.title, 20))}</text>${extra}
${sub}
<line class="div" x1="318" y1="14" x2="318" y2="58" stroke-width="1"/>
${bar(24, session)}
${bar(42, week)}
<text class="t2 num" x="334" y="60" font-size="11.5" ${FONT}>${esc(clip(tokens, 60))}</text>
</svg>`
}

// Minimized: one 24px row (with the app's 10px padding the strip matches the 44px chat box) of separate pieces the row spreads across the strip:
// the crab with the model, the 5-hour and week meters, lifetime tokens, with thin dividers between.
const mini = (w: number, body: string, h = 24) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${STYLE}${body}</svg>`

// The original crab on 3.2px blocks (4 screen pixels at 125% Windows scaling), with 8px above it for the
// thinking dots and the bob. The other pieces are 24 tall and the row centres them against it.
export const miniCrab = (title: string, pose: Pose = 'idle') => {
  const t = clip(title, 24)
  return mini(Math.round(80 + t.length * 7.5), `<g transform="translate(0 8)">${robot(0, 0, pose, 3.2, true)}</g>
<text class="t1" x="68" y="22" font-size="13" font-weight="600" ${FONT}>${esc(t)}</text>`, 33.6)
}

export const miniMeter = (m: Meter) => {
  const p = Math.max(0, Math.min(100, m.pct ?? 0)), bx = m.label.length * 6.5 + 10
  const fill = m.pct === undefined || p === 0 ? '' : `<rect x="${bx}" y="9" width="${Math.max(6, p * 0.6).toFixed(1)}" height="6" rx="3" fill="${tone(p)}"/>`
  return mini(bx + 98, `<text class="t2" x="0" y="16" font-size="11" font-weight="600" ${FONT}>${esc(m.label)}</text>
<rect class="trkf" x="${bx}" y="9" width="60" height="6" rx="3"/>${fill}
<text class="t1 num" x="${bx + 68}" y="16" font-size="12" font-weight="700" ${FONT}>${m.pct === undefined ? '…' : `${Math.round(p)}%`}</text>`)
}

// "Lifetime 10.6B tokens": the word muted, the number strong.
export const miniTokens = (tokens: string) => {
  const [word, ...rest] = tokens.split(' '), num = clip(rest.join(' '), 18)
  return mini(Math.round(56 + num.length * 6.8), `<text class="t2" x="0" y="16" font-size="11" font-weight="600" ${FONT}>${esc(word!)}</text>
<text class="t1 num" x="50" y="16" font-size="11" font-weight="600" ${FONT}>${esc(num)}</text>`)
}

export const MINI_DIVIDER = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="24" viewBox="0 0 1 24">${STYLE}<line class="div" x1="0.5" y1="5" x2="0.5" y2="19" stroke-width="1"/></svg>`

// ---------- What the banner says, from the route and usage state (the terminal draws these as text).
export const routeLine = (v: ApView) =>
  v.mode === 'off' ? 'Routing off'
  : v.lock !== undefined ? `🔒 ${L.modelName(v.used?.model)} · ${v.route?.effort ?? v.used?.effort ?? ''} (locked: switching would re-read ${Math.round(v.lock / 1000)}k tokens)`
  : v.route ? `${L.modelName(v.route.family)} · ${v.route.effort} · ${v.route.reason}`
  : v.used ? `${L.modelName(v.used.model)} · ${v.used.effort ?? ''}` : 'Waiting for your first message'

// down: the usage reads keep failing. A reading over 10 minutes old is then not shown as if it were current.
const unavailable = (w: L.Window | undefined, now: number, down?: boolean) => !!down && (!w?.at || now - w.at > 600_000)

export const usageText = (label: string, w: L.Window | undefined, now: number, down?: boolean) => {
  if (unavailable(w, now, down)) return `${label} usage unavailable`
  const c = L.current(w, now)
  if (!c) return `${label} …`
  return `${label} ${L.bar(c.pct, 8)} ${Math.round(c.pct)}%${L.ago(c.at, now)}${c.resetsAt ? ` · resets in ${L.resetsIn(c.resetsAt, now)}` : ' · reset'}`
}

export const chipOf = (v: ApView): Chip => {
  const effort = v.route?.effort ?? v.used?.effort ?? ''
  const name = v.route && v.lock === undefined && v.mode !== 'off' ? L.modelName(v.route.family) : L.modelName(v.used?.model)
  const title = `${name} · ${effort}`
  if (v.mode === 'off') return { title, sub: 'routing off: your own model', locked: false, extra: false }
  if (v.lock !== undefined) return { title, sub: `locked: a switch re-reads ${Math.round(v.lock / 1000)}k`, locked: true, extra: effort === 'xhigh' }
  if (v.route) return { title, sub: v.route.reason, locked: false, extra: effort === 'xhigh' }
  return v.used ? { title, sub: 'your model', locked: false, extra: false } : { title: 'Autopilot', sub: 'waiting for your first message', locked: false, extra: false }
}

export const meterOf = (label: string, w: L.Window | undefined, now: number, down?: boolean): Meter => {
  if (unavailable(w, now, down)) return { label, sub: 'usage unavailable' }
  const c = L.current(w, now)
  return { label, pct: c?.pct, sub: !c ? 'loading…' : `${c.resetsAt ? `resets in ${L.resetsIn(c.resetsAt, now)}` : 'reset'}${L.ago(c.at, now)}` }
}


// "Lifetime 9.5B tokens"
export const tokenText = (life: number | undefined) => {
  const f = (n?: number) => (n === undefined ? '…' : n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n))
  return `Lifetime ${f(life)} tokens`
}


