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

// Haiku names a model and an effort ("OPUS MEDIUM"): any pairing, so both models get every effort.
// An old-style tier word ("HARD") still works.
export const parseRoute = (answer: string): Route | undefined => {
  const up = answer.toUpperCase()
  // Haiku only routes; a stray HAIKU answer gets Sonnet's lowest rung, so main replies stay on Sonnet or Opus.
  if (up.includes('HAIKU')) return { family: 'sonnet', effort: 'low', tier: 'TRIVIAL', reason: 'quick task' }
  const family: Family | undefined = up.includes('OPUS') ? 'opus' : up.includes('SONNET') ? 'sonnet' : undefined
  const effort = [...EFFORTS].reverse().find(e => up.includes(e.toUpperCase())) // xhigh before high
  if (!family || !effort) { const t = parseTier(answer); return t && routeFor(t) }
  const tier = TIERS[EFFORTS.indexOf(effort)]!
  // "Sonnet, but high effort" means Haiku found it hard: hard work goes to Opus. Measured: it gave that answer for open bugs and deep explanations.
  const hard = EFFORTS.indexOf(effort) >= EFFORTS.indexOf('high')
  return { family: hard ? 'opus' : family, effort, tier, reason: TABLE[tier][2] }
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
  // Straight to high: each rung in between was one more wrong answer, which costs far more than the extra effort.
  if (i < EFFORTS.indexOf('high')) return { ...route, effort: 'high', tier: 'HARD', reason, escalated: true }
  return route.family === 'sonnet' ? { ...route, family: 'opus', reason, escalated: true } : null
}

// Model lock: a model switch in a long chat rewrites its whole cached conversation (measured ~30x a normal turn),
// so above LOCK_AT chat tokens nothing switches automatically, up or down; effort may (measured: cache kept).
// Escalation may pass only under a small cost cap.
export const LOCK_AT = 30_000
export const RANK: Record<Family, number> = { haiku: 0, sonnet: 1, opus: 2 }
// Low effort only when it is the person's own setting: otherwise a "trivial" guess runs at medium, which costs little on a small job.
export const floorEffort = <E>(effort: E, own: unknown): E | 'medium' => (effort === 'low' && own !== 'low' ? 'medium' : effort)
export const ESCALATE_MAX_USD = 0.4
const WRITE_PER_M = { opus: 5, sonnet: 2.5, haiku: 0.125 } // $ per million cache-write tokens
// "Keep going" holds for the next 50k of chat, then Shorten is offered again; a chat that shrank since (/compact) starts over.
export const KEEP_GOING_FOR = 50_000
export const keepGoingHolds = (chat: number, keptAt: number | undefined) => keptAt !== undefined && chat >= keptAt && chat < keptAt + KEEP_GOING_FOR
export const isLocked = (chatTokens: number, at = LOCK_AT) => chatTokens > at
// Past an hour the cache has expired, so the next message re-writes the chat on any model: a switch costs nothing extra.
export const COLD_AFTER_MS = 3_600_000
export const isCold = (lastTurnAt: number | undefined, now: number) => lastTurnAt !== undefined && now - lastTurnAt > COLD_AFTER_MS
// A chat's start-up size is its first reply's context; anything bigger than this is a reopened chat, not a start.
export const START_MAX = 150_000
export const rewriteUsd = (tokens: number, model = 'opus') =>
  (tokens * WRITE_PER_M[/haiku/i.test(model) ? 'haiku' : /sonnet/i.test(model) ? 'sonnet' : 'opus']) / 1e6
export const canEscalate = (lock: number | undefined, model = 'opus') => lock === undefined || rewriteUsd(lock, model) <= ESCALATE_MAX_USD
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

// What changed since `mine`, from a CHANGELOG.md whose sections start "## 0.21.0": the bullets of every newer version, newest first.
export const changesSince = (md: string, mine: string, max = 8) => {
  const out: string[] = []
  let take = false
  for (const line of md.split(/\r?\n/)) {
    const h = /^##\s+v?(\d+(?:\.\d+)*)/.exec(line)
    if (h) take = newer(h[1]!, mine)
    else if (take && /^\s*[-*]\s+/.test(line)) out.push(line.replace(/^\s*[-*]\s+/, '').trim())
  }
  return out.length > max ? [...out.slice(0, max - 1), `…and ${out.length - max + 1} more on GitHub`] : out
}

// Plugins only when asked. A listing line "- plugin:name: description" becomes the name alone, grouped by plugin, so Claude still
// knows each one exists but pays for none of the descriptions. The app's own skills (anthropic-skills) and this mod's stay whole.
export const ON_DEMAND_NOTE = 'Plugin skills and agents, by name only (call one as plugin:name). Use one only when the user asks for it or names it.'
const KEEP = new Set(['anthropic-skills', 'autopilot'])
export const trimListing = (text: string) => {
  const kept: string[] = [], groups = new Map<string, string[]>()
  let keeping = true // lines that do not start "- " continue the entry above them
  for (const line of text.split('\n')) {
    const m = /^- ([\w.-]+):([\w.:-]+?)(?::\s|$)/.exec(line)
    if (m && !KEEP.has(m[1]!)) {
      groups.set(m[1]!, [...(groups.get(m[1]!) ?? []), m[2]!])
      keeping = false
    } else if (line.startsWith('- ') || keeping) {
      kept.push(line)
      keeping = true
    }
  }
  if (!groups.size) return text
  return [...kept, ON_DEMAND_NOTE, ...[...groups].map(([p, names]) => `- ${p}: ${names.join(', ')}`)].join('\n')
}
// Plugins that load themselves into every chat's start: their block is cut, the rest of the same text stays.
const START_TEXTS = [
  /<EXTREMELY_IMPORTANT>\s*You have superpowers\.[\s\S]*?<\/EXTREMELY_IMPORTANT>\s*/, // Superpowers
  /PONYTAIL MODE ACTIVE[\s\S]*?## Levels[^\n]*\n+(?:\|[^\n]*(?:\n|$))+/, // Ponytail at a chat's start
  /Ponytail is active for this prompt:[^\n]*\n?/, // Ponytail's per-message reminder
]
export const cutStartTexts = (text: string) => START_TEXTS.reduce((t, re) => t.replace(re, ''), text)

// The settings.json entry Claude installs Autopilot from, pinned to a release tag (`v0.19.0`) or, with no tag, following the latest.
export const AP_REPO = 'ImLiquify/claude-autopilot'
const AP_SOURCE = /("autopilot"\s*:\s*\{\s*"source"\s*:\s*)\{[^{}]*\}/
export const pinnedTag = (settings: string) => /"ref"\s*:\s*"([^"]*)"/.exec(AP_SOURCE.exec(settings)?.[0] ?? '')?.[1]
export const pinSource = (settings: string, tag?: string) =>
  settings.replace(AP_SOURCE, (_, head: string) => `${head}{ "source": "github", "repo": "${AP_REPO}"${tag ? `, "ref": "${tag}"` : ''} }`)

// A warning before a usage limit is hit: once at 80% and once at 95% of each window. `last` is the key of the last one shown, shared by all chats.
// The reset time is rounded to 10 minutes, because two readings of one window can differ by seconds.
export const limitWarning = (w: Window | undefined, last: unknown): { level: number; key: string } | undefined => {
  const level = w?.resetsAt ? [95, 80].find(l => w.pct >= l) : undefined
  if (!w || !level) return undefined
  const win = Math.round(Date.parse(w.resetsAt!) / 600_000)
  return last === `${win}:${level}` || last === `${win}:95` ? undefined : { level, key: `${win}:${level}` }
}

// /why: this chat's last model picks from the routing log, in plain words.
export type TraceRow = { event?: string; chat?: string; routed?: boolean; text?: string; reason?: string; route?: { family: string; effort: string; reason: string } | null }
export const whyText = (rows: readonly TraceRow[], chat: string) => {
  const out: string[] = []
  let said = ''
  for (const r of rows) {
    if (r.chat !== chat) continue
    if (r.event === 'prompt' && r.routed) said = (r.text ?? '').replace(/\s+/g, ' ').trim()
    if (r.event === 'routed') out.push(`"${said}" → ${r.route ? `${modelName(r.route.family)} · ${r.route.effort} (${r.route.reason})` : 'your own model and effort'}`)
    if (r.event === 'shorten') out.push(`Shortened the chat: ${(r.reason ?? '').replace(/^\W+/, '')}`)
  }
  return out.length ? out.slice(-6).join('\n') : 'No model picks logged for this chat yet. Send a message first.'
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
  // 100k of chat on top of the start-up size: past that every step re-reads a lot and answers get vaguer, and a 200k-window model is near its own limit.
  { key: 'longAt', label: 'Shorten a chat when it gets long', def: 100_000,
    help: 'Claude re-reads the whole chat for every message, so a long chat costs more each time. Autopilot runs /compact on it: same chat, the older part summarized, the latest messages kept.',
    options: [['Sooner', 70_000], ['Normal', 100_000], ['Later', 150_000], ['Never', 0]] },
  { key: 'freshAt', label: 'Shorten the chat when I switch to a different task', def: 60_000,
    help: 'Only for a new, unrelated task, and only once the chat is bigger than this. Runs /compact with a short summary: same chat, nothing deleted.',
    options: [['Sooner', 40_000], ['Normal', 60_000], ['Later', 100_000], ['Never', 0]] },
  { key: 'lockAt', label: 'Stop switching models once a chat is', def: 30_000,
    help: 'Switching models in a long chat makes Claude re-read all of it, which costs about as much as 30 normal messages. Effort can still change, and the model can again after /compact or an hour away.',
    options: [['Short', 30_000], ['Medium', 60_000], ['Long', 100_000]] },
]
// A stored value only counts when it is one of the options; anything else is the default.
export const choiceValue = (c: Choice, stored: unknown) => (c.options.some(([, n]) => n === stored) ? (stored as number) : c.def)
export const sizeText = (n: number) => (n === 0 ? 'never' : `${Math.round(n / 1000)}k tokens`)

// --- Hand-off: a long job runs in a helper's own small chat, so its steps stop re-reading this one.
export type Hand = 'worker' | 'expert'
// The check's last word. Anything else (SOLO, a missing word) keeps the job in the chat.
export const parseHand = (answer: string): Hand | undefined => (/\bWORKER\b/i.test(answer) ? 'worker' : /\bEXPERT\b/i.test(answer) ? 'expert' : undefined)
export const HAND_MARK = 'Autopilot hand-off:'
export const HAND_MIN_CHAT = 30_000
// A helper only pays off when the chat is big enough to be worth not re-reading, or when the helper's model is cheaper than the chat's.
export const worthHanding = (hand: Hand, chat: number, main: Family) => chat >= HAND_MIN_CHAT || (hand === 'worker' && RANK[main] > RANK.sonnet)
export const handNote = (hand: Hand) => `<system-reminder>${HAND_MARK} this looks like a long job, and every step done in this chat re-reads the whole chat. Unless one of the exceptions below applies, do not do the steps yourself:
1. Write a brief that stands alone, because the helper sees nothing of this chat: the goal, every file path, name, value and preference from this chat that the job depends on, what must not be touched, and what done looks like.
2. Spawn autopilot:${hand} with that brief (several at once when parts of the job are independent).
3. When it reports, check the result yourself against what the user asked: open what it made or run it. Fix small things yourself and send bigger ones back to the helper.
4. Tell the user what was done and what you checked.
Do the job yourself instead when it turns out to be only a few steps, when it needs the user's answers along the way, when it depends on images or files that only exist in this chat, when it needs a browser, another app or a connector (the helper only has files, the command line and web search). A build still goes to the helper: describe the look and feel you want in the brief in detail (layout, colours, motion, polish). When it reports, open the result, and if it looks plainer than what you would have made yourself, improve the look yourself before you answer.</system-reminder>`

// Estimated API prices per million tokens (input, output): only used to compare a helper's cost with doing the same steps in the chat.
const PRICE: Record<Family, [number, number]> = { haiku: [0.5, 2.5], sonnet: [2, 10], opus: [5, 25] }
export type Tokens = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }
export const HELPER_START = 10_000 // a helper's own start-up (system prompt and tools), which the chat would not have paid again
const costOf = (u: Tokens, f: Family) => (u.input_tokens * PRICE[f][0] + u.cache_creation_input_tokens * PRICE[f][0] * 2 + u.cache_read_input_tokens * PRICE[f][0] * 0.1 + u.output_tokens * PRICE[f][1]) / 1e6
// What the hand-off cost against the same steps done in the chat: the same tokens at the chat's model (less the helper's own start-up,
// which the chat would not have paid), plus the chat re-read on every step. A job too short to pay the start-up back shows as a loss.
export const handResult = (u: Tokens, helper: Family, main: Family, steps: number, chatTokens: number) => {
  // The chat's own share of a hand-off: about two extra steps (writing the brief, checking the report) and the brief's text.
  const cost = costOf(u, helper) + (2 * chatTokens * PRICE[main][0] * 0.1 + 1500 * PRICE[main][1]) / 1e6
  const startUp = (Math.min(u.cache_creation_input_tokens, HELPER_START) * PRICE[main][0] * 2) / 1e6
  const solo = costOf(u, main) - startUp + (steps * chatTokens * PRICE[main][0] * 0.1) / 1e6
  return { cost, solo, saved: solo - cost }
}
// The last hand-offs' savings: paused when the last five together lost.
export type HandTally = { n: number; saved: number; last: number[]; paused?: boolean }
export const tallyHand = (t: HandTally | undefined, saved: number): HandTally => {
  const last = [...(t?.last ?? []), saved].slice(-5)
  return { n: (t?.n ?? 0) + 1, saved: (t?.saved ?? 0) + saved, last, paused: last.length === 5 && last.reduce((a, b) => a + b, 0) < 0 }
}
