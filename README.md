# Autopilot for Claude Code

A Claude Code mod that spends fewer tokens without you thinking about it. It picks the right model and effort for each message, keeps the prompt cache warm in long chats, and shows your live 5-hour and weekly usage above the prompt.

## Install

In Claude Code, run:

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

Start a new chat and the usage bar appears above the prompt.

## What it does

- **Routes each message.** A quick Haiku check (about 250 tokens) rates your request and sends it to the cheapest model that will do it well: Haiku for typos, Sonnet for routine work, Opus for planning, unclear bugs, big refactors and security. Short replies like "yes" keep the current model.
- **Caps effort.** `max` effort is always lowered to `xhigh`. Set a lower ceiling with the ⚙ button on the bar.
- **Locks the model in long chats.** Switching models in a long chat re-writes its whole cache (about 30× a normal turn), so above ~30k chat tokens the model stays put. Effort can still change.
- **Steps up when stuck.** If the same command fails twice, Claude keeps re-editing the same spot, or you say "still broken", it moves up one step (effort first, then Sonnet → Opus).
- **Fresh starts.** When a long chat gets a new, unrelated task, Autopilot saves a short handoff note, clears the chat and re-sends your message, so the new task doesn't re-read the old history. The old chat is never deleted: the note shows `claude --resume <id>`. Turn it off with `/fresh off`.
- **Cheap helpers.** Explore, search and summary subagents run on Haiku.
- **Usage bar.** Model and effort, 5-hour and weekly usage with reset times, and lifetime tokens.

## Commands

| Command | What it does |
|---|---|
| `/route auto\|opus\|sonnet\|off` | Automatic routing, a fixed model, or off (your own model) |
| `/fresh on\|off` | Turn fresh starts on or off |
| `/team <goal>` | A builder, tester and reviewer agent work a coding goal together |
| `/todo <text>` · `/todo done <n>` · `/todo clear` | A small to-do list in the dashboard pane |

Start a message with `!opus`, `!sonnet`, `!high` or `!extra` to override the router for that message.

## Requirements

- Claude Code with mod support, signed in with a Claude account (the usage bar reads the same numbers as `/usage`).
- Optional: `node` on your PATH for the lifetime-token count.
- Optional: graphify. If it is installed, Autopilot builds and refreshes a code graph in each project (no model calls). If not, this step is skipped.

## What it stores

Everything stays on your machine, in an `autopilot/` folder beside the installed plugin:

- `usage.json`: the latest usage reading, shared between your open chats.
- `trace.json`: the last 40 routing decisions, with the first 60 characters of each prompt, for debugging.
- `handoffs/`: the notes written at each fresh start.

Nothing is sent anywhere except the normal Claude requests (the Haiku check and the handoff note) and the usage endpoint that `/usage` uses.

## Development

```bash
claude plugin test
```

```bash
claude plugin validate
```

## License

MIT
