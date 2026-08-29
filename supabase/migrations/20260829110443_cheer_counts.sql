-- ─────────────────────────────────────────────────────────
-- 색깔별 응원 개수
--
-- 화면에서 최근 50개만 불러오기 때문에, 로드된 것으로 세면
-- 51개째부터 숫자가 틀어집니다. 집계는 DB에서 합니다.
--
-- 「퍼플에 응원 몇 개」가 곧 라벤더 리본을 몇 개 만들지의 근거입니다 (9.6).
-- ─────────────────────────────────────────────────────────

create or replace view cheer_counts
with (security_invoker = true)     -- 뷰가 아니라 조회하는 사람의 권한으로 (RLS 유지)
as
select
  r.slug,
  replace(r.slug, 'cheer-', '') as color_key,
  count(m.id)                   as n
from rooms r
left join messages m on m.room_id = r.id
where r.world = 'cheer'
group by r.slug;
