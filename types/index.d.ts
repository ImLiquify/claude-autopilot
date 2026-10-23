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
}

export type ApTodo = { text: string; done: boolean }

declare module 'claude-code' {
  interface PluginState {
    autopilot: { view: ApView; todos: ApTodo[] }
  }
}
