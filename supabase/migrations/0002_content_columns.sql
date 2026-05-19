-- cards 테이블에 심화 콘텐츠 저장 컬럼 추가 (deep/til/guide 생성 결과)
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS deep_content  text,
  ADD COLUMN IF NOT EXISTS til_content   text,
  ADD COLUMN IF NOT EXISTS guide_content text;
