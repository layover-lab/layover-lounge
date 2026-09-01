-- ─────────────────────────────────────────────────────────
-- 메시지도 함수 하나로 모읍니다 (사칭 차단 — participants 편의 나머지 절반)
--
-- 20260831140000 에서 client_id 를 가려 「남의 client_id 로 방에 들어가기」는 막았습니다.
-- 그런데 **메시지는 아직 남의 이름으로 넣을 수 있었습니다.**
--
--   · messages 의 insert 정책이 `participant_id is not null` 하나뿐이고
--   · participants.id 는 참여자 목록에 필요해서 공개돼 있습니다
--   → anon 키(브라우저에 그대로 있습니다)로 아무 방에나, 아무 사람의 id 로 글을 넣을 수 있습니다.
--     말풍선에는 그 사람의 이름과 색이 그대로 찍힙니다.
--
-- 로그인이 없어서(절대 규칙 ⑤) 「본인 것만」을 RLS 로 가릴 수는 없습니다.
-- join_room 과 같은 해법을 씁니다 — **participant_id 를 브라우저가 고르지 못하게** 합니다.
-- 브라우저는 client_id 를 보내고, 서버가 그 방에서의 participant_id 를 직접 찾습니다.
-- client_id 는 여전히 브라우저에서 서버로만 가고 돌아오지 않습니다.
--
-- ⚠️ 도배 방지 트리거(limit_cheer_posting)는 그대로 돕니다. 트리거는 insert 에 붙어 있고
--    여기서도 같은 insert 를 하기 때문입니다. cheer_too_fast 같은 예외도 그대로 올라옵니다.
-- ─────────────────────────────────────────────────────────

create or replace function public.send_message(
  p_room_id       uuid,
  p_client_id     text,
  p_layer         text,
  p_body          text,
  p_client_msg_id text default null
)
returns uuid                      -- 방금 넣은 메시지의 진짜 id
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  mid uuid;
begin
  if p_client_id is null or length(p_client_id) < 8 then
    raise exception 'bad_client_id';
  end if;

  -- **여기가 핵심입니다.** 브라우저가 participant_id 를 넘기지 않습니다 —
  -- 이 방에서의 내 id 는 서버가 client_id 로 찾습니다. 남의 것을 지목할 방법이 없습니다
  select id into pid
    from participants
   where room_id = p_room_id and client_id = p_client_id;

  if pid is null then
    -- 방에 들어오지 않은 사람. 정상 경로라면 join_room 이 먼저 돕니다
    raise exception 'not_in_room';
  end if;

  insert into messages (room_id, layer, participant_id, body, client_msg_id)
  values (p_room_id, p_layer, pid, p_body, p_client_msg_id)
  returning id into mid;

  return mid;
end
$$;

revoke all on function public.send_message(uuid, text, text, text, text) from public;
grant execute on function public.send_message(uuid, text, text, text, text) to anon, authenticated;

-- 브라우저는 이제 messages 에 직접 쓰지 않습니다.
-- 정책도 같이 내립니다 — 권한이 없으면 정책은 아무것도 지키지 않으면서 남아 있게 됩니다
drop policy if exists "insert with participant" on messages;
revoke insert, update, delete on messages from anon, authenticated;

-- 읽기는 그대로입니다. 대화는 보여야 합니다
