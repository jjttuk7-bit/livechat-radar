-- LiveChat Radar — 크로스세션 저장 스키마 (P-11)
--
-- 적용: Supabase 대시보드 → SQL Editor에 붙여넣고 실행.
-- 미적용 상태에서도 앱은 동작한다 (SUPABASE_URL 미설정 시 .data/sessions.json으로 폴백).
--
-- ⚠️ D-8 (개인정보 설계)
--   · 참여자는 **해시로만** 저장한다. 원문 닉네임 컬럼이 존재하지 않는다.
--   · 댓글 원문도 저장하지 않는다. carry_over_requests만 이월 목적으로 80자 이내 보관.
--   · 정치성향은 애초에 계산하지 않으므로 저장 대상 자체가 없다 (D-1).
--   · 보존기간(기본 90일)은 애플리케이션이 저장 시점에 정리한다. 아래 cron은 이중 안전장치.

create table if not exists public.talk_sessions (
  id                    text primary key,
  title                 text        not null,
  "startedAt"           timestamptz not null,
  "endedAt"             timestamptz not null,
  "totalMessages"       integer     not null default 0,
  "peakCpm"             integer     not null default 0,
  "avgRallyHeat"        integer     not null default 0,
  "supportCount"        integer     not null default 0,
  "riskCount"           integer     not null default 0,
  "unansweredCount"     integer     not null default 0,
  "answerRate"          integer     not null default 0,
  -- [{ title, interestScore, mentionCount }]
  agenda                jsonb       not null default '[]'::jsonb,
  -- 다음 방송 이월용 질문 요지 (작성자 정보 없음)
  "carryOverRequests"   jsonb       not null default '[]'::jsonb,
  -- D-8: sha256(salt:author) 앞 32자만. 원문 닉네임 아님.
  "participantHashes"   jsonb       not null default '[]'::jsonb,
  created_at            timestamptz not null default now()
);

-- 최신순 조회가 유일한 접근 패턴이다
create index if not exists talk_sessions_started_at_idx
  on public.talk_sessions ("startedAt" desc);

-- ── 접근 제어 ────────────────────────────────────────────────────────────────
-- 이 테이블은 서버(service_role)만 접근한다. anon 키로는 아무것도 못 하게 둔다.
-- service_role은 RLS를 우회하므로 정책을 추가하지 않으면 곧 "서버 전용"이 된다.
alter table public.talk_sessions enable row level security;

-- ── 보존기간 정리 (이중 안전장치) ────────────────────────────────────────────
-- 애플리케이션이 저장 시점에 정리하지만, 앱이 오래 안 돌아도 데이터가 남지 않도록
-- pg_cron으로 매일 정리한다. pg_cron 미사용 환경이면 이 블록은 건너뛰어도 된다.
--
--   select cron.schedule(
--     'prune-talk-sessions',
--     '0 4 * * *',
--     $$ delete from public.talk_sessions where "startedAt" < now() - interval '90 days' $$
--   );

comment on table public.talk_sessions is
  'LiveChat Radar 회차 요약. 참여자는 해시로만 저장하며 원문 닉네임·댓글은 보관하지 않는다 (D-8).';
