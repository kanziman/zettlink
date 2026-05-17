# Step 7: vault-git

## 읽어야 할 파일

- `docs/ADR.md` — ADR-013(vault = backup channel, git push 선택)
- `docs/ARCHITECTURE.md` — §4(실패 모드 — git push conflict 처리)
- `apps/worker/src/vault/write.ts` — writeVault 반환값(파일 경로)
- `phases/1-capture/index.json` — step 0~6 summary

## 작업

`apps/worker/src/vault/git.ts`를 구현하라. vault 변경분을 git commit + push.

### 생성할 파일

**`apps/worker/src/vault/git.ts`**

인터페이스:

```typescript
// vault/ 아래 변경사항을 commit + push
// conflict 시 pull --rebase + 1회 재시도
// push 실패(인증 등)는 warn 로그만 — 카드 자체는 done으로 처리
export async function commitAndPush(slug: string, platform: string): Promise<void>
```

구현 상세:

```typescript
import { execa } from 'execa'

export async function commitAndPush(slug: string, platform: string): Promise<void> {
  const vaultPath = `vault/${platform}/${slug}`

  try {
    // 1. 변경 파일 stage
    await execa('git', ['add', vaultPath])

    // 2. staged 변경이 없으면 skip
    const { stdout: diffStat } = await execa('git', ['diff', '--cached', '--stat'])
    if (!diffStat.trim()) return

    // 3. commit
    await execa('git', [
      'commit', '-m', `feat(vault): add ${platform}/${slug}`
    ])

    // 4. push (1회 시도)
    try {
      await execa('git', ['push'])
    } catch (pushErr) {
      // conflict 가능성 → pull --rebase + 재push
      await execa('git', ['pull', '--rebase'])
      await execa('git', ['push'])
    }
  } catch (err) {
    // git push 실패는 warn만 — vault는 옵션 backup이므로 카드 done 처리를 막지 않음
    logger.warn({ err, slug }, 'vault git push failed — skipping')
  }
}
```

git 명령어는 항상 project root에서 실행:
```typescript
const { execa } = await import('execa')
// cwd 기본값이 process.cwd() (project root) 이므로 별도 설정 불필요
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# pull --rebase 재시도 로직 확인
grep -r "pull.*rebase\|rebase" apps/worker/src/vault/git.ts && echo "rebase retry OK"

# push 실패가 warn에 그치고 throw 안 하는지 확인
grep -r "warn.*git\|git.*warn\|skipping" apps/worker/src/vault/git.ts && echo "soft-fail OK"
```

## 금지사항

- git push 실패 시 throw하지 마라. warn 로그만 남기고 정상 반환. vault는 옵션이다.
- `git push --force`를 사용하지 마라.
- commit message를 하드코딩하지 마라. slug와 platform을 포함.
