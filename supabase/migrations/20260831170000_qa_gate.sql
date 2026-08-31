-- ─────────────────────────────────────────────────────────
-- 게이트 로직 확인용 방 (사용자에게는 안 보입니다)
--
-- 게이트 자동 증설은 「8명이 찼을 때」만 동작하는 코드라, 진짜 방에서 확인하려면
-- 공식 방에 가짜 참가자를 남겨야 합니다. 그래서 확인 전용 상황을 하나 둡니다.
--
--   · `is_official = false` — 상황 목록 조회가 `is_official = true` 로 거르므로 안 보입니다
--   · 앞으로 게이트 로직을 고칠 때마다 여기서 확인하면 됩니다
--
-- 여기 쌓이는 참가자·게이트는 전부 테스트 흔적입니다. 지워도 되고 둬도 됩니다.
-- ─────────────────────────────────────────────────────────

insert into rooms (slug, situation_key, gate_no, world, is_official, capacity,
                   title, title_ja, title_en, situation, situation_ja, situation_en) values
  ('qa-gate-1', 'qa-gate', 1, 'idol', false, 8,
   'QA 게이트', 'QAゲート', 'QA gate',
   '게이트 증설 확인용', 'ゲート増設の確認用', 'For checking gate overflow')
on conflict (slug) do nothing;
