// Clean-up helper for the Autopilot mod: no model calls, no tokens.
//   node clean.js scan              -> JSON: what is installed, what was used in the last 30 days, and what to turn off
//   node clean.js off '<json ids>'  -> turns those off (plugins: settings.json; skills: moved to ~/.claude/autopilot/skills-off)
//   node clean.js delete '<ids>'    -> removes turned-off skills for good (plugins are uninstalled by the mod with `claude plugin uninstall`)
//   node clean.js restore           -> undoes every "off" still on record
// An id is "plugin:<name@marketplace>" or "skill:<folder>".
const fs = require('fs'), path = require('path'), os = require('os')
const home = process.env.CLEAN_HOME || os.homedir()
const root = path.join(home, '.claude')
const DAY = 864e5, UNUSED_DAYS = 30, NEW_DAYS = 14
// One use is logged on several lines, so uses are counted in days.
// Used on one or two days in a month and costing this much in every message: listed (not ticked), so the person can weigh it.
const RARE_USES = 2, RARE_TOKENS = 150
const now = Number(process.env.CLEAN_NOW || Date.now())
const offDir = path.join(root, 'autopilot', 'skills-off')
const record = path.join(root, 'autopilot', 'clean-off.json')
const SELF = /^autopilot@/

const readJson = (p, def) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return def } }
const exists = p => { try { fs.lstatSync(p); return true } catch { return false } }
const isDir = p => { try { return fs.statSync(p).isDirectory() } catch { return false } }

// Every SKILL.md under a folder, a few levels deep: plugins nest them as skills/<name>/SKILL.md or deeper.
const skillsIn = (dir, depth = 4) => {
  const out = []
  const walk = (d, n) => {
    let es; try { es = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of es) {
      if (e.name === 'node_modules' || e.name.startsWith('.git')) continue
      const p = path.join(d, e.name)
      if (e.name === 'SKILL.md') out.push(p)
      else if (n > 0 && (e.isDirectory() || e.isSymbolicLink()) && isDir(p)) walk(p, n - 1)
    }
  }
  walk(dir, depth)
  return out
}
// The listing Claude reads every message is the skill's name and description, about 4 characters a token.
const skillMeta = file => {
  const text = (() => { try { return fs.readFileSync(file, 'utf8').slice(0, 4000) } catch { return '' } })()
  const fm = /^---\s*\n([\s\S]*?)\n---/.exec(text)?.[1] ?? ''
  const name = /^name:\s*["']?(.+?)["']?\s*$/m.exec(fm)?.[1] ?? path.basename(path.dirname(file))
  const desc = /^description:\s*([\s\S]*?)(?=\n[\w-]+:|$)/m.exec(fm)?.[1] ?? ''
  return { name, tokens: Math.ceil((name.length + desc.trim().length) / 4), nameTokens: Math.ceil(name.length / 4) + 1 }
}

// What was used: Skill calls, slash commands, subagent types, MCP tools and SKILL.md reads, newest time per name.
// Each line carries its own timestamp, so an old chat reopened today does not make its old uses look recent.
const USE = /"skill":"([^"\\]+)"|<command-name>\/?([^<\s]+)<\/command-name>|"subagent_type":"([^"\\]+)"|"name":"(mcp__[A-Za-z0-9_-]+?)__|"file_path":"[^"]*?skills[\\/]+([A-Za-z0-9_.-]+)[\\/]+SKILL\.md"/g
// Each main chat's size, from the usage on its replies: the first reply is what a new chat starts with, the largest is how long it got.
const num = (re, s) => Number(re.exec(s)?.[1] ?? 0)
const ctxOf = line => num(/"input_tokens":(\d+)/, line) + num(/"cache_creation_input_tokens":(\d+)/, line) + num(/"cache_read_input_tokens":(\d+)/, line)
const usage = () => {
  const last = new Map(), count = new Map(), chats = [], dirs = new Set()
  const seen = (k, t) => { if (!k) return; count.set(k, (count.get(k) ?? new Set()).add(Math.floor(t / DAY))); if (!(last.get(k) >= t)) last.set(k, t) }
  const walk = d => {
    let es; try { es = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of es) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) { walk(p); continue }
      if (!e.name.endsWith('.jsonl')) continue
      const t = fs.statSync(p).mtimeMs
      if (now - t > UNUSED_DAYS * DAY) continue
      const main = !e.name.startsWith('agent-') && !p.includes(`${path.sep}subagents${path.sep}`)
      let start = 0, peak = 0
      for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
        if (main && line.includes('"type":"assistant"') && line.includes('"usage"') && !line.includes('"isSidechain":true')) {
          const c = ctxOf(line)
          if (c > 0) { if (!start) start = c; if (c > peak) peak = c }
        }
        if (main && dirs.size < 200) { const cwd = /"cwd":"((?:[^"\\]|\\.)+)"/.exec(line)?.[1]; if (cwd) dirs.add(JSON.parse(`"${cwd}"`)) }
        const ms = [...line.matchAll(USE)]
        if (!ms.length) continue
        const at = Date.parse(/"timestamp":"([^"]+)"/.exec(line)?.[1] ?? '') || t
        if (now - at > UNUSED_DAYS * DAY) continue
        for (const m of ms) seen(m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5], at)
      }
      if (start) chats.push({ start, peak })
    }
  }
  walk(path.join(root, 'projects'))
  return { last, count, chats, dirs }
}
const sizeOf = p => { try { return fs.statSync(p).size } catch { return 0 } }
const k = chars => `${Math.max(1, Math.round(chars / 4000))}k`
// Files a CLAUDE.md pulls in with "@path" lines are sent with it.
const imports = (file, text) => [...text.matchAll(/^@(\S+)/gm)].map(m => {
  const p = m[1].startsWith('~') ? path.join(home, m[1].slice(1)) : path.resolve(path.dirname(file), m[1])
  return { p, size: sizeOf(p) }
})
// Hook events that cost tokens on their own: text added to every message you send, or a check that can make Claude keep working.
const COSTLY = {
  UserPromptSubmit: 'runs on every message you send and can add text to it',
  Stop: 'runs every time Claude finishes a reply and can make Claude keep working',
  SubagentStop: 'runs every time a helper agent finishes and can make it keep working',
}
const hookEvents = file => Object.keys(readJson(file, {})?.hooks ?? {}).filter(e => COSTLY[e])

// The record can name an old version folder after an update; the newest folder beside it is the one in use.
const installDir = p => {
  if (!p) return undefined
  if (isDir(p)) return p
  const up = path.dirname(p)
  const vs = (() => { try { return fs.readdirSync(up).filter(v => isDir(path.join(up, v))) } catch { return [] } })()
  return vs.length ? path.join(up, vs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop()) : undefined
}

// lean: the mod lists other plugins' skills by name only, so a plugin's skills cost a few tokens each, not their descriptions.
const scan = lean => {
  const settings = readJson(path.join(root, 'settings.json'), {})
  const enabled = settings.enabledPlugins ?? {}
  const installed = readJson(path.join(root, 'plugins', 'installed_plugins.json'), { plugins: {} }).plugins ?? {}
  const { last: used, count, chats, dirs } = usage()
  const lastOf = keys => Math.max(0, ...keys.map(k => used.get(k) ?? 0))
  const usesOf = keys => new Set(keys.flatMap(k => [...(count.get(k) ?? [])])).size
  const rare = (keys, last) => `used on only ${usesOf(keys)} day${usesOf(keys) === 1 ? '' : 's'} in the last ${UNUSED_DAYS} (last ${Math.max(0, Math.round((now - last) / DAY))} days ago)`
  const items = [], notes = []

  const plugins = []
  for (const [id, on] of Object.entries(enabled)) {
    if (!on || SELF.test(id)) continue
    const name = id.split('@')[0]
    const inst = (installed[id] ?? []).map(x => ({ ...x, installPath: installDir(x.installPath) })).find(x => x.installPath)
    if (!inst) { items.push({ id: `plugin:${id}`, kind: 'plugin', name, reason: 'broken: turned on but not installed', tokens: 0, pick: true }); continue }
    const skills = skillsIn(inst.installPath).map(skillMeta)
    const agents = (() => { try { return fs.readdirSync(path.join(inst.installPath, 'agents')).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)) } catch { return [] } })()
    const hooks = exists(path.join(inst.installPath, 'hooks', 'hooks.json'))
    const costly = hooks ? hookEvents(path.join(inst.installPath, 'hooks', 'hooks.json')) : []
    const mcp = exists(path.join(inst.installPath, '.mcp.json'))
    const keys = [...skills.flatMap(s => [`${name}:${s.name}`, s.name]), ...agents.map(a => `${name}:${a}`), name, `mcp__plugin_${name}`, `mcp__plugin_${name.replace(/-/g, '_')}`]
    for (const k of [...used.keys()]) if (k.startsWith(`${name}:`) || k.startsWith(`mcp__plugin_${name}_`)) keys.push(k)
    const last = lastOf(keys)
    const age = (now - Date.parse(inst.installedAt ?? 0)) / DAY
    const tokens = skills.reduce((n, s) => n + (lean ? s.nameTokens : s.tokens), 0)
    plugins.push({ id, name, skills })
    const base = { id: `plugin:${id}`, kind: 'plugin', name, tokens, last: last || undefined }
    const n0 = items.length
    if (!skills.length && !agents.length && !hooks && !mcp) items.push({ ...base, reason: 'broken: it has no skills, agents, hooks or tools', pick: true })
    else if (!last && hooks) notes.push(`${name} runs on every chat through its hooks, so the logs cannot show whether it helps. Keep it only if you rely on it.`)
    else if (!last && age >= NEW_DAYS) items.push({ ...base, reason: `not used in ${UNUSED_DAYS} days`, pick: true })
    else if (last && age >= NEW_DAYS && tokens >= RARE_TOKENS && usesOf(keys) <= RARE_USES) items.push({ ...base, reason: rare(keys, last), pick: false })
    // Kept, but with a hook that spends tokens by itself: listed (not ticked) so the cost is visible.
    if (items.length === n0 && costly.length) items.push({ ...base, reason: `its hook ${costly.map(e => COSTLY[e]).join('; ')}`, pick: false })
  }

  const own = (() => { try { return fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true }) } catch { return [] } })()
  for (const e of own) {
    const dir = path.join(root, 'skills', e.name)
    if (!isDir(dir)) { if (exists(dir)) items.push({ id: `skill:${e.name}`, kind: 'skill', name: e.name, reason: 'broken: the link leads nowhere', tokens: 0, pick: true }); continue }
    const file = path.join(dir, 'SKILL.md')
    if (!exists(file)) continue // a folder of skills (e.g. synced), not a skill
    const meta = skillMeta(file)
    const last = lastOf([meta.name, e.name])
    const age = (now - fs.lstatSync(dir).mtimeMs) / DAY
    const dup = plugins.find(p => p.skills.some(s => s.name === meta.name))
    const base = { id: `skill:${e.name}`, kind: 'skill', name: e.name, tokens: meta.tokens, last: last || undefined }
    if (dup) items.push({ ...base, reason: `duplicate: the ${dup.name} plugin has a skill with the same name`, pick: !last })
    else if (!last && age >= NEW_DAYS) items.push({ ...base, reason: `not used in ${UNUSED_DAYS} days`, pick: true })
    else if (last && age >= NEW_DAYS && meta.tokens >= RARE_TOKENS && usesOf([meta.name, e.name]) <= RARE_USES) items.push({ ...base, reason: rare([meta.name, e.name], last), pick: false })
  }

  // Plugins the desktop app manages (installed, not listed in settings.json): the mod cannot switch them, so it only reports them.
  for (const id of Object.keys(installed)) {
    if (id in enabled || SELF.test(id)) continue
    const name = id.split('@')[0]
    if (![...used.keys()].some(k => k.startsWith(`${name}:`) || k.startsWith(`mcp__plugin_${name}_`))) notes.push(`${name} has not been used in ${UNUSED_DAYS} days, but the desktop app manages it: remove it in its plugin settings.`)
  }

  let claudeMd = ''
  const mdFile = path.join(root, 'CLAUDE.md')
  try { claudeMd = fs.readFileSync(mdFile, 'utf8') } catch {}
  const pulled = imports(mdFile, claudeMd)
  const mdSize = claudeMd.length + pulled.reduce((n, i) => n + i.size, 0)
  if (mdSize > 16000) notes.push(`Your global CLAUDE.md${pulled.length ? ` and the ${pulled.length} file${pulled.length === 1 ? '' : 's'} it imports` : ''} come to about ${k(mdSize)} tokens, sent with every message. Shorten it to the rules you need in every chat.`)
  for (const i of pulled) if (!i.size) notes.push(`CLAUDE.md imports ${i.p}, which does not exist.`)
  for (const m of claudeMd.matchAll(/~\/\.claude\/skills\/([A-Za-z0-9_.-]+)/g)) if (!exists(path.join(root, 'skills', m[1]))) notes.push(`CLAUDE.md names the ${m[1]} skill, which is not installed.`)

  // CLAUDE.md files of the projects you worked in this month: each is sent with every message in that project.
  for (const d of dirs) for (const f of [path.join(d, 'CLAUDE.md'), path.join(d, '.claude', 'CLAUDE.md'), path.join(d, 'CLAUDE.local.md')]) {
    const s = sizeOf(f)
    if (s > 16000) notes.push(`${f} is about ${k(s)} tokens, sent with every message in that project. Shorten it to what Claude needs on every task.`)
  }
  // Memory indexes: each project's MEMORY.md is loaded at the start of every chat there.
  for (const p of (() => { try { return fs.readdirSync(path.join(root, 'projects')) } catch { return [] } })()) {
    const f = path.join(root, 'projects', p, 'memory', 'MEMORY.md'), s = sizeOf(f)
    if (s > 6000) notes.push(`The memory index ${f} is about ${k(s)} tokens and loads in every chat of that project. Merge or remove old entries.`)
  }
  // Your own hooks in settings.json.
  for (const [ev, list] of Object.entries(settings.hooks ?? {})) {
    if (!COSTLY[ev]) continue
    for (const h of (Array.isArray(list) ? list : []).flatMap(x => x?.hooks ?? [])) {
      const what = String(h?.command ?? h?.prompt ?? h?.type ?? 'a hook').replace(/\s+/g, ' ').slice(0, 70)
      notes.push(`Your settings.json has a ${ev} hook (${what}) that ${COSTLY[ev]}. Keep it only if you rely on it.`)
    }
  }
  // MCP servers you added yourself (~/.claude.json): unused ones still list their tools in every chat.
  const cj = readJson(path.join(home, '.claude.json'), {})
  const servers = [...Object.keys(cj.mcpServers ?? {}).map(n => [n, 'all chats']), ...Object.entries(cj.projects ?? {}).flatMap(([p, v]) => Object.keys(v?.mcpServers ?? {}).map(n => [n, p]))]
  for (const [n, where] of servers) {
    const key = `mcp__${n.replace(/[^A-Za-z0-9_-]/g, '_')}`
    if (![...used.keys()].some(u => u === key || u.startsWith(`${key}_`))) notes.push(`The MCP server ${n} (${where === 'all chats' ? 'on in every chat' : `in ${where}`}) was not used in ${UNUSED_DAYS} days. Remove it with: claude mcp remove ${n}${where === 'all chats' ? ' -s user' : ''}`)
  }
  // Your own agents and slash commands are listed in every chat too.
  for (const [dir, what, keyOf] of [['agents', 'agent', n => n], ['commands', 'command', n => n]]) {
    for (const f of (() => { try { return fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.md')) } catch { return [] } })()) {
      const n = f.slice(0, -3)
      if (!used.has(keyOf(n)) && (now - fs.statSync(path.join(root, dir, f)).mtimeMs) / DAY >= NEW_DAYS) notes.push(`Your ${what} ${n} (~/.claude/${dir}/${f}) was not used in ${UNUSED_DAYS} days and is listed in every chat. Move it out of that folder if you do not need it.`)
    }
  }

  // What chats cost this month: where a new chat starts, and how many grew long (every message re-reads the whole chat).
  const starts = chats.map(c => c.start).sort((a, b) => a - b)
  const stats = { chats: chats.length, start: starts.length ? starts[Math.floor(starts.length / 2)] : 0, long: chats.filter(c => c.peak > 150000).length }

  const names = [...plugins.map(p => p.name), ...own.map(e => e.name)]
  // Ticked ones first, then the most expensive.
  items.sort((a, b) => Number(b.pick) - Number(a.pick) || b.tokens - a.tokens)
  return { items, notes: [...new Set(notes)], names, claudeMd: claudeMd.slice(0, 12000), stats }
}

const settingsFile = path.join(root, 'settings.json')
const off = ids => {
  const rec = readJson(record, [])
  const plugins = ids.filter(i => i.startsWith('plugin:')).map(i => i.slice(7))
  if (plugins.length) {
    const s = readJson(settingsFile, null)
    if (!s) throw new Error('settings.json could not be read')
    fs.mkdirSync(path.join(root, 'autopilot'), { recursive: true })
    fs.copyFileSync(settingsFile, path.join(root, 'autopilot', `settings-before-clean-${now}.json`))
    for (const id of plugins) { s.enabledPlugins = { ...s.enabledPlugins, [id]: false }; rec.push(`plugin:${id}`) }
    fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2) + '\n')
  }
  for (const i of ids.filter(i => i.startsWith('skill:'))) {
    const name = path.basename(i.slice(6)), from = path.join(root, 'skills', name), to = path.join(offDir, name)
    if (!exists(from) || exists(to)) continue
    fs.mkdirSync(offDir, { recursive: true })
    fs.renameSync(from, to) // a link moves as a link: what it points to is untouched
    rec.push(`skill:${name}`)
  }
  fs.writeFileSync(record, JSON.stringify([...new Set(rec)], null, 2))
  return { off: ids.length }
}
const forget = ids => fs.writeFileSync(record, JSON.stringify(readJson(record, []).filter(i => !ids.includes(i)), null, 2))
const del = ids => {
  const done = []
  for (const i of ids.filter(i => i.startsWith('skill:'))) {
    const p = path.join(offDir, path.basename(i.slice(6)))
    if (!exists(p)) continue
    fs.rmSync(p, { recursive: true, force: true }) // removes a link itself, never the folder it points to
    done.push(i)
  }
  forget(ids)
  return { deleted: done.length }
}
const restore = () => {
  const rec = readJson(record, [])
  const s = readJson(settingsFile, null)
  for (const i of rec) {
    if (i.startsWith('plugin:') && s) s.enabledPlugins = { ...s.enabledPlugins, [i.slice(7)]: true }
    if (i.startsWith('skill:')) { const n = i.slice(6), from = path.join(offDir, n), to = path.join(root, 'skills', n); if (exists(from) && !exists(to)) fs.renameSync(from, to) }
  }
  if (s && rec.some(i => i.startsWith('plugin:'))) fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2) + '\n')
  fs.writeFileSync(record, '[]')
  return { restored: rec.length }
}

const [cmd, arg] = process.argv.slice(2)
const ids = () => { const a = JSON.parse(arg || '[]'); if (!Array.isArray(a) || a.some(x => typeof x !== 'string' || !/^(plugin|skill):[^\\/]+$/.test(x))) throw new Error('bad ids'); return a }
try {
  const out = cmd === 'scan' ? scan(arg === 'lean') : cmd === 'off' ? off(ids()) : cmd === 'delete' ? del(ids()) : cmd === 'forget' ? (forget(ids()), {}) : cmd === 'restore' ? restore() : null
  if (!out) throw new Error('usage: clean.js scan | off <ids> | delete <ids> | forget <ids> | restore')
  process.stdout.write(JSON.stringify(out))
} catch (err) {
  process.stderr.write(String(err?.message ?? err))
  process.exit(1)
}
