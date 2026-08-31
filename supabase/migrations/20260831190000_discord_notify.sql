-- ─────────────────────────────────────────────────────────
-- 디스코드 알림 — 첨삭 요청 · 신고
--
-- 대시보드를 계속 볼 수는 없습니다. 들어오는 순간 알아야 답을 합니다.
--
-- ⚠️ 웹훅 URL 을 **이 파일에 적으면 안 됩니다.** 이 저장소는 public 이라
--    깃허브에 그대로 공개되고, URL 을 아는 사람은 누구나 그 채널에 글을 쏩니다.
--    값은 Vault 에 넣고 여기서는 이름으로만 꺼냅니다:
--
--      select vault.create_secret('<웹훅 URL>', 'discord_webhook');
--
-- ⚠️ pg_net 은 비동기입니다. 알림이 실패해도 INSERT 는 성공합니다 —
--    디스코드가 죽었다고 첨삭 요청이나 신고가 막히면 안 됩니다.
-- ─────────────────────────────────────────────────────────

create extension if not exists pg_net;

create or replace function public.notify_discord(title text, room_id uuid, body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hook  text;
  rname text;
begin
  select decrypted_secret into hook
    from vault.decrypted_secrets where name = 'discord_webhook';
  if hook is null then return; end if;      -- 비밀이 없으면 조용히 넘어갑니다

  select r.title into rname from rooms r where r.id = room_id;

  perform net.http_post(
    url     := hook,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'content', title || ' — ' || coalesce(rname, '?') || E'\n> ' || left(coalesce(body, ''), 300)
    )
  );
end
$$;

-- ① 첨삭 요청
create or replace function public.notify_correction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_discord('✏️ 첨삭 요청', new.room_id, new.body);
  return new;
end $$;

drop trigger if exists notify_correction_trg on corrections;
create trigger notify_correction_trg after insert on corrections
  for each row execute function public.notify_correction();

-- ② 신고 — 안전 기능이라 첨삭보다 더 급합니다.
--    내용은 안 보냅니다. 사유와 방만 알리고 원문은 대시보드에서 봅니다
create or replace function public.notify_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_discord('🚨 신고 (' || new.reason || ')', new.room_id, null);
  return new;
end $$;

drop trigger if exists notify_report_trg on reports;
create trigger notify_report_trg after insert on reports
  for each row execute function public.notify_report();
