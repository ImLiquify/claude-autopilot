# Install Autopilot with Claude

Drop this file into a Claude Code chat and say **"install this"**. Claude installs the version below, or switches to it from the version you have now. Then restart Claude.

Version to install: `AP_VERSION=latest` (`latest` means the newest; a number like `0.21.0` means that exact version, from https://github.com/ImLiquify/claude-autopilot/releases)

## Steps for Claude

Do these in order, without changing anything else, then tell the user to restart Claude. If a command fails, show its output and stop.

1. Read the version from the line above. If it is `latest`, there is no tag. Otherwise the tag is `v` followed by the version (for example `v0.21.0`).
2. Open `settings.json` in the user's Claude folder (`$CLAUDE_CONFIG_DIR` if it is set, otherwise `~/.claude`). If `extraKnownMarketplaces` has an `autopilot` entry, replace only that entry's `source` with `{ "source": "github", "repo": "ImLiquify/claude-autopilot", "ref": "<tag>" }`, leaving out `"ref"` when there is no tag. Keep a copy of the file as `settings.json.bak` first. If there is no such entry, skip this step.
3. Run `claude plugin marketplace add ImLiquify/claude-autopilot#<tag>`, or `claude plugin marketplace add ImLiquify/claude-autopilot` when there is no tag.
4. Run `claude plugin marketplace update autopilot`.
5. Run `claude plugin install autopilot@autopilot`, then `claude plugin update autopilot@autopilot`.
6. Run `claude plugin list` and check that `autopilot@autopilot` shows the expected version. Tell the user which version is installed and that they need to restart Claude.
