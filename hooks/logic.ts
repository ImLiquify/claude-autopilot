// Pure rules of Autopilot: no `$`, so every one is unit-tested and costs zero tokens.

export type Tier = 'TRIVIAL' | 'NORMAL' | 'HARD' | 'HEAVY'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh'
export type Family = 'haiku' | 'sonnet' | 'opus'
export type Route = { family: Family; effort: Effort; tier: Tier; reason: string; escalated?: boolean }

export const MODELS = { sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5', haiku: 'claude-haiku-5-5' }
export const TIERS: readonly Tier[] = ['TRIVIAL', 'NORMAL', 'HARD', 'HEAVY']

const TABLE: Record<Tier, [Family, Effort, string]> = {
  TRIVIAL: ['sonnet', 'low', 'quick task'],
  NORMAL: ['sonnet', 'medium', 'normal task'],
  HARD: ['opus', 'high', 'hard task'],
  HEAVY: ['opus', 'xhigh', 'heavy task'],
}

export const routeFor = (tier: Tier, why?: string): Route => {
  const [family, effort, reason] = TABLE[tier]
  return { family, effort, tier, reason: why ?? reason }
}

// The hard cap: `max` from any source becomes `xhigh`.
// Fresh start between tasks once a chat is expensive to keep: whichever comes first of its size, what the last
// turn cost against the 5-hour limit, or (upper bound) its share of the window. Returns the reason shown on the card.
// Past this every message moves, "yes" and "still broken" too: each tool call re-reads the whole chat (one 650k prompt used 34% of a 5-hour limit).
export const FRESH_TOKENS = 150_000
export const FRESH_COST_PCT = 1.5
export const FRESH_SHARE = 0.4
export const freshReason = (a: { ctx: number; window?: number; turnPct?: number }): string | undefined =>
  a.ctx >= FRESH_TOKENS ? `chat was ${Math.round(a.ctx / 1000)}k`
  : (a.turnPct ?? 0) >= FRESH_COST_PCT ? `one message used ${a.turnPct!.toFixed(1)}% of your 5-hour limit`
  : a.window && a.ctx / a.window >= FRESH_SHARE ? `chat was ${Math.round((a.ctx / a.window) * 100)}% of the window`
  : undefined

export const EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const
// max is always capped to xhigh; the Settings ceiling (if set) caps further.
export const capEffort = <E>(effort: E, ceiling?: string): E | 'xhigh' => {
  const e = effort === 'max' ? 'xhigh' : effort
  const i = EFFORTS.indexOf(e as never), c = EFFORTS.indexOf(ceiling as never)
  return i >= 0 && c >= 0 && i > c ? (EFFORTS[c] as E) : e
}

export const parsePrefix = (text: string): { text: string; force?: '!opus' | '!sonnet' | '!high' | '!extra' } => {
  const m = /^\s*(!opus|!sonnet|!high|!extra)\b\s*/i.exec(text)
  return m ? { text: text.slice(m[0].length), force: m[1]!.toLowerCase() as never } : { text }
}

export const forced = (force: string, base: Route): Route =>
  force === '!opus' ? { family: 'opus', effort: 'high', tier: 'HARD', reason: 'you asked: !opus' }
  : force === '!sonnet' ? { family: 'sonnet', effort: 'medium', tier: 'NORMAL', reason: 'you asked: !sonnet' }
  : force === '!extra' ? { family: 'opus', effort: 'xhigh', tier: 'HEAVY', reason: 'you asked: !extra' }
  : { ...base, effort: 'high', reason: 'you asked: !high' }

export const parseTier = (answer: string): Tier | undefined => {
  const up = answer.toUpperCase()
  return TIERS.find(t => up.includes(t))
}

// Haiku names the setting that is just good enough; auto routing runs one rung above it, so a borderline pick never under-delivers.
// Haiku stays Haiku (simple chores), Sonnet xhigh becomes Opus xhigh, and Opus xhigh, the top, stays put.
export const stepUp = (r: Route): Route => {
  if (r.family === 'haiku') return r
  const i = EFFORTS.indexOf(r.effort)
  return i < EFFORTS.length - 1 ? { ...r, effort: EFFORTS[i + 1]!, tier: TIERS[i + 1]! } : { ...r, family: 'opus' }
}

// Haiku names a model and an effort ("OPUS MEDIUM"): any pairing, so both models get every effort.
// An old-style tier word ("HARD") still works.
export const parseRoute = (answer: string): Route | undefined => {
  const up = answer.toUpperCase()
  // Haiku only ever runs at low: it is picked for jobs so simple that more effort changes nothing.
  if (up.includes('HAIKU')) return { family: 'haiku', effort: 'low', tier: 'TRIVIAL', reason: 'simple task' }
  const family: Family | undefined = up.includes('OPUS') ? 'opus' : up.includes('SONNET') ? 'sonnet' : undefined
  const effort = [...EFFORTS].reverse().find(e => up.includes(e.toUpperCase())) // xhigh before high
  if (!family || !effort) { const t = parseTier(answer); return t && routeFor(t) }
  const tier = TIERS[EFFORTS.indexOf(effort)]!
  return { family, effort, tier, reason: TABLE[tier][2] }
}

// A reply that only carries the last task on ("yes", "ok do it", "go on"): not a new task.
// Words, not length, so a short request like "fix the auth bug" still counts as a task.
const GO_ON = new Set('yes yeah yep yup y ok okay k sure go on ahead do it continue carry proceed next thanks thank you ty great nice perfect cool sounds looks good lgtm please pls and that fine alright right'.split(' '))
export const isFollowUp = (text: string) => {
  const words = text.toLowerCase().replace(/'/g, '').replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean)
  return words.every(w => GO_ON.has(w))
}
// The prompt names a file the app attached as text ("[Image: source: C:\…png]", "@notes.md", a pasted Windows, macOS or Linux path):
// a mod's re-send would lose it. An email ("name@mail.com") is not an @file: the @ must start a word.
export const mentionsFile = (text: string) =>
  /\[(Image|File)\b|(^|[\s(`'"])@[\w./\\-]+\.\w{1,5}\b|\b[A-Za-z]:[\\/]\S+\.\w{1,5}\b|(^|[\s(`'"])~?\/[\w.-]+\/\S*\.\w{1,5}\b/i.test(text)

export const COMPLAINT = /\b(still (broken|failing|not working|wrong|the same)|(does ?n[o']?t|did ?n[o']?t|is ?n[o']?t) (work|fix)|not fixed|that'?s wrong|same (error|problem|issue)|wrong again)\b/i

// The real check on Haiku's guess: a complaint or a stuck turn steps the route up one rung.
// Effort first (the cache is kept), then Sonnet -> Opus; nothing above Opus high.
export const escalate = (route: Route, reason: string): Route | null => {
  if (route.family === 'haiku') return { family: 'sonnet', effort: 'medium', tier: 'NORMAL', reason, escalated: true }
  const i = EFFORTS.indexOf(route.effort)
  if (i < EFFORTS.indexOf('high')) {
    const effort = EFFORTS[i + 1]!
    return { ...route, effort, tier: TIERS[i + 1]!, reason, escalated: true }
  }
  return route.family === 'sonnet' ? { ...route, family: 'opus', reason, escalated: true } : null
}

// Model lock: a model switch in a long chat rewrites its whole cached conversation (measured ~30x a normal turn),
// so above LOCK_AT chat tokens nothing switches automatically, up or down; effort may (measured: cache kept).
// Escalation may pass only under a small cost cap.
export const LOCK_AT = 30_000
export const ESCALATE_MAX_USD = 0.4
const WRITE_PER_M = { opus: 5, sonnet: 2.5, haiku: 0.125 } // $ per million cache-write tokens
export const isLocked = (chatTokens: number, at = LOCK_AT) => chatTokens > at
export const rewriteUsd = (tokens: number, model = 'opus') =>
  (tokens * WRITE_PER_M[/haiku/i.test(model) ? 'haiku' : /sonnet/i.test(model) ? 'sonnet' : 'opus']) / 1e6
export const canEscalate = (lock: number | undefined) => lock === undefined || rewriteUsd(lock) <= ESCALATE_MAX_USD
export const modelName = (id?: string) => (!id ? '?' : /opus/i.test(id) ? 'Opus' : /sonnet/i.test(id) ? 'Sonnet' : /haiku/i.test(id) ? 'Haiku' : id)

// --- Stuck signals within one turn: the same command failing twice, or re-editing the same spot.
export type Watch = { fails: Record<string, number>; errors: Record<string, number>; lastNew: Record<string, string>; spots: Record<string, number> }
export const freshWatch = (): Watch => ({ fails: {}, errors: {}, lastNew: {}, spots: {} })
export type ToolSeen = { tool: string; ok: boolean; command?: string; error?: string; file?: string; oldText?: string; newText?: string }

const lineOverlap = (a: string, b: string) => a.split('\n').some(l => l.trim().length > 10 && b.includes(l.trim()))

export const stuckReason = (w: Watch, t: ToolSeen): string | undefined => {
  if (t.tool === 'Bash' && !t.ok && t.command) {
    const key = t.command.trim()
    w.fails[key] = (w.fails[key] ?? 0) + 1
    if (w.fails[key] === 2) return 'the same command failed twice'
  }
  // The same error from any tool (a test re-run another way, the same build error): works in any language, no complaint needed.
  const err = t.ok ? undefined : t.error?.split('\n').map(l => l.trim()).find(l => l.length > 10)?.slice(0, 200)
  if (err) {
    w.errors[err] = (w.errors[err] ?? 0) + 1
    if (w.errors[err] === 2) return 'the same error came back twice'
  }
  if (t.tool === 'Edit' && t.ok && t.file && t.oldText !== undefined) {
    const prev = w.lastNew[t.file]
    w.lastNew[t.file] = t.newText ?? ''
    if (prev && lineOverlap(t.oldText, prev)) {
      w.spots[t.file] = (w.spots[t.file] ?? 0) + 1
      if (w.spots[t.file] === 2) return 'it keeps re-editing the same spot'
    }
  }
  return undefined
}

// --- Usage windows for the banner.
export type Window = { pct: number; resetsAt?: string; at?: number } // at: when it was read

// Two readings of one limit: a later reset is a newer window and wins; within one window usage only rises,
// so the higher figure is the fresher one (a chat's own figure lags until that chat gets a reply).
export const merge = (a?: Window, b?: Window): Window | undefined => {
  if (!a || !b) return a ?? b
  const ra = Date.parse(a.resetsAt ?? '') || 0, rb = Date.parse(b.resetsAt ?? '') || 0
  if (Math.abs(ra - rb) > 60_000) return ra > rb ? a : b
  return a.pct !== b.pct ? (a.pct > b.pct ? a : b) : (a.at ?? 0) >= (b.at ?? 0) ? a : b
}

// " · 2m ago" once a reading is over 90 s old; nothing while it is fresh or its time is unknown.
export const ago = (at: number | undefined, now: number) => {
  const m = at === undefined ? 0 : Math.round((now - at) / 60_000)
  return at === undefined || now - at < 90_000 ? '' : ` · ${m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`} ago`
}

// Past its reset time a window is empty again until fresh numbers arrive.
export const current = (w: Window | undefined, now: number): Window | undefined =>
  w?.resetsAt && Date.parse(w.resetsAt) <= now ? { pct: 0 } : w

// "3h 12m", "3d 4h", "now": time left until an ISO reset moment.
export const resetsIn = (iso: string | undefined, now: number) => {
  const ms = iso ? Date.parse(iso) - now : NaN
  if (!Number.isFinite(ms)) return '?'
  const m = Math.max(0, Math.round(ms / 60_000))
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`
}

export const bar = (pct: number, width = 10) => {
  const full = Math.round((Math.max(0, Math.min(100, pct)) / 100) * width)
  return '▓'.repeat(full) + '░'.repeat(width - full)
}

// The account usage endpoint (what /usage shows), utilization 0-100.
type Raw = { utilization?: number | null; resets_at?: string | null } | null | undefined
export const parseUsage = (text: string): { five?: Window; week?: Window } => {
  const b = JSON.parse(text) as { five_hour?: Raw; seven_day?: Raw }
  const one = (w: Raw): Window | undefined => (typeof w?.utilization === 'number' ? { pct: w.utilization, resetsAt: w.resets_at ?? undefined } : undefined)
  return { five: one(b.five_hour), week: one(b.seven_day) }
}


// --- Dashboard to-do list: /todo <text> adds, /todo done <n> ticks (or unticks), /todo clear drops ticked, /todo lists.
export type Todo = { text: string; done: boolean; suggested?: string } // suggested: Claude's reason it looks finished, awaiting the person
// Ticking (or unticking) settles any suggestion: the person has reviewed it.
export const tick = ({ suggested: _, ...t }: Todo): Todo => ({ ...t, done: !t.done })
export const todoCmd = (list: readonly Todo[], args: string): { list: Todo[]; text: string } => {
  const a = args.trim()
  const n = /^done\s+(\d+)$/i.exec(a)
  if (n) {
    const i = Number(n[1]) - 1, t = list[i]
    if (!t) return { list: [...list], text: `There is no item ${n[1]}.` }
    return { list: list.map((x, j) => (j === i ? tick(x) : x)), text: `${t.done ? 'Reopened' : 'Done'}: ${t.text}` }
  }
  if (/^clear$/i.test(a)) {
    const keep = list.filter(t => !t.done)
    return { list: keep, text: `Cleared ${list.length - keep.length} finished item(s).` }
  }
  if (!a) return { list: [...list], text: list.length ? list.map((t, i) => `${i + 1}. ${t.done ? '☑' : '☐'} ${t.text}`).join('\n') : 'Your to-do list is empty. Add one with /todo <text>.' }
  return { list: [...list, { text: a.slice(0, 200), done: false }], text: `Added: ${a.slice(0, 200)}` }
}

// The desktop app puts hidden <system-reminder> notes in front of what the user typed; the request is what follows.
export const splitNotes = (text: string) => {
  const head = /^(\s*<system-reminder>[\s\S]*?<\/system-reminder>)*\s*/.exec(text)?.[0] ?? ''
  return { head, body: text.slice(head.length) }
}

// Claude's side of the list: it reads it, and may flag an open item as looking finished. Only the person ticks it.
export const todoListText = (list: readonly Todo[]) =>
  list.length ? list.map((t, i) => `${i + 1}. [${t.done ? 'x' : ' '}] ${t.text}${t.suggested ? ' (flagged, waiting for the user to review)' : ''}`).join('\n') : 'The to-do list is empty.'
export const suggestDone = (list: readonly Todo[], n: number, why: string): { list: Todo[]; text: string; flagged?: string } => {
  const t = list[n - 1]
  if (!t) return { list: [...list], text: `There is no item ${n}.\n${todoListText(list)}` }
  if (t.done) return { list: [...list], text: `Item ${n} is already ticked.` }
  const reason = why.trim().slice(0, 160) || 'looks finished'
  return { list: list.map((x, j) => (j === n - 1 ? { ...x, suggested: reason } : x)), flagged: t.text,
    text: `Flagged "${t.text}" for the user to review. Tell them you think it is done and why; do not say it is ticked, they tick it themselves.` }
}

// "0.14.0" vs "0.13.3": true when a is a later version than b. Anything unparsable counts as not newer.
export const newer = (a: string, b: string) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number)
  if ([...x, ...y].some(n => !Number.isInteger(n))) return false
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}

// Usage reads that keep failing wait longer each time: 10 s, 20 s, 40 s … up to 10 minutes.
export const backoff = (fails: number) => Math.min(600_000, 10_000 * 2 ** Math.max(0, fails - 1))

// The home folder itself is never a project (graphify would map everything in it), on any system.
export const isHome = (cwd: string, home: string) => {
  const n = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return !!home && n(cwd) === n(home)
}

// ---------- Settings: each choice in plain words, with the number behind it. 0 = never.
export type Choice = { key: string; label: string; help: string; options: readonly (readonly [string, number])[]; def: number }
export const CHOICES: readonly Choice[] = [
  { key: 'longAt', label: 'Start a new chat when this one gets long', def: 150_000,
    help: 'Claude re-reads the whole chat for every message, so a long chat costs more each time. The new chat gets a short note of what was done.',
    options: [['Sooner', 100_000], ['Normal', 150_000], ['Later', 250_000], ['Never', 0]] },
  { key: 'freshAt', label: 'Start a new chat when I switch to a different task', def: 60_000,
    help: 'Only for a new, unrelated task, and only once the chat is bigger than this.',
    options: [['Sooner', 40_000], ['Normal', 60_000], ['Later', 100_000], ['Never', 0]] },
  { key: 'lockAt', label: 'Stop switching models once a chat is', def: 30_000,
    help: 'Switching models in a long chat makes Claude re-read all of it, which costs about as much as 30 normal messages. Effort can still change.',
    options: [['Short', 15_000], ['Medium', 30_000], ['Long', 60_000]] },
]
// A stored value only counts when it is one of the options; anything else is the default.
export const choiceValue = (c: Choice, stored: unknown) => (c.options.some(([, n]) => n === stored) ? (stored as number) : c.def)
export const sizeText = (n: number) => (n === 0 ? 'never' : `${Math.round(n / 1000)}k tokens`)
