-- ─────────────────────────────────────────────────────────
-- 응원 방 도배 방지
--
-- 지금 방어가 브라우저 쿨다운뿐이라 개발자도구나 다른 브라우저로 뚫립니다.
-- 로그인이 없어서(절대 규칙 ⑤) 완벽한 방어는 불가능하지만,
-- 서버에서 막으면 "장난삼아 도배"는 사실상 사라집니다.
--
-- ⚠️ 응원 방에만 겁니다. 멤놀방은 빠르게 주고받는 게 정상이라 건드리면 안 됩니다.
-- ⚠️ 사람 기준은 client_id 입니다. participant_id 로 재면 색깔 방 8개에
--    나눠 쓰는 것으로 8배 뚫립니다.
-- ─────────────────────────────────────────────────────────

create index if not exists messages_participant_created_idx
  on messages (participant_id, created_at desc);

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

  -- 10초에 한 번
  select count(*) into recent
    from messages m join participants p on p.id = m.participant_id
   where p.client_id = who
     and m.created_at > now() - interval '10 seconds';

  if recent > 0 then
    raise exception 'cheer_too_fast'
      using hint = '조금 뒤에 다시 남길 수 있어요';
  end if;

  -- 한 시간에 20개
  select count(*) into hourly
    from messages m join participants p on p.id = m.participant_id
   where p.client_id = who
     and m.created_at > now() - interval '1 hour';

  if hourly >= 20 then
    raise exception 'cheer_too_many'
      using hint = '오늘은 충분히 남기셨어요. 조금 뒤에 다시 와주세요';
  end if;

  return new;
end
$$;

drop trigger if exists limit_cheer_posting_trg on messages;
create trigger limit_cheer_posting_trg
  before insert on messages
  for each row execute function public.limit_cheer_posting();
