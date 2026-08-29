-- ─────────────────────────────────────────────────────────
-- 응원 방 (기획서 5.10 신설)
--
-- 새 테이블을 만들지 않습니다. rooms · participants · messages 를 그대로 쓰고
-- rooms.world = 'cheer' 로 멤놀방과 갈라둡니다 (부록 E.6).
--
--   world = 'idol'   멤놀방. 정원 8명. 실시간 필요
--   world = 'cheer'  응원 방. 정원 없음. 실시간 안 씀
-- ─────────────────────────────────────────────────────────

-- ① 색깔별 방 8개
insert into rooms (slug, title, world, is_official, capacity) values
  ('cheer-yellow',    'イエローへ',  'cheer', true, null),
  ('cheer-red',       'レッドへ',    'cheer', true, null),
  ('cheer-green',     'グリーンへ',  'cheer', true, null),
  ('cheer-blue',      'ブルーへ',    'cheer', true, null),
  ('cheer-orange',    'オレンジへ',  'cheer', true, null),
  ('cheer-lightblue', 'スカイへ',    'cheer', true, null),
  ('cheer-purple',    'パープルへ',  'cheer', true, null),
  ('cheer-pink',      'ピンクへ',    'cheer', true, null)
on conflict (slug) do nothing;

-- ② 본문 길이 제한 — 거대한 페이로드와 빈 글을 DB 에서 막습니다
--    채팅 입력이 500자라 그 위로 잡았습니다. 응원 방은 화면에서 200자로 더 조입니다.
alter table messages
  add constraint messages_body_len
  check (char_length(body) between 1 and 500);

-- ③ 참가자 없는 글을 막습니다 — dev 정책이 with check (true) 라 누구나 넣을 수 있었습니다
drop policy if exists "dev insert" on messages;
create policy "insert with participant" on messages
  for insert with check (participant_id is not null);
