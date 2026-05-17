-- zettlink 초기 스키마: cards/tags/card_tags/jobs/events 테이블, RLS, pick_next_job() RPC

-- cards: 처리된 URL의 메타데이터와 LLM 산출물을 저장하는 메인 테이블
CREATE TABLE public.cards (
  id           text PRIMARY KEY,
  url          text NOT NULL UNIQUE,
  platform     text NOT NULL CHECK (platform IN ('youtube', 'github')),
  external_id  text NOT NULL,
  title        text,
  summary      text,
  insights     jsonb,
  raw_metadata jsonb,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  published    boolean NOT NULL DEFAULT false,
  has_deep     boolean NOT NULL DEFAULT false,
  has_til      boolean NOT NULL DEFAULT false,
  has_guide    boolean NOT NULL DEFAULT false,
  vault_path   text,
  tokens_used  integer NOT NULL DEFAULT 0,
  cost_usd     numeric(10, 4) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

-- tags: 정규화된 태그와 별칭 목록
CREATE TABLE public.tags (
  id             bigserial PRIMARY KEY,
  canonical_name text NOT NULL UNIQUE,
  aliases        jsonb NOT NULL DEFAULT '[]',
  usage_count    integer NOT NULL DEFAULT 0
);

-- card_tags: 카드와 태그의 다대다 조인 테이블
CREATE TABLE public.card_tags (
  card_id text NOT NULL REFERENCES public.cards (id) ON DELETE CASCADE,
  tag_id  bigint NOT NULL REFERENCES public.tags (id),
  PRIMARY KEY (card_id, tag_id)
);

-- jobs: Telegram 수신 URL의 영속 작업 큐
CREATE TABLE public.jobs (
  id              bigserial PRIMARY KEY,
  raw_url         text NOT NULL,
  canonical_url   text,
  card_id         text REFERENCES public.cards (id),
  telegram_chat   bigint,
  telegram_msg    bigint,
  force           boolean NOT NULL DEFAULT false,
  attempts        integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 3,
  status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed', 'dead')),
  last_error      text,
  picked_at       timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

-- events: 모든 처리 단계의 구조화 로그
CREATE TABLE public.events (
  id      bigserial PRIMARY KEY,
  ts      timestamptz NOT NULL DEFAULT now(),
  level   text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  type    text NOT NULL,
  card_id text,
  job_id  bigint,
  data    jsonb
);

-- pick_next_job: FOR UPDATE SKIP LOCKED 기반 race-safe 작업 픽업 RPC
CREATE OR REPLACE FUNCTION public.pick_next_job()
RETURNS public.jobs
LANGUAGE plpgsql
AS $$
DECLARE
  v_job public.jobs;
BEGIN
  SELECT *
    INTO v_job
    FROM public.jobs
   WHERE status IN ('queued', 'failed')
     AND next_attempt_at <= now()
     AND attempts < max_attempts
   ORDER BY next_attempt_at ASC
   LIMIT 1
     FOR UPDATE SKIP LOCKED;

  IF v_job.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.jobs
     SET status    = 'processing',
         picked_at = now(),
         attempts  = attempts + 1
   WHERE id = v_job.id;

  SELECT * INTO v_job FROM public.jobs WHERE id = v_job.id;
  RETURN v_job;
END;
$$;

-- 인덱스
CREATE INDEX idx_cards_status      ON public.cards (status);
CREATE INDEX idx_cards_published   ON public.cards (published) WHERE published = true;
CREATE INDEX idx_cards_created_at  ON public.cards (created_at DESC);
CREATE INDEX idx_jobs_pickable     ON public.jobs (next_attempt_at) WHERE status IN ('queued', 'failed');
CREATE INDEX idx_events_ts         ON public.events (ts DESC);
CREATE INDEX idx_events_type       ON public.events (type, ts DESC);

-- RLS 활성화
ALTER TABLE public.cards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events    ENABLE ROW LEVEL SECURITY;

-- anon: published 카드만 SELECT
CREATE POLICY "anon_read_published_cards"
  ON public.cards
  FOR SELECT
  TO anon
  USING (published = true);

-- anon: 태그 전체 SELECT
CREATE POLICY "anon_read_tags"
  ON public.tags
  FOR SELECT
  TO anon
  USING (true);

-- anon: published 카드에 연결된 card_tags SELECT
CREATE POLICY "anon_read_card_tags"
  ON public.card_tags
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
       WHERE c.id = card_tags.card_id
         AND c.published = true
    )
  );

-- authenticated: cards/jobs/events 전체 SELECT
CREATE POLICY "authenticated_read_cards"
  ON public.cards
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_events"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_tags"
  ON public.tags
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_card_tags"
  ON public.card_tags
  FOR SELECT
  TO authenticated
  USING (true);
