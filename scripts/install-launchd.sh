#!/usr/bin/env bash
# Mac launchd plist를 설치하는 스크립트
# 사용: bash scripts/install-launchd.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
PLACEHOLDER="ZETTLINK_ROOT"

if [ ! -d "$LAUNCH_AGENTS" ]; then
  mkdir -p "$LAUNCH_AGENTS"
fi

for PLIST in bot worker; do
  SRC="$ROOT/com.zettlink.$PLIST.plist"
  DST="$LAUNCH_AGENTS/com.zettlink.$PLIST.plist"

  # ZETTLINK_ROOT placeholder를 실제 경로로 치환
  sed "s|$PLACEHOLDER|$ROOT|g" "$SRC" > "$DST"
  echo "Installed: $DST"
done

echo ""
echo "To load daemons:"
echo "  launchctl load $LAUNCH_AGENTS/com.zettlink.bot.plist"
echo "  launchctl load $LAUNCH_AGENTS/com.zettlink.worker.plist"
echo ""
echo "To verify:"
echo "  launchctl list | grep zettlink"
