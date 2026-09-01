-- ─────────────────────────────────────────────────────────
-- 응원방 도배 방지가 멤놀방 대화까지 세고 있었습니다
--
-- 20260829080502 의 트리거는 「응원방에 넣는 글일 때만」 검사하지만,
-- 정작 개수를 세는 쿼리에 **방 조건이 없습니다.** 그래서 client_id 가 같은 사람의
-- 멤놀방 채팅이 전부 이 숫자에 들어갑니다.
--
--   · 멤놀방에서 방금 한 마디 했으면  → 응원방 10초 규칙에 걸립니다
--   · 멤놀방에서 20줄 주고받았으면    → 한 시간 동안 응원방에 한 줄도 못 남깁니다
--     (화면에는 「오늘은 충분히 남기셨어요」가 뜹니다)
--
-- 응원방만 있던 시절에는 맞는 코드였는데, 2026-08-31 에 멤놀방이 열리면서 어긋났습니다.
-- 세는 쪽도 응원방으로 좁힙니다. 기준이 client_id 인 것은 그대로입니다 —
-- participant_id 로 재면 색깔 방 8개에 나눠 쓰는 것으로 8배 뚫립니다.
-- ─────────────────────────────────────────────────────────

create or replace function public.limit_cheer_posting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_cheer boolean;
  who      text;
  recent   int;
  hourly   int;
begin
  select (r.world = 'cheer') into is_cheer
    from rooms r where r.id = new.room_id;

  if not coalesce(is_cheer, false) then
    return new;                       -- 멤놀방은 통과
  end if;

  select p.client_id into who
    from participants p where p.id = new.participant_id;

  if who is null then
    return new;
  end if;

  -- 10초에 한 번 (**응원방에 남긴 것만** 셉니다)
  select count(*) into recent
    from messages m
    join participants p on p.id = m.participant_id
    join rooms r       on r.id = m.room_id and r.world = 'cheer'
   where p.client_id = who
     and m.created_at > now() - interval '10 seconds';

  if recent > 0 then
    raise exception 'cheer_too_fast'
      using hint = '조금 뒤에 다시 남길 수 있어요';
  end if;

  -- 한 시간에 20개 (마찬가지로 응원방만)
  select count(*) into hourly
    from messages m
    join participants p on p.id = m.participant_id
    join rooms r       on r.id = m.room_id and r.world = 'cheer'
   where p.client_id = who
     and m.created_at > now() - interval '1 hour';

  if hourly >= 20 then
    raise exception 'cheer_too_many'
      using hint = '오늘은 충분히 남기셨어요. 조금 뒤에 다시 와주세요';
  end if;

  return new;
end
$$;

-- 방으로 좁히면서 room_id 가 조건에 들어왔습니다
create index if not exists messages_room_participant_created_idx
  on messages (room_id, participant_id, created_at desc);
