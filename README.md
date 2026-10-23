<p align="center">
  <img src="docs/logo.svg" width="420" alt="Autopilot for Claude Code: a pixel Claude mascot beside a laptop"/>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue" alt="License: MIT"/></a>
  <img src="https://img.shields.io/badge/Claude%20Code-plugin-d97757" alt="Claude Code plugin"/>
  <img src="https://img.shields.io/badge/version-0.9.5-informational" alt="Version 0.9.5"/>
  <img src="https://img.shields.io/badge/tests-40%20passing-brightgreen" alt="40 tests passing"/>
</p>

<p align="center">
  <b>Stop paying Opus prices for typo fixes.</b><br/>
  Autopilot picks the right Claude model and effort for every message, keeps your prompt cache alive in long chats, and shows your live usage limits above the prompt.
</p>

---

Most Claude Code sessions run every message on the same big model at the same effort, whether you asked it to plan an architecture or fix a typo. Long chats get worse: switching models rewrites the whole cached conversation, and every new task drags the old history along.

Autopilot fixes that automatically. Install it once and keep working the way you do now.

- **Right model, every message.** A tiny Haiku check (about 250 tokens) rates each request and sends it to Haiku, Sonnet or Opus at the effort it actually needs.
- **Cache-friendly by design.** In long chats the model is locked so the prompt cache is never thrown away.
- **Always know where you stand.** Your 5-hour and weekly limits, with reset times, live above the prompt.

<p align="center">
  <img src="docs/banner-normal.svg" width="730" alt="The Autopilot bar: Sonnet · medium for a normal task, 5-hour session 42%, week 31%, with reset times"/>
</p>
<p align="center"><em>The bar above the prompt in the Claude Code desktop app. In the terminal it is one line of text.</em></p>

## Get started

You need Claude Code, signed in with your Claude account. In Claude Code, run:

```
/plugin marketplace add ImLiquify/claude-autopilot
/plugin install autopilot@autopilot
```

Or from a terminal:

```bash
claude plugin marketplace add ImLiquify/claude-autopilot
```

```bash
claude plugin install autopilot@autopilot
```

Open a new chat. The bar appears above the prompt and routing is on. There is nothing to configure.

---

## How it works

<p align="center">
  <img src="docs/how-it-works.svg" width="900" alt="Diagram: your message goes to a Haiku check, which sends it to Haiku low, Sonnet low to high, or Opus medium to xhigh. Guards keep running: model lock, step up, fresh start, effort cap."/>
</p>

### 1. Every message gets the right model

Before Claude starts on your message, Autopilot asks Haiku one question: *how hard is this?* Haiku answers with a model and an effort, and the turn runs on that.

| You ask for | Autopilot picks |
|---|---|
| A typo, a rename, a one-line edit, a quick question | **Haiku · low** |
| Routine features, styling, tests, ordinary bug fixes | **Sonnet · low to high** |
| Planning, architecture, unclear bugs, big refactors, security | **Opus · medium to high** |
| Heavy animation, WebGL / 3D, many files at once | **Opus · xhigh** (shows ⚡ extra effort) |

Short replies like "yes" or "go on" keep the model you're already on. The check is rate-limited to 60 an hour, and if it ever fails, the message keeps the current route (or Sonnet · medium on a first message).

### 2. Long chats keep their cache

Claude Code caches your conversation so each new message only pays for what's new. **Switching models throws that cache away** and re-writes the whole conversation, which costs roughly 30× a normal turn in a long chat.

So once a chat passes about 30k tokens, Autopilot **locks the model**. Effort can still go up or down (that keeps the cache), but the model stays put. The bar shows a 🔒 and how many tokens a switch would re-read.

<p align="center">
  <img src="docs/banner-locked.svg" width="730" alt="The bar with the model locked: Opus · low, locked: a switch re-reads 182k"/>
</p>

### 3. It steps up when Claude is stuck

Haiku's guess is checked against what actually happens. Autopilot moves **one rung up** (effort first, then Sonnet → Opus) when:

- the same command fails twice,
- Claude keeps re-editing the same spot, or
- you say something like "still broken" or "that didn't fix it".

In a very long chat, a model switch is refused if rewriting the cache would cost more than about $0.40. You get a toast explaining why, and `!opus` still forces it.

### 4. Fresh starts for new tasks

When a chat is already big and you start something unrelated, re-reading the old history on every message is pure waste. Autopilot:

1. has Haiku write a short handoff note (what was done, files, decisions, next steps),
2. saves it under `autopilot/handoffs/`,
3. clears the chat, carries the note over, and re-sends your message.

**Nothing is deleted.** The note includes `claude --resume <id>` for the old chat. It never happens mid-task, or on a message with images or files attached. Turn it off any time with `/fresh off`.

### 5. Effort never runs away

`max` effort is always lowered to `xhigh`. Click ⚙ on the bar to set your own ceiling (for example `high`). The cap holds even with routing off.

<p align="center">
  <img src="docs/banner-heavy.svg" width="730" alt="The bar on a heavy task: Opus · xhigh with the extra effort tag"/>
</p>

### Extras

- **Cheap helpers.** Explore, search and summary subagents run on Haiku unless a model is named.
- **Coding team.** `/team <goal>` runs a builder, a tester and a reviewer agent in turn. The reviewer can send work back for up to 3 rounds.
- **To-do list.** `/todo` keeps a small list in a dashboard pane, shared across your chats.

---

## Commands

| Command | What it does |
|---|---|
| `/route auto` | Automatic routing (the default) |
| `/route opus` · `/route sonnet` | Always use one model |
| `/route off` | Your own model. The effort cap still applies |
| `/fresh on` · `/fresh off` | Turn fresh starts on or off |
| `/team <goal>` | Builder, tester and reviewer agents work a coding goal together |
| `/todo <text>` · `/todo done <n>` · `/todo clear` | Add, tick or clear dashboard to-dos |

**Per-message overrides.** Start a message with one of these to skip the check:

| Prefix | Runs on |
|---|---|
| `!opus` | Opus · high |
| `!sonnet` | Sonnet · medium |
| `!high` | Current model at high effort |
| `!extra` | Opus · xhigh |

---

## In the terminal

The same information as one line above the prompt:

```text
🤖 Sonnet · medium · normal task │ 5-hour session ▓▓▓░░░░░ 42% · resets in 2h 14m │ Week ▓▓░░░░░░ 31% · resets in 3d 20h
```

---

## Requirements

- **Claude Code** with plugin support, signed in with a Claude account. The usage bar reads the same numbers as `/usage`.
- **Optional:** `node` on your PATH, for the lifetime-token count on the bar.
- **Optional:** graphify. If it's installed, Autopilot builds and refreshes a code graph in each project after edits. This makes no model calls. Without graphify, this step is skipped.

## Privacy

Everything stays on your machine, in an `autopilot/` folder beside the installed plugin:

| File | What's in it |
|---|---|
| `usage.json` | The latest usage reading, shared between your open chats |
| `trace.json` | The last 40 routing decisions, with the first 60 characters of each prompt, for debugging |
| `handoffs/` | The notes written at each fresh start |

The only network calls are normal Claude requests (the Haiku check and the handoff note) and the usage endpoint that `/usage` itself reads.

## FAQ

**Does the Haiku check cost more than it saves?**
It's about 250 tokens on Haiku per message. One typo fix that runs on Haiku instead of Opus covers it many times over.

**Will it ever pick a model that's too weak?**
It's told to lean one step up on anything borderline. If Claude gets stuck, Autopilot steps up by itself, and you can always prefix `!opus`.

**Can I turn it off?**
`/route off` for routing, `/fresh off` for fresh starts, or disable the plugin in `/plugin`.

## Development

```bash
claude plugin test
```

```bash
claude plugin validate
```

Routing rules live in `hooks/logic.ts` (pure functions, unit-tested). The hooks are in `hooks/register.tsx` and the bar drawing is in `hooks/banner.ts`. The images in `docs/` are drawn by the mod's own `bannerSvg`.

## License

MIT © Mohamed Kaiser
