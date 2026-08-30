-- ─────────────────────────────────────────────────────────
-- 신고 (기획서 19장)
--
-- 19장은 로그인·프로필이 있는 10월 기준으로 쓰였습니다. 지금은 회원가입이
-- 없어서(절대 규칙 ⑤) 그대로 못 옮깁니다. 이렇게 좁힙니다 —
--
--   · 신고자·피신고자를 profile 이 아니라 participants.id 로 잡습니다
--   · 차단(19.4)은 서버가 아니라 브라우저에서 「숨기기」로 합니다.
--     로그인이 없으면 서버 차단은 브라우저만 바꿔도 뚫려서, 지키는 척만 하게 됩니다
--   · 운영자 큐(/admin/reports)는 만들지 않습니다. is_admin 이 없어서 지금 만들면
--     누구나 남의 신고 내용을 열람하게 됩니다. 그때까지는 Supabase 대시보드로 봅니다
-- ─────────────────────────────────────────────────────────

create table reports (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references rooms    on delete cascade,
  message_id  uuid references messages on delete set null,  -- 대상 메시지 (자동 첨부)
  reporter_id uuid references participants,
  target_id   uuid references participants,
  -- 기획서 19.3 의 11종. 화면 문구는 messages/*.json 에 있습니다
  reason      text not null check (reason in (
                'harassment','abuse','sexual','stalking','personal_info',
                'impersonation','copyright','banned_image','spam','scam','other')),
  detail      text,
  handled_at  timestamptz,                                   -- 운영자가 처리한 시각
  created_at  timestamptz default now()
);

create index on reports (created_at desc);
create index on reports (target_id);          -- 누적 3건 이상 판단용 (19.5)

alter table reports enable row level security;

-- 접수만 됩니다. **select 정책을 일부러 만들지 않습니다** —
-- 정책이 없으면 anon 은 한 줄도 못 읽습니다. 신고 내용이 다른 사용자에게 새면 안 됩니다.
-- 운영자는 service_role(대시보드)로 봅니다.
create policy "anyone can report" on reports
  for insert with check (reporter_id is not null);

-- 스크린샷을 요구하지 않는 대신 자유 서술을 받습니다. 길이는 막아둡니다 (19.3)
alter table reports
  add constraint reports_detail_len
  check (detail is null or char_length(detail) <= 500);
