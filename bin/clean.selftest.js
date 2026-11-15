// Self-check for clean.js on a throwaway home folder: node bin/clean.selftest.js
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert')
const { execFileSync } = require('child_process')
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-'))
const c = path.join(home, '.claude'), DAY = 864e5, now = Date.parse('2026-11-08T00:00:00Z')
const put = (p, t) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t) }
const skill = (dir, name) => put(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: does ${name} things\n---\n`)
const old = new Date(now - 40 * DAY)

put(path.join(c, 'settings.json'), JSON.stringify({ enabledPlugins: { 'used@m': true, 'idle@m': true, 'gone@m': true, 'autopilot@x': true }, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node check.js' }] }], PreToolUse: [{ hooks: [{ type: 'command', command: 'guard' }] }] } }))
put(path.join(home, '.claude.json'), JSON.stringify({ mcpServers: { idle: {}, busy: {} } }))
put(path.join(c, 'projects', 'p', 'memory', 'MEMORY.md'), 'x'.repeat(9000))
const inst = n => [{ installPath: path.join(c, 'plugins', 'cache', n, '1.0'), installedAt: old.toISOString() }]
put(path.join(c, 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: { 'used@m': inst('used'), 'idle@m': inst('idle') } }))
skill(path.join(c, 'plugins', 'cache', 'used', '1.0', 'skills', 'u'), 'u')
skill(path.join(c, 'plugins', 'cache', 'idle', '1.0', 'skills', 'dup'), 'dup')
for (const n of ['mine', 'stale', 'dup', 'fresh']) skill(path.join(c, 'skills', n), n)
for (const n of ['mine', 'stale', 'dup']) fs.utimesSync(path.join(c, 'skills', n), old, old)
put(path.join(c, 'CLAUDE.md'), 'Use ~/.claude/skills/missing/SKILL.md first.\n@~/nowhere.md\n')
// used@m's skill and the "mine" skill were used 2 days ago; "stale" only 40 days ago (outside the window).
const at = d => new Date(now - d * DAY).toISOString()
put(path.join(c, 'projects', 'p', 'a.jsonl'), [
  `{"timestamp":"${at(2)}","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"used:u"}}]}}`,
  `{"timestamp":"${at(2)}","message":{"content":"<command-name>/mine</command-name>"}}`,
  `{"timestamp":"${at(40)}","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"stale"}}]}}`,
  `{"type":"assistant","timestamp":"${at(2)}","message":{"content":[{"type":"tool_use","name":"mcp__busy__go"}],"usage":{"input_tokens":5,"cache_creation_input_tokens":60000,"cache_read_input_tokens":0}}}`,
  `{"type":"assistant","timestamp":"${at(2)}","message":{"usage":{"input_tokens":5,"cache_creation_input_tokens":1000,"cache_read_input_tokens":159000}}}`,
].join('\n'))

const run = (...a) => JSON.parse(execFileSync('node', [path.join(__dirname, 'clean.js'), ...a], { env: { ...process.env, CLEAN_HOME: home, CLEAN_NOW: String(now) } }).toString())
const s = run('scan')
const by = Object.fromEntries(s.items.map(i => [i.id, i]))
assert.deepStrictEqual(Object.keys(by).sort(), ['plugin:gone@m', 'plugin:idle@m', 'skill:dup', 'skill:stale'])
assert.match(by['plugin:gone@m'].reason, /broken/)
assert.match(by['skill:dup'].reason, /duplicate/)
assert.ok(!by['skill:fresh'] && !by['skill:mine'] && !by['plugin:used@m'], 'new and used ones stay')
assert.ok(s.notes.some(n => /missing skill/.test(n)), 'CLAUDE.md names a missing skill')
assert.ok(s.notes.some(n => /imports .*nowhere\.md, which does not exist/.test(n)), 'a missing @import')
assert.ok(s.notes.some(n => /a Stop hook \(node check\.js\)/.test(n)) && !s.notes.some(n => /guard/.test(n)), 'only costly hook events')
assert.ok(s.notes.some(n => /MCP server idle/.test(n)) && !s.notes.some(n => /MCP server busy/.test(n)), 'unused MCP servers only')
assert.ok(s.notes.some(n => /memory index .*MEMORY\.md is about 2k/.test(n)), 'a big memory index')
assert.deepStrictEqual(s.stats, { chats: 1, start: 60005, long: 1 })

run('off', JSON.stringify(['plugin:idle@m', 'skill:stale']))
assert.strictEqual(JSON.parse(fs.readFileSync(path.join(c, 'settings.json'))).enabledPlugins['idle@m'], false)
assert.ok(!fs.existsSync(path.join(c, 'skills', 'stale')) && fs.existsSync(path.join(c, 'autopilot', 'skills-off', 'stale')))
run('restore')
assert.strictEqual(JSON.parse(fs.readFileSync(path.join(c, 'settings.json'))).enabledPlugins['idle@m'], true)
assert.ok(fs.existsSync(path.join(c, 'skills', 'stale')))
run('off', JSON.stringify(['skill:stale']))
run('delete', JSON.stringify(['skill:stale']))
assert.ok(!fs.existsSync(path.join(c, 'autopilot', 'skills-off', 'stale')))
assert.throws(() => run('off', JSON.stringify(['skill:../../x'])))
if (!process.env.KEEP) fs.rmSync(home, { recursive: true, force: true })
console.log('clean.js self-check passed')
