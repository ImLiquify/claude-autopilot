#!/usr/bin/env bash
# Autopilot installer for Mac and Linux: run `bash install-autopilot.sh`. It installs the version below into Claude Code
# (or switches to it from the one you have), then asks you to restart Claude. "latest" means the newest.
AP_VERSION=latest
set -e
REPO=ImLiquify/claude-autopilot
echo "Installing Autopilot $AP_VERSION ..."
if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code is not installed: the claude command was not found. Install it from https://claude.com/claude-code, then run this again."
  exit 1
fi
TAG=""
if [ "$AP_VERSION" != "latest" ]; then TAG="v$AP_VERSION"; fi
# A copy installed before is declared in settings.json: point it at this version (a backup is kept next to it).
FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
CHANGED=""
if [ -f "$FILE" ] && command -v perl >/dev/null 2>&1; then
  REF=""
  if [ -n "$TAG" ]; then REF=", \"ref\": \"$TAG\""; fi
  cp "$FILE" "$FILE.bak"
  CHANGED=1
  AP_NEW="{ \"source\": \"github\", \"repo\": \"$REPO\"$REF }" perl -0pi -e 's/("autopilot"\s*:\s*\{\s*"source"\s*:\s*)\{[^{}]*\}/$1$ENV{AP_NEW}/' "$FILE"
fi
SRC="$REPO"
if [ -n "$TAG" ]; then SRC="$REPO#$TAG"; fi
if ! claude plugin marketplace add "$SRC"; then
  if [ -n "$CHANGED" ]; then cp "$FILE.bak" "$FILE"; fi # nothing changed: the version you had stays
  echo "Could not add Autopilot $AP_VERSION. Check that the version exists: https://github.com/$REPO/releases"
  exit 1
fi
claude plugin marketplace update autopilot || true
claude plugin install autopilot@autopilot || true
claude plugin update autopilot@autopilot
echo
if [ -n "$TAG" ]; then echo "Autopilot $AP_VERSION is installed. Restart Claude to start using it."; else echo "The newest Autopilot is installed. Restart Claude to start using it."; fi
