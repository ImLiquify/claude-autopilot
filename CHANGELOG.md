# Changelog

Each version's changes, newest first. Autopilot shows the lines under every version newer than yours when it tells you an update is out ("What's new"). Every version is also a [release](https://github.com/ImLiquify/claude-autopilot/releases) with one-click installers, so you can go back to any of them.

## 0.23.0 (2026-11-15)
- Hand-off: a long build or a bulk file job is given to a Sonnet helper that works in its own small chat. Your chat's model writes the brief, checks the result and polishes it. In a test build this cost about a quarter less than the cheapest run without it.
- Every hand-off is measured against doing the work in the chat. If the last five together cost more, hand-offs pause by themselves.
- `/delegate <job>` hands a job off by hand. Turn the feature off in Settings: "Hand long jobs to a helper with its own small chat".

## 0.22.1 (2026-11-15)
- Shortening a chat now keeps a list of every file, image and document you gave Claude, so it doesn't ask for them again.

## 0.22.0 (2026-11-10)
- Clean is now a full token check. Besides unused plugins and skills, it checks your CLAUDE.md files and what they import, memory indexes, hooks that run on every message or reply, MCP servers you don't use, your own agents and commands, and how long your chats get.
- It shows what a new chat costs you and how many chats grew past 150k tokens, then lists what it suggests changing.
- Turn off what's ticked with one press, or press Fix with Claude: Claude goes through the other suggestions with you, one at a time, and changes nothing until you say yes.

## 0.21.0 (2026-11-10)
- Plugins only when asked: other plugins' skills and agents are listed by name only, and load when you ask for them. Saves about 2,000 to 3,000 tokens in every chat on a setup with many plugins.
- Superpowers and Ponytail no longer load their long start-up text into every chat. They still work when you ask for them.
- The update notice has a What's new button that shows this list.
- Every version is now a GitHub release with a Windows installer, a Mac/Linux installer and an install file you can give to Claude, so you can install any version or go back to an older one.
- Update moves a copy that was pinned to an older version back to the latest one.

## 0.20.0 (2026-11-10)
- Lean code, built in: every chat gets a short rule that cuts tokens on code work (no unrequested extras, no reprinted files, smaller command output) without making answers shorter or the product plainer.
- The graphify map rule is added only in projects that have a map.
- Ponytail is no longer offered as an add-on. Settings can turn it off if you have it.

## 0.19.0
- Clean is fixed. Why-this-model, Shorten now, Clean and the add-on installers are in the Settings card.
- First run offers the free add-ons once, with one click each.

## 0.18.0
- /why shows why the last message got its model.
- Warnings at 80% and 95% of your 5-hour and weekly limits.
- The chat's size is shown on the bar.

## 0.17.1
- Picks the model by itself again: small chats run on Sonnet, and anything judged by its quality runs on Opus.
- The routing check runs on Sonnet, which placed 24 of 24 test messages correctly.

## 0.17.0
- Never picks a weaker model than the one you chose, so answers can't get worse. Savings come from keeping chats short.

## 0.16.2
- Long chats are shortened when a turn ends instead of in the middle of the next one.
- Both shorten sizes default to Sooner (100k).
- Fixed the start-up size estimate, which made long chats get shortened about 50k late.

## 0.16.1 (2026-10-26)
- No background behind the crab in the minimized strip.

## 0.16.0 (2026-10-26)
- Minimize the banner to one strip with the crab, model, meters and lifetime tokens.

## 0.15.0 (2026-10-26)
- Steps one level above the check's pick, plain-language settings, and a fresh-start card.

## 0.14.1 (2026-10-26)
- Simple chores run on Haiku, file searches run on Haiku, and long chats keep their model.

## 0.14.0 (2026-10-25)
- Settings card, a 150k fresh-start limit, and the update notice.
