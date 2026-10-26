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
  off?: boolean // the on/off switch: off, Autopilot leaves prompts, models and effort to the engine
  prefsOpen?: boolean // the settings card (⚙ beside ＋) is expanded
  prefs?: Record<string, boolean | number> // settings: switches (true = on) and sizes in tokens (0 = never)
  offer?: { text: string; body: string; topic: string; oldId: string; why: string } // a fresh start waiting for Start fresh / Keep going
  usageDown?: boolean // usage reads keep failing: old figures show as unavailable
  update?: string // a newer version on GitHub, shown as a notice with an Update button
  updating?: boolean
}

export type ApTodo = { text: string; done: boolean; suggested?: string } // suggested: Claude's reason, awaiting review

declare module 'claude-code' {
  interface PluginState {
    autopilot: { view: ApView; todos: ApTodo[] }
  }
}
