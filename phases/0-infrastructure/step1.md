# Step 1: db-schema

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙(마이그레이션 정책)
- `docs/ARCHITECTURE.md` — §2(데이터 모델), §4(배포/Supabase)
- `docs/ADR.md` — ADR-001(Supabase primary store), ADR-002(Auth+RLS), ADR-006(jobs 큐)
- `phases/0-infrastructure/index.json` — step 0 summary (완료된 산출물 확인)

## 작업

Supabase 스키마 파일과 설정을 생성하라.

### 생성할 파일

**`supabase/config.toml`**

최소 설정 (project_id는 placeholder):
```toml
project_id = "zettlink"

[api]
enabled = true
port = 54321

[db]
port = 54322

[studio]
enabled = true
port = 54323
```

**`supabase/migrations/0001_init.sql`**

아래 테이블과 정책을 정확히 이 순서로 작성하라:

1. `public.cards` — 필드: `id text PK`, `url text NOT NULL UNIQUE`, `platform text CHECK('youtube','github')`, `external_id text`, `title text`, `summary text`, `insights jsonb`, `raw_metadata jsonb`, `status text CHECK('pending','processing','done','failed')`, `published boolean DEFAULT false`, `has_deep/has_til/has_guide boolean DEFAULT false`, `vault_path text`, `tokens_used integer DEFAULT 0`, `cost_usd numeric(10,4) DEFAULT 0`, `created_at/updated_at timestamptz DEFAULT now()`, UNIQUE(platform, external_id)
2. `public.tags` — `id bigserial PK`, `canonical_name text UNIQUE`, `aliases jsonb DEFAULT '[]'`, `usage_count integer DEFAULT 0`
3. `public.card_tags` — `card_id text → cards(id) ON DELETE CASCADE`, `tag_id bigint → tags(id)`, PK(card_id, tag_id)
4. `public.jobs` — `id bigserial PK`, `raw_url text`, `canonical_url text`, `card_id text → cards(id)`, `telegram_chat bigint`, `telegram_msg bigint`, `force boolean DEFAULT false`, `attempts integer DEFAULT 0`, `max_attempts integer DEFAULT 3`, `status text CHECK('queued','processing','done','failed','dead')`, `last_error text`, `picked_at timestamptz`, `next_attempt_at timestamptz DEFAULT now()`, `created_at timestamptz DEFAULT now()`, `finished_at timestamptz`
5. `public.events` — `id bigserial PK`, `ts timestamptz DEFAULT now()`, `level text CHECK('info','warn','error')`, `type text`, `card_id text`, `job_id bigint`, `data jsonb`
6. `pick_next_job()` RPC — `FOR UPDATE SKIP LOCKED`, `status='processing'`, `picked_at=now()`, `attempts+1`, `LIMIT 1`
7. RLS 활성화 (모든 테이블)
8. RLS 정책:
   - anon: `cards WHERE published=true` SELECT만
   - anon: tags 전체 SELECT
   - anon: card_tags WHERE 연결된 card가 published인 경우 SELECT
   - authenticated: cards/jobs/events 전체 SELECT
   - write는 service_role만 (별도 policy 불필요, service_role이 RLS 우회)

**인덱스:**
- `idx_cards_status ON cards(status)`
- `idx_cards_published ON cards(published) WHERE published=true`
- `idx_cards_created_at ON cards(created_at DESC)`
- `idx_jobs_pickable ON jobs(next_attempt_at) WHERE status IN ('queued','failed')`
- `idx_events_ts ON events(ts DESC)`
- `idx_events_type ON events(type, ts DESC)`

**`supabase/seed.sql`**

시드 태그 5개 예시:
```sql
INSERT INTO public.tags (canonical_name, aliases) VALUES
  ('typescript', '["TypeScript","TS"]'),
  ('react', '["React","React.js","ReactJS"]'),
  ('nextjs', '["Next.js","NextJS","next"]'),
  ('python', '["Python","py"]'),
  ('rust', '["Rust","rs"]');
```

**`scripts/gen-types.sh`**

```bash
#!/usr/bin/env bash
supabase gen types typescript --local > packages/db/src/types.gen.ts
echo "types.gen.ts regenerated"
```

### Supabase CLI 설치 확인 (중요)

스크립트 실행 전 아래를 확인하라:

```bash
supabase --version
docker info
```

둘 중 하나라도 실패하면 `status: "blocked"`, `blocked_reason: "Supabase CLI 또는 Docker가 설치되지 않았습니다. https://supabase.com/docs/guides/cli 참조"` 로 기록하고 즉시 중단하라.

환경이 준비되어 있으면:
```bash
supabase start          # 로컬 컨테이너 기동
supabase db push        # 마이그레이션 적용
bash scripts/gen-types.sh   # types.gen.ts 생성
```

`types.gen.ts` 파일이 생성되면 `packages/db/src/types.gen.ts`에 위치해야 한다.

## Acceptance Criteria

```bash
# SQL 파일이 존재하는지 확인
test -f supabase/migrations/0001_init.sql && echo "OK"

# Supabase 환경이 있는 경우:
supabase db push
bash scripts/gen-types.sh
test -f packages/db/src/types.gen.ts && echo "types.gen.ts OK"
```

## 금지사항

- `supabase/migrations/0001_init.sql`을 생성한 뒤 절대 수정하지 마라. CLAUDE.md CRITICAL 규칙: 마이그레이션은 새 파일로만.
- Supabase CLI / Docker 미설치 상태에서 `supabase start`를 강제 실행하지 마라. 즉시 blocked 처리하라.
- `types.gen.ts`를 수동으로 작성하지 마라. 반드시 `supabase gen types` 명령으로 생성하라.
