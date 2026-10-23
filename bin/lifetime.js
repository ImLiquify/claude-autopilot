// Lifetime tokens like /usage → Stats: the CLI's stats-cache.json plus every reply logged after its last computed day.
const fs = require('fs'), path = require('path'), os = require('os')
const root = path.join(os.homedir(), '.claude')
const stats = JSON.parse(fs.readFileSync(path.join(root, 'stats-cache.json'), 'utf8'))
let total = Object.values(stats.modelUsage || {}).reduce((n, m) => n + m.inputTokens + m.outputTokens + m.cacheReadInputTokens + m.cacheCreationInputTokens, 0)
const since = stats.lastComputedDate
const seen = new Set()
const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, f.name)
  if (f.isDirectory()) walk(p)
  else if (f.name.endsWith('.jsonl') && fs.statSync(p).mtime.toISOString().slice(0, 10) >= since) scan(p)
} }
const scan = p => { for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
  if (!line.includes('"usage"')) continue
  let j; try { j = JSON.parse(line) } catch { continue }
  const u = j.message && j.message.usage
  if (!u || !j.timestamp || j.timestamp.slice(0, 10) <= since) continue
  const id = (j.message.id || '') + (j.requestId || '')
  if (id && seen.has(id)) continue
  seen.add(id)
  total += (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)
} }
walk(path.join(root, 'projects'))
console.log(total)
