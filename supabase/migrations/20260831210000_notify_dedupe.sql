-- ─────────────────────────────────────────────────────────
-- 디스코드 알림 함수 한 벌로
--
-- notify_discord(방 있음) 와 notify_discord_plain(방 없음) 이 vault 조회와
-- http_post 를 각자 하고 있었습니다. 웹훅 주소를 바꾸거나 형식을 고칠 때
-- 두 군데를 고쳐야 하는 구조라, 앞엣것이 뒤엣것을 부르게 바꿉니다.
-- ─────────────────────────────────────────────────────────

create or replace function public.notify_discord(title text, room_id uuid, body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare rname text;
begin
  select r.title into rname from rooms r where r.id = room_id;
  perform public.notify_discord_plain(title || ' — ' || coalesce(rname, '?'), body);
end
$$;
