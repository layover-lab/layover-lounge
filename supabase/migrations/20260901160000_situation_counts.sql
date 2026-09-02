-- ─────────────────────────────────────────────────────────
-- 상황별 인원
--
-- 입장 화면의 상황 카드가 다섯 개 다 똑같이 생겨서, 어디로 가야 사람이
-- 있는지 알 수가 없었습니다. 전부 빈 방처럼 보이는 게 제일 나쁩니다 —
-- 「아무도 없네」가 첫인상이 되면 그 사람은 안 돌아옵니다 (기획서 4.6).
--
-- ⚠️ 「지금 접속 중」이 아니라 **들어온 적 있는 사람**입니다.
--    접속 여부는 Realtime presence 가 있어야 아는데 동시 연결을 더 먹습니다
--    (5.3 ★ 에서 참여자 목록을 미룬 것과 같은 이유).
--    그래서 화면 문구도 「지금 N명」이 아니라 「N명이 놀았어요」입니다.
--
-- ⚠️ count(distinct client_id) 를 쓰지 않습니다. anon 에게 client_id 는
--    안 보입니다 (20260831150000). security_invoker 뷰라 조회하는 사람의
--    권한으로 도는데, 거기서 client_id 를 만지면 permission denied 가 납니다.
--    participants 는 (room_id, client_id) 가 unique 라 행을 세면 사람 수입니다.
-- ─────────────────────────────────────────────────────────

create or replace view situation_counts
with (security_invoker = true)     -- 뷰가 아니라 조회하는 사람의 권한으로 (RLS 유지)
as
select
  r.situation_key,
  count(p.id)                                                             as people,
  count(p.id) filter (where p.joined_at > now() - interval '24 hours')    as recent
from rooms r
left join participants p on p.room_id = r.id
where r.world = 'idol'
  and r.situation_key is not null
group by r.situation_key;

grant select on situation_counts to anon, authenticated;
