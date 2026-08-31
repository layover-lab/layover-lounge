-- ─────────────────────────────────────────────────────────
-- client_id 를 실제로 가립니다
--
-- 앞 마이그레이션(20260831140000)의 `revoke select (client_id)` 는 **효과가 없었습니다.**
-- Postgres 는 테이블 단위 `grant select` 가 있으면 모든 컬럼을 읽게 해주고,
-- 컬럼 단위 revoke 로 거기서 빼낼 수 없습니다.
--
--   ✗ revoke select (client_id) on participants from anon;      -- 테이블 권한이 이깁니다
--   ✓ revoke select on participants from anon;                  -- 통째로 내리고
--     grant select (필요한 컬럼들) on participants to anon;      -- 필요한 것만 돌려줍니다
--
-- 확인 방법 — 아래가 permission denied 여야 합니다.
--   curl "$URL/rest/v1/participants?select=client_id&limit=1" -H "apikey: $ANON"
-- ─────────────────────────────────────────────────────────

revoke select on participants from anon, authenticated;

-- client_id 만 빠져 있습니다. 참여자 목록·말풍선에 필요한 것은 다 열려 있습니다
grant select (id, room_id, name, role, color_key, avatar, joined_at, left_at)
  on participants to anon, authenticated;
