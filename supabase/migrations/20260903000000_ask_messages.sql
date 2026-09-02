-- ─────────────────────────────────────────────────────────
-- 「내가 쓴 이 표현, 자연스럽게 들리나요?」
--
-- 첨삭을 **서비스에서 교환으로** 바꿉니다.
--
-- 지금까지는 대표가 답하는 구조였습니다. 그러면 대표가 병목이고, 잘될수록 무너집니다 —
-- 100명이 오면 100명분의 답을 혼자 써야 합니다. 그리고 방향이 하나뿐이라
-- 한국어를 배우는 사람만 쓸 수 있었습니다 (영어 문구가 "Fix my Korean" 이었습니다).
--
-- 방 안에는 이미 서로의 모국어를 배우고 싶은 두 집단이 앉아 있습니다.
-- 질문을 **백스테이지 메시지**로 만들면 답하는 사람이 정해져 있지 않게 됩니다 —
-- 대표든, 그 방의 다른 한국인이든, 일본어를 봐주는 일본인이든.
--
-- ⚠️ 질문 문구를 body 에 글자로 넣지 않습니다 (절대 규칙 ②).
--    body 에는 **물어본 문장만** 담고, 질문 줄은 화면이 보는 사람 언어로 그립니다.
--    일본어로 물어도 한국인 화면에는 한국어로 보여야 합니다 —
--    못 읽으면 답이 안 오고, 답이 안 오면 그 사람은 다시 안 묻습니다.
-- ─────────────────────────────────────────────────────────

alter table messages drop constraint if exists messages_kind_check;
alter table messages add constraint messages_kind_check
  check (kind in ('line', 'action', 'system', 'ask'));

-- ⚠️ 인자 수가 바뀌므로 **갈아끼웁니다.** `create or replace` 로는 옛 5-인자 함수가
--    그대로 남아 둘이 공존하고, PostgREST 가 어느 쪽을 부를지 헷갈립니다.
--    p_kind 에 기본값이 있어서 옛 화면(인자 5개)도 그대로 돕니다 —
--    **이 SQL 을 먼저 넣고 배포하세요.** 순서가 반대면 그 사이 전송이 막힙니다.
drop function if exists public.send_message(uuid, text, text, text, text);

create or replace function public.send_message(
  p_room_id       uuid,
  p_client_id     text,
  p_layer         text,
  p_body          text,
  p_client_msg_id text default null,
  p_kind          text default 'line'
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

  -- 'system' 은 브라우저가 못 만듭니다. 열어두면 「○○ 님이 도착했어요」를
  -- 사람이 흉내 내서 아무 말이나 시스템 안내처럼 보이게 할 수 있습니다
  if p_kind not in ('line', 'action', 'ask') then
    raise exception 'bad_kind';
  end if;

  -- 브라우저가 participant_id 를 넘기지 않습니다 —
  -- 이 방에서의 내 id 는 서버가 client_id 로 찾습니다 (20260901120000)
  select id into pid
    from participants
   where room_id = p_room_id and client_id = p_client_id;

  if pid is null then
    raise exception 'not_in_room';
  end if;

  insert into messages (room_id, layer, participant_id, body, client_msg_id, kind)
  values (p_room_id, p_layer, pid, p_body, p_client_msg_id, p_kind)
  returning id into mid;

  return mid;
end
$$;

revoke all on function public.send_message(uuid, text, text, text, text, text) from public;
grant execute on function public.send_message(uuid, text, text, text, text, text) to anon, authenticated;
