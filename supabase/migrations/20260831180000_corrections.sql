-- ─────────────────────────────────────────────────────────
-- 첨삭 요청 (기획서 15.9 · 26장)
--
-- 「무대에서 빨간 줄」은 만들지 않습니다. 캐릭터로 말하는 중에 교정이 끼면
-- 놀이가 멈추고, 남들 앞에서 고쳐지면 창피해서 아무도 안 씁니다 —
-- 이 방의 핵심 가치가 「틀려도 창피하지 않다」인데 정면으로 부딪힙니다 (5.4).
--
-- 그래서 **요청한 문장만** 받습니다.
--   · 요청은 여기 쌓입니다 (운영자는 Supabase 대시보드로 봅니다)
--   · **답은 백스테이지 메시지로 합니다** — 관리자 화면이 아예 필요 없습니다
--   · `source` 는 지금 전부 'human' 입니다. 요청이 하루 50개를 넘으면
--     AI 1차 + 사람 검수로 갈 텐데, 그때 스키마를 안 건드리려고 미리 둡니다
-- ─────────────────────────────────────────────────────────

create table corrections (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid references rooms    on delete cascade,
  message_id   uuid references messages on delete cascade,
  requester_id uuid references participants,
  body         text not null,                 -- 요청 시점의 원문. 메시지가 지워져도 남습니다
  answer       text,                          -- 대표가 적어두는 메모 (답은 백스테이지로 갑니다)
  source       text not null default 'human' check (source in ('human','ai')),
  answered_at  timestamptz,
  created_at   timestamptz default now()
);

-- 같은 문장을 두 번 요청해도 한 줄만 남깁니다
create unique index corrections_message_uniq on corrections (message_id);
create index corrections_created_idx on corrections (created_at desc);

alter table corrections enable row level security;

-- 접수만 됩니다. **select 정책을 만들지 않습니다** — 남이 틀린 문장을 읽을 이유가 없습니다.
-- 요청한 사람은 백스테이지로 오는 답으로 확인합니다.
create policy "anyone can ask" on corrections
  for insert with check (requester_id is not null and length(btrim(body)) > 0);
