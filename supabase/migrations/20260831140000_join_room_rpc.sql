-- ─────────────────────────────────────────────────────────
-- 참가자 등록을 함수 하나로 모읍니다 (사칭 차단)
--
-- 지금까지 브라우저가 participants 를 직접 읽고 쓰고 있었습니다.
--   · select 정책이 using (true) 라 **남의 client_id 가 브라우저로 나갔습니다**
--   · update 정책도 using (true) 라 그 client_id 로 남의 이름·색·역할을
--     바꾸거나 그 사람으로 방에 들어갈 수 있었습니다
--
-- 로그인이 없어서(절대 규칙 ⑤) "본인 것만"을 RLS 로 가릴 수는 없습니다.
-- 대신 **client_id 를 아무도 읽을 수 없게** 만들면 남의 것을 알아낼 방법이 사라집니다.
--
--   ① 쓰기는 이 함수로만 (security definer)
--   ② 브라우저에서 participants 의 insert · update 권한 회수
--   ③ client_id 컬럼은 select 권한도 회수 — 조회는 물론 where 조건에도 못 씁니다
--
-- 읽기(이름·색·역할)는 그대로 열어둡니다. 참여자 목록에 필요합니다.
-- ─────────────────────────────────────────────────────────

create or replace function public.join_room(
  p_room_id   uuid,
  p_client_id text,
  p_name      text,
  p_color_key text,
  p_role      text default null,
  p_avatar    text default 'preset-01'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if p_client_id is null or length(p_client_id) < 8 then
    raise exception 'bad_client_id';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'name_required';
  end if;

  -- 나갔다 들어와서 역할을 바꾸면 이름·색·역할을 덮어씁니다 (학생 피드백 2026-08-26)
  insert into participants (room_id, client_id, name, role, color_key, avatar)
  values (p_room_id, p_client_id, btrim(p_name), nullif(btrim(coalesce(p_role,'')), ''), p_color_key, p_avatar)
  on conflict (room_id, client_id) do update
    set name = excluded.name,
        role = excluded.role,
        color_key = excluded.color_key,
        avatar = excluded.avatar
  returning id into pid;

  return pid;
end
$$;

revoke all on function public.join_room(uuid, text, text, text, text, text) from public;
grant execute on function public.join_room(uuid, text, text, text, text, text) to anon, authenticated;

-- ② 브라우저는 이제 participants 에 직접 쓰지 않습니다
drop policy if exists "dev insert" on participants;
drop policy if exists "dev update" on participants;
revoke insert, update, delete on participants from anon, authenticated;

-- ③ client_id 는 읽을 수도 없습니다.
--    ⚠️ where 조건에도 select 권한이 필요합니다 — 그래서 `.eq('client_id', …)` 는
--       더 이상 동작하지 않습니다. 그 조회는 전부 join_room 안으로 들어갔습니다.
revoke select (client_id) on participants from anon, authenticated;
