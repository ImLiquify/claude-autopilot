export type ApRoute = { family: 'haiku' | 'sonnet' | 'opus'; effort: 'low' | 'medium' | 'high' | 'xhigh'; tier: 'TRIVIAL' | 'NORMAL' | 'HARD' | 'HEAVY'; reason: string; escalated?: boolean }
export type ApWindow = { pct: number; resetsAt?: string }
export type ApView = {
  route: ApRoute | null
  mode: 'auto' | 'opus' | 'sonnet' | 'off'
  five?: ApWindow
  week?: ApWindow
  ctx?: number
  life?: number
  maxEffort?: string // Settings: the highest effort the router may use
  settings?: boolean // Settings row open
  lock?: number
  used?: { model: string; effort?: string }
  now: number
  note?: string
  pose?: 'idle' | 'think' | 'work' // the mascot: blinking, thinking, walking
  todoOpen?: boolean // the to-do card under the bar is expanded
  mini?: boolean // minimized: only the crab and the session ring show
  off?: boolean // the on/off switch: off, Autopilot leaves prompts, models and effort to the engine
  prefsOpen?: boolean // the settings card (⚙ beside ＋) is expanded
  prefs?: Record<string, boolean | number> // settings: switches (true = on) and sizes in tokens (0 = never)
  offer?: { text: string; why: string; up?: boolean; focus?: string } // a shorten waiting for an answer; up: a move to a stronger model; focus: what the summary keeps
  usageDown?: boolean // usage reads keep failing: old figures show as unavailable
  update?: string // a newer version on GitHub, shown as a notice with an Update button
  notes?: string[] // what changed since this copy's version, from GitHub's CHANGELOG.md
  notesOpen?: boolean // the update notice's "What's new" list is expanded
  updating?: boolean
  why?: string // Settings: the /why text, shown inline while open
  addons?: Record<string, boolean> // add-ons by other authors: installed or not
  addonBusy?: string // the add-on being installed right now
  addonsAsk?: boolean // first run: offer to install the missing add-ons
  ponytail?: boolean // the Ponytail plugin is on: Settings offers to turn it off
  clean?: ApClean // the Clean card: scan results, then turn off, then ask to delete
}

export type ApCleanItem = { id: string; kind: 'plugin' | 'skill'; name: string; reason: string; tokens: number; pick: boolean; last?: number }
export type ApClean = {
  phase: 'scanning' | 'list' | 'working' | 'ask' | 'done'; items: ApCleanItem[]; notes: string[]; picked: string[]; off?: string[]; msg?: string
  stats?: { chats: number; start: number; long: number } // this month's chats: how many, the usual start-up size, how many went past 150k
}

export type ApTodo = { text: string; done: boolean; suggested?: string } // suggested: Claude's reason, awaiting review

declare module 'claude-code' {
  interface PluginState {
    autopilot: { view: ApView; todos: ApTodo[] }
  }
}
