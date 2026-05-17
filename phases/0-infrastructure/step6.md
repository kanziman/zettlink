# Step 6: launchd

## 읽어야 할 파일

- `CLAUDE.md` — 명령어 섹션(launchctl 명령어)
- `docs/ARCHITECTURE.md` — §9(배포: bot/worker Mac launchd plist)
- `phases/0-infrastructure/index.json` — step 0~5 summary

## 작업

Mac launchd plist 파일 2개와 설치 스크립트를 생성하라. 이 step에서는 소스 코드를 작성하지 않는다.

### 생성할 파일

**`com.zettlink.bot.plist`** (프로젝트 루트에 생성)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.zettlink.bot</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>ZETTLINK_ROOT/apps/bot/src/index.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>ZETTLINK_ROOT</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>

  <key>StandardOutPath</key>
  <string>ZETTLINK_ROOT/logs/bot.log</string>
  <key>StandardErrorPath</key>
  <string>ZETTLINK_ROOT/logs/bot-error.log</string>

  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
</dict>
</plist>
```

**`com.zettlink.worker.plist`** (프로젝트 루트에 생성)

bot과 동일한 구조, 아래만 변경:
- `Label`: `com.zettlink.worker`
- `ProgramArguments` 두 번째: `ZETTLINK_ROOT/apps/worker/src/index.js`
- `StandardOutPath`: `ZETTLINK_ROOT/logs/worker.log`
- `StandardErrorPath`: `ZETTLINK_ROOT/logs/worker-error.log`

**`scripts/install-launchd.sh`**

```bash
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
```

**`logs/.gitkeep`** (빈 파일 — logs/ 디렉토리를 git에 포함시키기 위해)

`.gitignore`에 `logs/*.log`가 있어야 한다. step 0에서 `logs/`만 gitignore했다면 `logs/*.log`로 수정하라.

### 설치 확인 (실제 설치는 하지 않는다)

plist 파일의 XML 유효성을 확인하라:

```bash
plutil -lint com.zettlink.bot.plist
plutil -lint com.zettlink.worker.plist
```

`com.zettlink.bot.plist: OK` 형태의 출력이면 통과.

스크립트 실행 가능 설정:

```bash
chmod +x scripts/install-launchd.sh
```

## Acceptance Criteria

```bash
# XML 유효성
plutil -lint com.zettlink.bot.plist && echo "bot plist OK"
plutil -lint com.zettlink.worker.plist && echo "worker plist OK"

# 설치 스크립트 실행 가능
test -x scripts/install-launchd.sh && echo "install script OK"

# logs 디렉토리
test -f logs/.gitkeep && echo "logs dir OK"

# 전체 빌드/테스트 최종 확인
pnpm install
pnpm --filter @zettlink/shared test
pnpm --filter @zettlink/db build
pnpm --filter @zettlink/shared build
```

## 금지사항

- `launchctl load`를 스크립트 내에서 자동으로 실행하지 마라. 설치 여부는 사용자가 결정한다.
- plist의 `ZETTLINK_ROOT` placeholder를 하드코딩된 경로로 대체하지 마라. `install-launchd.sh`가 실행 시점에 치환한다.
- `logs/` 디렉토리를 `.gitignore`에서 완전히 제외하지 마라. `.gitkeep`을 통해 디렉토리 자체는 git에 포함시켜야 한다.
